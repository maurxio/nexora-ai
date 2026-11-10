import { Worker } from 'bullmq';
import prisma from '../../../apps/api/src/infrastructure/prisma.js';
import { processDocument } from '../../../apps/api/src/modules/documents/pipeline.js';

function connectionFromEnv() {
  const url = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
  return { host: url.hostname, port: Number(url.port || 6379), ...(url.password ? { password: decodeURIComponent(url.password) } : {}) };
}

const worker = new Worker('document-processing', (job) => processDocument(job.data.documentId), {
  connection: connectionFromEnv(),
  concurrency: Number(process.env.DOCUMENT_WORKER_CONCURRENCY || 2),
});
worker.on('failed', (job, error) => console.error(`[document-processing] ${job?.id}`, error.message));

async function shutdown() {
  await worker.close();
  await prisma.$disconnect();
}
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
