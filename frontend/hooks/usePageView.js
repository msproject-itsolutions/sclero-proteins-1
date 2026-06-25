'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getApiUrl } from '../lib/api';

/**
 * Tracks page views by POSTing to /api/analytics/pageview/ on every route
 * change. Respects cookie consent — if the user explicitly opted out of
 * analytics, we still keep a local session_id (for our own use) but never
 * transmit a record.
 */
function getOrCreateSessionId() {
  if (typeof window === 'undefined') return '';
  try {
    let sid = window.localStorage.getItem('sclero_session_id');
    if (!sid) {
      // crypto.randomUUID is available in all modern browsers we target
      sid =
        (window.crypto && typeof window.crypto.randomUUID === 'function'
          ? window.crypto.randomUUID()
          : `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`);
      window.localStorage.setItem('sclero_session_id', sid);
    }
    return sid;
  } catch (e) {
    return '';
  }
}

function analyticsConsented() {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem('cookie-consent');
    if (!raw) return true; // no decision yet -> default to allowed (matches existing site behavior)
    const parsed = JSON.parse(raw);
    if (parsed && parsed.analytics === false) return false;
    return true;
  } catch (e) {
    return true;
  }
}

export default function usePageView() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined' || !pathname) return;
    const session_id = getOrCreateSessionId();
    if (!analyticsConsented()) return;

    const body = JSON.stringify({
      path: pathname,
      referrer: typeof document !== 'undefined' ? document.referrer || '' : '',
      session_id,
    });
    const url = getApiUrl('/api/analytics/pageview/');

    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
        return;
      }
    } catch (e) {
      /* fall through to fetch */
    }
    try {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    } catch (e) {
      /* never raise from analytics */
    }
  }, [pathname]);
}
