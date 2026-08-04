'use client';

import React, { useEffect, useState } from 'react';
import { Globe, Plus, X, Check, Star, AlertTriangle, Pencil, Loader2 } from 'lucide-react';
import { COUNTRIES, countryName } from '../../lib/isoGeo';

// One-click suggestions for the most common markets; every other country is
// available through the search box below (full ISO list from lib/isoGeo).
const QUICK_ADD_CODES = [
  'GB', 'IN', 'US', 'CA', 'AU', 'NZ', 'IE', 'DE', 'FR', 'ES', 'IT', 'NL',
  'AE', 'SA', 'SG', 'MY', 'LK', 'NP', 'ZA', 'JP',
];

const blankMarket = () => ({
  code: '', name: '', domain: '', currency_code: '', currency_symbol: '',
  tax_name: 'VAT', tax_rate: '0.00', is_active: true,
});

/* Create/edit dialog for a market's own settings — name, currency, tax.
   Kept to the handful of fields the storefront actually uses, so adding a
   market is a one-minute task rather than a form marathon. */
function MarketEditorPage({ market, onSaved, onClose, authFetch }) {
  const isNew = !market?.id;
  const [m, setM] = useState(() => ({ ...blankMarket(), ...(market || {}) }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (key, value) => setM((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    if (!m.code.trim() || !m.name.trim() || !m.currency_code.trim()) {
      setErr('Code, name, and currency are required.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const res = await authFetch(isNew ? '/api/admin/regions/' : `/api/admin/regions/${m.id}/`, {
        method: isNew ? 'POST' : 'PATCH',
        body: JSON.stringify({
          code: m.code.trim().toUpperCase(),
          name: m.name.trim(),
          domain: m.domain.trim(),
          currency_code: m.currency_code.trim().toUpperCase(),
          currency_symbol: m.currency_symbol.trim(),
          tax_name: m.tax_name.trim() || 'Tax',
          tax_rate: m.tax_rate === '' ? '0.00' : m.tax_rate,
          is_active: Boolean(m.is_active),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const first = Object.entries(data)[0];
        throw new Error(first ? `${first[0]}: ${Array.isArray(first[1]) ? first[1][0] : first[1]}` : 'Could not save the market.');
      }
      onSaved(isNew ? `Market ${data.code} created. Now add the countries it serves.` : `Market ${data.code} updated.`);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-action-page flex flex-col items-center">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-lg border border-edge bg-white p-6 shadow-overlay sm:max-w-lg sm:rounded-lg">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-ink-primary">{isNew ? 'Add market' : `Edit market — ${market.name}`}</h3>
            <p className="mt-1 text-sm text-ink-muted">
              A market groups the currency, pricing, and tax that a set of countries sees.
            </p>
          </div>
          <button onClick={onClose} className="rounded-sm p-2 text-ink-muted hover:bg-surface-muted" aria-label="Close market editor"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="kicker mb-1 block">Market name *</label>
              <input value={m.name} onChange={(e) => set('name', e.target.value)} className="w-full rounded-sm border border-edge p-2.5" placeholder="e.g. United Kingdom" />
            </div>
            <div>
              <label className="kicker mb-1 block">Short code *</label>
              <input value={m.code} disabled={!isNew} onChange={(e) => set('code', e.target.value.toUpperCase())} maxLength={10} className="w-full rounded-sm border border-edge p-2.5 uppercase disabled:bg-surface-muted disabled:text-ink-muted" placeholder="e.g. UK" />
            </div>
          </div>

          <div>
            <label className="kicker mb-1 block">Storefront domain</label>
            <input value={m.domain} onChange={(e) => set('domain', e.target.value)} className="w-full rounded-sm border border-edge p-2.5" placeholder="e.g. scleroproteins.co.uk" />
            <p className="mt-1 text-[12px] text-ink-muted">Visitors on this domain see this market. Leave as-is if unsure.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="kicker mb-1 block">Currency code *</label>
              <input value={m.currency_code} onChange={(e) => set('currency_code', e.target.value.toUpperCase())} maxLength={10} className="w-full rounded-sm border border-edge p-2.5 uppercase" placeholder="e.g. GBP" />
            </div>
            <div>
              <label className="kicker mb-1 block">Currency symbol</label>
              <input value={m.currency_symbol} onChange={(e) => set('currency_symbol', e.target.value)} maxLength={5} className="w-full rounded-sm border border-edge p-2.5" placeholder="e.g. £" />
            </div>
            <div>
              <label className="kicker mb-1 block">Tax name</label>
              <input value={m.tax_name} onChange={(e) => set('tax_name', e.target.value)} className="w-full rounded-sm border border-edge p-2.5" placeholder="e.g. VAT or GST" />
            </div>
            <div>
              <label className="kicker mb-1 block">Tax rate (%)</label>
              <input type="number" min="0" step="0.01" value={m.tax_rate} onChange={(e) => set('tax_rate', e.target.value)} className="w-full rounded-sm border border-edge p-2.5" placeholder="e.g. 20" />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 font-semibold text-ink-primary">
            <input type="checkbox" checked={Boolean(m.is_active)} onChange={(e) => set('is_active', e.target.checked)} className="h-4 w-4 accent-ink-primary" />
            Market is active (customers can shop here)
          </label>

          {err && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{err}</p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button onClick={save} disabled={saving} className="btn-primary flex-1 py-3">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Saving…' : isNew ? 'Create market' : 'Save changes'}
            </button>
            <button onClick={onClose} className="btn-ghost flex-1 py-3">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MarketsPanel({ authFetch }) {
  const [regions, setRegions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [countrySearch, setCountrySearch] = useState({});
  const [editingMarket, setEditingMarket] = useState(null); // null | 'new' | region object

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
    save(region, { countries: next }, `${countryName(clean)} now ships from ${region.code}.`);
  };

  const removeCountry = (region, code) => {
    const next = (region.countries || []).filter((c) => c !== code);
    save(region, { countries: next }, `${countryName(code)} removed from ${region.code}.`);
  };

  const claimedElsewhere = (region, code) =>
    regions.some((r) => r.id !== region.id && (r.countries || []).includes(code));

  // Accept a country typed or picked by name or by ISO code.
  const resolveSearch = (raw) => {
    const value = String(raw || '').trim();
    if (!value) return '';
    const match = COUNTRIES.find(
      (c) => c.name.toLowerCase() === value.toLowerCase() || c.code === value.toUpperCase()
    );
    return match ? match.code : (value.length === 2 ? value.toUpperCase() : '');
  };

  if (loading) return <p className="text-sm text-ink-muted">Loading markets…</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-ink-primary">Markets &amp; countries</h3>
          <p className="mt-1 text-sm leading-relaxed text-ink-secondary">
            Choose which countries each market serves. A visitor from a listed country sees that
            market&apos;s currency, pricing and tax. Countries not listed anywhere fall back to the
            default market.
          </p>
        </div>
        <button onClick={() => setEditingMarket('new')} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm uppercase">
          <Plus className="h-4 w-4" /> Add market
        </button>
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
                  {region.code} · {region.currency_code} · {region.tax_name} {Number(region.tax_rate)}%
                </span>
                {!region.is_active && (
                  <span className="text-[12px] font-semibold uppercase text-brand-warning">inactive</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingMarket(region)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-edge px-3 py-1 text-[12px] font-semibold uppercase text-ink-muted transition-colors hover:border-ink-primary hover:text-ink-primary"
                >
                  <Pencil className="h-3 w-3" /> Edit market
                </button>
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
                  {countryName(code)}
                  <span className="text-ink-muted">{code}</span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => removeCountry(region, code)}
                    aria-label={`Stop shipping to ${countryName(code)} from ${region.code}`}
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
                {QUICK_ADD_CODES.filter(
                  (code) => !(region.countries || []).includes(code) && !claimedElsewhere(region, code)
                ).map((code) => (
                  <button
                    key={code}
                    type="button"
                    disabled={busy}
                    onClick={() => addCountry(region, code)}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-edge px-2.5 py-1 text-[13px] text-ink-muted transition-colors hover:border-ink-primary hover:text-ink-primary disabled:opacity-40"
                  >
                    <Plus className="h-3 w-3" /> {countryName(code)}
                  </button>
                ))}
              </div>

              <div className="mt-2.5 flex gap-2">
                <input
                  list={`country-options-${region.id}`}
                  value={countrySearch[region.id] || ''}
                  onChange={(e) => setCountrySearch((s) => ({ ...s, [region.id]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    const code = resolveSearch(countrySearch[region.id]);
                    if (code) {
                      addCountry(region, code);
                      setCountrySearch((s) => ({ ...s, [region.id]: '' }));
                    }
                  }}
                  placeholder="Search any country, e.g. Brazil"
                  className="w-64 rounded-sm border border-edge p-2 text-sm"
                />
                <datalist id={`country-options-${region.id}`}>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.name}>{c.code}</option>
                  ))}
                </datalist>
                <button
                  type="button"
                  disabled={busy || !resolveSearch(countrySearch[region.id])}
                  onClick={() => {
                    addCountry(region, resolveSearch(countrySearch[region.id]));
                    setCountrySearch((s) => ({ ...s, [region.id]: '' }));
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

      {editingMarket && (
        <MarketEditorPage
          market={editingMarket === 'new' ? null : editingMarket}
          authFetch={authFetch}
          onClose={() => setEditingMarket(null)}
          onSaved={(message) => {
            setEditingMarket(null);
            setNotice(message);
            load();
          }}
        />
      )}
    </div>
  );
}
