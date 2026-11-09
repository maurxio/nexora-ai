CREATE TYPE "ExecutionStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "StepStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED');

CREATE TABLE "WorkflowExecution" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "workflowId" UUID NOT NULL,
  "workflowVersionId" UUID NOT NULL,
  "status" "ExecutionStatus" NOT NULL DEFAULT 'QUEUED',
  "input" JSONB NOT NULL,
  "error" TEXT,
  "idempotencyKey" TEXT,
  "triggeredById" UUID,
  "lockedUntil" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkflowExecution_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ExecutionStep" (
  "id" UUID NOT NULL,
  "executionId" UUID NOT NULL,
  "nodeId" TEXT NOT NULL,
  "nodeType" TEXT NOT NULL,
  "status" "StepStatus" NOT NULL,
  "attempt" INTEGER NOT NULL,
  "output" JSONB,
  "error" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "ExecutionStep_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WorkflowExecution_organizationId_idempotencyKey_key" ON "WorkflowExecution"("organizationId", "idempotencyKey");
CREATE INDEX "WorkflowExecution_organizationId_createdAt_idx" ON "WorkflowExecution"("organizationId", "createdAt");
CREATE INDEX "WorkflowExecution_status_idx" ON "WorkflowExecution"("status");
CREATE INDEX "ExecutionStep_executionId_idx" ON "ExecutionStep"("executionId");
ALTER TABLE "WorkflowExecution" ADD CONSTRAINT "WorkflowExecution_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowExecution" ADD CONSTRAINT "WorkflowExecution_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowExecution" ADD CONSTRAINT "WorkflowExecution_workflowVersionId_fkey" FOREIGN KEY ("workflowVersionId") REFERENCES "WorkflowVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExecutionStep" ADD CONSTRAINT "ExecutionStep_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "WorkflowExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
