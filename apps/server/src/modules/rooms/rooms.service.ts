import {
  BadRequestException,
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
  deltaSchema,
  mergeScene,
  sceneSchema,
  usernameSchema,
  type Participant,
  type RoomInfo,
  type SceneElement,
} from '@syncspace/shared';
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
          const room = this.cache.get(code);
          if (room) {
            this.dirty.delete(code);
            try {
              await this.repository.put(room);
            } catch (e) {
              this.dirty.add(code);
              throw e;
            }
          }
        }
        for (const [code, room] of this.cache)
          if (Date.parse(room.expiresAt) <= Date.now()) {
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
    if (!room)
      throw new NotFoundException('This room could not be found. Check your invitation link.');
    if (Date.parse(room.expiresAt) <= Date.now())
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
      audioEnabled: !!(process.env.STREAM_API_KEY && process.env.STREAM_API_SECRET),
    };
  }
  private addGuest(room: SessionRecord, username: string) {
    if (room.guests.length >= 500)
      throw new BadRequestException('This room has reached its guest limit. Start a new room.');
    const guest = {
      guestId: randomUUID(),
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
        username: guest.username,
        color: guest.color,
        joinedAt: guest.joinedAt,
      },
      token,
      room: this.info(room),
    };
  }
  async create(input: unknown) {
    const data = z
      .object({
        username: usernameSchema,
        title: z.string().trim().min(1).max(80).default('Untitled space'),
        elements: sceneSchema.default([]),
      })
      .parse(input);
    const room: SessionRecord = {
      roomCode: randomBytes(9).toString('base64url'),
      title: data.title,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + this.ttl).toISOString(),
      revision: 0,
      elements: data.elements,
      guests: [],
      messages: [],
    };
    const session = this.addGuest(room, data.username);
    await this.repository.put(room);
    this.cache.set(room.roomCode, room);
    return session;
  }
  async join(code: string, input: unknown) {
    const { username } = z.object({ username: usernameSchema }).parse(input);
    const room = await this.room(code);
    const session = this.addGuest(room, username);
    await this.repository.put(room);
    return session;
  }
  async authorize(token: string, code?: string) {
    const claims = this.tokens.verify(token);
    if (code && code !== claims.roomCode)
      throw new UnauthorizedException('This invitation belongs to a different room.');
    const room = await this.room(claims.roomCode);
    const guest = room.guests.find((g) => g.guestId === claims.guestId && g.leftAt === null);
    if (!guest)
      throw new UnauthorizedException('Your guest session has ended. Rejoin with your name.');
    return { room, guest, claims };
  }
  async snapshot(token: string, code: string) {
    const { room } = await this.authorize(token, code);
    return { elements: room.elements, revision: room.revision };
  }
  update(room: SessionRecord, input: unknown) {
    const delta = deltaSchema.parse(input);
    const merged = mergeScene(room.elements, delta);
    if (merged.length > 5000)
      throw new BadRequestException('This whiteboard has reached its 5,000 object limit.');
    room.elements = merged;
    room.revision++;
    this.dirty.add(room.roomCode);
    return { elements: merged, revision: room.revision };
  }
  message(room: SessionRecord, guest: Participant, input: unknown) {
    const text = z.object({ text: z.string().trim().min(1).max(1000) }).parse(input).text;
    const message = {
      id: randomUUID(),
      guestId: guest.guestId,
      username: guest.username,
      text,
      createdAt: new Date().toISOString(),
    };
    room.messages.push(message);
    room.messages = room.messages.slice(-100);
    this.dirty.add(room.roomCode);
    return message;
  }
  async leave(token: string, code: string) {
    const { room, guest } = await this.authorize(token, code);
    guest.leftAt = new Date().toISOString();
    await this.repository.put(room);
    this.events.emit('revoked', code, guest.guestId);
    return { left: true };
  }
}
