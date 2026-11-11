import prisma from '../../infrastructure/prisma.js';
import { cached } from '../../infrastructure/redis.js';

const types = ['WORKFLOW', 'INTEGRATION', 'DOCUMENT', 'APPROVAL'];

export function p95(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1];
}

export function parseRange(query) {
  const end = query.to ? new Date(query.to) : new Date();
  const start = query.from ? new Date(query.from) : new Date(end.getTime() - 30 * 86400000);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || start > end) throw new Error('Rango de fechas inválido');
  if (end - start > 180 * 86400000) throw new Error('El rango máximo es de 180 días');
  return { start, end };
}

function key(tenantId, name, query) {
  return `analytics:${tenantId}:${name}:${JSON.stringify(query)}`;
}

export function overview(tenantId, query) {
  const { start, end } = parseRange(query);
  return cached(key(tenantId, 'overview', query), 60, async () => {
    const where = { tenantId, createdAt: { gte: start, lte: end } };
    const [aggregate, p95, pendingApprovals, documentsProcessed] = await Promise.all([
      prisma.executionMetric.aggregate({ where, _count: { _all: true }, _avg: { durationMs: true } }),
      prisma.$queryRaw`SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs") AS value FROM "ExecutionMetric" WHERE "tenantId" = ${tenantId}::uuid AND "createdAt" >= ${start} AND "createdAt" <= ${end}`,
      prisma.approval.count({ where: { companyId: tenantId, status: 'PENDING' } }),
      prisma.document.count({ where: { empresaId: tenantId, processedAt: { gte: start, lte: end } } }),
    ]);
    const success = await prisma.executionMetric.count({ where: { ...where, status: 'SUCCESS' } });
    const total = aggregate._count._all;
    return { totalExecutions: total, successRate: total ? success / total : 0, averageDurationMs: aggregate._avg.durationMs || 0, p95DurationMs: Number(p95[0]?.value || 0), pendingApprovals, documentsProcessed };
  });
}

export function timeseries(tenantId, query) {
  const { start, end } = parseRange(query);
  return cached(key(tenantId, 'timeseries', query), 60, () => prisma.dailyStats.findMany({
    where: { tenantId, date: { gte: start, lte: end }, ...(query.type ? { type: query.type } : {}) },
    orderBy: [{ date: 'asc' }, { type: 'asc' }],
  }).then((rows) => rows.map((row) => ({ ...row, totalDurationMs: Number(row.totalDurationMs) }))));
}

export function topErrors(tenantId, query) {
  const { start, end } = parseRange(query);
  return cached(key(tenantId, 'top-errors', query), 60, () => (
    prisma.executionMetric.groupBy({
      by: ['errorCode'],
      where: { tenantId, status: { in: ['ERROR', 'TIMEOUT'] }, errorCode: { not: null }, createdAt: { gte: start, lte: end } },
      _count: { _all: true },
      orderBy: { _count: { errorCode: 'desc' } },
      take: 10,
    }).then(async (groups) => Promise.all(groups.map(async (group) => ({
      errorCode: group.errorCode,
      count: group._count._all,
      lastOccurred: (await prisma.executionMetric.findFirst({ where: { tenantId, errorCode: group.errorCode, createdAt: { gte: start, lte: end } }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }))?.createdAt || null,
    }))))
  ));
}

export { types };
