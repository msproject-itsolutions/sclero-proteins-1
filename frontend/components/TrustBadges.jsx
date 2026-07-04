'use client';

import React from 'react';
import { Shield, CheckCircle, Award, Star } from 'lucide-react';

export default function TrustBadges({
  certifications = [],
  isLabTested = false,
  hasMoneyBackGuarantee = false,
  isTrustpilotVerified = false,
  customerCount = null,
  layout = 'horizontal', // 'horizontal' | 'grid' | 'vertical'
  size = 'sm', // 'sm' | 'md' | 'lg'
}) {
  const badgeConfig = {
    'GMP': {
      label: 'GMP Certified',
      icon: <CheckCircle className="h-4 w-4" />,
      color: 'bg-surface-muted text-ink-secondary border-edge',
      description: 'Good Manufacturing Practice certified facility'
    },
    'ISO 22000': {
      label: 'ISO 22000',
      icon: <Shield className="h-4 w-4" />,
      color: 'bg-surface-muted text-ink-secondary border-edge',
      description: 'Food Safety Management certified'
    },
    'HACCP': {
      label: 'HACCP Compliant',
      icon: <CheckCircle className="h-4 w-4" />,
      color: 'bg-surface-muted text-ink-secondary border-edge',
      description: 'Hazard Analysis & Critical Control Points'
    },
    'Lab Tested': {
      label: 'Lab Tested',
      icon: <Award className="h-4 w-4" />,
      color: 'bg-surface-muted text-ink-secondary border-edge',
      description: 'Third-party laboratory tested'
    },
    'Money-Back Guarantee': {
      label: '30-Day Guarantee',
      icon: <CheckCircle className="h-4 w-4" />,
      color: 'bg-surface-muted text-ink-secondary border-edge',
      description: 'Risk-free 30-day money-back guarantee'
    },
    'Trustpilot': {
      label: 'Trustpilot Verified',
      icon: <Star className="h-4 w-4" />,
      color: 'bg-surface-muted text-ink-secondary border-edge',
      description: 'Verified customer reviews on Trustpilot'
    }
  };

  // Build badge list
  const badges = [];
  certifications.forEach((cert) => {
    if (badgeConfig[cert]) badges.push({ type: cert, ...badgeConfig[cert] });
  });
  if (isLabTested && !certifications.includes('Lab Tested')) {
    badges.push({ type: 'Lab Tested', ...badgeConfig['Lab Tested'] });
  }
  if (hasMoneyBackGuarantee) {
    badges.push({ type: 'Money-Back Guarantee', ...badgeConfig['Money-Back Guarantee'] });
  }
  if (isTrustpilotVerified) {
    badges.push({ type: 'Trustpilot', ...badgeConfig['Trustpilot'] });
  }

  if (badges.length === 0 && !customerCount) return null;

  // Size classes
  const sizeClasses = {
    sm: 'px-2 py-1 text-[10px] gap-1',
    md: 'px-3 py-1.5 text-xs gap-1.5',
    lg: 'px-4 py-2 text-sm gap-2',
  };

  const containerClasses = {
    horizontal: 'flex flex-wrap gap-2',
    grid: 'grid grid-cols-2 gap-2 sm:grid-cols-3',
    vertical: 'flex flex-col gap-2',
  };

  return (
    <div className={containerClasses[layout]}>
      {/* Trust Badges */}
      {badges.map((badge) => (
        <div
          key={badge.type}
          className={`inline-flex items-center gap-1 rounded-xs border ${badge.color} ${sizeClasses[size]} font-medium uppercase tracking-wide whitespace-nowrap group relative cursor-help`}
          title={badge.description}
        >
          {badge.icon}
          <span>{badge.label}</span>

          {/* Tooltip on hover */}
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-surface-inverse text-white text-[11px] px-2 py-1 rounded-xs whitespace-nowrap z-10">
            {badge.description}
          </div>
        </div>
      ))}

      {/* Customer Count Badge */}
      {customerCount && (
        <div className={`inline-flex items-center gap-1 rounded-xs border bg-surface-muted text-ink-secondary border-edge ${sizeClasses[size]} font-medium uppercase tracking-wide whitespace-nowrap`}>
          <CheckCircle className="h-4 w-4" />
          <span>{customerCount.toLocaleString()}+ customers</span>
        </div>
      )}
    </div>
  );
}

// Export a compact version for product cards
export function CompactTrustBadges({ certifications = [], size = 'sm' }) {
  const certIcons = {
    'GMP': { icon: '✓', color: 'bg-surface-muted text-ink-accent' },
    'ISO 22000': { icon: '✓', color: 'bg-surface-muted text-ink-accent' },
    'HACCP': { icon: '✓', color: 'bg-surface-muted text-ink-accent' },
    'Lab Tested': { icon: '✓', color: 'bg-surface-muted text-ink-accent' },
  };

  return (
    <div className="flex flex-wrap gap-1">
      {certifications.slice(0, 3).map((cert) => (
        <span
          key={cert}
          className={`px-1.5 py-0.5 rounded-xs text-[10px] font-semibold uppercase tracking-wide ${
            certIcons[cert]?.color || 'bg-surface-muted text-ink-secondary'
          }`}
        >
          {cert}
        </span>
      ))}
      {certifications.length > 3 && (
        <span className="px-1.5 py-0.5 rounded-xs text-[10px] font-semibold uppercase tracking-wide bg-surface-muted text-ink-secondary">
          +{certifications.length - 3}
        </span>
      )}
    </div>
  );
}
