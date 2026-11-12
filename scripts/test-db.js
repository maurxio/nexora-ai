import '../test/env.js';
import { spawnSync } from 'node:child_process';
const result = spawnSync(
  'npm',
  ['exec', 'prisma', 'migrate', 'deploy', '--', '--schema', 'apps/api/prisma/schema.prisma'],
  { stdio: 'inherit', env: process.env },
);
process.exitCode = result.status ?? 1;
