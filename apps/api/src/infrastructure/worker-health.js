import { writeFile, unlink } from 'node:fs/promises';
const file = '/tmp/nexora-worker-health';
export function startWorkerHealth(workers) {
  const check = async () => {
    try {
      for (const worker of workers) {
        if (!worker.isRunning()) throw new Error('Worker stopped');
        await (await worker.client).ping();
      }
      await writeFile(file, String(Date.now()));
    } catch {
      await unlink(file).catch(() => {});
    }
  };
  const timer = setInterval(check, 10000);
  timer.unref();
  check();
  return () => {
    clearInterval(timer);
    return unlink(file).catch(() => {});
  };
}
