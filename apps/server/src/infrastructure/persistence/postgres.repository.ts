import { ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  FREE_PARTICIPANT_LIMIT,
  type ChatMessage,
  type SceneElement,
  type OwnedRoomInfo,
} from '@catsketch/shared';
import type { Repository, SessionRecord } from './session.repository';
import type { AccountRepository, AccountRecord, AuthRecord } from './account.repository';
export class PostgresRepository implements Repository, AccountRepository {
  private db = new PrismaClient();
  private writes: Promise<void> = Promise.resolve();
  async get(roomCode: string): Promise<SessionRecord | undefined> {
    const room = await this.db.session.findUnique({
      where: { roomCode },
      include: {
        participants: { orderBy: { joinedAt: 'asc' } },
        snapshot: true,
        messages: { orderBy: { createdAt: 'desc' }, take: 100 },
        owner: { include: { tier: true } },
      },
    });
    if (!room) return;
    return {
      roomCode,
      ownerId: room.ownerId,
      maxParticipants: room.owner ? room.owner.tier.participantLimit : FREE_PARTICIPANT_LIMIT,
      title: room.title,
      createdAt: room.createdAt.toISOString(),
      updatedAt: room.snapshot?.updatedAt.toISOString() ?? room.createdAt.toISOString(),
      expiresAt: room.expiresAt?.toISOString() ?? null,
      revision: room.snapshot?.revision ?? 0,
      elements: (room.snapshot?.sceneData || []) as unknown as SceneElement[],
      messages: room.messages.reverse().map((m) => ({
        id: m.id,
        guestId: m.guestId,
        avatarSeed: room.participants.find((p) => p.guestId === m.guestId)?.userId ?? m.guestId,
        username: m.username,
        text: m.text,
        createdAt: m.createdAt.toISOString(),
      })),
      guests: room.participants.map((p) => ({
        guestId: p.guestId,
        avatarSeed: p.userId ?? p.guestId,
        userId: p.userId,
        username: p.username,
        color: p.color,
        joinedAt: p.joinedAt.toISOString(),
        leftAt: p.leftAt?.toISOString() ?? null,
      })),
    };
  }
  async put(room: SessionRecord) {
    const snapshot = structuredClone(room);
    this.writes = this.writes
      .catch(() => {})
      .then(async () => {
        await this.db.$transaction(
          async (tx) => {
            await this.writeRoom(tx, snapshot);
          },
          { maxWait: 30000, timeout: 30000 },
        );
      });
    return this.writes;
  }
  private async writeRoom(tx: Prisma.TransactionClient, room: SessionRecord, create = false) {
    const data = { title: room.title, expiresAt: room.expiresAt ? new Date(room.expiresAt) : null };
    const session = create
      ? await tx.session.create({
          data: {
            ...data,
            roomCode: room.roomCode,
            ownerId: room.ownerId,
            createdAt: new Date(room.createdAt),
          },
        })
      : await tx.session.update({ where: { roomCode: room.roomCode }, data });
    await tx.whiteboardSnapshot.upsert({
      where: { sessionId: session.id },
      create: {
        sessionId: session.id,
        revision: room.revision,
        sceneData: room.elements as unknown as Prisma.InputJsonValue,
      },
      update: {
        revision: room.revision,
        sceneData: room.elements as unknown as Prisma.InputJsonValue,
      },
    });
    await tx.participant.createMany({
      data: room.guests.map((p) => ({
        guestId: p.guestId,
        userId: p.userId,
        username: p.username,
        color: p.color,
        joinedAt: new Date(p.joinedAt),
        leftAt: p.leftAt ? new Date(p.leftAt) : null,
        sessionId: session.id,
      })),
      skipDuplicates: true,
    });
    for (const p of room.guests.filter((p) => p.leftAt))
      await tx.participant.updateMany({
        where: { guestId: p.guestId, leftAt: null },
        data: { leftAt: new Date(p.leftAt!) },
      });
  }
  async createOwned(room: SessionRecord, ownerId: string) {
    await this.db.$transaction(
      async (tx) => {
        const owner = await tx.user.findUniqueOrThrow({
          where: { id: ownerId },
          include: { tier: true },
        });
        const updated = await tx.user.updateMany({
          where: {
            id: ownerId,
            ...(owner.tier.creationLimit !== null
              ? { createdRoomsCount: { lt: owner.tier.creationLimit } }
              : {}),
          },
          data: { createdRoomsCount: { increment: 1 } },
        });
        if (!updated.count)
          throw new ForbiddenException(
            'You’ve used your five free spaces. You can still join existing spaces.',
          );
        await this.writeRoom(tx, room, true);
      },
      { maxWait: 30000, timeout: 30000 },
    );
  }
  async listOwned(ownerId: string): Promise<OwnedRoomInfo[]> {
    const rooms = await this.db.session.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      include: { snapshot: true, _count: { select: { participants: true, messages: true } } },
    });
    const owner = await this.db.user.findUniqueOrThrow({
      where: { id: ownerId },
      include: { tier: true },
    });
    return rooms.map((r) => ({
      roomCode: r.roomCode,
      title: r.title,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.snapshot?.updatedAt.toISOString() ?? r.createdAt.toISOString(),
      elementCount: ((r.snapshot?.sceneData ?? []) as unknown as SceneElement[]).filter(
        (element) => !element.isDeleted,
      ).length,
      messageCount: r._count.messages,
      guestCount: r._count.participants,
      expiresAt: r.expiresAt?.toISOString() ?? null,
      participantCount: 0,
      audioEnabled: !!(process.env.STREAM_API_KEY && process.env.STREAM_API_SECRET),
      maxParticipants: owner.tier.participantLimit,
    }));
  }
  private account(user: {
    id: string;
    email: string;
    name: string;
    passwordHash: string;
    plan: 'FREE' | 'PRO';
    createdRoomsCount: number;
    createdAt: Date;
    tier: { creationLimit: number | null; participantLimit: number | null };
  }): AccountRecord {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      passwordHash: user.passwordHash,
      plan: user.plan,
      createdRoomsCount: user.createdRoomsCount,
      createdAt: user.createdAt.toISOString(),
      creationLimit: user.tier.creationLimit,
      maxParticipants: user.tier.participantLimit,
    };
  }
  async createAccount(email: string, name: string, passwordHash: string) {
    try {
      return this.account(
        await this.db.user.create({ data: { email, name, passwordHash }, include: { tier: true } }),
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('An account with this email already exists. Sign in instead.');
      throw error;
    }
  }
  async findAccountByEmail(email: string) {
    const user = await this.db.user.findUnique({ where: { email }, include: { tier: true } });
    return user ? this.account(user) : undefined;
  }
  async findAuthSession(tokenHash: string) {
    const session = await this.db.authSession.findUnique({
      where: { tokenHash },
      include: { user: { include: { tier: true } } },
    });
    return session && session.expiresAt.getTime() > Date.now()
      ? this.account(session.user)
      : undefined;
  }
  async saveAuthSession(session: AuthRecord) {
    await this.db.authSession.create({
      data: { ...session, expiresAt: new Date(session.expiresAt) },
    });
  }
  async deleteAuthSession(tokenHash: string) {
    await this.db.authSession.deleteMany({ where: { tokenHash } });
  }
  async appendMessage(code: string, message: ChatMessage) {
    const session = await this.db.session.findUniqueOrThrow({
      where: { roomCode: code },
      select: { id: true },
    });
    await this.db.chatMessage.create({
      data: {
        id: message.id,
        guestId: message.guestId,
        username: message.username,
        text: message.text,
        sessionId: session.id,
        createdAt: new Date(message.createdAt),
      },
    });
  }
  async purgeExpired() {
    await this.db.session.deleteMany({ where: { ownerId: null, expiresAt: { lte: new Date() } } });
    await this.db.authSession.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  }
  async close() {
    await this.writes;
    await this.db.$disconnect();
  }
  async deleteOwned(roomCode: string, ownerId: string) {
    this.writes = this.writes
      .catch(() => {})
      .then(async () => {
        const deleted = await this.db.session.deleteMany({ where: { roomCode, ownerId } });
        if (!deleted.count)
          throw new ForbiddenException('Only the space owner can delete this space.');
      });
    await this.writes;
  }
  async deletionData(userId: string) {
    const owned = await this.db.session.findMany({
      where: { ownerId: userId },
      select: { roomCode: true, participants: { select: { guestId: true } } },
    });
    const visits = await this.db.participant.findMany({
      where: { userId },
      select: { guestId: true, session: { select: { roomCode: true } } },
    });
    return {
      ownedCodes: owned.map((room) => room.roomCode),
      affectedCodes: [
        ...new Set([
          ...owned.map((room) => room.roomCode),
          ...visits.map((guest) => guest.session.roomCode),
        ]),
      ],
      guestIds: [
        ...new Set([
          ...owned.flatMap((room) => room.participants.map((guest) => guest.guestId)),
          ...visits.map((guest) => guest.guestId),
        ]),
      ],
    };
  }
  async deleteAccount(userId: string) {
    await this.writes.catch(() => {});
    await this.db.$transaction(
      async (tx) => {
        // Lock the account before deleting its rooms; concurrent creation cannot add an orphan.
        await tx.user.update({
          where: { id: userId },
          data: { createdRoomsCount: { increment: 0 } },
        });
        await tx.session.deleteMany({ where: { ownerId: userId } });
        await tx.participant.deleteMany({ where: { userId } });
        await tx.user.delete({ where: { id: userId } });
      },
      { maxWait: 30000, timeout: 30000 },
    );
  }
}
