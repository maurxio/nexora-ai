import dns from 'node:dns/promises';
import net from 'node:net';

const privateRanges = [
  /^127\./, /^10\./, /^169\.254\./, /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./, /^0\./,
];
function rejected(message) {
  const error = new Error(message);
  error.retryable = false;
  return error;
}

export function isPrivateAddress(address) {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, '');
  if (net.isIPv4(normalized)) return privateRanges.some((range) => range.test(normalized));
  if (net.isIPv6(normalized)) {
    if (normalized.startsWith('::ffff:')) return isPrivateAddress(normalized.slice(7));
    return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') ||
      normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
      normalized.startsWith('fea') || normalized.startsWith('feb') || normalized === '::';
  }
  return true;
}

export async function assertSafeUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw rejected('URL inválida'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw rejected('Solo se permiten URLs HTTP y HTTPS');
  const addresses = await dns.lookup(url.hostname, { all: true });
  if (!addresses.length) throw rejected('El hostname no resuelve');
  if (process.env.ALLOW_PRIVATE_HOSTS !== 'true' && addresses.some(({ address }) => isPrivateAddress(address))) {
    throw rejected('La URL apunta a una red privada o reservada');
  }
  return url;
}

export function timeoutSignal(timeoutMs) {
  return AbortSignal.timeout(Math.min(Math.max(Number(timeoutMs) || 10000, 1), 30000));
}
