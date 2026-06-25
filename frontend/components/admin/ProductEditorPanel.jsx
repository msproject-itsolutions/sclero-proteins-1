'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  X, Plus, Save, ChevronLeft, ChevronRight, Image as ImageIcon, Film,
  Upload, Link as LinkIcon, Trash2, GripVertical, Eye, EyeOff,
  Package, Layers, Tag, BarChart3, Settings, FileText, RefreshCw,
  ChevronDown, ChevronUp, Check, AlertCircle, Copy, Zap, Grid,
  DollarSign, Truck, Globe, BookOpen, Info
} from 'lucide-react';

/* ─── Utility helpers ───────────────────────────────────────────────────── */
function fileToDataURL(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = (e) => res(e.target.result);
    reader.onerror = rej;
    reader.readAsDataURL(file);
  });
}
function getYouTubeId(url) {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([^&?/\s]{11})/);
  return m ? m[1] : null;
}
function isYouTubeUrl(url) { return !!getYouTubeId(url); }
function cartesian(arrays) {
  if (!arrays.length) return [[]];
  return arrays.reduce((acc, arr) => acc.flatMap(a => arr.map(v => [...a, v])), [[]]);
}
function autoVariantSKU(parentSku, combo) {
  return `${parentSku}-${combo.map(v => v.replace(/\s+/g, '').toUpperCase().slice(0, 4)).join('-')}`;
}
function slugify(s) { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }
function toText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(toText).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    return value.title || value.name || value.label || value.handle || value.slug || value.description || value.url || '';
  }
  return '';
}

const PRESET_OPTIONS = ['Color', 'Size', 'Weight', 'Material', 'Style', 'Capacity', 'Flavor', 'Scent', 'Dimensions'];
const LABEL_CLS = 'block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1';
const INPUT_CLS = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition';
const TABS = [
  { id: 'general',    icon: FileText,   label: 'General'    },
  { id: 'media',      icon: ImageIcon,  label: 'Media'      },
  { id: 'variants',   icon: Layers,     label: 'Variants'   },
  { id: 'pricing',    icon: DollarSign, label: 'Pricing'    },
  { id: 'attributes', icon: Tag,        label: 'Attributes' },
  { id: 'settings',   icon: Settings,   label: 'Settings'   },
];

/* ─── MEDIA EDITOR ──────────────────────────────────────────────────────── */
function MediaEditor({ media, onChange }) {
  const [urlInput, setUrlInput] = useState('');
  const [urlType, setUrlType] = useState('IMAGE');
  const [dragOver, setDragOver] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const fileRef = useRef();

  const addMedia = (items) => onChange([...media, ...items]);
  const removeMedia = (i) => onChange(media.filter((_, x) => x !== i));
  const updateMedia = (i, patch) => { const m = [...media]; m[i] = { ...m[i], ...patch }; onChange(m); };

  const handleFiles = async (files) => {
    const items = [];
    for (const f of Array.from(files)) {
      const preview = await fileToDataURL(f);
      const type = f.type.startsWith('video') ? 'VIDEO' : 'IMAGE';
      items.push({ media_type: type, file_url: preview, _preview: preview, _fileName: f.name });
    }
    addMedia(items);
  };

  const handleDropZone = (e) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  };

  const handleAddUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    const type = isYouTubeUrl(url) ? 'VIDEO' : urlType;
    addMedia([{ media_type: type, file_url: url }]);
    setUrlInput('');
  };

  // Drag-to-reorder
  const dragStart = (e, i) => { setDragIdx(i); e.dataTransfer.effectAllowed = 'move'; };
  const dragEnter = (e, i) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) return;
    const m = [...media];
    const item = m.splice(dragIdx, 1)[0];
    m.splice(i, 0, item);
    setDragIdx(i);
    onChange(m);
  };
  const dragEnd = () => setDragIdx(null);

  const thumbnail = (m) => {
    if (m.media_type === 'VIDEO') {
      const ytId = getYouTubeId(m.file_url);
      if (ytId) return `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`;
      return null;
    }
    return m._preview || m.file_url;
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDropZone}
        onClick={() => fileRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed py-10 cursor-pointer transition-all
          ${dragOver ? 'border-violet-400 bg-violet-50' : 'border-slate-200 bg-slate-50 hover:border-violet-300 hover:bg-violet-50/50'}`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100">
          <Upload className="h-6 w-6 text-violet-600" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-700">Drop files here or click to upload</p>
          <p className="mt-0.5 text-xs text-slate-400">Supports JPG, PNG, GIF, MP4, WebM</p>
        </div>
        <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden"
          onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {/* URL input row */}
      <div className="flex items-center gap-2">
        <select value={urlType} onChange={(e) => setUrlType(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-2 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500/30">
          <option value="IMAGE">Image URL</option>
          <option value="VIDEO">Video / YouTube</option>
        </select>
        <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
          placeholder="Paste image or YouTube URL…"
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400" />
        <button onClick={handleAddUrl} type="button"
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition">
          <Plus className="h-4 w-4" /> Add
        </button>
      </div>

      {/* Gallery */}
      {media.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {media.map((m, i) => {
            const thumb = thumbnail(m);
            const isVideo = m.media_type === 'VIDEO';
            return (
              <div key={i} draggable onDragStart={(e) => dragStart(e, i)}
                onDragEnter={(e) => dragEnter(e, i)} onDragEnd={dragEnd}
                className={`group relative overflow-hidden rounded-xl border-2 transition cursor-grab active:cursor-grabbing
                  ${i === 0 ? 'border-violet-400' : 'border-slate-200'}
                  ${dragIdx === i ? 'opacity-50 scale-95' : 'opacity-100'}`}>
                {/* Cover badge */}
                {i === 0 && (
                  <span className="absolute left-2 top-2 z-10 rounded-full bg-violet-600 px-2 py-0.5 text-[9px] font-bold uppercase text-white tracking-wide">
                    Cover
                  </span>
                )}
                {/* Preview */}
                <div className="aspect-square bg-slate-100 flex items-center justify-center overflow-hidden">
                  {thumb ? (
                    <img src={thumb} alt="" className="h-full w-full object-cover" />
                  ) : isVideo ? (
                    <Film className="h-8 w-8 text-slate-400" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-slate-400" />
                  )}
                  {isVideo && thumb && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow">
                        <Film className="h-4 w-4 text-slate-700" />
                      </div>
                    </div>
                  )}
                </div>
                {/* Hover actions */}
                <div className="absolute inset-0 flex flex-col items-center justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="w-full truncate text-center text-[9px] text-white/80">
                    {m._fileName || (m.file_url.length > 30 ? m.file_url.slice(0, 30) + '…' : m.file_url)}
                  </p>
                  <div className="flex gap-1">
                    {i !== 0 && (
                      <button onClick={() => { const m2 = [...media]; const [it] = m2.splice(i, 1); m2.unshift(it); onChange(m2); }}
                        type="button" title="Set as cover"
                        className="rounded-lg bg-white/90 p-1.5 text-slate-700 hover:bg-violet-600 hover:text-white transition">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <label title="Replace" className="cursor-pointer rounded-lg bg-white/90 p-1.5 text-slate-700 hover:bg-blue-500 hover:text-white transition">
                      <RefreshCw className="h-3.5 w-3.5" />
                      <input type="file" accept="image/*,video/*" className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files[0]; if (!f) return;
                          const preview = await fileToDataURL(f);
                          const type = f.type.startsWith('video') ? 'VIDEO' : 'IMAGE';
                          updateMedia(i, { media_type: type, file_url: preview, _preview: preview, _fileName: f.name });
                        }} />
                    </label>
                    <button onClick={() => removeMedia(i)} type="button" title="Remove"
                      className="rounded-lg bg-white/90 p-1.5 text-slate-700 hover:bg-red-500 hover:text-white transition">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                {/* Drag handle */}
                <div className="absolute right-1 top-1 rounded p-0.5 text-white opacity-0 group-hover:opacity-80 transition">
                  <GripVertical className="h-4 w-4" />
                </div>
              </div>
            );
          })}
        </div>
      )}
      {media.length === 0 && (
        <p className="text-center text-sm text-slate-400 py-2">No media added yet. Upload files or add URLs above.</p>
      )}
    </div>
  );
}

/* ─── VARIANTS EDITOR ───────────────────────────────────────────────────── */
function VariantsEditor({ editing, onChange, media }) {
  const options = editing._variantOptions || [];
  const variants = editing._variants || [];
  const [bulkPrice, setBulkPrice] = useState('');
  const [bulkStock, setBulkStock] = useState('');
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [showImagePicker, setShowImagePicker] = useState(null); // variantIndex

  const setOptions = (o) => onChange({ ...editing, _variantOptions: o });
  const setVariants = (v) => onChange({ ...editing, _variants: v });

  const addOption = () => {
    if (options.length >= 3) return;
    setOptions([...options, { name: '', values: [] }]);
  };
  const removeOption = (i) => {
    const o = options.filter((_, x) => x !== i);
    setOptions(o);
    regenerate(o);
  };
  const updateOption = (i, patch) => {
    const o = [...options]; o[i] = { ...o[i], ...patch }; setOptions(o);
  };
  const addValue = (i, val) => {
    if (!val.trim()) return;
    const trimmed = val.trim();
    if ((options[i].values || []).includes(trimmed)) return;
    const o = [...options]; o[i] = { ...o[i], values: [...(o[i].values || []), trimmed] }; setOptions(o);
  };
  const removeValue = (optIdx, valIdx) => {
    const o = [...options]; o[optIdx].values = o[optIdx].values.filter((_, i) => i !== valIdx);
    setOptions(o); regenerate(o.filter((_, i) => i !== null));
  };

  const regenerate = (opts = options) => {
    const validOpts = opts.filter(o => o.name && o.values?.length);
    const combos = cartesian(validOpts.map(o => o.values));
    const existing = editing._variants || [];
    const next = combos.map(combo => {
      const key = combo.join('|');
      const prev = existing.find(v => (v.combination || []).join('|') === key);
      return prev || {
        combination: combo,
        sku: autoVariantSKU(editing.sku || 'PROD', combo),
        price: '',
        compare_price: '',
        stock: '',
        weight: '',
        barcode: '',
        image_idx: null,
      };
    });
    setVariants(next);
    setSelectedRows(new Set());
  };

  const updateVariant = (i, patch) => { const v = [...variants]; v[i] = { ...v[i], ...patch }; setVariants(v); };
  const toggleRow = (i) => { const s = new Set(selectedRows); if (s.has(i)) s.delete(i); else s.add(i); setSelectedRows(s); };
  const toggleAll = () => setSelectedRows(selectedRows.size === variants.length ? new Set() : new Set(variants.map((_, i) => i)));

  const bulkApply = () => {
    const v = variants.map((row, i) => {
      if (!selectedRows.has(i)) return row;
      return { ...row, ...(bulkPrice !== '' ? { price: bulkPrice } : {}), ...(bulkStock !== '' ? { stock: bulkStock } : {}) };
    });
    setVariants(v);
    setBulkPrice(''); setBulkStock('');
  };

  const [newValueInputs, setNewValueInputs] = useState({});

  return (
    <div className="space-y-6">
      {/* Option types */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-800">Option Types</p>
            <p className="text-xs text-slate-500">Define the axes of variation (e.g. Color, Size)</p>
          </div>
          {options.length < 3 && (
            <button onClick={addOption} type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:border-violet-400 hover:text-violet-700 transition">
              <Plus className="h-3.5 w-3.5" /> Add option
            </button>
          )}
        </div>

        {options.map((opt, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex items-center gap-2">
              {/* Option name — preset or custom */}
              <div className="relative flex-1">
                <select
                  value={PRESET_OPTIONS.includes(opt.name) ? opt.name : '__custom__'}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') updateOption(i, { name: '' });
                    else updateOption(i, { name: e.target.value });
                  }}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30">
                  {PRESET_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  <option value="__custom__">Custom…</option>
                </select>
              </div>
              {(!PRESET_OPTIONS.includes(opt.name) || opt.name === '') && (
                <input value={opt.name} onChange={(e) => updateOption(i, { name: e.target.value })}
                  placeholder="Custom name" className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
              )}
              <button onClick={() => removeOption(i)} type="button"
                className="rounded-lg border border-slate-200 p-2 text-slate-400 hover:border-red-300 hover:text-red-500 transition">
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Value chips */}
            <div className="flex flex-wrap gap-1.5 items-center">
              {(opt.values || []).map((v, vi) => (
                <span key={vi} className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                  {v}
                  <button onClick={() => removeValue(i, vi)} type="button" className="ml-0.5 text-violet-500 hover:text-red-600 transition">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                value={newValueInputs[i] || ''}
                onChange={(e) => setNewValueInputs({ ...newValueInputs, [i]: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addValue(i, newValueInputs[i] || '');
                    setNewValueInputs({ ...newValueInputs, [i]: '' });
                  }
                }}
                placeholder="Add value, press Enter…"
                className="min-w-[160px] rounded-full border border-dashed border-slate-300 bg-transparent px-3 py-0.5 text-xs text-slate-600 placeholder:text-slate-400 focus:outline-none focus:border-violet-400" />
            </div>
          </div>
        ))}

        {options.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-8">
            <Layers className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-400">No options yet. Click "Add option" to start.</p>
          </div>
        )}
      </div>

      {/* Generate button */}
      {options.some(o => o.name && o.values?.length) && (
        <button onClick={() => regenerate()} type="button"
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white hover:bg-violet-700 transition">
          <Zap className="h-4 w-4" /> Generate {cartesian(options.filter(o => o.name && o.values?.length).map(o => o.values)).length} variant combinations
        </button>
      )}

      {/* Variants table */}
      {variants.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-800">{variants.length} Variants</p>
            <div className="flex items-center gap-2">
              {selectedRows.size > 0 && (
                <>
                  <input value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)}
                    placeholder="Bulk price" className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
                  <input value={bulkStock} onChange={(e) => setBulkStock(e.target.value)}
                    placeholder="Bulk stock" className="w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
                  <button onClick={bulkApply} type="button"
                    className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700 transition">
                    Apply to {selectedRows.size}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-xs min-w-[720px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-2.5">
                    <input type="checkbox" className="accent-violet-600"
                      checked={selectedRows.size === variants.length && variants.length > 0}
                      onChange={toggleAll} />
                  </th>
                  <th className="px-3 py-2.5 font-semibold text-slate-600">Variant</th>
                  <th className="px-3 py-2.5 font-semibold text-slate-600">SKU</th>
                  <th className="px-3 py-2.5 font-semibold text-slate-600">Price</th>
                  <th className="px-3 py-2.5 font-semibold text-slate-600">Compare</th>
                  <th className="px-3 py-2.5 font-semibold text-slate-600">Stock</th>
                  <th className="px-3 py-2.5 font-semibold text-slate-600">Weight (g)</th>
                  <th className="px-3 py-2.5 font-semibold text-slate-600">Barcode</th>
                  <th className="px-3 py-2.5 font-semibold text-slate-600">Image</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {variants.map((v, i) => (
                  <tr key={i} className={`hover:bg-slate-50/70 transition ${selectedRows.has(i) ? 'bg-violet-50' : ''}`}>
                    <td className="px-3 py-2">
                      <input type="checkbox" className="accent-violet-600"
                        checked={selectedRows.has(i)} onChange={() => toggleRow(i)} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {(v.combination || []).map((val, ci) => (
                          <span key={ci} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">{val}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input value={v.sku} onChange={(e) => updateVariant(i, { sku: e.target.value })}
                        className="w-28 rounded border border-slate-200 px-2 py-1 text-xs font-mono focus:outline-none focus:border-violet-400" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={v.price} onChange={(e) => updateVariant(i, { price: e.target.value })}
                        placeholder="0.00" className="w-20 rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:border-violet-400" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={v.compare_price} onChange={(e) => updateVariant(i, { compare_price: e.target.value })}
                        placeholder="0.00" className="w-20 rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:border-violet-400" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={v.stock} onChange={(e) => updateVariant(i, { stock: e.target.value })}
                        placeholder="0" type="number" className="w-16 rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:border-violet-400" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={v.weight} onChange={(e) => updateVariant(i, { weight: e.target.value })}
                        placeholder="0" className="w-16 rounded border border-slate-200 px-2 py-1 text-xs focus:outline-none focus:border-violet-400" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={v.barcode} onChange={(e) => updateVariant(i, { barcode: e.target.value })}
                        placeholder="UPC/EAN" className="w-24 rounded border border-slate-200 px-2 py-1 text-xs font-mono focus:outline-none focus:border-violet-400" />
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => setShowImagePicker(i)} type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 hover:border-violet-400 transition overflow-hidden">
                        {v.image_idx !== null && media[v.image_idx] ? (
                          <img src={media[v.image_idx]._preview || media[v.image_idx].file_url} alt=""
                            className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-slate-300" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Image picker overlay */}
      {showImagePicker !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-bold text-slate-800">Pick image for variant</p>
              <button onClick={() => setShowImagePicker(null)} type="button" className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <button onClick={() => { updateVariant(showImagePicker, { image_idx: null }); setShowImagePicker(null); }}
                type="button" className="flex aspect-square items-center justify-center rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-red-400 hover:text-red-400 transition text-xs">
                None
              </button>
              {media.map((m, mi) => {
                const thumb = m._preview || m.file_url;
                return (
                  <button key={mi} onClick={() => { updateVariant(showImagePicker, { image_idx: mi }); setShowImagePicker(null); }}
                    type="button"
                    className={`relative aspect-square overflow-hidden rounded-xl border-2 transition
                      ${variants[showImagePicker]?.image_idx === mi ? 'border-violet-500' : 'border-slate-200 hover:border-violet-400'}`}>
                    {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : <Film className="h-5 w-5 text-slate-400" />}
                    {variants[showImagePicker]?.image_idx === mi && (
                      <div className="absolute inset-0 flex items-center justify-center bg-violet-600/30">
                        <Check className="h-5 w-5 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── ATTRIBUTES EDITOR ─────────────────────────────────────────────────── */
function AttributesEditor({ editing, onChange }) {
  const specs = editing._specs || [];
  const meta = editing._meta || [];
  const seo = editing._seo && typeof editing._seo === 'object' && !Array.isArray(editing._seo)
    ? {
        title: toText(editing._seo.title),
        description: toText(editing._seo.description),
        handle: toText(editing._seo.handle),
      }
    : { title: '', description: '', handle: '' };
  const shipping = editing._shipping || { weight_g: '', length_cm: '', width_cm: '', height_cm: '', fragile: false };

  const setSpecs = (v) => onChange({ ...editing, _specs: v });
  const setMeta = (v) => onChange({ ...editing, _meta: v });
  const setSeo = (v) => onChange({ ...editing, _seo: v });
  const setShipping = (v) => onChange({ ...editing, _shipping: v });

  const addSpec = () => setSpecs([...specs, { key: '', value: '' }]);
  const updateSpec = (i, patch) => { const s = [...specs]; s[i] = { ...s[i], ...patch }; setSpecs(s); };
  const removeSpec = (i) => setSpecs(specs.filter((_, x) => x !== i));

  const addMeta = () => setMeta([...meta, { key: '', value: '' }]);
  const updateMeta = (i, patch) => { const m = [...meta]; m[i] = { ...m[i], ...patch }; setMeta(m); };
  const removeMeta = (i) => setMeta(meta.filter((_, x) => x !== i));

  return (
    <div className="space-y-6">
      {/* Specifications */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-800">Product Specifications</p>
            <p className="text-xs text-slate-500">e.g. Protein: 25g, Calories: 120</p>
          </div>
          <button onClick={addSpec} type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-violet-400 transition">
            <Plus className="h-3.5 w-3.5" /> Add row
          </button>
        </div>
        <div className="space-y-2">
          {specs.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={s.key} onChange={(e) => updateSpec(i, { key: e.target.value })}
                placeholder="Label" className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400" />
              <input value={s.value} onChange={(e) => updateSpec(i, { value: e.target.value })}
                placeholder="Value" className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400" />
              <button onClick={() => removeSpec(i)} type="button" className="text-slate-400 hover:text-red-500 transition">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {specs.length === 0 && <p className="text-xs text-slate-400">No specifications yet.</p>}
        </div>
      </section>

      {/* Shipping */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-violet-600" />
          <p className="text-sm font-bold text-slate-800">Shipping & Physical Info</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { key: 'weight_g', label: 'Weight (g)' },
            { key: 'length_cm', label: 'Length (cm)' },
            { key: 'width_cm', label: 'Width (cm)' },
            { key: 'height_cm', label: 'Height (cm)' },
          ].map(f => (
            <div key={f.key}>
              <label className={LABEL_CLS}>{f.label}</label>
              <input value={shipping[f.key]} onChange={(e) => setShipping({ ...shipping, [f.key]: e.target.value })}
                placeholder="0" type="number" className={INPUT_CLS} />
            </div>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input type="checkbox" checked={shipping.fragile} onChange={(e) => setShipping({ ...shipping, fragile: e.target.checked })}
            className="accent-violet-600" />
          Fragile — requires special handling
        </label>
      </section>

      {/* SEO */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-violet-600" />
          <p className="text-sm font-bold text-slate-800">Search Engine Optimisation</p>
        </div>
        <div className="space-y-3">
          <div>
            <label className={LABEL_CLS}>SEO Title</label>
            <input value={seo.title} onChange={(e) => setSeo({ ...seo, title: e.target.value })}
              placeholder="Page title shown in search results" className={INPUT_CLS} maxLength={70} />
            <p className="mt-0.5 text-right text-[10px] text-slate-400">{(seo.title || '').length}/70</p>
          </div>
          <div>
            <label className={LABEL_CLS}>Meta Description</label>
            <textarea value={seo.description} onChange={(e) => setSeo({ ...seo, description: e.target.value })}
              placeholder="Brief description shown in search results" rows={3}
              className={INPUT_CLS + ' resize-none'} maxLength={160} />
            <p className="mt-0.5 text-right text-[10px] text-slate-400">{(seo.description || '').length}/160</p>
          </div>
          <div>
            <label className={LABEL_CLS}>URL Handle</label>
            <div className="flex items-center gap-0">
              <span className="rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-400">/products/</span>
              <input value={seo.handle} onChange={(e) => setSeo({ ...seo, handle: slugify(e.target.value) })}
                placeholder="product-handle" className="flex-1 rounded-r-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400" />
            </div>
            <button onClick={() => setSeo({ ...seo, handle: slugify(toText(editing.name) || '') })} type="button"
              className="mt-1 text-xs text-violet-600 hover:text-violet-800 transition">↺ Generate from title</button>
          </div>
        </div>
      </section>

      {/* Custom Metadata */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-800">Custom Metadata</p>
            <p className="text-xs text-slate-500">Certifications, origin, compliance fields, etc.</p>
          </div>
          <button onClick={addMeta} type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-violet-400 transition">
            <Plus className="h-3.5 w-3.5" /> Add field
          </button>
        </div>
        <div className="space-y-2">
          {meta.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={m.key} onChange={(e) => updateMeta(i, { key: e.target.value })}
                placeholder="Field name" className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400" />
              <input value={m.value} onChange={(e) => updateMeta(i, { value: e.target.value })}
                placeholder="Value" className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400" />
              <button onClick={() => removeMeta(i)} type="button" className="text-slate-400 hover:text-red-500 transition">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {meta.length === 0 && <p className="text-xs text-slate-400">No custom fields yet.</p>}
        </div>
      </section>
    </div>
  );
}

/* ─── MAIN EDITOR PANEL ─────────────────────────────────────────────────── */
export default function ProductEditorPanel({ editing, onChange, onClose, onSave, saving, err, regions, categories }) {
  const [activeTab, setActiveTab] = useState('general');
  const isNew = !editing.id;
  const productType = toText(editing.product_type) || 'Simple';
  const isVariable = productType === 'Variable';
  const seo = editing._seo && typeof editing._seo === 'object' && !Array.isArray(editing._seo)
    ? {
        title: toText(editing._seo.title),
        description: toText(editing._seo.description),
        handle: toText(editing._seo.handle),
      }
    : { title: '', description: '', handle: '' };

  const tabs = TABS.filter(t => t.id !== 'variants' || isVariable);

  const setEditing = onChange;

  /* helpers */
  const setMedia = (m) => setEditing({ ...editing, _media: m });
  const setRegional = (i, patch) => {
    const r = [...editing._regional]; r[i] = { ...r[i], ...patch }; setEditing({ ...editing, _regional: r });
  };

  return (
    <div className="fixed inset-y-0 right-0 left-0 md:left-[280px] lg:left-[288px] top-0 md:top-[65px] z-30 bg-slate-50 overflow-hidden flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} type="button"
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 transition">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400 tracking-wide">Products</p>
            <h2 className="text-base font-black text-slate-800">{isNew ? 'New Product' : toText(editing.name) || 'Edit Product'}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide
            ${editing.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            {editing.is_active ? 'Active' : 'Draft'}
          </span>
          <button onClick={onSave} disabled={saving} type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60 transition shadow-sm">
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex gap-0 border-b border-slate-200 bg-white px-4 overflow-x-auto flex-shrink-0">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)} type="button"
              className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition
                ${activeTab === t.id ? 'border-violet-600 text-violet-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Error banner */}
      {err && (
        <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-6 py-2.5 flex-shrink-0">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
          <p className="text-xs text-red-700 font-medium">{err}</p>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">

          {/* ── TAB: General ── */}
          {activeTab === 'general' && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
                <p className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3">Basic Information</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={LABEL_CLS}>SKU</label>
                    <input value={editing.sku} disabled={!!editing.id}
                      onChange={(e) => setEditing({ ...editing, sku: e.target.value })}
                      placeholder="PROD-001"
                      className={INPUT_CLS + (editing.id ? ' bg-slate-50 cursor-not-allowed opacity-70' : '')} />
                  </div>
                  <div className="col-span-2">
                    <label className={LABEL_CLS}>Product Name</label>
                    <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      placeholder="e.g. Whey Protein Isolate 2kg" className={INPUT_CLS} />
                  </div>
                </div>
                <div>
                  <label className={LABEL_CLS}>Product Type</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { val: 'Simple', label: 'Simple', desc: 'Single variant' },
                      { val: 'Variable', label: 'Variable', desc: 'Multiple variants' },
                      { val: 'Bundle', label: 'Bundle', desc: 'Group of products' },
                    ].map(opt => (
                      <button key={opt.val} type="button"
                        onClick={() => setEditing({ ...editing, product_type: opt.val })}
                        className={`rounded-xl border-2 p-3 text-left transition
                          ${productType === opt.val ? 'border-violet-500 bg-violet-50' : 'border-slate-200 bg-white hover:border-violet-200'}`}>
                        <p className={`text-sm font-bold ${productType === opt.val ? 'text-violet-700' : 'text-slate-700'}`}>{opt.label}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={LABEL_CLS}>Description</label>
                  <textarea value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                    placeholder="Detailed product description…" rows={4}
                    className={INPUT_CLS + ' resize-none'} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL_CLS}>Benefits</label>
                    <textarea value={editing.benefits} onChange={(e) => setEditing({ ...editing, benefits: e.target.value })}
                      placeholder="Key benefits…" rows={3} className={INPUT_CLS + ' resize-none'} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Ingredients</label>
                    <textarea value={editing.ingredients} onChange={(e) => setEditing({ ...editing, ingredients: e.target.value })}
                      placeholder="Ingredients list…" rows={3} className={INPUT_CLS + ' resize-none'} />
                  </div>
                </div>
              </div>

              {/* Collections */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-bold text-slate-800 mb-3">Collections</p>
                <div className="flex flex-wrap gap-2">
                  {categories.map(c => {
                    const on = editing._categories.includes(c.id);
                    return (
                      <button key={c.id} type="button"
                        onClick={() => setEditing({ ...editing, _categories: on ? editing._categories.filter(x => x !== c.id) : [...editing._categories, c.id] })}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition
                          ${on ? 'border-violet-500 bg-violet-100 text-violet-700' : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'}`}>
                        {c.name}
                      </button>
                    );
                  })}
                  {categories.length === 0 && <p className="text-xs text-slate-400">No collections defined yet.</p>}
                </div>
              </div>
            </div>
          )}

          {/* ── TAB: Media ── */}
          {activeTab === 'media' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4">
                <p className="text-sm font-bold text-slate-800">Product Media</p>
                <p className="text-xs text-slate-400 mt-0.5">Upload images/videos or add URLs. Drag to reorder. First item is the cover.</p>
              </div>
              <MediaEditor media={editing._media || []} onChange={setMedia} />
            </div>
          )}

          {/* ── TAB: Variants ── */}
          {activeTab === 'variants' && isVariable && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4">
                  <p className="text-sm font-bold text-slate-800">Product Options &amp; Variants</p>
                  <p className="text-xs text-slate-400 mt-0.5">Define up to 3 option types. Combinations are generated automatically.</p>
                </div>
                <VariantsEditor editing={editing} onChange={setEditing} media={editing._media || []} />
              </div>
            </div>
          )}

          {/* ── TAB: Pricing ── */}
          {activeTab === 'pricing' && (
            <div className="space-y-4">
              {isVariable ? (
                <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <Info className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Variable product pricing</p>
                    <p className="text-xs text-amber-700 mt-0.5">Prices are set per variant in the Variants tab. Regional configs below apply as base defaults.</p>
                  </div>
                </div>
              ) : null}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
                <p className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3">Regional Pricing &amp; Stock</p>
                {editing._regional.map((row, i) => (
                  <div key={row.region} className="rounded-xl border border-slate-200 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{row.code}</span>
                      <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                        <input type="checkbox" checked={row.is_visible}
                          onChange={(e) => setRegional(i, { is_visible: e.target.checked })} className="accent-violet-600" />
                        Visible
                      </label>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className={LABEL_CLS}>Price</label>
                        <input value={row.price} onChange={(e) => setRegional(i, { price: e.target.value })}
                          placeholder="0.00" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400" />
                      </div>
                      <div>
                        <label className={LABEL_CLS}>Promo Price</label>
                        <input value={row.promotional_price} onChange={(e) => setRegional(i, { promotional_price: e.target.value })}
                          placeholder="0.00" className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400" />
                      </div>
                      <div>
                        <label className={LABEL_CLS}>Stock (units)</label>
                        <input value={row.available} onChange={(e) => setRegional(i, { available: e.target.value })}
                          type="number" placeholder="0"
                          className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TAB: Attributes ── */}
          {activeTab === 'attributes' && (
            <AttributesEditor editing={editing} onChange={setEditing} />
          )}

          {/* ── TAB: Settings ── */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
                <p className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3">Product Status</p>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div onClick={() => setEditing({ ...editing, is_active: !editing.is_active })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${editing.is_active ? 'bg-violet-600' : 'bg-slate-200'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${editing.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{editing.is_active ? 'Active' : 'Draft'}</p>
                    <p className="text-xs text-slate-400">{editing.is_active ? 'Visible in storefront' : 'Hidden from storefront'}</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div onClick={() => setEditing({ ...editing, is_archived: !editing.is_archived })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${editing.is_archived ? 'bg-amber-500' : 'bg-slate-200'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${editing.is_archived ? 'translate-x-6' : 'translate-x-1'}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{editing.is_archived ? 'Archived' : 'Not Archived'}</p>
                    <p className="text-xs text-slate-400">Archived products are hidden from all views</p>
                  </div>
                </label>
              </div>

              {/* FAQ Editor */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <p className="text-sm font-bold text-slate-800">FAQ</p>
                  <button onClick={() => setEditing({ ...editing, faq: [...(editing.faq || []), { q: '', a: '' }] })} type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-violet-400 transition">
                    <Plus className="h-3.5 w-3.5" /> Add FAQ
                  </button>
                </div>
                {(editing.faq || []).map((faq, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <input value={faq.q} onChange={(e) => { const f = [...editing.faq]; f[i] = { ...f[i], q: e.target.value }; setEditing({ ...editing, faq: f }); }}
                        placeholder="Question" className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
                      <button onClick={() => setEditing({ ...editing, faq: editing.faq.filter((_, x) => x !== i) })} type="button"
                        className="text-slate-400 hover:text-red-500 transition">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <textarea value={faq.a} onChange={(e) => { const f = [...editing.faq]; f[i] = { ...f[i], a: e.target.value }; setEditing({ ...editing, faq: f }); }}
                      placeholder="Answer" rows={2}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
                  </div>
                ))}
                {!(editing.faq || []).length && <p className="text-xs text-slate-400">No FAQs added yet.</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
