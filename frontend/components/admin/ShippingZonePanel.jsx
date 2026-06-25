'use client';

import React, { useState, useRef } from 'react';
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

const LABEL = 'block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1';
const INPUT = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition';
const CARD  = 'rounded-2xl border border-slate-200 bg-white overflow-hidden';
const CH    = 'flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/60';

/* ─── Pill chip ─── */
function Chip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-semibold text-violet-700">
      {label}
      {onRemove && (
        <button type="button" onClick={onRemove} className="ml-0.5 hover:text-red-500 transition">
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
    FLAT: 'bg-blue-50 text-blue-700', WEIGHT: 'bg-amber-50 text-amber-700',
    PRICE: 'bg-green-50 text-green-700', QTY: 'bg-purple-50 text-purple-700',
    FREE: 'bg-emerald-50 text-emerald-700', CUSTOM: 'bg-slate-100 text-slate-600',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${colors[type] || colors.FLAT}`}>
      <Icon className="h-3 w-3" />{t.label}
    </span>
  );
}

/* ════════════════════════════════════════════
   Rate Editor — rendered as bottom-sheet modal
   ════════════════════════════════════════════ */
function RateEditorModal({ rate, zoneId, onSave, onClose }) {
  const [r, setR] = useState(rate || {
    zone: zoneId, name: '', method: 'Standard Shipping', rate_type: 'FLAT',
    price: '0.00', min_value: '0.00', max_value: '',
    free_above: '', surcharge_postcodes: '', estimated_days: '',
    description: '', is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const handle = async () => {
    if (!r.name.trim()) { setErr('Rate name is required.'); return; }
    setSaving(true); setErr('');
    try { await onSave(r); } catch (e) { setErr(e.message); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-xl bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100">
              <Truck className="h-4 w-4 text-violet-600" />
            </div>
            <h3 className="text-base font-black text-slate-800">{r.id ? 'Edit Rate' : 'New Shipping Rate'}</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition"><X className="h-4 w-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {/* Name & method */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Rate Name *</label>
              <input value={r.name} onChange={e => setR({...r, name: e.target.value})} className={INPUT} placeholder="e.g. Standard UK" />
            </div>
            <div>
              <label className={LABEL}>Method</label>
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
                    className={`flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition
                      ${active ? 'border-violet-500 bg-violet-50' : 'border-slate-200 bg-white hover:border-violet-300'}`}>
                    <Icon className={`h-4 w-4 ${active ? 'text-violet-600' : 'text-slate-400'}`} />
                    <span className={`text-[11px] font-bold ${active ? 'text-violet-700' : 'text-slate-600'}`}>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Price grid — hide for FREE */}
          {r.rate_type !== 'FREE' && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={LABEL}>Base Price (£)</label>
                <input type="number" step="0.01" min="0" value={r.price} onChange={e => setR({...r, price: e.target.value})} className={INPUT} placeholder="0.00" />
              </div>
              <div>
                <label className={LABEL}>{r.rate_type === 'WEIGHT' ? 'Min kg' : r.rate_type === 'PRICE' ? 'Min £' : r.rate_type === 'QTY' ? 'Min qty' : 'Min'}</label>
                <input type="number" step="0.01" min="0" value={r.min_value} onChange={e => setR({...r, min_value: e.target.value})} className={INPUT} placeholder="0" />
              </div>
              <div>
                <label className={LABEL}>{r.rate_type === 'WEIGHT' ? 'Max kg' : r.rate_type === 'PRICE' ? 'Max £' : r.rate_type === 'QTY' ? 'Max qty' : 'Max'}</label>
                <input type="number" step="0.01" min="0" value={r.max_value || ''} onChange={e => setR({...r, max_value: e.target.value || ''})} className={INPUT} placeholder="No limit" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Free Shipping Above (£) <span className="normal-case font-normal text-slate-400">optional</span></label>
              <input type="number" step="0.01" min="0" value={r.free_above || ''} onChange={e => setR({...r, free_above: e.target.value})} className={INPUT} placeholder="e.g. 50.00" />
            </div>
            <div>
              <label className={LABEL}>Est. Delivery (days)</label>
              <input value={r.estimated_days || ''} onChange={e => setR({...r, estimated_days: e.target.value})} className={INPUT} placeholder="e.g. 3–5" />
            </div>
          </div>

          <div>
            <label className={LABEL}>Remote/Surcharge Postcodes <span className="normal-case font-normal text-slate-400">comma-separated</span></label>
            <input value={r.surcharge_postcodes || ''} onChange={e => setR({...r, surcharge_postcodes: e.target.value})} className={INPUT} placeholder="e.g. AB10, IV1, KW1" />
          </div>

          <div>
            <label className={LABEL}>Internal Description</label>
            <textarea value={r.description || ''} onChange={e => setR({...r, description: e.target.value})} rows={2} className={INPUT + ' resize-none'} placeholder="Staff notes…" />
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
            <input type="checkbox" checked={r.is_active !== false} onChange={e => setR({...r, is_active: e.target.checked})} className="accent-violet-600 h-4 w-4" />
            Rate is active
          </label>

          {err && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2.5">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <p className="text-xs text-red-700 font-medium">{err}</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-slate-200 bg-white px-5 py-3.5 flex-shrink-0">
          <button onClick={handle} disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60 transition">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'Saving…' : r.id ? 'Update Rate' : 'Add Rate'}
          </button>
          <button onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition">Cancel</button>
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
    name: '', region: regions[0]?.id ?? 1, is_active: true,
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
  const fileRef = useRef();

  const addChip = (field, value, setter) => {
    const v = value.trim().toUpperCase();
    if (!v || z[field].includes(v)) { setter(''); return; }
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
    <div className="fixed inset-y-0 right-0 left-0 md:left-[280px] lg:left-[288px] top-0 md:top-[65px] z-30 bg-slate-50 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 transition">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400 tracking-wide">Shipping</p>
            <h2 className="text-base font-black text-slate-800">{isNew ? 'New Shipping Zone' : `Edit: ${zone.name}`}</h2>
          </div>
        </div>
        <button onClick={handle} disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60 transition">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving…' : 'Save Zone'}
        </button>
      </div>

      {err && (
        <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-6 py-2.5 flex-shrink-0">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
          <p className="text-xs text-red-700 font-medium">{err}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 space-y-5">

          {/* Basic info */}
          <div className={CARD}>
            <div className={CH}><p className="text-xs font-bold uppercase text-slate-500 tracking-wide">Zone Details</p></div>
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Zone Name *</label>
                  <input value={z.name} onChange={e => setZ({...z, name: e.target.value})} className={INPUT} placeholder="e.g. UK Mainland" />
                </div>
                <div>
                  <label className={LABEL}>Region Routing</label>
                  <select value={z.region} onChange={e => setZ({...z, region: Number(e.target.value)})} className={INPUT}>
                    {regions.length > 0
                      ? regions.map(r => <option key={r.id} value={r.id}>{r.code} – {r.name}</option>)
                      : <option value={1}>Default</option>}
                  </select>
                </div>
              </div>
              <div>
                <label className={LABEL}>Description <span className="normal-case font-normal text-slate-400">optional</span></label>
                <input value={z.description || ''} onChange={e => setZ({...z, description: e.target.value})} className={INPUT} placeholder="Staff-facing notes about this zone…" />
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer select-none">
                <input type="checkbox" checked={z.is_active} onChange={e => setZ({...z, is_active: e.target.checked})} className="accent-violet-600 h-4 w-4" />
                Zone is active
              </label>
            </div>
          </div>

          {/* Countries */}
          <div className={CARD}>
            <div className={CH}>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-slate-400" />
                <p className="text-xs font-bold uppercase text-slate-500 tracking-wide">Countries</p>
                <span className="text-[10px] normal-case font-normal text-slate-400">(ISO-2 codes)</span>
              </div>
              <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer transition">
                <Upload className="h-3.5 w-3.5" /> Import CSV
                <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleCSV} className="hidden" />
              </label>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex gap-2">
                <input value={countryInput} onChange={e => setCountryInput(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && addChip('countries', countryInput, setCountryInput)}
                  className={INPUT} placeholder="ISO code e.g. GB, IN, US — Enter to add" maxLength={2} />
                <button type="button" onClick={() => addChip('countries', countryInput, setCountryInput)}
                  className="rounded-lg bg-violet-600 px-4 text-white text-sm font-bold hover:bg-violet-700 transition flex-shrink-0">Add</button>
              </div>
              {z.countries.length > 0
                ? <div className="flex flex-wrap gap-1.5">{z.countries.map((c, i) => <Chip key={i} label={c} onRemove={() => removeChip('countries', i)} />)}</div>
                : <p className="text-xs text-slate-400 italic">No countries added — leave empty to match all countries (global fallback zone).</p>}
            </div>
          </div>

          {/* States / Provinces */}
          <div className={CARD}>
            <div className={CH}>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-400" />
                <p className="text-xs font-bold uppercase text-slate-500 tracking-wide">States / Provinces</p>
                <span className="text-[10px] normal-case font-normal text-slate-400">optional</span>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex gap-2">
                <input value={stateInput} onChange={e => setStateInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addChip('states', stateInput, setStateInput)}
                  className={INPUT} placeholder="State/province name or code, e.g. England, Maharashtra, CA" />
                <button type="button" onClick={() => addChip('states', stateInput, setStateInput)}
                  className="rounded-lg bg-violet-600 px-4 text-white text-sm font-bold hover:bg-violet-700 transition flex-shrink-0">Add</button>
              </div>
              {z.states.length > 0 && <div className="flex flex-wrap gap-1.5">{z.states.map((s, i) => <Chip key={i} label={s} onRemove={() => removeChip('states', i)} />)}</div>}
            </div>
          </div>

          {/* Cities */}
          <div className={CARD}>
            <div className={CH}>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-slate-400" />
                <p className="text-xs font-bold uppercase text-slate-500 tracking-wide">Cities</p>
                <span className="text-[10px] normal-case font-normal text-slate-400">optional</span>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex gap-2">
                <input value={cityInput} onChange={e => setCityInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addChip('cities', cityInput, setCityInput)}
                  className={INPUT} placeholder="City name, e.g. London, Mumbai, Manchester" />
                <button type="button" onClick={() => addChip('cities', cityInput, setCityInput)}
                  className="rounded-lg bg-violet-600 px-4 text-white text-sm font-bold hover:bg-violet-700 transition flex-shrink-0">Add</button>
              </div>
              {z.cities.length > 0 && <div className="flex flex-wrap gap-1.5">{z.cities.map((c, i) => <Chip key={i} label={c} onRemove={() => removeChip('cities', i)} />)}</div>}
            </div>
          </div>

          {/* Postal / PIN code ranges */}
          <div className={CARD}>
            <div className={CH}>
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-slate-400" />
                <p className="text-xs font-bold uppercase text-slate-500 tracking-wide">PIN / Postal Code Ranges</p>
              </div>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-2 items-end">
                <div>
                  <label className={LABEL}>Start Code</label>
                  <input value={postalStart} onChange={e => setPostalStart(e.target.value.toUpperCase())} className={INPUT} placeholder="e.g. SW1A" />
                </div>
                <div className="flex items-center justify-center pb-2.5 text-slate-400 font-bold">→</div>
                <div>
                  <label className={LABEL}>End Code <span className="font-normal text-slate-400">(or same)</span></label>
                  <input value={postalEnd} onChange={e => setPostalEnd(e.target.value.toUpperCase())} className={INPUT} placeholder="e.g. SW1Z" />
                </div>
                <button type="button" onClick={addPostal}
                  className="rounded-lg bg-violet-600 px-4 py-2.5 text-white text-sm font-bold hover:bg-violet-700 transition flex-shrink-0">Add</button>
              </div>
              {z.postal_ranges.length > 0 && (
                <div className="space-y-1.5">
                  {z.postal_ranges.map((pr, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <span className="text-xs font-mono font-semibold text-slate-700">
                        {pr.start}{pr.end && pr.end !== pr.start ? ` → ${pr.end}` : ''}
                      </span>
                      <button type="button" onClick={() => removePostal(i)} className="text-slate-400 hover:text-red-500 transition">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-[11px] text-slate-400">💡 Bulk import postcode lists via CSV using the Countries import button above.</p>
            </div>
          </div>

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

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-slate-800">
            {zones.length} shipping zone{zones.length !== 1 ? 's' : ''} configured
          </p>
          <p className="text-xs text-slate-500">Zones are evaluated top-to-bottom. First matching zone applies.</p>
        </div>
        <button onClick={onAddZone}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700 transition shadow-sm">
          <Plus className="h-4 w-4" /> Add Zone
        </button>
      </div>

      {/* Empty state */}
      {zones.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 py-16">
          <Globe className="h-10 w-10 text-slate-300" />
          <p className="text-sm font-semibold text-slate-500">No shipping zones yet</p>
          <p className="text-xs text-slate-400">Create a zone to define where and how you ship.</p>
          <button onClick={onAddZone}
            className="mt-1 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700 transition">
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
              <div key={z.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                {/* Zone row */}
                <div className="flex items-center gap-3 px-5 py-4">
                  <button onClick={() => toggle(z.id)} className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition">
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggle(z.id)}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-black text-slate-800">{z.name}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${z.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {z.is_active ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                      {z.region_code && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[9px] font-bold text-violet-700">{z.region_code}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                      {countries.length > 0 && <span><Globe className="inline h-3 w-3 mr-0.5" />{countries.slice(0,4).join(', ')}{countries.length > 4 ? ` +${countries.length-4}` : ''}</span>}
                      {states.length > 0 && <span><MapPin className="inline h-3 w-3 mr-0.5" />{states.length} state{states.length !== 1 ? 's' : ''}</span>}
                      {postalRanges.length > 0 && <span><Tag className="inline h-3 w-3 mr-0.5" />{postalRanges.length} postal range{postalRanges.length !== 1 ? 's' : ''}</span>}
                      <span><Truck className="inline h-3 w-3 mr-0.5" />{zRates.length} rate{zRates.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => onEditZone(z)} title="Edit zone" className="rounded-lg p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => onDuplicateZone(z)} title="Clone zone" className="rounded-lg p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition"><Copy className="h-4 w-4" /></button>
                    <button onClick={() => onDeleteZone(z)} title="Delete zone" className="rounded-lg p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 transition"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>

                {/* Expanded section */}
                {isOpen && (
                  <div className="border-t border-slate-100">
                    {/* Coverage chips */}
                    {(countries.length > 0 || states.length > 0 || cities.length > 0 || postalRanges.length > 0) && (
                      <div className="bg-slate-50/60 px-5 py-3 space-y-2 border-b border-slate-100">
                        {countries.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase text-slate-400 mr-1">Countries:</span>
                            {countries.map((c, i) => <Chip key={i} label={c} />)}
                          </div>
                        )}
                        {states.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase text-slate-400 mr-1">States:</span>
                            {states.map((s, i) => <Chip key={i} label={s} />)}
                          </div>
                        )}
                        {cities.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase text-slate-400 mr-1">Cities:</span>
                            {cities.map((c, i) => <Chip key={i} label={c} />)}
                          </div>
                        )}
                        {postalRanges.length > 0 && (
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase text-slate-400 mr-1">Postcodes:</span>
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
                        <p className="text-xs font-bold uppercase text-slate-500 tracking-wide">Shipping Rates &amp; Methods</p>
                        <button
                          onClick={() => onEditRate({ zone: z.id, name: '', method: 'Standard Shipping', rate_type: 'FLAT', price: '0.00', min_value: '0.00', max_value: '', free_above: '', estimated_days: '', is_active: true })}
                          className="inline-flex items-center gap-1 rounded-lg bg-violet-50 border border-violet-200 px-3 py-1.5 text-xs font-bold text-violet-700 hover:bg-violet-100 transition">
                          <Plus className="h-3.5 w-3.5" /> Add Rate
                        </button>
                      </div>

                      {zRates.length > 0 ? (
                        <div className="space-y-2">
                          {zRates.map(rate => (
                            <div key={rate.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="text-sm font-bold text-slate-800">{rate.name}</p>
                                  <RateTypeBadge type={rate.rate_type} />
                                  {rate.is_active === false && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">INACTIVE</span>}
                                </div>
                                <div className="mt-0.5 flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                                  {rate.rate_type !== 'FREE' && <span className="font-semibold text-slate-700">£{Number(rate.price || 0).toFixed(2)}</span>}
                                  {rate.rate_type === 'FREE' && <span className="font-semibold text-emerald-600">Free</span>}
                                  {Number(rate.min_value) > 0 && <span>Min: {rate.min_value}</span>}
                                  {rate.max_value && <span>Max: {rate.max_value}</span>}
                                  {rate.free_above && <span className="text-emerald-600">Free above £{rate.free_above}</span>}
                                  {rate.estimated_days && <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{rate.estimated_days} days</span>}
                                  {rate.surcharge_postcodes && <span className="text-amber-600 flex items-center gap-0.5"><AlertTriangle className="h-3 w-3" />Surcharge postcodes</span>}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button onClick={() => onEditRate({...rate})} className="rounded-lg p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 transition"><Pencil className="h-3.5 w-3.5" /></button>
                                <button onClick={() => onDeleteRate(rate)} className="rounded-lg p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 transition"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4">
                          <Truck className="h-5 w-5 text-slate-300 flex-shrink-0" />
                          <p className="text-xs text-slate-400">No rates yet. Add a rate to define pricing for this zone.</p>
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

      {/* Rate Editor (modal) */}
      {editingRate && (
        <RateEditorModal
          rate={editingRate}
          zoneId={editingRate.zone}
          onSave={onSaveRate}
          onClose={onCloseRate}
        />
      )}
    </div>
  );
}
