import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { encryptApiKey, decryptApiKey } from '../src/modules/ai/crypto.js';
import { assertSafeUrl, isPrivateAddress } from '../src/modules/ai/ssrf.js';
import { createProvider } from '../src/modules/ai/providers.js';

process.env.AI_KEY_ENCRYPTION_SECRET = 'test-secret-with-more-than-32-characters';

afterEach(() => {
  delete globalThis.fetch;
});

test('cifra y descifra API keys con formato versionado', () => {
  const encrypted = encryptApiKey('sk-test-secret');
  assert.match(encrypted, /^v1\./);
  assert.equal(decryptApiKey(encrypted), 'sk-test-secret');
  assert.throws(() => decryptApiKey(`${encrypted.slice(0, -1)}A`), /No se pudo descifrar/);
});

test('rechaza IPs privadas, loopback y protocolos inseguros', async () => {
  assert.equal(isPrivateAddress('10.0.0.1'), true);
  assert.equal(isPrivateAddress('127.0.0.1'), true);
  assert.equal(isPrivateAddress('192.168.1.1'), true);
  await assert.rejects(() => assertSafeUrl('http://127.0.0.1:11434'), /red privada/);
  await assert.rejects(() => assertSafeUrl('file:///etc/passwd'), /HTTP y HTTPS/);
  await assert.doesNotReject(() => assertSafeUrl('http://127.0.0.1:11434', { allowPrivateHosts: true }));
});

test('bloquea un redirect hacia una red privada', async () => {
  globalThis.fetch = async () => new Response('', { status: 302, headers: { location: 'http://127.0.0.1:1' } });
  const { fetchSafe } = await import('../src/modules/ai/ssrf.js');
  await assert.rejects(() => fetchSafe('https://example.com', {}, { allowPrivateHosts: false }), /red privada/);
});

test('factory mock es determinista y los adaptadores traducen respuestas', async () => {
  const mock = createProvider({ provider: 'mock' });
  assert.deepEqual(await mock.generate({ messages: [] }), { text: 'mock-response', toolCalls: [], usage: { inputTokens: 1, outputTokens: 1 } });
  const encrypted = encryptApiKey('secret');
  const responses = [
    { provider: 'openai_compatible', body: { choices: [{ message: { content: 'openai', tool_calls: [] } }], usage: { prompt_tokens: 2, completion_tokens: 3 } }, url: 'http://127.0.0.1:11434/v1/chat/completions' },
    { provider: 'anthropic', body: { content: [{ type: 'text', text: 'anthropic' }], usage: { input_tokens: 2, output_tokens: 3 } }, url: 'http://127.0.0.1:11434/v1/messages' },
    { provider: 'gemini', body: { candidates: [{ content: { parts: [{ text: 'gemini' }] } }], usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 3 } }, url: 'http://127.0.0.1:11434/v1beta/models/model:generateContent?key=secret' },
  ];
  for (const item of responses) {
    globalThis.fetch = async (url) => {
      assert.equal(String(url), item.url);
      return new Response(JSON.stringify(item.body), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const baseUrl = item.provider === 'openai_compatible' ? 'http://127.0.0.1:11434/v1' : 'http://127.0.0.1:11434';
    const adapter = createProvider({ ...item, baseUrl, model: 'model', apiKeyEncrypted: encrypted }, { allowPrivateHosts: true });
    const result = await adapter.generate({ messages: [{ role: 'user', content: 'hi' }] });
    assert.ok(result.text);
    assert.deepEqual(result.usage, { inputTokens: 2, outputTokens: 3 });
  }
});
