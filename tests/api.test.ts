import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { io, type Socket } from 'socket.io-client';
import type { Ack, GuestSession, SyncState, SceneElement } from '../packages/shared/src';
const port = 3107,
  base = `http://localhost:${port}`;
let process: ChildProcess, dataDir: string;
let logs = '';
const sockets: Socket[] = [];
async function request(endpoint: string, body?: unknown, token?: string) {
  const res = await fetch(`${base}/api${endpoint}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, data: await res.json() };
}
async function create(name = 'Alex') {
  const result = await request('/sessions', { username: name });
  assert.equal(result.status, 201);
  return result.data as GuestSession;
}
async function connect(guest: GuestSession) {
  const socket = io(base, {
    auth: { token: guest.token },
    transports: ['websocket'],
    reconnection: false,
  });
  sockets.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
  return socket;
}
function emit<T>(socket: Socket, name: string, data?: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    socket
      .timeout(2000)
      .emit(name, data, (error: Error | null, result: Ack<T>) =>
        error ? reject(error) : result.ok ? resolve(result.data) : reject(new Error(result.error)),
      );
  });
}
function element(id: string, version = 1, isDeleted = false): SceneElement {
  return {
    id,
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    version,
    versionNonce: 1,
    isDeleted,
  };
}
before(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'syncspace-test-'));
  process = spawn('node', ['--import', 'tsx', 'apps/server/src/main.ts'], {
    cwd: path.resolve('.'),
    env: {
      ...globalThis.process.env,
      TSX_TSCONFIG_PATH: path.resolve('apps/server/tsconfig.json'),
      PORT: String(port),
      DATA_DIR: dataDir,
      DATABASE_URL: '',
      ALLOW_FILE_STORAGE: 'true',
      GUEST_TOKEN_SECRET: 'integration-test-secret-32-characters',
      STREAM_API_KEY: '',
      STREAM_API_SECRET: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  process.stdout?.on('data', (value) => {
    logs += value;
  });
  process.stderr?.on('data', (value) => {
    logs += value;
  });
  for (let n = 0; n < 100; n++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) return;
    } catch {}
    if (process.exitCode !== null) throw new Error(logs);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start: ${logs}`);
});
after(async () => {
  for (const socket of sockets) socket.disconnect();
  await new Promise<void>((resolve) => {
    if (process.exitCode !== null) return resolve();
    process.once('exit', () => resolve());
    process.kill('SIGTERM');
  });
  await rm(dataDir, { recursive: true, force: true });
});
describe('guest access', () => {
  test('creates a shareable room and validates usernames', async () => {
    const guest = await create();
    assert.match(guest.room.roomCode, /^[\w-]{12}$/);
    assert.equal(guest.guest.username, 'Alex');
    const info = await request(`/sessions/${guest.room.roomCode}`);
    assert.equal(info.status, 200);
    assert.equal((await request('/sessions', { username: '  ' })).status, 400);
    assert.equal((await request('/sessions/not-a-room')).status, 404);
  });
  test('protects snapshots and rejects tokens from other rooms', async () => {
    const a = await create(),
      b = await create();
    assert.equal((await request(`/sessions/${a.room.roomCode}/whiteboard`)).status, 401);
    assert.equal(
      (await request(`/sessions/${a.room.roomCode}/whiteboard`, undefined, b.token)).status,
      401,
    );
    assert.equal(
      (await request(`/sessions/${a.room.roomCode}/whiteboard`, undefined, a.token)).status,
      200,
    );
  });
  test('revokes access after explicit leave', async () => {
    const a = await create();
    assert.equal((await request(`/sessions/${a.room.roomCode}/leave`, {}, a.token)).status, 201);
    assert.equal(
      (await request(`/sessions/${a.room.roomCode}/whiteboard`, undefined, a.token)).status,
      401,
    );
  });
  test('returns a useful configuration error when audio is unavailable', async () => {
    const a = await create();
    assert.equal(
      (await request(`/sessions/${a.room.roomCode}/call-token`, {}, a.token)).status,
      503,
    );
  });
});
describe('collaboration', () => {
  test('syncs concurrent edits, deletions, chat, and recovered state', async () => {
    const a = await create();
    const joined = await request(`/sessions/${a.room.roomCode}/join`, { username: 'Sarah' });
    const b = joined.data as GuestSession;
    const sa = await connect(a),
      sb = await connect(b);
    await emit(sa, 'room:join');
    const initial = await emit<SyncState>(sb, 'room:join');
    assert.equal(initial.participants.length, 2);
    await Promise.all([
      emit(sa, 'canvas:update', [element('alex-box')]),
      emit(sb, 'canvas:update', [element('sarah-box')]),
    ]);
    let snapshot = (await request(`/sessions/${a.room.roomCode}/whiteboard`, undefined, a.token))
      .data;
    assert.deepEqual(snapshot.elements.map((e: SceneElement) => e.id).sort(), [
      'alex-box',
      'sarah-box',
    ]);
    await emit(sa, 'canvas:update', [element('alex-box', 2, true)]);
    await emit(sb, 'canvas:update', [element('alex-box')]);
    const message = await emit<{ text: string }>(sa, 'chat:send', { text: 'Hello team' });
    assert.equal(message.text, 'Hello team');
    sb.disconnect();
    const reconnected = await connect(b);
    const recovered = await emit<SyncState>(reconnected, 'room:join');
    assert.equal(recovered.elements.find((e) => e.id === 'alex-box')?.isDeleted, true);
    assert.equal(recovered.messages.length, 1);
    await assert.rejects(
      emit(sa, 'canvas:update', [{ ...element('bad'), x: 'invalid' }]),
      /number/,
    );
    sa.disconnect();
    reconnected.disconnect();
  });
  test('rejects updates before room membership is established', async () => {
    const a = await create();
    const s = await connect(a);
    await assert.rejects(emit(s, 'canvas:update', [element('no-join')]), /Join the room/);
    s.disconnect();
  });
  test('isolates chat across rooms', async () => {
    const a = await create(),
      b = await create();
    const sa = await connect(a),
      sb = await connect(b);
    await emit(sa, 'room:join');
    await emit(sb, 'room:join');
    let leaked = false;
    sb.on('chat:message', () => {
      leaked = true;
    });
    await emit(sa, 'chat:send', { text: 'Private to this room' });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(leaked, false);
    sa.disconnect();
    sb.disconnect();
  });
});
