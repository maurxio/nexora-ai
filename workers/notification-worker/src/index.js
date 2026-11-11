import { Worker } from 'bullmq';
import prisma from '../../../apps/api/src/infrastructure/prisma.js';
import { scheduleApprovalExpiry, scheduleObservabilityJobs } from '../../../apps/api/src/infrastructure/queue.js';
import { notifier } from '../../../apps/api/src/modules/notifications/notifier.js';
import { expireApprovals, resumeWorkflow, processInboundWebhook, processOutboundWebhook } from '../../../apps/api/src/jobs/processors.js';
import { aggregateDailyStats, retainObservabilityData } from '../../../apps/api/src/jobs/observability.js';
import { logger } from '../../../apps/api/src/infrastructure/logger.js';

function connectionFromEnv() {
  const url = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
  return { host: url.hostname, port: Number(url.port || 6379), ...(url.password ? { password: decodeURIComponent(url.password) } : {}) };
}

const connection = connectionFromEnv();
const emailWorker = new Worker('notification-email', (job) => notifier.send({
  to: job.data.to,
  subject: job.data.subject,
  text: job.data.text,
}), { connection });
const approvalWorker = new Worker('approvals', async (job) => {
  if (job.name === 'expire') await expireApprovals();
  if (job.name === 'aggregate-daily-stats') await aggregateDailyStats();
  if (job.name === 'retain-observability') await retainObservabilityData();
}, { connection });
const resumeWorker = new Worker('workflow-resume', resumeWorkflow, { connection });
const inboundWebhookWorker = new Worker('webhook-inbound', processInboundWebhook, { connection });
const outboundWebhookWorker = new Worker('webhook-outbound', processOutboundWebhook, { connection });

await scheduleApprovalExpiry();
await scheduleObservabilityJobs();
for (const worker of [emailWorker, approvalWorker, resumeWorker, inboundWebhookWorker, outboundWebhookWorker]) {
  worker.on('failed', (job, error) => logger.error({ queue: worker.name, jobId: job?.id, err: error }, 'job failed'));
}

async function shutdown() {
  await Promise.all([emailWorker.close(), approvalWorker.close(), resumeWorker.close(), inboundWebhookWorker.close(), outboundWebhookWorker.close()]);
  await prisma.$disconnect();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
