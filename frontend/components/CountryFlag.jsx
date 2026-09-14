import React from 'react';

/**
 * Clean, lightweight SVG country flags for responsive display.
 * Supported region codes: GB/UK, IN, US, EU, AE.
 */
export default function CountryFlag({ code, className = 'w-5 h-3.5 inline-block rounded-xs shadow-xs', title }) {
  const norm = (code || '').toUpperCase().trim();
  const flagTitle = title || norm;

  if (norm === 'GB' || norm === 'UK') {
    return (
      <svg
        viewBox="0 0 60 30"
        className={className}
        aria-label={flagTitle}
        role="img"
      >
        <clipPath id="gb-clip">
          <path d="M0,0 v30 h60 v-30 z" />
        </clipPath>
        <clipPath id="gb-diag">
          <path d="M0,0 L60,30 M60,0 L0,30" />
        </clipPath>
        <path d="M0,0 v30 h60 v-30 z" fill="#012169" />
        <path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" strokeWidth="6" />
        <path d="M0,0 L60,30 M60,0 L0,30" clipPath="url(#gb-diag)" stroke="#C8102E" strokeWidth="4" />
        <path d="M30,0 v30 M0,15 h60" stroke="#fff" strokeWidth="10" />
        <path d="M30,0 v30 M0,15 h60" stroke="#C8102E" strokeWidth="6" />
      </svg>
    );
  }

  if (norm === 'IN') {
    return (
      <svg
        viewBox="0 0 60 40"
        className={className}
        aria-label={flagTitle}
        role="img"
      >
        <rect width="60" height="13.33" fill="#FF9933" />
        <rect y="13.33" width="60" height="13.33" fill="#FFFFFF" />
        <rect y="26.66" width="60" height="13.34" fill="#138808" />
        <circle cx="30" cy="20" r="4.5" fill="none" stroke="#000080" strokeWidth="1" />
        <circle cx="30" cy="20" r="1.2" fill="#000080" />
      </svg>
    );
  }

  if (norm === 'US') {
    return (
      <svg
        viewBox="0 0 60 32"
        className={className}
        aria-label={flagTitle}
        role="img"
      >
        <rect width="60" height="32" fill="#B22234" />
        <path d="M0,4.9 h60 M0,9.8 h60 M0,14.7 h60 M0,19.6 h60 M0,24.5 h60 M0,29.4 h60" stroke="#FFFFFF" strokeWidth="2.45" />
        <rect width="26" height="17.2" fill="#3C3B6E" />
        <circle cx="6" cy="5" r="1" fill="#fff" />
        <circle cx="13" cy="5" r="1" fill="#fff" />
        <circle cx="20" cy="5" r="1" fill="#fff" />
        <circle cx="9.5" cy="8.6" r="1" fill="#fff" />
        <circle cx="16.5" cy="8.6" r="1" fill="#fff" />
        <circle cx="6" cy="12.2" r="1" fill="#fff" />
        <circle cx="13" cy="12.2" r="1" fill="#fff" />
        <circle cx="20" cy="12.2" r="1" fill="#fff" />
      </svg>
    );
  }

  if (norm === 'EU') {
    return (
      <svg
        viewBox="0 0 60 40"
        className={className}
        aria-label={flagTitle}
        role="img"
      >
        <rect width="60" height="40" fill="#003399" />
        <g fill="#FFCC00">
          <circle cx="30" cy="8" r="1.5" />
          <circle cx="30" cy="32" r="1.5" />
          <circle cx="18" cy="20" r="1.5" />
          <circle cx="42" cy="20" r="1.5" />
          <circle cx="21.5" cy="11.5" r="1.5" />
          <circle cx="38.5" cy="11.5" r="1.5" />
          <circle cx="21.5" cy="28.5" r="1.5" />
          <circle cx="38.5" cy="28.5" r="1.5" />
        </g>
      </svg>
    );
  }

  if (norm === 'AE') {
    return (
      <svg
        viewBox="0 0 60 30"
        className={className}
        aria-label={flagTitle}
        role="img"
      >
        <rect width="60" height="10" fill="#00732f" />
        <rect y="10" width="60" height="10" fill="#ffffff" />
        <rect y="20" width="60" height="10" fill="#000000" />
        <rect width="16" height="30" fill="#ff0000" />
      </svg>
    );
  }

  // Generic globe fallback
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
