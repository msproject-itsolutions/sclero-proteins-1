'use client';

import React, { useState } from 'react';
import { postJson } from '../../lib/api';
import { firstApiError, isValidEmail } from '../../lib/formValidation';

export default function EssenceNewsletterForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    const cleaned = email.trim().toLowerCase();
    setError('');
    if (!isValidEmail(cleaned)) {
      setError('Please enter a valid email address.');
      return;
    }
    setStatus('loading');
    try {
      const { response, data } = await postJson('/api/newsletter/subscribe/', {
        email: cleaned,
        source: 'essence-preview',
      });
      if (!response.ok) throw new Error(firstApiError(data, 'Could not subscribe. Please try again.'));
      setEmail('');
      setStatus('sent');
    } catch (err) {
      setError(err.message || 'Could not subscribe. Please try again.');
      setStatus('idle');
    }
  };

  if (status === 'sent') {
    return <p className="mt-8 text-sm font-semibold">Thank you. Please check your inbox.</p>;
  }

  return (
    <form className="mx-auto mt-8 max-w-md" onSubmit={submit} noValidate>
      <div className="flex items-stretch gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          className="min-w-0 flex-1 bg-white px-4 py-3 text-[14px] text-[#171714] caret-[#171714] outline-none [-webkit-text-fill-color:#171714]"
          style={{ border: '1px solid var(--e-edge-strong)', borderRadius: '4px' }}
        />
        <button type="submit" disabled={status === 'loading'} className="e-btn !px-5 disabled:opacity-60">
          {status === 'loading' ? 'Sending…' : 'Subscribe'}
        </button>
      </div>
      {error && <p className="mt-2 text-left text-xs font-semibold text-red-700">{error}</p>}
    </form>
  );
}
