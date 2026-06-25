// Country-code-top-level-domain (ccTLD) region map.
//
// Each region is served on its own domain:
//   - scleroproteins.co.uk  -> UK / GBP / VAT      (default for UK + rest of world)
//   - scleroproteins.in     -> India / INR / GST
//   - scleroproteins.com    -> pure geo-router (forwards to .in or .co.uk)
//
// The region a shopper sees is derived from the DOMAIN they are on, not from an
// in-page toggle. The middleware (middleware.js) does the geo redirect; this
// module is the single source of truth both the middleware and the React app
// use to map host <-> region.

export const UK_HOST = 'scleroproteins.co.uk';
export const IN_HOST = 'scleroproteins.in';
export const COM_HOST = 'scleroproteins.com';

// All hostnames we treat as "production ccTLD" hosts (with and without www).
export const PROD_HOSTS = [UK_HOST, IN_HOST, COM_HOST];

/** Strip a leading "www." and any :port, lower-case the result. */
export function normalizeHost(hostname = '') {
  return String(hostname)
    .split(':')[0]
    .toLowerCase()
    .replace(/^www\./, '');
}

/** True when the host is one of our real regional/geo-router domains. */
export function isProdHost(hostname = '') {
  return PROD_HOSTS.includes(normalizeHost(hostname));
}

/**
 * Region implied purely by the hostname.
 * Returns 'IN' for the India domain, 'UK' for the co.uk domain, and null for
 * anything else (.com geo-router, localhost, preview hosts) where the region
 * must be decided some other way (geo header / manual choice).
 */
export function regionFromHost(hostname = '') {
  const host = normalizeHost(hostname);
  if (host === IN_HOST) return 'IN';
  if (host === UK_HOST) return 'UK';
  return null;
}

/** The domain that serves a given region code. Unknown codes -> UK domain. */
export function hostForRegion(code = 'UK') {
  return String(code).toUpperCase() === 'IN' ? IN_HOST : UK_HOST;
}

/**
 * Absolute https URL on the regional domain for `code`, preserving the current
 * path + query and appending ?set_region=<code> so the destination domain can
 * record the shopper's explicit choice (and skip auto-redirecting them back).
 */
export function crossDomainUrl(code, pathname = '/', search = '') {
  const host = hostForRegion(code);
  const qs = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  qs.set('set_region', String(code).toUpperCase());
  const path = pathname || '/';
  return `https://${host}${path}?${qs.toString()}`;
}
