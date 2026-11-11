import { decryptApiKey } from './crypto.js';
import { fetchSafe } from './ssrf.js';

function timeoutSignal(ms = 30000) { return AbortSignal.timeout(Math.min(Math.max(Number(ms), 1), 120000)); }
async function json(response) {
  const body = await response.text();
  let parsed;
  try { parsed = JSON.parse(body); } catch { parsed = {}; }
  if (!response.ok) {
    const error = new Error(parsed.error?.message || parsed.error || `LLM HTTP ${response.status}`);
    error.statusCode = response.status;
    error.retryable = response.status === 429 || response.status >= 500;
    throw error;
  }
  return parsed;
}

function openAi(config, policy) {
  return {
    async generate({ messages, tools = [], responseSchema, signal }) {
      const body = { model: config.model, messages, ...(tools.length ? { tools } : {}) };
      if (responseSchema) body.response_format = { type: 'json_schema', json_schema: responseSchema };
      const response = await fetchSafe(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${decryptApiKey(config.apiKeyEncrypted)}` },
        body: JSON.stringify(body), signal: signal || timeoutSignal(),
      }, policy);
      const data = await json(response);
      const message = data.choices?.[0]?.message || {};
      return { text: message.content || '', toolCalls: message.tool_calls || [], usage: { inputTokens: data.usage?.prompt_tokens || 0, outputTokens: data.usage?.completion_tokens || 0 } };
    },
  };
}

function anthropic(config, policy) {
  return {
    async generate({ messages, tools = [], signal }) {
      const system = messages.find((message) => message.role === 'system')?.content;
      const response = await fetchSafe(`${config.baseUrl.replace(/\/$/, '')}/v1/messages`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': decryptApiKey(config.apiKeyEncrypted), 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: config.model, max_tokens: 4096, system, messages: messages.filter((message) => message.role !== 'system'), ...(tools.length ? { tools } : {}) }),
        signal: signal || timeoutSignal(),
      }, policy);
      const data = await json(response);
      return { text: data.content?.filter((item) => item.type === 'text').map((item) => item.text).join('') || '', toolCalls: data.content?.filter((item) => item.type === 'tool_use') || [], usage: { inputTokens: data.usage?.input_tokens || 0, outputTokens: data.usage?.output_tokens || 0 } };
    },
  };
}

function gemini(config, policy) {
  return {
    async generate({ messages, signal }) {
      const url = `${config.baseUrl.replace(/\/$/, '')}/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(decryptApiKey(config.apiKeyEncrypted))}`;
      const response = await fetchSafe(url, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content) }] })) }),
        signal: signal || timeoutSignal(),
      }, policy);
      const data = await json(response);
      return { text: data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('') || '', toolCalls: [], usage: { inputTokens: data.usageMetadata?.promptTokenCount || 0, outputTokens: data.usageMetadata?.candidatesTokenCount || 0 } };
    },
  };
}

export function mockProvider() {
  return { async generate() { return { text: 'mock-response', toolCalls: [], usage: { inputTokens: 1, outputTokens: 1 } }; } };
}

export function createProvider(config, policy = {}) {
  if (config.provider === 'mock') return mockProvider();
  if (!config.apiKeyEncrypted) throw new Error('El proveedor no tiene API key configurada');
  if (config.provider === 'anthropic') return anthropic(config, policy);
  if (config.provider === 'gemini') return gemini(config, policy);
  return openAi(config, policy);
}
