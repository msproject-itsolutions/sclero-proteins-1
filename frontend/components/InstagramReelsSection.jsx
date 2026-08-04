'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Instagram, Play } from 'lucide-react';
import { getApiUrl } from '../lib/api';

const PROFILE_URL = 'https://www.instagram.com/scleroproteins/';

function toEmbedUrl(value) {
  try {
    const url = new URL(value);
    if (!/(^|\.)instagram\.com$/i.test(url.hostname)) return '';
    const match = url.pathname.match(/^\/reel\/([^/]+)/i);
    return match ? `https://www.instagram.com/reel/${match[1]}/embed/captioned/` : '';
  } catch {
    return '';
  }
}

export default function InstagramReelsSection({ settings = {} }) {
  const scrollerRef = useRef(null);
  const [automaticReels, setAutomaticReels] = useState(null);
  const [activeReel, setActiveReel] = useState(null);
  const fallbackReels = Array.isArray(settings.reels) ? settings.reels : [];

  useEffect(() => {
    const controller = new AbortController();
    fetch(getApiUrl('/api/instagram/reels/'), { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((payload) => {
        if (payload?.configured && Array.isArray(payload.reels)) setAutomaticReels(payload.reels);
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setAutomaticReels([]);
      });
    return () => controller.abort();
  }, []);

  const reels = useMemo(
    () => (automaticReels ?? fallbackReels)
      .map((reel) => ({ ...reel, embedUrl: toEmbedUrl(reel?.url) }))
      .filter((reel) => reel.embedUrl),
    [automaticReels, fallbackReels],
  );
  const profileUrl = settings.profileUrl || PROFILE_URL;

  useEffect(() => {
    setActiveReel((current) => reels.find((reel) => reel.embedUrl === current?.embedUrl) || reels[0] || null);
  }, [reels]);

  const scroll = (direction) => scrollerRef.current?.scrollBy({
    left: direction * Math.max(scrollerRef.current.clientWidth * 0.75, 280),
    behavior: 'smooth',
  });

  return (
    <section className="bg-[#f8f7fb] py-16 sm:py-20">
      <div className="container-page">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <span className="kicker">{settings.kicker || 'Follow our journey'}</span>
            <h2 className="text-heading-1 mt-3 text-[#101871]">{settings.title || 'Sclero Proteins on Instagram'}</h2>
            <p className="mt-4 text-body">{settings.description || 'Product stories, science-led wellness notes, and everyday routines from @scleroproteins.'}</p>
          </div>
          <a href={profileUrl} target="_blank" rel="noreferrer" className="btn-ghost inline-flex w-fit items-center gap-2 px-5 py-3 text-sm">
            <Instagram className="h-4 w-4" /> Follow @scleroproteins
          </a>
        </div>

        {reels.length ? (
          <>
            <div className="mt-9 flex items-center justify-end gap-2" aria-label="Reel carousel controls">
              <button type="button" onClick={() => scroll(-1)} className="rounded-full border border-edge bg-white p-2 text-ink-primary transition hover:border-[#101871]" aria-label="Previous reels"><ChevronLeft className="h-4 w-4" /></button>
              <button type="button" onClick={() => scroll(1)} className="rounded-full border border-edge bg-white p-2 text-ink-primary transition hover:border-[#101871]" aria-label="Next reels"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <div ref={scrollerRef} className="mt-3 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 [scrollbar-width:none]">
              {reels.map((reel, index) => (
                <button key={reel.id || reel.embedUrl} type="button" onClick={() => setActiveReel(reel)} className="group relative aspect-[9/14] w-[72vw] max-w-[260px] shrink-0 snap-start overflow-hidden rounded-2xl bg-[linear-gradient(160deg,#101871_0%,#4e165f_54%,#f5a227_150%)] p-5 text-left shadow-card transition hover:-translate-y-1 hover:shadow-elevated sm:w-[240px]">
                  {reel.thumbnailUrl && <img src={reel.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70 transition duration-300 group-hover:scale-105" loading="lazy" />}
                  <span className="absolute inset-0 bg-[linear-gradient(180deg,rgba(16,24,113,.12)_10%,rgba(16,24,113,.88)_100%)]" />
                  <span className="relative inline-flex rounded-full border border-white/20 bg-white/10 p-2 text-white"><Instagram className="h-4 w-4" /></span>
                  <div className="absolute inset-x-5 bottom-5 text-white"><span className="mb-3 inline-flex rounded-full bg-white p-2 text-[#101871]"><Play className="h-4 w-4 fill-current" /></span><p className="line-clamp-2 text-sm font-semibold">{reel.title || `Watch reel ${index + 1}`}</p><p className="mt-1 text-xs text-white/70">@scleroproteins</p></div>
                </button>
              ))}
            </div>
            {activeReel && (
              <div className="mt-8 overflow-hidden rounded-2xl border border-edge bg-white shadow-card">
                <div className="flex items-center justify-between border-b border-edge-subtle px-5 py-3"><p className="text-sm font-semibold text-ink-primary">{activeReel.title || 'Instagram Reel'}</p><a href={activeReel.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-ink-accent hover:text-[#101871]">Open on Instagram</a></div>
                <div className="flex min-h-[540px] justify-center bg-surface-muted"><iframe title={activeReel.title || 'Instagram Reel'} src={activeReel.embedUrl} className="h-[540px] w-full max-w-[430px] border-0" loading="lazy" allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share" /></div>
              </div>
            )}
          </>
        ) : (
          <div className="mt-8 rounded-2xl border border-dashed border-[#101871]/20 bg-white px-6 py-10 text-center"><Instagram className="mx-auto h-7 w-7 text-[#101871]" /><p className="mt-3 font-semibold text-ink-primary">New reels are shared on Instagram.</p><p className="mt-1 text-sm text-brand-muted">Follow @scleroproteins to watch the latest product and wellness videos.</p></div>
        )}
      </div>
    </section>
  );
}
