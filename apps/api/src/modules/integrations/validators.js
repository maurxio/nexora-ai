import { z } from 'zod';

const credentials = z.record(z.string().max(1000)).optional();
const headers = z.record(z.string().max(2000)).optional();
const page = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(100).default(25);
const url = z.string().url();

export const connectorSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.enum(['HTTP', 'WEBHOOK', 'CUSTOM']),
  baseUrl: url.optional(),
  authType: z.enum(['NONE', 'API_KEY', 'BEARER', 'BASIC']).default('NONE'),
  credentials,
  defaultHeaders: headers.default({}),
  isActive: z.boolean().optional(),
}).strict();
export const connectorPatchSchema = connectorSchema.partial();
export const testSchema = z.object({ method: z.string().regex(/^[A-Za-z]+$/).default('GET'), path: z.string().default('/'), body: z.any().optional() }).strict();
export const endpointSchema = z.object({ name: z.string().trim().min(1).max(100), isActive: z.boolean().optional() }).strict();
export const endpointPatchSchema = endpointSchema.partial();
export const eventListSchema = z.object({ status: z.enum(['RECEIVED', 'PROCESSED', 'FAILED']).optional(), page, limit });
export const subscriptionSchema = z.object({ url, eventTypes: z.array(z.string().trim().min(1).max(100)).min(1).max(100), secret: z.string().min(1).max(1000), isActive: z.boolean().optional() }).strict();
export const subscriptionPatchSchema = subscriptionSchema.partial();
export const logListSchema = z.object({ connectorId: z.string().uuid().optional(), success: z.enum(['true', 'false']).optional(), page, limit });
