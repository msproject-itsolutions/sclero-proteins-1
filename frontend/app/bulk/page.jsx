'use client';

import React, { useState } from 'react';
import { Check, Send, Package, Factory, Handshake, Store } from 'lucide-react';
import StoreShell from '../../components/StoreShell';
import { getApiUrl } from '../../lib/api';

const ENQUIRY_TYPES = [
  { value: 'BULK', label: 'Bulk ingredient supply', icon: Package },
  { value: 'OEM', label: 'OEM / private label', icon: Factory },
  { value: 'DISTRIBUTOR', label: 'Distributor partnership', icon: Handshake },
  { value: 'WHOLESALE', label: 'Wholesale / retail', icon: Store },
];

const PRODUCTS = [
  'OvoMatrix ESC (25 kg)',
  'OvoMatrix Collagen (5–10 kg)',
  'OvoMatrix Custom Blend',
  'Combo Collagen®',
  'OvoShell Collagen™',
  'BJC® Bone & Joint Care',
  'CalPure',
  'SoilPro™',
  'LawnCal™',
  'Other / not sure',
];

export default function BulkEnquiryPage() {
  const [form, setForm] = useState({
    name: '', company: '', email: '', phone: '', country: '',
    enquiry_type: 'BULK', product_interest: PRODUCTS[0], quantity: '', message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    fetch(getApiUrl('/api/enquiries/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
      .then((res) => res.json().then((d) => ({ ok: res.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.detail || 'Submission failed');
        setDone(true);
      })
      .catch((err) => setError(err.message))
      .finally(() => setSubmitting(false));
  };

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
        {done ? (
          <div className="mx-auto max-w-lg rounded-3xl border border-brand-success/20 bg-brand-success/5 p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-success text-white">
              <Check className="h-7 w-7" />
            </div>
            <h2 className="mb-2 text-xl font-black text-brand-navy">Enquiry received</h2>
            <p className="text-sm text-brand-muted">
              Thank you. Our OvoMatrix™ team will be in touch shortly at {form.email}.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
            {/* Enquiry type selector */}
            <div className="lg:col-span-1">
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-brand-muted">
                Enquiry type
              </label>
              <div className="space-y-2">
                {ENQUIRY_TYPES.map((t) => (
                  <button
                    type="button"
                    key={t.value}
                    onClick={() => setForm((f) => ({ ...f, enquiry_type: t.value }))}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                      form.enquiry_type === t.value
                        ? 'border-brand-purple bg-brand-purple/10'
                        : 'border-slate-200 bg-white hover:border-brand-purple/40'
                    }`}
                  >
                    <t.icon className="h-5 w-5 text-brand-purple" />
                    <span className="text-sm font-semibold text-brand-navy">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3 lg:col-span-2">
              <div className="grid grid-cols-2 gap-3">
                <input required autoComplete="name" placeholder="Your name" value={form.name} onChange={upd('name')}
                  className="rounded-lg border border-slate-200 p-3 text-sm focus:border-brand-purple focus:outline-none" />
                <input autoComplete="organization" placeholder="Company" value={form.company} onChange={upd('company')}
                  className="rounded-lg border border-slate-200 p-3 text-sm focus:border-brand-purple focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input required type="email" autoComplete="email" placeholder="Business email" value={form.email} onChange={upd('email')}
                  className="rounded-lg border border-slate-200 p-3 text-sm focus:border-brand-purple focus:outline-none" />
                <input autoComplete="tel" placeholder="Phone" value={form.phone} onChange={upd('phone')}
                  className="rounded-lg border border-slate-200 p-3 text-sm focus:border-brand-purple focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select value={form.product_interest} onChange={upd('product_interest')}
                  className="rounded-lg border border-slate-200 bg-white p-3 text-sm focus:border-brand-purple focus:outline-none">
                  {PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <input autoComplete="country-name" placeholder="Country" value={form.country} onChange={upd('country')}
                  className="rounded-lg border border-slate-200 p-3 text-sm focus:border-brand-purple focus:outline-none" />
              </div>
              <input placeholder="Estimated volume / MOQ (e.g. 500 kg per month)" value={form.quantity} onChange={upd('quantity')}
                className="w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-brand-purple focus:outline-none" />
              <textarea rows={4} placeholder="Tell us about your requirement…" value={form.message} onChange={upd('message')}
                className="w-full rounded-lg border border-slate-200 p-3 text-sm focus:border-brand-purple focus:outline-none" />

              {error && (
                <p className="rounded-lg bg-brand-danger/10 px-3 py-2 text-xs font-semibold text-brand-danger">{error}</p>
              )}

              <button type="submit" disabled={submitting}
                className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-xs uppercase tracking-wider disabled:opacity-60">
                <Send className="h-4 w-4" />
                {submitting ? 'Sending…' : 'Submit enquiry'}
              </button>
            </div>
          </form>
        )}
      </div>
    </StoreShell>
  );
}
