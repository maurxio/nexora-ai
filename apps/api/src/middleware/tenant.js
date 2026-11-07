import prisma from '../infrastructure/prisma.js';
import { asyncHandler } from '../utils.js';

export const tenant = asyncHandler(async (req, res, next) => {
  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: req.user.id,
        organizationId: req.params.orgId,
      },
    },
  });

  if (!membership) return res.status(403).json({ error: 'Acceso denegado a la organización' });
  req.orgId = membership.organizationId;
  req.role = membership.role;
  next();
});
