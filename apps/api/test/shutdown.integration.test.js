import { after, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/infrastructure/prisma.js';
import { queues } from '../src/infrastructure/queue.js';
import { redis } from '../src/infrastructure/redis.js';
import { closeInfrastructure } from '../src/infrastructure/shutdown.js';
after(async () => {
  mock.restoreAll();
  await closeInfrastructure();
});
test('one queue cleanup failure still closes the remaining Redis connections', async () => {
  await prisma.$queryRaw`SELECT 1`;
  await redis.ping();
  mock.method(queues[0], 'close', async () => {
    throw new Error('Queue cleanup failure fixture');
  });
  await assert.rejects(() => closeInfrastructure(), AggregateError);
  assert.equal(redis.status, 'end');
  for (const queue of queues.slice(1)) assert.equal((await queue.client).status, 'end');
});
