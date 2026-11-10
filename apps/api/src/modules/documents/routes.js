import { Router } from 'express';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import crypto from 'node:crypto';
import path from 'node:path';
import { asyncHandler, httpError } from '../../utils.js';
import prisma from '../../infrastructure/prisma.js';
import { enqueueDocumentProcessing } from '../../infrastructure/queue.js';
import { storage } from './storage.js';
import { correctionSchema, documentIdSchema, listSchema } from './schemas.js';
import { hashBuffer } from './pipeline.js';
import { validateExtractedData } from './rules.js';

const router = Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: Number(process.env.DOCUMENT_UPLOAD_MAX_BYTES || 15728640), files: 1 } });
const allowed = new Set(['application/pdf', 'image/png', 'image/jpeg']);
const rate = new Map();
function rateLimit(req, res, next) {
  const key = `${req.user.id}:${req.orgId}`;
  const now = Date.now();
  const current = rate.get(key) || { start: now, count: 0 };
  if (now - current.start > Number(process.env.DOCUMENT_RATE_LIMIT_WINDOW_MS || 900000)) { current.start = now; current.count = 0; }
  current.count += 1; rate.set(key, current);
  if (current.count > Number(process.env.DOCUMENT_RATE_LIMIT_MAX || 30)) return res.status(429).json({ error: 'Límite de carga excedido' });
  next();
}
const safeName = (name) => path.basename(name).replace(/[^\w.\- ]/g, '_').slice(0, 255) || 'document';
const publicDocument = (document) => ({ ...document, ocrText: undefined });

router.post('/', rateLimit, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw httpError(422, 'El campo file es requerido');
  const detected = await fileTypeFromBuffer(req.file.buffer);
  if (!detected || !allowed.has(detected.mime)) throw httpError(415, 'Tipo de archivo no permitido');
  const sha256 = hashBuffer(req.file.buffer);
  const existing = await prisma.document.findUnique({ where: { empresaId_sha256: { empresaId: req.orgId, sha256 } } });
  if (existing) return res.status(200).json({ document: publicDocument(existing), duplicate: true });
  const ext = detected.ext === 'jpeg' ? 'jpg' : detected.ext;
  const storageKey = `${req.orgId}/${new Date().getUTCFullYear()}/${String(new Date().getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`;
  await storage.save(storageKey, req.file.buffer);
  try {
    const document = await prisma.document.create({ data: { empresaId: req.orgId, uploadedById: req.user.id, originalName: safeName(req.file.originalname), mimeType: detected.mime, sizeBytes: req.file.size, sha256, storageKey, status: 'QUEUED' } });
    await enqueueDocumentProcessing(document.id);
    return res.status(202).json({ document: publicDocument(document), duplicate: false });
  } catch (error) {
    await storage.delete(storageKey);
    throw error;
  }
}));

router.get('/', asyncHandler(async (req, res) => {
  const query = listSchema.parse(req.query);
  const where = { empresaId: req.orgId, ...(query.status ? { status: query.status } : {}), ...(query.docType ? { docType: query.docType } : {}), ...((query.from || query.to) ? { createdAt: { ...(query.from ? { gte: query.from } : {}), ...(query.to ? { lte: query.to } : {}) } } : {}) };
  const [documents, total] = await prisma.$transaction([prisma.document.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit }), prisma.document.count({ where })]);
  res.json({ data: documents.map(publicDocument), pagination: { page: query.page, limit: query.limit, total } });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = documentIdSchema.parse(req.params);
  const document = await prisma.document.findFirst({ where: { id, empresaId: req.orgId }, include: { validations: { orderBy: { createdAt: 'asc' } } } });
  if (!document) throw httpError(404, 'Documento no encontrado');
  res.json({ document: publicDocument(document) });
}));

router.get('/:id/file', asyncHandler(async (req, res) => {
  const { id } = documentIdSchema.parse(req.params);
  const document = await prisma.document.findFirst({ where: { id, empresaId: req.orgId } });
  if (!document) throw httpError(404, 'Documento no encontrado');
  const buffer = await storage.read(document.storageKey);
  res.type(document.mimeType).set('Content-Disposition', `attachment; filename="${document.originalName.replace(/["\\\r\n]/g, '_')}"`).send(buffer);
}));

router.post('/:id/reprocess', asyncHandler(async (req, res) => {
  const { id } = documentIdSchema.parse(req.params);
  const document = await prisma.document.updateMany({ where: { id, empresaId: req.orgId }, data: { status: 'QUEUED', errorMessage: null } });
  if (!document.count) throw httpError(404, 'Documento no encontrado');
  await enqueueDocumentProcessing(id);
  res.status(202).json({ status: 'QUEUED' });
}));

router.patch('/:id/extracted-data', asyncHandler(async (req, res) => {
  const { id } = documentIdSchema.parse(req.params);
  const body = correctionSchema.parse(req.body);
  const document = await prisma.document.findFirst({ where: { id, empresaId: req.orgId } });
  if (!document) throw httpError(404, 'Documento no encontrado');
  const validations = validateExtractedData(document.docType, body.extractedData);
  const status = validations.some((item) => !item.passed && item.severity === 'ERROR') ? 'NEEDS_REVIEW' : 'VALIDATED';
  const result = await prisma.$transaction([
    prisma.documentCorrection.create({ data: { documentId: id, userId: req.user.id, previousData: document.extractedData || {}, newData: body.extractedData } }),
    prisma.documentValidation.deleteMany({ where: { documentId: id } }),
    prisma.document.update({ where: { id }, data: { extractedData: body.extractedData, status, processedAt: new Date() } }),
    prisma.documentValidation.createMany({ data: validations.map((item) => ({ ...item, documentId: id })) }),
  ]);
  res.json({ document: publicDocument(result[2]), validations });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = documentIdSchema.parse(req.params);
  const document = await prisma.document.findFirst({ where: { id, empresaId: req.orgId } });
  if (!document) throw httpError(404, 'Documento no encontrado');
  await prisma.document.delete({ where: { id } });
  await storage.delete(document.storageKey);
  res.status(204).end();
}));

export default router;
