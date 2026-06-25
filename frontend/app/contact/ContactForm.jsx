'use client';

import React, { useState } from 'react';
import { Check, Send } from 'lucide-react';
import { getApiUrl } from '../../lib/api';

export default function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setStatus('loading');
    setError('');
    try {
      const response = await fetch(getApiUrl('/api/enquiries/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          message: form.message,
          enquiry_type: 'GENERAL',
          product_interest: 'Customer support',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || data.error || 'Could not send your message.');
      setStatus('sent');
      setForm({ name: '', email: '', message: '' });
    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  };

  if (status === 'sent') {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
        <Check className="mx-auto mb-2 h-8 w-8 text-green-600" />
        <p className="text-sm font-bold text-green-700">Message received. Our support team will follow up shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
      <div>
        <label htmlFor="contact-name" className="mb-1 block text-xs font-bold uppercase text-brand-muted">Name</label>
        <input
          id="contact-name"
          type="text"
          autoComplete="name"
          required
          value={form.name}
          onChange={update('name')}
          className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-brand-purple focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="contact-email" className="mb-1 block text-xs font-bold uppercase text-brand-muted">Email</label>
        <input
          id="contact-email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={update('email')}
          className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-brand-purple focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="contact-message" className="mb-1 block text-xs font-bold uppercase text-brand-muted">Message</label>
        <textarea
          id="contact-message"
          rows={5}
          required
          value={form.message}
          onChange={update('message')}
          className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-brand-purple focus:outline-none"
        />
      </div>
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>}
      <button type="submit" disabled={status === 'loading'} className="btn-primary w-full px-5 py-3 text-xs uppercase disabled:opacity-60">
        <Send className="h-4 w-4" />
        {status === 'loading' ? 'Sending...' : 'Send message'}
      </button>
    </form>
  );
}
