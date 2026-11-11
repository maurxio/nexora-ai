-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('WORKFLOW', 'INTEGRATION', 'DOCUMENT', 'APPROVAL');

-- CreateEnum
CREATE TYPE "MetricStatus" AS ENUM ('SUCCESS', 'ERROR', 'TIMEOUT');

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionMetric" (
    "id" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "type" "MetricType" NOT NULL,
    "referenceId" TEXT,
    "status" "MetricStatus" NOT NULL,
    "durationMs" INTEGER NOT NULL,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyStats" (
    "tenantId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "type" "MetricType" NOT NULL,
    "total" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "timeoutCount" INTEGER NOT NULL DEFAULT 0,
    "totalDurationMs" BIGINT NOT NULL DEFAULT 0,
    "p95DurationMs" INTEGER,

    CONSTRAINT "DailyStats_pkey" PRIMARY KEY ("tenantId","date","type")
);

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_entity_entityId_idx" ON "AuditLog"("tenantId", "entity", "entityId");

-- CreateIndex
CREATE INDEX "ExecutionMetric_tenantId_createdAt_idx" ON "ExecutionMetric"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "ExecutionMetric_tenantId_type_status_createdAt_idx" ON "ExecutionMetric"("tenantId", "type", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ExecutionMetric_tenantId_errorCode_createdAt_idx" ON "ExecutionMetric"("tenantId", "errorCode", "createdAt");

-- CreateIndex
CREATE INDEX "DailyStats_tenantId_date_idx" ON "DailyStats"("tenantId", "date");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionMetric" ADD CONSTRAINT "ExecutionMetric_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyStats" ADD CONSTRAINT "DailyStats_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
