import { startWorkerHealth } from '../../../apps/api/src/infrastructure/worker-health.js';
import '../../../apps/api/src/config/bootstrap.js';
import { installShutdown } from '../../../apps/api/src/infrastructure/shutdown.js';
import { Worker } from 'bullmq';
import { processDocument } from '../../../apps/api/src/modules/documents/pipeline.js';

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

const worker = new Worker('document-processing', (job) => processDocument(job.data.documentId), {
  connection: connectionFromEnv(),
  concurrency: Number(process.env.DOCUMENT_WORKER_CONCURRENCY || 2),
});
worker.on('failed', (job, error) =>
  console.error(`[document-processing] ${job?.id}`, error.message),
);

const stopHealth = startWorkerHealth([worker]);
async function shutdown() {
  await stopHealth();
  await worker.close();
}
installShutdown(shutdown);
