import {
  BadRequestException,
  ConflictException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { z } from 'zod';
import {
  FREE_PARTICIPANT_LIMIT,
  type AccountSummary,
  deltaSchema,
  mergeScene,
  sceneSchema,
  usernameSchema,
  type Participant,
  type RoomInfo,
  type SceneElement,
} from '@catsketch/shared';
import {
  SESSION_REPOSITORY,
  type SessionRecord,
  type Repository,
} from '../../infrastructure/persistence/session.repository';

import { GuestTokenService } from '../../common/security/guest-token.service';
const colors = ['#e77945', '#7864d7', '#2b9b8c', '#cf6993', '#428bd6'];
const codeSchema = z.string().regex(/^[A-Za-z0-9_-]{12}$/);
@Injectable()
export class RoomsService implements OnModuleInit, OnModuleDestroy {
  readonly events = new EventEmitter();
  private cache = new Map<string, SessionRecord>();
  private loading = new Map<string, Promise<SessionRecord | undefined>>();
  private deleting = new Set<string>();
  private closingAccounts = new Set<string>();
  private accountWork = new Map<string, Set<Promise<unknown>>>();
  private roomWork = new Map<string, Set<Promise<unknown>>>();
  private track<T>(map: Map<string, Set<Promise<unknown>>>, key: string, task: Promise<T>) {
    const tasks = map.get(key) || new Set<Promise<unknown>>();
    map.set(key, tasks);
    tasks.add(task);
    const done = () => {
      tasks.delete(task);
      if (!tasks.size) map.delete(key);
    };
    void task.then(done, done);
    return task;
  }
  async prepareAccountDeletion(userId: string) {
    this.closingAccounts.add(userId);
    await Promise.allSettled([...(this.accountWork.get(userId) || [])]);
    return () => this.closingAccounts.delete(userId);
  }
  private dirty = new Set<string>();
  private timer?: NodeJS.Timeout;
  private lastPurge = 0;
  private flushing: Promise<void> = Promise.resolve();
  private ttl: number;
  readonly online = new Map<string, Map<string, Participant>>();
  constructor(
    @Inject(SESSION_REPOSITORY) private repository: Repository,
    @Inject(GuestTokenService) private tokens: GuestTokenService,
  ) {
    this.ttl = Number(process.env.ROOM_TTL_HOURS || 24) * 3600000;
    if (!Number.isFinite(this.ttl) || this.ttl < 60000 || this.ttl > 7 * 86400000)
      throw new Error('ROOM_TTL_HOURS must be between 1/60 and 168.');
  }
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.flush().catch((error) =>
        console.error('Snapshot persistence failed:', error.message),
      );
    }, 1500);
    this.timer.unref();
  }
  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.flush();
    await this.repository.close();
  }
  async flush() {
    this.flushing = this.flushing
      .catch(() => {})
      .then(async () => {
        for (const code of [...this.dirty]) {
          if (this.deleting.has(code)) continue;
          const room = this.cache.get(code);
          if (room) {
            this.dirty.delete(code);
            try {
              await this.repository.put(room);
            } catch (e) {
              if (this.cache.has(code)) this.dirty.add(code);
              throw e;
            }
          }
        }
        for (const [code, room] of this.cache)
          if (room.expiresAt && Date.parse(room.expiresAt) <= Date.now()) {
            this.events.emit('expired', code);
            this.cache.delete(code);
            this.online.delete(code);
            this.dirty.delete(code);
          }
        if (Date.now() - this.lastPurge > 60000) {
          await this.repository.purgeExpired();
          this.lastPurge = Date.now();
        }
      });
    return this.flushing;
  }
  async room(code: string) {
    if (this.deleting.has(code)) throw new NotFoundException('This space is being deleted.');
    if (!codeSchema.safeParse(code).success)
      throw new NotFoundException('This room could not be found.');
    let room = this.cache.get(code);
    if (!room) {
      let pending = this.loading.get(code);
      if (!pending) {
        pending = this.repository.get(code);
        this.loading.set(code, pending);
      }
      try {
        room = await pending;
        if (room) this.cache.set(code, room);
      } finally {
        this.loading.delete(code);
      }
    }
    if (this.deleting.has(code)) throw new NotFoundException('This space is being deleted.');
    if (!room)
      throw new NotFoundException('This room could not be found. Check your invitation link.');
    if (room.expiresAt && Date.parse(room.expiresAt) <= Date.now())
      throw new GoneException('This room has expired. Start a fresh space.');
    return room;
  }
  participants(code: string) {
    return [
      ...new Map([...(this.online.get(code)?.values() || [])].map((p) => [p.guestId, p])).values(),
    ];
  }
  info(room: SessionRecord): RoomInfo {
    return {
      roomCode: room.roomCode,
      title: room.title,
      createdAt: room.createdAt,
      expiresAt: room.expiresAt,
      participantCount: this.participants(room.roomCode).length,
      maxParticipants: room.maxParticipants,
      audioEnabled: !!(process.env.STREAM_API_KEY && process.env.STREAM_API_SECRET),
    };
  }
  private addGuest(room: SessionRecord, username: string, userId?: string) {
    if (room.guests.length >= 500)
      throw new BadRequestException('This room has reached its guest limit. Start a new room.');
    const guest = {
      guestId: randomUUID(),
      avatarSeed: userId,
      userId: userId ?? null,
      username,
      color: colors[room.guests.length % colors.length],
      joinedAt: new Date().toISOString(),
      leftAt: null,
    };
    room.guests.push(guest);
    const token = this.tokens.issue(
      { roomCode: room.roomCode, guestId: guest.guestId },
      room.expiresAt,
    );
    return {
      guest: {
        guestId: guest.guestId,
        avatarSeed: guest.avatarSeed ?? guest.guestId,
        username: guest.username,
        color: guest.color,
        joinedAt: guest.joinedAt,
      },
      token,
      room: this.info(room),
    };
  }
  create(input: unknown, owner: AccountSummary) {
    if (this.closingAccounts.has(owner.id))
      throw new UnauthorizedException('This account is being deleted.');
    return this.track(this.accountWork, owner.id, this.createRoom(input, owner));
  }
  private async createRoom(input: unknown, owner: AccountSummary) {
    const data = z
      .object({
        username: usernameSchema,
        title: z.string().trim().min(1).max(80).default('Untitled space'),
        elements: sceneSchema.default([]),
      })
      .parse(input);
    const room: SessionRecord = {
      ownerId: owner.id,
      maxParticipants: owner.maxParticipants,
      roomCode: randomBytes(9).toString('base64url'),
      title: data.title,
      createdAt: new Date().toISOString(),
      expiresAt: null,
      revision: 0,
      elements: data.elements,
      guests: [],
      messages: [],
    };
    const session = this.addGuest(room, owner.name, owner.id);
    await this.repository.createOwned(room, owner.id);
    this.cache.set(room.roomCode, room);
    return session;
  }
  join(code: string, input: unknown, account?: AccountSummary | null) {
    if (account && this.closingAccounts.has(account.id))
      throw new UnauthorizedException('This account is being deleted.');
    const task = this.track(this.roomWork, code, this.joinRoom(code, input, account));
    return account ? this.track(this.accountWork, account.id, task) : task;
  }
  private async joinRoom(code: string, input: unknown, account?: AccountSummary | null) {
    const { username } = z.object({ username: usernameSchema }).parse(input);
    const room = await this.room(code);
    if (room.maxParticipants !== null && this.participants(code).length >= room.maxParticipants)
      throw new ConflictException(
        'This space already has ten people. Try again when someone leaves.',
      );
    const session = this.addGuest(room, account?.name ?? username, account?.id);
    await this.repository.put(room);
    return session;
  }
  async owned(ownerId: string) {
    const rooms = await this.repository.listOwned(ownerId);
    return rooms.map((room) => ({
      ...room,
      participantCount: this.participants(room.roomCode).length,
    }));
  }
  async authorize(token: string, code?: string) {
    const claims = this.tokens.verify(token);
    if (code && code !== claims.roomCode)
      throw new UnauthorizedException('This invitation belongs to a different room.');
    const room = await this.room(claims.roomCode);
    const guest = room.guests.find((g) => g.guestId === claims.guestId && g.leftAt === null);
    if (!guest)
      throw new UnauthorizedException('Your guest session has ended. Rejoin with your name.');
    guest.avatarSeed = guest.userId ?? guest.guestId;
    return { room, guest, claims };
  }
  async snapshot(token: string, code: string) {
    const { room } = await this.authorize(token, code);
    return { elements: room.elements, revision: room.revision };
  }
  update(room: SessionRecord, input: unknown) {
    if (this.deleting.has(room.roomCode))
      throw new NotFoundException('This space is being deleted.');
    const delta = deltaSchema.parse(input);
    const merged = mergeScene(room.elements, delta);
    if (merged.length > 5000)
      throw new BadRequestException('This whiteboard has reached its 5,000 object limit.');
    room.elements = merged;
    room.revision++;
    this.dirty.add(room.roomCode);
    const submittedIds = new Set(delta.map((element) => element.id));
    return {
      elements: merged.filter((element) => submittedIds.has(element.id)),
      revision: room.revision,
    };
  }
  message(room: SessionRecord, guest: Participant, input: unknown) {
    if (this.deleting.has(room.roomCode))
      throw new NotFoundException('This space is being deleted.');
    return this.track(this.roomWork, room.roomCode, this.saveMessage(room, guest, input));
  }
  private async saveMessage(room: SessionRecord, guest: Participant, input: unknown) {
    const text = z.object({ text: z.string().trim().min(1).max(1000) }).parse(input).text;
    const message = {
      id: randomUUID(),
      guestId: guest.guestId,
      avatarSeed: guest.avatarSeed ?? guest.guestId,
      username: guest.username,
      text,
      createdAt: new Date().toISOString(),
    };
    await this.repository.appendMessage(room.roomCode, message);
    room.messages.push(message);
    room.messages = room.messages.slice(-100);
    this.dirty.add(room.roomCode);
    return message;
  }
  leave(token: string, code: string) {
    return this.track(this.roomWork, code, this.leaveRoom(token, code));
  }
  private async leaveRoom(token: string, code: string) {
    const { room, guest } = await this.authorize(token, code);
    guest.leftAt = new Date().toISOString();
    await this.repository.put(room);
    this.events.emit('revoked', code, guest.guestId);
    return { left: true };
  }
  async prepareDeletion(codes: string[]) {
    if (codes.some((code) => this.deleting.has(code)))
      throw new ConflictException('Deletion is already in progress. Try again shortly.');
    for (const code of codes) this.deleting.add(code);
    await Promise.allSettled(
      codes.flatMap((code) => [
        ...(this.roomWork.get(code) || []),
        ...(this.loading.get(code) ? [this.loading.get(code)!] : []),
      ]),
    );
    await this.flushing.catch(() => {});
    return () => {
      for (const code of codes) this.deleting.delete(code);
    };
  }
  async requireOwner(code: string, ownerId: string) {
    const room = await this.room(code);
    if (room.ownerId !== ownerId) throw new NotFoundException('This space is not in your account.');
    return room;
  }
  async deleteOwned(code: string, ownerId: string) {
    await this.repository.deleteOwned(code, ownerId);
    this.invalidate(code);
  }
  private invalidate(code: string) {
    this.cache.delete(code);
    this.loading.delete(code);
    this.dirty.delete(code);
    this.events.emit('deleted', code);
    this.online.delete(code);
  }
  accountDeleted(
    userId: string,
    data: import('../../infrastructure/persistence/account.repository').AccountDeletionData,
  ) {
    for (const code of data.ownedCodes) this.invalidate(code);
    const removed = new Set(data.guestIds);
    for (const code of data.affectedCodes.filter((code) => !data.ownedCodes.includes(code))) {
      const room = this.cache.get(code);
      if (room) {
        room.guests = room.guests.filter((guest) => guest.userId !== userId);
        room.messages = room.messages.filter((message) => !removed.has(message.guestId));
      }
      for (const guestId of removed) this.events.emit('revoked', code, guestId);
      this.events.emit('reload', code);
    }
  }
}
