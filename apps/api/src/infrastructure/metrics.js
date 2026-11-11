import client from 'prom-client';

client.collectDefaultMetrics();

export const httpDuration = new client.Histogram({
  name: 'nexora_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});
export const jobCounter = new client.Counter({
  name: 'nexora_jobs_total',
  help: 'BullMQ jobs completed or failed',
  labelNames: ['queue', 'status'],
});
export const queueDepth = new client.Gauge({
  name: 'nexora_queue_depth',
  help: 'BullMQ waiting and active jobs',
  labelNames: ['queue', 'state'],
});
export const aiTokens = new client.Counter({
  name: 'nexora_ai_tokens_total',
  help: 'Tokens consumidos por proveedores de IA',
  labelNames: ['provider', 'direction'],
});
export const aiLatency = new client.Histogram({
  name: 'nexora_ai_request_duration_seconds',
  help: 'Latencia de llamadas a proveedores de IA',
  labelNames: ['provider'],
});
export const aiCallCounter = new client.Counter({
  name: 'nexora_ai_calls_total',
  help: 'Llamadas a proveedores de IA',
  labelNames: ['provider', 'status'],
});

export async function collectQueueDepth(queues) {
  await Promise.all(queues.map(async (queue) => {
    const counts = await queue.getJobCounts('waiting', 'active', 'failed', 'delayed');
    for (const [state, count] of Object.entries(counts)) queueDepth.labels(queue.name, state).set(count);
  }));
}

export async function metricsHandler(req, res) {
  const token = process.env.METRICS_TOKEN;
  if (!token || req.get('authorization') !== `Bearer ${token}`) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  res.set('Content-Type', client.register.contentType);
  return res.end(await client.register.metrics());
}

export function observeHttp(req, res, next) {
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    const route = req.route?.path ? `${req.baseUrl || ''}${req.route.path}` : 'unmatched';
    httpDuration.labels(req.method, route, String(res.statusCode)).observe(Number(process.hrtime.bigint() - started) / 1e9);
  });
  next();
}
