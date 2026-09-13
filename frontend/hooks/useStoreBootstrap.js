'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setRegion, setTaxMode, setGuestCheckoutEnabled, setBranding } from '../store/regionSlice';
import { fetchCart } from '../store/cartSlice';
import { getApiUrl } from '../lib/api';
import { regionFromHost, normalizeHost, hostForRegion, COM_HOST } from '../lib/region';
import { initTrackingScripts } from '../utils/analytics';

const trackingSettings = {
  google_analytics_id: process.env.NEXT_PUBLIC_GA4_ID || '',
  google_gtm_id: process.env.NEXT_PUBLIC_GTM_ID || '',
  meta_pixel_id: process.env.NEXT_PUBLIC_META_PIXEL_ID || '',
  tiktok_pixel_id: process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID || '',
};

let activeTrackingSettings = { ...trackingSettings };

// Pages opened from emailed links carry a secret token in the URL. No
// third-party tracking script may load on them, so it can never read the URL.
const TOKEN_LINK_PATHS = new Set(['/account/reset', '/auth/magic', '/auth/verify-email', '/auth/confirm-email-change', '/checkout/success']);

function onTokenLinkPage() {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return TOKEN_LINK_PATHS.has(path);
}

function loadTracking(settings, consent) {
  if (onTokenLinkPage()) return;
  initTrackingScripts(settings, consent);
}

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
  const currentRegion = useSelector((state) => state.region.currentRegion);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && normalizeHost(window.location.hostname) === COM_HOST) {
      fetch(getApiUrl('/api/geo/'))
        .then((r) => (r.ok ? r.json() : null))
        .then((geo) => {
          // The .com domain defaults to India. A confident non-Indian location
          // may still be routed to the UK, while an unavailable geo service
          // must never silently override that India default.
          const isIndia = !geo || geo.source === 'fallback' || geo.region_code === 'IN';
          const target = hostForRegion(isIndia ? 'IN' : 'UK');
          const { pathname, search } = window.location;
          window.location.replace(`https://${target}${pathname}${search}`);
        })
        .catch(() => {
          window.location.replace(`https://${hostForRegion('IN')}${window.location.pathname}`);
        });
      return;
    }

    // Carts are identified by an HttpOnly cookie now; drop the old guessable id.
    try {
      localStorage.removeItem('sclero_session_id');
    } catch {
      /* storage unavailable */
    }

    const consent = readCookieConsent();
    if (consent) loadTracking(activeTrackingSettings, consent);

    // Load store-wide config (tax mode + guest checkout + branding) once on boot.
    fetch(getApiUrl('/api/store-config/'))
      .then((r) => (r.ok ? r.json() : null))
      .then((cfg) => {
        if (cfg && cfg.tax_mode) dispatch(setTaxMode(cfg.tax_mode));
        if (cfg && typeof cfg.guest_checkout_enabled !== 'undefined') {
          dispatch(setGuestCheckoutEnabled(cfg.guest_checkout_enabled));
        }
        if (cfg) {
          dispatch(setBranding({
            ...(cfg.branding || {}),
            companyInfo: cfg.company_info || {},
            socialLinks: cfg.social_links || {},
          }));
        }

        // Dynamically override tracking settings from DB if configured
        const seo = cfg?.seo_settings || {};
        const isIndia = hostRegion === 'IN' || (typeof window !== 'undefined' && window.location.hostname.endsWith('.in'));
        
        activeTrackingSettings = {
          google_analytics_id: (isIndia ? seo.googleAnalyticsIN : seo.googleAnalytics) || process.env.NEXT_PUBLIC_GA4_ID || '',
          google_gtm_id: seo.gtm || process.env.NEXT_PUBLIC_GTM_ID || '',
          meta_pixel_id: seo.fbPixel || process.env.NEXT_PUBLIC_META_PIXEL_ID || '',
          tiktok_pixel_id: process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID || '',
        };
        
        if (consent && !onTokenLinkPage()) {
          // Re-initialize scripts with DB settings
          window.__scleroTrackingInitialized = false;
          loadTracking(activeTrackingSettings, consent);
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
      if (onTokenLinkPage()) return;
      window.__scleroTrackingInitialized = false;
      loadTracking(activeTrackingSettings, event.detail || {});
    };
    window.addEventListener('cookie-consent-updated', onConsentUpdated);

    // On a real ccTLD (scleroproteins.in / .co.uk) the DOMAIN is authoritative
    // for currency/tax: we hydrate the full Region object from the backend.
    const hostRegion = regionFromHost(typeof window !== 'undefined' ? window.location.hostname : '');
    if (hostRegion) {
      fetch(getApiUrl(`/api/detect-region/?country=${hostRegion === 'IN' ? 'IN' : 'GB'}`))
        .then((res) => res.json())
        .then((data) => {
          dispatch(setRegion(data.region));
          dispatch(fetchCart({ region: data.region.code }));
          setReady(true);
        })
        .catch(() => {
          dispatch(fetchCart({ region: hostRegion }));
          setReady(true);
        });

      // Geo correction for deploys without an edge geo header (plain VPS):
      // the middleware can only redirect when Cloudflare/Vercel stamps the
      // country, so a shopper who lands on the wrong ccTLD directly (e.g. an
      // Indian visitor opening the .co.uk site from a search result) would
      // otherwise stay there. Ask the backend once per session; move them only
      // on a CONFIDENT signal, and never when they explicitly chose a region.
      const hasRegionCookie = document.cookie.split('; ').some((c) => c.startsWith('sclero_region='));
      const userChose = hasRegionCookie || localStorage.getItem('sclero_region_set') === 'true';
      const alreadyChecked = sessionStorage.getItem('sclero_geo_checked') === 'true';
      // Emailed-link pages remove their token from the URL straight away, so
      // moving them to the other domain afterwards would lose the token.
      if (!userChose && !alreadyChecked && !onTokenLinkPage()) {
        sessionStorage.setItem('sclero_geo_checked', 'true');
        fetch(getApiUrl('/api/geo/'))
          .then((r) => (r.ok ? r.json() : null))
          .then((geo) => {
            if (!geo || geo.source === 'fallback') return;
            const target = geo.region_code === 'IN' ? 'IN' : 'UK';
            if (target === hostRegion) return;
            const { pathname, search } = window.location;
            // Plain redirect, no set_region: this is an automatic correction,
            // not an explicit choice, so the shopper can still switch manually.
            window.location.replace(`https://${hostForRegion(target)}${pathname}${search}`);
          })
          .catch(() => {});
      }
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
        dispatch(fetchCart({ region: data.region.code }));
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
                dispatch(fetchCart({ region: d.region.code }));
              });
          })
          .catch(() => {});
      })
      .catch(() => {
        dispatch(fetchCart({ region: 'UK' }));
        setReady(true);
      });

    return () => window.removeEventListener('cookie-consent-updated', onConsentUpdated);
  }, [dispatch]);

  return { currentRegion, ready };
}
