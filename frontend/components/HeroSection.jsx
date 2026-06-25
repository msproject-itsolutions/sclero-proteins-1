'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Award, HeartPulse, Pause, Play, ShieldCheck } from 'lucide-react';
import { getApiUrl } from '../lib/api';

const FALLBACK_SLIDES = [
  {
    id: 'fallback-bjc',
    eyebrow: 'BJC® Bone & Joint Care',
    heading: 'Mobility support, backed by science.',
    subheading:
      'Clinically informed bone and joint nutrition with transparent active ingredients, GMP manufacturing, and regional fulfilment.',
    desktop_media_url:
      'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=1800&auto=format&fit=crop&q=80',
    tablet_media_url:
      'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=1200&auto=format&fit=crop&q=78',
    mobile_media_url:
      'https://images.unsplash.com/photo-1559757175-5700dde675bc?w=900&auto=format&fit=crop&q=76',
    media_type: 'IMAGE',
    alt_text: 'Sclero Proteins joint care supplement campaign image',
    primary_cta_label: 'Shop BJC®',
    primary_cta_url: '/products/BJC-BONE-JOINT',
    secondary_cta_label: 'View all products',
    secondary_cta_url: '/products',
    text_position: 'LEFT',
    overlay_opacity: 48,
    autoplay_enabled: true,
    show_indicators: true,
    display_duration_ms: 6500,
    transition_ms: 500,
  },
];

const proofPoints = [
  { label: 'GMP certified facility', icon: ShieldCheck },
  { label: 'Third-party lab tested', icon: Award },
  { label: 'Label transparency', icon: HeartPulse },
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
  if (position === 'CENTER') {
    return 'items-center text-center mx-auto';
  }
  if (position === 'RIGHT') {
    return 'items-center text-center lg:items-end lg:text-right lg:ml-auto';
  }
  return 'items-center text-center lg:items-start lg:text-left';
}

function SlideMedia({ slide, active, index }) {
  const media = slide.desktop_media_url || slide.tablet_media_url || slide.mobile_media_url;
  if (!media) {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-brand-indigo via-brand-purple to-brand-plum" />
    );
  }

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

  const overlay = Math.min(90, Math.max(0, Number(current?.overlay_opacity ?? 42))) / 100;
  const contentClass = useMemo(() => getPositionClasses(current?.text_position), [current?.text_position]);

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
      className="relative isolate min-h-[calc(100svh-73px)] overflow-hidden bg-brand-navy text-white"
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
        <div className="absolute inset-0" style={{ backgroundColor: `rgba(8, 13, 30, ${overlay})` }} />
        <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-black/35" />
      </div>

      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-73px)] max-w-7xl items-center px-4 py-16 sm:px-6 lg:px-8">
        <div className={`flex max-w-2xl flex-col ${contentClass}`}>
          {current?.eyebrow && (
            <p className="mb-5 text-[11px] font-black uppercase tracking-[0.18em] text-white/80">
              {current.eyebrow}
            </p>
          )}

          <h1 className="max-w-3xl text-4xl font-black leading-[0.98] tracking-tight sm:text-5xl lg:text-7xl">
            {current?.heading}
          </h1>

          {current?.subheading && (
            <p className="mt-6 max-w-xl text-sm leading-6 text-white/82 sm:text-base lg:text-lg">
              {current.subheading}
            </p>
          )}

          <div className="mt-9 flex flex-wrap justify-center gap-3 lg:justify-start">
            {current?.primary_cta_label && current?.primary_cta_url && (
              <Link href={current.primary_cta_url} className="btn-primary px-7 py-3 text-sm">
                {current.primary_cta_label}
              </Link>
            )}
            {current?.secondary_cta_label && current?.secondary_cta_url && (
              <Link href={current.secondary_cta_url} className="inline-flex items-center justify-center rounded-full border border-white/40 bg-white/10 px-7 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/18">
                {current.secondary_cta_label}
              </Link>
            )}
          </div>

          <div className="mt-10 flex flex-wrap justify-center gap-4 text-xs font-semibold text-white/78 lg:justify-start">
            {proofPoints.map((point) => {
              const Icon = point.icon;
              return (
                <span key={point.label} className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4 text-white" />
                  {point.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {slides.length > 1 && (
        <div className="absolute bottom-5 left-0 right-0 z-20 mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => go('prev')}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/20 text-white backdrop-blur transition hover:bg-white/15"
              aria-label="Previous hero banner"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => go('next')}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/20 text-white backdrop-blur transition hover:bg-white/15"
              aria-label="Next hero banner"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
            {autoplay && (
              <button
                type="button"
                onClick={() => setPaused((value) => !value)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/20 text-white backdrop-blur transition hover:bg-white/15"
                aria-label={paused ? 'Resume hero banner autoplay' : 'Pause hero banner autoplay'}
              >
                {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </button>
            )}
          </div>

          {current?.show_indicators !== false && (
            <div className="flex items-center gap-2" role="tablist" aria-label="Hero banner slides">
              {slides.map((slide, index) => (
                <button
                  key={slide.id || index}
                  type="button"
                  role="tab"
                  aria-selected={active === index}
                  aria-label={`Show banner ${index + 1}: ${slide.title || slide.heading}`}
                  onClick={() => setActive(index)}
                  className={`h-2 rounded-full transition-all ${
                    active === index ? 'w-8 bg-white' : 'w-2 bg-white/45 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
