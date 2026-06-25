'use client';

import React from 'react';
import { Shield, Check } from 'lucide-react';

export default function GuaranteeCard({
  days = 30,
  variant = 'standard', // 'standard' | 'prominent' | 'minimal'
  placement = 'card', // 'card' | 'banner' | 'inline'
}) {
  const variants = {
    standard: (
      <div className="rounded-2xl border border-brand-success/20 bg-brand-success/5 p-6 text-center">
        <Shield className="mx-auto mb-3 h-8 w-8 text-brand-success" />
        <h3 className="mb-1 font-bold text-brand-navy">{days}-Day Confidence Guarantee</h3>
        <p className="text-xs text-brand-muted">
          Not satisfied? We'll refund 100% of your money, no questions asked.
        </p>
      </div>
    ),

    prominent: (
      <div className="rounded-3xl border-2 border-brand-success bg-gradient-to-r from-brand-success/10 to-transparent p-8">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-success text-white">
              <Shield className="h-6 w-6" />
            </div>
          </div>
          <div>
            <h2 className="mb-1 text-lg font-black text-brand-navy">
              100% Money-Back Guarantee
            </h2>
            <p className="text-sm text-brand-muted">
              Try Combo Collagen® risk-free for {days} days. If you're not completely satisfied with your results,
              we'll refund your full purchase price — no questions asked, no hassle.
            </p>
            <div className="mt-3 flex flex-col gap-2 text-xs text-brand-success font-semibold">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                <span>Full refund within {days} days of purchase</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                <span>No questions asked</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                <span>Return shipping covered</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    ),

    minimal: (
      <div className="flex items-center gap-2 rounded-lg bg-brand-success/5 px-3 py-2">
        <Shield className="h-4 w-4 text-brand-success" />
        <span className="text-xs font-semibold text-brand-success">
          {days}-Day Money-Back Guarantee
        </span>
      </div>
    ),
  };

  return variants[variant];
}

// Banner variant for checkout/product pages
export function GuaranteeBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand-success/20 bg-gradient-to-r from-brand-success/5 to-transparent p-4 sm:p-6">
      {/* Animated background elements */}
      <div className="absolute right-0 top-0 -mr-20 -mt-20 h-40 w-40 rounded-full bg-brand-success/10 blur-3xl" />

      <div className="relative flex items-start gap-4 sm:gap-6">
        {/* Icon */}
        <div className="flex-shrink-0 pt-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-success/20">
            <Shield className="h-5 w-5 text-brand-success" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3 className="mb-1 font-bold text-brand-navy">100% Satisfaction Guaranteed</h3>
          <p className="text-sm text-brand-muted">
            We stand behind our products 100%. If you're not satisfied within 30 days, we'll refund
            your full purchase price, no questions asked.
          </p>
        </div>
      </div>
    </div>
  );
}

// Inline badge for trust section
export function GuaranteeBadge() {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-brand-success/30 bg-brand-success/10 px-4 py-2">
      <Shield className="h-4 w-4 text-brand-success" />
      <span className="text-xs font-bold text-brand-success">30-Day Money-Back Guarantee</span>
    </div>
  );
}
