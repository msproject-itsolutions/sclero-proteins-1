'use client';

import React, { useState } from 'react';
import { Check, Send, Package, Factory, Handshake, Store } from 'lucide-react';
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

export default function BulkEnquiryForm() {
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
    <div>
      {done ? (
        <div className="mx-auto max-w-lg rounded-md border border-ink-success/20 bg-surface p-8 text-center shadow-card animate-fade-in">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-ink-success text-white">
            <Check className="h-7 w-7" />
          </div>
          <h2 className="text-heading-3 mb-2">Enquiry received</h2>
          <p className="text-sm text-ink-secondary">
            Thank you. Our OvoMatrix™ team will be in touch shortly at {form.email}.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
          {/* Enquiry type selector */}
          <div className="lg:col-span-1">
            <h2 className="kicker mb-2 block">
              Enquiry type
            </h2>
            <div className="space-y-2">
              {ENQUIRY_TYPES.map((t) => (
                <button
                  type="button"
                  key={t.value}
                  onClick={() => setForm((f) => ({ ...f, enquiry_type: t.value }))}
                  className={`flex w-full items-center gap-3 rounded-md border p-3 text-left transition-colors ${
                    form.enquiry_type === t.value
                      ? 'border-ink-primary bg-surface-muted'
                      : 'border-edge bg-surface hover:border-edge-strong'
                  }`}
                >
                  <t.icon className="h-5 w-5 text-brand-accent" />
                  <span className="text-sm font-semibold text-ink-primary">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Details */}
          <div className="space-y-3.5 lg:col-span-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="bulk-name" className="sr-only">Your name</label>
                <input
                  id="bulk-name"
                  required
                  autoComplete="name"
                  placeholder="Your name"
                  value={form.name}
                  onChange={upd('name')}
                  className="w-full rounded-sm border border-edge bg-surface p-3 text-sm text-ink-primary focus:border-ink-primary focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="bulk-company" className="sr-only">Company</label>
                <input
                  id="bulk-company"
                  autoComplete="organization"
                  placeholder="Company"
                  value={form.company}
                  onChange={upd('company')}
                  className="w-full rounded-sm border border-edge bg-surface p-3 text-sm text-ink-primary focus:border-ink-primary focus:outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="bulk-email" className="sr-only">Business email</label>
                <input
                  id="bulk-email"
                  required
                  type="email"
                  autoComplete="email"
                  placeholder="Business email"
                  value={form.email}
                  onChange={upd('email')}
                  className="w-full rounded-sm border border-edge bg-surface p-3 text-sm text-ink-primary focus:border-ink-primary focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="bulk-phone" className="sr-only">Phone</label>
                <input
                  id="bulk-phone"
                  autoComplete="tel"
                  placeholder="Phone"
                  value={form.phone}
                  onChange={upd('phone')}
                  className="w-full rounded-sm border border-edge bg-surface p-3 text-sm text-ink-primary focus:border-ink-primary focus:outline-none"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="bulk-product" className="sr-only">Product interest</label>
                <select
                  id="bulk-product"
                  value={form.product_interest}
                  onChange={upd('product_interest')}
                  className="w-full rounded-sm border border-edge bg-surface p-3 text-sm text-ink-primary focus:border-ink-primary focus:outline-none"
                >
                  {PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="bulk-country" className="sr-only">Country</label>
                <input
                  id="bulk-country"
                  autoComplete="country-name"
                  placeholder="Country"
                  value={form.country}
                  onChange={upd('country')}
                  className="w-full rounded-sm border border-edge bg-surface p-3 text-sm text-ink-primary focus:border-ink-primary focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label htmlFor="bulk-quantity" className="sr-only">Estimated volume / MOQ</label>
              <input
                id="bulk-quantity"
                placeholder="Estimated volume / MOQ (e.g. 500 kg per month)"
                value={form.quantity}
                onChange={upd('quantity')}
                className="w-full rounded-sm border border-edge bg-surface p-3 text-sm text-ink-primary focus:border-ink-primary focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="bulk-message" className="sr-only">Requirement description</label>
              <textarea
                id="bulk-message"
                rows={4}
                placeholder="Tell us about your requirement…"
                value={form.message}
                onChange={upd('message')}
                className="w-full rounded-sm border border-edge bg-surface p-3 text-sm text-ink-primary focus:border-ink-primary focus:outline-none"
              />
            </div>

            {error && (
              <p className="rounded-sm border border-ink-danger/20 bg-surface-muted px-3 py-2 text-xs font-semibold text-ink-danger">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-xs uppercase tracking-wider disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              {submitting ? 'Sending…' : 'Submit enquiry'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
