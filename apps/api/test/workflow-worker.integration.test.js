import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import prisma from '../src/infrastructure/prisma.js';
import { enqueueExecution } from '../src/infrastructure/queue.js';
import { closeInfrastructure } from '../src/infrastructure/shutdown.js';

test('workflow worker executes queued graph with mock AI and shuts down without open handles', async () => {
  const suffix = crypto.randomUUID();
  let user, organization, worker;
  try {
    user = await prisma.user.create({
      data: { email: `${suffix}@test.local`, name: 'Worker QA', passwordHash: 'unused' },
    });
    organization = await prisma.organization.create({ data: { name: 'Worker QA', slug: suffix } });
    const provider = await prisma.aiProviderConfig.create({
      data: {
        orgId: organization.id,
        createdById: user.id,
        name: 'Mock',
        provider: 'mock',
        model: 'mock',
        isDefault: true,
      },
    });
    const definition = {
      nodes: [
        { id: 'start', type: 'trigger', config: {} },
        {
          id: 'ai',
          type: 'agent',
          config: { providerConfigId: provider.id, prompt: 'Return deterministic output' },
        },
        { id: 'result', type: 'transform', config: { set: { reply: '{{nodes.ai}}' } } },
      ],
      edges: [
        { from: 'start', to: 'ai' },
        { from: 'ai', to: 'result' },
      ],
    };
    const workflow = await prisma.workflow.create({
      data: { organizationId: organization.id, name: 'Queued QA', draft: definition },
    });
    const version = await prisma.workflowVersion.create({
      data: { workflowId: workflow.id, version: 1, definition },
    });
    const execution = await prisma.workflowExecution.create({
      data: {
        organizationId: organization.id,
        workflowId: workflow.id,
        workflowVersionId: version.id,
        input: {},
        triggeredById: user.id,
      },
    });
    worker = spawn(
      process.execPath,
      [fileURLToPath(new URL('../../../workers/workflow-worker/src/index.js', import.meta.url))],
      { env: process.env, stdio: ['ignore', 'ignore', 'pipe'] },
    );
    let errors = '';
    worker.stderr.on('data', (chunk) => {
      errors += chunk;
    });
    await enqueueExecution(execution.id);
    let completed;
    for (let attempt = 0; attempt < 100; attempt++) {
      completed = await prisma.workflowExecution.findUnique({
        where: { id: execution.id },
        include: { steps: true },
      });
      if (['SUCCEEDED', 'FAILED'].includes(completed.status)) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(completed.status, 'SUCCEEDED', errors || completed.error);
    assert.deepEqual(completed.steps.find((step) => step.nodeId === 'result').output, {
      reply: 'mock-response',
    });
    assert.equal(
      await prisma.aiUsage.count({ where: { orgId: organization.id, status: 'SUCCESS' } }),
      1,
    );
    const exit = once(worker, 'exit');
    worker.kill('SIGTERM');
    const [code, signal] = await exit;
    assert.equal(code, 0);
    assert.equal(signal, null);
  } finally {
    if (worker && worker.exitCode === null) {
      const exit = once(worker, 'exit');
      worker.kill('SIGTERM');
      await exit;
    }
    if (organization) await prisma.organization.delete({ where: { id: organization.id } });
    if (user) await prisma.user.delete({ where: { id: user.id } });
    await closeInfrastructure();
  }
});
