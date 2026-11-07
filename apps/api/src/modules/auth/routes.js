import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../../infrastructure/prisma.js';
import { asyncHandler, httpError } from '../../utils.js';
import { authenticate } from '../../middleware/auth.js';

const router = Router({ mergeParams: true });

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
const registerSchema = credentialsSchema.extend({ name: z.string().trim().min(1) });
const refreshSchema = z.object({ refreshToken: z.string().min(1) });

function accessToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '15m' });
}

async function issueRefreshToken(userId) {
  const raw = crypto.randomBytes(48).toString('base64url');
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: crypto.createHash('sha256').update(raw).digest('hex'),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  return raw;
}

function authResponse(user, refreshToken) {
  return {
    user: { id: user.id, email: user.email, name: user.name },
    accessToken: accessToken(user.id),
    refreshToken,
  };
}

router.post('/register', asyncHandler(async (req, res) => {
  const input = registerSchema.parse(req.body);
  const email = input.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw httpError(409, 'El correo ya está registrado');

  const user = await prisma.user.create({
    data: { email, name: input.name, passwordHash: await bcrypt.hash(input.password, 12) },
  });
  const refreshToken = await issueRefreshToken(user.id);
  res.status(201).json(authResponse(user, refreshToken));
}));

router.post('/login', asyncHandler(async (req, res) => {
  const input = credentialsSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  const valid = user && await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw httpError(401, 'Credenciales inválidas');
  res.json(authResponse(user, await issueRefreshToken(user.id)));
}));

router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = refreshSchema.parse(req.body);
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash }, include: { user: true } });
  if (!stored || stored.revokedAt || stored.expiresAt <= new Date()) {
    throw httpError(401, 'Refresh token inválido o expirado');
  }
  const nextRefreshToken = await prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    const raw = crypto.randomBytes(48).toString('base64url');
    await tx.refreshToken.create({
      data: {
        userId: stored.userId,
        tokenHash: crypto.createHash('sha256').update(raw).digest('hex'),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
    return raw;
  });
  res.json(authResponse(stored.user, nextRefreshToken));
}));

router.post('/logout', asyncHandler(async (req, res) => {
  const { refreshToken } = refreshSchema.parse(req.body);
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  await prisma.refreshToken.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
  res.status(204).send();
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, email: true, name: true, memberships: { select: { organizationId: true, role: true } } },
  });
  if (!user) throw httpError(401, 'No autenticado');
  res.json(user);
}));

export default router;
