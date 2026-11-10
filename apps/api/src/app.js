import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes.js';
import { errorHandler, notFound } from './middleware/error.js';

const app = express();
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

app.get('/api/v1/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/v1', routes);

app.use(notFound);
app.use(errorHandler);

export default app;
