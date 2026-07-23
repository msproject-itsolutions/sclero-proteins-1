'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen } from 'lucide-react';
import { getApiUrl } from '../lib/api';
import { safePublicHref } from '../lib/safeUrl';
import EggOText from './EggOText';

// Brand defaults for every admin-themable color. A slide with a blank color
// field inherits these, so un-themed slides look exactly as before.
const BRAND_COLORS = {
  overlay_color_start: '#090C3A',
  overlay_color_mid: '#101871',
  overlay_color_end: '#1E083B',
  accent_color: '#F5A227',
};

const HEX_COLOR_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

// Colors land in inline styles, so accept strict hex only even though the API
// already validates — a defense-in-depth guard against style injection.
function slideColor(slide, key) {
  const value = slide?.[key];
  if (typeof value === 'string' && HEX_COLOR_RE.test(value)) return value;
  return BRAND_COLORS[key] || '';
}

function hexToRgba(hex, alpha) {
  const value = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;
  const r = parseInt(value.slice(1, 3), 16);
  const g = parseInt(value.slice(3, 5), 16);
  const b = parseInt(value.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

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
  const overlayOpacity = Math.min(0.88, Math.max(0.18, Number(current?.overlay_opacity ?? 42) / 100));
  const primaryCtaHref = safePublicHref(current?.primary_cta_url);
  const secondaryCtaHref = safePublicHref(current?.secondary_cta_url);

  // Admin-managed slide theme; blank fields fall back to brand styling.
  const overlayGradient = `linear-gradient(90deg, ${slideColor(current, 'overlay_color_start')} 0%, ${slideColor(current, 'overlay_color_mid')} 48%, ${slideColor(current, 'overlay_color_end')} 100%)`;
  const eyebrowColor = slideColor(current, 'eyebrow_color');
  const headingColor = slideColor(current, 'heading_color');
  const subheadingColor = slideColor(current, 'subheading_color');
  const primaryCtaBg = slideColor(current, 'primary_cta_bg_color');
  const primaryCtaText = slideColor(current, 'primary_cta_text_color');
  const secondaryCtaBg = slideColor(current, 'secondary_cta_bg_color');
  const secondaryCtaText = slideColor(current, 'secondary_cta_text_color');
  const accentColor = slideColor(current, 'accent_color');
  const primaryCtaStyle = (primaryCtaBg || primaryCtaText)
    ? {
        ...(primaryCtaBg ? { background: primaryCtaBg, boxShadow: `0 18px 38px -16px ${hexToRgba(primaryCtaBg, 0.72)}` } : {}),
        ...(primaryCtaText ? { color: primaryCtaText } : {}),
      }
    : undefined;
  const secondaryCtaStyle = (secondaryCtaBg || secondaryCtaText)
    ? {
        ...(secondaryCtaBg ? { background: secondaryCtaBg } : {}),
        ...(secondaryCtaText ? { color: secondaryCtaText } : {}),
      }
    : undefined;

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
        {/* Legibility scrim — gradient colors are managed per slide in the admin */}
        <div
          className="absolute inset-0"
          style={{ background: overlayGradient, opacity: overlayOpacity }}
        />
      </div>

      <div className={`relative z-10 mx-auto flex min-h-[420px] max-w-container px-4 sm:min-h-[480px] sm:px-6 lg:min-h-[540px] lg:px-6 ${verticalClass}`}>
        {(current?.eyebrow || current?.heading || current?.subheading) && (
        <div className={`flex max-w-2xl flex-col ${contentClass}`}>
          {current?.eyebrow && (
            <p
              className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/90 [text-shadow:0_1px_12px_rgba(0,0,0,0.5)]"
              style={eyebrowColor ? { color: eyebrowColor } : undefined}
            >{current.eyebrow}</p>
          )}
          {current?.heading && (
            <h1
              className={`brand-hero-heading max-w-[13ch] text-display${headingColor ? ' brand-hero-heading--custom' : ''}`}
              style={headingColor ? { '--hero-heading-color': headingColor } : undefined}
            >
              <EggOText text={current.heading} tone="hero" preferBrandWord={false} />
            </h1>
          )}
          {current?.subheading && (
            <p
              className="mt-4 max-w-xl text-base leading-[1.8] text-white sm:text-lg [text-shadow:0_1px_14px_rgba(0,0,0,0.5)]"
              style={subheadingColor ? { color: subheadingColor } : undefined}
            >
              {current.subheading}
            </p>
          )}
          {(current?.primary_cta_label || current?.secondary_cta_label) && (
            <div className={`mt-7 flex flex-wrap gap-3 ${current?.text_position === 'CENTER' ? 'justify-center' : current?.text_position === 'RIGHT' ? 'justify-end' : ''}`}>
              {current?.primary_cta_label && primaryCtaHref && (
                <Link href={primaryCtaHref} className="hero-action-primary" style={primaryCtaStyle}>
                  {current.primary_cta_label} <ArrowUpRight className="h-4 w-4" />
                </Link>
              )}
              {current?.secondary_cta_label && secondaryCtaHref && (
                <Link href={secondaryCtaHref} className="hero-action-secondary" style={secondaryCtaStyle}>
                  <BookOpen className="h-4 w-4" /> {current.secondary_cta_label}
                </Link>
              )}
            </div>
          )}
        </div>
        )}
      </div>

      {slides.length > 1 && current?.show_indicators !== false && (
        <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2" aria-label="Select featured campaign">
          {slides.map((slide, index) => (
            <button
              key={slide.id || index}
              type="button"
              onClick={() => setActive(index)}
              className={`h-2 rounded-full transition-all duration-300 ${index === active ? 'w-7' : 'w-2 bg-white/55 hover:bg-white'}`}
              style={index === active ? { backgroundColor: accentColor } : undefined}
              aria-label={`Show campaign ${index + 1}`}
              aria-current={index === active ? 'true' : undefined}
            />
          ))}
        </div>
      )}

      {/* Navigation Arrows Controls (Bottom, Centered Sides, or Hidden) */}
      {slides.length > 1 && arrowPos !== 'HIDDEN' && (
        arrowPos === 'SIDES' ? (
          <>
            <button
              type="button"
              onClick={() => go('prev')}
              className="absolute left-4 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white/90 transition hover:bg-black/50 cursor-pointer"
              aria-label="Previous hero banner"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => go('next')}
              className="absolute right-4 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white/90 transition hover:bg-black/50 cursor-pointer"
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
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/25 text-white/90 transition hover:bg-black/50 cursor-pointer"
              aria-label="Previous hero banner"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => go('next')}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/25 text-white/90 transition hover:bg-black/50 cursor-pointer"
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
