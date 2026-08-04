'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { COUNTRIES, countryName, subdivisionsFor } from '../../lib/isoGeo';
import {
  X, ChevronLeft, Plus, Trash2, Copy, Pencil, Save,
  Globe, MapPin, Package, Truck, Zap, AlertCircle, Check,
  Loader2, Upload, ChevronDown, ChevronUp, Tag, DollarSign,
  Weight, ShoppingCart, Percent, AlertTriangle, Clock
} from 'lucide-react';

/* ─────────── Constants ─────────── */
const RATE_TYPES = [
  { value: 'FLAT',   label: 'Flat Rate',     icon: DollarSign,   desc: 'Fixed price regardless of order' },
  { value: 'WEIGHT', label: 'Weight-Based',  icon: Weight,       desc: 'Price scales with order weight' },
  { value: 'PRICE',  label: 'Cart Value',    icon: ShoppingCart, desc: 'Price scales with order total' },
  { value: 'QTY',    label: 'Quantity',      icon: Package,      desc: 'Price scales with item count' },
  { value: 'FREE',   label: 'Free Shipping', icon: Tag,          desc: 'No shipping charge' },
  { value: 'CUSTOM', label: 'Custom Method', icon: Truck,        desc: 'Custom courier or rule' },
];

const SHIPPING_METHODS = [
  'Standard Shipping', 'Express Shipping', 'Same-Day Delivery',
  'Overnight Delivery', 'Click & Collect', 'International Economy',
  'International Express', 'Custom',
];

const LABEL = 'kicker block mb-1';
const INPUT = 'w-full rounded-sm border border-edge bg-white px-3 py-2.5 text-sm text-ink-primary placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-edge-focus/30 focus:border-ink-primary transition';
const CARD  = 'rounded-lg border border-edge bg-white shadow-card overflow-hidden';
const CH    = 'flex items-center justify-between px-5 py-3.5 border-b border-edge-subtle bg-surface-muted';

/* ─── Pill chip ─── */
function Chip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-xs bg-surface-muted px-2.5 py-1 text-sm font-semibold text-ink-accent">
      {label}
      {onRemove && (
        <button type="button" onClick={onRemove} className="ml-0.5 hover:text-ink-danger transition">
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

/* ─── Rate type badge ─── */
function RateTypeBadge({ type }) {
  const t = RATE_TYPES.find(r => r.value === type) || RATE_TYPES[0];
  const Icon = t.icon;
  const colors = {
    FLAT: 'bg-blue-50 text-blue-700', WEIGHT: 'bg-amber-50 text-ink-accent',
    PRICE: 'bg-brand-success/10 text-ink-success', QTY: 'bg-surface-muted text-ink-accent',
    FREE: 'bg-brand-success/10 text-ink-success', CUSTOM: 'bg-surface-muted text-ink-secondary',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-xs px-2 py-0.5 text-[12px] font-semibold ${colors[type] || colors.FLAT}`}>
      <Icon className="h-3 w-3" />{t.label}
    </span>
  );
}

/* ════════════════════════════════════════════
   Rate Editor — rendered as a dedicated admin workspace
   ════════════════════════════════════════════ */
function RateEditorPage({ rate, zoneId, onSave, onClose }) {
  const [r, setR] = useState(rate || {
    zone: zoneId, name: '', method: 'Standard Shipping', rate_type: 'FLAT',
    price: '0.00', min_value: '', max_value: '',
    per_unit_price: '0.00', handling_fee: '0.00', free_above: '',
    surcharge_postcodes: '', surcharge_amount: '0.00', estimated_days: '',
    description: '', priority: 0, is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  // Rarely-used fields start collapsed, but open automatically when the rate
  // being edited already uses one of them so nothing is hidden.
  const [showAdvanced, setShowAdvanced] = useState(() => Boolean(
    rate && (Number(rate.handling_fee) > 0 || rate.surcharge_postcodes ||
      Number(rate.surcharge_amount) > 0 || Number(rate.priority) > 0 || rate.description)
  ));

  // Use currency from the rate object (populated by serializer) or fallback to ₹
  const currSym  = r.region_symbol  || '₹';
  const currCode = r.region_currency || 'INR';

  const minLabel = r.rate_type === 'WEIGHT'
    ? 'Min Weight (kg)'
    : r.rate_type === 'PRICE'
    ? `Min Order Value (${currCode})`
    : r.rate_type === 'QTY'
    ? 'Min Item Quantity'
    : `Min (${currCode})`;

  const maxLabel = r.rate_type === 'WEIGHT'
    ? 'Max Weight (kg)'
    : r.rate_type === 'PRICE'
    ? `Max Order Value (${currCode})`
    : r.rate_type === 'QTY'
    ? 'Max Item Quantity'
    : `Max (${currCode})`;

  const minPlaceholder = r.rate_type === 'WEIGHT' ? 'e.g. 0' : r.rate_type === 'QTY' ? 'e.g. 1' : '0';
  const maxPlaceholder = r.rate_type === 'WEIGHT' ? 'e.g. 5' : r.rate_type === 'QTY' ? 'e.g. 10' : 'No limit';

  const helpText = {
    FLAT:   'A fixed charge applies to every order in this zone regardless of weight or value.',
    WEIGHT: 'Enter the weight range in kilograms. Orders whose total weight falls in this range pay this rate.',
    PRICE:  'Enter the cart-value range in your region currency. Orders whose subtotal falls in this range pay this rate.',
    QTY:    'Enter the item-count range. Orders with that many items pay this rate.',
    FREE:   'No shipping charge is collected. Optionally restrict to a minimum order value below.',
    CUSTOM: 'Custom method — configure the rate manually. Use the description field for internal notes.',
  }[r.rate_type] || '';

  // Live plain-English preview so the admin always knows what customers will
  // be charged before saving.
  const summary = (() => {
    const price = `${currSym}${Number(r.price || 0).toFixed(2)}`;
    const range = (unit) => `${r.min_value || 0}–${r.max_value || 'any'}${unit}`;
    let base;
    if (r.rate_type === 'FREE') {
      base = r.min_value
        ? `Orders over ${currSym}${r.min_value} ship free in this zone.`
        : 'Every order in this zone ships free.';
    } else if (r.rate_type === 'WEIGHT') {
      base = `Orders weighing ${range(' kg')} pay ${price}`;
      if (Number(r.per_unit_price) > 0) base += ` plus ${currSym}${r.per_unit_price} per extra kg`;
      base += '.';
    } else if (r.rate_type === 'PRICE') {
      base = `Orders totalling ${currSym}${r.min_value || 0}–${r.max_value ? `${currSym}${r.max_value}` : 'any'} pay ${price}.`;
    } else if (r.rate_type === 'QTY') {
      base = `Orders with ${range(' items')} pay ${price}`;
      if (Number(r.per_unit_price) > 0) base += ` plus ${currSym}${r.per_unit_price} per extra item`;
      base += '.';
    } else {
      base = `Every order pays ${price}.`;
    }
    if (r.rate_type !== 'FREE' && r.free_above) base += ` Shipping is free above ${currSym}${r.free_above}.`;
    if (Number(r.handling_fee) > 0) base += ` A ${currSym}${r.handling_fee} handling fee is added.`;
    return base;
  })();

  const advancedCount = [
    r.rate_type !== 'FREE' && r.free_above,
    (r.rate_type === 'WEIGHT' || r.rate_type === 'QTY') && Number(r.per_unit_price) > 0,
    Number(r.handling_fee) > 0,
    r.surcharge_postcodes,
    Number(r.priority) > 0,
    r.description,
  ].filter(Boolean).length;

  const handle = async () => {
    if (!r.name.trim()) { setErr('Rate name is required.'); return; }
    setSaving(true); setErr('');
    try { await onSave(r); } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="admin-action-page flex flex-col items-center">
      <div className="w-full sm:max-w-xl bg-white rounded-t-lg sm:rounded-lg shadow-overlay border border-edge overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-muted">
              <Truck className="h-4 w-4 text-ink-accent" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-ink-primary">{r.id ? 'Edit Rate' : 'New Shipping Rate'}</h3>
              {r.zone_name && <p className="text-xs text-ink-muted">Zone: {r.zone_name}</p>}
            </div>
          </div>
          <button onClick={onClose} className="rounded-sm p-1.5 text-ink-subtle hover:bg-surface-muted transition"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {/* Name & method */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Rate Name *</label>
              <input value={r.name} onChange={e => setR({...r, name: e.target.value})} className={INPUT} placeholder="e.g. Standard Delivery" />
            </div>
            <div>
              <label className={LABEL}>Shipping Method</label>
              <select value={r.method || 'Standard Shipping'}
                onChange={e => setR({...r, method: e.target.value, name: r.name || e.target.value})}
                className={INPUT}>
                {SHIPPING_METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Rate type cards */}
          <div>
            <label className={LABEL}>Pricing Model</label>
            <div className="grid grid-cols-3 gap-2">
              {RATE_TYPES.map(t => {
                const Icon = t.icon;
                const active = r.rate_type === t.value;
                return (
                  <button key={t.value} type="button" onClick={() => setR({...r, rate_type: t.value})}
                    className={`flex flex-col items-start gap-1 rounded-md border p-2.5 text-left transition
                      ${active ? 'border-ink-primary bg-surface-muted ring-1 ring-ink-primary/20' : 'border-edge bg-white hover:border-edge-strong'}`}>
                    <Icon className={`h-4 w-4 ${active ? 'text-ink-accent' : 'text-ink-subtle'}`} />
                    <span className={`text-[13px] font-semibold leading-tight ${active ? 'text-ink-accent' : 'text-ink-secondary'}`}>{t.label}</span>
                    <span className={`text-[11px] leading-snug ${active ? 'text-ink-muted' : 'text-ink-subtle'}`}>{t.desc}</span>
                  </button>
                );
              })}
            </div>
            {helpText && (
              <p className="mt-2 text-[13px] text-ink-muted bg-surface-muted rounded-md px-3 py-2">
                💡 {helpText}
              </p>
            )}
          </div>

          {/* Core pricing — only the fields the chosen model actually needs */}
          {r.rate_type === 'FREE' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Minimum Order Value ({currSym}) <span className="normal-case font-normal text-ink-subtle">optional</span></label>
                <input type="number" step="0.01" min="0" value={r.min_value || ''} onChange={e => setR({...r, min_value: e.target.value})} className={INPUT} placeholder={`e.g. 500 — orders above ${currSym}500 ship free`} />
              </div>
              <div>
                <label className={LABEL}>Est. Delivery Time</label>
                <input value={r.estimated_days || ''} onChange={e => setR({...r, estimated_days: e.target.value})} className={INPUT} placeholder="e.g. 3–5 days" />
              </div>
            </div>
          ) : (
            <div className={`grid gap-3 ${['WEIGHT', 'PRICE', 'QTY'].includes(r.rate_type) ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
              <div>
                <label className={LABEL}>Price ({currSym})</label>
                <input type="number" step="0.01" min="0" value={r.price} onChange={e => setR({...r, price: e.target.value})} className={INPUT} placeholder="0.00" />
              </div>
              {['WEIGHT', 'PRICE', 'QTY'].includes(r.rate_type) && (
                <>
                  <div>
                    <label className={LABEL}>{minLabel}</label>
                    <input type="number" step={r.rate_type === 'QTY' ? '1' : '0.001'} min="0" value={r.min_value || ''} onChange={e => setR({...r, min_value: e.target.value})} className={INPUT} placeholder={minPlaceholder} />
                  </div>
                  <div>
                    <label className={LABEL}>{maxLabel}</label>
                    <input type="number" step={r.rate_type === 'QTY' ? '1' : '0.001'} min="0" value={r.max_value || ''} onChange={e => setR({...r, max_value: e.target.value || ''})} className={INPUT} placeholder={maxPlaceholder} />
                  </div>
                </>
              )}
              <div>
                <label className={LABEL}>Est. Delivery Time</label>
                <input value={r.estimated_days || ''} onChange={e => setR({...r, estimated_days: e.target.value})} className={INPUT} placeholder="e.g. 3–5 days" />
              </div>
            </div>
          )}

          {/* Plain-English preview of the rule being configured */}
          <div className="flex items-start gap-2 rounded-md border border-edge bg-surface-muted px-3 py-2.5">
            <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-success" />
            <p className="text-sm text-ink-secondary">{summary}</p>
          </div>

          {/* Everything else lives behind one toggle */}
          <button
            type="button"
            onClick={() => setShowAdvanced(v => !v)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-accent hover:text-ink-primary transition"
          >
            {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            More options{advancedCount > 0 ? ` (${advancedCount} in use)` : ''}
          </button>

          {showAdvanced && (
            <div className="space-y-4 rounded-md border border-edge-subtle bg-surface-subtle p-4">
              <div className="grid grid-cols-2 gap-3">
                {r.rate_type !== 'FREE' && (
                  <div>
                    <label className={LABEL}>Free Shipping Above ({currSym})</label>
                    <input type="number" step="0.01" min="0" value={r.free_above || ''} onChange={e => setR({...r, free_above: e.target.value})} className={INPUT} placeholder="e.g. 1000" />
                  </div>
                )}
                {(r.rate_type === 'WEIGHT' || r.rate_type === 'QTY') && (
                  <div>
                    <label className={LABEL}>Per {r.rate_type === 'WEIGHT' ? 'Additional kg' : 'Additional Item'} ({currSym})</label>
                    <input type="number" step="0.01" min="0" value={r.per_unit_price || ''} onChange={e => setR({...r, per_unit_price: e.target.value})} className={INPUT} placeholder="0.00" />
                  </div>
                )}
                <div>
                  <label className={LABEL}>Handling Fee ({currSym})</label>
                  <input type="number" step="0.01" min="0" value={r.handling_fee || ''} onChange={e => setR({...r, handling_fee: e.target.value})} className={INPUT} placeholder="0.00" />
                </div>
                <div>
                  <label className={LABEL}>Display Order at Checkout</label>
                  <input type="number" min="0" value={r.priority || 0} onChange={e => setR({...r, priority: Number(e.target.value)})} className={INPUT} />
                </div>
              </div>
              <div className="grid grid-cols-[1fr_9rem] gap-3">
                <div>
                  <label className={LABEL}>Remote/Surcharge Postcodes <span className="normal-case font-normal text-ink-subtle">comma-separated; * means prefix</span></label>
                  <input value={r.surcharge_postcodes || ''} onChange={e => setR({...r, surcharge_postcodes: e.target.value})} className={INPUT} placeholder="e.g. IV*, 400001" />
                </div>
                <div>
                  <label className={LABEL}>Surcharge ({currSym})</label>
                  <input type="number" step="0.01" min="0" value={r.surcharge_amount || ''} onChange={e => setR({...r, surcharge_amount: e.target.value})} className={INPUT} placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className={LABEL}>Internal Notes <span className="normal-case font-normal text-ink-subtle">optional, staff only</span></label>
                <textarea value={r.description || ''} onChange={e => setR({...r, description: e.target.value})} rows={2} className={INPUT + ' resize-none'} placeholder="Staff notes about this rate…" />
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm font-semibold text-ink-secondary cursor-pointer">
            <input type="checkbox" checked={r.is_active !== false} onChange={e => setR({...r, is_active: e.target.checked})} className="accent-ink-primary h-4 w-4" />
            Rate is active (shown to customers)
          </label>

          {err && (
            <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 text-ink-danger flex-shrink-0" />
              <p className="text-sm text-ink-danger font-medium">{err}</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-edge bg-white px-5 py-3.5 flex-shrink-0">
          <button onClick={handle} disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-ink-primary py-2.5 text-sm font-semibold text-white hover:bg-ink-primary/90 disabled:opacity-60 transition">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'Saving…' : r.id ? 'Update Rate' : 'Add Rate'}
          </button>
          <button onClick={onClose} className="rounded-md border border-edge px-5 py-2.5 text-sm font-semibold text-ink-secondary hover:bg-surface-muted transition">Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   Zone Editor Panel — full-screen slide-in
   ════════════════════════════════════════════ */
function ZoneEditorPanel({ zone, regions, onSave, onClose }) {
  const isNew = !zone?.id;
  const [z, setZ] = useState(() => ({
    name: '', region: regions[0]?.id ?? 1, is_active: true, priority: 0,
    description: '', countries: [], states: [], cities: [], postal_ranges: [],
    ...(zone && zone !== 'new' ? {
      ...zone,
      countries:     Array.isArray(zone.countries)     ? zone.countries     : (typeof zone.countries === 'string' ? zone.countries.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : []),
      states:        Array.isArray(zone.states)        ? zone.states        : [],
      cities:        Array.isArray(zone.cities)        ? zone.cities        : [],
      postal_ranges: Array.isArray(zone.postal_ranges) ? zone.postal_ranges : [],
    } : {}),
  }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [countryInput, setCountryInput] = useState('');
  const [stateInput, setStateInput]     = useState('');
  const [cityInput, setCityInput]       = useState('');
  const [postalStart, setPostalStart]   = useState('');
  const [postalEnd, setPostalEnd]       = useState('');
  // City/postcode targeting is a power feature; keep it out of the way unless
  // this zone already uses it.
  const [showFineTargeting, setShowFineTargeting] = useState(() => Boolean(
    (zone && zone !== 'new') && ((zone.cities || []).length || (zone.postal_ranges || []).length)
  ));
  const fileRef = useRef();

  // States/provinces offered depend on the countries on this zone, so the list
  // is never a mix of every country's regions.
  const stateOptions = useMemo(
    () =>
      (z.countries || []).flatMap((code) =>
        subdivisionsFor(code).map((name) => ({ name, country: code }))
      ),
    [z.countries]
  );

  const addChip = (field, value, setter) => {
    // Countries are stored as ISO codes; states and cities keep their real
    // capitalisation so they read as names, not shouting. (Zone matching in
    // the backend is case-insensitive either way.)
    const raw = value.trim();
    const v = field === 'countries' ? raw.toUpperCase() : raw;
    if (!v || z[field].some((existing) => String(existing).toLowerCase() === v.toLowerCase())) {
      setter('');
      return;
    }
    setZ(p => ({ ...p, [field]: [...p[field], v] }));
    setter('');
  };
  const removeChip = (field, idx) => setZ(p => ({ ...p, [field]: p[field].filter((_, i) => i !== idx) }));

  const addPostal = () => {
    const s = postalStart.trim().toUpperCase();
    if (!s) return;
    const range = { start: s, end: postalEnd.trim().toUpperCase() || s };
    setZ(p => ({ ...p, postal_ranges: [...p.postal_ranges, range] }));
    setPostalStart(''); setPostalEnd('');
  };
  const removePostal = (i) => setZ(p => ({ ...p, postal_ranges: p.postal_ranges.filter((_, x) => x !== i) }));

  const handleCSV = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const codes = ev.target.result.split(/[\n,;]+/).map(s => s.trim().toUpperCase()).filter(s => s.length >= 2);
      setZ(p => ({ ...p, countries: [...new Set([...p.countries, ...codes])] }));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handle = async () => {
    if (!z.name.trim()) { setErr('Zone name is required.'); return; }
    setSaving(true); setErr('');
    try { await onSave(z); } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-y-0 right-0 left-0 md:left-[280px] lg:left-[288px] top-0 md:top-[65px] z-30 bg-surface-muted overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-edge bg-white px-4 py-3 sm:px-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="rounded-sm border border-edge p-2 text-ink-muted hover:bg-surface-muted transition">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-sm font-semibold uppercase text-ink-subtle tracking-wide">Shipping</p>
            <h2 className="text-base font-semibold text-ink-primary">{isNew ? 'New Shipping Zone' : `Edit: ${zone.name}`}</h2>
          </div>
        </div>
        <button onClick={handle} disabled={saving}
          className="inline-flex items-center gap-2 rounded-md bg-ink-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink-primary/90 disabled:opacity-60 transition">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving…' : 'Save Zone'}
        </button>
      </div>

      {err && (
        <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-6 py-2.5 flex-shrink-0">
          <AlertCircle className="h-4 w-4 text-ink-danger flex-shrink-0" />
          <p className="text-sm text-ink-danger font-medium">{err}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 space-y-5">

          {/* Basic info */}
          <div className={CARD}>
            <div className={CH}><p className="text-sm font-semibold uppercase text-ink-muted tracking-wide">Zone Details</p></div>
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Zone Name *</label>
                  <input value={z.name} onChange={e => setZ({...z, name: e.target.value})} className={INPUT} placeholder="e.g. UK Mainland" />
                </div>
                <div>
                  <label className={LABEL}>Market</label>
                  <select value={z.region} onChange={e => setZ({...z, region: Number(e.target.value)})} className={INPUT}>
                    {regions.length > 0
                      ? regions.map(r => <option key={r.id} value={r.id}>{r.code} – {r.name}</option>)
                      : <option value={1}>Default</option>}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-[1fr_9rem] gap-3">
                <div>
                  <label className={LABEL}>Description <span className="normal-case font-normal text-ink-subtle">optional</span></label>
                  <input value={z.description || ''} onChange={e => setZ({...z, description: e.target.value})} className={INPUT} placeholder="Staff-facing notes about this zone…" />
                </div>
                <div>
                  <label className={LABEL}>Priority</label>
                  <input type="number" min="0" value={z.priority || 0} onChange={e => setZ({...z, priority: Number(e.target.value)})} className={INPUT} />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-ink-secondary cursor-pointer select-none">
                <input type="checkbox" checked={z.is_active} onChange={e => setZ({...z, is_active: e.target.checked})} className="accent-ink-primary h-4 w-4" />
                Zone is active
              </label>
            </div>
          </div>

          {/* Countries */}
          <div className={CARD}>
            <div className={CH}>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-ink-subtle" />
                <p className="text-sm font-semibold uppercase text-ink-muted tracking-wide">Countries</p>
                <span className="text-[12px] normal-case font-normal text-ink-subtle">(ISO-2 codes)</span>
              </div>
              <label className="inline-flex items-center gap-1.5 rounded-sm border border-edge bg-white px-3 py-1.5 text-sm font-semibold text-ink-secondary hover:bg-surface-muted cursor-pointer transition">
                <Upload className="h-3.5 w-3.5" /> Import CSV
                <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleCSV} className="hidden" />
              </label>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex gap-2">
                <input
                  list="country-suggestions"
                  value={countryInput}
                  onChange={(e) => {
                    // Accept either a picked name or a typed code.
                    const raw = e.target.value;
                    const match = COUNTRIES.find(
                      (c) => c.name.toLowerCase() === raw.toLowerCase() || c.code === raw.toUpperCase()
                    );
                    setCountryInput(match ? match.code : raw);
                  }}
                  onKeyDown={e => e.key === 'Enter' && addChip('countries', countryInput, setCountryInput)}
                  className={INPUT}
                  placeholder="Search a country, e.g. United Kingdom"
                />
                <datalist id="country-suggestions">
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.name}>{c.code}</option>
                  ))}
                </datalist>
                <button type="button" onClick={() => addChip('countries', countryInput, setCountryInput)}
                  className="btn-primary px-4 text-sm flex-shrink-0">Add</button>
              </div>
              {z.countries.length > 0
                ? <div className="flex flex-wrap gap-1.5">{z.countries.map((c, i) => <Chip key={i} label={countryName(c)} onRemove={() => removeChip('countries', i)} />)}</div>
                : <p className="text-sm text-ink-subtle italic">No countries added — leave empty to match all countries (global fallback zone).</p>}
            </div>
          </div>

          {/* States / Provinces */}
          <div className={CARD}>
            <div className={CH}>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-ink-subtle" />
                <p className="text-sm font-semibold uppercase text-ink-muted tracking-wide">States / Provinces</p>
                <span className="text-[12px] normal-case font-normal text-ink-subtle">optional</span>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex gap-2">
                <input
                  list="state-suggestions"
                  value={stateInput}
                  onChange={e => setStateInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addChip('states', stateInput, setStateInput)}
                  className={INPUT}
                  placeholder={
                    z.countries.length === 0
                      ? 'Add a country first to see its states/provinces'
                      : `Search a state/province in ${z.countries.map(countryName).join(', ')}`
                  }
                  disabled={z.countries.length === 0}
                />
                {/* Options are limited to the countries on this zone, so an
                    admin can never pick a state that isn't in it. */}
                <datalist id="state-suggestions">
                  {stateOptions.map(({ name, country }) => (
                    <option key={`${country}-${name}`} value={name}>{countryName(country)}</option>
                  ))}
                </datalist>
                <button type="button" onClick={() => addChip('states', stateInput, setStateInput)}
                  disabled={z.countries.length === 0}
                  className="btn-primary px-4 text-sm flex-shrink-0 disabled:opacity-50">Add</button>
              </div>
              {z.countries.length > 0 && stateOptions.length === 0 && (
                <p className="text-sm text-ink-subtle italic">
                  {z.countries.map(countryName).join(', ')} has no states or provinces listed — the
                  whole country is covered by this zone.
                </p>
              )}
              {z.states.length > 0 && <div className="flex flex-wrap gap-1.5">{z.states.map((s, i) => <Chip key={i} label={s} onRemove={() => removeChip('states', i)} />)}</div>}
            </div>
          </div>

          {/* Fine-grained targeting — cities and postcodes are rarely needed,
              so they stay behind one toggle to keep the common path short. */}
          <button
            type="button"
            onClick={() => setShowFineTargeting(v => !v)}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-accent hover:text-ink-primary transition"
          >
            {showFineTargeting ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Fine-grained targeting — specific cities or postcodes
            {!showFineTargeting && ((z.cities || []).length || (z.postal_ranges || []).length) ? ` (${(z.cities || []).length + (z.postal_ranges || []).length} in use)` : ''}
          </button>

          {/* Cities */}
          {showFineTargeting && (<>
          <div className={CARD}>
            <div className={CH}>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-ink-subtle" />
                <p className="text-sm font-semibold uppercase text-ink-muted tracking-wide">Cities</p>
                <span className="text-[12px] normal-case font-normal text-ink-subtle">optional</span>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex gap-2">
                <input value={cityInput} onChange={e => setCityInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addChip('cities', cityInput, setCityInput)}
                  className={INPUT} placeholder="City name, e.g. London, Mumbai, Manchester" />
                <button type="button" onClick={() => addChip('cities', cityInput, setCityInput)}
                  className="btn-primary px-4 text-sm flex-shrink-0">Add</button>
              </div>
              {z.cities.length > 0 && <div className="flex flex-wrap gap-1.5">{z.cities.map((c, i) => <Chip key={i} label={c} onRemove={() => removeChip('cities', i)} />)}</div>}
            </div>
          </div>

          {/* Postal / PIN code ranges */}
          <div className={CARD}>
            <div className={CH}>
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-ink-subtle" />
                <p className="text-sm font-semibold uppercase text-ink-muted tracking-wide">PIN / Postal Code Ranges</p>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-end">
                <div>
                  <label className={LABEL}>Start Code</label>
                  <input value={postalStart} onChange={e => setPostalStart(e.target.value.toUpperCase())} className={INPUT} placeholder="e.g. SW1A" />
                </div>
                <div className="flex items-center justify-center pb-2.5 text-ink-subtle font-semibold">→</div>
                <div>
                  <label className={LABEL}>End Code <span className="font-normal text-ink-subtle">(or same)</span></label>
                  <input value={postalEnd} onChange={e => setPostalEnd(e.target.value.toUpperCase())} className={INPUT} placeholder="e.g. SW1Z" />
                </div>
                <button type="button" onClick={addPostal}
                  className="btn-primary px-4 py-2.5 text-sm flex-shrink-0">Add</button>
              </div>
              {z.postal_ranges.length > 0 && (
                <div className="space-y-1.5">
                  {z.postal_ranges.map((pr, i) => (
                    <div key={i} className="flex items-center justify-between rounded-sm border border-edge bg-surface-muted px-3 py-2">
                      <span className="text-sm font-mono font-semibold text-ink-secondary">
                        {pr.start}{pr.end && pr.end !== pr.start ? ` → ${pr.end}` : ''}
                      </span>
                      <button type="button" onClick={() => removePostal(i)} className="text-ink-subtle hover:text-ink-danger transition">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[13px] text-ink-subtle">Use the same start and end for one postcode or prefix; use two values for an inclusive range.</p>
            </div>
          </div>
          </>)}

        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   Main exported component
   Props: zones, rates, regions, editingZone, editingRate,
          onAddZone, onEditZone, onCloseZone,
          onEditRate, onCloseRate,
          onSaveZone, onDeleteZone, onDuplicateZone,
          onSaveRate, onDeleteRate
   ════════════════════════════════════════════ */
export default function ShippingZonePanel({
  zones = [], rates = [], regions = [],
  editingZone, editingRate,
  onAddZone, onEditZone, onCloseZone,
  onEditRate, onCloseRate,
  onSaveZone, onDeleteZone, onDuplicateZone,
  onSaveRate, onDeleteRate,
}) {
  const [expanded, setExpanded] = useState({});
  const toggle = (id) => setExpanded(p => ({ ...p, [id]: !p[id] }));
  const zoneRates = (zoneId) => rates.filter(r => r.zone === zoneId);
  const regionFor = (z) => regions.find(r => r.id === z.region) || {};

  // A newly created zone has no rates. Keep it open automatically so the
  // next required step is immediately visible instead of hidden in a row.
  useEffect(() => {
    setExpanded((previous) => {
      const next = { ...previous };
      zones.forEach((zone) => {
        if (zoneRates(zone.id).length === 0 && next[zone.id] === undefined) next[zone.id] = true;
      });
      return next;
    });
  }, [zones, rates]);

  const openNewRate = (zone) => {
    const reg = regionFor(zone);
    setExpanded((previous) => ({ ...previous, [zone.id]: true }));
    onEditRate({
      zone: zone.id,
      zone_name: zone.name,
      name: '', method: 'Standard Shipping', rate_type: 'FLAT',
      price: '0.00', min_value: '', max_value: '',
      per_unit_price: '0.00', handling_fee: '0.00',
      free_above: '', surcharge_postcodes: '', surcharge_amount: '0.00',
      estimated_days: '', description: '', priority: 0, is_active: true,
      region_symbol: reg.currency_symbol || reg.currency_code || '',
      region_currency: reg.currency_code || 'INR',
    });
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-ink-primary">
            {zones.length} shipping zone{zones.length !== 1 ? 's' : ''} configured
          </p>
          <p className="text-sm text-ink-muted">Zones are evaluated top-to-bottom. First matching zone applies.</p>
        </div>
        <button onClick={onAddZone}
          className="inline-flex items-center gap-2 rounded-md bg-ink-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink-primary/90 transition shadow-card">
          <Plus className="h-4 w-4" /> Add Zone
        </button>
      </div>

      {/* Empty state */}
      {zones.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-edge py-16">
          <Globe className="h-10 w-10 text-ink-subtle" />
          <p className="text-sm font-semibold text-ink-muted">No shipping zones yet</p>
          <p className="text-sm text-ink-subtle">Create a zone to define where and how you ship.</p>
          <button onClick={onAddZone}
            className="mt-1 inline-flex items-center gap-2 rounded-md bg-ink-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink-primary/90 transition">
            <Plus className="h-4 w-4" /> Create First Zone
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {zones.map(z => {
            const zRates   = zoneRates(z.id);
            const isOpen   = expanded[z.id];
            const countries    = Array.isArray(z.countries)     ? z.countries     : [];
            const states       = Array.isArray(z.states)        ? z.states        : [];
            const cities       = Array.isArray(z.cities)        ? z.cities        : [];
            const postalRanges = Array.isArray(z.postal_ranges) ? z.postal_ranges : [];

            return (
              <div key={z.id} className="rounded-lg border border-edge bg-white overflow-hidden shadow-card">
                {/* Zone row */}
                <div className="flex items-center gap-3 px-5 py-4">
                  <button onClick={() => toggle(z.id)} className="flex-shrink-0 text-ink-subtle hover:text-ink-secondary transition">
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggle(z.id)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-ink-primary">{z.name}</h3>
                      <span className={`rounded-xs px-2 py-0.5 text-[13px] font-semibold ${z.is_active ? 'bg-brand-success/10 text-ink-success' : 'bg-surface-muted text-ink-muted'}`}>
                        {z.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                      {z.region_code && <span className="rounded-xs bg-surface-muted px-2 py-0.5 text-[13px] font-semibold text-ink-accent">{z.region_code}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-ink-muted">
                      {countries.length > 0 && <span><Globe className="inline h-3 w-3 mr-0.5" />{countries.slice(0,4).join(', ')}{countries.length > 4 ? ` +${countries.length-4}` : ''}</span>}
                      {states.length > 0 && <span><MapPin className="inline h-3 w-3 mr-0.5" />{states.length} state{states.length !== 1 ? 's' : ''}</span>}
                      {postalRanges.length > 0 && <span><Tag className="inline h-3 w-3 mr-0.5" />{postalRanges.length} postal range{postalRanges.length !== 1 ? 's' : ''}</span>}
                      <span><Truck className="inline h-3 w-3 mr-0.5" />{zRates.length} rate{zRates.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => openNewRate(z)}
                      className="mr-1 inline-flex items-center gap-1.5 rounded-sm border border-ink-primary bg-ink-primary px-3 py-2 text-sm font-semibold text-white hover:bg-ink-primary/90 transition"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Rate
                    </button>
                    <button onClick={() => onEditZone(z)} title="Edit zone" className="rounded-sm p-2 text-ink-subtle hover:text-ink-accent hover:bg-surface-muted transition"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => onDuplicateZone(z)} title="Clone zone" className="rounded-sm p-2 text-ink-subtle hover:text-ink-accent hover:bg-surface-muted transition"><Copy className="h-4 w-4" /></button>
                    <button onClick={() => onDeleteZone(z)} title="Delete zone" className="rounded-sm p-2 text-ink-subtle hover:text-ink-danger hover:bg-red-50 transition"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>

                {/* Expanded section */}
                {isOpen && (
                  <div className="border-t border-edge-subtle">
                    {/* Coverage chips */}
                    {(countries.length > 0 || states.length > 0 || cities.length > 0 || postalRanges.length > 0) && (
                      <div className="bg-surface-muted px-5 py-3 space-y-2 border-b border-edge-subtle">
                        {countries.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[12px] font-semibold uppercase text-ink-subtle mr-1">Countries:</span>
                            {countries.map((c, i) => <Chip key={i} label={c} />)}
                          </div>
                        )}
                        {states.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[12px] font-semibold uppercase text-ink-subtle mr-1">States:</span>
                            {states.map((s, i) => <Chip key={i} label={s} />)}
                          </div>
                        )}
                        {cities.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[12px] font-semibold uppercase text-ink-subtle mr-1">Cities:</span>
                            {cities.map((c, i) => <Chip key={i} label={c} />)}
                          </div>
                        )}
                        {postalRanges.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[12px] font-semibold uppercase text-ink-subtle mr-1">Postcodes:</span>
                            {postalRanges.map((pr, i) => (
                              <Chip key={i} label={pr.start === pr.end ? pr.start : `${pr.start}–${pr.end}`} />
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Rates */}
                    <div className="px-5 py-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold uppercase text-ink-muted tracking-wide">Shipping Rates &amp; Methods</p>
                        <button
                          onClick={() => openNewRate(z)}
                          className="inline-flex items-center gap-1 rounded-sm bg-surface-muted border border-edge px-3 py-1.5 text-sm font-semibold text-ink-accent hover:bg-surface-muted transition">
                          <Plus className="h-3.5 w-3.5" /> Add Rate
                        </button>
                      </div>

                      {zRates.length > 0 ? (
                        <div className="space-y-2">
                          {zRates.map(rate => (
                            <div key={rate.id} className="flex items-center gap-3 rounded-md border border-edge bg-white px-4 py-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-semibold text-ink-primary">{rate.name}</p>
                                  <RateTypeBadge type={rate.rate_type} />
                                  {rate.is_active === false && <span className="rounded-xs bg-surface-muted px-2 py-0.5 text-[13px] font-semibold text-ink-muted">INACTIVE</span>}
                                </div>
                                <div className="mt-0.5 flex items-center gap-3 text-[13px] text-ink-muted flex-wrap">
                                  {rate.rate_type !== 'FREE' && <span className="font-semibold text-ink-secondary">{rate.region_symbol || rate.region_currency}{Number(rate.price || 0).toFixed(2)}</span>}
                                  {rate.rate_type === 'FREE' && <span className="font-semibold text-ink-success">Free Shipping</span>}
                                  {rate.rate_type === 'WEIGHT' && Number(rate.min_value) >= 0 && <span>{rate.min_value || 0}–{rate.max_value || '∞'} kg</span>}
                                  {rate.rate_type === 'PRICE' && <span>Cart {rate.region_symbol || rate.region_currency}{rate.min_value || 0}–{rate.max_value ? `${rate.region_symbol || rate.region_currency}${rate.max_value}` : '∞'}</span>}
                                  {rate.rate_type === 'QTY' && <span>Qty {rate.min_value || 0}–{rate.max_value || '∞'} items</span>}
                                  {(rate.rate_type === 'FLAT' || rate.rate_type === 'CUSTOM') && Number(rate.min_value) > 0 && <span>Min: {rate.region_symbol || rate.region_currency}{rate.min_value}</span>}
                                  {rate.free_above && <span className="text-ink-success">Free above {rate.region_symbol || rate.region_currency}{rate.free_above}</span>}
                                  {rate.estimated_days && <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{rate.estimated_days}</span>}
                                  {rate.surcharge_postcodes && <span className="text-ink-accent flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" />Surcharge zones</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button onClick={() => onEditRate({...rate})} className="rounded-sm p-1.5 text-ink-subtle hover:text-ink-accent hover:bg-surface-muted transition"><Pencil className="h-3.5 w-3.5" /></button>
                                <button onClick={() => onDeleteRate(rate)} className="rounded-sm p-1.5 text-ink-subtle hover:text-ink-danger hover:bg-red-50 transition"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3 rounded-md border border-dashed border-edge bg-surface-muted px-4 py-4">
                          <Truck className="h-5 w-5 text-ink-subtle flex-shrink-0" />
                          <p className="min-w-0 flex-1 text-sm text-ink-subtle">No rates yet. Add a delivery method so customers can check out in this zone.</p>
                          <button type="button" onClick={() => openNewRate(z)} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm">
                            <Plus className="h-3.5 w-3.5" /> Add First Rate
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Zone Editor (full-screen panel) */}
      {editingZone && (
        <ZoneEditorPanel
          zone={editingZone === 'new' ? null : editingZone}
          regions={regions}
          onSave={onSaveZone}
          onClose={onCloseZone}
        />
      )}

      {/* Rate editor workspace */}
      {editingRate && (
        <RateEditorPage
          rate={editingRate}
          zoneId={editingRate.zone}
          onSave={onSaveRate}
          onClose={onCloseRate}
        />
      )}
    </div>
  );
}
