import { normalizeColombianNumber } from './rules.js';

const match = (text, expression) => text.match(expression)?.[1]?.trim();
export function extractFields(docType, text) {
  if (docType === 'INVOICE') {
    const data = {
      invoiceNumber: match(text, /(?:factura|invoice)\s*(?:n[roº.]?|#)?\s*[:\-]?\s*([A-Z0-9-]+)/i),
      issueDate: match(text, /(?:fecha|date)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})/i),
      issuerNit: match(text, /\bNIT\s*[:\-]?\s*([\d.\- ]+-?\d)\b/i),
      issuerName: match(text, /(?:raz[oó]n social|emisor)\s*[:\-]?\s*([^\n]+)/i),
      subtotal: normalizeColombianNumber(match(text, /subtotal\s*[:\-]?\s*\$?\s*([\d.,]+)/i)),
      vat: normalizeColombianNumber(match(text, /(?:iva|impuesto)\s*[:\-]?\s*\$?\s*([\d.,]+)/i)),
      total: normalizeColombianNumber(match(text, /total\s*[:\-]?\s*\$?\s*([\d.,]+)/i)),
      currency: match(text, /(?:moneda|currency)\s*[:\-]?\s*([A-Z]{3})/i) || 'COP',
    };
    if (data.issueDate && /^\d{1,2}[/-]/.test(data.issueDate)) {
      const [day, month, year] = data.issueDate.split(/[/-]/);
      data.issueDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return data;
  }
  if (docType === 'ID_DOCUMENT') return {
    documentNumber: match(text, /(?:documento|c[ée]dula|identificaci[oó]n)\s*(?:n[roº.]?)?\s*[:\-]?\s*([0-9A-Z-]+)/i),
    names: match(text, /(?:nombres?|name)\s*[:\-]?\s*([^\n]+)/i),
    birthDate: match(text, /(?:fecha de nacimiento|birth date)\s*[:\-]?\s*(\d{4}-\d{2}-\d{2})/i),
  };
  return { textLength: text.length };
}
