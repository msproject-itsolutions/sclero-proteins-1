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
  completeLogin, fetch2faStatus, setup2fa, verify2fa, disable2fa, requestMagicLink,
} from '../../store/authSlice';
import { getApiUrl } from '../../lib/api';
import { authenticatedFetch } from '../../lib/authFetch';
import { addToCart } from '../../store/cartSlice';

function OtpLogin() {
  const dispatch = useDispatch();
  const { status, error } = useSelector((s) => s.auth);
  const [stage, setStage] = useState('request'); // request | verify
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [sandboxCode, setSandboxCode] = useState('');

  const requestCode = (e) => {
    e.preventDefault();
    dispatch(sendOtp({ identifier })).unwrap().then((d) => {
      setStage('verify');
      if (d.otp_preview_for_sandbox) setSandboxCode(d.otp_preview_for_sandbox);
    }).catch(() => {});
  };
  const verify = (e) => {
    e.preventDefault();
    dispatch(verifyOtp({ identifier, otp }));
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
      {error && <p className="rounded-sm bg-surface-muted px-3 py-2 text-xs font-semibold text-ink-danger">{error}</p>}
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
      {error && <p className="rounded-sm bg-surface-muted px-3 py-2 text-xs font-semibold text-ink-danger">{error}</p>}
      <button type="submit" disabled={status === 'loading'}
        className="btn-primary w-full py-3 text-sm uppercase tracking-wider disabled:opacity-60">
        {status === 'loading' ? 'Verifying…' : 'Verify & log in'}
      </button>
      <button type="button" onClick={() => setStage('request')}
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
    dispatch(requestMagicLink({ email })).unwrap().then((d) => {
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

function AuthForms() {
  const dispatch = useDispatch();
  const { status, error, twoFactorRequired, sandboxOtp, twoFactorEmail, requiresTotp, pendingEmail } = useSelector((s) => s.auth);
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    email: '', password: '', first_name: '', last_name: '',
  });
  const [otp, setOtp] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [useBackup, setUseBackup] = useState(false);
  const [showMoreSignIn, setShowMoreSignIn] = useState(false);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (mode === 'login') dispatch(login({ email: form.email, password: form.password }));
    else dispatch(register(form));
  };

  const submit2fa = (e) => {
    e.preventDefault();
    dispatch(verifyOtp({ identifier: twoFactorEmail, otp }));
  };

  const submitTotp = (e) => {
    e.preventDefault();
    dispatch(completeLogin({ totpCode }));
  };

  const switchMode = (m) => {
    setMode(m);
    setShowMoreSignIn(false);
    dispatch(clearAuthError());
  };

  if (requiresTotp) {
    return (
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
            <ShieldCheck className="h-6 w-6 text-brand-accent" />
          </div>
          <h1 className="text-heading-2">Authenticator code</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            Enter the {useBackup ? 'backup' : '6-digit'} code for <span className="font-semibold text-ink-primary">{pendingEmail}</span>.
          </p>
        </div>
        <form onSubmit={submitTotp} className="space-y-3">
          <label htmlFor="totp-code" className="sr-only">{useBackup ? 'Backup code' : 'Authenticator code'}</label>
          <input
            id="totp-code"
            type="text"
            inputMode={useBackup ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            required
            placeholder={useBackup ? 'Backup code' : '6-digit code'}
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            className="w-full rounded-sm border border-edge bg-surface p-3 text-center text-lg tracking-[0.4em] focus:border-ink-primary focus:outline-none"
          />
          {error && <p className="rounded-sm bg-surface-muted px-3 py-2 text-xs font-semibold text-ink-danger">{error}</p>}
          <button type="submit" disabled={status === 'loading'}
            className="btn-primary w-full py-3 text-sm uppercase tracking-wider disabled:opacity-60">
            {status === 'loading' ? 'Verifying…' : 'Verify code'}
          </button>
          <button type="button" onClick={() => { setUseBackup((v) => !v); setTotpCode(''); }}
            className="w-full text-xs font-semibold text-ink-accent hover:underline">
            {useBackup ? 'Use authenticator code instead' : 'Use a backup code instead'}
          </button>
          <button type="button" onClick={() => dispatch(logout())}
            className="w-full text-xs font-semibold text-ink-secondary hover:text-ink-primary">
            Cancel &amp; return to login
          </button>
        </form>
      </div>
    );
  }

  if (twoFactorRequired) {
    return (
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
            <ShieldCheck className="h-6 w-6 text-brand-accent" />
          </div>
          <h1 className="text-heading-2">Two-Factor Authentication</h1>
          <p className="mt-1 text-sm text-ink-secondary">
            For security, please enter the 6-digit verification code sent to <span className="font-semibold text-ink-primary">{twoFactorEmail}</span>.
          </p>
        </div>

        <form onSubmit={submit2fa} className="space-y-3">
          {sandboxOtp && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-700">
              Sandbox code: <span className="font-mono font-bold">{sandboxOtp}</span>
            </p>
          )}
          <label htmlFor="2fa-code" className="sr-only">2FA Verification Code</label>
          <input
            id="2fa-code"
            type="text" inputMode="numeric" autoComplete="one-time-code" required placeholder="6-digit code" value={otp}
            onChange={(e) => setOtp(e.target.value)}
            className="w-full rounded-sm border border-edge bg-surface p-3 text-center text-lg tracking-[0.4em] focus:border-ink-primary focus:outline-none"
          />
          {error && <p className="rounded-sm bg-surface-muted px-3 py-2 text-xs font-semibold text-ink-danger">{error}</p>}
          <button type="submit" disabled={status === 'loading'}
            className="btn-primary w-full py-3 text-sm uppercase tracking-wider disabled:opacity-60">
            {status === 'loading' ? 'Verifying…' : 'Verify & log in'}
          </button>
          <button type="button" onClick={() => dispatch(logout())}
            className="w-full text-xs font-semibold text-ink-secondary hover:text-ink-primary">
            Cancel &amp; return to login
          </button>
        </form>
      </div>
    );
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
              <input id="register-first-name" type="text" autoComplete="given-name" placeholder="First name" value={form.first_name}
                onChange={update('first_name')}
                className="w-full rounded-sm border border-edge bg-surface p-3 text-sm focus:border-ink-primary focus:outline-none" />
            </div>
            <div>
              <label htmlFor="register-last-name" className="sr-only">Last name</label>
              <input id="register-last-name" type="text" autoComplete="family-name" placeholder="Last name" value={form.last_name}
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
          <input id="auth-password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required placeholder="Password" value={form.password}
            onChange={update('password')}
            className="w-full rounded-sm border border-edge bg-surface p-3 text-sm focus:border-ink-primary focus:outline-none" />
        </div>

        {error && (
          <p className="rounded-sm bg-surface-muted px-3 py-2 text-xs font-semibold text-ink-danger">{error}</p>
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

  const load = useCallback(() => {
    setLoading(true);
    authFetch('/api/addresses/')
      .then((r) => r.json())
      .then((d) => setAddresses(Array.isArray(d) ? d : []))
      .catch(() => setAddresses([]))
      .finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const add = (e) => {
    e.preventDefault();
    authFetch('/api/addresses/', { method: 'POST', body: JSON.stringify(form) })
      .then((r) => r.json())
      .then(() => { setShowForm(false); setForm(blank); load(); });
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
            <input required autoComplete="tel" placeholder="Phone" value={form.phone_number} onChange={upd('phone_number')} className="rounded-sm border border-edge bg-surface p-2.5 text-sm text-ink-primary" />
          </div>
          <input required autoComplete="address-line1" placeholder="Address line 1" value={form.address_line1} onChange={upd('address_line1')} className="w-full rounded-sm border border-edge bg-surface p-2.5 text-sm text-ink-primary" />
          <input autoComplete="address-line2" placeholder="Address line 2 (optional)" value={form.address_line2} onChange={upd('address_line2')} className="w-full rounded-sm border border-edge bg-surface p-2.5 text-sm text-ink-primary" />
          <div className="grid grid-cols-2 gap-3">
            <input required autoComplete="address-level2" placeholder="City" value={form.city} onChange={upd('city')} className="rounded-sm border border-edge bg-surface p-2.5 text-sm text-ink-primary" />
            <input required autoComplete="address-level1" placeholder="State" value={form.state} onChange={upd('state')} className="rounded-sm border border-edge bg-surface p-2.5 text-sm text-ink-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input required autoComplete="postal-code" placeholder="Postal code" value={form.postal_code} onChange={upd('postal_code')} className="rounded-sm border border-edge bg-surface p-2.5 text-sm text-ink-primary" />
            <input required autoComplete="country" placeholder="Country (e.g. GB / IN)" value={form.country} onChange={upd('country')} className="rounded-sm border border-edge bg-surface p-2.5 text-sm text-ink-primary" />
          </div>
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
    PENDING: 'bg-amber-100 text-amber-700',
    PROCESSING: 'bg-blue-100 text-blue-700',
    SHIPPED: 'bg-indigo-100 text-indigo-700',
    DELIVERED: 'bg-green-100 text-green-700',
    REFUNDED: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-surface-muted text-ink-secondary',
  };

  return (
    <div className="space-y-4">
      {orders.map((o) => (
        <div key={o.id} className="rounded-md border border-edge bg-surface p-4 shadow-card">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-bold text-ink-primary">Order #{o.id}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusColor[o.status] || 'bg-surface-muted text-ink-secondary'}`}>
              {o.status}
            </span>
          </div>
          <p className="mb-2 text-xs text-ink-secondary">
            {o.created_at ? new Date(o.created_at).toLocaleDateString() : ''} · {o.items?.length || 0} item(s)
          </p>
          <ul className="mb-2 space-y-1 text-xs text-ink-secondary">
            {(o.items || []).map((it) => (
              <li key={it.id}>{it.quantity}× {it.product_name}</li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-edge-subtle pt-2">
            <span className="text-sm font-semibold text-ink-primary">{o.currency_code} {o.total}</span>
            {o.invoice?.pdf_url && (
              <a href={getApiUrl(o.invoice.pdf_url)} target="_blank" rel="noreferrer" className="text-xs font-semibold text-ink-accent hover:underline">
                Download invoice
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}



// PREMIUM ADDITION: Wishlist Tab
function WishlistTab() {
  const dispatch = useDispatch();
  const { currentRegion, currencySymbol, session_id } = useSelector((state) => state.region);
  const accessToken = useSelector((state) => state.auth?.access);
  const [wishlist, setWishlist] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    authenticatedFetch(`/api/wishlist/?region=${currentRegion}`, {}, accessToken)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const items = Array.isArray(data) ? data : (data.results || []);
        setWishlist(items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accessToken, currentRegion]);

  const handleRemove = async (itemId) => {
    if (!accessToken) return;
    try {
      const res = await authenticatedFetch(`/api/wishlist/${itemId}/`, {
        method: 'DELETE',
      }, accessToken);
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

function ProfileTab({ user, authFetch, regions, onSaved }) {
  const [homeRegion, setHomeRegion] = useState(user.home_region || '');
  const [prefs, setPrefs] = useState({
    email_order_updates: user.email_order_updates ?? true,
    email_marketing: user.email_marketing ?? false,
    email_newsletter: user.email_newsletter ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  const save = () => {
    setSaving(true); setSavedMsg('');
    authFetch('/api/auth/profile/', {
      method: 'PATCH',
      body: JSON.stringify({ home_region: homeRegion || null, ...prefs }),
    })
      .then((r) => r.json())
      .then(() => { setSavedMsg('Preferences saved.'); onSaved && onSaved(); })
      .finally(() => setSaving(false));
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
        <div className="flex items-center gap-3 rounded-md border border-edge bg-surface p-4 shadow-card">
          <Mail className="h-5 w-5 text-brand-accent" />
          <div><p className="text-[11px] uppercase tracking-wide text-ink-secondary">Email</p>
            <p className="text-sm font-semibold text-ink-primary">{user.email}</p></div>
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
      </div>

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
      localStorage.removeItem('sclero_access');
      localStorage.removeItem('sclero_refresh');
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
  const { user, access } = useSelector((s) => s.auth);
  const [tab, setTab] = useState('profile');
  const [regions, setRegions] = useState([]);

  useEffect(() => {
    fetch(getApiUrl('/api/regions/')).then((r) => r.json())
      .then((d) => setRegions(Array.isArray(d) ? d : d.results || [])).catch(() => setRegions([]));
  }, []);

  useEffect(() => {
    if (access && !user) dispatch(fetchProfile());
  }, [access, user, dispatch]);

  // Authenticated fetch helper bound to the current access token.
  const authFetch = useCallback(
    (path, opts = {}) =>
      authenticatedFetch(path, {
        ...opts,
        headers: {
          'Content-Type': 'application/json',
          ...(opts.headers || {}),
        },
      }, access),
    [access]
  );

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
