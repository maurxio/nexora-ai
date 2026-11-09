import dns from 'node:dns/promises';
import net from 'node:net';
import { resolveTemplates } from '../template.js';

function blocked(address) {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return (a === 127 && process.env.HTTP_NODE_ALLOW_LOOPBACK !== 'true') ||
      a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127) ||
      a === 0 || a >= 224;
  }
  const normalized = address.toLowerCase();
  if (normalized.startsWith('::ffff:') && blocked(normalized.slice(7))) return true;
  return normalized === '::1' || normalized === '::' || normalized.startsWith('fc') ||
    normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
    normalized.startsWith('fea') || normalized.startsWith('feb') || normalized.startsWith('ff');
}

export async function execute(config, context, { signal }) {
  let url;
  try { url = new URL(resolveTemplates(config.url, context)); } catch {
    throw Object.assign(new Error('URL inválida'), { retryable: false });
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw Object.assign(new Error('Destino bloqueado'), { retryable: false });
  const addresses = await dns.lookup(url.hostname, { all: true }).catch(() => {
    throw Object.assign(new Error('No se pudo resolver el destino'), { retryable: true });
  });
  if (addresses.some(({ address }) => blocked(address))) throw Object.assign(new Error('Destino bloqueado'), { retryable: false });
  const headers = resolveTemplates(config.headers || {}, context);
  delete headers.authorization;
  delete headers.Authorization;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, {
      method: config.method || 'GET',
      headers,
      body: config.body === undefined ? undefined : JSON.stringify(resolveTemplates(config.body, context)),
      redirect: 'manual',
      signal: controller.signal,
    }).catch((error) => { throw Object.assign(new Error('Error de red'), { retryable: true, cause: error }); });
    const reader = response.body?.getReader();
    let bytes = 0; let text = '';
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 1024 * 1024) throw Object.assign(new Error('Respuesta demasiado grande'), { retryable: false });
        text += new TextDecoder().decode(value, { stream: true });
      }
    } else text = await response.text();
    let body = text;
    try { body = JSON.parse(text); } catch { body = text.slice(0, 10000); }
    if (response.status >= 500) throw Object.assign(new Error(`HTTP ${response.status}`), { retryable: true });
    if (response.status >= 400) throw Object.assign(new Error(`HTTP ${response.status}`), { retryable: false });
    return { status: response.status, ok: response.ok, body };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}
