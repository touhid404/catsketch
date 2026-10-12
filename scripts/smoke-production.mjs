import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const data = await mkdtemp(path.join(tmpdir(), 'catsketch-web-smoke-'));
const base = 'http://localhost:3108';
const child = spawn(process.execPath, ['apps/server/dist/main.js'], {
  env: {
    ...process.env,
    PORT: '3108',
    NODE_ENV: 'development',
    SERVE_WEB: 'true',
    WEB_ORIGIN: base,
    DATABASE_URL: '',
    ALLOW_FILE_STORAGE: 'true',
    DATA_DIR: data,
    STREAM_API_KEY: '',
    STREAM_API_SECRET: '',
    GUEST_TOKEN_SECRET: 'production-smoke-test-only-secret-32-chars',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
child.stdout.on('data', (value) => {
  logs += value;
});
child.stderr.on('data', (value) => {
  logs += value;
});
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(`${base}/api/health`)).ok) {
        ready = true;
        break;
      }
    } catch {}
    if (child.exitCode !== null) throw new Error(logs);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'Compiled server starts');
  const heartbeat = await fetch(base + '/api/keep-alive');
  assert.equal(heartbeat.status, 200);
  assert.equal(heartbeat.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await heartbeat.json(), {
    status: 'ok',
    service: 'catsketch',
    message: 'I am alive',
  });
  assert.match(logs, /I am alive/);
  const root = await fetch(base);
  const html = await root.text();
  assert.match(root.headers.get('content-type'), /text\/html/);
  assert.match(root.headers.get('cache-control'), /no-cache/);
  assert.match(html, /CatSketch/);
  const asset = /src="(\/assets\/[^\"]+\.js)"/.exec(html)?.[1];
  assert.ok(asset);
  const script = await fetch(base + asset);
  assert.equal(script.status, 200);
  assert.match(script.headers.get('content-type'), /javascript/);
  assert.match(script.headers.get('cache-control'), /immutable/);
  for (const route of [
    '/dashboard/profile',
    '/login',
    '/signup',
    '/room/abcdefghijkl',
    '/draft/00000000-0000-0000-0000-000000000000',
  ]) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200);
    assert.equal(await response.text(), html);
  }
  const api404 = await fetch(base + '/api/not-found');
  assert.equal(api404.status, 404);
  assert.match(api404.headers.get('content-type'), /json/);
  const asset404 = await fetch(base + '/assets/not-found.js');
  assert.equal(asset404.status, 404);
  assert.ok(!(await asset404.text()).includes('<div id="root">'));
  console.log(
    'Production hosting smoke passed: frontend, assets, deep links, and API isolation use one address.',
  );
} finally {
  await new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', resolve);
    child.kill('SIGTERM');
  });
  await rm(data, { recursive: true, force: true });
}
