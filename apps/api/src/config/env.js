import { z } from 'zod';
const url = z.string().url();
export const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: url.refine((s) => /^postgres(ql)?:/.test(s), 'Postgres URL required'),
    REDIS_URL: url.refine((s) => /^rediss?:/.test(s), 'Redis URL required'),
    JWT_SECRET: z.string().min(32),
    INTEGRATIONS_ENCRYPTION_KEY: z
      .string()
      .refine((s) => Buffer.from(s, 'base64').length === 32, 'Expected 32 bytes in base64'),
    AI_KEY_ENCRYPTION_SECRET: z.string().min(32),
    CORS_ORIGINS: z.string().default('http://localhost:5173'),
    METRICS_TOKEN: z.string().optional(),
    JWT_EXPIRES_IN: z
      .string()
      .regex(/^\d+[smhd]$/)
      .default('15m'),
    REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(90).default(7),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(2).default(0),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),
    HTTP_NODE_ALLOW_LOOPBACK: z.enum(['true', 'false']).default('false'),
    ALLOW_PRIVATE_HOSTS: z.enum(['true', 'false']).default('false'),
    HTTP_DEFAULT_TIMEOUT_MS: z.coerce.number().int().min(1).max(30000).default(10000),
    HTTP_MAX_RESPONSE_BYTES: z.coerce.number().int().positive().default(2097152),
    DOCUMENT_UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(15728640),
    DOCUMENT_WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(2),
    DOCUMENT_JOB_TIMEOUT_MS: z.coerce.number().int().positive().default(300000),
    DOCUMENT_TOTAL_TOLERANCE: z.coerce.number().min(0).max(1).default(0.01),
    DOCUMENT_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
    DOCUMENT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
    OCR_MIN_CONFIDENCE: z.coerce.number().min(0).max(100).default(70),
    DOCUMENT_STORAGE_PATH: z.string().min(1).default('/tmp/nexora-uploads'),
    AUDIT_RETENTION_DAYS: z.coerce.number().int().positive().default(365),
    METRICS_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    const mailKeys = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM'];
    if (mailKeys.some((key) => env[key]) && !mailKeys.every((key) => env[key]))
      ctx.addIssue({
        code: 'custom',
        path: ['SMTP_HOST'],
        message: 'Complete SMTP configuration required when email is enabled',
      });
    if (['production', 'staging'].includes(env.NODE_ENV)) {
      if (!env.METRICS_TOKEN || env.METRICS_TOKEN.length < 32)
        ctx.addIssue({
          code: 'custom',
          path: ['METRICS_TOKEN'],
          message: 'At least 32 characters required',
        });
      if (env.CORS_ORIGINS.split(',').some((origin) => !/^https:\/\/[^/]+$/.test(origin.trim())))
        ctx.addIssue({
          code: 'custom',
          path: ['CORS_ORIGINS'],
          message: 'Explicit HTTPS origins required',
        });
    }
  });
export function validateEnv(input = process.env) {
  const result = envSchema.safeParse(input);
  if (!result.success)
    throw new Error(
      `Invalid environment: ${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`,
    );
  if (
    ['production', 'staging'].includes(result.data.NODE_ENV) &&
    ['HTTP_NODE_ALLOW_LOOPBACK', 'ALLOW_PRIVATE_HOSTS'].some((key) => input[key] === 'true')
  )
    throw new Error('Private HTTP targets must be disabled in production');
  return result.data;
}
