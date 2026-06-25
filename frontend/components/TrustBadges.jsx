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
      color: 'bg-blue-50 text-blue-700 border-blue-200',
      description: 'Good Manufacturing Practice certified facility'
    },
    'ISO 22000': {
      label: 'ISO 22000',
      icon: <Shield className="h-4 w-4" />,
      color: 'bg-green-50 text-green-700 border-green-200',
      description: 'Food Safety Management certified'
    },
    'HACCP': {
      label: 'HACCP Compliant',
      icon: <CheckCircle className="h-4 w-4" />,
      color: 'bg-purple-50 text-purple-700 border-purple-200',
      description: 'Hazard Analysis & Critical Control Points'
    },
    'Lab Tested': {
      label: 'Lab Tested',
      icon: <Award className="h-4 w-4" />,
      color: 'bg-amber-50 text-amber-700 border-amber-200',
      description: 'Third-party laboratory tested'
    },
    'Money-Back Guarantee': {
      label: '30-Day Guarantee',
      icon: <CheckCircle className="h-4 w-4" />,
      color: 'bg-red-50 text-red-700 border-red-200',
      description: 'Risk-free 30-day money-back guarantee'
    },
    'Trustpilot': {
      label: 'Trustpilot Verified',
      icon: <Star className="h-4 w-4" />,
      color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
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
          className={`inline-flex items-center gap-1 rounded-full border ${badge.color} ${sizeClasses[size]} font-semibold whitespace-nowrap group relative cursor-help`}
          title={badge.description}
        >
          {badge.icon}
          <span>{badge.label}</span>

          {/* Tooltip on hover */}
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-900 text-white text-[11px] px-2 py-1 rounded whitespace-nowrap z-10">
            {badge.description}
          </div>
        </div>
      ))}

      {/* Customer Count Badge */}
      {customerCount && (
        <div className={`inline-flex items-center gap-1 rounded-full border bg-slate-50 text-slate-700 border-slate-200 ${sizeClasses[size]} font-semibold whitespace-nowrap`}>
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
    'GMP': { icon: '✓', color: 'bg-blue-50 text-blue-700' },
    'ISO 22000': { icon: '✓', color: 'bg-green-50 text-green-700' },
    'HACCP': { icon: '✓', color: 'bg-purple-50 text-purple-700' },
    'Lab Tested': { icon: '✓', color: 'bg-amber-50 text-amber-700' },
  };

  return (
    <div className="flex flex-wrap gap-1">
      {certifications.slice(0, 3).map((cert) => (
        <span
          key={cert}
          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
            certIcons[cert]?.color || 'bg-slate-100 text-slate-700'
          }`}
        >
          {cert}
        </span>
      ))}
      {certifications.length > 3 && (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
          +{certifications.length - 3}
        </span>
      )}
    </div>
  );
}
