import { Router } from 'express';
import { z } from 'zod';
import prisma from '../../infrastructure/prisma.js';
import { asyncHandler, httpError } from '../../utils.js';
import { requireRole } from '../../middleware/rbac.js';
import { shapeSchema, validateGraph } from './definition.js';

const router = Router({ mergeParams: true });
const idSchema = z.string().uuid();
const createSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().max(500).optional(),
  draft: shapeSchema.optional(),
}).strict();
const updateSchema = createSchema.partial().strict();

function workflowId(req) {
  if (!idSchema.safeParse(req.params.id).success) throw httpError(404, 'Workflow no encontrado');
  return req.params.id;
}

function validateWorkflowId(req, res, next) {
  if (!idSchema.safeParse(req.params.id).success) {
    return res.status(404).json({ error: 'Workflow no encontrado' });
  }
  next();
}

async function findWorkflow(req) {
  const workflow = await prisma.workflow.findFirst({
    where: { id: workflowId(req), organizationId: req.orgId },
    include: { versions: { orderBy: { version: 'desc' }, take: 1, select: { version: true } } },
  });
  if (!workflow) throw httpError(404, 'Workflow no encontrado');
  return workflow;
}

function latestVersion(workflow) {
  return workflow.versions[0]?.version ?? null;
}

router.get('/', asyncHandler(async (req, res) => {
  const workflows = await prisma.workflow.findMany({
    where: { organizationId: req.orgId },
    orderBy: { createdAt: 'asc' },
    include: { versions: { orderBy: { version: 'desc' }, take: 1, select: { version: true } } },
  });
  res.json(workflows.map(({ name, description, updatedAt, versions }) => ({
    name,
    description,
    updatedAt,
    latestVersion: versions[0]?.version ?? null,
  })));
}));

router.post('/', requireRole('ADMIN', 'OPERATOR'), asyncHandler(async (req, res) => {
  const input = createSchema.parse(req.body);
  try {
    const workflow = await prisma.workflow.create({
      data: { ...input, organizationId: req.orgId },
    });
    res.status(201).json(workflow);
  } catch (error) {
    if (error.code === 'P2002') throw httpError(409, 'Ya existe un workflow con ese nombre');
    throw error;
  }
}));

router.get('/:id', validateWorkflowId, asyncHandler(async (req, res) => {
  const workflow = await findWorkflow(req);
  res.json({ ...workflow, latestVersion: latestVersion(workflow), versions: undefined });
}));

router.patch('/:id', validateWorkflowId, requireRole('ADMIN', 'OPERATOR'), asyncHandler(async (req, res) => {
  const input = updateSchema.parse(req.body);
  const existing = await findWorkflow(req);
  try {
    const workflow = await prisma.workflow.update({
      where: { id: existing.id },
      data: input,
    });
    res.json(workflow);
  } catch (error) {
    if (error.code === 'P2002') throw httpError(409, 'Ya existe un workflow con ese nombre');
    throw error;
  }
}));

router.delete('/:id', validateWorkflowId, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const existing = await findWorkflow(req);
  await prisma.workflow.delete({ where: { id: existing.id } });
  res.status(204).send();
}));

router.post('/:id/publish', validateWorkflowId, requireRole('ADMIN', 'OPERATOR'), asyncHandler(async (req, res) => {
  const workflow = await findWorkflow(req);
  const problems = validateGraph(workflow.draft);
  if (problems.length) return res.status(400).json({ error: 'Workflow inválido', problems });

  try {
    const version = await prisma.$transaction(async (transaction) => {
      const current = await transaction.workflowVersion.aggregate({
        where: { workflowId: workflow.id },
        _max: { version: true },
      });
      return transaction.workflowVersion.create({
        data: {
          workflowId: workflow.id,
          version: (current._max.version || 0) + 1,
          definition: workflow.draft,
          createdById: req.user.id,
        },
        select: { id: true, version: true, createdAt: true },
      });
    });
    res.status(201).json(version);
  } catch (error) {
    if (error.code === 'P2002') throw httpError(409, 'La publicación del workflow ya existe');
    throw error;
  }
}));

router.get('/:id/versions', validateWorkflowId, asyncHandler(async (req, res) => {
  const workflow = await findWorkflow(req);
  const versions = await prisma.workflowVersion.findMany({
    where: { workflowId: workflow.id },
    orderBy: { version: 'desc' },
    select: { version: true, createdAt: true, createdById: true },
  });
  res.json(versions);
}));

router.get('/:id/versions/:version', validateWorkflowId, asyncHandler(async (req, res) => {
  const version = Number(req.params.version);
  if (!Number.isInteger(version) || version < 1) throw httpError(404, 'Versión no encontrada');
  const workflow = await findWorkflow(req);
  const result = await prisma.workflowVersion.findFirst({
    where: { workflowId: workflow.id, version },
    select: { id: true, version: true, definition: true, createdById: true, createdAt: true },
  });
  if (!result) throw httpError(404, 'Versión no encontrada');
  res.json(result);
}));

router.post('/:id/execute', validateWorkflowId, (_req, res) => res.status(501).json({ error: 'Pendiente' }));

export default router;
