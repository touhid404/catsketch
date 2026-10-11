import { promises as fs } from 'node:fs';
import path from 'node:path';
import { PrismaClient, Prisma } from '@prisma/client';
import type { ChatMessage, Participant, SceneElement } from '../../../packages/shared/src';

export type GuestRecord = Participant & { leftAt: string | null };
export type SessionRecord = { roomCode: string; title: string; createdAt: string; expiresAt: string; revision: number; elements: SceneElement[]; guests: GuestRecord[]; messages: ChatMessage[] };
export interface Repository { get(code: string): Promise<SessionRecord | undefined>; put(room: SessionRecord): Promise<void>; purgeExpired(): Promise<void>; close(): Promise<void> }

export class FileRepository implements Repository {
  private rooms: Record<string, SessionRecord> = {};
  private ready: Promise<void>;
  private writes: Promise<void> = Promise.resolve();
  private file = path.resolve(process.env.DATA_DIR || '../../.data', 'rooms.json');
  constructor() {
    this.ready = fs.readFile(this.file, 'utf8').then(raw => { this.rooms = JSON.parse(raw); }).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
  async get(code: string) { await this.ready; return this.rooms[code]; }
  async put(room: SessionRecord) { await this.ready; this.rooms[room.roomCode] = room; await this.save(); }
  private save() {
    this.writes = this.writes.catch(() => {}).then(async () => {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.writeFile(`${this.file}.tmp`, JSON.stringify(this.rooms), { mode: 0o600 });
      await fs.rename(`${this.file}.tmp`, this.file);
    });
    return this.writes;
  }
  async purgeExpired() { await this.ready; for (const [id, room] of Object.entries(this.rooms)) if (Date.parse(room.expiresAt) <= Date.now()) delete this.rooms[id]; await this.save(); }
  async close() { await this.writes; }
}

export class PostgresRepository implements Repository {
  private db = new PrismaClient();
  async get(roomCode: string): Promise<SessionRecord | undefined> {
    const room = await this.db.session.findUnique({ where: { roomCode }, include: { participants: true } });
    if (!room) return;
    return { roomCode, title: room.title, createdAt: room.createdAt.toISOString(), expiresAt: room.expiresAt.toISOString(), revision: room.revision, elements: room.sceneData as unknown as SceneElement[], messages: room.messages as unknown as ChatMessage[], guests: room.participants.map(p => ({ guestId: p.guestId, username: p.username, color: p.color, joinedAt: p.joinedAt.toISOString(), leftAt: p.leftAt?.toISOString() ?? null })) };
  }
  async put(room: SessionRecord) {
    const data = { title: room.title, expiresAt: new Date(room.expiresAt), revision: room.revision, sceneData: room.elements as unknown as Prisma.InputJsonValue, messages: room.messages as unknown as Prisma.InputJsonValue };
    await this.db.$transaction(async tx => {
      const session = await tx.session.upsert({ where: { roomCode: room.roomCode }, create: { ...data, roomCode: room.roomCode, createdAt: new Date(room.createdAt) }, update: data });
      for (const p of room.guests) await tx.participant.upsert({ where: { guestId: p.guestId }, create: { guestId: p.guestId, username: p.username, color: p.color, joinedAt: new Date(p.joinedAt), leftAt: p.leftAt ? new Date(p.leftAt) : null, sessionId: session.id }, update: { leftAt: p.leftAt ? new Date(p.leftAt) : null } });
    });
  }
  async purgeExpired() { await this.db.session.deleteMany({ where: { expiresAt: { lte: new Date() } } }); }
  async close() { await this.db.$disconnect(); }
}
