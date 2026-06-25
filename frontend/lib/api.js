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
