import { resolveTemplates } from '../template.js';

export async function execute(config, context, { signal }) {
  const delay = process.env.NODE_ENV === 'production' ? 0 : Number(config.simulateDelayMs || 0);
  if (delay < 0 || delay > 20000) throw Object.assign(new Error('simulateDelayMs no es válido'), { retryable: false });
  for (let elapsed = 0; elapsed < delay; elapsed += 500) {
    if (signal.aborted) throw Object.assign(new Error('Ejecución cancelada'), { retryable: false });
    await new Promise((resolve) => setTimeout(resolve, Math.min(500, delay - elapsed)));
  }
  if (signal.aborted) throw Object.assign(new Error('Ejecución cancelada'), { retryable: false });
  return resolveTemplates(config.set || {}, context);
}
