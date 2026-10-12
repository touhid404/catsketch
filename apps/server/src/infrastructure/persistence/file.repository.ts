import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { FREE_ROOM_LIMIT, type OwnedRoomInfo } from '@catsketch/shared';
import type { Repository, SessionRecord } from './session.repository';
import type { AccountRepository, AccountRecord, AuthRecord } from './account.repository';
/** Explicit development/test adapter. Production always uses PostgreSQL. */
export class FileRepository implements Repository, AccountRepository {
  private rooms: Record<string, SessionRecord> = {};
  private accounts: Record<string, AccountRecord> = {};
  private chatHistory: Record<string, import('@catsketch/shared').ChatMessage[]> = {};
  private authSessions: Record<string, AuthRecord> = {};
  private ready: Promise<void>;
  private writes: Promise<void> = Promise.resolve();
  private file = path.resolve(process.env.DATA_DIR || '../../.data', 'rooms.json');
  constructor() {
    this.ready = fs
      .readFile(this.file, 'utf8')
      .then((raw) => {
        const data = JSON.parse(raw);
        this.rooms = data.rooms || data;
        this.accounts = data.accounts || {};
        this.authSessions = data.authSessions || {};
        this.chatHistory = data.chatHistory || {};
      })
      .catch((error) => {
        if (error.code !== 'ENOENT') throw error;
      });
  }
  async get(code: string) {
    await this.ready;
    return this.rooms[code];
  }
  async put(room: SessionRecord) {
    await this.ready;
    if (!this.rooms[room.roomCode]) throw new NotFoundException('This space was deleted.');
    room.updatedAt = new Date().toISOString();
    this.rooms[room.roomCode] = room;
    await this.save();
  }
  async createOwned(room: SessionRecord, ownerId: string) {
    await this.ready;
    const owner = this.accounts[ownerId];
    if (!owner || (owner.plan === 'FREE' && owner.createdRoomsCount >= FREE_ROOM_LIMIT))
      throw new ForbiddenException(
        'You’ve used your five free spaces. You can still join existing spaces.',
      );
    owner.createdRoomsCount++;
    this.rooms[room.roomCode] = room;
    await this.save();
  }
  async listOwned(ownerId: string): Promise<OwnedRoomInfo[]> {
    await this.ready;
    return Object.values(this.rooms)
      .filter((r) => r.ownerId === ownerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => ({
        roomCode: r.roomCode,
        title: r.title,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt ?? r.createdAt,
        elementCount: r.elements.filter((element) => !element.isDeleted).length,
        messageCount: (this.chatHistory[r.roomCode] ?? r.messages).length,
        guestCount: r.guests.length,
        expiresAt: r.expiresAt,
        maxParticipants: r.maxParticipants,
        participantCount: 0,
        audioEnabled: !!(process.env.STREAM_API_KEY && process.env.STREAM_API_SECRET),
      }));
  }
  async createAccount(email: string, name: string, passwordHash: string) {
    await this.ready;
    if (Object.values(this.accounts).some((user) => user.email === email))
      throw new ConflictException('An account with this email already exists. Sign in instead.');
    const account: AccountRecord = {
      id: randomUUID(),
      email,
      name,
      passwordHash,
      plan: 'FREE',
      createdRoomsCount: 0,
      creationLimit: 5,
      maxParticipants: 10,
      createdAt: new Date().toISOString(),
    };
    this.accounts[account.id] = account;
    await this.save();
    return account;
  }
  async findAccountByEmail(email: string) {
    await this.ready;
    return Object.values(this.accounts).find((a) => a.email === email);
  }
  async findAuthSession(tokenHash: string) {
    await this.ready;
    const session = this.authSessions[tokenHash];
    return session && Date.parse(session.expiresAt) > Date.now()
      ? this.accounts[session.userId]
      : undefined;
  }
  async saveAuthSession(session: AuthRecord) {
    await this.ready;
    this.authSessions[session.tokenHash] = session;
    await this.save();
  }
  async deleteAuthSession(tokenHash: string) {
    await this.ready;
    delete this.authSessions[tokenHash];
    await this.save();
  }
  private save() {
    this.writes = this.writes
      .catch(() => {})
      .then(async () => {
        await fs.mkdir(path.dirname(this.file), { recursive: true });
        await fs.writeFile(
          `${this.file}.tmp`,
          JSON.stringify({
            rooms: this.rooms,
            accounts: this.accounts,
            authSessions: this.authSessions,
            chatHistory: this.chatHistory,
          }),
          { mode: 0o600 },
        );
        await fs.rename(`${this.file}.tmp`, this.file);
      });
    return this.writes;
  }
  async appendMessage(code: string, message: import('@catsketch/shared').ChatMessage) {
    await this.ready;
    (this.chatHistory[code] ||= []).push(message);
    await this.save();
  }
  async purgeExpired() {
    await this.ready;
    for (const [id, room] of Object.entries(this.rooms))
      if (!room.ownerId && room.expiresAt && Date.parse(room.expiresAt) <= Date.now())
        delete this.rooms[id];
    for (const [id, session] of Object.entries(this.authSessions))
      if (Date.parse(session.expiresAt) <= Date.now()) delete this.authSessions[id];
    await this.save();
  }
  async close() {
    await this.writes;
  }
  async deleteOwned(code: string, ownerId: string) {
    await this.ready;
    if (this.rooms[code]?.ownerId !== ownerId)
      throw new ForbiddenException('Only the space owner can delete this space.');
    delete this.rooms[code];
    delete this.chatHistory[code];
    await this.save();
  }
  async deletionData(userId: string) {
    await this.ready;
    const owned = Object.values(this.rooms).filter((room) => room.ownerId === userId);
    const visited = Object.values(this.rooms).filter((room) =>
      room.guests.some((guest) => guest.userId === userId),
    );
    return {
      ownedCodes: owned.map((room) => room.roomCode),
      affectedCodes: [...new Set([...owned, ...visited].map((room) => room.roomCode))],
      guestIds: [
        ...new Set([
          ...owned.flatMap((room) => room.guests.map((guest) => guest.guestId)),
          ...visited.flatMap((room) =>
            room.guests.filter((guest) => guest.userId === userId).map((guest) => guest.guestId),
          ),
        ]),
      ],
    };
  }
  async deleteAccount(userId: string) {
    await this.ready;
    const data = await this.deletionData(userId);
    const guestIds = new Set(data.guestIds);
    for (const code of data.ownedCodes) {
      delete this.rooms[code];
      delete this.chatHistory[code];
    }
    for (const room of Object.values(this.rooms)) {
      room.guests = room.guests.filter((guest) => guest.userId !== userId);
      room.messages = room.messages.filter((message) => !guestIds.has(message.guestId));
      this.chatHistory[room.roomCode] = (this.chatHistory[room.roomCode] ?? []).filter(
        (message) => !guestIds.has(message.guestId),
      );
    }
    for (const [id, session] of Object.entries(this.authSessions))
      if (session.userId === userId) delete this.authSessions[id];
    delete this.accounts[userId];
    await this.save();
  }
}
