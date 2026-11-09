import { Queue } from 'bullmq';
import { QUEUE_NAME } from '@nexora/shared';

function connectionFromEnv() {
  const url = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
  };
}

export const workflowQueue = new Queue(QUEUE_NAME, { connection: connectionFromEnv() });
export function enqueueExecution(executionId) {
  return workflowQueue.add('execute', { executionId }, {
    jobId: executionId,
    attempts: 1,
    removeOnComplete: true,
  });
}
