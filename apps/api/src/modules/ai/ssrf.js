import dns from 'node:dns/promises';
import net from 'node:net';

export function isPrivateAddress(address) {
  const value = address.toLowerCase().replace(/^\[|\]$/g, '');
  if (net.isIPv4(value)) {
    const [a, b] = value.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  if (net.isIPv6(value)) {
    return value === '::1' || value === '::' || value.startsWith('fc') ||
      value.startsWith('fd') || value.startsWith('fe8') || value.startsWith('fe9') ||
      value.startsWith('fea') || value.startsWith('feb') || value.startsWith('::ffff:10.') ||
      value.startsWith('::ffff:192.168.');
  }
  return true;
}

export async function assertSafeUrl(value, { allowPrivateHosts = false } = {}) {
  let url;
  try { url = new URL(value); } catch { throw new Error('URL inválida'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Solo se permiten URLs HTTP y HTTPS');
  const addresses = net.isIP(url.hostname) ? [{ address: url.hostname }] : await dns.lookup(url.hostname, { all: true });
  if (!addresses.length) throw new Error('El hostname no resuelve');
  if (!allowPrivateHosts && addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error('La URL apunta a una red privada o reservada');
  }
  return { url, addresses: addresses.map(({ address }) => address) };
}

export async function fetchSafe(url, options = {}, policy = {}, redirects = 0) {
  if (redirects > 3) throw new Error('Se excedió el máximo de redirecciones');
  const { url: safeUrl } = await assertSafeUrl(url, policy);
  const response = await fetch(safeUrl, { ...options, redirect: 'manual' });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get('location');
    if (!location) throw new Error('Redirección sin destino');
    const next = new URL(location, safeUrl).toString();
    return fetchSafe(next, options, policy, redirects + 1);
  }
  return response;
}
