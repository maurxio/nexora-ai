CREATE TYPE "ConnectorType" AS ENUM ('HTTP', 'WEBHOOK', 'CUSTOM');
CREATE TYPE "AuthType" AS ENUM ('NONE', 'API_KEY', 'BEARER', 'BASIC');
CREATE TYPE "WebhookEventStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED');
CREATE TYPE "IntegrationDirection" AS ENUM ('OUTBOUND', 'INBOUND');

CREATE TABLE "Connector" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "type" "ConnectorType" NOT NULL,
  "baseUrl" TEXT,
  "authType" "AuthType" NOT NULL DEFAULT 'NONE',
  "encryptedCredentials" TEXT,
  "defaultHeaders" JSONB NOT NULL DEFAULT '{}',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Connector_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "WebhookEndpoint" (
  "id" UUID NOT NULL, "companyId" UUID NOT NULL, "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL, "secretHash" TEXT NOT NULL, "encryptedSecret" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastReceivedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "WebhookEvent" (
  "id" UUID NOT NULL, "companyId" UUID NOT NULL, "endpointId" UUID NOT NULL,
  "headers" JSONB NOT NULL, "body" JSONB NOT NULL, "signatureValid" BOOLEAN NOT NULL,
  "status" "WebhookEventStatus" NOT NULL DEFAULT 'RECEIVED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "WebhookSubscription" (
  "id" UUID NOT NULL, "companyId" UUID NOT NULL, "url" TEXT NOT NULL,
  "eventTypes" TEXT[] NOT NULL, "encryptedSecret" TEXT NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebhookSubscription_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "IntegrationLog" (
  "id" UUID NOT NULL, "companyId" UUID NOT NULL, "connectorId" UUID,
  "direction" "IntegrationDirection" NOT NULL, "method" TEXT NOT NULL, "url" TEXT NOT NULL,
  "requestHeaders" JSONB NOT NULL, "statusCode" INTEGER, "durationMs" INTEGER NOT NULL,
  "success" BOOLEAN NOT NULL, "errorMessage" TEXT, "attempt" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IntegrationLog_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Connector_companyId_name_key" ON "Connector"("companyId", "name");
CREATE INDEX "Connector_companyId_createdAt_idx" ON "Connector"("companyId", "createdAt");
CREATE INDEX "Connector_companyId_id_idx" ON "Connector"("companyId", "id");
CREATE UNIQUE INDEX "WebhookEndpoint_slug_key" ON "WebhookEndpoint"("slug");
CREATE INDEX "WebhookEndpoint_companyId_createdAt_idx" ON "WebhookEndpoint"("companyId", "createdAt");
CREATE INDEX "WebhookEvent_companyId_createdAt_idx" ON "WebhookEvent"("companyId", "createdAt");
CREATE INDEX "WebhookEvent_endpointId_status_createdAt_idx" ON "WebhookEvent"("endpointId", "status", "createdAt");
CREATE INDEX "WebhookSubscription_companyId_createdAt_idx" ON "WebhookSubscription"("companyId", "createdAt");
CREATE INDEX "IntegrationLog_companyId_createdAt_idx" ON "IntegrationLog"("companyId", "createdAt");
CREATE INDEX "IntegrationLog_companyId_connectorId_idx" ON "IntegrationLog"("companyId", "connectorId");
ALTER TABLE "Connector" ADD CONSTRAINT "Connector_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Connector" ADD CONSTRAINT "Connector_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "WebhookEndpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebhookSubscription" ADD CONSTRAINT "WebhookSubscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationLog" ADD CONSTRAINT "IntegrationLog_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationLog" ADD CONSTRAINT "IntegrationLog_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "Connector"("id") ON DELETE SET NULL ON UPDATE CASCADE;
