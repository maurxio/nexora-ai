import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(isProduction ? {} : { base: { environment: 'development' } }),
  redact: {
    paths: [
      'req.headers.authorization', 'req.headers.cookie', 'headers.authorization', 'headers.cookie',
      'req.body.password', 'req.body.token', 'req.body.secret', 'req.body.credentials',
      'req.body.apiKey', '*.password', '*.token', '*.secret', '*.credentials', '*.encryptedCredentials', '*.apiKey', '*.apiKeyEncrypted',
    ],
    censor: '[REDACTED]',
  },
});

export function logContext(req) {
  return {
    requestId: req.id || req.requestId,
    tenantId: req.orgId || req.tenantId || null,
    userId: req.user?.id || null,
    method: req.method,
    route: req.route?.path ? `${req.baseUrl || ''}${req.route.path}` : req.originalUrl,
  };
}
