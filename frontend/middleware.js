import { NextResponse } from 'next/server';
import {
  UK_HOST,
  IN_HOST,
  COM_HOST,
  normalizeHost,
  isProdHost,
} from './lib/region';

// Run on real page navigations only. Skip Next internals, the API/admin paths
// (proxied straight to Django by nginx), and anything that looks like a file.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|api/|admin/|static/|media/|favicon.ico|robots.txt|sitemap.xml|.*\\.[^/]+$).*)',
  ],
};

const REGION_COOKIE = 'sclero_region'; // 'IN' | 'UK' — the shopper's explicit choice
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

function regionalRedirect(request, targetHost, { setRegion } = {}) {
  const url = request.nextUrl.clone();
  url.protocol = 'https';
  url.hostname = targetHost;
  url.port = '';
  url.searchParams.delete('set_region');
  const res = NextResponse.redirect(url, 307);
  if (setRegion) {
    res.cookies.set(REGION_COOKIE, setRegion, {
      path: '/',
      maxAge: COOKIE_MAX_AGE,
      sameSite: 'lax',
    });
  }
  return res;
}

export function middleware(request) {
  const host = normalizeHost(request.headers.get('host') || '');

  // Localhost / preview / unknown hosts: never redirect. The in-page region
  // switcher handles currency in place during development.
  if (!isProdHost(host)) return NextResponse.next();

  // Edge geo header — Cloudflare (recommended) first, Vercel as a fallback.
  const country = (
    request.headers.get('cf-ipcountry') ||
    request.headers.get('x-vercel-ip-country') ||
    ''
  ).toUpperCase();

  // A shopper who used the switcher arrives with ?set_region=IN|UK. Honour it:
  // drop them a cookie on THIS domain (cookies can't span ccTLDs) and clean the
  // URL so the choice sticks and we never bounce them away again.
  const requested = (request.nextUrl.searchParams.get('set_region') || '').toUpperCase();
  if (requested === 'IN' || requested === 'UK') {
    const url = request.nextUrl.clone();
    url.searchParams.delete('set_region');
    const res = NextResponse.redirect(url, 307);
    res.cookies.set(REGION_COOKIE, requested, {
      path: '/',
      maxAge: COOKIE_MAX_AGE,
      sameSite: 'lax',
    });
    return res;
  }

  const override = (request.cookies.get(REGION_COOKIE)?.value || '').toUpperCase();
  const wantsIN = override ? override === 'IN' : country === 'IN';

  // .com is a pure geo-router: it never serves content, it forwards to a ccTLD.
  if (host === COM_HOST) {
    const target = wantsIN ? IN_HOST : UK_HOST;
    return regionalRedirect(request, target, { setRegion: wantsIN ? 'IN' : 'UK' });
  }

  // On a regional domain, only auto-redirect when the shopper hasn't chosen.
  if (!override) {
    // Indian visitors on the UK site -> send to .in
    if (host === UK_HOST && country === 'IN') {
      return regionalRedirect(request, IN_HOST);
    }
    // Non-Indian visitors on the India site -> send to .co.uk.
    // Guard on a known country so a missing geo header never bounces anyone.
    if (host === IN_HOST && country && country !== 'IN') {
      return regionalRedirect(request, UK_HOST);
    }
  }

  return NextResponse.next();
}
