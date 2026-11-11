import app from './app.js';
import { logger } from './infrastructure/logger.js';
import { assertAiConfiguration } from './modules/ai/config.js';

assertAiConfiguration();

const port = process.env.PORT || 3000;
app.listen(port, () => logger.info({ port }, 'NEXORA API escuchando'));
