import { documentProcessingQueue } from '../src/infrastructure/queue.js';
import { storage } from '../src/modules/documents/storage.js';
import dns from 'node:dns/promises';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';
import { OcrEngine, processDocument } from '../src/modules/documents/pipeline.js';
import { executeAgent } from '../src/modules/ai/runner.js';
import { executeHttpRequest } from '../src/modules/integrations/service.js';
import { hmac } from '../src/modules/integrations/crypto.js';
import { mock } from 'node:test';
import crypto from 'node:crypto';
import app, { metricsTimer } from '../src/app.js';
import prisma from '../src/infrastructure/prisma.js';
import { closeInfrastructure } from '../src/infrastructure/shutdown.js';
import { hashPassword, accessToken } from '../src/modules/auth/service.js';

let user, orgA, orgB, token, auditor;
const id = crypto.randomUUID();
const resourceId = crypto.randomUUID();
before(async () => {
  user = await prisma.user.create({
    data: {
      email: `${id}@test.local`,
      name: 'QA',
      passwordHash: await hashPassword('Test-password-123'),
    },
  });
  orgA = await prisma.organization.create({
    data: {
      name: 'A',
      slug: `a-${id}`,
      memberships: { create: { userId: user.id, role: 'ADMIN' } },
    },
  });
  orgB = await prisma.organization.create({ data: { name: 'B', slug: `b-${id}` } });
  auditor = await prisma.user.create({
    data: {
      email: `auditor-${id}@test.local`,
      name: 'Auditor',
      passwordHash: 'unused',
      memberships: { create: { organizationId: orgA.id, role: 'AUDITOR' } },
    },
  });
  token = accessToken(user.id);
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
const endpoints = [
  ['get', 'approvals'],
  ['post', 'approvals'],
  ['get', `approvals/${resourceId}`],
  ['post', `approvals/${resourceId}/approve`],
  ['post', `approvals/${resourceId}/reject`],
  ['post', `approvals/${resourceId}/cancel`],
  ['get', 'notifications'],
  ['patch', `notifications/${resourceId}/read`],
  ['post', 'notifications/read-all'],
  ['get', 'integrations/connectors'],
  ['post', 'integrations/connectors'],
  ['get', `integrations/connectors/${resourceId}`],
  ['patch', `integrations/connectors/${resourceId}`],
  ['delete', `integrations/connectors/${resourceId}`],
  ['post', `integrations/connectors/${resourceId}/test`],
  ['get', 'integrations/webhook-endpoints'],
  ['post', 'integrations/webhook-endpoints'],
  ['patch', `integrations/webhook-endpoints/${resourceId}`],
  ['delete', `integrations/webhook-endpoints/${resourceId}`],
  ['post', `integrations/webhook-endpoints/${resourceId}/rotate-secret`],
  ['get', `integrations/webhook-endpoints/${resourceId}/events`],
  ['get', 'integrations/webhook-subscriptions'],
  ['post', 'integrations/webhook-subscriptions'],
  ['patch', `integrations/webhook-subscriptions/${resourceId}`],
  ['delete', `integrations/webhook-subscriptions/${resourceId}`],
  ['get', 'integrations/integration-logs'],
  ['get', 'documents'],
  ['post', 'documents'],
  ['get', `documents/${resourceId}`],
  ['get', `documents/${resourceId}/file`],
  ['patch', `documents/${resourceId}/extracted-data`],
  ['post', `documents/${resourceId}/reprocess`],
  ['delete', `documents/${resourceId}`],
  ['get', 'workflows'],
  ['post', 'workflows'],
  ['get', `workflows/${resourceId}`],
  ['patch', `workflows/${resourceId}`],
  ['delete', `workflows/${resourceId}`],
  ['post', `workflows/${resourceId}/publish`],
  ['post', `workflows/${resourceId}/execute`],
  ['get', `workflows/${resourceId}/versions`],
  ['get', 'agents'],
  ['post', 'agents'],
  ['get', `agents/${resourceId}`],
  ['patch', `agents/${resourceId}`],
  ['delete', `agents/${resourceId}`],
  ['put', `agents/${resourceId}/tools`],
  ['get', 'analytics/overview'],
  ['get', 'analytics/timeseries'],
  ['get', 'analytics/top-errors'],
  ['get', 'audit-logs'],
  ['get', 'executions'],
  ['get', 'ai/providers'],
];
for (const [method, path] of endpoints) {
  test(`tenant URL manipulation denied: ${method.toUpperCase()} ${path}`, async () => {
    await request(app)
      [method](`/api/v1/orgs/${orgB.id}/${path}`)
      .set('Authorization', `Bearer ${token}`)
      .send({})
      .expect(403);
  });
  if (!['get'].includes(method) && !path.startsWith('notifications'))
    test(`auditor cannot write: ${method.toUpperCase()} ${path}`, async () => {
      await request(app)
        [method](`/api/v1/orgs/${orgA.id}/${path}`)
        .set('Authorization', `Bearer ${accessToken(auditor.id)}`)
        .send({})
        .expect(403);
    });
}
test('login, invalid password, refresh rotation, replay and logout', async () => {
  await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'wrong-password' })
    .expect(401);
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'Test-password-123' })
    .expect(200);
  assert.equal(login.body.user.id, user.id);
  const organizations = await request(app)
    .get('/api/v1/organizations')
    .set('Authorization', `Bearer ${login.body.accessToken}`)
    .expect(200);
  assert.deepEqual(
    organizations.body.map((organization) => organization.id),
    [orgA.id],
  );
  await request(app)
    .get(`/api/v1/orgs/${orgB.id}/workflows`)
    .set('Authorization', `Bearer ${login.body.accessToken}`)
    .expect(403);
  const refreshed = await request(app)
    .post('/api/v1/auth/refresh')
    .send({ refreshToken: login.body.refreshToken })
    .expect(200);
  assert.notEqual(refreshed.body.refreshToken, login.body.refreshToken);
  await request(app)
    .post('/api/v1/auth/refresh')
    .send({ refreshToken: login.body.refreshToken })
    .expect(401);
  await request(app)
    .post('/api/v1/auth/logout')
    .send({ refreshToken: refreshed.body.refreshToken })
    .expect(204);
  await request(app)
    .post('/api/v1/auth/refresh')
    .send({ refreshToken: refreshed.body.refreshToken })
    .expect(401);
});
test('missing, invalid, expired JWT and malformed org ID are rejected', async () => {
  for (const value of [
    '',
    'invalid',
    jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: -1 }),
  ]) {
    await request(app)
      .get('/api/v1/organizations')
      .set('Authorization', `Bearer ${value}`)
      .expect(401);
  }
  await request(app)
    .get('/api/v1/orgs/not-an-id/documents')
    .set('Authorization', `Bearer ${token}`)
    .expect(403);
});
for (const kind of ['invalid signature', 'expired']) {
  test(`auth rejects ${kind} token on tenant resources`, async () => {
    const jwtToken =
      kind === 'expired'
        ? jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: -1 })
        : jwt.sign({ sub: user.id }, 'different-test-secret', { expiresIn: '15m' });
    await request(app)
      .get(`/api/v1/orgs/${orgA.id}/workflows`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .expect(401);
  });
}
test('resource IDs cannot cross tenant scope, even with membership in both organizations', async () => {
  await prisma.membership.create({
    data: { userId: user.id, organizationId: orgB.id, role: 'ADMIN' },
  });
  const workflow = await prisma.workflow.create({
    data: { organizationId: orgB.id, name: 'Foreign workflow' },
  });
  for (const method of ['get', 'patch', 'delete'])
    await request(app)
      [method](`/api/v1/orgs/${orgA.id}/workflows/${workflow.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Modified' })
      .expect(404);
  assert.equal(
    (await prisma.workflow.findUnique({ where: { id: workflow.id } })).name,
    'Foreign workflow',
  );
  await prisma.membership.delete({
    where: { userId_organizationId: { userId: user.id, organizationId: orgB.id } },
  });
});
test('health, readiness, metrics authorization and validation', async () => {
  await request(app).get('/health').expect(200);
  await request(app).get('/ready').expect(200);
  await request(app).get('/metrics').expect(401);
  await request(app)
    .post(`/api/v1/orgs/${orgA.id}/workflows`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name: '' })
    .expect(422);
});

const api = (method, path, body) =>
  request(app)
    [method](`/api/v1/orgs/${orgA.id}/${path}`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
test('workflow lifecycle: create, validate, publish, execute idempotently, cancel, retry and delete', async () => {
  const draft = {
    nodes: [
      { id: 'start', type: 'trigger', config: {} },
      { id: 'end', type: 'transform', config: { set: { ok: true } } },
    ],
    edges: [{ from: 'start', to: 'end' }],
  };
  const created = await api('post', 'workflows', { name: 'Lifecycle', draft }).expect(201);
  const wid = created.body.id;
  const listing = await api('get', 'workflows').expect(200);
  assert.ok(listing.body.some((item) => item.id === wid));
  await api('get', `workflows/${wid}`).expect(200);
  await api('patch', `workflows/${wid}`, { description: 'updated' }).expect(200);
  const published = await api('post', `workflows/${wid}/publish`, {}).expect(201);
  assert.equal(published.body.version, 1);
  await api('get', `workflows/${wid}/versions`).expect(200);
  await api('get', `workflows/${wid}/versions/1`).expect(200);
  const execution = await api('post', `workflows/${wid}/execute`, {})
    .set('Idempotency-Key', 'test-lifecycle')
    .expect(202);
  const duplicate = await api('post', `workflows/${wid}/execute`, {})
    .set('Idempotency-Key', 'test-lifecycle')
    .expect(200);
  assert.equal(execution.body.executionId, duplicate.body.executionId);
  const eid = execution.body.executionId;
  await api('get', `executions/${eid}`).expect(200);
  await api('get', `executions/${eid}/steps`).expect(200);
  await api('post', `executions/${eid}/cancel`, {}).expect(200);
  await api('post', `executions/${eid}/retry`, {}).expect(202);
  await api('get', 'executions').expect(200);
  await api('delete', `workflows/${wid}`).expect(204);
});
test('agent CRUD and catalog reject unknown tools', async () => {
  const created = await api('post', 'agents', {
    name: 'QA agent',
    systemInstructions: 'Return deterministic output',
  }).expect(201);
  const aid = created.body.id;
  await api('get', 'agents').expect(200);
  await api('get', 'agents/tools/catalog').expect(200);
  await api('get', `agents/${aid}`).expect(200);
  await api('patch', `agents/${aid}`, { description: 'updated' }).expect(200);
  await api('put', `agents/${aid}/tools`, { tools: ['nonexistent'] }).expect(400);
  await api('put', `agents/${aid}/tools`, { tools: [] }).expect(200);
  await api('delete', `agents/${aid}`).expect(204);
});
test('connector CRUD, HTTP retries, signed webhooks and subscription lifecycle', async () => {
  const created = await api('post', 'integrations/connectors', {
    name: 'QA connector',
    type: 'HTTP',
    baseUrl: 'https://example.com',
    authType: 'BEARER',
    credentials: { token: 'not-a-real-secret' },
  }).expect(201);
  const cid = created.body.id;
  assert.equal(created.body.encryptedCredentials, undefined);
  await api('get', 'integrations/connectors').expect(200);
  await api('get', `integrations/connectors/${cid}`).expect(200);
  await api('patch', `integrations/connectors/${cid}`, { name: 'QA updated' }).expect(200);
  let calls = 0;
  const lookupMock = mock.method(dns, 'lookup', async () => [
    { address: '93.184.216.34', family: 4 },
  ]);
  const fetchMock = mock.method(globalThis, 'fetch', async () => {
    calls++;
    if (calls === 1) throw new Error('temporary network error');
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  try {
    const result = await executeHttpRequest({ companyId: orgA.id, connectorId: cid, url: '/' });
    assert.equal(result.statusCode, 200);
    assert.equal(calls, 2);
    await api('post', `integrations/connectors/${cid}/test`, {}).expect(200);
  } finally {
    fetchMock.mock.restore();
    lookupMock.mock.restore();
  }
  const endpoint = await api('post', 'integrations/webhook-endpoints', {
    name: 'QA endpoint',
  }).expect(201);
  const { slug, secret, id: endpointId } = endpoint.body;
  await api('get', 'integrations/webhook-endpoints').expect(200);
  const raw = JSON.stringify({ event: 'test' });
  await request(app)
    .post(`/api/v1/hooks/${slug}`)
    .set('Content-Type', 'application/json')
    .set('x-nexora-signature', 'bad')
    .send(raw)
    .expect(401);
  await request(app)
    .post(`/api/v1/hooks/${slug}`)
    .set('Content-Type', 'application/json')
    .set('x-nexora-signature', hmac(raw, secret))
    .send(raw)
    .expect(202);
  await api('get', `integrations/webhook-endpoints/${endpointId}/events`).expect(200);
  await api('post', `integrations/webhook-endpoints/${endpointId}/rotate-secret`, {}).expect(200);
  await request(app)
    .post(`/api/v1/hooks/${slug}`)
    .set('Content-Type', 'application/json')
    .set('x-nexora-signature', hmac(raw, secret))
    .send(raw)
    .expect(401);
  await api('patch', `integrations/webhook-endpoints/${endpointId}`, { isActive: false }).expect(
    200,
  );
  const subscription = await api('post', 'integrations/webhook-subscriptions', {
    url: 'https://example.com/webhook',
    eventTypes: ['test'],
    secret: 'test-secret',
  }).expect(201);
  await api('get', 'integrations/webhook-subscriptions').expect(200);
  await api('patch', `integrations/webhook-subscriptions/${subscription.body.id}`, {
    isActive: false,
  }).expect(200);
  await api('delete', `integrations/webhook-subscriptions/${subscription.body.id}`).expect(204);
  const logs = await api('get', 'integrations/integration-logs').expect(200);
  assert.ok(
    logs.body.items.some((item) => item.requestHeaders.authorization === '[REDACTED]'),
    'Authorization must be redacted in persisted logs',
  );
  assert.ok(!JSON.stringify(logs.body).includes('not-a-real-secret'));
  await api('delete', `integrations/webhook-endpoints/${endpointId}`).expect(204);
  await api('delete', `integrations/connectors/${cid}`).expect(204);
});
test('document upload, OCR mock, correction, tenant resource IDs and delete', async () => {
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#ffffff' } })
    .png()
    .toBuffer();
  const response = await request(app)
    .post(`/api/v1/orgs/${orgA.id}/documents`)
    .set('Authorization', `Bearer ${token}`)
    .attach('file', png, 'sample.png')
    .expect(202);
  const did = response.body.document.id;
  const ocr = mock.method(OcrEngine.prototype, 'recognize', async () => ({
    text: 'generic document',
    confidence: 99,
  }));
  try {
    await processDocument(did);
  } finally {
    ocr.mock.restore();
  }
  assert.equal((await prisma.document.findUnique({ where: { id: did } })).status, 'VALIDATED');
  await api('get', 'documents').expect(200);
  await api('get', `documents/${did}`).expect(200);
  await api('get', `documents/${did}/file`).expect(200);
  await api('patch', `documents/${did}/extracted-data`, {
    extractedData: { textLength: 16 },
  }).expect(200);
  await api('post', `documents/${did}/reprocess`, {}).expect(202);
  await api('delete', `documents/${did}`).expect(204);
});
test('mock AI provider config lifecycle and runner records usage without network', async () => {
  const created = await api('post', 'ai/providers', {
    name: 'QA mock',
    provider: 'mock',
    model: 'mock',
    monthlyTokenLimit: 100,
  }).expect(201);
  const pid = created.body.id;
  await api('get', 'ai/providers').expect(200);
  await api('get', `ai/providers/${pid}`).expect(200);
  await api('patch', `ai/providers/${pid}`, { name: 'QA updated' }).expect(200);
  await api('post', `ai/providers/${pid}/test`, {}).expect(200);
  await api('post', `ai/providers/${pid}/set-default`, {}).expect(200);
  const output = await executeAgent({
    orgId: orgA.id,
    config: { providerConfigId: pid },
    context: { input: {} },
    signal: AbortSignal.timeout(1000),
  });
  assert.equal(output, 'mock-response');
  await api('delete', `ai/providers/${pid}`).expect(204);
});
test('organization membership, analytics and notification routes return scoped results', async () => {
  await request(app)
    .get('/api/v1/organizations')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  await request(app)
    .get(`/api/v1/organizations/${orgA.id}`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  await request(app)
    .get(`/api/v1/organizations/${orgA.id}/members`)
    .set('Authorization', `Bearer ${token}`)
    .expect(200);
  for (const path of [
    'analytics/overview',
    'analytics/timeseries',
    'analytics/top-errors',
    'audit-logs',
    'notifications',
    'notifications/unread-count',
  ])
    await api('get', path).expect(200);
  await api('post', 'notifications/read-all', {}).expect(204);
});

test('foreign resource IDs stay inaccessible with memberships in both tenants across modules', async () => {
  await prisma.membership.create({
    data: { userId: user.id, organizationId: orgB.id, role: 'ADMIN' },
  });
  try {
    const agent = await prisma.agent.create({
      data: { organizationId: orgB.id, name: 'Foreign', systemInstructions: 'private' },
    });
    const connector = await prisma.connector.create({
      data: { companyId: orgB.id, createdById: user.id, name: 'Foreign', type: 'HTTP' },
    });
    const document = await prisma.document.create({
      data: {
        empresaId: orgB.id,
        uploadedById: user.id,
        originalName: 'private.png',
        mimeType: 'image/png',
        sizeBytes: 1,
        sha256: 'foreign',
        storageKey: 'foreign',
      },
    });
    const approval = await prisma.approval.create({
      data: { companyId: orgB.id, requestedById: user.id, title: 'Private', payload: {} },
    });
    for (const path of [`agents/${agent.id}`, `integrations/connectors/${connector.id}`]) {
      for (const method of ['get', 'patch', 'delete'])
        await api(method, path, method === 'patch' ? { name: 'changed' } : undefined).expect(404);
    }
    await api('get', `documents/${document.id}`).expect(404);
    await api('get', `documents/${document.id}/file`).expect(404);
    await api('patch', `documents/${document.id}/extracted-data`, { extractedData: {} }).expect(
      404,
    );
    await api('post', `documents/${document.id}/reprocess`, {}).expect(404);
    await api('delete', `documents/${document.id}`).expect(404);
    await api('get', `approvals/${approval.id}`).expect(404);
    for (const action of ['approve', 'reject', 'cancel'])
      await api('post', `approvals/${approval.id}/${action}`, { comment: 'rejected' }).expect(404);
    assert.equal(
      (await prisma.document.findUnique({ where: { id: document.id } })).originalName,
      'private.png',
    );
    assert.equal(
      (await prisma.approval.findUnique({ where: { id: approval.id } })).status,
      'PENDING',
    );
  } finally {
    await prisma.membership.delete({
      where: { userId_organizationId: { userId: user.id, organizationId: orgB.id } },
    });
  }
});

test('auditor cannot access administrator observability or AI configuration', async () => {
  for (const path of ['audit-logs', 'ai/providers']) {
    await request(app)
      .get(`/api/v1/orgs/${orgA.id}/${path}`)
      .set('Authorization', `Bearer ${accessToken(auditor.id)}`)
      .expect(403);
  }
});

test('auditor can mark personal notifications but cannot mark another user notification', async () => {
  const own = await prisma.notification.create({
    data: {
      companyId: orgA.id,
      userId: auditor.id,
      type: 'GENERIC',
      title: 'Personal',
      body: 'Fixture',
      data: {},
    },
  });
  const other = await prisma.notification.create({
    data: {
      companyId: orgA.id,
      userId: user.id,
      type: 'GENERIC',
      title: 'Private',
      body: 'Fixture',
      data: {},
    },
  });
  const headers = { Authorization: `Bearer ${accessToken(auditor.id)}` };
  await request(app)
    .patch(`/api/v1/orgs/${orgA.id}/notifications/${own.id}/read`)
    .set(headers)
    .expect(204);
  await request(app)
    .patch(`/api/v1/orgs/${orgA.id}/notifications/${other.id}/read`)
    .set(headers)
    .expect(404);
  assert.ok((await prisma.notification.findUnique({ where: { id: own.id } })).readAt);
  assert.equal((await prisma.notification.findUnique({ where: { id: other.id } })).readAt, null);
});

test('document enqueue failure rolls back the row and file so upload can be retried', async () => {
  const png = await sharp({ create: { width: 9, height: 9, channels: 3, background: '#ffffff' } })
    .png()
    .toBuffer();
  const sha256 = crypto.createHash('sha256').update(png).digest('hex');
  const save = storage.save.bind(storage);
  let key;
  const saveMock = mock.method(storage, 'save', async (storageKey, buffer) => {
    key = storageKey;
    await save(storageKey, buffer);
  });
  const enqueueMock = mock.method(documentProcessingQueue, 'add', async () => {
    throw new Error('Queue unavailable fixture');
  });
  try {
    await request(app)
      .post(`/api/v1/orgs/${orgA.id}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', png, 'retry.png')
      .expect(503);
    assert.equal(await prisma.document.count({ where: { empresaId: orgA.id, sha256 } }), 0);
    await assert.rejects(
      () => storage.read(key),
      (error) => error.code === 'ENOENT',
    );
  } finally {
    saveMock.mock.restore();
    enqueueMock.mock.restore();
  }
  const retried = await request(app)
    .post(`/api/v1/orgs/${orgA.id}/documents`)
    .set('Authorization', `Bearer ${token}`)
    .attach('file', png, 'retry.png')
    .expect(202);
  assert.equal(retried.body.duplicate, false);
  await api('delete', `documents/${retried.body.document.id}`).expect(204);
});
