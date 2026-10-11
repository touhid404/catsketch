import { PrismaClient, Prisma } from '@prisma/client';
import type { ChatMessage, SceneElement } from '@syncspace/shared';
import type { Repository, SessionRecord } from './session.repository';
export class PostgresRepository implements Repository {
  private db = new PrismaClient();
  async get(roomCode: string): Promise<SessionRecord | undefined> {
    const room = await this.db.session.findUnique({
      where: { roomCode },
      include: { participants: true },
    });
    if (!room) return;
    return {
      roomCode,
      title: room.title,
      createdAt: room.createdAt.toISOString(),
      expiresAt: room.expiresAt.toISOString(),
      revision: room.revision,
      elements: room.sceneData as unknown as SceneElement[],
      messages: room.messages as unknown as ChatMessage[],
      guests: room.participants.map((p) => ({
        guestId: p.guestId,
        username: p.username,
        color: p.color,
        joinedAt: p.joinedAt.toISOString(),
        leftAt: p.leftAt?.toISOString() ?? null,
      })),
    };
  }
  async put(room: SessionRecord) {
    const data = {
      title: room.title,
      expiresAt: new Date(room.expiresAt),
      revision: room.revision,
      sceneData: room.elements as unknown as Prisma.InputJsonValue,
      messages: room.messages as unknown as Prisma.InputJsonValue,
    };
    await this.db.$transaction(async (tx) => {
      const session = await tx.session.upsert({
        where: { roomCode: room.roomCode },
        create: { ...data, roomCode: room.roomCode, createdAt: new Date(room.createdAt) },
        update: data,
      });
      for (const p of room.guests)
        await tx.participant.upsert({
          where: { guestId: p.guestId },
          create: {
            guestId: p.guestId,
            username: p.username,
            color: p.color,
            joinedAt: new Date(p.joinedAt),
            leftAt: p.leftAt ? new Date(p.leftAt) : null,
            sessionId: session.id,
          },
          update: { leftAt: p.leftAt ? new Date(p.leftAt) : null },
        });
    });
  }
  async purgeExpired() {
    await this.db.session.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  }
  async close() {
    await this.db.$disconnect();
  }
}
