import { getApiUrl } from './api';

const ACCESS_KEY = 'sclero_access';
const REFRESH_KEY = 'sclero_refresh';
let refreshPromise = null;

function stored(key) {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function persist(access, refresh) {
  if (typeof window === 'undefined') return;
  try {
    if (access) window.localStorage.setItem(ACCESS_KEY, access);
    if (refresh) window.localStorage.setItem(REFRESH_KEY, refresh);
  } catch {
    // Privacy modes may block storage; the current in-memory access token still
    // works until expiry.
  }
}

function clear() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(ACCESS_KEY);
    window.localStorage.removeItem(REFRESH_KEY);
  } catch {
    // Ignore blocked storage.
  }
}

async function refreshTokens() {
  if (refreshPromise) return refreshPromise;
  const refresh = stored(REFRESH_KEY);
  if (!refresh) return null;

  refreshPromise = fetch(getApiUrl('/api/auth/token/refresh/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })
    .then(async (response) => {
      if (!response.ok) {
        clear();
        return null;
      }
      const tokens = await response.json();
      persist(tokens.access, tokens.refresh || refresh);
      return tokens.access || null;
    })
    .catch(() => null)
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

function withAuthorization(options, access) {
  return {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
    },
  };
}

export async function authenticatedFetch(path, options = {}, accessHint = null) {
  const url = path.startsWith('http') ? path : getApiUrl(path);
  let access = stored(ACCESS_KEY) || accessHint;
  let response = await fetch(url, withAuthorization(options, access));
  if (response.status !== 401 || !stored(REFRESH_KEY)) return response;

  access = await refreshTokens();
  if (!access) return response;
  response = await fetch(url, withAuthorization(options, access));
  return response;
}
