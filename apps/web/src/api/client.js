let accessToken = null;
let refreshPromise = null;
const refreshStorageKey = 'nexora_refresh';

export function getAccessToken() { return accessToken; }
export function setTokens(nextAccessToken, nextRefreshToken) {
  accessToken = nextAccessToken || null;
  if (nextRefreshToken) localStorage.setItem(refreshStorageKey, nextRefreshToken);
}
export function clearSession() {
  accessToken = null;
  localStorage.removeItem(refreshStorageKey);
}
function isAuthPath(path) { return ['/auth/login', '/auth/register', '/auth/refresh'].some((route) => path.endsWith(route)); }
async function parseResponse(response) {
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Error en la solicitud');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}
async function refreshSession() {
  const refreshToken = localStorage.getItem(refreshStorageKey);
  if (!refreshToken) throw new Error('No hay una sesión guardada');
  if (!refreshPromise) {
    refreshPromise = fetch('/api/v1/auth/refresh', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken }),
    }).then(parseResponse).then((data) => { setTokens(data.accessToken, data.refreshToken); return data; }).finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}
export async function request(method, path, body, retry = true) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const response = await fetch(`/api/v1${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  try { return await parseResponse(response); } catch (error) {
    if (error.status === 401 && retry && !isAuthPath(path)) {
      try { await refreshSession(); return request(method, path, body, false); } catch (refreshError) {
        clearSession(); window.location.assign('/login'); throw refreshError;
      }
    }
    throw error;
  }
}
export const authApi = {
  login: (body) => request('POST', '/auth/login', body), register: (body) => request('POST', '/auth/register', body),
  refresh: refreshSession, logout: () => request('POST', '/auth/logout', { refreshToken: localStorage.getItem(refreshStorageKey) }), me: () => request('GET', '/auth/me'),
};
export const organizationsApi = {
  list: () => request('GET', '/organizations'), create: (body) => request('POST', '/organizations', body), get: (id) => request('GET', `/organizations/${id}`),
  members: (id) => request('GET', `/organizations/${id}/members`), updateMember: (id, userId, body) => request('PATCH', `/organizations/${id}/members/${userId}`, body),
};
export const agentsApi = {
  list: (orgId) => request('GET', `/orgs/${orgId}/agents`), catalog: (orgId) => request('GET', `/orgs/${orgId}/agents/tools/catalog`),
  create: (orgId, body) => request('POST', `/orgs/${orgId}/agents`, body), update: (orgId, id, body) => request('PATCH', `/orgs/${orgId}/agents/${id}`, body),
  remove: (orgId, id) => request('DELETE', `/orgs/${orgId}/agents/${id}`), tools: (orgId, id, tools) => request('PUT', `/orgs/${orgId}/agents/${id}/tools`, { tools }),
};
export const workflowsApi = {
  list: (orgId) => request('GET', `/orgs/${orgId}/workflows`), get: (orgId, id) => request('GET', `/orgs/${orgId}/workflows/${id}`),
  create: (orgId, body) => request('POST', `/orgs/${orgId}/workflows`, body), update: (orgId, id, body) => request('PATCH', `/orgs/${orgId}/workflows/${id}`, body),
  remove: (orgId, id) => request('DELETE', `/orgs/${orgId}/workflows/${id}`), publish: (orgId, id) => request('POST', `/orgs/${orgId}/workflows/${id}/publish`),
  versions: (orgId, id) => request('GET', `/orgs/${orgId}/workflows/${id}/versions`), version: (orgId, id, version) => request('GET', `/orgs/${orgId}/workflows/${id}/versions/${version}`),
  execute: (orgId, id, body) => request('POST', `/orgs/${orgId}/workflows/${id}/execute`, body),
};
export const executionsApi = {
  list: (orgId, query = {}) => request('GET', `/orgs/${orgId}/executions?${new URLSearchParams(query)}`), get: (orgId, id) => request('GET', `/orgs/${orgId}/executions/${id}`),
  steps: (orgId, id) => request('GET', `/orgs/${orgId}/executions/${id}/steps`), cancel: (orgId, id) => request('POST', `/orgs/${orgId}/executions/${id}/cancel`), retry: (orgId, id) => request('POST', `/orgs/${orgId}/executions/${id}/retry`),
};
export const approvalsApi = {
  list: (orgId, query = {}) => request('GET', `/orgs/${orgId}/approvals?${new URLSearchParams(query)}`), get: (orgId, id) => request('GET', `/orgs/${orgId}/approvals/${id}`),
  approve: (orgId, id, comment = '') => request('POST', `/orgs/${orgId}/approvals/${id}/approve`, { comment }), reject: (orgId, id, comment) => request('POST', `/orgs/${orgId}/approvals/${id}/reject`, { comment }),
};
export const analyticsApi = {
  overview: (orgId, query = {}) => request('GET', `/orgs/${orgId}/analytics/overview?${new URLSearchParams(query)}`),
  timeseries: (orgId, query = {}) => request('GET', `/orgs/${orgId}/analytics/timeseries?${new URLSearchParams(query)}`),
  errors: (orgId, query = {}) => request('GET', `/orgs/${orgId}/analytics/top-errors?${new URLSearchParams(query)}`),
};
export const notificationsApi = {
  list: (orgId, query = {}) => request('GET', `/orgs/${orgId}/notifications?${new URLSearchParams(query)}`), unreadCount: (orgId) => request('GET', `/orgs/${orgId}/notifications/unread-count`),
  markRead: (orgId, id) => request('PATCH', `/orgs/${orgId}/notifications/${id}/read`), markAllRead: (orgId) => request('POST', `/orgs/${orgId}/notifications/read-all`),
};
export const integrationsApi = {
  list: (orgId) => request('GET', `/orgs/${orgId}/integrations/connectors`), create: (orgId, body) => request('POST', `/orgs/${orgId}/integrations/connectors`, body),
  test: (orgId, id, body = {}) => request('POST', `/orgs/${orgId}/integrations/connectors/${id}/test`, body),
};
export const documentsApi = {
  list: (orgId, query = {}) => request('GET', `/orgs/${orgId}/documents?${new URLSearchParams(query)}`), get: (orgId, id) => request('GET', `/orgs/${orgId}/documents/${id}`),
  reprocess: (orgId, id) => request('POST', `/orgs/${orgId}/documents/${id}/reprocess`), correct: (orgId, id, extractedData) => request('PATCH', `/orgs/${orgId}/documents/${id}/extracted-data`, { extractedData }),
};
