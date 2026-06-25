import React from 'react';

/**
 * Brand mark — the official Sclero Proteins swan-"S" symbol.
 * Renders the real logo asset (transparent PNG derived from logo-full.png).
 * Sizing is driven by the passed `className` (e.g. "h-8 w-8") so every
 * existing caller keeps working unchanged.
 */
export default function Logo({ className = 'h-8 w-8', alt = 'Sclero Proteins' }) {
  return (
    <img
      src="/logo-mark.png"
      alt={alt}
      className={`${className} select-none object-contain`}
      draggable={false}
    />
  );
}
