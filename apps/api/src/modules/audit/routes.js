import { Router } from 'express';
import { z } from 'zod';
import prisma from '../../infrastructure/prisma.js';
import { asyncHandler } from '../../utils.js';
import { requireRole } from '../../middleware/rbac.js';

const router = Router({ mergeParams: true });
const querySchema = z.object({
  action: z.string().max(100).optional(),
  entity: z.string().max(100).optional(),
  actor: z.string().uuid().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

router.get('/audit-logs', requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const input = querySchema.parse(req.query);
  const where = {
    tenantId: req.orgId,
    ...(input.action ? { action: input.action } : {}),
    ...(input.entity ? { entity: input.entity } : {}),
    ...(input.actor ? { actorId: input.actor } : {}),
    ...((input.from || input.to) ? { createdAt: { ...(input.from ? { gte: new Date(input.from) } : {}), ...(input.to ? { lte: new Date(input.to) } : {}) } } : {}),
  };
  let cursor;
  if (input.cursor) {
    try { cursor = JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8')); } catch { return res.status(422).json({ error: 'Cursor inválido' }); }
  }
  const items = await prisma.auditLog.findMany({
    where: cursor ? { ...where, OR: [{ createdAt: { lt: new Date(cursor.createdAt) } }, { createdAt: new Date(cursor.createdAt), id: { lt: cursor.id } }] } : where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: input.limit + 1,
  });
  const hasNext = items.length > input.limit;
  const data = items.slice(0, input.limit);
  const nextCursor = hasNext ? Buffer.from(JSON.stringify({ createdAt: data.at(-1).createdAt, id: data.at(-1).id })).toString('base64url') : null;
  res.json({ data, nextCursor });
}));

export default router;
