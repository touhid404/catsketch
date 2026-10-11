import dotenv from 'dotenv';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env'), quiet: true });
const child = spawn(
  process.execPath,
  [
    path.join(root, 'node_modules/prisma/build/index.js'),
    ...process.argv.slice(2),
    ...(process.argv[3] === 'diff'
      ? []
      : ['--schema', path.join(root, 'apps/server/prisma/schema.prisma')]),
  ],
  { cwd: root, env: process.env, stdio: 'inherit' },
);
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
