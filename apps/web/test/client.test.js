import { beforeEach, afterEach, test, expect, vi } from 'vitest';
import * as client from '../src/api/client.js';
beforeEach(() => {
  client.clearSession();
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  vi.restoreAllMocks();
});
const ok = (data, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
test('tokens and logout preserve expected storage behavior', async () => {
  client.setTokens('access', 'refresh');
  expect(client.getAccessToken()).toBe('access');
  expect(localStorage.getItem('nexora_refresh')).toBe('refresh');
  fetch.mockResolvedValue(ok(null, 204));
  await client.authApi.logout();
  client.clearSession();
  expect(client.getAccessToken()).toBeNull();
});
test('non-auth 401 renews token once and retries with fresh authorization', async () => {
  client.setTokens('old', 'refresh');
  fetch
    .mockResolvedValueOnce(ok({ error: 'Expired' }, 401))
    .mockResolvedValueOnce(ok({ accessToken: 'new', refreshToken: 'rotated' }))
    .mockResolvedValueOnce(ok([{ id: 'org' }]));
  expect(await client.organizationsApi.list()).toEqual([{ id: 'org' }]);
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(fetch.mock.calls[2][1].headers.Authorization).toBe('Bearer new');
});
test('auth errors propagate without token refresh', async () => {
  fetch.mockResolvedValue(ok({ error: 'Invalid credentials' }, 401));
  await expect(client.authApi.login({ email: 'x', password: 'x' })).rejects.toThrow(
    'Invalid credentials',
  );
  expect(fetch).toHaveBeenCalledTimes(1);
});
test('API helpers construct tenant URLs, bodies and handle empty responses', async () => {
  fetch.mockImplementation(async () => ok({ ok: true }));
  const calls = [
    () => client.authApi.register({}),
    () => client.authApi.me(),
    () => client.organizationsApi.create({ name: 'Acme' }),
    () => client.organizationsApi.get('org'),
    () => client.organizationsApi.members('org'),
    () => client.organizationsApi.updateMember('org', 'u', {}),
    () => client.agentsApi.list('org'),
    () => client.agentsApi.catalog('org'),
    () => client.agentsApi.create('org', {}),
    () => client.agentsApi.update('org', 'id', {}),
    () => client.agentsApi.remove('org', 'id'),
    () => client.agentsApi.tools('org', 'id', []),
    () => client.workflowsApi.list('org'),
    () => client.workflowsApi.get('org', 'id'),
    () => client.workflowsApi.create('org', {}),
    () => client.workflowsApi.update('org', 'id', {}),
    () => client.workflowsApi.remove('org', 'id'),
    () => client.workflowsApi.publish('org', 'id'),
    () => client.workflowsApi.versions('org', 'id'),
    () => client.workflowsApi.version('org', 'id', 1),
    () => client.workflowsApi.execute('org', 'id', {}),
    () => client.executionsApi.list('org'),
    () => client.executionsApi.get('org', 'id'),
    () => client.executionsApi.steps('org', 'id'),
    () => client.executionsApi.cancel('org', 'id'),
    () => client.executionsApi.retry('org', 'id'),
    () => client.approvalsApi.list('org'),
    () => client.approvalsApi.get('org', 'id'),
    () => client.approvalsApi.approve('org', 'id'),
    () => client.approvalsApi.reject('org', 'id', 'reason'),
    () => client.analyticsApi.overview('org'),
    () => client.analyticsApi.timeseries('org'),
    () => client.analyticsApi.errors('org'),
    () => client.notificationsApi.list('org'),
    () => client.notificationsApi.unreadCount('org'),
    () => client.notificationsApi.markRead('org', 'id'),
    () => client.notificationsApi.markAllRead('org'),
    () => client.integrationsApi.list('org'),
    () => client.integrationsApi.create('org', {}),
    () => client.integrationsApi.test('org', 'id'),
    () => client.documentsApi.list('org'),
    () => client.documentsApi.get('org', 'id'),
    () => client.documentsApi.reprocess('org', 'id'),
    () => client.documentsApi.correct('org', 'id', {}),
  ];
  for (const call of calls) await call();
  expect(fetch.mock.calls.every(([url]) => url.startsWith('/api/v1/'))).toBe(true);
  fetch.mockResolvedValue(ok(null, 204));
  expect(await client.request('DELETE', '/test')).toBeNull();
});
