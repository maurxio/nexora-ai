import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes.js';
import { errorHandler, notFound } from './middleware/error.js';
import pinoHttp from 'pino-http';
import { logger, logContext } from './infrastructure/logger.js';
import { requestId } from './middleware/request-id.js';
import { observeHttp, metricsHandler, collectQueueDepth } from './infrastructure/metrics.js';
import { workflowQueue, approvalQueue, workflowResumeQueue, emailQueue, webhookInboundQueue, webhookOutboundQueue, documentProcessingQueue } from './infrastructure/queue.js';
import prisma from './infrastructure/prisma.js';
import { redis } from './infrastructure/redis.js';

const app = express();
app.use(requestId);
app.use(pinoHttp({ logger, genReqId: (req) => req.id, customProps: logContext }));
app.use(observeHttp);
app.use(helmet());
app.use(cors());
app.use(express.json({
  limit: '2mb',
  verify: (req, _res, buffer) => {
    if (req.originalUrl.startsWith('/api/v1/hooks/')) req.rawBody = buffer.toString('utf8');
  },
}));

app.get('/', (_req, res) => {
  res.json({
    name: 'NEXORA API',
    status: 'ok',
    health: '/api/v1/health',
  });
});

app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/ready', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    if (redis.status === 'wait') await redis.connect();
    await redis.ping();
    return res.json({ status: 'ok' });
  } catch {
    return res.status(503).json({ status: 'unavailable' });
  }
});
app.get('/metrics', metricsHandler);
setInterval(() => collectQueueDepth([workflowQueue, approvalQueue, workflowResumeQueue, emailQueue, webhookInboundQueue, webhookOutboundQueue, documentProcessingQueue]).catch(() => {}), 30000).unref();
app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/v1', routes);

app.use(notFound);
app.use(errorHandler);

export default app;
