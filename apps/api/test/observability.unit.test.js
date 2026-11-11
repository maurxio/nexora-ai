import assert from 'node:assert/strict';
import test from 'node:test';
import { safeMetadata } from '../src/infrastructure/audit.js';
import { p95 } from '../src/modules/analytics/service.js';

test('redacts sensitive audit metadata without retaining payloads', () => {
  const result = safeMetadata({ connectorId: 'c1', password: 'secret', token: 'token', payload: { pii: true } });
  assert.deepEqual(result, { connectorId: 'c1' });
});

test('calculates p95 deterministically', () => {
  assert.equal(p95([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), 10);
  assert.equal(p95([]), 0);
});

test('audit service does not expose sensitive fields through its sanitizer', () => {
  const metadata = safeMetadata({ secretKey: 'x', userId: 'u1', durationMs: 42 });
  assert.deepEqual(metadata, { userId: 'u1', durationMs: 42 });
});
