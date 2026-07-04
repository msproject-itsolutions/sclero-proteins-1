'use client';

import React, { useEffect } from 'react';
import { Star } from 'lucide-react';

const DEFAULT_BUSINESS_UNIT_ID =
  process.env.NEXT_PUBLIC_TRUSTPILOT_BUSINESS_UNIT_ID || '';

export default function TrustpilotWidget({
  businessUnitId = DEFAULT_BUSINESS_UNIT_ID,
  templateId = '53aa8912dec7e10d38f59ee4',
  placement = 'footer',
}) {
  useEffect(() => {
    if (!businessUnitId || document.querySelector('script[data-trustpilot-loader]')) return;
    const script = document.createElement('script');
    script.src = 'https://widget.trustpilot.com/bootstrap/v5/tp.widget.bootstrap.min.js';
    script.async = true;
    script.dataset.trustpilotLoader = 'true';
    document.body.appendChild(script);
  }, [businessUnitId]);

  // Never display fabricated ratings or reviews when Trustpilot is unconfigured.
  if (!businessUnitId) return null;

  const heights = {
    footer: '52px',
    homepage: '140px',
    'product-detail': '140px',
  };

  return (
    <div
      className="trustpilot-widget"
      data-locale="en-GB"
      data-template-id={templateId}
      data-businessunit-id={businessUnitId}
      data-style-height={heights[placement] || '140px'}
      data-style-width="100%"
      data-theme="light"
    >
      <a
        href="https://www.trustpilot.com/review/scleroproteins.co.uk"
        target="_blank"
        rel="noopener noreferrer"
      >
        View verified reviews on Trustpilot
      </a>
    </div>
  );
}

export function TrustpilotBadge({
  businessUnitId = DEFAULT_BUSINESS_UNIT_ID,
}) {
  if (!businessUnitId) return null;
  return (
    <a
      href="https://www.trustpilot.com/review/scleroproteins.co.uk"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-xs border border-edge bg-surface-muted px-4 py-2 transition-all duration-300 hover:border-edge-strong"
    >
      <Star className="h-3 w-3 text-brand-accent" />
      <span className="text-xs font-semibold text-ink-secondary">
        Read verified Trustpilot reviews
      </span>
    </a>
  );
}
