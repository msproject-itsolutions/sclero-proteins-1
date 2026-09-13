'use client';

import React, { useState, useEffect, useCallback } from 'react';
import GoogleSignInButton from '../../components/GoogleSignInButton';

// Social providers only appear when actually configured, so the UI never shows
// an unavailable login method.
const GOOGLE_ENABLED = !!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
import { useSelector, useDispatch } from 'react-redux';
import Link from 'next/link';
import {
  LogOut, User as UserIcon, Mail, Phone, Award, MapPin, Package, Plus, Trash2,
  Globe, Bell, LayoutDashboard, Calendar, Heart, ShieldCheck, Check, Info, ChevronDown
} from 'lucide-react';
import StoreShell from '../../components/StoreShell';
import {
  login, register, fetchProfile, logout, clearAuthError, sendOtp, verifyOtp,
  verifyLoginCode, resendLoginCode, cancelChallenge, requestMagicLink,
} from '../../store/authSlice';
import { getApiUrl, postJson } from '../../lib/api';
import { authenticatedFetch } from '../../lib/authFetch';
import { addToCart } from '../../store/cartSlice';
import PasswordInput from '../../components/PasswordInput';
import { firstApiError, isValidEmail, isValidPhone, trimFormValues } from '../../lib/formValidation';

function OtpLogin() {
  const dispatch = useDispatch();
  const { status, error } = useSelector((s) => s.auth);
  const [stage, setStage] = useState('request'); // request | verify
  const [identifier, setIdentifier] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [otp, setOtp] = useState('');
  const [sandboxCode, setSandboxCode] = useState('');
  const [formError, setFormError] = useState('');

  const requestCode = (e) => {
    e.preventDefault();
    const cleanedIdentifier = identifier.trim().toLowerCase();
    setFormError('');
    if (!isValidEmail(cleanedIdentifier)) {
      setFormError('Please enter a valid email address.');
      return;
    }
    setIdentifier(cleanedIdentifier);
    dispatch(sendOtp({ identifier: cleanedIdentifier })).unwrap().then((d) => {
      setChallengeId(d.challenge_id || '');
      setSandboxCode(d.otp_preview_for_sandbox || '');
      setStage('verify');
    }).catch((message) => setFormError(typeof message === 'string' ? message : 'Could not send the code.'));
  };
  const verify = (e) => {
    e.preventDefault();
    const cleanedOtp = otp.trim();
    setFormError('');
    if (!/^\d{6}$/.test(cleanedOtp)) {
      setFormError('Please enter the complete 6-digit code.');
      return;
    }
    setOtp(cleanedOtp);
    dispatch(verifyOtp({ challengeId, otp: cleanedOtp }));
  };
  const restart = () => {
    setStage('request');
    setFormError('');
    setOtp('');
    setChallengeId('');
    setSandboxCode('');
  };

  return stage === 'request' ? (
    <form onSubmit={requestCode} className="space-y-3">
      <label htmlFor="otp-email" className="sr-only">Email address</label>
      <input
        id="otp-email"
        type="email" required placeholder="Email" autoComplete="email" value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        className="w-full rounded-sm border border-edge bg-surface p-3 text-sm focus:border-ink-primary focus:outline-none"
      />
      {(formError || error) && <p className="rounded-sm bg-surface-muted px-3 py-2 text-xs font-semibold text-ink-danger">{formError || error}</p>}
      <button type="submit" disabled={status === 'loading'}
        className="btn-primary w-full py-3 text-sm uppercase tracking-wider disabled:opacity-60">
        {status === 'loading' ? 'Sending…' : 'Email me a code'}
      </button>
    </form>
  ) : (
    <form onSubmit={verify} className="space-y-3">
      <p className="text-center text-xs text-ink-secondary">
        We sent a 6-digit code to <span className="font-semibold text-ink-primary">{identifier}</span>
      </p>
      {sandboxCode && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-700">
          Sandbox code: <span className="font-mono font-bold">{sandboxCode}</span>
        </p>
      )}
      <label htmlFor="otp-code" className="sr-only">6-digit code</label>
      <input
        id="otp-code"
        type="text" inputMode="numeric" autoComplete="one-time-code" required placeholder="6-digit code" value={otp}
        onChange={(e) => setOtp(e.target.value)}
        className="w-full rounded-sm border border-edge bg-surface p-3 text-center text-lg tracking-[0.4em] focus:border-ink-primary focus:outline-none"
      />
      {(formError || error) && <p className="rounded-sm bg-surface-muted px-3 py-2 text-xs font-semibold text-ink-danger">{formError || error}</p>}
      <button type="submit" disabled={status === 'loading'}
        className="btn-primary w-full py-3 text-sm uppercase tracking-wider disabled:opacity-60">
        {status === 'loading' ? 'Verifying…' : 'Verify & log in'}
      </button>
      <button type="button" onClick={restart}
        className="w-full text-xs font-semibold text-ink-secondary hover:text-ink-primary">
        Use a different email
      </button>
    </form>
  );
}

function MagicLinkLogin() {
  const dispatch = useDispatch();
  const { status } = useSelector((s) => s.auth);
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [sandboxLink, setSandboxLink] = useState('');
  const [err, setErr] = useState('');

  const send = (e) => {
    e.preventDefault();
    setErr('');
    const cleanedEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanedEmail)) {
      setErr('Please enter a valid email address.');
      return;
    }
    setEmail(cleanedEmail);
    dispatch(requestMagicLink({ email: cleanedEmail })).unwrap().then((d) => {
      setSent(true);
      if (d.magic_link_for_sandbox) setSandboxLink(d.magic_link_for_sandbox);
    }).catch((m) => setErr(typeof m === 'string' ? m : 'Could not send the link'));
  };

  if (sent) {
    return (
      <div className="rounded-md border border-ink-success/20 bg-surface-muted p-4 text-center">
        <p className="text-xs font-semibold text-ink-primary">
          Check <span className="font-bold">{email}</span> for your sign-in link.
        </p>
        {sandboxLink && (
          <a href={sandboxLink} className="mt-2 block break-all text-[11px] font-bold text-ink-accent underline">
            Sandbox: open magic link
          </a>
        )}
        <button type="button" onClick={() => { setSent(false); setSandboxLink(''); }}
          className="mt-2 text-[11px] font-semibold text-ink-secondary hover:text-ink-primary">
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={send} className="space-y-3">
      <label htmlFor="magic-email" className="sr-only">Email address</label>
      <input
        id="magic-email"
        type="email" required placeholder="Email" autoComplete="email" value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-sm border border-edge bg-surface p-3 text-sm focus:border-ink-primary focus:outline-none"
      />
      {err && <p className="rounded-sm bg-surface-muted px-3 py-2 text-xs font-semibold text-ink-danger">{err}</p>}
      <button type="submit" disabled={status === 'loading'}
        className="btn-primary w-full py-3 text-sm uppercase tracking-wider disabled:opacity-60">
        {status === 'loading' ? 'Sending…' : 'Email me a magic link'}
      </button>
    </form>
  );
}

function LoginChallengeStep() {
  const dispatch = useDispatch();
  const {
    status, error, challengeSentTo, challengeSentAt, challengeResendIn, challengeNotice, sandboxOtp,
  } = useSelector((s) => s.auth);
  const [code, setCode] = useState('');
  const [formError, setFormError] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const waitSeconds = Math.max(0, Math.ceil((challengeSentAt + challengeResendIn * 1000 - now) / 1000));

  const submit = (e) => {
    e.preventDefault();
    const cleaned = code.replace(/\s/g, '');
    if (!/^\d{6}$/.test(cleaned)) {
      setFormError('Please enter the complete 6-digit code.');
      return;
    }
    setFormError('');
    dispatch(verifyLoginCode({ code: cleaned }));
  };

  const resend = () => {
    setFormError('');
    setCode('');
    dispatch(resendLoginCode());
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-lg border border-edge bg-surface p-6 shadow-card sm:p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
            <ShieldCheck className="h-6 w-6 text-brand-accent" />
          </div>
          <h1 className="text-heading-2">{challengeNotice ? 'Enter your sign-in code' : 'Check your email'}</h1>
          {!challengeNotice && (
            <p className="mt-1 text-sm text-ink-secondary">
              Enter the 6-digit code we sent to <span className="font-semibold text-ink-primary">{challengeSentTo}</span>. It expires in 10 minutes.
            </p>
          )}
        </div>
        <form onSubmit={submit} className="space-y-3">
          {challengeNotice && (
            <p role="status" className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              {challengeNotice}
            </p>
          )}
          {sandboxOtp && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-700">
              Sandbox code: <span className="font-mono font-bold">{sandboxOtp}</span>
            </p>
          )}
          <label htmlFor="login-code" className="sr-only">6-digit code</label>
          <input
            id="login-code"
            type="text" inputMode="numeric" autoComplete="one-time-code" required placeholder="6-digit code" value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded-sm border border-edge bg-surface p-3 text-center text-lg tracking-[0.4em] focus:border-ink-primary focus:outline-none"
          />
          {(formError || error) && <p className="rounded-sm bg-surface-muted px-3 py-2 text-xs font-semibold text-ink-danger">{formError || error}</p>}
          <button type="submit" disabled={status === 'loading'}
            className="btn-primary w-full py-3 text-sm uppercase tracking-wider disabled:opacity-60">
            {status === 'loading' ? 'Verifying…' : 'Verify & log in'}
          </button>
          <button type="button" onClick={resend} disabled={waitSeconds > 0 || status === 'loading'}
            className="w-full text-xs font-semibold text-ink-accent hover:underline disabled:text-ink-muted disabled:no-underline">
            {waitSeconds > 0 ? `Send a new code in ${waitSeconds}s` : 'Send a new code'}
          </button>
          <button type="button" onClick={() => dispatch(cancelChallenge())}
            className="w-full text-xs font-semibold text-ink-secondary hover:text-ink-primary">
            Cancel &amp; return to login
          </button>
        </form>
      </div>
    </div>
  );
}

const RESET_SENT_MESSAGE = "If an account exists for that address, we've emailed a reset link.";

// Asks for a password reset link. Whether the address has an account is never
// revealed: every accepted request shows the same neutral confirmation.
function ForgotPasswordForm({ initialEmail, onBack }) {
  const [email, setEmail] = useState(initialEmail || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sentMessage, setSentMessage] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const cleaned = email.trim().toLowerCase();
    if (!isValidEmail(cleaned)) {
      setError('Please enter a valid email address.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { response, data } = await postJson('/api/auth/password/reset/request/', {
        email: cleaned,
        origin: window.location.origin,
      });
      if (!response.ok) throw new Error(firstApiError(data, 'Could not send the reset email. Try again in a few minutes.'));
      setEmail(cleaned);
      setSentMessage(data.message || RESET_SENT_MESSAGE);
    } catch (err) {
      setError(err.message || 'Could not send the reset email. Try again in a few minutes.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-lg border border-edge bg-surface p-6 shadow-card sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
            <ShieldCheck className="h-6 w-6 text-brand-accent" />
          </div>
          <h1 className="text-heading-2">Reset your password</h1>
          {!sentMessage && (
            <p className="mt-1 text-sm text-ink-secondary">Enter your email and we'll send you a link to choose a new password.</p>
          )}
        </div>
        {sentMessage ? (
          <p role="status" className="rounded-md border border-ink-success/20 bg-surface-muted p-4 text-center text-sm font-semibold text-ink-primary">
            {sentMessage}
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <label htmlFor="reset-email" className="sr-only">Email address</label>
            <input id="reset-email" type="email" autoComplete="email" required placeholder="Email" value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-sm border border-edge bg-surface p-3 text-sm focus:border-ink-primary focus:outline-none" />
            {error && <p className="rounded-sm bg-surface-muted px-3 py-2 text-xs font-semibold text-ink-danger">{error}</p>}
            <button type="submit" disabled={busy}
              className="btn-primary w-full py-3 text-sm uppercase tracking-wider disabled:opacity-60">
              {busy ? 'Sending…' : 'Email me a reset link'}
            </button>
          </form>
        )}
        <button type="button" onClick={onBack}
          className="mt-4 w-full text-xs font-semibold text-ink-secondary hover:text-ink-primary">
          Back to sign in
        </button>
      </div>
    </div>
  );
}

function AuthForms() {
  const dispatch = useDispatch();
  const { status, error, challengeId } = useSelector((s) => s.auth);
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    email: '', password: '', first_name: '', last_name: '',
  });
  const [showMoreSignIn, setShowMoreSignIn] = useState(false);
  const [formError, setFormError] = useState('');
  const [forgotPassword, setForgotPassword] = useState(false);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    setFormError('');
    const cleaned = {
      ...form,
      email: form.email.trim().toLowerCase(),
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
    };
    if (!isValidEmail(cleaned.email)) {
      setFormError('Please enter a valid email address.');
      return;
    }
    if (!cleaned.password.trim()) {
      setFormError('Please enter your password.');
      return;
    }
    if (mode === 'register' && cleaned.password.length < 8) {
      setFormError('Password must be at least 8 characters long.');
      return;
    }
    if (mode === 'register' && (!cleaned.first_name || !cleaned.last_name)) {
      setFormError('Please enter your first and last name.');
      return;
    }
    setForm(cleaned);
    if (mode === 'register') {
      dispatch(register(cleaned));
      return;
    }
    dispatch(login({ email: cleaned.email, password: cleaned.password }))
      .unwrap()
      .then((result) => {
        // The code step never needs the password again, so drop it now.
        if (result.challenge) setForm((f) => ({ ...f, password: '' }));
      })
      .catch(() => {});
  };

  const switchMode = (m) => {
    setMode(m);
    setShowMoreSignIn(false);
    setFormError('');
    dispatch(clearAuthError());
  };

  const openForgotPassword = () => {
    // The reset flow never needs the password, so drop it from the form.
    setForm((f) => ({ ...f, password: '' }));
    setFormError('');
    dispatch(clearAuthError());
    setForgotPassword(true);
  };

  if (challengeId) return <LoginChallengeStep />;
  if (forgotPassword) {
    return <ForgotPasswordForm initialEmail={form.email.trim()} onBack={() => setForgotPassword(false)} />;
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-lg border border-edge bg-surface p-6 shadow-card sm:p-8">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-md bg-surface-muted">
          <UserIcon className="h-6 w-6 text-brand-accent" />
        </div>
        <h1 className="text-heading-2">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="mt-1 text-sm text-ink-secondary">
          {mode === 'login'
            ? 'Log in to track orders, manage addresses, and more.'
            : 'Join Sclero Proteins to checkout faster and track your orders.'}
        </p>
      </div>

      <div className="mb-6 flex rounded-sm border border-edge p-1">
        {['login', 'register'].map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={`flex-1 rounded-sm py-2 text-sm font-medium transition-colors ${
              mode === m ? 'bg-surface-inverse text-white' : 'text-ink-primary hover:bg-surface-muted'
            }`}
          >
            {m === 'login' ? 'Log in' : 'Sign up'}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3">
        {mode === 'register' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="register-first-name" className="sr-only">First name</label>
              <input id="register-first-name" type="text" autoComplete="given-name" required placeholder="First name" value={form.first_name}
                onChange={update('first_name')}
                className="w-full rounded-sm border border-edge bg-surface p-3 text-sm focus:border-ink-primary focus:outline-none" />
            </div>
            <div>
              <label htmlFor="register-last-name" className="sr-only">Last name</label>
              <input id="register-last-name" type="text" autoComplete="family-name" required placeholder="Last name" value={form.last_name}
                onChange={update('last_name')}
                className="w-full rounded-sm border border-edge bg-surface p-3 text-sm focus:border-ink-primary focus:outline-none" />
            </div>
          </div>
        )}
        <div>
          <label htmlFor="auth-email" className="sr-only">Email address</label>
          <input id="auth-email" type="email" autoComplete="email" required placeholder="Email" value={form.email}
            onChange={update('email')}
            className="w-full rounded-sm border border-edge bg-surface p-3 text-sm focus:border-ink-primary focus:outline-none" />
        </div>
        <div>
          <label htmlFor="auth-password" className="sr-only">Password</label>
          <PasswordInput id="auth-password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required placeholder="Password" value={form.password}
            onChange={update('password')}
            className="w-full rounded-sm border border-edge bg-surface p-3 text-sm focus:border-ink-primary focus:outline-none" />
          {mode === 'login' && (
            <div className="mt-1.5 text-right">
              <button type="button" onClick={openForgotPassword}
                className="text-xs font-semibold text-ink-accent hover:underline">
                Forgot password?
              </button>
            </div>
          )}
        </div>

        {(formError || error) && (
          <p className="rounded-sm bg-surface-muted px-3 py-2 text-xs font-semibold text-ink-danger">{formError || error}</p>
        )}
        <button type="submit" disabled={status === 'loading'}
          className="btn-primary w-full py-3 text-sm uppercase tracking-wider disabled:opacity-60">
          {status === 'loading' ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>

      {GOOGLE_ENABLED && (
        <div className="mt-6">
          <div className="relative mb-4 text-center">
            <span className="relative z-10 bg-surface px-3 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
              or continue with
            </span>
            <span className="absolute left-0 top-1/2 h-px w-full bg-edge" />
          </div>
          <GoogleSignInButton key={mode} text={mode === 'login' ? 'signin_with' : 'continue_with'} />
        </div>
      )}

      {mode === 'login' && (
        <div className="mt-6 border-t border-edge-subtle pt-4">
          <button
            type="button"
            onClick={() => setShowMoreSignIn((value) => !value)}
            className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-ink-secondary hover:text-ink-primary"
          >
            More sign-in options
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showMoreSignIn ? 'rotate-180' : ''}`} />
          </button>
          {showMoreSignIn && (
            <div className="mt-4 space-y-5">
              <div>
                <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">Magic link</p>
                <MagicLinkLogin />
              </div>
              <div>
                <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">Email code</p>
                <OtpLogin />
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

function AddressesTab({ authFetch }) {
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const blank = {
    full_name: '', phone_number: '', address_line1: '', address_line2: '',
    city: '', state: '', postal_code: '', country: 'GB', address_type: 'SHIPPING',
  };
  const [form, setForm] = useState(blank);
  const [formError, setFormError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    authFetch('/api/addresses/')
      .then((r) => r.json())
      .then((d) => setAddresses(Array.isArray(d) ? d : []))
      .catch(() => setAddresses([]))
      .finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const add = async (e) => {
    e.preventDefault();
    setFormError('');
    const cleaned = trimFormValues(form);
    const required = [
      ['full_name', 'full name'], ['phone_number', 'phone number'],
      ['address_line1', 'street address'], ['city', 'city'], ['state', 'state or region'],
      ['postal_code', 'postal code'], ['country', 'country code'],
    ];
    const missing = required.find(([field]) => !cleaned[field]);
    if (missing) {
      setFormError(`Please enter your ${missing[1]}.`);
      return;
    }
    if (!isValidPhone(cleaned.phone_number)) {
      setFormError('Please enter a valid phone number with 7 to 15 digits.');
      return;
    }
    if (!/^[A-Za-z]{2}$/.test(cleaned.country)) {
      setFormError('Please enter a valid two-letter country code, such as GB or IN.');
      return;
    }
    cleaned.country = cleaned.country.toUpperCase();
    try {
      const response = await authFetch('/api/addresses/', { method: 'POST', body: JSON.stringify(cleaned) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(firstApiError(data, 'Could not save this address.'));
      setShowForm(false);
      setForm(blank);
      load();
    } catch (error) {
      setFormError(error.message || 'Could not save this address.');
    }
  };

  const remove = (id) => {
    authFetch(`/api/addresses/${id}/`, { method: 'DELETE' }).then(load);
  };

  const upd = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  if (loading) return <p className="text-sm text-ink-secondary">Loading addresses…</p>;

  return (
    <div className="space-y-4">
      {addresses.length === 0 && !showForm && (
        <p className="text-sm text-ink-secondary">No saved addresses yet.</p>
      )}
      {addresses.map((a) => (
        <div key={a.id} className="flex items-start justify-between rounded-md border border-edge bg-surface p-4 shadow-card">
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 text-brand-accent" />
            <div className="text-sm">
              <p className="font-semibold text-ink-primary">{a.full_name} · {a.phone_number}</p>
              <p className="text-ink-secondary">
                {a.address_line1}{a.address_line2 ? `, ${a.address_line2}` : ''}, {a.city}, {a.state} {a.postal_code}, {a.country}
              </p>
              {a.is_default && <span className="mt-1 inline-block rounded bg-surface-muted px-2 py-0.5 text-[10px] font-semibold text-ink-accent">DEFAULT</span>}
            </div>
          </div>
          <button onClick={() => remove(a.id)} className="text-ink-muted hover:text-ink-danger">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      {showForm ? (
        <form onSubmit={add} className="space-y-3 rounded-md border border-edge bg-surface p-4 shadow-card">
          <div className="grid grid-cols-2 gap-3">
            <input required autoComplete="name" placeholder="Full name" value={form.full_name} onChange={upd('full_name')} className="rounded-sm border border-edge bg-surface p-2.5 text-sm text-ink-primary" />
            <input required type="tel" autoComplete="tel" placeholder="Phone" value={form.phone_number} onChange={upd('phone_number')} className="rounded-sm border border-edge bg-surface p-2.5 text-sm text-ink-primary" />
          </div>
          <input required autoComplete="address-line1" placeholder="Address line 1" value={form.address_line1} onChange={upd('address_line1')} className="w-full rounded-sm border border-edge bg-surface p-2.5 text-sm text-ink-primary" />
          <input autoComplete="address-line2" placeholder="Address line 2 (optional)" value={form.address_line2} onChange={upd('address_line2')} className="w-full rounded-sm border border-edge bg-surface p-2.5 text-sm text-ink-primary" />
          <div className="grid grid-cols-2 gap-3">
            <input required autoComplete="address-level2" placeholder="City" value={form.city} onChange={upd('city')} className="rounded-sm border border-edge bg-surface p-2.5 text-sm text-ink-primary" />
            <input required autoComplete="address-level1" placeholder="State" value={form.state} onChange={upd('state')} className="rounded-sm border border-edge bg-surface p-2.5 text-sm text-ink-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input required autoComplete="postal-code" placeholder="Postal code" value={form.postal_code} onChange={upd('postal_code')} className="rounded-sm border border-edge bg-surface p-2.5 text-sm text-ink-primary" />
            <input required autoComplete="country" maxLength={2} placeholder="Country (e.g. GB / IN)" value={form.country} onChange={upd('country')} className="rounded-sm border border-edge bg-surface p-2.5 text-sm text-ink-primary uppercase" />
          </div>
          {formError && <p className="rounded-sm bg-surface-muted px-3 py-2 text-xs font-semibold text-ink-danger">{formError}</p>}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary flex-1 py-2.5 text-xs uppercase">Save address</button>
            <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-sm border border-edge py-2.5 text-xs font-medium uppercase text-ink-primary">Cancel</button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 rounded-sm border border-dashed border-edge-strong px-4 py-2.5 text-sm font-medium text-ink-primary hover:border-ink-primary hover:text-ink-accent">
          <Plus className="h-4 w-4" /> Add address
        </button>
      )}
    </div>
  );
}

function OrdersTab({ authFetch }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch('/api/orders/mine/')
      .then((r) => r.json())
      .then((d) => setOrders(Array.isArray(d) ? d : (d.results || [])))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [authFetch]);

  if (loading) return <p className="text-sm text-ink-secondary">Loading orders…</p>;
  if (orders.length === 0) return <p className="text-sm text-ink-secondary">You have no orders yet.</p>;

  const statusColor = {
    PENDING: 'bg-amber-100 text-amber-800 border border-amber-200',
    CONFIRMED: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    PROCESSING: 'bg-blue-100 text-blue-800 border border-blue-200',
    SHIPPED: 'bg-indigo-100 text-indigo-800 border border-indigo-200',
    DELIVERED: 'bg-green-100 text-green-800 border border-green-200',
    COMPLETED: 'bg-green-100 text-green-800 border border-green-200',
    REFUNDED: 'bg-red-100 text-red-800 border border-red-200',
    CANCELLED: 'bg-surface-muted text-ink-secondary border border-edge',
  };

  const orderStages = [
    { key: 'confirmed', label: 'Order Confirmed' },
    { key: 'processing', label: 'Processing' },
    { key: 'shipped', label: 'Shipped' },
    { key: 'out_for_delivery', label: 'Out for Delivery' },
    { key: 'delivered', label: 'Delivered' },
  ];

  return (
    <div className="space-y-6">
      {orders.map((o) => {
        const currentStatus = String(o.status || 'CONFIRMED').toUpperCase();
        const activeStageIndex = ['DELIVERED', 'COMPLETED'].includes(currentStatus)
          ? 4
          : ['OUT_FOR_DELIVERY', 'OUT FOR DELIVERY'].includes(currentStatus)
          ? 3
          : currentStatus === 'SHIPPED'
          ? 2
          : currentStatus === 'PROCESSING'
          ? 1
          : 0;

        return (
          <div key={o.id} className="rounded-xl border border-edge bg-surface p-5 shadow-card space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-edge-subtle pb-3">
              <div>
                <span className="text-base font-bold text-ink-primary">Order #{o.id}</span>
                <p className="text-xs text-ink-secondary mt-0.5">
                  Placed on {o.created_at ? new Date(o.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                </p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${statusColor[currentStatus] || 'bg-surface-muted text-ink-secondary'}`}>
                {o.status === 'COMPLETED' ? 'Order Confirmed & Fulfilled' : o.status}
              </span>
            </div>

            {/* Visual Stage Progress Tracker */}
            <div className="py-2">
              <div className="relative flex items-center justify-between">
                <div className="absolute top-1/2 left-0 right-0 h-1 bg-edge -translate-y-1/2 z-0" />
                <div
                  className="absolute top-1/2 left-0 h-1 bg-brand-accent -translate-y-1/2 z-0 transition-all duration-500"
                  style={{ width: `${(activeStageIndex / (orderStages.length - 1)) * 100}%` }}
                />
                {orderStages.map((stage, idx) => {
                  const isPassed = idx <= activeStageIndex;
                  const isCurrent = idx === activeStageIndex;
                  return (
                    <div key={stage.key} className="relative z-10 flex flex-col items-center">
                      <div
                        className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
                          isPassed
                            ? 'bg-ink-primary text-white ring-4 ring-ink-primary/10'
                            : 'bg-white border-2 border-edge text-ink-muted'
                        }`}
                      >
                        {isPassed ? '✓' : idx + 1}
                      </div>
                      <span
                        className={`mt-1.5 text-[9px] font-semibold text-center hidden sm:block max-w-[65px] ${
                          isCurrent ? 'text-ink-primary font-bold' : isPassed ? 'text-ink-secondary' : 'text-ink-muted'
                        }`}
                      >
                        {stage.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Order Items */}
            <div className="space-y-1.5 border-t border-edge-subtle pt-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-muted mb-1">Items Included</p>
              <ul className="space-y-1 text-xs text-ink-primary">
                {(o.items || []).map((it) => (
                  <li key={it.id} className="flex justify-between items-center py-0.5">
                    <span><span className="font-semibold">{it.quantity}×</span> {it.product_name}</span>
                    {it.price && <span className="text-ink-secondary">{o.currency_code} {it.price}</span>}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap items-center justify-between border-t border-edge-subtle pt-3 text-xs">
              <span className="font-bold text-sm text-ink-primary">{o.currency_code} {o.total}</span>
              {o.invoice?.pdf_url && (
                <a
                  href={getApiUrl(o.invoice.pdf_url)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-primary py-1.5 px-3 text-xs font-semibold"
                >
                  Download Invoice PDF
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}



// PREMIUM ADDITION: Wishlist Tab
function WishlistTab() {
  const dispatch = useDispatch();
  const { currentRegion, currencySymbol, session_id } = useSelector((state) => state.region);
  const isAuthenticated = useSelector((state) => state.auth?.isAuthenticated);
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    setLoading(true);
    authenticatedFetch(`/api/wishlist/?region=${currentRegion}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const items = Array.isArray(data) ? data : (data.results || []);
        setWishlist(items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isAuthenticated, currentRegion]);

  const handleRemove = async (itemId) => {
    if (!isAuthenticated) return;
    try {
      const res = await authenticatedFetch(`/api/wishlist/${itemId}/`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setWishlist(wishlist.filter((w) => w.id !== itemId));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAdd = (item) => {
    dispatch(
      addToCart({
        session_id,
        region: currentRegion,
        product_id: item.product_id,
        quantity: 1,
      })
    );
  };

  if (loading) {
    return <p className="text-sm text-ink-secondary">Loading wishlist…</p>;
  }

  if (wishlist.length === 0) {
    return <p className="text-sm text-ink-secondary">Your wishlist is currently empty.</p>;
  }

  return (
    <div className="space-y-3">
      {wishlist.map((item) => (
        <div key={item.id} className="rounded-md border border-edge bg-surface p-4 shadow-card flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-14 w-14 bg-surface-muted rounded-md overflow-hidden shrink-0 border border-edge-subtle flex items-center justify-center">
              {item.thumbnail ? (
                <img src={item.thumbnail} alt={item.product_name} className="h-full w-full object-cover" />
              ) : (
                <Info className="h-6 w-6 text-ink-subtle" />
              )}
            </div>
            <div>
              <h3 className="text-xs font-bold text-ink-primary line-clamp-1 max-w-[200px]">{item.product_name}</h3>
              <p className="text-xs font-semibold text-ink-accent mt-0.5">
                {currencySymbol}{item.promotional_price ? parseFloat(item.promotional_price).toFixed(2) : item.price ? parseFloat(item.price).toFixed(2) : '0.00'}
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => handleAdd(item)}
              className="rounded-sm bg-surface-inverse px-3 py-1.5 text-xs font-medium text-white hover:bg-ink-secondary"
            >
              Add to Cart
            </button>
            <button
              type="button"
              onClick={() => handleRemove(item.id)}
              className="p-2 border border-edge rounded-sm hover:border-ink-danger hover:text-ink-danger text-ink-muted transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function VerifyEmailBanner({ email }) {
  const [state, setState] = useState('idle'); // idle | sending | sent | error
  const [message, setMessage] = useState('');

  const send = async () => {
    setState('sending');
    setMessage('');
    try {
      const { response, data } = await postJson('/api/auth/verify-email/', { origin: window.location.origin });
      if (!response.ok) throw new Error(firstApiError(data, 'Could not send the verification email.'));
      setState('sent');
      setMessage(data.message || `We sent a verification link to ${email}.`);
    } catch (err) {
      setState('error');
      setMessage(err.message || 'Could not send the verification email.');
    }
  };

  return (
    <div className="mb-6 flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-semibold text-amber-900">Please verify your email address</p>
        <p className="mt-0.5 text-xs text-amber-800">
          {state === 'sent' || state === 'error'
            ? message
            : `Confirm ${email} to see orders you placed as a guest with this address.`}
        </p>
      </div>
      {state !== 'sent' && (
        <button type="button" onClick={send} disabled={state === 'sending'}
          className="shrink-0 rounded-sm bg-surface-inverse px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white disabled:opacity-60">
          {state === 'sending' ? 'Sending…' : 'Send verification link'}
        </button>
      )}
    </div>
  );
}

function EmailChangeForm({ user, onClose }) {
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sentTo, setSentTo] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const cleaned = newEmail.trim().toLowerCase();
    if (!isValidEmail(cleaned)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (user.has_password && !password) {
      setError('Please enter your current password.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const { response, data } = await postJson('/api/auth/email-change/', {
        new_email: cleaned,
        password,
        origin: window.location.origin,
      });
      if (!response.ok) throw new Error(firstApiError(data, 'Could not start the email change.'));
      setSentTo(cleaned);
      setPassword('');
    } catch (err) {
      setError(err.message || 'Could not start the email change.');
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <div className="rounded-md border border-ink-success/20 bg-surface-muted p-4 text-xs">
        <p className="font-semibold text-ink-primary">Check your inbox at {sentTo}.</p>
        <p className="mt-1 text-ink-secondary">Open the link in that email to finish. Your current address keeps working until then.</p>
        <button type="button" onClick={onClose} className="mt-2 font-semibold text-ink-secondary hover:text-ink-primary">Close</button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor="new-email" className="sr-only">New email address</label>
      <input id="new-email" type="email" autoComplete="email" required placeholder="New email address" value={newEmail}
        onChange={(e) => setNewEmail(e.target.value)}
        className="w-full rounded-sm border border-edge bg-surface p-2.5 text-sm focus:border-ink-primary focus:outline-none" />
      {user.has_password && (
        <>
          <label htmlFor="email-change-password" className="sr-only">Current password</label>
          <PasswordInput id="email-change-password" autoComplete="current-password" placeholder="Current password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-sm border border-edge bg-surface p-2.5 text-sm focus:border-ink-primary focus:outline-none" />
        </>
      )}
      {error && <p className="text-xs font-semibold text-ink-danger">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn-primary px-4 py-2 text-xs uppercase tracking-wider disabled:opacity-60">
          {busy ? 'Sending…' : 'Send confirmation link'}
        </button>
        <button type="button" onClick={onClose} className="rounded-sm border border-edge px-4 py-2 text-xs font-medium text-ink-primary">Cancel</button>
      </div>
    </form>
  );
}

function SecuritySettings({ user, authFetch, onChanged }) {
  const isStaffAccount = Boolean(user.is_staff || user.is_superuser || (user.roles || []).length);
  const [passwords, setPasswords] = useState({ current: '', next: '' });
  const [passwordState, setPasswordState] = useState({ busy: false, error: '', done: '' });
  const [twoStep, setTwoStep] = useState(Boolean(user.two_factor_enabled));
  const [twoStepState, setTwoStepState] = useState({ busy: false, error: '' });
  const [signOutState, setSignOutState] = useState({ busy: false, error: '', done: '' });

  const changePassword = async (e) => {
    e.preventDefault();
    if (user.has_password && !passwords.current) {
      setPasswordState({ busy: false, error: 'Please enter your current password.', done: '' });
      return;
    }
    if (passwords.next.length < 8) {
      setPasswordState({ busy: false, error: 'Your new password must be at least 8 characters long.', done: '' });
      return;
    }
    setPasswordState({ busy: true, error: '', done: '' });
    try {
      const { response, data } = await postJson('/api/auth/password/change/', {
        current_password: passwords.current,
        new_password: passwords.next,
      });
      if (!response.ok) throw new Error(firstApiError(data, 'Could not change your password.'));
      setPasswords({ current: '', next: '' });
      setPasswordState({ busy: false, error: '', done: data.message || 'Password updated.' });
      onChanged();
    } catch (err) {
      setPasswordState({ busy: false, error: err.message || 'Could not change your password.', done: '' });
    }
  };

  const toggleTwoStep = async (enabled) => {
    setTwoStepState({ busy: true, error: '' });
    try {
      const response = await authFetch('/api/auth/profile/', {
        method: 'PATCH',
        body: JSON.stringify({ two_factor_enabled: enabled }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(firstApiError(data, 'Could not update two-step sign-in.'));
      setTwoStep(enabled);
      setTwoStepState({ busy: false, error: '' });
      onChanged();
    } catch (err) {
      setTwoStepState({ busy: false, error: err.message || 'Could not update two-step sign-in.' });
    }
  };

  const signOutOthers = async () => {
    setSignOutState({ busy: true, error: '', done: '' });
    try {
      const { response, data } = await postJson('/api/auth/profile/terminate-devices/', {});
      if (!response.ok) throw new Error(firstApiError(data, 'Could not sign out your other devices.'));
      setSignOutState({ busy: false, error: '', done: data.message || 'Signed out of all other devices.' });
    } catch (err) {
      setSignOutState({ busy: false, error: err.message || 'Could not sign out your other devices.', done: '' });
    }
  };

  return (
    <div className="space-y-5 rounded-md border border-edge bg-surface p-4 shadow-card">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-brand-accent" />
        <p className="text-sm font-bold text-ink-primary">Sign-in &amp; security</p>
      </div>

      <form onSubmit={changePassword} className="space-y-2">
        <p className="text-xs font-semibold text-ink-primary">{user.has_password ? 'Change password' : 'Set a password'}</p>
        {user.has_password && (
          <PasswordInput autoComplete="current-password" placeholder="Current password" value={passwords.current}
            onChange={(e) => setPasswords((p) => ({ ...p, current: e.target.value }))}
            className="w-full rounded-sm border border-edge bg-surface p-2.5 text-sm focus:border-ink-primary focus:outline-none" />
        )}
        <PasswordInput autoComplete="new-password" placeholder="New password (at least 8 characters)" value={passwords.next}
          onChange={(e) => setPasswords((p) => ({ ...p, next: e.target.value }))}
          className="w-full rounded-sm border border-edge bg-surface p-2.5 text-sm focus:border-ink-primary focus:outline-none" />
        {passwordState.error && <p className="text-xs font-semibold text-ink-danger">{passwordState.error}</p>}
        {passwordState.done && <p className="text-xs font-semibold text-ink-success">{passwordState.done}</p>}
        <button type="submit" disabled={passwordState.busy}
          className="btn-primary px-5 py-2 text-xs uppercase tracking-wider disabled:opacity-60">
          {passwordState.busy ? 'Saving…' : 'Update password'}
        </button>
        <p className="text-[11px] text-ink-muted">Changing your password signs you out on every other device.</p>
      </form>

      {isStaffAccount ? (
        <p className="border-t border-edge-subtle pt-4 text-xs text-ink-secondary">
          Staff accounts always sign in with a password and an emailed code.
        </p>
      ) : (
        <label className="flex cursor-pointer items-start gap-3 border-t border-edge-subtle pt-4">
          <input type="checkbox" checked={twoStep} disabled={twoStepState.busy || !user.has_password}
            onChange={(e) => toggleTwoStep(e.target.checked)} className="mt-0.5 accent-brand-accent" />
          <span>
            <span className="block text-sm font-semibold text-ink-primary">Two-step sign-in</span>
            <span className="block text-xs text-ink-secondary">
              When you sign in with your password we also email you a 6-digit code.
              {!user.has_password && ' Set a password first.'}
            </span>
            {twoStepState.error && <span className="mt-1 block text-xs font-semibold text-ink-danger">{twoStepState.error}</span>}
          </span>
        </label>
      )}

      <div className="border-t border-edge-subtle pt-4">
        <button type="button" onClick={signOutOthers} disabled={signOutState.busy}
          className="rounded-sm border border-edge bg-surface px-4 py-2 text-xs font-semibold text-ink-primary hover:bg-surface-muted disabled:opacity-60">
          {signOutState.busy ? 'Signing out…' : 'Sign out of all other devices'}
        </button>
        {signOutState.error && <p className="mt-2 text-xs font-semibold text-ink-danger">{signOutState.error}</p>}
        {signOutState.done && <p className="mt-2 text-xs font-semibold text-ink-success">{signOutState.done}</p>}
      </div>
    </div>
  );
}

function ProfileTab({ user, authFetch, regions, onSaved }) {
  const [homeRegion, setHomeRegion] = useState(user.home_region || '');
  const [prefs, setPrefs] = useState({
    email_order_updates: user.email_order_updates ?? true,
    email_marketing: user.email_marketing ?? false,
    email_newsletter: user.email_newsletter ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [saveError, setSaveError] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);

  const save = async () => {
    setSaving(true); setSavedMsg(''); setSaveError('');
    try {
      const response = await authFetch('/api/auth/profile/', {
        method: 'PATCH',
        body: JSON.stringify({ home_region: homeRegion || null, ...prefs }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(firstApiError(data, 'Could not save your preferences.'));
      setSavedMsg('Preferences saved.');
      if (onSaved) onSaved();
    } catch (error) {
      setSaveError(error.message || 'Could not save your preferences.');
    } finally {
      setSaving(false);
    }
  };

  const Toggle = ({ k, label, desc, locked }) => (
    <label className={`flex items-start gap-3 rounded-md border border-edge bg-surface p-4 shadow-card ${locked ? 'opacity-70' : 'cursor-pointer'}`}>
      <input type="checkbox" checked={prefs[k]} disabled={locked}
        onChange={(e) => setPrefs((p) => ({ ...p, [k]: e.target.checked }))}
        className="mt-0.5 accent-brand-accent" />
      <span>
        <span className="block text-sm font-semibold text-ink-primary">{label}</span>
        <span className="block text-xs text-ink-secondary">{desc}</span>
      </span>
    </label>
  );

  return (
    <div className="space-y-5">
      
      {/* Identity */}
      <div className="space-y-3">
        <div className="rounded-md border border-edge bg-surface p-4 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-brand-accent" />
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ink-secondary">Email</p>
                <p className="text-sm font-semibold text-ink-primary">{user.email}</p>
                <p className={`text-[11px] font-semibold ${user.email_verified ? 'text-ink-success' : 'text-amber-700'}`}>
                  {user.email_verified ? 'Verified' : 'Not verified yet'}
                </p>
              </div>
            </div>
            {!changingEmail && (
              <button type="button" onClick={() => setChangingEmail(true)} className="text-xs font-semibold text-ink-accent hover:underline">
                Change email
              </button>
            )}
          </div>
          {changingEmail && (
            <div className="mt-3">
              <EmailChangeForm user={user} onClose={() => setChangingEmail(false)} />
            </div>
          )}
        </div>
      </div>

      {/* Home region */}
      <div className="rounded-md border border-edge bg-surface p-4 shadow-card">
        <div className="mb-2 flex items-center gap-2">
          <Globe className="h-4 w-4 text-brand-accent" />
          <p className="text-sm font-bold text-ink-primary">Home region</p>
        </div>
        <p className="mb-3 text-xs text-ink-secondary">
          Where you’re based / billed. You can still browse and shop in another region using the
          selector in the header (your session region).
        </p>
        <select value={homeRegion} onChange={(e) => setHomeRegion(e.target.value ? Number(e.target.value) : '')}
          className="w-full rounded-sm border border-edge bg-surface p-2.5 text-sm text-ink-primary focus:border-ink-primary focus:outline-none">
          <option value="">Not set</option>
          {regions.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
        </select>
      </div>

      {/* Email preference centre */}
      <div className="rounded-md border border-edge bg-surface p-4 shadow-card">
        <div className="mb-3 flex items-center gap-2">
          <Bell className="h-4 w-4 text-brand-accent" />
          <p className="text-sm font-bold text-ink-primary">Email preferences</p>
        </div>
        <div className="space-y-2">
          <Toggle k="email_order_updates" label="Order & account updates"
            desc="Transactional emails about your orders. Always on for security & delivery." locked />
          <Toggle k="email_marketing" label="Offers & promotions"
            desc="Occasional discounts and product news. Opt-in (GDPR / DPDP)." />
          <Toggle k="email_newsletter" label="Newsletter"
            desc="Wellness tips and brand stories." />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="btn-primary px-6 py-2.5 text-xs uppercase tracking-wider disabled:opacity-60">
          {saving ? 'Saving…' : 'Save preferences'}
        </button>
        {savedMsg && <span className="text-xs font-semibold text-ink-success">{savedMsg}</span>}
        {saveError && <span className="text-xs font-semibold text-ink-danger">{saveError}</span>}
      </div>

      <SecuritySettings user={user} authFetch={authFetch} onChanged={onSaved} />

      <PrivacyControls authFetch={authFetch} userEmail={user.email} />
    </div>
  );
}

function PrivacyControls({ authFetch, userEmail }) {
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const downloadExport = async () => {
    setBusy(true); setError('');
    try {
      const res = await authFetch('/api/auth/me/export/');
      if (!res.ok) throw new Error('Export failed.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sclero-data-export-${Date.now()}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const deleteAccount = async () => {
    if (typed.trim().toLowerCase() !== userEmail.toLowerCase()) {
      setError('Type your email exactly to confirm.');
      return;
    }
    setBusy(true); setError('');
    try {
      const res = await authFetch('/api/auth/me/', { method: 'DELETE' });
      if (!res.ok) throw new Error('Deletion failed.');
      setDone('Account deleted. Logging you out…');
      setTimeout(() => { window.location.href = '/'; }, 1500);
    } catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <div className="rounded-md border border-edge bg-surface p-4 shadow-card">
      <p className="text-sm font-bold text-ink-primary">Privacy & data (GDPR / DPDP)</p>
      <p className="mt-1 text-xs text-ink-secondary">
        Download a copy of everything we hold about you, or permanently delete your account.
        Tax-required records (invoices, order totals) are retained per UK / IN law.
      </p>
      <div className="mt-3 flex flex-wrap gap-3">
        <button onClick={downloadExport} disabled={busy}
          className="rounded-sm border border-edge bg-surface px-4 py-2 text-xs font-semibold text-ink-primary hover:bg-surface-muted disabled:opacity-60">
          {busy ? 'Working…' : 'Download my data'}
        </button>
        {!confirmDelete ? (
          <button onClick={() => setConfirmDelete(true)}
            className="rounded-sm border border-red-200 bg-surface px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50">
            Delete my account
          </button>
        ) : (
          <div className="flex w-full flex-col gap-2 rounded-sm border border-red-200 bg-red-50 p-3">
            <p className="text-xs font-semibold text-red-700">
              Type your email <span className="font-mono">{userEmail}</span> to confirm. This cannot be undone.
            </p>
            <input value={typed} onChange={(e) => setTyped(e.target.value)}
              placeholder={userEmail}
              className="rounded-sm border border-red-200 bg-surface p-2 text-xs focus:border-red-400 focus:outline-none" />
            <div className="flex gap-2">
              <button onClick={deleteAccount} disabled={busy}
                className="rounded-sm bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60">
                {busy ? 'Deleting…' : 'Confirm deletion'}
              </button>
              <button onClick={() => { setConfirmDelete(false); setTyped(''); setError(''); }}
                className="rounded-sm border border-edge bg-surface px-3 py-1.5 text-xs font-semibold text-ink-primary">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
      {done && <p className="mt-2 text-xs font-semibold text-ink-success">{done}</p>}
    </div>
  );
}

export default function AccountPage() {
  const dispatch = useDispatch();
  const { user, sessionChecked } = useSelector((s) => s.auth);
  const [tab, setTab] = useState('profile');
  const [regions, setRegions] = useState([]);

  useEffect(() => {
    fetch(getApiUrl('/api/regions/')).then((r) => r.json())
      .then((d) => setRegions(Array.isArray(d) ? d : d.results || [])).catch(() => setRegions([]));
  }, []);

  // Authenticated fetch helper backed by the HttpOnly browser session.
  const authFetch = useCallback(
    (path, opts = {}) =>
      authenticatedFetch(path, {
        ...opts,
        headers: {
          'Content-Type': 'application/json',
          ...(opts.headers || {}),
        },
      }),
    []
  );

  if (!sessionChecked) {
    return <StoreShell><div className="mx-auto max-w-2xl px-4 py-20 text-center text-sm text-ink-muted">Checking your session…</div></StoreShell>;
  }

  if (!user) {
    return (
      <StoreShell>
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
          <AuthForms />
        </div>
      </StoreShell>
    );
  }

  const tabs = [
    { key: 'profile', label: 'Profile', icon: UserIcon },
    { key: 'addresses', label: 'Addresses', icon: MapPin },
    { key: 'orders', label: 'Orders', icon: Package },
    { key: 'wishlist', label: 'Wishlist', icon: Heart },
  ];

  return (
    <StoreShell>
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="kicker">My account</p>
            <h1 className="text-heading-1 mt-1">
              Hi, {user.first_name || user.email.split('@')[0]}
            </h1>
          </div>
          <button onClick={() => dispatch(logout())}
            className="inline-flex items-center gap-2 rounded-sm border border-edge px-4 py-2 text-sm font-medium text-ink-primary hover:border-ink-primary hover:bg-surface-muted">
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>

        {/* Admin console entry — prominent for staff so the dashboard is easy to find */}
        {(user.is_staff || user.is_superuser) && (
          <Link href="/admin"
            className="mb-6 flex items-center justify-between rounded-md border border-edge bg-surface p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-edge-strong hover:shadow-elevated">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-inverse text-white">
                <LayoutDashboard className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-primary">Admin Console</p>
                <p className="text-xs text-ink-muted">Manage products, collections, orders, payments &amp; shipping</p>
              </div>
            </div>
            <span className="text-sm font-medium text-ink-accent">Open →</span>
          </Link>
        )}

        {!user.email_verified && <VerifyEmailBanner email={user.email} />}

        {/* Tabs */}
        <div className="mb-6 flex gap-1 border-b border-edge overflow-x-auto scrollbar-none">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-medium uppercase tracking-wider transition-colors shrink-0 ${
                tab === t.key ? 'border-ink-primary text-ink-primary' : 'border-transparent text-ink-muted hover:text-ink-primary'
              }`}>
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* Tab panels */}
        <div className="bg-surface border border-edge rounded-lg shadow-card p-6 lg:p-8">
          {tab === 'profile' && (
            <ProfileTab user={user} authFetch={authFetch} regions={regions} onSaved={() => dispatch(fetchProfile())} />
          )}

          {tab === 'addresses' && <AddressesTab authFetch={authFetch} />}
          {tab === 'orders' && <OrdersTab authFetch={authFetch} />}
          {tab === 'wishlist' && <WishlistTab />}
        </div>
      </div>
    </StoreShell>
  );
}
