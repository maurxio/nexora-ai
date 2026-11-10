import { z } from 'zod';

const uuid = z.string().uuid();
const payload = z.record(z.any());

export const createApprovalSchema = z.object({
  workflowRunId: uuid.optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  payload,
  assigneeIds: z.array(uuid).min(1).max(100),
  expiresAt: z.coerce.date().optional(),
}).strict();

export const decisionSchema = z.object({ comment: z.string().trim().max(2000).optional() }).strict();
export const approvalListSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const notificationListSchema = z.object({
  unread: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
