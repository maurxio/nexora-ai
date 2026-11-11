import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import pdfParse from 'pdf-parse';
import sharp from 'sharp';
import { createWorker } from 'tesseract.js';
import prisma from '../../infrastructure/prisma.js';
import { storage } from './storage.js';
import { classifyDocument } from './classifier.js';
import { extractFields } from './extractor.js';
import { validateExtractedData } from './rules.js';
import { auditService } from '../../infrastructure/audit.js';
import { recordExecutionMetric } from '../../jobs/observability.js';

const execFileAsync = promisify(execFile);

export class OcrEngine {
  async recognize(buffer) {
    const worker = await createWorker('spa+eng');
    try {
      const { data } = await worker.recognize(buffer);
      return { text: data.text, confidence: data.confidence || 0 };
    } finally {
      await worker.terminate();
    }
  }
}

async function preprocess(buffer) {
  return sharp(buffer).grayscale().normalize().resize({ width: 2500, withoutEnlargement: false }).sharpen().png().toBuffer();
}

async function pdfOcr(buffer, tempDir, engine) {
  const source = path.join(tempDir, 'document.pdf');
  await fs.writeFile(source, buffer);
  const prefix = path.join(tempDir, 'page');
  await execFileAsync('pdftoppm', ['-png', '-r', '300', source, prefix]);
  const files = (await fs.readdir(tempDir)).filter((file) => file.startsWith('page-') && file.endsWith('.png')).sort();
  const results = await Promise.all(files.map(async (file) => engine.recognize(await preprocess(await fs.readFile(path.join(tempDir, file))))));
  return { text: results.map((item) => item.text).join('\n'), confidence: results.length ? results.reduce((sum, item) => sum + item.confidence, 0) / results.length : 0, pageCount: files.length };
}

async function extractText(buffer, mimeType, engine) {
  if (mimeType === 'application/pdf') {
    const parsed = await pdfParse(buffer);
    const pageCount = parsed.numpages || 1;
    if (parsed.text.trim().length >= 50 * pageCount) return { text: parsed.text, confidence: 100, pageCount };
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nexora-doc-'));
    try { return await pdfOcr(buffer, tempDir, engine); } finally { await fs.rm(tempDir, { recursive: true, force: true }); }
  }
  const result = await engine.recognize(await preprocess(buffer));
  return { ...result, pageCount: 1 };
}

export async function processDocument(documentId) {
  const started = Date.now();
  const document = await prisma.document.findUnique({ where: { id: documentId } });
  if (!document) return;
  const claimed = await prisma.document.updateMany({ where: { id: documentId, status: { in: ['QUEUED', 'PROCESSING', 'EXTRACTED', 'NEEDS_REVIEW', 'FAILED'] } }, data: { status: 'PROCESSING', errorMessage: null } });
  if (!claimed.count) return;
  try {
    const buffer = await storage.read(document.storageKey);
    const extracted = await extractText(buffer, document.mimeType, new OcrEngine());
    const docType = classifyDocument(extracted.text);
    const data = extractFields(docType, extracted.text);
    const validations = validateExtractedData(docType, data);
    const hasErrors = validations.some((item) => !item.passed && item.severity === 'ERROR');
    const status = !hasErrors && extracted.confidence >= Number(process.env.OCR_MIN_CONFIDENCE || 70) ? 'VALIDATED' : 'NEEDS_REVIEW';
    await prisma.$transaction([
      prisma.documentValidation.deleteMany({ where: { documentId } }),
      prisma.document.update({ where: { id: documentId }, data: { status, docType, pageCount: extracted.pageCount, ocrText: extracted.text, ocrConfidence: extracted.confidence, extractedData: data, processedAt: new Date(), errorMessage: null } }),
      prisma.documentValidation.createMany({ data: validations.map((item) => ({ ...item, documentId })) }),
    ]);
    await recordExecutionMetric({ tenantId: document.empresaId, type: 'DOCUMENT', referenceId: documentId, status: 'SUCCESS', durationMs: Date.now() - started });
    await auditService.record({ tenantId: document.empresaId, action: 'DOCUMENT_PROCESSED', entity: 'Document', entityId: documentId, metadata: { status } });
  } catch (error) {
    await prisma.document.update({ where: { id: documentId }, data: { status: 'FAILED', errorMessage: error.message.slice(0, 1000), processedAt: new Date() } });
    await recordExecutionMetric({ tenantId: document.empresaId, type: 'DOCUMENT', referenceId: documentId, status: 'ERROR', durationMs: Date.now() - started, errorCode: error.code || error.name || 'DOCUMENT_ERROR' });
    throw error;
  }
}

export function hashBuffer(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }
