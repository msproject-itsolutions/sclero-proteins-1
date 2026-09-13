'use client';

import React, { useEffect, useRef, useState, Suspense } from 'react';
import { useDispatch } from 'react-redux';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import StoreShell from '../../../components/StoreShell';
import { verifyMagicLink, fetchProfile } from '../../../store/authSlice';

function MagicLinkContent() {
  const dispatch = useDispatch();
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState('verifying'); // verifying | success | error
  const [message, setMessage] = useState('');
  const started = useRef(false);

  useEffect(() => {
    // Strict Mode runs effects twice in development; a sign-in link works once.
    if (started.current) return;
    started.current = true;
    const token = params.get('token');
    if (!token) {
      setStatus('error');
      setMessage('This sign-in link is missing its token.');
      return;
    }
    dispatch(verifyMagicLink({ token }))
      .unwrap()
      .then(() => {
        setStatus('success');
        dispatch(fetchProfile());
        setTimeout(() => router.push('/account'), 1200);
      })
      .catch((e) => {
        setStatus('error');
        setMessage(typeof e === 'string' ? e : 'This sign-in link is invalid or has expired.');
      });
  }, [dispatch, params, router]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      {status === 'verifying' && (
        <>
          <Loader2 className="mb-4 h-10 w-10 animate-spin text-brand-accent" />
          <h1 className="text-heading-2">Signing you in…</h1>
          <p className="mt-1 text-sm text-ink-secondary">Verifying your magic link.</p>
        </>
      )}
      {status === 'success' && (
        <>
          <CheckCircle2 className="mb-4 h-10 w-10 text-ink-success" />
          <h1 className="text-heading-2">You're in!</h1>
          <p className="mt-1 text-sm text-ink-secondary">Taking you to your account…</p>
        </>
      )}
      {status === 'error' && (
        <>
          <AlertCircle className="mb-4 h-10 w-10 text-ink-danger" />
          <h1 className="text-heading-2">Link not valid</h1>
          <p className="mt-1 text-sm text-ink-secondary">{message}</p>
          <Link href="/account" className="btn-primary mt-5 px-5 py-2.5 text-xs uppercase tracking-wider">
            Back to sign in
          </Link>
        </>
      )}
    </div>
  );
}

export default function MagicLinkPage() {
  return (
    <StoreShell showFooter={false}>
      <Suspense fallback={
        <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
          <Loader2 className="mb-4 h-10 w-10 animate-spin text-brand-accent" />
          <h1 className="text-heading-2">Loading…</h1>
        </div>
      }>
        <MagicLinkContent />
      </Suspense>
    </StoreShell>
  );
}
