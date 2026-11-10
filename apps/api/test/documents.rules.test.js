import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyDocument } from '../src/modules/documents/classifier.js';
import { normalizeColombianNumber, validDate, validNit, validateInvoice } from '../src/modules/documents/rules.js';

test('normaliza montos colombianos', () => {
  assert.equal(normalizeColombianNumber('1.234.567,89'), 1234567.89);
  assert.equal(normalizeColombianNumber('1234.50'), 1234.5);
});

test('valida fechas no futuras', () => {
  assert.equal(validDate('2020-02-29'), true);
  assert.equal(validDate('2020-02-30'), false);
  assert.equal(validDate('2999-01-01'), false);
});

test('valida NIT con dígito de verificación', () => {
  assert.equal(validNit('900373913-0'), true);
  assert.equal(validNit('900373913-4'), false);
});

test('clasifica factura por palabras clave', () => {
  assert.equal(classifyDocument('FACTURA Nro 12 NIT IVA SUBTOTAL TOTAL'), 'INVOICE');
});

test('detecta inconsistencia de totales', () => {
  const results = validateInvoice({ invoiceNumber: '12', issuerNit: '900373913-0', issueDate: '2020-01-01', issuerName: 'ACME', subtotal: 100, vat: 19, total: 130 });
  assert.equal(results.find((item) => item.rule === 'totals_consistency').passed, false);
});
