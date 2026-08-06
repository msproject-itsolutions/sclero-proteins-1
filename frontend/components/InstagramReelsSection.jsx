'use client';

import React, { useEffect, useState } from 'react';
import { Instagram, ExternalLink, RefreshCw } from 'lucide-react';

export default function InstagramReelsSection({ settings = {} }) {
  if (settings.enabled === false) return null;

  const profileUrl = settings.profileUrl || 'https://www.instagram.com/scleroproteins/';
  const handle = profileUrl.split('instagram.com/')[1]?.replace(/\/+$/, '') || 'scleroproteins';
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const processEmbeds = () => {
      if (window.instgrm?.Embeds?.process) {
        window.instgrm.Embeds.process();
        if (isMounted) setLoaded(true);
      }
    };

    if (window.instgrm) {
      processEmbeds();
    } else {
      const existingScript = document.querySelector('script[src="https://www.instagram.com/embed.js"]');
      if (!existingScript) {
        const script = document.createElement('script');
        script.src = 'https://www.instagram.com/embed.js';
        script.async = true;
        script.onload = processEmbeds;
        document.body.appendChild(script);
      } else {
        existingScript.addEventListener('load', processEmbeds);
        processEmbeds();
      }
    }

    // Safety timer to show fallback card if script is blocked or delayed
    const timer = setTimeout(() => {
      if (isMounted) setLoaded(true);
    }, 2000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [profileUrl]);

  return (
    <section className="energy-tint-section section border-y border-edge bg-[#f8f7fb] py-12 md:py-16">
      <style flex="true">{`
        .instagram-embed-wrapper iframe.instagram-media,
        .instagram-embed-wrapper iframe {
          margin-left: auto !important;
          margin-right: auto !important;
          display: block !important;
          float: none !important;
          max-width: 540px !important;
          width: 100% !important;
          border-radius: 12px !important;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.04) !important;
        }
      `}</style>
      <div className="container-page">
        <div className="mx-auto max-w-2xl text-center">
          <span className="kicker">{settings.kicker || 'Follow Our Journey'}</span>
          <h2 className="text-heading-1 mt-3 text-[#101871]">
            {settings.title || 'Sclero Proteins on Instagram'}
          </h2>
          <p className="mt-4 text-body">
            {settings.description || `Product stories, science-led wellness notes, and everyday routines from @${handle}.`}
          </p>
          <div className="mt-5 flex justify-center">
            <a
              href={profileUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold shadow-card hover:scale-105 transition-all"
            >
              <Instagram className="h-4 w-4 text-white" />
              Follow @{handle}
              <ExternalLink className="h-3.5 w-3.5 opacity-80" />
            </a>
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-center">
          <div className="instagram-embed-wrapper flex w-full max-w-[540px] items-center justify-center text-center">
            <blockquote
              className="instagram-media"
              data-instgrm-permalink={profileUrl}
              data-instgrm-version="13"
              style={{
                width: '100%',
                maxWidth: '540px',
                margin: '0 auto',
                background: '#ffffff',
                borderRadius: '12px',
                padding: '0',
              }}
            >
              {/* Fallback card shown while Instagram embed JS initializes */}
              <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-edge bg-white shadow-card">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-gradient text-white shadow-card mb-3">
                  <Instagram className="h-7 w-7" />
                </div>
                <h3 className="text-base font-bold text-ink-primary">@{handle}</h3>
                <p className="text-xs text-ink-muted mt-1 max-w-xs">
                  {settings.description || 'Visit our official Instagram page for latest posts, stories & health tips.'}
                </p>
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-ink-primary bg-surface-subtle px-5 py-2 text-xs font-semibold text-ink-primary hover:bg-ink-primary hover:text-white transition-all"
                >
                  View Profile on Instagram
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </blockquote>
          </div>
        </div>
      </div>
    </section>
  );
}
