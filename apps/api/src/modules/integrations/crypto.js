import crypto from 'node:crypto';

function key() {
  const raw = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!raw) throw new Error('INTEGRATIONS_ENCRYPTION_KEY es obligatoria para el módulo de integraciones');
  const value = Buffer.from(raw, 'base64');
  if (value.length !== 32) throw new Error('INTEGRATIONS_ENCRYPTION_KEY debe ser una clave base64 de 32 bytes');
  return value;
}

export function assertEncryptionKey() {
  key();
}

export function encryptSecret(value) {
  if (typeof value !== 'string') throw new TypeError('El secreto debe ser texto');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64')).join('.');
}

export function decryptSecret(value) {
  try {
    const [iv, tag, encrypted] = value.split('.').map((part) => Buffer.from(part, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('No se pudo descifrar la credencial de integración');
  }
}

export function hashSecret(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function hmac(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}
