import prisma from '../../infrastructure/prisma.js';
import { httpError } from '../../utils.js';
import { encryptApiKey } from './crypto.js';
import { assertSafeUrl } from './ssrf.js';
import { createProvider } from './providers.js';

const publicConfig = ({ apiKeyEncrypted, ...config }) => ({ ...config, hasApiKey: Boolean(apiKeyEncrypted) });
const defaults = {
  openai_compatible: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
  gemini: 'https://generativelanguage.googleapis.com',
  mock: null,
};

async function getPolicy(orgId) {
  const organization = await prisma.organization.findUnique({ where: { id: orgId }, select: { allowPrivateHosts: true } });
  return { allowPrivateHosts: organization?.allowPrivateHosts === true };
}

async function validateBaseUrl(orgId, provider, baseUrl) {
  if (provider === 'mock') return null;
  const value = baseUrl || defaults[provider];
  await assertSafeUrl(value, await getPolicy(orgId));
  return value;
}

export async function createConfig(orgId, userId, input) {
  const baseUrl = await validateBaseUrl(orgId, input.provider, input.baseUrl);
  const apiKeyEncrypted = input.apiKey ? encryptApiKey(input.apiKey) : null;
  const { apiKey, ...fields } = input;
  const item = await prisma.aiProviderConfig.create({
    data: { ...fields, orgId, createdById: userId, baseUrl, apiKeyEncrypted, apiKeyLast4: apiKey ? apiKey.slice(-4) : null },
  });
  return publicConfig(item);
}

export async function listConfigs(orgId) {
  return (await prisma.aiProviderConfig.findMany({ where: { orgId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] })).map(publicConfig);
}

export async function getConfig(orgId, id) {
  const item = await prisma.aiProviderConfig.findFirst({ where: { id, orgId } });
  if (!item) throw httpError(404, 'Proveedor no encontrado');
  return item;
}

export async function updateConfig(orgId, id, input) {
  const existing = await getConfig(orgId, id);
  const provider = input.provider || existing.provider;
  const baseUrl = input.baseUrl === undefined && input.provider === undefined ? existing.baseUrl : await validateBaseUrl(orgId, provider, input.baseUrl || defaults[provider]);
  const data = { ...input, baseUrl };
  delete data.apiKey;
  if (input.apiKey !== undefined) {
    data.apiKeyEncrypted = input.apiKey ? encryptApiKey(input.apiKey) : null;
    data.apiKeyLast4 = input.apiKey ? input.apiKey.slice(-4) : null;
  }
  return publicConfig(await prisma.aiProviderConfig.update({ where: { id: existing.id }, data }));
}

export async function deleteConfig(orgId, id) {
  const result = await prisma.aiProviderConfig.deleteMany({ where: { id, orgId } });
  if (!result.count) throw httpError(404, 'Proveedor no encontrado');
}

export async function setDefault(orgId, id) {
  await getConfig(orgId, id);
  await prisma.$transaction([
    prisma.aiProviderConfig.updateMany({ where: { orgId }, data: { isDefault: false } }),
    prisma.aiProviderConfig.update({ where: { id }, data: { isDefault: true, status: 'ACTIVE' } }),
  ]);
  return getConfig(orgId, id).then(publicConfig);
}

export async function resolveProvider(orgId, configId = null) {
  const config = configId
    ? await prisma.aiProviderConfig.findFirst({ where: { id: configId, orgId, status: 'ACTIVE' } })
    : await prisma.aiProviderConfig.findFirst({ where: { orgId, status: 'ACTIVE', isDefault: true } });
  if (!config) {
    const error = httpError(409, 'La organización no tiene un proveedor de IA activo');
    error.code = 'AI_NOT_CONFIGURED';
    throw error;
  }
  return { config, provider: createProvider(config, await getPolicy(orgId)) };
}

export async function testConfig(orgId, id) {
  const config = await getConfig(orgId, id);
  const provider = createProvider(config, await getPolicy(orgId));
  return provider.generate({ messages: [{ role: 'user', content: 'ping' }], signal: AbortSignal.timeout(10000) }).then(() => ({ ok: true }));
}

export async function updatePrivateHosts(orgId, enabled) {
  return prisma.organization.update({ where: { id: orgId }, data: { allowPrivateHosts: enabled }, select: { allowPrivateHosts: true } });
}
