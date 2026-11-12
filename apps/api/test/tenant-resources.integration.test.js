import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { after, before, test } from 'node:test';
import request from 'supertest';
import app, { metricsTimer } from '../src/app.js';
import prisma from '../src/infrastructure/prisma.js';
import { closeInfrastructure } from '../src/infrastructure/shutdown.js';
import { accessToken } from '../src/modules/auth/service.js';

let user, auditor, orgA, orgB;
before(async () => {
  const suffix = crypto.randomUUID();
  user = await prisma.user.create({
    data: { email: `tenant-${suffix}@test.local`, name: 'Tenant QA', passwordHash: 'unused' },
  });
  auditor = await prisma.user.create({
    data: { email: `role-${suffix}@test.local`, name: 'Auditor QA', passwordHash: 'unused' },
  });
  orgA = await prisma.organization.create({
    data: {
      name: 'Tenant A',
      slug: `tenant-a-${suffix}`,
      memberships: {
        create: [
          { userId: user.id, role: 'ADMIN' },
          { userId: auditor.id, role: 'AUDITOR' },
        ],
      },
    },
  });
  orgB = await prisma.organization.create({
    data: { name: 'Tenant B', slug: `tenant-b-${suffix}` },
  });
});
after(async () => {
  clearInterval(metricsTimer);
  try {
    await prisma.organization.deleteMany({
      where: { id: { in: [orgA?.id, orgB?.id].filter(Boolean) } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [user?.id, auditor?.id].filter(Boolean) } },
    });
  } finally {
    await closeInfrastructure();
  }
});
function api(method, orgId, path, body, actor = user) {
  return request(app)
    [method](`/api/v1/orgs/${orgId}/${path}`)
    .set('Authorization', `Bearer ${accessToken(actor.id)}`)
    .send(body);
}
async function denied(operations) {
  for (const [method, path, body] of operations) {
    await api(method, orgB.id, path, body).expect(403);
    await api(method, orgA.id, path, body).expect(404);
    if (method !== 'get') await api(method, orgA.id, path, body, auditor).expect(403);
  }
}
async function hidden(path, ids) {
  const response = await api('get', orgA.id, path).expect(200);
  for (const id of ids)
    assert.ok(!JSON.stringify(response.body).includes(id), `${path} leaked ${id}`);
}

test('workflows: foreign rows cannot be read, changed, deleted, published or executed', async () => {
  const row = await prisma.workflow.create({
    data: { organizationId: orgB.id, name: 'Private workflow' },
  });
  const version = await prisma.workflowVersion.create({
    data: { workflowId: row.id, version: 1, definition: { nodes: [], edges: [] } },
  });
  await api('post', orgB.id, 'workflows', { name: 'Unauthorized workflow' }).expect(403);
  await denied([
    ['get', `workflows/${row.id}`],
    ['patch', `workflows/${row.id}`, { name: 'Changed' }],
    ['delete', `workflows/${row.id}`],
    ['post', `workflows/${row.id}/publish`, {}],
    ['post', `workflows/${row.id}/execute`, { input: {} }],
    ['get', `workflows/${row.id}/versions`],
    ['get', `workflows/${row.id}/versions/1`],
  ]);
  await hidden('workflows', [row.id]);
  assert.deepEqual(await prisma.workflow.findUnique({ where: { id: row.id } }), row);
  assert.equal(await prisma.workflow.count({ where: { organizationId: orgB.id } }), 1);
  assert.equal(await prisma.workflowVersion.count({ where: { workflowId: row.id } }), 1);
  const execution = await prisma.workflowExecution.create({
    data: { organizationId: orgB.id, workflowId: row.id, workflowVersionId: version.id, input: {} },
  });
  await denied([
    ['get', `executions/${execution.id}`],
    ['get', `executions/${execution.id}/steps`],
    ['post', `executions/${execution.id}/cancel`, {}],
    ['post', `executions/${execution.id}/retry`, {}],
  ]);
  await hidden('executions', [execution.id]);
  assert.deepEqual(
    await prisma.workflowExecution.findUnique({ where: { id: execution.id } }),
    execution,
  );
  assert.equal(await prisma.workflowExecution.count({ where: { organizationId: orgB.id } }), 1);
});
