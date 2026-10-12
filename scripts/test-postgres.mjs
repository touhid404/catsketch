import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { migrationDatabaseUrl } from './database-url.mjs';
dotenv.config({ quiet: true });
if (!process.env.DATABASE_URL)
  throw new Error('DATABASE_URL is required for PostgreSQL integration tests.');
const schema = `catsketch_test_${randomBytes(6).toString('hex')}`;
const connection = new URL(migrationDatabaseUrl(process.env.DATABASE_URL));
connection.searchParams.set('schema', schema);
const database = new PrismaClient({ datasources: { db: { url: connection.toString() } } });
function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', env: { ...process.env, ...env } });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`Test command failed with exit code ${code}`)),
    );
  });
}
try {
  await database.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  await run(process.execPath, ['scripts/prisma.mjs', 'migrate', 'deploy'], {
    DATABASE_URL: connection.toString(),
    // This run owns a unique schema and cannot race another migration history.
    PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK: 'true',
  });
  await run(
    process.execPath,
    ['node_modules/tsx/dist/cli.mjs', '--test', 'tests/api.test.ts', 'tests/scene.test.ts'],
    { TEST_DATABASE_URL: connection.toString() },
  );
} finally {
  // The generated schema contains only this run's test fixtures.
  await database.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await database.$disconnect();
}
