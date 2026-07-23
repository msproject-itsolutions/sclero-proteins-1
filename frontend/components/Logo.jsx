import React from 'react';

/**
 * Brand mark — the official Sclero Proteins swan-"S" symbol.
 * Renders the real logo asset (transparent PNG derived from logo-full.png).
 * Sizing is driven by the passed `className` (e.g. "h-8 w-8") so every
 * existing caller keeps working unchanged.
 */
export default function Logo({ className = 'h-8 w-8', alt = 'Sclero Proteins', src = '/logo-mark.png' }) {
  return (
    <img
      src={src}
      alt={alt}
      className={`${className} select-none object-contain`}
      decoding="async"
      draggable={false}
    />
  );
}

/**
 * Full horizontal brand lockup — the official swan mark next to the official
 * navy "Sclero Proteins®" wordmark artwork (cropped from logo-lockup.png).
 * Use this wherever the brand name appears next to the mark so the logo is
 * always the real artwork, never recreated in HTML text.
 *
 * `inverse` renders the wordmark in white (standard reversed treatment) for
 * dark surfaces like the footer.
 */
export function LogoLockup({
  markClass = 'h-9 w-9',
  wordClass = 'h-5',
  inverse = false,
  alt = 'Sclero Proteins',
  assetSrc = null,
  showMarkWithAsset = false,
  markSrc = '/logo-mark.png',
  wordmarkSrc = '/logo-header-wordmark.png',
}) {
  if (assetSrc) {
    if (showMarkWithAsset) {
      return (
        <span className="flex items-center gap-3">
          <img
            src={markSrc}
            alt=""
            aria-hidden="true"
            className={`${markClass} shrink-0 select-none object-contain`}
            decoding="async"
            draggable={false}
          />
          <img
            src={assetSrc}
            alt={alt}
            className={`${wordClass} w-auto max-w-none select-none object-contain ${inverse ? 'brightness-0 invert' : ''}`}
            decoding="async"
            draggable={false}
          />
        </span>
      );
    }

    return (
      <img
        src={assetSrc}
        alt={alt}
        className={`${wordClass} w-auto max-w-none select-none object-contain ${inverse ? 'brightness-0 invert' : ''}`}
        decoding="async"
        draggable={false}
      />
    );
  }

  return (
    <span className="flex items-center gap-2.5">
      <img
        src={markSrc}
        alt=""
        aria-hidden="true"
        className={`${markClass} shrink-0 select-none object-contain`}
        decoding="async"
        draggable={false}
      />
      <img
        src={wordmarkSrc}
        alt={alt}
        className={`${wordClass} w-auto max-w-none select-none object-contain ${inverse ? 'brightness-0 invert' : ''}`}
        decoding="async"
        draggable={false}
      />
    </span>
  );
}
