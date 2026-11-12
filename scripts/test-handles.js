// An exit deadline detects leaked handles; the suite must exit on its own.
import { spawn } from 'node:child_process';
const child = spawn('npm', ['run', 'test:backend'], { stdio: 'inherit', detached: true });
const deadline = setTimeout(() => {
  console.error(
    'Backend did not exit within 120s: inspect BullMQ workers, queues, timers and Redis connections.',
  );
  process.kill(-child.pid, 'SIGTERM');
  process.exitCode = 1;
}, 120000);
child.on('exit', (code) => {
  clearTimeout(deadline);
  process.exitCode = code ?? 1;
});
