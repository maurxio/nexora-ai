import { Router } from 'express';
import { z } from 'zod';
import prisma from '../../infrastructure/prisma.js';
import { asyncHandler, httpError } from '../../utils.js';
import { requireRole } from '../../middleware/rbac.js';
import { tenant } from '../../middleware/tenant.js';
import crypto from 'node:crypto';
import { auditRequest } from '../../infrastructure/audit.js';

const router = Router({ mergeParams: true });

const organizationSchema = z.object({
  name: z.string().trim().min(2).max(100),
}).strict();
const memberSchema = z.object({ email: z.string().email(), role: z.enum(['ADMIN', 'OPERATOR', 'AUDITOR']).default('OPERATOR') });
const roleSchema = z.object({ role: z.enum(['ADMIN', 'OPERATOR', 'AUDITOR']) });

function slugify(name) {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'org';
}

router.post('/', asyncHandler(async (req, res) => {
  const input = organizationSchema.parse(req.body);
  const organization = await prisma.organization.create({
    data: {
      name: input.name,
      slug: `${slugify(input.name)}-${crypto.randomBytes(2).toString('hex')}`,
      memberships: { create: { userId: req.user.id, role: 'ADMIN' } },
    },
  });
  res.status(201).json({ ...organization, role: 'ADMIN' });
}));

router.get('/', asyncHandler(async (req, res) => {
  const memberships = await prisma.membership.findMany({
    where: { userId: req.user.id },
    include: { organization: true },
  });
  res.json(memberships.map(({ organization, role }) => ({ ...organization, role })));
}));

router.get('/:orgId', tenant, asyncHandler(async (req, res) => {
  const organization = await prisma.organization.findUnique({ where: { id: req.params.orgId } });
  if (!organization) throw httpError(404, 'Organización no encontrada');
  res.json(organization);
}));

router.get('/:orgId/members', tenant, asyncHandler(async (req, res) => {
  const members = await prisma.membership.findMany({
    where: { organizationId: req.params.orgId },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  res.json(members);
}));

router.post('/:orgId/members', tenant, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const input = memberSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (!user) throw httpError(404, 'Usuario no encontrado');
  const membership = await prisma.membership.create({
    data: { organizationId: req.params.orgId, userId: user.id, role: input.role },
  });
  res.status(201).json(membership);
}));

router.patch('/:orgId/members/:userId', tenant, requireRole('ADMIN'), asyncHandler(async (req, res) => {
  const input = roleSchema.parse(req.body);
  const target = await prisma.membership.findUnique({
    where: { userId_organizationId: { userId: req.params.userId, organizationId: req.params.orgId } },
  });
  if (!target) throw httpError(404, 'Membresía no encontrada');
  if (target.role === 'ADMIN' && input.role !== 'ADMIN') {
    const admins = await prisma.membership.count({ where: { organizationId: req.params.orgId, role: 'ADMIN' } });
    if (admins <= 1) throw httpError(400, 'La organización debe tener al menos un administrador');
  }
  const updated = await prisma.membership.update({
    where: { userId_organizationId: { userId: req.params.userId, organizationId: req.params.orgId } },
    data: { role: input.role },
  });
  await auditRequest(req, 'ROLE_CHANGED', 'Membership', `${req.params.userId}:${req.params.orgId}`, { role: input.role });
  res.json(updated);
}));

export default router;
