import crypto from 'node:crypto';
import prisma from '../../infrastructure/prisma.js';
import { enqueueWebhookInbound, enqueueWebhookOutbound } from '../../infrastructure/queue.js';
import { decryptSecret, encryptSecret, hashSecret, hmac } from './crypto.js';
import { assertSafeUrl, timeoutSignal } from './ssrf.js';
import { httpError } from '../../utils.js';
import { auditService } from '../../infrastructure/audit.js';

const sensitive = /authorization|cookie|set-cookie|api[-_]?key|token|secret|password/i;
const defaultHeaders = () => ({ 'content-type': 'application/json' });
const safeHeaders = (headers) => Object.fromEntries(Object.entries(headers || {}).map(([name, value]) => [name, sensitive.test(name) ? '[REDACTED]' : String(value)]));
const publicConnector = ({ encryptedCredentials, ...connector }) => ({ ...connector, hasCredentials: Boolean(encryptedCredentials) });
const publicEndpoint = ({ secretHash, encryptedSecret, ...endpoint }) => endpoint;
const publicSubscription = ({ encryptedSecret, ...subscription }) => ({ ...subscription, hasCredentials: Boolean(encryptedSecret) });
const webhookRate = new Map();
function safeUrl(value) {
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    for (const key of [...url.searchParams.keys()]) if (sensitive.test(key)) url.searchParams.set(key, '[REDACTED]');
    return url.toString();
  } catch { return '[INVALID_URL]'; }
}

function credentials(connector) {
  if (!connector.encryptedCredentials) return {};
  try { return JSON.parse(decryptSecret(connector.encryptedCredentials)); } catch { throw httpError(500, 'Credenciales de conector inválidas'); }
}

function applyAuth(headers, connector) {
  const values = credentials(connector);
  if (connector.authType === 'API_KEY') headers[values.header || 'x-api-key'] = values.value;
  if (connector.authType === 'BEARER') headers.authorization = `Bearer ${values.token}`;
  if (connector.authType === 'BASIC') headers.authorization = `Basic ${Buffer.from(`${values.username}:${values.password}`).toString('base64')}`;
}

async function requestAttempt({ companyId, connectorId, method, url, headers, body, timeoutMs, attempt, redirects = 0 }) {
  const started = Date.now();
  let statusCode = null;
  let errorMessage = null;
  try {
    await assertSafeUrl(url);
    const response = await fetch(url, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual', signal: timeoutSignal(timeoutMs),
    });
    statusCode = response.status;
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) { const error = new Error('Redirección sin destino'); error.retryable = false; throw error; }
      const redirectUrl = new URL(location, url).toString();
      await assertSafeUrl(redirectUrl);
      if (redirects >= 3) { const error = new Error('Se excedió el máximo de redirecciones'); error.retryable = false; throw error; }
      return requestAttempt({ companyId, connectorId, method, url: redirectUrl, headers, body, timeoutMs, attempt, redirects: redirects + 1 });
    }
    const bytes = Number(process.env.HTTP_MAX_RESPONSE_BYTES || 2 * 1024 * 1024);
    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > bytes) throw new Error('La respuesta excede el tamaño máximo');
    const raw = await response.arrayBuffer();
    if (raw.byteLength > bytes) throw new Error('La respuesta excede el tamaño máximo');
    const text = Buffer.from(raw).toString('utf8');
    let responseBody = text;
    if ((response.headers.get('content-type') || '').includes('application/json')) {
      try { responseBody = JSON.parse(text); } catch { /* preserve malformed JSON as text */ }
    }
    await prisma.integrationLog.create({
      data: { companyId, connectorId, direction: 'OUTBOUND', method, url: safeUrl(url), requestHeaders: safeHeaders(headers), statusCode, durationMs: Date.now() - started, success: response.ok, errorMessage: response.ok ? null : `HTTP ${statusCode}`, attempt },
    });
    return { statusCode, headers: Object.fromEntries(response.headers), body: responseBody, durationMs: Date.now() - started };
  } catch (error) {
    errorMessage = error.message;
    await prisma.integrationLog.create({
      data: { companyId, connectorId, direction: 'OUTBOUND', method, url: safeUrl(url), requestHeaders: safeHeaders(headers), statusCode, durationMs: Date.now() - started, success: false, errorMessage, attempt },
    });
    throw error;
  }
}

function retryable(error, result) {
  return (Boolean(error) && error.retryable !== false) || result?.statusCode === 429 || result?.statusCode >= 500;
}

export async function executeHttpRequest({ companyId, connectorId, method = 'GET', url, headers = {}, query, body, timeoutMs }) {
  let connector = null;
  if (connectorId) {
    connector = await prisma.connector.findFirst({ where: { id: connectorId, companyId, isActive: true } });
    if (!connector) throw httpError(404, 'Conector no encontrado');
    url = new URL(url, connector.baseUrl || undefined).toString();
    headers = { ...connector.defaultHeaders, ...headers };
    applyAuth(headers, connector);
  }
  const target = new URL(url);
  Object.entries(query || {}).forEach(([name, value]) => target.searchParams.set(name, String(value)));
  const attempts = 3;
  const timeout = Math.min(Number(timeoutMs || process.env.HTTP_DEFAULT_TIMEOUT_MS || 10000), 30000);
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let result;
    try { result = await requestAttempt({ companyId, connectorId, method: method.toUpperCase(), url: target.toString(), headers: { ...defaultHeaders(), ...headers }, body, timeoutMs: timeout, attempt }); }
    catch (error) { lastError = error; }
    if (!retryable(lastError, result) || attempt === attempts) {
      if (lastError) throw lastError;
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, (2 ** (attempt - 1)) * 100 + Math.random() * 100));
  }
  throw lastError;
}

export async function createConnector(companyId, userId, input) {
  const { credentials: rawCredentials, ...connectorInput } = input;
  const encryptedCredentials = rawCredentials ? encryptSecret(JSON.stringify(rawCredentials)) : null;
  const item = await prisma.connector.create({ data: { companyId, createdById: userId, ...connectorInput, encryptedCredentials } });
  await auditService.record({ tenantId: companyId, actorId: userId, action: 'CONNECTOR_CREATED', entity: 'Connector', entityId: item.id, metadata: { type: item.type, name: item.name } });
  return publicConnector(item);
}
export async function listConnectors(companyId) { return (await prisma.connector.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } })).map(publicConnector); }
export async function getConnector(companyId, id) { const item = await prisma.connector.findFirst({ where: { id, companyId } }); if (!item) throw httpError(404, 'Conector no encontrado'); return publicConnector(item); }
export async function updateConnector(companyId, id, input, userId = null) {
  await getConnector(companyId, id);
  const { credentials: rawCredentials, ...connectorInput } = input;
  const data = { ...connectorInput };
  if (rawCredentials !== undefined) data.encryptedCredentials = rawCredentials ? encryptSecret(JSON.stringify(rawCredentials)) : null;
  const item = await prisma.connector.update({ where: { id }, data });
  await auditService.record({ tenantId: companyId, actorId: userId, action: 'CONNECTOR_UPDATED', entity: 'Connector', entityId: id, metadata: { fields: Object.keys(connectorInput) } });
  return publicConnector(item);
}
export async function deleteConnector(companyId, id) { const result = await prisma.connector.deleteMany({ where: { id, companyId } }); if (!result.count) throw httpError(404, 'Conector no encontrado'); }

export async function createEndpoint(companyId, input) {
  const secret = crypto.randomBytes(32).toString('hex');
  const item = await prisma.webhookEndpoint.create({ data: { companyId, ...input, slug: crypto.randomBytes(18).toString('base64url'), secretHash: hashSecret(secret), encryptedSecret: encryptSecret(secret) } });
  return { ...publicEndpoint(item), secret };
}
export async function listEndpoints(companyId) { return (await prisma.webhookEndpoint.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } })).map(publicEndpoint); }
export async function updateEndpoint(companyId, id, input) { const result = await prisma.webhookEndpoint.updateMany({ where: { id, companyId }, data: input }); if (!result.count) throw httpError(404, 'Webhook no encontrado'); return publicEndpoint(await prisma.webhookEndpoint.findFirst({ where: { id, companyId } })); }
export async function deleteEndpoint(companyId, id) { const result = await prisma.webhookEndpoint.deleteMany({ where: { id, companyId } }); if (!result.count) throw httpError(404, 'Webhook no encontrado'); }
export async function rotateEndpointSecret(companyId, id) { const secret = crypto.randomBytes(32).toString('hex'); const result = await prisma.webhookEndpoint.updateMany({ where: { id, companyId }, data: { secretHash: hashSecret(secret), encryptedSecret: encryptSecret(secret) } }); if (!result.count) throw httpError(404, 'Webhook no encontrado'); return { secret }; }
export function listEvents(companyId, endpointId, query) { const where = { companyId, endpointId, ...(query.status ? { status: query.status } : {}) }; return Promise.all([prisma.webhookEvent.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit }), prisma.webhookEvent.count({ where })]).then(([items, total]) => ({ items, page: query.page, limit: query.limit, total })); }

export async function receiveWebhook(slug, rawBody, headers) {
  const endpoint = await prisma.webhookEndpoint.findUnique({ where: { slug } });
  if (!endpoint || !endpoint.isActive) throw httpError(404, 'Webhook no encontrado');
  const now = Date.now();
  const window = webhookRate.get(slug);
  if (!window || now - window.startedAt >= 60000) webhookRate.set(slug, { startedAt: now, count: 1 });
  else if (window.count >= 60) throw httpError(429, 'Límite de webhooks excedido');
  else window.count += 1;
  const signature = headers['x-nexora-signature'] || '';
  const expected = hmac(rawBody, decryptSecret(endpoint.encryptedSecret));
  const valid = signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  let body; try { body = JSON.parse(rawBody); } catch { body = { raw: rawBody }; }
  const event = await prisma.webhookEvent.create({ data: { companyId: endpoint.companyId, endpointId: endpoint.id, headers: safeHeaders(headers), body, signatureValid: valid } });
  await prisma.webhookEndpoint.update({ where: { id: endpoint.id }, data: { lastReceivedAt: new Date() } });
  if (!valid) throw httpError(401, 'Firma inválida');
  await enqueueWebhookInbound(event.id);
  return event;
}

export async function createSubscription(companyId, input) { return publicSubscription(await prisma.webhookSubscription.create({ data: { companyId, url: input.url, eventTypes: input.eventTypes, encryptedSecret: encryptSecret(input.secret) } })); }
export async function listSubscriptions(companyId) { return (await prisma.webhookSubscription.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } })).map(publicSubscription); }
export async function updateSubscription(companyId, id, input) { await prisma.webhookSubscription.updateMany({ where: { id, companyId }, data: { url: input.url, eventTypes: input.eventTypes, isActive: input.isActive } }); return publicSubscription(await prisma.webhookSubscription.findFirstOrThrow({ where: { id, companyId } })); }
export async function deleteSubscription(companyId, id) { const result = await prisma.webhookSubscription.deleteMany({ where: { id, companyId } }); if (!result.count) throw httpError(404, 'Suscripción no encontrada'); }
export async function emitEvent(companyId, eventType, payload) {
  const subscriptions = await prisma.webhookSubscription.findMany({ where: { companyId, isActive: true, eventTypes: { has: eventType } } });
  await Promise.all(subscriptions.map((subscription) => enqueueWebhookOutbound({ companyId, subscriptionId: subscription.id, eventType, payload })));
}

export async function deliverWebhook(job) {
  const subscription = await prisma.webhookSubscription.findFirst({ where: { id: job.data.subscriptionId, companyId: job.data.companyId, isActive: true } });
  if (!subscription) return;
  const body = JSON.stringify(job.data.payload);
  const delivery = crypto.randomUUID();
  return executeHttpRequest({ companyId: job.data.companyId, method: 'POST', url: subscription.url, headers: { 'content-type': 'application/json', 'x-nexora-event': job.data.eventType, 'x-nexora-delivery': delivery, 'x-nexora-signature': hmac(body, decryptSecret(subscription.encryptedSecret)) }, body: job.data.payload });
}
export function listLogs(companyId, query) { const where = { companyId, ...(query.connectorId ? { connectorId: query.connectorId } : {}), ...(query.success !== undefined ? { success: query.success === 'true' } : {}) }; return Promise.all([prisma.integrationLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit }), prisma.integrationLog.count({ where })]).then(([items, total]) => ({ items, page: query.page, limit: query.limit, total })); }
