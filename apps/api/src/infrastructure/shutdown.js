import prisma from './prisma.js';
import { closeQueues } from './queue.js';
import { redis } from './redis.js';

export async function closeInfrastructure() {
  await closeQueues();
  if (redis.status === 'wait') redis.disconnect();
  else if (redis.status !== 'end') await redis.quit();
  await prisma.$disconnect();
}

export function installShutdown(close) {
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    const deadline = setTimeout(() => process.exit(1), 25000);
    deadline.unref();
    try {
      await close();
      await closeInfrastructure();
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    } finally {
      clearTimeout(deadline);
    }
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
