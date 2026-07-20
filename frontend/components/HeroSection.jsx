'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { getApiUrl } from '../lib/api';

const FALLBACK_SLIDES = [
  {
    id: 'unconfigured',
    eyebrow: '',
    heading: '',
    subheading: '',
    desktop_media_url: '',
    tablet_media_url: '',
    mobile_media_url: '',
    media_type: 'IMAGE',
    alt_text: '',
    text_position: 'LEFT',
    vertical_position: 'CENTER',
    arrow_position: 'HIDDEN',
    overlay_opacity: 24,
    autoplay_enabled: true,
    show_indicators: true,
    display_duration_ms: 6500,
    transition_ms: 500,
  },
];

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  return reduced;
}

function getPositionClasses(position) {
  if (position === 'CENTER') return 'items-center text-center mx-auto';
  if (position === 'RIGHT') return 'items-end text-right ml-auto';
  return 'items-start text-left mr-auto';
}

function getVerticalPositionClasses(position) {
  if (position === 'TOP') return 'items-start pt-12 sm:pt-16 lg:pt-20';
  if (position === 'CENTER') return 'items-center py-12';
  return 'items-end pb-12 sm:pb-16 lg:pb-20';
}

function SlideMedia({ slide, active, index }) {
  const media = slide.desktop_media_url || slide.tablet_media_url || slide.mobile_media_url;
  if (!media) return <div className="absolute inset-0 bg-surface-muted" />;

  if (slide.media_type === 'VIDEO') {
    return (
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        muted
        loop
        playsInline
        preload={active ? 'metadata' : 'none'}
        aria-label={slide.alt_text || slide.heading}
      >
        <source src={media} />
      </video>
    );
  }

  return (
    <picture>
      {slide.mobile_media_url && <source media="(max-width: 640px)" srcSet={slide.mobile_media_url} />}
      {slide.tablet_media_url && <source media="(max-width: 1024px)" srcSet={slide.tablet_media_url} />}
      <img
        src={media}
        alt={slide.alt_text || slide.heading}
        className="absolute inset-0 h-full w-full object-cover"
        loading={index === 0 ? 'eager' : 'lazy'}
        fetchPriority={index === 0 ? 'high' : 'auto'}
      />
    </picture>
  );
}

export default function HeroSection() {
  const reducedMotion = useReducedMotion();
  const [slides, setSlides] = useState(FALLBACK_SLIDES);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const current = slides[active] || slides[0];
  const transitionMs = reducedMotion ? 0 : Number(current?.transition_ms || 500);
  const autoplay = Boolean(current?.autoplay_enabled) && slides.length > 1 && !reducedMotion;

  useEffect(() => {
    let cancelled = false;
    fetch(getApiUrl('/api/admin/hero-banners/active/'))
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) && data.length > 0 ? data : FALLBACK_SLIDES;
        setSlides(list);
        setActive(0);
      })
      .catch(() => {
        if (!cancelled) setSlides(FALLBACK_SLIDES);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!autoplay || paused) return undefined;
    const timer = window.setTimeout(() => {
      setActive((idx) => (idx + 1) % slides.length);
    }, Math.max(2500, Number(current?.display_duration_ms || 6500)));
    return () => window.clearTimeout(timer);
  }, [autoplay, paused, slides.length, current?.display_duration_ms]);

  const contentClass = useMemo(() => getPositionClasses(current?.text_position), [current?.text_position]);
  const verticalClass = useMemo(() => getVerticalPositionClasses(current?.vertical_position), [current?.vertical_position]);
  const arrowPos = current?.arrow_position || 'BOTTOM';

  const go = (direction) => {
    setActive((idx) => {
      if (direction === 'prev') return (idx - 1 + slides.length) % slides.length;
      return (idx + 1) % slides.length;
    });
  };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowLeft') go('prev');
    if (event.key === 'ArrowRight') go('next');
  };

  return (
    <section
      aria-label="Featured campaigns"
      className="relative isolate overflow-hidden bg-surface"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      onKeyDown={onKeyDown}
    >
      <div className="absolute inset-0">
        {slides.map((slide, index) => (
          <div
            key={slide.id || index}
            aria-hidden={active !== index}
            className={`absolute inset-0 transition-opacity ease-out ${active === index ? 'opacity-100' : 'opacity-0'}`}
            style={{ transitionDuration: `${transitionMs}ms` }}
          >
            <SlideMedia slide={slide} active={active === index} index={index} />
          </div>
        ))}
        {/* Legibility scrim */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/45 to-black/15" />
      </div>

      <div className={`relative z-10 mx-auto flex min-h-[420px] max-w-container px-4 sm:min-h-[480px] sm:px-6 lg:min-h-[540px] lg:px-6 ${verticalClass}`}>
        <div className={`flex max-w-2xl flex-col ${contentClass}`}>
          {current?.eyebrow && (
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.5)]">
              {current.eyebrow}
            </p>
          )}
          {current?.heading && (
            <h1 className="max-w-[13ch] text-display text-white [text-shadow:0_2px_20px_rgba(0,0,0,0.55)]">
              {current.heading}
            </h1>
          )}
          {current?.subheading && (
            <p className="mt-4 max-w-xl text-base leading-[1.8] text-white sm:text-lg [text-shadow:0_1px_14px_rgba(0,0,0,0.5)]">
              {current.subheading}
            </p>
          )}
        </div>
      </div>

      {/* Navigation Arrows Controls (Bottom, Centered Sides, or Hidden) */}
      {slides.length > 1 && arrowPos !== 'HIDDEN' && (
        arrowPos === 'SIDES' ? (
          <>
            <button
              type="button"
              onClick={() => go('prev')}
              className="absolute left-4 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white transition hover:bg-black/70 cursor-pointer shadow-lg backdrop-blur-xs"
              aria-label="Previous hero banner"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => go('next')}
              className="absolute right-4 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/40 text-white transition hover:bg-black/70 cursor-pointer shadow-lg backdrop-blur-xs"
              aria-label="Next hero banner"
            >
              <ArrowRight className="h-5 w-5" />
            </button>
          </>
        ) : (
          <div className="absolute bottom-5 left-6 z-20 flex items-center gap-2">
            <button
              type="button"
              onClick={() => go('prev')}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/30 text-white transition hover:bg-black/60 cursor-pointer"
              aria-label="Previous hero banner"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => go('next')}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/30 text-white transition hover:bg-black/60 cursor-pointer"
              aria-label="Next hero banner"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )
      )}
    </section>
  );
}
