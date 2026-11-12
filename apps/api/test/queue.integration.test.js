import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Queue, QueueEvents, Worker } from 'bullmq';
test('BullMQ retries failed jobs and closes worker, events and Redis connections', async () => {
  const name = `qa-${crypto.randomUUID()}`;
  const url = new URL(process.env.REDIS_URL);
  const connection = { host: url.hostname, port: Number(url.port), db: 1 };
  const queue = new Queue(name, { connection });
  const events = new QueueEvents(name, { connection });
  let attempts = 0;
  const worker = new Worker(
    name,
    async () => {
      attempts++;
      if (attempts === 1) throw new Error('temporary failure');
      return { delivered: true };
    },
    { connection },
  );
  try {
    await events.waitUntilReady();
    const job = await queue.add(
      'deliver',
      {},
      { attempts: 2, backoff: { type: 'exponential', delay: 10 } },
    );
    assert.deepEqual(await job.waitUntilFinished(events, 5000), { delivered: true });
    assert.equal(attempts, 2);
  } finally {
    await worker.close();
    await events.close();
    await queue.obliterate({ force: true });
    await queue.close();
  }
  assert.equal((await worker.client).status, 'end');
  assert.equal((await queue.client).status, 'end');
});
