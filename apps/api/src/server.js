import './config/bootstrap.js';
import app, { metricsTimer } from './app.js';
import { logger } from './infrastructure/logger.js';
import { assertAiConfiguration } from './modules/ai/config.js';
import { installShutdown } from './infrastructure/shutdown.js';
assertAiConfiguration();
const port = process.env.PORT || 3000;
const server = app.listen(port, () => logger.info({ port }, 'NEXORA API escuchando'));
installShutdown(async () => {
  clearInterval(metricsTimer);
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
});
