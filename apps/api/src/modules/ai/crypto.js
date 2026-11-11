import crypto from 'node:crypto';
import { assertAiConfiguration } from './config.js';

const VERSION = 'v1';
function key() {
  const secret = assertAiConfiguration().AI_KEY_ENCRYPTION_SECRET;
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptApiKey(value) {
  if (typeof value !== 'string' || !value) throw new TypeError('La API key debe ser texto');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [VERSION, iv.toString('base64'), cipher.getAuthTag().toString('base64'), ciphertext.toString('base64')].join('.');
}

export function decryptApiKey(value) {
  try {
    const [version, ivText, tagText, ciphertextText] = value.split('.');
    if (version !== VERSION) throw new Error('unsupported version');
    const iv = Buffer.from(ivText, 'base64');
    const tag = Buffer.from(tagText, 'base64');
    const ciphertext = Buffer.from(ciphertextText, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    throw new Error('No se pudo descifrar la API key');
  }
}
