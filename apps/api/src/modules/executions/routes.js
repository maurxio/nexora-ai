import { Router } from 'express';
import { z } from 'zod';
import prisma from '../../infrastructure/prisma.js';
import { asyncHandler, httpError } from '../../utils.js';
import { requireRole } from '../../middleware/rbac.js';
import { enqueueExecution } from '../../infrastructure/queue.js';

const router = Router({ mergeParams: true });

router.get('/approvals/pending', (_req, res) => res.status(501).json({ error: 'Pendiente' }));
router.post('/approvals/:approvalId/decision', (_req, res) => res.status(501).json({ error: 'Pendiente' }));
const uuid = z.string().uuid();
function id(req) { if (!uuid.safeParse(req.params.id).success) throw httpError(404, 'Ejecución no encontrada'); return req.params.id; }
async function find(req) {
  const execution = await prisma.workflowExecution.findFirst({ where: { id: id(req), organizationId: req.orgId }, include: { workflow: { select: { id: true } }, workflowVersion: { select: { version: true } } } });
  if (!execution) throw httpError(404, 'Ejecución no encontrada');
  return execution;
}

router.get('/', asyncHandler(async (req, res) => {
  const query = z.object({ status: z.enum(['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED']).optional(), workflowId: uuid.optional(), limit: z.coerce.number().int().min(1).max(100).default(25), cursor: uuid.optional() }).parse(req.query);
  const items = await prisma.workflowExecution.findMany({ where: { organizationId: req.orgId, ...(query.status ? { status: query.status } : {}), ...(query.workflowId ? { workflowId: query.workflowId } : {}), ...(query.cursor ? { id: { lt: query.cursor } } : {}) }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: query.limit + 1, select: { id: true, workflowId: true, workflowVersionId: true, status: true, error: true, startedAt: true, finishedAt: true, createdAt: true, updatedAt: true } });
  const nextCursor = items.length > query.limit ? items.pop().id : null;
  res.json({ items, nextCursor });
}));
router.get('/:id', asyncHandler(async (req, res) => {
  const execution = await find(req);
  res.json({ ...execution, workflowId: execution.workflow.id, workflowVersion: execution.workflowVersion.version, workflow: undefined, workflowVersion: undefined });
}));
router.get('/:id/steps', asyncHandler(async (req, res) => {
  const execution = await find(req);
  const steps = await prisma.executionStep.findMany({ where: { executionId: execution.id }, orderBy: { startedAt: 'asc' }, select: { nodeId: true, nodeType: true, status: true, attempt: true, output: true, error: true, startedAt: true, finishedAt: true } });
  res.json(steps);
}));
router.post('/:id/cancel', requireRole('ADMIN', 'OPERATOR'), asyncHandler(async (req, res) => {
  const execution = await find(req);
  if (!['QUEUED', 'RUNNING'].includes(execution.status)) throw httpError(409, 'La ejecución no se puede cancelar');
  const result = await prisma.workflowExecution.updateMany({ where: { id: execution.id, organizationId: req.orgId, status: { in: ['QUEUED', 'RUNNING'] } }, data: { status: 'CANCELLED', finishedAt: new Date() } });
  if (!result.count) throw httpError(409, 'La ejecución no se puede cancelar');
  res.json(await find(req));
}));
router.post('/:id/retry', requireRole('ADMIN', 'OPERATOR'), asyncHandler(async (req, res) => {
  const execution = await find(req);
  if (!['FAILED', 'CANCELLED'].includes(execution.status)) throw httpError(409, 'La ejecución no se puede reintentar');
  const created = await prisma.workflowExecution.create({ data: { organizationId: req.orgId, workflowId: execution.workflowId, workflowVersionId: execution.workflowVersionId, input: execution.input, triggeredById: req.user.id } });
  try { await enqueueExecution(created.id); } catch { await prisma.workflowExecution.update({ where: { id: created.id }, data: { status: 'FAILED', error: 'Cola no disponible', finishedAt: new Date() } }); throw httpError(503, 'Cola no disponible'); }
  res.status(202).json({ executionId: created.id, status: created.status });
}));

export default router;
