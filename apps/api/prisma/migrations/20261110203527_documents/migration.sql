-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'QUEUED', 'PROCESSING', 'EXTRACTED', 'VALIDATED', 'NEEDS_REVIEW', 'FAILED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('INVOICE', 'ID_DOCUMENT', 'GENERIC', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ValidationSeverity" AS ENUM ('ERROR', 'WARNING');

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "empresaId" UUID NOT NULL,
    "uploadedById" UUID NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "docType" "DocumentType" NOT NULL DEFAULT 'UNKNOWN',
    "pageCount" INTEGER,
    "ocrText" TEXT,
    "ocrConfidence" DOUBLE PRECISION,
    "extractedData" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentValidation" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "rule" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "severity" "ValidationSeverity" NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentValidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentCorrection" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "previousData" JSONB NOT NULL,
    "newData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Document_empresaId_status_idx" ON "Document"("empresaId", "status");

-- CreateIndex
CREATE INDEX "Document_empresaId_createdAt_idx" ON "Document"("empresaId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Document_empresaId_sha256_key" ON "Document"("empresaId", "sha256");

-- CreateIndex
CREATE INDEX "DocumentValidation_documentId_createdAt_idx" ON "DocumentValidation"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentCorrection_documentId_createdAt_idx" ON "DocumentCorrection"("documentId", "createdAt");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentValidation" ADD CONSTRAINT "DocumentValidation_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCorrection" ADD CONSTRAINT "DocumentCorrection_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentCorrection" ADD CONSTRAINT "DocumentCorrection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
