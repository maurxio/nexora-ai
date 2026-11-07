import { Router } from 'express';
import { z } from 'zod';
import prisma from '../../infrastructure/prisma.js';
import { asyncHandler, httpError } from '../../utils.js';
import { requireRole } from '../../middleware/rbac.js';
import { getTool, listToolNames } from './tools/registry.js';

const router = Router({ mergeParams: true });

const agentFields = {
  name: z.string().trim().min(2).max(100),
  description: z.string().optional(),
  systemInstructions: z.string().min(1).max(4000),
  model: z.string().min(1).optional(),
  maxStepsPerRun: z.number().int().min(1).max(25).optional(),
  monthlyTokenBudget: z.number().int().positive().optional(),
};
const createAgentSchema = z.object(agentFields).strict();
const updateAgentSchema = z.object(agentFields).partial().strict();
const toolsSchema = z.object({ tools: z.array(z.string()) }).strict();
const idSchema = z.string().uuid();

function agentId(req) {
  if (!idSchema.safeParse(req.params.id).success) throw httpError(404, 'Agente no encontrado');
  return req.params.id;
}

function validateAgentId(req, res, next) {
  if (!idSchema.safeParse(req.params.id).success) return res.status(404).json({ error: 'Agente no encontrado' });
  next();
}

function agentWhere(req) {
  return { id: agentId(req), organizationId: req.orgId };
}

async function findAgent(req) {
  const agent = await prisma.agent.findFirst({
    where: agentWhere(req),
    include: { tools: true },
  });
  if (!agent) throw httpError(404, 'Agente no encontrado');
  return agent;
}

router.get('/tools/catalog', (_req, res) => {
  res.json(listToolNames().map((name) => {
    const tool = getTool(name);
    return { name: tool.name, description: tool.description };
  }));
});

router.get('/', asyncHandler(async (req, res) => {
  const agents = await prisma.agent.findMany({
    where: { organizationId: req.orgId },
    include: { tools: true },
    orderBy: { createdAt: 'asc' },
  });
  res.json(agents);
}));

router.post('/', requireRole('ADMIN', 'OPERATOR'), asyncHandler(async (req, res) => {
  const input = createAgentSchema.parse(req.body);
  try {
    const agent = await prisma.agent.create({
      data: { ...input, organizationId: req.orgId },
      include: { tools: true },
    });
    res.status(201).json(agent);
  } catch (error) {
    if (error.code === 'P2002') throw httpError(409, 'Ya existe un agente con ese nombre');
    throw error;
  }
}));

router.get('/:id', validateAgentId, asyncHandler(async (req, res) => {
  res.json(await findAgent(req));
}));

router.patch('/:id', validateAgentId, requireRole('ADMIN', 'OPERATOR'), asyncHandler(async (req, res) => {
  const input = updateAgentSchema.parse(req.body);
  const existing = await findAgent(req);
  try {
    const agent = await prisma.agent.update({
      where: { id: existing.id },
      data: input,
      include: { tools: true },
    });
    res.json(agent);
  } catch (error) {
    if (error.code === 'P2002') throw httpError(409, 'Ya existe un agente con ese nombre');
    throw error;
  }
}));

router.delete('/:id', validateAgentId, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const existing = await findAgent(req);
  await prisma.agent.delete({ where: { id: existing.id } });
  res.status(204).send();
}));

router.put('/:id/tools', validateAgentId, requireRole('ADMIN', 'OPERATOR'), asyncHandler(async (req, res) => {
  const input = toolsSchema.parse(req.body);
  const existing = await findAgent(req);
  const invalidTools = [...new Set(input.tools)].filter((name) => !getTool(name));
  if (invalidTools.length) {
    throw httpError(400, `Herramientas inválidas: ${invalidTools.join(', ')}`);
  }

  await prisma.$transaction(async (transaction) => {
    await transaction.agentTool.deleteMany({ where: { agentId: existing.id } });
    if (input.tools.length) {
      await transaction.agentTool.createMany({
        data: [...new Set(input.tools)].map((toolName) => ({ agentId: existing.id, toolName })),
      });
    }
  });
  res.json(await findAgent(req));
}));

router.post('/:id/run', validateAgentId, (_req, res) => res.status(501).json({ error: 'Pendiente' }));

export default router;
