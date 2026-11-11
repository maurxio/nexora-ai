import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import prisma from '../src/infrastructure/prisma.js';
import { redis } from '../src/infrastructure/redis.js';
import { overview, topErrors } from '../src/modules/analytics/service.js';

const suffix = `obs-${Date.now()}`;
let first;
let second;

test('analytics never crosses tenant boundaries', async () => {
  first = await prisma.organization.create({ data: { name: `First ${suffix}`, slug: `first-${suffix}` } });
  second = await prisma.organization.create({ data: { name: `Second ${suffix}`, slug: `second-${suffix}` } });
  await prisma.executionMetric.createMany({
    data: [
      { tenantId: first.id, type: 'WORKFLOW', status: 'SUCCESS', durationMs: 20 },
      { tenantId: second.id, type: 'WORKFLOW', status: 'ERROR', durationMs: 900, errorCode: 'OTHER_TENANT' },
    ],
  });
  const firstOverview = await overview(first.id, {});
  const firstErrors = await topErrors(first.id, {});
  assert.equal(firstOverview.totalExecutions, 1);
  assert.equal(firstOverview.successRate, 1);
  assert.deepEqual(firstErrors, []);
});

after(async () => {
  if (first && second) {
    await prisma.executionMetric.deleteMany({ where: { tenantId: { in: [first.id, second.id] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [first.id, second.id] } } });
  }
  if (redis.status !== 'end') await redis.quit();
  await prisma.$disconnect();
});
