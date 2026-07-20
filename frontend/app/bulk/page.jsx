import React from 'react';
import StoreShell from '../../components/StoreShell';
import Link from 'next/link';
import { ArrowRight, ShoppingBag } from 'lucide-react';
import BulkEnquiryForm from './BulkEnquiryForm';

export const metadata = {
  title: 'Bulk & Wholesale',
  description: 'Submit an enquiry for bulk ingredients, OEM, and private label partnerships with Sclero Proteins. High-purity eggshell calcium, collagen complexes, and soil-health minerals.',
  alternates: {
    canonical: '/bulk',
  },
  openGraph: {
    title: 'Bulk & Wholesale | Sclero Proteins',
    description: 'Submit an enquiry for bulk ingredients, OEM, and private label partnerships with Sclero Proteins.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/bulk`,
  },
};

export default function BulkEnquiryPage() {
  return (
    <StoreShell>
      {/* Hero */}
      <div className="border-b border-edge bg-surface py-16 md:py-24">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <p className="kicker mb-4">OvoMatrix™ Solutions</p>
          <h1 className="text-display">Enquire for Bulk &amp; <em className="text-italic-accent">OEM</em></h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-[1.75] text-ink-secondary">
            High-purity eggshell calcium, collagen complexes, and soil-health minerals for brands,
            formulators, and distributors. Tell us what you need and our team will respond with
            pricing, MOQs, and documentation.
          </p>
          <p className="mt-2 text-xs text-ink-muted">
            MOQ: 25 kg (minerals) / 5–10 kg (collagen) · Global shipping available
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link href="/products" className="btn-primary px-6 py-3 text-sm">
              <ShoppingBag className="h-4 w-4" />
              Shop retail products
            </Link>
            <Link href="/contact" className="btn-ghost px-6 py-3 text-sm">
              General contact <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="reveal mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <BulkEnquiryForm />
      </div>
    </StoreShell>
  );
}
