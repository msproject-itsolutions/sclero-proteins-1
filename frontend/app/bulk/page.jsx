import React from 'react';
import StoreShell from '../../components/StoreShell';
import BulkEnquiryForm from './BulkEnquiryForm';

export const metadata = {
  title: 'Bulk & Wholesale | Sclero Proteins',
  description: 'Submit an enquiry for bulk ingredients, OEM, and private label partnerships with Sclero Proteins. High-purity eggshell calcium, collagen complexes, and soil-health minerals.',
  alternates: {
    canonical: '/bulk',
  },
  openGraph: {
    title: 'Bulk & Wholesale | Sclero Proteins',
    description: 'Submit an enquiry for bulk ingredients, OEM, and private label partnerships with Sclero Proteins.',
    url: 'https://scleroproteins.co.uk/bulk',
  },
};

export default function BulkEnquiryPage() {
  return (
    <StoreShell>
      {/* Hero */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-purple">OvoMatrix™ Solutions</p>
          <h1 className="mt-2 text-3xl font-black text-brand-navy sm:text-4xl">Enquire for Bulk &amp; OEM</h1>
          <p className="mt-3 max-w-2xl text-sm text-brand-muted">
            High-purity eggshell calcium, collagen complexes, and soil-health minerals for brands,
            formulators, and distributors. Tell us what you need and our team will respond with
            pricing, MOQs, and documentation.
          </p>
          <p className="mt-2 text-xs text-brand-muted">
            MOQ: 25 kg (minerals) / 5–10 kg (collagen) · Global shipping available
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <BulkEnquiryForm />
      </div>
    </StoreShell>
  );
}
