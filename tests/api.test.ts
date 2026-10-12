import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
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
async function request(
  endpoint: string,
  body?: unknown,
  token?: string,
  cookie?: string,
  method?: 'GET' | 'POST' | 'DELETE',
) {
  const res = await fetch(`${base}/api${endpoint}`, {
    method: method || (body === undefined ? 'GET' : 'POST'),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return {
    status: res.status,
    data: await res.json(),
    cookie: res.headers.get('set-cookie')?.split(';')[0],
    setCookie: res.headers.get('set-cookie'),
  };
}
let ownerCookie = '',
  ownerCreated = 0;
async function register(name = 'Test owner') {
  const result = await request('/auth/register', {
    name,
    email: `owner-${randomUUID()}@example.test`,
    password: 'a-long-testing-password',
  });
  assert.equal(result.status, 201);
  assert.ok(result.cookie);
  return result;
}
async function create(name = 'Alex') {
  if (!ownerCookie || ownerCreated >= 5) {
    ownerCookie = (await register(name)).cookie!;
    ownerCreated = 0;
  }
  const result = await request('/sessions', { username: name }, undefined, ownerCookie);
  ownerCreated++;
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
  dataDir = await mkdtemp(path.join(tmpdir(), 'catsketch-test-'));
  process = spawn('node', ['--import', 'tsx', 'apps/server/src/main.ts'], {
    cwd: path.resolve('.'),
    env: {
      ...globalThis.process.env,
      TSX_TSCONFIG_PATH: path.resolve('apps/server/tsconfig.json'),
      PORT: String(port),
      DATA_DIR: dataDir,
      DATABASE_URL: globalThis.process.env.TEST_DATABASE_URL || '',
      ALLOW_FILE_STORAGE: globalThis.process.env.TEST_DATABASE_URL ? 'false' : 'true',
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
    assert.equal(
      (await request('/sessions', { username: '  ' }, undefined, ownerCookie)).status,
      400,
    );
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

describe('accounts and free plan', () => {
  test('carries the saved profile into spaces and exposes persisted owner details', async () => {
    const account = await register('Saved Cat Profile');
    const created = await request(
      '/sessions',
      { username: 'Different name', title: 'Profile space' },
      undefined,
      account.cookie,
    );
    assert.equal(created.status, 201);
    const owner = created.data as GuestSession;
    assert.equal(owner.guest.username, account.data.name);
    assert.equal(owner.guest.avatarSeed, account.data.id);
    const joined = await request(
      `/sessions/${owner.room.roomCode}/join`,
      { username: 'Another name' },
      undefined,
      account.cookie,
    );
    assert.equal(joined.data.guest.username, account.data.name);
    assert.equal(joined.data.guest.avatarSeed, account.data.id);
    const socket = await connect(owner);
    const state = await emit<SyncState>(socket, 'room:join');
    assert.equal(state.participants[0].avatarSeed, account.data.id);
    await emit(socket, 'canvas:update', [element('saved-profile-object')]);
    const message = await emit<{ avatarSeed: string }>(socket, 'chat:send', {
      text: 'A saved message',
    });
    assert.equal(message.avatarSeed, account.data.id);
    let detail: any;
    for (let attempt = 0; attempt < 30; attempt++) {
      const owned = await request('/sessions/owned', undefined, undefined, account.cookie);
      detail = owned.data[0];
      if (detail.elementCount === 1 && detail.messageCount === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    assert.equal(detail.elementCount, 1);
    assert.equal(detail.messageCount, 1);
    assert.equal(detail.guestCount, 2);
    assert.equal(detail.participantCount, 1);
    assert.ok(Number.isFinite(Date.parse(detail.updatedAt)));
    const other = await register();
    assert.deepEqual(
      (await request('/sessions/owned', undefined, undefined, other.cookie)).data,
      [],
    );
    socket.disconnect();
  });
  test('requires login to publish a shared canvas but lets guests join with only a name', async () => {
    assert.equal((await request('/sessions', { username: 'Guest' })).status, 401);
    const room = await create();
    const guest = await request(`/sessions/${room.room.roomCode}/join`, {
      username: 'No login needed',
    });
    assert.equal(guest.status, 201);
    assert.equal(room.room.expiresAt, null);
    assert.equal(room.room.maxParticipants, 10);
  });
  test('signs in with a private cookie and revokes it on logout', async () => {
    const account = await register();
    assert.match(account.setCookie!, /HttpOnly/);
    assert.match(account.setCookie!, /SameSite=Lax/);
    assert.equal(account.data.passwordHash, undefined);
    assert.equal(
      (await request('/auth/login', { email: account.data.email, password: 'wrong-password' }))
        .status,
      401,
    );
    const login = await request('/auth/login', {
      email: account.data.email.toUpperCase(),
      password: 'a-long-testing-password',
    });
    assert.equal(login.status, 201);
    assert.notEqual(login.cookie, account.cookie);
    assert.equal(
      (await request('/auth/me', undefined, undefined, login.cookie)).data.account.id,
      account.data.id,
    );
    assert.equal((await request('/auth/logout', {}, undefined, login.cookie)).status, 201);
    assert.equal(
      (await request('/auth/me', undefined, undefined, login.cookie)).data.account,
      null,
    );
  });
  test('enforces five total creations even for concurrent requests and isolates ownership', async () => {
    const account = await register();
    const results = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        request(
          '/sessions',
          { username: 'Owner', title: `Quota ${index}` },
          undefined,
          account.cookie,
        ),
      ),
    );
    assert.equal(
      results.filter((r) => r.status === 201).length,
      5,
      JSON.stringify(
        results.map((r) => ({ status: r.status, error: r.status === 201 ? undefined : r.data })),
      ),
    );
    assert.equal(results.filter((r) => r.status === 403).length, 1);
    const me = await request('/auth/me', undefined, undefined, account.cookie);
    assert.equal(me.data.account.createdRoomsCount, 5);
    assert.equal(me.data.account.remainingCreations, 0);
    const owned = await request('/sessions/owned', undefined, undefined, account.cookie);
    assert.equal(owned.data.length, 5);
    assert.equal((await request('/sessions/owned')).status, 401);
    const other = await register();
    assert.deepEqual(
      (await request('/sessions/owned', undefined, undefined, other.cookie)).data,
      [],
    );
    const room = results.find((r) => r.status === 201)!.data as GuestSession;
    await request(`/sessions/${room.room.roomCode}/leave`, {}, room.token);
    assert.equal(
      (await request('/sessions', { username: 'Owner' }, undefined, account.cookie)).status,
      403,
    );
  });
  test('blocks cross-site account mutation requests', async () => {
    const response = await fetch(`${base}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.example' },
      body: JSON.stringify({
        email: 'blocked@example.test',
        name: 'Blocked',
        password: 'a-long-testing-password',
      }),
    });
    assert.equal(response.status, 403);
  });
  test('admits at most ten simultaneous people and releases a slot on disconnect', async () => {
    const owner = await create();
    // Prepare guest identities before joining to test admission races at the socket boundary.
    const guests = [owner];
    for (let index = 0; index < 10; index++)
      guests.push(
        (await request(`/sessions/${owner.room.roomCode}/join`, { username: `Guest ${index}` }))
          .data,
      );
    const connections = await Promise.all(guests.map(connect));
    const results = await Promise.allSettled(
      connections.map((socket) => emit<SyncState>(socket, 'room:join')),
    );
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 10);
    assert.equal(results.filter((r) => r.status === 'rejected').length, 1);
    assert.equal(
      (await request(`/sessions/${owner.room.roomCode}/join`, { username: 'Too late' })).status,
      409,
    );
    const admitted = results.findIndex((r) => r.status === 'fulfilled'),
      waiting = results.findIndex((r) => r.status === 'rejected');
    connections[admitted].disconnect();
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(
      (await emit<SyncState>(connections[waiting], 'room:join')).participants.length,
      10,
    );
    for (const socket of connections) socket.disconnect();
  });
});

describe('permanent deletion', () => {
  test('only the owner can delete a space; cascades all data, disconnects guests, and keeps the lifetime quota', async () => {
    const owner = await create();
    const cookie = ownerCookie;
    const code = owner.room.roomCode;
    const guest = (await request(`/sessions/${code}/join`, { username: 'Delete guest' }))
      .data as GuestSession;
    const socket = await connect(guest);
    await emit(socket, 'room:join');
    await emit(socket, 'canvas:update', [element('delete-this-shape')]);
    await emit(socket, 'chat:send', { text: 'Delete this message too' });
    let database: import('@prisma/client').PrismaClient | undefined;
    let sessionId = '';
    if (globalThis.process.env.TEST_DATABASE_URL) {
      const { PrismaClient } = await import('@prisma/client');
      database = new PrismaClient({
        datasources: { db: { url: globalThis.process.env.TEST_DATABASE_URL } },
      });
      sessionId = (await database.session.findUniqueOrThrow({ where: { roomCode: code } })).id;
    }
    try {
      assert.equal(
        (await request(`/sessions/${code}`, undefined, undefined, undefined, 'DELETE')).status,
        401,
      );
      const other = await register();
      assert.equal(
        (await request(`/sessions/${code}`, undefined, undefined, other.cookie, 'DELETE')).status,
        404,
      );
      const before = (await request('/auth/me', undefined, undefined, cookie)).data.account
        .createdRoomsCount;
      const deleted = new Promise<void>((resolve) => socket.once('room:deleted', () => resolve()));
      assert.equal(
        (await request(`/sessions/${code}`, undefined, undefined, cookie, 'DELETE')).status,
        200,
      );
      await deleted;
      await new Promise((resolve) => setTimeout(resolve, 1700));
      assert.equal(socket.connected, false);
      assert.equal((await request(`/sessions/${code}`)).status, 404);
      assert.equal(
        (await request(`/sessions/${code}/whiteboard`, undefined, guest.token)).status,
        404,
      );
      assert.equal(
        (await request('/auth/me', undefined, undefined, cookie)).data.account.createdRoomsCount,
        before,
      );
      assert.ok(
        !(await request('/sessions/owned', undefined, undefined, cookie)).data.some(
          (room: any) => room.roomCode === code,
        ),
      );
      if (database) {
        assert.equal(await database.session.count({ where: { id: sessionId } }), 0);
        assert.equal(await database.participant.count({ where: { sessionId } }), 0);
        assert.equal(await database.chatMessage.count({ where: { sessionId } }), 0);
        assert.equal(await database.whiteboardSnapshot.count({ where: { sessionId } }), 0);
      }
    } finally {
      await database?.$disconnect();
    }
  });
  test('reauthenticates account deletion and removes all sessions, owned rooms, and visits/messages in other spaces', async () => {
    const existing = await create();
    const account = await register('Account to delete');
    const owned = (await request('/sessions', { username: 'Owner' }, undefined, account.cookie))
      .data as GuestSession;
    const visitor = (
      await request(
        `/sessions/${existing.room.roomCode}/join`,
        { username: 'Visitor' },
        undefined,
        account.cookie,
      )
    ).data as GuestSession;
    const visitSocket = await connect(visitor),
      ownerSocket = await connect(owned);
    await emit(visitSocket, 'room:join');
    await emit(ownerSocket, 'room:join');
    const message = await emit<{ id: string }>(visitSocket, 'chat:send', {
      text: 'My personal message',
    });
    assert.equal(
      (await request('/account', { password: 'wrong' }, undefined, account.cookie, 'DELETE'))
        .status,
      401,
    );
    assert.equal((await request(`/sessions/${owned.room.roomCode}`)).status, 200);
    const result = await request(
      '/account',
      { password: 'a-long-testing-password' },
      undefined,
      account.cookie,
      'DELETE',
    );
    assert.equal(result.status, 200);
    assert.match(result.setCookie!, /Expires=Thu, 01 Jan 1970/);
    assert.equal(
      (await request('/auth/me', undefined, undefined, account.cookie)).data.account,
      null,
    );
    assert.equal((await request(`/sessions/${owned.room.roomCode}`)).status, 404);
    assert.equal((await request(`/sessions/${existing.room.roomCode}`)).status, 200);
    assert.equal(
      (await request(`/sessions/${existing.room.roomCode}/whiteboard`, undefined, visitor.token))
        .status,
      401,
    );
    const remaining = await connect(existing);
    const state = await emit<SyncState>(remaining, 'room:join');
    assert.ok(!state.messages.some((item) => item.id === message.id));
    if (globalThis.process.env.TEST_DATABASE_URL) {
      const { PrismaClient } = await import('@prisma/client');
      const database = new PrismaClient({
        datasources: { db: { url: globalThis.process.env.TEST_DATABASE_URL } },
      });
      try {
        assert.equal(await database.user.count({ where: { id: account.data.id } }), 0);
        assert.equal(await database.authSession.count({ where: { userId: account.data.id } }), 0);
        assert.equal(await database.session.count({ where: { ownerId: account.data.id } }), 0);
        assert.equal(await database.participant.count({ where: { userId: account.data.id } }), 0);
        assert.equal(await database.chatMessage.count({ where: { id: message.id } }), 0);
      } finally {
        await database.$disconnect();
      }
    }
    remaining.disconnect();
    visitSocket.disconnect();
    ownerSocket.disconnect();
  });
});
