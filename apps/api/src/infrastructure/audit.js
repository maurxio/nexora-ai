import prisma from './prisma.js';
import { logger } from './logger.js';

export function safeMetadata(metadata = {}) {
  return Object.fromEntries(Object.entries(metadata).filter(([key]) => !/(password|token|secret|credential|payload)/i.test(key)));
}

export const auditService = {
  record({ tenantId, actorId = null, action, entity, entityId = null, metadata = {}, ip = null, userAgent = null }) {
    void prisma.auditLog.create({
      data: { tenantId, actorId, action, entity, entityId, metadata: safeMetadata(metadata), ip, userAgent },
    }).catch((error) => {
      logger.error({ err: error, tenantId, action, entity }, 'audit record failed');
    });
    return undefined;
  },
};

export function auditRequest(req, action, entity, entityId, metadata = {}) {
  return auditService.record({
    tenantId: req.orgId,
    actorId: req.user?.id,
    action,
    entity,
    entityId,
    metadata,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  });
}
