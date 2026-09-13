'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import StoreShell from '../../../components/StoreShell';
import PasswordInput from '../../../components/PasswordInput';
import { postJson } from '../../../lib/api';
import { firstApiError } from '../../../lib/formValidation';

function ResetPasswordContent() {
  const params = useSearchParams();
  // Read once: the token is then removed from the address bar, which updates
  // the search params, so it must live in state for the later POST.
  const [token] = useState(() => params.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Keep the emailed token out of the address bar, history and any
    // referrer or analytics that could read the URL.
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  if (!token) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <AlertCircle className="mb-4 h-10 w-10 text-ink-danger" />
        <h1 className="text-heading-2">Link incomplete</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          This reset link is incomplete. Request a new one from the sign-in page ('Forgot password?').
        </p>
        <Link href="/account" className="btn-primary mt-5 px-5 py-2.5 text-xs uppercase tracking-wider">
          Back to your account
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <CheckCircle2 className="mb-4 h-10 w-10 text-ink-success" />
        <h1 className="text-heading-2">Password reset</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Your password has been reset. Sign in with your new password.
        </p>
        <Link href="/account" className="btn-primary mt-5 px-5 py-2.5 text-xs uppercase tracking-wider">
          Sign in
        </Link>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    // Never let the password linger in state past this point: pull it into
    // locals now and clear the fields immediately, whatever happens next.
    const nextPassword = password;
    const confirmPassword = confirm;
    setPassword('');
    setConfirm('');

    if (nextPassword.length < 8) {
      setError('Your new password must be at least 8 characters long.');
      return;
    }
    if (nextPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const { response, data } = await postJson('/api/auth/password/reset/confirm/', {
        token,
        new_password: nextPassword,
      });
      if (!response.ok) throw new Error(firstApiError(data, 'Could not reset your password.'));
      setDone(true);
    } catch (err) {
      setError(err.message || 'Could not reset your password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4">
      <div className="rounded-lg border border-edge bg-surface p-6 shadow-card sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
            <ShieldCheck className="h-6 w-6 text-brand-accent" />
          </div>
          <h1 className="text-heading-2">Reset your password</h1>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label htmlFor="reset-password" className="sr-only">New password</label>
          <PasswordInput
            id="reset-password"
            autoComplete="new-password"
            required
            placeholder="New password (at least 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-sm border border-edge bg-surface p-3 text-sm focus:border-ink-primary focus:outline-none"
          />
          <label htmlFor="reset-password-confirm" className="sr-only">Confirm new password</label>
          <PasswordInput
            id="reset-password-confirm"
            autoComplete="new-password"
            required
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-sm border border-edge bg-surface p-3 text-sm focus:border-ink-primary focus:outline-none"
          />
          {error && <p className="rounded-sm bg-surface-muted px-3 py-2 text-xs font-semibold text-ink-danger">{error}</p>}
          <button type="submit" disabled={busy}
            className="btn-primary w-full py-3 text-sm uppercase tracking-wider disabled:opacity-60">
            {busy ? 'Resetting…' : 'Reset password'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <StoreShell showFooter={false}>
      <Suspense fallback={
        <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
          <Loader2 className="mb-4 h-10 w-10 animate-spin text-brand-accent" />
          <h1 className="text-heading-2">Loading…</h1>
        </div>
      }>
        <ResetPasswordContent />
      </Suspense>
    </StoreShell>
  );
}
