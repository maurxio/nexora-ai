import { Worker } from 'bullmq';
import prisma from '../../../apps/api/src/infrastructure/prisma.js';
import { enqueueExecution } from '../../../apps/api/src/infrastructure/queue.js';
import { QUEUE_NAME, LEASE_MS, MAX_NODE_RUNS } from '@nexora/shared';
import { executeNode, executionOrder, shouldRun } from '@nexora/workflow-engine';

function connectionFromEnv() {
  const url = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
  return { host: url.hostname, port: Number(url.port || 6379), ...(url.password ? { password: decodeURIComponent(url.password) } : {}) };
}

async function processExecution(executionId) {
  const now = new Date();
  const claimed = await prisma.workflowExecution.updateMany({
    where: { id: executionId, status: { in: ['QUEUED', 'RUNNING'] }, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
    data: { status: 'RUNNING', lockedUntil: new Date(now.getTime() + LEASE_MS) },
  });
  if (!claimed.count) return;
  await prisma.workflowExecution.updateMany({ where: { id: executionId, startedAt: null }, data: { startedAt: now } });
  const execution = await prisma.workflowExecution.findUnique({ where: { id: executionId }, include: { workflowVersion: true, steps: { orderBy: { startedAt: 'asc' } } } });
  if (!execution) return;
  const controller = new AbortController();
  const heartbeat = setInterval(() => prisma.workflowExecution.updateMany({ where: { id: executionId, status: 'RUNNING' }, data: { lockedUntil: new Date(Date.now() + LEASE_MS) } }).catch(() => {}), 10000);
  try {
    const results = {};
    for (const step of execution.steps) {
      if (step.status === 'SUCCEEDED' || step.status === 'SKIPPED') results[step.nodeId] = { status: step.status, output: step.output };
    }
    const context = { input: execution.input, nodes: Object.fromEntries(Object.entries(results).map(([key, value]) => [key, value.output])) };
    let runs = execution.steps.length;
    for (const nodeId of executionOrder(execution.workflowVersion.definition)) {
      const node = execution.workflowVersion.definition.nodes.find((item) => item.id === nodeId);
      const run = shouldRun(node.id, execution.workflowVersion.definition, results);
      if (results[node.id]) continue;
      const current = await prisma.workflowExecution.findUnique({ where: { id: executionId }, select: { status: true } });
      if (current?.status === 'CANCELLED') { controller.abort(); return; }
      if (!run) {
        await prisma.executionStep.create({ data: { executionId, nodeId: node.id, nodeType: node.type, status: 'SKIPPED', attempt: 1, finishedAt: new Date() } });
        results[node.id] = { status: 'SKIPPED' };
        continue;
      }
      if (runs >= MAX_NODE_RUNS) throw new Error('Se alcanzó el máximo de pasos de la ejecución');
      const previousAttempts = execution.steps.filter((step) => step.nodeId === node.id).reduce((max, step) => Math.max(max, step.attempt), 0);
      try {
        const result = await executeNode(node, context, controller.signal, {
          onAttempt: async (attempt) => {
            if (runs >= MAX_NODE_RUNS) throw new Error('Se alcanzó el máximo de pasos de la ejecución');
            runs += 1;
            return prisma.executionStep.create({ data: { executionId, nodeId: node.id, nodeType: node.type, status: 'RUNNING', attempt: previousAttempts + attempt, startedAt: new Date() } });
          },
          onSuccess: (step, output) => prisma.executionStep.update({ where: { id: step.id }, data: { status: 'SUCCEEDED', output, finishedAt: new Date() } }),
          onFailure: (error, attempt) => prisma.executionStep.updateMany({ where: { executionId, nodeId: node.id, attempt: previousAttempts + attempt, status: 'RUNNING' }, data: { status: 'FAILED', error: error.message, finishedAt: new Date() } }),
        });
        results[node.id] = { status: 'SUCCEEDED', output: result.output };
        context.nodes[node.id] = result.output;
      } catch (error) {
        throw error;
      }
    }
    await prisma.workflowExecution.updateMany({ where: { id: executionId, status: { not: 'CANCELLED' } }, data: { status: 'SUCCEEDED', lockedUntil: null, finishedAt: new Date() } });
  } catch (error) {
    await prisma.workflowExecution.updateMany({ where: { id: executionId, status: { not: 'CANCELLED' } }, data: { status: 'FAILED', error: error.message, lockedUntil: null, finishedAt: new Date() } });
  } finally {
    clearInterval(heartbeat);
  }
}

const worker = new Worker(QUEUE_NAME, (job) => processExecution(job.data.executionId), { connection: connectionFromEnv(), concurrency: 5 });
async function recover() {
  const stale = await prisma.workflowExecution.findMany({ where: { status: { in: ['QUEUED', 'RUNNING'] }, updatedAt: { lt: new Date(Date.now() - LEASE_MS) } }, select: { id: true } });
  await Promise.all(stale.map(({ id }) => enqueueExecution(id).catch(() => {})));
}
recover().catch((error) => console.error(error));
const recoveryTimer = setInterval(() => recover().catch((error) => console.error(error)), 30000);
async function shutdown() {
  clearInterval(recoveryTimer);
  await worker.close();
  await prisma.$disconnect();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
