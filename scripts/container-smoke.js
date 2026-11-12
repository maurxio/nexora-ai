// Run through Compose stdin in the API image; all data belongs to the ephemeral DB.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
let token;
async function api(method, path, body) {
  const response = await fetch(`http://127.0.0.1:3000/api/v1${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert.ok(response.ok, `${method} ${path}: HTTP ${response.status}`);
  return response.json();
}
const registration = await api('POST', '/auth/register', {
  name: 'Container smoke',
  email: 'container-smoke@test.local',
  password: randomBytes(24).toString('hex'),
});
token = registration.accessToken;
const org = await api('POST', '/organizations', { name: 'Container smoke' });
const base = `/orgs/${org.id}`;
const provider = await api('POST', `${base}/ai/providers`, {
  name: 'Mock',
  provider: 'mock',
  model: 'mock',
});
const draft = {
  nodes: [
    { id: 'start', type: 'trigger', config: {} },
    {
      id: 'ai',
      type: 'agent',
      config: { providerConfigId: provider.id, prompt: 'Deterministic smoke' },
    },
    { id: 'result', type: 'transform', config: { set: { reply: '{{nodes.ai}}' } } },
  ],
  edges: [
    { from: 'start', to: 'ai' },
    { from: 'ai', to: 'result' },
  ],
};
const workflow = await api('POST', `${base}/workflows`, { name: 'Smoke workflow', draft });
assert.ok((await api('GET', `${base}/workflows`)).some((item) => item.id === workflow.id));
await api('POST', `${base}/workflows/${workflow.id}/publish`, {});
const execution = await api('POST', `${base}/workflows/${workflow.id}/execute`, {});
async function until(load, done) {
  for (let attempt = 0; attempt < 150; attempt++) {
    const value = await load();
    if (done(value)) return value;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Container smoke exceeded processing deadline');
}
const run = await until(
  () => api('GET', `${base}/executions/${execution.executionId}`),
  (item) => ['SUCCEEDED', 'FAILED'].includes(item.status),
);
assert.equal(run.status, 'SUCCEEDED');
const steps = await api('GET', `${base}/executions/${execution.executionId}/steps`);
assert.deepEqual(steps.find((step) => step.nodeId === 'result').output, { reply: 'mock-response' });
console.log('Native Prisma, JWT, workflow queue and mock AI: OK');
const png = await sharp({ create: { width: 200, height: 100, channels: 3, background: '#ffffff' } })
  .png()
  .toBuffer();
const form = new FormData();
form.append('file', new Blob([png], { type: 'image/png' }), 'smoke.png');
const uploaded = await fetch(`http://127.0.0.1:3000/api/v1${base}/documents`, {
  method: 'POST',
  headers: { authorization: `Bearer ${token}` },
  body: form,
});
assert.equal(uploaded.status, 202);
const { document } = await uploaded.json();
const processed = await until(
  () => api('GET', `${base}/documents/${document.id}`),
  (item) => ['VALIDATED', 'NEEDS_REVIEW', 'FAILED'].includes(item.document.status),
);
assert.notEqual(processed.document.status, 'FAILED');
assert.ok(processed.document.processedAt);
console.log('Shared uploads, document queue, native sharp and offline OCR: OK');
