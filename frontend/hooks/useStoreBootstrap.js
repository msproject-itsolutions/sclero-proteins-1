'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setRegion, setSessionId } from '../store/regionSlice';
import { fetchCart } from '../store/cartSlice';
import { getApiUrl } from '../lib/api';
import { regionFromHost } from '../lib/region';
import { initTrackingScripts } from '../utils/analytics';

const trackingSettings = {
  google_analytics_id: process.env.NEXT_PUBLIC_GA4_ID || '',
  meta_pixel_id: process.env.NEXT_PUBLIC_META_PIXEL_ID || '',
  tiktok_pixel_id: process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID || '',
};

function readCookieConsent() {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem('cookie-consent');
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

export default function useStoreBootstrap() {
  const dispatch = useDispatch();
  const session_id = useSelector((state) => state.region.session_id);
  const currentRegion = useSelector((state) => state.region.currentRegion);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let sid = localStorage.getItem('sclero_session_id');
    if (!sid) {
      sid = `session_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem('sclero_session_id', sid);
    }
    dispatch(setSessionId(sid));

    const consent = readCookieConsent();
    if (consent) initTrackingScripts(trackingSettings, consent);

    const onConsentUpdated = (event) => {
      initTrackingScripts(trackingSettings, event.detail || {});
    };
    window.addEventListener('cookie-consent-updated', onConsentUpdated);

    // On a real ccTLD (scleroproteins.in / .co.uk) the DOMAIN is authoritative:
    // the middleware has already geo-routed the shopper here, so the region must
    // match the host regardless of browser locale. We just hydrate the full
    // Region object (currency/tax/domain) from the backend and stop — no geo
    // refinement that could fight the domain.
    const hostRegion = regionFromHost(typeof window !== 'undefined' ? window.location.hostname : '');
    if (hostRegion) {
      fetch(getApiUrl(`/api/detect-region/?country=${hostRegion === 'IN' ? 'IN' : 'GB'}`))
        .then((res) => res.json())
        .then((data) => {
          dispatch(setRegion(data.region));
          dispatch(fetchCart({ session_id: sid, region: data.region.code }));
          setReady(true);
        })
        .catch(() => {
          dispatch(fetchCart({ session_id: sid, region: hostRegion }));
          setReady(true);
        });
      return () => window.removeEventListener('cookie-consent-updated', onConsentUpdated);
    }

    const locale = typeof navigator !== 'undefined' ? (navigator.language || '') : '';
    const timezone = typeof Intl !== 'undefined' ? (Intl.DateTimeFormat().resolvedOptions().timeZone || '') : '';
    const language = typeof navigator !== 'undefined' && navigator.languages ? navigator.languages.join(',') : locale;

    // User's manual region choice (set when they use the header selector) always wins.
    const userOverrode = localStorage.getItem('sclero_region_set') === 'true';

    fetch(getApiUrl(`/api/detect-region/?locale=${encodeURIComponent(locale)}&timezone=${encodeURIComponent(timezone)}&language=${encodeURIComponent(language)}`))
      .then((res) => res.json())
      .then((data) => {
        dispatch(setRegion(data.region));
        dispatch(fetchCart({ session_id: sid, region: data.region.code }));
        setReady(true);

        // First-load-only server-side geo refinement (Cloudflare / Vercel / MaxMind).
        // Skipped entirely if the user has already overridden via the selector.
        if (userOverrode) return;
        fetch(getApiUrl('/api/geo/'))
          .then((r) => (r.ok ? r.json() : null))
          .then((geo) => {
            if (!geo || !geo.region_code) return;
            if (geo.region_code === data.region.code) return;
            // Fetch the full Region object so the slice gets currency/tax/domain.
            return fetch(getApiUrl(`/api/detect-region/?country=${encodeURIComponent(geo.region_code === 'IN' ? 'IN' : 'GB')}`))
              .then((r) => (r.ok ? r.json() : null))
              .then((d) => {
                if (!d || !d.region) return;
                dispatch(setRegion(d.region));
                dispatch(fetchCart({ session_id: sid, region: d.region.code }));
              });
          })
          .catch(() => {});
      })
      .catch(() => {
        dispatch(fetchCart({ session_id: sid, region: 'UK' }));
        setReady(true);
      });

    return () => window.removeEventListener('cookie-consent-updated', onConsentUpdated);
  }, [dispatch]);

  return { session_id, currentRegion, ready };
}
