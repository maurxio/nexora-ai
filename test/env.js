// Deliberately never read the developer .env during tests.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://nexora_test:nexora_test@localhost:55433/nexora_test';
process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:56380/1';
process.env.JWT_SECRET = 'isolated-test-jwt-secret-at-least-32-characters';
process.env.INTEGRATIONS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.AI_KEY_ENCRYPTION_SECRET = 'isolated-test-ai-secret-at-least-32-characters';
process.env.DOCUMENT_STORAGE_PATH = '/tmp/nexora-test-uploads';
process.env.LOG_LEVEL = 'silent';
process.env.HTTP_NODE_ALLOW_LOOPBACK = 'true';
const database = new URL(process.env.DATABASE_URL);
if (!database.pathname.endsWith('_test')) throw new Error('Test database name must end in _test');
const redis = new URL(process.env.REDIS_URL);
if (redis.pathname !== '/1') throw new Error('Tests require Redis database 1');

// All production HTTP clients use fetch. Each exercised provider/integration must
// install its own deterministic mock; accidental calls never reach the network.
globalThis.fetch = async () => {
  throw new Error('External HTTP must be mocked in backend tests');
};
