'use client';

import React, { useEffect, useState } from 'react';
import { Globe, Plus, X, Check, Star, AlertTriangle } from 'lucide-react';

// A working set of common markets so the admin can click rather than remember
// ISO codes. Any valid ISO-2 code can still be typed in, so this list never
// limits which countries the store can sell to.
const COMMON_COUNTRIES = [
  ['GB', 'United Kingdom'], ['IN', 'India'], ['US', 'United States'],
  ['CA', 'Canada'], ['AU', 'Australia'], ['NZ', 'New Zealand'],
  ['IE', 'Ireland'], ['DE', 'Germany'], ['FR', 'France'],
  ['ES', 'Spain'], ['IT', 'Italy'], ['NL', 'Netherlands'],
  ['AE', 'United Arab Emirates'], ['SA', 'Saudi Arabia'], ['SG', 'Singapore'],
  ['MY', 'Malaysia'], ['LK', 'Sri Lanka'], ['NP', 'Nepal'],
  ['ZA', 'South Africa'], ['JP', 'Japan'],
];

const NAME_BY_CODE = Object.fromEntries(COMMON_COUNTRIES);
const countryLabel = (code) => NAME_BY_CODE[code] || code;

export default function MarketsPanel({ authFetch }) {
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [customCode, setCustomCode] = useState({});

  const load = React.useCallback(() => {
    setLoading(true);
    authFetch('/api/admin/regions/')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load markets.'))))
      .then((data) => {
        setRegions(Array.isArray(data) ? data : data.results || []);
        setError('');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const save = async (region, patch, successMessage) => {
    setSavingId(region.id);
    setError('');
    setNotice('');
    try {
      const res = await authFetch(`/api/admin/regions/${region.id}/`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Surface the server's own reason (e.g. "GB already served by UK").
        const detail = data?.countries?.[0] || data?.detail || 'Could not save that change.';
        throw new Error(detail);
      }
      setNotice(successMessage);
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingId(null);
    }
  };

  const addCountry = (region, code) => {
    const clean = String(code || '').trim().toUpperCase();
    if (!clean) return;
    const next = [...(region.countries || [])];
    if (next.includes(clean)) return;
    next.push(clean);
    save(region, { countries: next }, `${countryLabel(clean)} now ships from ${region.code}.`);
  };

  const removeCountry = (region, code) => {
    const next = (region.countries || []).filter((c) => c !== code);
    save(region, { countries: next }, `${countryLabel(code)} removed from ${region.code}.`);
  };

  const claimedElsewhere = (region, code) =>
    regions.some((r) => r.id !== region.id && (r.countries || []).includes(code));

  if (loading) return <p className="text-sm text-ink-muted">Loading markets…</p>;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-ink-primary">Markets &amp; countries</h3>
        <p className="mt-1 text-sm leading-relaxed text-ink-secondary">
          Choose which countries each market serves. A visitor from a listed country sees that
          market&apos;s currency, pricing and tax. Countries not listed anywhere fall back to the
          default market.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
          <p className="text-sm text-green-700">{notice}</p>
        </div>
      )}

      {regions.map((region) => {
        const busy = savingId === region.id;
        return (
          <div key={region.id} className="rounded-lg border border-edge bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-ink-accent" />
                <span className="text-sm font-semibold text-ink-primary">{region.name}</span>
                <span className="rounded-sm bg-surface-muted px-1.5 py-0.5 text-[12px] font-semibold uppercase text-ink-muted">
                  {region.code} · {region.currency_code}
                </span>
                {!region.is_active && (
                  <span className="text-[12px] font-semibold uppercase text-brand-warning">inactive</span>
                )}
              </div>

              <button
                type="button"
                disabled={busy || region.is_default}
                onClick={() => save(region, { is_default: true }, `${region.name} is now the default market.`)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold uppercase transition-colors ${
                  region.is_default
                    ? 'border-ink-accent bg-surface-muted text-ink-accent'
                    : 'border-edge text-ink-muted hover:border-ink-primary hover:text-ink-primary'
                }`}
                title="Visitors from unlisted countries land here"
              >
                <Star className={`h-3 w-3 ${region.is_default ? 'fill-ink-accent' : ''}`} />
                {region.is_default ? 'Default market' : 'Make default'}
              </button>
            </div>

            {/* Current countries */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(region.countries || []).length === 0 && (
                <span className="text-[13px] italic text-ink-muted">
                  No countries yet — this market serves nobody automatically.
                </span>
              )}
              {(region.countries || []).map((code) => (
                <span
                  key={code}
                  className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-surface-subtle py-1 pl-2.5 pr-1.5 text-[13px] font-medium text-ink-primary"
                >
                  {countryLabel(code)}
                  <span className="text-ink-muted">{code}</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => removeCountry(region, code)}
                    aria-label={`Stop shipping to ${countryLabel(code)} from ${region.code}`}
                    className="rounded-full p-0.5 text-ink-muted hover:bg-surface-muted hover:text-red-600 disabled:opacity-40"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>

            {/* Add countries */}
            <div className="mt-3 border-t border-edge-subtle pt-3">
              <p className="kicker mb-1.5">Add a country</p>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_COUNTRIES.filter(
                  ([code]) => !(region.countries || []).includes(code) && !claimedElsewhere(region, code)
                ).map(([code, label]) => (
                  <button
                    key={code}
                    type="button"
                    disabled={busy}
                    onClick={() => addCountry(region, code)}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-edge px-2.5 py-1 text-[13px] text-ink-muted transition-colors hover:border-ink-primary hover:text-ink-primary disabled:opacity-40"
                  >
                    <Plus className="h-3 w-3" /> {label}
                  </button>
                ))}
              </div>

              <div className="mt-2.5 flex gap-2">
                <input
                  value={customCode[region.id] || ''}
                  onChange={(e) => setCustomCode((s) => ({ ...s, [region.id]: e.target.value }))}
                  placeholder="Any other ISO-2 code, e.g. BR"
                  maxLength={2}
                  className="w-56 rounded-sm border border-edge p-2 text-sm uppercase"
                />
                <button
                  type="button"
                  disabled={busy || !(customCode[region.id] || '').trim()}
                  onClick={() => {
                    addCountry(region, customCode[region.id]);
                    setCustomCode((s) => ({ ...s, [region.id]: '' }));
                  }}
                  className="rounded-lg border border-edge px-3 text-sm font-semibold text-ink-primary hover:border-ink-primary disabled:opacity-40"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        );
      })}

      <p className="text-[13px] leading-relaxed text-ink-muted">
        Adding a country routes its visitors here immediately. They can only buy products that have
        a price set for this market, so set prices under Products → each product → regional pricing,
        and add a shipping zone under Settings → Shipping.
      </p>
    </div>
  );
}
