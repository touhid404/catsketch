import { afterEach, beforeEach, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Logger } from '@nestjs/common';
import cron from 'node-cron';
import { KeepAliveService } from '../apps/server/src/modules/keep-alive/keep-alive.service';

describe('production keep-alive cron', () => {
  const originalMode = process.env.NODE_ENV;
  const originalUrl = process.env.PING_URL;
  let messages: string[];
  let errors: string[];
  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    delete process.env.PING_URL;
    messages = [];
    errors = [];
    mock.method(Logger.prototype, 'log', (message: string) => messages.push(message));
    mock.method(Logger.prototype, 'warn', () => {});
    mock.method(Logger.prototype, 'error', (message: string) => errors.push(message));
  });
  afterEach(async () => {
    for (const task of cron.getTasks().values()) {
      if (task.name === 'catsketch-keep-alive') await task.destroy();
    }
    mock.restoreAll();
    if (originalMode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalMode;
    if (originalUrl === undefined) delete process.env.PING_URL;
    else process.env.PING_URL = originalUrl;
  });
  const scheduled = () =>
    [...cron.getTasks().values()].find((task) => task.name === 'catsketch-keep-alive');

  test('does not schedule in development or without a configured production URL', () => {
    process.env.NODE_ENV = 'development';
    process.env.PING_URL = 'https://example.test/api/keep-alive';
    new KeepAliveService().onApplicationBootstrap();
    assert.equal(scheduled(), undefined);
    process.env.NODE_ENV = 'production';
    delete process.env.PING_URL;
    new KeepAliveService().onApplicationBootstrap();
    assert.equal(scheduled(), undefined);
  });

  test('sends GETs, reports HTTP failures, and removes the task on shutdown', async () => {
    let status = 200;
    const requests: { method?: string; url?: string }[] = [];
    const server = createServer((request, response) => {
      requests.push({ method: request.method, url: request.url });
      response.writeHead(status);
      response.end('I am alive');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    process.env.PING_URL = `http://127.0.0.1:${address.port}/api/keep-alive`;
    const service = new KeepAliveService();
    try {
      service.onApplicationBootstrap();
      const task = scheduled();
      assert.ok(task);
      const nextRuns = task.getNextRuns(6);
      assert.equal(nextRuns.length, 6);
      assert.ok(nextRuns.every((date) => [0, 14, 28, 42, 56].includes(date.getUTCMinutes())));
      await task.execute();
      assert.deepEqual(requests, [{ method: 'GET', url: '/api/keep-alive' }]);
      assert.ok(messages.some((message) => message.includes("Don't Sleep ........... I am alive")));
      status = 503;
      await task.execute();
      assert.ok(errors.some((message) => message.includes('HTTP 503')));
      await service.onApplicationShutdown();
      assert.equal(scheduled(), undefined);
      assert.equal(task.getStatus(), 'destroyed');
    } finally {
      await service.onApplicationShutdown();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  test('rejects invalid targets without leaking embedded credentials', () => {
    for (const url of [
      'not-a-url',
      'file:///tmp/example',
      'https://user:private-password@example.test/api/keep-alive',
    ]) {
      process.env.PING_URL = url;
      assert.throws(() => new KeepAliveService().onApplicationBootstrap(), {
        message: 'PING_URL must be an HTTP or HTTPS URL without embedded credentials.',
      });
    }
    assert.equal(scheduled(), undefined);
  });
});
