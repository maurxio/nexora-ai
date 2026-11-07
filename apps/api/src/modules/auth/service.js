import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import prisma from '../../infrastructure/prisma.js';

const refreshTokenDays = Number(process.env.REFRESH_TOKEN_DAYS || 7);

export function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export function accessToken(userId) {
  return jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' },
  );
}

export function refreshTokenHash(refreshToken) {
  return crypto.createHash('sha256').update(refreshToken).digest('hex');
}

function newRefreshToken() {
  return crypto.randomBytes(48).toString('hex');
}

function refreshTokenExpiresAt() {
  return new Date(Date.now() + refreshTokenDays * 24 * 60 * 60 * 1000);
}

export async function issueRefreshToken(userId) {
  const raw = newRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: refreshTokenHash(raw),
      expiresAt: refreshTokenExpiresAt(),
    },
  });
  return raw;
}

export async function rotateRefreshToken(tokenId, userId) {
  const raw = newRefreshToken();
  await prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({ where: { id: tokenId }, data: { revokedAt: new Date() } });
    await tx.refreshToken.create({
      data: {
        userId,
        tokenHash: refreshTokenHash(raw),
        expiresAt: refreshTokenExpiresAt(),
      },
    });
  });
  return raw;
}
