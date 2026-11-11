import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler, httpError } from '../../utils.js';
import { requireRole } from '../../middleware/rbac.js';
import * as service from './service.js';

const router = Router({ mergeParams: true });
const id = z.string().uuid();
const provider = z.enum(['openai_compatible', 'anthropic', 'gemini', 'mock']);
const createSchema = z.object({
  name: z.string().trim().min(1).max(100),
  provider,
  baseUrl: z.string().url().optional(),
  model: z.string().trim().min(1).max(200),
  apiKey: z.string().min(1).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  monthlyTokenLimit: z.number().int().positive().nullable().optional(),
}).strict();
const updateSchema = createSchema.partial();
function configId(req) { if (!id.safeParse(req.params.id).success) throw httpError(404, 'Proveedor no encontrado'); return req.params.id; }
const testRate = new Map();
function rateLimitTest(req, _res, next) {
  const now = Date.now();
  const key = `${req.orgId}:${req.user.id}`;
  const recent = (testRate.get(key) || []).filter((time) => now - time < 60000);
  if (recent.length >= 10) return next(httpError(429, 'Demasiadas verificaciones de proveedor'));
  recent.push(now); testRate.set(key, recent); return next();
}

router.use(requireRole('OWNER', 'ADMIN'));
router.post('/', asyncHandler(async (req, res) => res.status(201).json(await service.createConfig(req.orgId, req.user.id, createSchema.parse(req.body)))));
router.get('/', asyncHandler(async (req, res) => res.json(await service.listConfigs(req.orgId))));
router.patch('/organization/private-hosts', requireRole('OWNER'), asyncHandler(async (req, res) => {
  const input = z.object({ allowPrivateHosts: z.boolean() }).strict().parse(req.body);
  res.json(await service.updatePrivateHosts(req.orgId, input.allowPrivateHosts));
}));
router.get('/:id', asyncHandler(async (req, res) => res.json((() => {
  const item = service.getConfig(req.orgId, configId(req));
  return item.then(({ apiKeyEncrypted, ...safe }) => ({ ...safe, hasApiKey: Boolean(apiKeyEncrypted) }));
})())));
router.patch('/:id', asyncHandler(async (req, res) => res.json(await service.updateConfig(req.orgId, configId(req), updateSchema.parse(req.body)))));
router.delete('/:id', asyncHandler(async (req, res) => { await service.deleteConfig(req.orgId, configId(req)); res.status(204).send(); }));
router.post('/:id/test', rateLimitTest, asyncHandler(async (req, res) => res.json(await service.testConfig(req.orgId, configId(req)))));
router.post('/:id/set-default', asyncHandler(async (req, res) => res.json(await service.setDefault(req.orgId, configId(req)))));

export default router;
