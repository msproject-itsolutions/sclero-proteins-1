/**
 * Sclero Proteins Conversion and Analytics Tracking Utility
 * Manages tracking events for Google Analytics 4, GTM, Meta Pixel, and TikTok Pixel.
 */

const isValidId = (id) => {
  if (!id) return false;
  const s = String(id).trim().toLowerCase();
  return s !== '' && s !== 'null' && s !== 'undefined' && !s.includes('mock') && !s.includes('todo');
};

export const initTrackingScripts = (settings = {}, consent = {}) => {
  if (typeof window === 'undefined') return;

  if (window.__scleroTrackingInitialized) return;

  const allowAnalytics = Boolean(consent.analytics);
  const allowMarketing = Boolean(consent.marketing);

  // 1. Google Tag Manager / GA4
  if (allowAnalytics && isValidId(settings.google_analytics_id)) {
    const gaScript = document.createElement('script');
    gaScript.async = true;
    gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${settings.google_analytics_id}`;
    document.head.appendChild(gaScript);

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', settings.google_analytics_id);
  }

  // 2. Meta Pixel (Facebook)
  if (allowMarketing && isValidId(settings.meta_pixel_id)) {
    /* eslint-disable */
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = '2.0';
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    
    fbq('init', settings.meta_pixel_id);
    fbq('track', 'PageView');
  }

  // 3. TikTok Pixel
  if (allowMarketing && isValidId(settings.tiktok_pixel_id)) {
    !(function (w, d, t) {
      w.TiktokAnalyticsObject = t;
      var ttq = (w[t] = w[t] || []);
      (ttq.methods = [
        'page', 'track', 'identify', 'instances', 'debug', 'on', 'off',
        'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie',
      ]),
        (ttq.setAndDefer = function (e, t) {
          e[t] = function () {
            e.push([t].concat(Array.prototype.slice.call(arguments, 0)));
          };
        });
      for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
      (ttq.instance = function (e) {
        for (var t = ttq._i[e] || [], n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(t, ttq.methods[n]);
        return t;
      }),
        (ttq.load = function (e, n) {
          var i = 'https://analytics.tiktok.com/i18n/pixel/events.js';
          (ttq._i = ttq._i || {}),
            (ttq._i[e] = []),
            (ttq._i[e]._u = i),
            (ttq._t = ttq._t || +new Date()),
            (ttq._o = ttq._o || {}),
            (ttq._o[e] = n || {});
          var o = d.createElement('script');
          (o.type = 'text/javascript'), (o.async = !0), (o.src = i);
          var a = d.getElementsByTagName('script')[0];
          a.parentNode.insertBefore(o, a);
        });
    })(window, document, 'ttq');
    
    ttq.load(settings.tiktok_pixel_id);
    ttq.page();
  }

  window.__scleroTrackingInitialized = true;
};

/**
 * Tracks custom e-commerce conversion events
 */
export const trackEvent = (eventName, data = {}) => {
  if (typeof window === 'undefined') return;

  // Send to Google Analytics (gtag)
  if (window.gtag) {
    window.gtag('event', eventName, data);
  }

  // Send to Meta Pixel
  if (window.fbq) {
    window.fbq('track', eventName, data);
  }

  // Send to TikTok Pixel
  if (window.ttq) {
    window.ttq.track(eventName, data);
  }
};
