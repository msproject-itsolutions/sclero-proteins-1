'use client';

import React, { useState } from 'react';
import { Check, Send } from 'lucide-react';
import { postJson } from '../../lib/api';
import { firstApiError, validateEnquiry } from '../../lib/formValidation';

export default function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const { cleaned, error: validationError } = validateEnquiry(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setForm(cleaned);
    setStatus('loading');
    try {
      const { response, data } = await postJson('/api/enquiries/', {
        name: cleaned.name,
        email: cleaned.email,
        message: cleaned.message,
        enquiry_type: 'GENERAL',
        product_interest: 'Customer support',
      });
      if (!response.ok) throw new Error(firstApiError(data, 'Could not send your message.'));
      setStatus('sent');
      setForm({ name: '', email: '', message: '' });
    } catch (err) {
      setError(err.message);
      setStatus('idle');
    }
  };

  if (status === 'sent') {
    return (
      <div className="rounded-md border border-ink-success/20 bg-surface-muted p-6 text-center shadow-card">
        <Check className="mx-auto mb-2 h-8 w-8 text-ink-success" />
        <p className="text-sm font-semibold text-ink-success">Message received. Our support team will follow up shortly.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-md border border-edge bg-surface p-6 shadow-card">
      <div>
        <label htmlFor="contact-name" className="label-base">Name</label>
        <input
          id="contact-name"
          type="text"
          autoComplete="name"
          required
          minLength={2}
          value={form.name}
          onChange={update('name')}
          className="w-full rounded-sm border border-edge bg-surface p-3 text-sm text-ink-primary focus:border-ink-primary focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="contact-email" className="label-base">Email</label>
        <input
          id="contact-email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={update('email')}
          className="w-full rounded-sm border border-edge bg-surface p-3 text-sm text-ink-primary focus:border-ink-primary focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="contact-message" className="label-base">Message</label>
        <textarea
          id="contact-message"
          rows={5}
          required
          minLength={10}
          value={form.message}
          onChange={update('message')}
          className="w-full rounded-sm border border-edge bg-surface p-3 text-sm text-ink-primary focus:border-ink-primary focus:outline-none"
        />
      </div>
      {error && <p className="rounded-sm border border-ink-danger/20 bg-surface-muted px-3 py-2 text-xs font-semibold text-ink-danger">{error}</p>}
      <button type="submit" disabled={status === 'loading'} className="btn-primary w-full px-5 py-3 text-xs uppercase disabled:opacity-60">
        <Send className="h-4 w-4" />
        {status === 'loading' ? 'Sending...' : 'Send message'}
      </button>
    </form>
  );
}
