// Resolves the base URL for backend API calls.
//
// Dev: set NEXT_PUBLIC_API_URL=http://localhost:8000 in .env and every call
// hits the local Django server directly.
//
// Production (ccTLD deployment): leave NEXT_PUBLIC_API_URL empty. In the browser
// we then use RELATIVE, same-origin paths (/api/...) so nginx can proxy them to
// Django on whichever domain the shopper is on (.co.uk or .in) — keeping cookies
// and JWT first-party with no CORS. Server-side rendering can't use a relative
// URL, so it falls back to API_INTERNAL_URL (e.g. http://backend:8000 inside the
// Docker network).
const DEFAULT_API_URL = 'http://localhost:8000';

function resolveBase() {
  const explicit = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL : '';
  if (explicit) return explicit.replace(/\/$/, '');

  // No explicit URL set.
  if (typeof window !== 'undefined') {
    // Browser. In development talk to the local Django server directly; in a
    // production build use RELATIVE same-origin paths (nginx proxies /api per
    // ccTLD). NODE_ENV is inlined by Next at build time.
    const isDev = typeof process !== 'undefined' && process.env.NODE_ENV === 'development';
    return isDev ? DEFAULT_API_URL : '';
  }

  // SSR / build time -> internal service URL, else localhost.
  const internal = typeof process !== 'undefined' ? process.env.API_INTERNAL_URL : '';
  return (internal || DEFAULT_API_URL).replace(/\/$/, '');
}

export function getApiUrl(path = '') {
  const base = resolveBase();
  if (!path) return base;
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

/**
 * Submit JSON with a bounded wait. Public forms use this so a stalled network
 * request returns a useful retry message instead of leaving the UI spinning.
 */
export async function postJson(path, payload, { timeoutMs = 15000, credentials } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(getApiUrl(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      credentials,
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    return { response, data };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('The request took too long. Please check your connection and try again.');
    }
    throw new Error('Could not reach the server. Please check your connection and try again.');
  } finally {
    clearTimeout(timeout);
  }
}
