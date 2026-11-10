export function classifyDocument(text = '') {
  const value = text.toLowerCase();
  const scores = {
    INVOICE: (value.match(/\b(factura|iva|subtotal|total|nit|vencimiento)\b/g) || []).length,
    ID_DOCUMENT: (value.match(/\b(cédula|cedula|documento de identidad|fecha de nacimiento|apellidos)\b/g) || []).length,
  };
  if (!scores.INVOICE && !scores.ID_DOCUMENT) return 'GENERIC';
  return scores.INVOICE >= scores.ID_DOCUMENT ? 'INVOICE' : 'ID_DOCUMENT';
}
