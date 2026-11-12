import { startWorkerHealth } from '../../../apps/api/src/infrastructure/worker-health.js';
import '../../../apps/api/src/config/bootstrap.js';
import { installShutdown } from '../../../apps/api/src/infrastructure/shutdown.js';
import { Worker } from 'bullmq';
import {
  scheduleApprovalExpiry,
  scheduleObservabilityJobs,
} from '../../../apps/api/src/infrastructure/queue.js';
import { notifier } from '../../../apps/api/src/modules/notifications/notifier.js';
import {
  expireApprovals,
  resumeWorkflow,
  processInboundWebhook,
  processOutboundWebhook,
} from '../../../apps/api/src/jobs/processors.js';
import {
  aggregateDailyStats,
  retainObservabilityData,
} from '../../../apps/api/src/jobs/observability.js';
import { logger } from '../../../apps/api/src/infrastructure/logger.js';

function connectionFromEnv() {
  const url = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    db: Number(url.pathname.slice(1) || 0),
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
  };
}

const connection = connectionFromEnv();
const emailWorker = new Worker(
  'notification-email',
  (job) =>
    notifier.send({
      to: job.data.to,
      subject: job.data.subject,
      text: job.data.text,
    }),
  { connection },
);
const approvalWorker = new Worker(
  'approvals',
  async (job) => {
    if (job.name === 'expire') await expireApprovals();
    if (job.name === 'aggregate-daily-stats') await aggregateDailyStats();
    if (job.name === 'retain-observability') await retainObservabilityData();
  },
  { connection },
);
const resumeWorker = new Worker('workflow-resume', resumeWorkflow, { connection });
const inboundWebhookWorker = new Worker('webhook-inbound', processInboundWebhook, { connection });
const outboundWebhookWorker = new Worker('webhook-outbound', processOutboundWebhook, {
  connection,
});

await scheduleApprovalExpiry();
await scheduleObservabilityJobs();
for (const worker of [
  emailWorker,
  approvalWorker,
  resumeWorker,
  inboundWebhookWorker,
  outboundWebhookWorker,
]) {
  worker.on('failed', (job, error) =>
    logger.error({ queue: worker.name, jobId: job?.id, err: error }, 'job failed'),
  );
}

const stopHealth = startWorkerHealth([
  emailWorker,
  approvalWorker,
  resumeWorker,
  inboundWebhookWorker,
  outboundWebhookWorker,
]);
async function shutdown() {
  await stopHealth();
  await Promise.all([
    emailWorker.close(),
    approvalWorker.close(),
    resumeWorker.close(),
    inboundWebhookWorker.close(),
    outboundWebhookWorker.close(),
  ]);
}
installShutdown(shutdown);
