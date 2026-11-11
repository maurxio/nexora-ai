-- CreateEnum
CREATE TYPE "AiProvider" AS ENUM ('openai_compatible', 'anthropic', 'gemini', 'mock');

-- CreateEnum
CREATE TYPE "AiProviderStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "AiUsageStatus" AS ENUM ('SUCCESS', 'ERROR', 'TIMEOUT', 'LIMIT_EXCEEDED');

-- AlterEnum
ALTER TYPE "ExecutionStatus" ADD VALUE 'WAITING_APPROVAL';

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'OWNER';

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "allowPrivateHosts" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AiProviderConfig" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "provider" "AiProvider" NOT NULL,
    "baseUrl" TEXT,
    "model" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT,
    "apiKeyLast4" TEXT,
    "status" "AiProviderStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "monthlyTokenLimit" INTEGER,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiProviderConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "id" UUID NOT NULL,
    "orgId" UUID NOT NULL,
    "runId" UUID,
    "configId" UUID NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL,
    "status" "AiUsageStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiProviderConfig_orgId_status_idx" ON "AiProviderConfig"("orgId", "status");

-- CreateIndex
CREATE INDEX "AiProviderConfig_orgId_isDefault_idx" ON "AiProviderConfig"("orgId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "AiProviderConfig_orgId_name_key" ON "AiProviderConfig"("orgId", "name");

-- CreateIndex
CREATE INDEX "AiUsage_orgId_createdAt_idx" ON "AiUsage"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_configId_createdAt_idx" ON "AiUsage"("configId", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsage_runId_idx" ON "AiUsage"("runId");

-- AddForeignKey
ALTER TABLE "AiProviderConfig" ADD CONSTRAINT "AiProviderConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiProviderConfig" ADD CONSTRAINT "AiProviderConfig_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsage" ADD CONSTRAINT "AiUsage_configId_fkey" FOREIGN KEY ("configId") REFERENCES "AiProviderConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
