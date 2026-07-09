'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setRegion, setSessionId, setTaxMode, setGuestCheckoutEnabled, setBranding } from '../store/regionSlice';
import { fetchCart } from '../store/cartSlice';
import { getApiUrl } from '../lib/api';
import { regionFromHost, normalizeHost, hostForRegion, COM_HOST } from '../lib/region';
import { initTrackingScripts } from '../utils/analytics';

const trackingSettings = {
  google_analytics_id: process.env.NEXT_PUBLIC_GA4_ID || '',
  google_gtm_id: process.env.NEXT_PUBLIC_GTM_ID || 'GT-WBKDQ395',
  meta_pixel_id: process.env.NEXT_PUBLIC_META_PIXEL_ID || '',
  tiktok_pixel_id: process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID || '',
};

let activeTrackingSettings = { ...trackingSettings };

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
    if (typeof window !== 'undefined' && normalizeHost(window.location.hostname) === COM_HOST) {
      fetch(getApiUrl('/api/geo/'))
        .then((r) => (r.ok ? r.json() : null))
        .then((geo) => {
          const target = hostForRegion(geo && geo.region_code === 'IN' ? 'IN' : 'UK');
          const { pathname, search } = window.location;
          window.location.replace(`https://${target}${pathname}${search}`);
        })
        .catch(() => {
          window.location.replace(`https://${hostForRegion('UK')}${window.location.pathname}`);
        });
      return;
    }

    let sid = localStorage.getItem('sclero_session_id');
    if (!sid) {
      sid = `session_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem('sclero_session_id', sid);
    }
    dispatch(setSessionId(sid));

    const consent = readCookieConsent();
    if (consent) initTrackingScripts(activeTrackingSettings, consent);

    // Load store-wide config (tax mode + guest checkout + branding) once on boot.
    fetch(getApiUrl('/api/store-config/'))
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (cfg && cfg.tax_mode) dispatch(setTaxMode(cfg.tax_mode));
        if (cfg && typeof cfg.guest_checkout_enabled !== 'undefined') {
          dispatch(setGuestCheckoutEnabled(cfg.guest_checkout_enabled));
        }
        if (cfg && cfg.branding) {
          dispatch(setBranding(cfg.branding));
        }

        // Dynamically override tracking settings from DB if configured
        const seo = cfg?.seo_settings || {};
        const isIndia = hostRegion === 'IN' || (typeof window !== 'undefined' && window.location.hostname.endsWith('.in'));
        
        activeTrackingSettings = {
          google_analytics_id: (isIndia ? seo.googleAnalyticsIN : seo.googleAnalytics) || process.env.NEXT_PUBLIC_GA4_ID || (isIndia ? 'G-1LXXS0E8KX' : 'G-SXFL6ENWL7'),
          google_gtm_id: seo.gtm || process.env.NEXT_PUBLIC_GTM_ID || 'GT-WBKDQ395',
          meta_pixel_id: seo.fbPixel || process.env.NEXT_PUBLIC_META_PIXEL_ID || '',
          tiktok_pixel_id: process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID || '',
        };
        
        if (consent) {
          // Re-initialize scripts with DB settings
          window.__scleroTrackingInitialized = false;
          initTrackingScripts(activeTrackingSettings, consent);
        }

        // Inject google-site-verification meta tag if present
        if (typeof document !== 'undefined' && seo.googleSiteVerification) {
          let meta = document.querySelector('meta[name="google-site-verification"]');
          if (!meta) {
            meta = document.createElement('meta');
            meta.name = 'google-site-verification';
            document.head.appendChild(meta);
          }
          meta.content = seo.googleSiteVerification;
        }
      })
      .catch(() => {});


    const onConsentUpdated = (event) => {
      window.__scleroTrackingInitialized = false;
      initTrackingScripts(activeTrackingSettings, event.detail || {});
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
            // Only let a CONFIDENT geo signal (Cloudflare/Vercel/MaxMind) refine
            // the region. A 'fallback' source means no edge header was present
            // (localhost, or any non-Cloudflare deploy) and must NOT override the
            // timezone/locale detection — otherwise Indian visitors get forced to
            // the UK default and see £ instead of ₹.
            if (geo.source === 'fallback') return;
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
