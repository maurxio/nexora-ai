import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateEnv } from '../src/config/env.js';
import { encryptSecret, decryptSecret, hmac } from '../src/modules/integrations/crypto.js';
import { createApprovalSchema } from '../src/modules/approvals/validators.js';
test('environment fails fast on missing secrets and unsafe production origins', () => {
  assert.throws(() => validateEnv({}), /Invalid environment/);
  assert.equal(validateEnv(process.env).NODE_ENV, 'test');
  assert.throws(
    () => validateEnv({ ...process.env, NODE_ENV: 'production' }),
    /Invalid environment/,
  );
});
test('integration encryption authenticates ciphertext; HMAC depends on exact body', () => {
  const encrypted = encryptSecret('credential');
  assert.equal(decryptSecret(encrypted), 'credential');
  const parts = encrypted.split('.');
  parts[1] = Buffer.alloc(16).toString('base64');
  assert.throws(() => decryptSecret(parts.join('.')), /descifrar/);
  assert.notEqual(hmac('{"a":1}', 'key'), hmac('{ "a":1}', 'key'));
});
test('approval validation rejects missing assignees and empty titles', () => {
  assert.equal(
    createApprovalSchema.safeParse({ title: '', assigneeIds: [], payload: {} }).success,
    false,
  );
});
