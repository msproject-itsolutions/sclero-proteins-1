'use client';

import React, { useEffect, useRef, useState, Suspense } from 'react';
import { useDispatch } from 'react-redux';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import StoreShell from '../../../components/StoreShell';
import { clearSession } from '../../../store/authSlice';
import { postJson } from '../../../lib/api';
import { firstApiError } from '../../../lib/formValidation';

const SIGN_IN_MESSAGE = 'Sign in to confirm this link, then open it again from your email.';

function ConfirmEmailChangeContent() {
  const dispatch = useDispatch();
  const params = useSearchParams();
  const started = useRef(false);
  const [status, setStatus] = useState('verifying'); // verifying | success | error | signin
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Strict Mode runs effects twice in development; the link works once.
    if (started.current) return;
    started.current = true;
    const token = params.get('token');
    // Keep the emailed token out of the address bar, history and any referrer
    // or analytics that could read the URL, before any network call.
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
    if (!token) {
      setStatus('error');
      setMessage('This link is missing its token.');
      return;
    }
    postJson('/api/auth/email-change/confirm/', { token })
      .then(({ response, data }) => {
        if (response.status === 401) {
          setStatus('signin');
          return;
        }
        if (!response.ok) throw new Error(firstApiError(data, 'This link is not valid.'));
        setStatus('success');
        setMessage(data.email || '');
        // Every session ended with the change, including this one — clear the
        // client's signed-in state directly instead of calling logout(),
        // which would hit an /api/auth/logout/ session that's already gone.
        dispatch(clearSession());
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err.message || 'This link is not valid.');
      });
  }, [dispatch, params]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      {status === 'verifying' && (
        <>
          <Loader2 className="mb-4 h-10 w-10 animate-spin text-brand-accent" />
          <h1 className="text-heading-2">Changing your email…</h1>
        </>
      )}
      {status === 'success' && (
        <>
          <CheckCircle2 className="mb-4 h-10 w-10 text-ink-success" />
          <h1 className="text-heading-2">Email changed</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Your email address has been changed. Sign in again with your new address.
          </p>
          {message && (
            <p className="mt-1 text-xs text-ink-secondary">
              New address: <span className="font-semibold text-ink-primary">{message}</span>
            </p>
          )}
          <Link href="/account" className="btn-primary mt-5 px-5 py-2.5 text-xs uppercase tracking-wider">
            Sign in
          </Link>
        </>
      )}
      {status === 'signin' && (
        <>
          <AlertCircle className="mb-4 h-10 w-10 text-ink-danger" />
          <h1 className="text-heading-2">Sign in required</h1>
          <p className="mt-1 text-sm text-ink-secondary">{SIGN_IN_MESSAGE}</p>
          <Link href="/account" className="btn-primary mt-5 px-5 py-2.5 text-xs uppercase tracking-wider">
            Go to your account
          </Link>
        </>
      )}
      {status === 'error' && (
        <>
          <AlertCircle className="mb-4 h-10 w-10 text-ink-danger" />
          <h1 className="text-heading-2">Link not valid</h1>
          <p className="mt-1 text-sm text-ink-secondary">{message}</p>
          <Link href="/account" className="btn-primary mt-5 px-5 py-2.5 text-xs uppercase tracking-wider">
            Back to your account
          </Link>
        </>
      )}
    </div>
  );
}

export default function ConfirmEmailChangePage() {
  return (
    <StoreShell showFooter={false}>
      <Suspense fallback={
        <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
          <Loader2 className="mb-4 h-10 w-10 animate-spin text-brand-accent" />
          <h1 className="text-heading-2">Loading…</h1>
        </div>
      }>
        <ConfirmEmailChangeContent />
      </Suspense>
    </StoreShell>
  );
}
