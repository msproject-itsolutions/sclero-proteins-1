import { getApiUrl } from './api';

let refreshPromise = null;

const browserOptions = (options = {}) => ({
  ...options,
  credentials: 'include',
  headers: {
    'X-Sclero-Client': 'storefront',
    ...(options.headers || {}),
  },
});

async function refreshSession() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetch(getApiUrl('/api/auth/token/refresh/'), browserOptions({
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  }))
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

export async function authenticatedFetch(path, options = {}) {
  const url = path.startsWith('http') ? path : getApiUrl(path);
  let response = await fetch(url, browserOptions(options));
  if (response.status !== 401 || path === '/api/auth/token/refresh/') return response;

  if (!await refreshSession()) return response;
  response = await fetch(url, browserOptions(options));
  return response;
}
