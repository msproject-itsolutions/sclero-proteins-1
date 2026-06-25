'use client';

import React, { useEffect } from 'react';
import { Star } from 'lucide-react';

/**
 * TrustpilotWidget Component
 * Displays Trustpilot reviews and ratings
 *
 * Note: Requires Trustpilot business unit ID setup
 * Register at trustpilot.com and get your ID
 */

export default function TrustpilotWidget({
  businessUnitId = 'YOUR_BUSINESS_UNIT_ID',
  templateId = 'default',
  placement = 'footer', // 'footer' | 'homepage' | 'product-detail'
  showReviews = true,
}) {
  useEffect(() => {
    // Load Trustpilot script
    const script = document.createElement('script');
    script.src = 'https://widget.trustpilot.com/api/ac.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  if (placement === 'footer') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <h3 className="mb-4 font-bold text-brand-navy">Trusted by Customers</h3>

        {/* Mock Trustpilot Review */}
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0">
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-brand-navy">Excellent</p>
            <p className="text-xs text-brand-muted">4.7 out of 5 based on 3,200+ reviews</p>
          </div>
        </div>

        {/* Trustpilot Badge Embed */}
        <div
          className="trustpilot-widget"
          data-locale="en-US"
          data-template-id={templateId}
          data-businessunit-id={businessUnitId}
          data-style-height="52px"
          data-style-width="100%"
          data-theme="light"
        >
          <a
            href={`https://www.trustpilot.com/review/${businessUnitId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-brand-purple hover:text-brand-purple/80"
          >
            View all reviews on Trustpilot
          </a>
        </div>
      </div>
    );
  }

  if (placement === 'homepage') {
    return (
      <section className="py-16 bg-white border-y border-slate-200/80">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <h2 className="mb-2 text-2xl font-black text-brand-navy">Trusted by Thousands</h2>
            <p className="text-sm text-brand-muted">
              See why customers love our products
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2">
            {/* Trustpilot Widget */}
            <div
              className="trustpilot-widget"
              data-locale="en-US"
              data-template-id="53aa8912dec7e10d38f59ee4"
              data-businessunit-id={businessUnitId}
              data-style-height="auto"
              data-style-width="100%"
              data-theme="light"
              style={{ minHeight: '300px' }}
            />

            {/* Stats */}
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-2xl font-black text-brand-navy">4.7/5</p>
                <p className="text-xs text-brand-muted">Average rating</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-2xl font-black text-brand-navy">3,200+</p>
                <p className="text-xs text-brand-muted">Customer reviews</p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-2xl font-black text-brand-navy">98%</p>
                <p className="text-xs text-brand-muted">Recommended</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (placement === 'product-detail') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="mb-4 font-bold text-brand-navy">Customer Reviews</h3>

        {/* Top Reviews */}
        <div className="space-y-4 mb-6">
          {[
            {
              name: 'Sarah M.',
              rating: 5,
              text: 'Amazing results in just 8 weeks! My skin feels so much firmer.',
              date: '2 weeks ago',
            },
            {
              name: 'John D.',
              rating: 5,
              text: 'Great quality product. Really helps with joint comfort during workouts.',
              date: '1 month ago',
            },
            {
              name: 'Emma K.',
              rating: 4,
              text: 'Good product, shipping was fast. Would recommend!',
              date: '1 month ago',
            },
          ].map((review, i) => (
            <div key={i} className="border-b border-slate-100 pb-4 last:border-b-0">
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-sm text-brand-navy">{review.name}</p>
                <div className="flex gap-1">
                  {[...Array(review.rating)].map((_, j) => (
                    <Star key={j} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
              </div>
              <p className="text-xs text-brand-muted mb-2">{review.text}</p>
              <p className="text-[10px] text-brand-muted">{review.date}</p>
            </div>
          ))}
        </div>

        {/* View All Link */}
        <a
          href={`https://www.trustpilot.com/review/${businessUnitId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex text-sm font-semibold text-brand-purple hover:text-brand-purple/80"
        >
          View all reviews on Trustpilot →
        </a>
      </div>
    );
  }

  return null;
}

/**
 * Simpler badge component for trust sections
 */
export function TrustpilotBadge() {
  return (
    <a
      href="https://www.trustpilot.com/review/scleroproteins.co.uk"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 rounded-full border border-brand-success/20 bg-brand-success/10 px-4 py-2"
    >
      <div className="flex gap-1">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
        ))}
      </div>
      <span className="text-xs font-bold text-brand-success">
        Rated Excellent on Trustpilot • 4.7/5
      </span>
    </a>
  );
}
