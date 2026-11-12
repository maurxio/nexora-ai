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

test('agents: foreign CRUD and tool writes leave the agent unchanged', async () => {
  const row = await prisma.agent.create({
    data: { organizationId: orgB.id, name: 'Private agent', systemInstructions: 'Private' },
  });
  await api('post', orgB.id, 'agents', {
    name: 'Unauthorized agent',
    systemInstructions: 'Private',
  }).expect(403);
  await denied([
    ['get', `agents/${row.id}`],
    ['patch', `agents/${row.id}`, { name: 'Changed' }],
    ['delete', `agents/${row.id}`],
    ['put', `agents/${row.id}/tools`, { tools: [] }],
  ]);
  await api('post', orgB.id, `agents/${row.id}/run`, {}).expect(403);
  await hidden('agents', [row.id]);
  assert.deepEqual(await prisma.agent.findUnique({ where: { id: row.id } }), row);
  assert.equal(await prisma.agent.count({ where: { organizationId: orgB.id } }), 1);
});

test('integrations: connectors, endpoints, subscriptions and logs remain tenant scoped', async () => {
  const connector = await prisma.connector.create({
    data: { companyId: orgB.id, createdById: user.id, name: 'Private connector', type: 'HTTP' },
  });
  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      companyId: orgB.id,
      name: 'Private endpoint',
      slug: crypto.randomUUID(),
      secretHash: 'unused',
    },
  });
  const subscription = await prisma.webhookSubscription.create({
    data: {
      companyId: orgB.id,
      url: 'https://example.com/hook',
      eventTypes: ['test'],
      encryptedSecret: 'unused',
    },
  });
  await prisma.webhookEvent.create({
    data: {
      companyId: orgB.id,
      endpointId: endpoint.id,
      headers: {},
      body: { private: true },
      signatureValid: true,
    },
  });
  const log = await prisma.integrationLog.create({
    data: {
      companyId: orgB.id,
      connectorId: connector.id,
      direction: 'OUTBOUND',
      method: 'GET',
      url: 'https://example.com',
      requestHeaders: {},
      durationMs: 1,
      success: true,
      attempt: 1,
    },
  });
  for (const [path, row, model, body] of [
    ['connectors', connector, prisma.connector, { name: 'Unauthorized', type: 'HTTP' }],
    ['webhook-endpoints', endpoint, prisma.webhookEndpoint, { name: 'Unauthorized' }],
    [
      'webhook-subscriptions',
      subscription,
      prisma.webhookSubscription,
      { url: 'https://example.com', eventTypes: ['test'], secret: 'unused' },
    ],
  ]) {
    await api('post', orgB.id, `integrations/${path}`, body).expect(403);
    await denied([
      ['patch', `integrations/${path}/${row.id}`, { isActive: false }],
      ['delete', `integrations/${path}/${row.id}`],
    ]);
    await hidden(`integrations/${path}`, [row.id]);
    assert.deepEqual(await model.findUnique({ where: { id: row.id } }), row);
    assert.equal(await model.count({ where: { companyId: orgB.id } }), 1);
  }
  await denied([
    ['get', `integrations/connectors/${connector.id}`],
    ['post', `integrations/connectors/${connector.id}/test`, {}],
    ['post', `integrations/webhook-endpoints/${endpoint.id}/rotate-secret`, {}],
  ]);
  await api('get', orgB.id, `integrations/webhook-endpoints/${endpoint.id}/events`).expect(403);
  const events = await api(
    'get',
    orgA.id,
    `integrations/webhook-endpoints/${endpoint.id}/events`,
  ).expect(200);
  assert.deepEqual(events.body.items, []);
  assert.equal(events.body.total, 0);
  await hidden('integrations/integration-logs', [log.id]);
});

test('documents: foreign uploads, files, corrections, reprocessing and deletion are denied', async () => {
  const row = await prisma.document.create({
    data: {
      empresaId: orgB.id,
      uploadedById: user.id,
      originalName: 'private.png',
      mimeType: 'image/png',
      sizeBytes: 1,
      sha256: crypto.randomUUID(),
      storageKey: 'not-read-by-denied-requests',
    },
  });
  await request(app)
    .post(`/api/v1/orgs/${orgB.id}/documents`)
    .set('Authorization', `Bearer ${accessToken(user.id)}`)
    .attach('file', Buffer.from('fixture'), 'private.png')
    .expect(403);
  await denied([
    ['get', `documents/${row.id}`],
    ['get', `documents/${row.id}/file`],
    ['patch', `documents/${row.id}/extracted-data`, { extractedData: { private: 'changed' } }],
    ['post', `documents/${row.id}/reprocess`, {}],
    ['delete', `documents/${row.id}`],
  ]);
  await hidden('documents', [row.id]);
  assert.deepEqual(await prisma.document.findUnique({ where: { id: row.id } }), row);
  assert.equal(await prisma.document.count({ where: { empresaId: orgB.id } }), 1);
  assert.equal(await prisma.documentCorrection.count({ where: { documentId: row.id } }), 0);
});

test('approvals and notifications: foreign decisions and read markers cannot change rows', async () => {
  const approval = await prisma.approval.create({
    data: { companyId: orgB.id, requestedById: user.id, title: 'Private approval', payload: {} },
  });
  const notification = await prisma.notification.create({
    data: {
      companyId: orgB.id,
      userId: user.id,
      type: 'GENERIC',
      title: 'Private notification',
      body: 'Private',
      data: {},
    },
  });
  await api('post', orgB.id, 'approvals', {
    title: 'Unauthorized approval',
    payload: {},
    assigneeIds: [user.id],
  }).expect(403);
  await denied([
    ['get', `approvals/${approval.id}`],
    ...['approve', 'reject', 'cancel'].map((action) => [
      'post',
      `approvals/${approval.id}/${action}`,
      { comment: 'Unauthorized' },
    ]),
  ]);
  for (const orgId of [orgA.id, orgB.id]) {
    await api('patch', orgId, `notifications/${notification.id}/read`).expect(
      orgId === orgA.id ? 404 : 403,
    );
    await api('post', orgId, 'notifications/read-all', {}).expect(orgId === orgA.id ? 204 : 403);
  }
  for (const path of ['approvals', 'notifications'])
    await hidden(path, [approval.id, notification.id]);
  await api('get', orgB.id, 'notifications/unread-count').expect(403);
  const count = await api('get', orgA.id, 'notifications/unread-count').expect(200);
  assert.equal(count.body.count, 0);
  assert.deepEqual(await prisma.approval.findUnique({ where: { id: approval.id } }), approval);
  assert.deepEqual(
    await prisma.notification.findUnique({ where: { id: notification.id } }),
    notification,
  );
  assert.equal(await prisma.approval.count({ where: { companyId: orgB.id } }), 1);
});
