import prisma from '../../infrastructure/prisma.js';

export async function listNotifications(companyId, userId, query) {
  const where = { companyId, userId, ...(query.unread === 'true' ? { readAt: null } : {}) };
  const [items, total] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit }),
    prisma.notification.count({ where }),
  ]);
  return { items, page: query.page, limit: query.limit, total };
}

export async function markRead(companyId, userId, id) {
  return prisma.notification.updateMany({ where: { id, companyId, userId, readAt: null }, data: { readAt: new Date() } });
}

export function markAllRead(companyId, userId) {
  return prisma.notification.updateMany({ where: { companyId, userId, readAt: null }, data: { readAt: new Date() } });
}

export function unreadCount(companyId, userId) {
  return prisma.notification.count({ where: { companyId, userId, readAt: null } });
}
