import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Repository, SessionRecord } from './session.repository';
export class FileRepository implements Repository {
  private rooms: Record<string, SessionRecord> = {};
  private ready: Promise<void>;
  private writes: Promise<void> = Promise.resolve();
  private file = path.resolve(process.env.DATA_DIR || '../../.data', 'rooms.json');
  constructor() {
    this.ready = fs
      .readFile(this.file, 'utf8')
      .then((raw) => {
        this.rooms = JSON.parse(raw);
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
    this.rooms[room.roomCode] = room;
    await this.save();
  }
  private save() {
    this.writes = this.writes
      .catch(() => {})
      .then(async () => {
        await fs.mkdir(path.dirname(this.file), { recursive: true });
        await fs.writeFile(`${this.file}.tmp`, JSON.stringify(this.rooms), { mode: 0o600 });
        await fs.rename(`${this.file}.tmp`, this.file);
      });
    return this.writes;
  }
  async purgeExpired() {
    await this.ready;
    for (const [id, room] of Object.entries(this.rooms))
      if (Date.parse(room.expiresAt) <= Date.now()) delete this.rooms[id];
    await this.save();
  }
  async close() {
    await this.writes;
  }
}
