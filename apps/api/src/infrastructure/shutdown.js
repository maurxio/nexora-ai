import prisma from './prisma.js';
import { closeQueues } from './queue.js';
import { redis } from './redis.js';

export async function closeInfrastructure() {
  const closeRedis = async () => {
    if (redis.status === 'wait') redis.disconnect();
    else if (redis.status !== 'end') {
      try {
        await redis.quit();
      } finally {
        // Stop reconnect timers even when QUIT fails.
        redis.disconnect();
      }
    }
  };
  const results = await Promise.allSettled([closeQueues(), closeRedis(), prisma.$disconnect()]);
  const errors = results
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason);
  if (errors.length) throw new AggregateError(errors, 'Infrastructure cleanup failed');
}

export function installShutdown(close) {
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 25000);
    deadline.unref();
    let failed = false;
    for (const cleanup of [close, closeInfrastructure]) {
      try {
        await cleanup();
      } catch (error) {
        failed = true;
        console.error(error);
        process.exitCode = 1;
      }
    }
    // Keep the deadline armed if cleanup failed and left live connections behind.
    if (!failed) clearTimeout(deadline);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
