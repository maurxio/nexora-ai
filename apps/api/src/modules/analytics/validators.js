import { z } from 'zod';

export const analyticsQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  type: z.enum(['WORKFLOW', 'INTEGRATION', 'DOCUMENT', 'APPROVAL']).optional(),
}).strict();
