import prisma from '../infrastructure/prisma.js';
import { asyncHandler } from '../utils.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const tenant = asyncHandler(async (req, res, next) => {
  if (!uuidPattern.test(req.params.orgId)) {
    return res.status(403).json({ error: 'No perteneces a esta organización' });
  }

  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: req.user.id,
        organizationId: req.params.orgId,
      },
    },
  });

  if (!membership) return res.status(403).json({ error: 'No perteneces a esta organización' });
  req.orgId = membership.organizationId;
  req.role = membership.role;
  next();
});
