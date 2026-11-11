import { z } from 'zod';

const schema = z.object({
  AI_KEY_ENCRYPTION_SECRET: z.string().min(32, 'AI_KEY_ENCRYPTION_SECRET debe tener al menos 32 caracteres'),
});

export function assertAiConfiguration(env = process.env) {
  return schema.parse(env);
}
