import prisma from '../infrastructure/prisma.js';
import { logger } from '../infrastructure/logger.js';

const retention = (name, fallback) => Math.max(1, Number(process.env[name] || fallback));

export async function recordExecutionMetric({ tenantId, type, referenceId, status, durationMs, errorCode }) {
  try {
    return await prisma.executionMetric.create({ data: { tenantId, type, referenceId, status, durationMs: Math.max(0, Math.round(durationMs)), errorCode } });
  } catch (error) {
    logger.error({ err: error, tenantId, type, referenceId }, 'execution metric failed');
    return null;
  }
}

export async function aggregateDailyStats() {
  const day = new Date();
  day.setUTCHours(0, 0, 0, 0);
  const rows = await prisma.$queryRaw`
    SELECT "tenantId", "type",
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE "status" = 'SUCCESS')::int AS "successCount",
      COUNT(*) FILTER (WHERE "status" = 'ERROR')::int AS "errorCount",
      COUNT(*) FILTER (WHERE "status" = 'TIMEOUT')::int AS "timeoutCount",
      COALESCE(SUM("durationMs"), 0)::bigint AS "totalDurationMs",
      percentile_cont(0.95) WITHIN GROUP (ORDER BY "durationMs")::int AS "p95DurationMs"
    FROM "ExecutionMetric"
    WHERE "createdAt" >= ${day} AND "createdAt" < ${new Date(day.getTime() + 86400000)}
    GROUP BY "tenantId", "type"
  `;
  for (const row of rows) {
    await prisma.dailyStats.upsert({
      where: { tenantId_date_type: { tenantId: row.tenantId, date: day, type: row.type } },
      create: { tenantId: row.tenantId, date: day, type: row.type, total: row.total, successCount: row.successCount, errorCount: row.errorCount, timeoutCount: row.timeoutCount, totalDurationMs: row.totalDurationMs, p95DurationMs: row.p95DurationMs },
      update: { total: row.total, successCount: row.successCount, errorCount: row.errorCount, timeoutCount: row.timeoutCount, totalDurationMs: row.totalDurationMs, p95DurationMs: row.p95DurationMs },
    });
  }
}

async function deleteInBatches(model, where) {
  let deleted = 0;
  while (true) {
    const batch = await model.findMany({ where, take: 1000, select: { id: true } });
    if (!batch.length) return deleted;
    const result = await model.deleteMany({ where: { id: { in: batch.map(({ id }) => id) } } });
    deleted += result.count;
  }
}

export async function retainObservabilityData() {
  const metricsBefore = new Date(Date.now() - retention('METRICS_RETENTION_DAYS', 90) * 86400000);
  const auditBefore = new Date(Date.now() - retention('AUDIT_RETENTION_DAYS', 365) * 86400000);
  await deleteInBatches(prisma.executionMetric, { createdAt: { lt: metricsBefore } });
  await deleteInBatches(prisma.auditLog, { createdAt: { lt: auditBefore } });
}
