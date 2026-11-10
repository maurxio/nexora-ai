import { z } from 'zod';

const invoice = z.object({
  invoiceNumber: z.string().optional(),
  issueDate: z.string().optional(),
  issuerNit: z.string().optional(),
  issuerName: z.string().optional(),
  subtotal: z.number().optional(),
  vat: z.number().optional(),
  total: z.number().optional(),
  currency: z.string().optional(),
}).passthrough();

const identity = z.object({
  documentNumber: z.string().optional(),
  names: z.string().optional(),
  birthDate: z.string().optional(),
}).passthrough();

export const extractedDataSchemas = { INVOICE: invoice, ID_DOCUMENT: identity, GENERIC: z.record(z.any()), UNKNOWN: z.record(z.any()) };
export const documentIdSchema = z.object({ id: z.string().uuid() });
export const listSchema = z.object({
  status: z.enum(['UPLOADED', 'QUEUED', 'PROCESSING', 'EXTRACTED', 'VALIDATED', 'NEEDS_REVIEW', 'FAILED']).optional(),
  docType: z.enum(['INVOICE', 'ID_DOCUMENT', 'GENERIC', 'UNKNOWN']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export const correctionSchema = z.object({ extractedData: z.record(z.any()) }).strict();
