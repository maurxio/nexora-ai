import { z } from 'zod';
import { extractedDataSchemas } from './schemas.js';

export function normalizeColombianNumber(value) {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return null;
  const clean = value.replace(/[^\d,.-]/g, '').trim();
  if (!clean) return null;
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean.replace(/(?<=\d)\.(?=\d{3}(?:\.|$))/g, '');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value && date <= new Date();
}

export function validNit(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length < 2 || digits.length > 10) return false;
  const body = digits.slice(0, -1);
  const check = Number(digits.at(-1));
  const weights = [71, 67, 59, 53, 47, 43, 41, 37, 29].slice(0, body.length);
  const remainder = body.split('').reduce((sum, digit, index) => sum + Number(digit) * weights[index], 0) % 11;
  return (remainder < 2 ? remainder : 11 - remainder) === check;
}

const result = (rule, field, passed, severity, message) => ({ rule, field, passed, severity, message });
export function validateInvoice(data) {
  const rules = [
    result('required', 'invoiceNumber', Boolean(data.invoiceNumber), 'ERROR', data.invoiceNumber ? 'Número presente' : 'Número de factura requerido'),
    result('nit', 'issuerNit', validNit(data.issuerNit), 'ERROR', validNit(data.issuerNit) ? 'NIT válido' : 'NIT inválido'),
    result('date', 'issueDate', validDate(data.issueDate), 'ERROR', validDate(data.issueDate) ? 'Fecha válida' : 'Fecha inválida o futura'),
    result('required', 'issuerName', Boolean(data.issuerName), 'ERROR', data.issuerName ? 'Razón social presente' : 'Razón social requerida'),
    result('required', 'total', normalizeColombianNumber(data.total) !== null, 'ERROR', data.total ? 'Total presente' : 'Total requerido'),
  ];
  const subtotal = normalizeColombianNumber(data.subtotal);
  const vat = normalizeColombianNumber(data.vat);
  const total = normalizeColombianNumber(data.total);
  if (subtotal !== null && vat !== null && total !== null) {
    const tolerance = Number(process.env.DOCUMENT_TOTAL_TOLERANCE || 0.01);
    rules.push(result('totals_consistency', 'total', Math.abs(subtotal + vat - total) <= tolerance, 'ERROR', Math.abs(subtotal + vat - total) <= tolerance ? 'Subtotal + IVA coincide con total' : 'Subtotal + IVA no coincide con total'));
  }
  return rules;
}

export function validateIdDocument(data) {
  return [
    result('required', 'documentNumber', Boolean(data.documentNumber), 'ERROR', data.documentNumber ? 'Número presente' : 'Número de documento requerido'),
    result('required', 'names', Boolean(data.names), 'ERROR', data.names ? 'Nombres presentes' : 'Nombres requeridos'),
    ...(data.birthDate ? [result('date', 'birthDate', validDate(data.birthDate), 'WARNING', validDate(data.birthDate) ? 'Fecha válida' : 'Fecha inválida o futura')] : []),
  ];
}

export function validateExtractedData(docType, data) {
  const schema = extractedDataSchemas[docType] || extractedDataSchemas.UNKNOWN;
  const parsed = schema.safeParse(data || {});
  if (!parsed.success) return [result('schema', 'extractedData', false, 'ERROR', 'Datos extraídos no cumplen el esquema')];
  if (docType === 'INVOICE') return validateInvoice(parsed.data);
  if (docType === 'ID_DOCUMENT') return validateIdDocument(parsed.data);
  return [];
}
