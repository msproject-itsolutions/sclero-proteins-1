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
// Matches the slugs documented on Product.dietary_tags in the backend model.
const DIETARY_TAG_OPTIONS = [
  ['vegan', 'Vegan'], ['vegetarian', 'Vegetarian'], ['gluten_free', 'Gluten free'],
  ['dairy_free', 'Dairy free'], ['sugar_free', 'Sugar free'], ['halal', 'Halal'],
  ['kosher', 'Kosher'], ['gmp_certified', 'GMP certified'], ['lab_tested', 'Lab tested'],
  ['non_gmo', 'Non-GMO'], ['third_party_tested', 'Third-party tested'],
];
const LABEL_CLS = 'kicker block mb-1';
const INPUT_CLS = 'w-full rounded-sm border border-edge bg-white px-3 py-2.5 text-sm text-ink-primary placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-edge-focus/30 focus:border-ink-primary transition';
const TABS = [
  { id: 'general',    icon: FileText,   label: 'General'    },
  { id: 'media',      icon: ImageIcon,  label: 'Media'      },
  { id: 'variants',   icon: Layers,     label: 'Variants'   },
  { id: 'pricing',    icon: DollarSign, label: 'Pricing'    },
  { id: 'attributes', icon: Tag,        label: 'Attributes' },
  { id: 'settings',   icon: Settings,   label: 'Settings'   },
];

/* ─── MEDIA EDITOR ──────────────────────────────────────────────────────── */
function MediaEditor({ media, onChange, authFetch }) {
  const [urlInput, setUrlInput] = useState('');
  const [urlType, setUrlType] = useState('IMAGE');
  const [dragOver, setDragOver] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const addMedia = (items) => onChange([...media, ...items]);
  const removeMedia = (i) => onChange(media.filter((_, x) => x !== i));
  const updateMedia = (i, patch) => { const m = [...media]; m[i] = { ...m[i], ...patch }; onChange(m); };

  const uploadDeviceFile = async (file) => {
    if (!authFetch) throw new Error('Upload service is not available.');
    const formData = new FormData();
    formData.append('file', file);
    const res = await authFetch('/api/admin/upload-media/', { method: 'POST', body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.file_url) throw new Error(data.error || 'Upload failed.');
    return data.file_url;
  };

  const handleFiles = async (files) => {
    setUploading(true);
    const items = [];
    try {
      for (const f of Array.from(files)) {
        const fileUrl = await uploadDeviceFile(f);
        const type = f.type.startsWith('video') ? 'VIDEO' : 'IMAGE';
        items.push({ media_type: type, file_url: fileUrl, _fileName: f.name });
      }
      addMedia(items);
    } catch (err) {
      alert(err.message || 'Media upload failed.');
    } finally {
      setUploading(false);
    }
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
        className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-10 cursor-pointer transition-all
          ${dragOver ? 'border-ink-primary bg-surface-muted' : 'border-edge bg-surface-muted hover:border-edge-strong hover:bg-surface-muted'}`}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-muted">
          <Upload className="h-6 w-6 text-ink-accent" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold text-ink-secondary">{uploading ? 'Uploading files...' : 'Drop files here or click to upload'}</p>
          <p className="mt-0.5 text-sm text-ink-subtle">Supports JPG, PNG, GIF, MP4, WebM</p>
        </div>
        <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden"
          disabled={uploading}
          onChange={(e) => handleFiles(e.target.files)} />
      </div>

      {/* URL input row */}
      <div className="flex items-center gap-2">
        <select value={urlType} onChange={(e) => setUrlType(e.target.value)}
          className="rounded-sm border border-edge bg-white px-2 py-2.5 text-sm text-ink-secondary focus:outline-none focus:ring-2 focus:ring-edge-focus/30">
          <option value="IMAGE">Image URL</option>
          <option value="VIDEO">Video / YouTube</option>
        </select>
        <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddUrl()}
          placeholder="Paste image or YouTube URL…"
          className="flex-1 rounded-sm border border-edge bg-white px-3 py-2.5 text-sm placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-edge-focus/30 focus:border-ink-primary" />
        <button onClick={handleAddUrl} type="button"
          className="btn-primary px-4 py-2.5 text-sm">
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
                className={`group relative overflow-hidden rounded-md border-2 transition cursor-grab active:cursor-grabbing
                  ${i === 0 ? 'border-ink-primary' : 'border-edge'}
                  ${dragIdx === i ? 'opacity-50 scale-95' : 'opacity-100'}`}>
                {/* Cover badge */}
                {i === 0 && (
                  <span className="absolute left-2 top-2 z-10 rounded-xs bg-ink-primary px-2 py-0.5 text-[13px] font-semibold uppercase text-white tracking-wide">
                    Cover
                  </span>
                )}
                {/* Preview */}
                <div className="aspect-square bg-surface-muted flex items-center justify-center overflow-hidden">
                  {thumb ? (
                    <img src={thumb} alt="" className="h-full w-full object-cover" />
                  ) : isVideo ? (
                    <Film className="h-8 w-8 text-ink-subtle" />
                  ) : (
                    <ImageIcon className="h-8 w-8 text-ink-subtle" />
                  )}
                  {isVideo && thumb && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow">
                        <Film className="h-4 w-4 text-ink-secondary" />
                      </div>
                    </div>
                  )}
                </div>
                {/* Hover actions */}
                <div className="absolute inset-0 flex flex-col items-center justify-end gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="w-full truncate text-center text-[13px] text-white/80">
                    {m._fileName || (m.file_url.length > 30 ? m.file_url.slice(0, 30) + '…' : m.file_url)}
                  </p>
                  <div className="flex gap-1">
                    {i !== 0 && (
                      <button onClick={() => { const m2 = [...media]; const [it] = m2.splice(i, 1); m2.unshift(it); onChange(m2); }}
                        type="button" title="Set as cover"
                        className="rounded-sm bg-white/90 p-1.5 text-ink-secondary hover:bg-ink-primary hover:text-white transition">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <label title="Replace" className="cursor-pointer rounded-sm bg-white/90 p-1.5 text-ink-secondary hover:bg-ink-primary hover:text-white transition">
                      <RefreshCw className="h-3.5 w-3.5" />
                      <input type="file" accept="image/*,video/*" className="hidden"
                        onChange={async (e) => {
                          const f = e.target.files[0]; if (!f) return;
                          try {
                            const fileUrl = await uploadDeviceFile(f);
                            const type = f.type.startsWith('video') ? 'VIDEO' : 'IMAGE';
                            updateMedia(i, { media_type: type, file_url: fileUrl, _preview: '', _fileName: f.name });
                          } catch (err) {
                            alert(err.message || 'Media upload failed.');
                          }
                        }} />
                    </label>
                    <button onClick={() => removeMedia(i)} type="button" title="Remove"
                      className="rounded-sm bg-white/90 p-1.5 text-ink-secondary hover:bg-red-700 hover:text-white transition">
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
        <p className="text-center text-sm text-ink-subtle py-2">No media added yet. Upload files or add URLs above.</p>
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
            <p className="text-sm font-semibold text-ink-primary">Option Types</p>
            <p className="text-sm text-ink-muted">Define the axes of variation (e.g. Color, Size)</p>
          </div>
          {options.length < 3 && (
            <button onClick={addOption} type="button"
              className="inline-flex items-center gap-1.5 rounded-sm border border-edge bg-white px-3 py-2 text-sm font-semibold text-ink-secondary hover:border-edge-strong hover:text-ink-accent transition">
              <Plus className="h-3.5 w-3.5" /> Add option
            </button>
          )}
        </div>

        {options.map((opt, i) => (
          <div key={i} className="rounded-md border border-edge bg-white shadow-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              {/* Option name — preset or custom */}
              <div className="relative flex-1">
                <select
                  value={PRESET_OPTIONS.includes(opt.name) ? opt.name : '__custom__'}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') updateOption(i, { name: '' });
                    else updateOption(i, { name: e.target.value });
                  }}
                  className="w-full rounded-sm border border-edge bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-edge-focus/30">
                  {PRESET_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
                  <option value="__custom__">Custom…</option>
                </select>
              </div>
              {(!PRESET_OPTIONS.includes(opt.name) || opt.name === '') && (
                <input value={opt.name} onChange={(e) => updateOption(i, { name: e.target.value })}
                  placeholder="Custom name" className="flex-1 rounded-sm border border-edge px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-edge-focus/30" />
              )}
              <button onClick={() => removeOption(i)} type="button"
                className="rounded-sm border border-edge p-2 text-ink-subtle hover:border-red-300 hover:text-ink-danger transition">
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* Value chips */}
            <div className="flex flex-wrap gap-1.5 items-center">
              {(opt.values || []).map((v, vi) => (
                <span key={vi} className="inline-flex items-center gap-1 rounded-xs bg-surface-muted px-2.5 py-0.5 text-sm font-semibold text-ink-accent">
                  {v}
                  <button onClick={() => removeValue(i, vi)} type="button" className="ml-0.5 text-ink-accent hover:text-ink-danger transition">
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
                className="min-w-[160px] rounded-sm border border-dashed border-edge-strong bg-transparent px-3 py-0.5 text-sm text-ink-secondary placeholder:text-ink-subtle focus:outline-none focus:border-ink-primary" />
            </div>
          </div>
        ))}

        {options.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-md border-2 border-dashed border-edge py-8">
            <Layers className="h-8 w-8 text-ink-subtle" />
            <p className="text-sm text-ink-subtle">No options yet. Click "Add option" to start.</p>
          </div>
        )}
      </div>

      {/* Generate button */}
      {options.some(o => o.name && o.values?.length) && (
        <button onClick={() => regenerate()} type="button"
          className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-ink-primary px-4 py-3 text-sm font-semibold text-white hover:bg-ink-primary/90 transition">
          <Zap className="h-4 w-4" /> Generate {cartesian(options.filter(o => o.name && o.values?.length).map(o => o.values)).length} variant combinations
        </button>
      )}

      {/* Variants table */}
      {variants.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink-primary">{variants.length} Variants</p>
            <div className="flex items-center gap-2">
              {selectedRows.size > 0 && (
                <>
                  <input value={bulkPrice} onChange={(e) => setBulkPrice(e.target.value)}
                    placeholder="Bulk price" className="w-24 rounded-sm border border-edge px-2 py-1.5 text-sm" />
                  <input value={bulkStock} onChange={(e) => setBulkStock(e.target.value)}
                    placeholder="Bulk stock" className="w-24 rounded-sm border border-edge px-2 py-1.5 text-sm" />
                  <button onClick={bulkApply} type="button"
                    className="btn-primary px-3 py-1.5 text-sm">
                    Apply to {selectedRows.size}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border border-edge bg-white shadow-card">
            <table className="w-full text-left text-sm min-w-[720px]">
              <thead className="bg-surface-muted text-[12px] font-medium uppercase tracking-wide text-ink-muted border-b border-edge">
                <tr>
                  <th className="px-3 py-2.5">
                    <input type="checkbox" className="accent-ink-primary"
                      checked={selectedRows.size === variants.length && variants.length > 0}
                      onChange={toggleAll} />
                  </th>
                  <th className="px-3 py-2.5 font-semibold text-ink-secondary">Variant</th>
                  <th className="px-3 py-2.5 font-semibold text-ink-secondary">SKU</th>
                  <th className="px-3 py-2.5 font-semibold text-ink-secondary">Price</th>
                  <th className="px-3 py-2.5 font-semibold text-ink-secondary">Compare</th>
                  <th className="px-3 py-2.5 font-semibold text-ink-secondary">Stock</th>
                  <th className="px-3 py-2.5 font-semibold text-ink-secondary">Weight (g)</th>
                  <th className="px-3 py-2.5 font-semibold text-ink-secondary">Barcode</th>
                  <th className="px-3 py-2.5 font-semibold text-ink-secondary">Image</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge-subtle">
                {variants.map((v, i) => (
                  <tr key={i} className={`hover:bg-surface-muted transition ${selectedRows.has(i) ? 'bg-surface-muted' : ''}`}>
                    <td className="px-3 py-2">
                      <input type="checkbox" className="accent-ink-primary"
                        checked={selectedRows.has(i)} onChange={() => toggleRow(i)} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {(v.combination || []).map((val, ci) => (
                          <span key={ci} className="rounded-xs bg-surface-muted px-2 py-0.5 text-[12px] font-semibold text-ink-secondary">{val}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input value={v.sku ?? ''} onChange={(e) => updateVariant(i, { sku: e.target.value })}
                        className="w-28 rounded border border-edge px-2 py-1 text-sm font-mono focus:outline-none focus:border-ink-primary" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={v.price ?? ''} onChange={(e) => updateVariant(i, { price: e.target.value })}
                        placeholder="0.00" className="w-20 rounded border border-edge px-2 py-1 text-sm focus:outline-none focus:border-ink-primary" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={v.compare_price ?? ''} onChange={(e) => updateVariant(i, { compare_price: e.target.value })}
                        placeholder="0.00" className="w-20 rounded border border-edge px-2 py-1 text-sm focus:outline-none focus:border-ink-primary" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={v.stock ?? ''} onChange={(e) => updateVariant(i, { stock: e.target.value })}
                        placeholder="0" type="number" className="w-16 rounded border border-edge px-2 py-1 text-sm focus:outline-none focus:border-ink-primary" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={v.weight ?? ''} onChange={(e) => updateVariant(i, { weight: e.target.value })}
                        placeholder="0" className="w-16 rounded border border-edge px-2 py-1 text-sm focus:outline-none focus:border-ink-primary" />
                    </td>
                    <td className="px-3 py-2">
                      <input value={v.barcode ?? ''} onChange={(e) => updateVariant(i, { barcode: e.target.value })}
                        placeholder="UPC/EAN" className="w-24 rounded border border-edge px-2 py-1 text-sm font-mono focus:outline-none focus:border-ink-primary" />
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => setShowImagePicker(i)} type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-sm border border-edge hover:border-edge-strong transition overflow-hidden">
                        {v.image_idx !== null && media[v.image_idx] ? (
                          <img src={media[v.image_idx]._preview || media[v.image_idx].file_url} alt=""
                            className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-ink-subtle" />
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

      {/* Variant image selection workspace */}
      {showImagePicker !== null && (
        <div className="admin-action-page flex flex-col items-center">
          <div className="w-full max-w-md rounded-lg bg-white p-5 shadow-overlay">
            <div className="mb-4 flex items-center justify-between">
              <p className="font-semibold text-ink-primary">Pick image for variant</p>
              <button onClick={() => setShowImagePicker(null)} type="button" className="text-ink-subtle hover:text-ink-secondary">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <button onClick={() => { updateVariant(showImagePicker, { image_idx: null }); setShowImagePicker(null); }}
                type="button" className="flex aspect-square items-center justify-center rounded-md border-2 border-dashed border-edge text-ink-subtle hover:border-red-400 hover:text-ink-danger transition text-sm">
                None
              </button>
              {media.map((m, mi) => {
                const thumb = m._preview || m.file_url;
                return (
                  <button key={mi} onClick={() => { updateVariant(showImagePicker, { image_idx: mi }); setShowImagePicker(null); }}
                    type="button"
                    className={`relative aspect-square overflow-hidden rounded-md border-2 transition
                      ${variants[showImagePicker]?.image_idx === mi ? 'border-ink-primary' : 'border-edge hover:border-edge-strong'}`}>
                    {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : <Film className="h-5 w-5 text-ink-subtle" />}
                    {variants[showImagePicker]?.image_idx === mi && (
                      <div className="absolute inset-0 flex items-center justify-center bg-ink-primary/30">
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

  const tags = Array.isArray(editing.dietary_tags) ? editing.dietary_tags : [];
  const toggleTag = (tag) =>
    onChange({
      ...editing,
      dietary_tags: tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag],
    });

  return (
    <div className="space-y-6">
      {/* Dietary tags — rendered as badges on the product page */}
      <section className="rounded-md border border-edge bg-white shadow-card p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-ink-primary">Dietary &amp; quality tags</p>
          <p className="text-sm text-ink-muted">Shown as badges beside the ingredients on the product page.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {DIETARY_TAG_OPTIONS.map(([value, label]) => {
            const on = tags.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleTag(value)}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                  on
                    ? 'border-ink-primary bg-ink-primary text-white'
                    : 'border-edge bg-white text-ink-muted hover:border-ink-primary hover:text-ink-primary'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Supplement facts */}
      <section className="rounded-md border border-edge bg-white shadow-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-ink-primary">Supplement facts</p>
            <p className="text-sm text-ink-muted">
              The table shown on the product page, e.g. Serving Size: 1–2 capsules daily.
            </p>
          </div>
          <button onClick={addSpec} type="button"
            className="inline-flex items-center gap-1 rounded-sm border border-edge px-3 py-1.5 text-sm font-semibold text-ink-secondary hover:border-edge-strong transition">
            <Plus className="h-3.5 w-3.5" /> Add row
          </button>
        </div>
        <div className="space-y-2">
          {specs.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={s.key} onChange={(e) => updateSpec(i, { key: e.target.value })}
                placeholder="Label" className="flex-1 rounded-sm border border-edge px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-edge-focus/30 focus:border-ink-primary" />
              <input value={s.value} onChange={(e) => updateSpec(i, { value: e.target.value })}
                placeholder="Value" className="flex-1 rounded-sm border border-edge px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-edge-focus/30 focus:border-ink-primary" />
              <button onClick={() => removeSpec(i)} type="button" className="text-ink-subtle hover:text-ink-danger transition">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {specs.length === 0 && <p className="text-sm text-ink-subtle">No specifications yet.</p>}
        </div>
      </section>

      {/* Shipping */}
      <section className="rounded-md border border-edge bg-white shadow-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-ink-accent" />
          <p className="text-sm font-semibold text-ink-primary">Shipping & Physical Info</p>
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
        <label className="flex items-center gap-2 text-sm text-ink-secondary cursor-pointer">
          <input type="checkbox" checked={shipping.fragile} onChange={(e) => setShipping({ ...shipping, fragile: e.target.checked })}
            className="accent-ink-primary" />
          Fragile — requires special handling
        </label>
      </section>

      {/* SEO */}
      <section className="rounded-md border border-edge bg-white shadow-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-ink-accent" />
          <p className="text-sm font-semibold text-ink-primary">Search Engine Optimisation</p>
        </div>
        <div className="space-y-3">
          <div>
            <label className={LABEL_CLS}>SEO Title</label>
            <input value={seo.title} onChange={(e) => setSeo({ ...seo, title: e.target.value })}
              placeholder="Page title shown in search results" className={INPUT_CLS} maxLength={70} />
            <p className="mt-0.5 text-right text-[12px] text-ink-subtle">{(seo.title || '').length}/70</p>
          </div>
          <div>
            <label className={LABEL_CLS}>Meta Description</label>
            <textarea value={seo.description} onChange={(e) => setSeo({ ...seo, description: e.target.value })}
              placeholder="Brief description shown in search results" rows={3}
              className={INPUT_CLS + ' resize-none'} maxLength={160} />
            <p className="mt-0.5 text-right text-[12px] text-ink-subtle">{(seo.description || '').length}/160</p>
          </div>
          <div>
            <label className={LABEL_CLS}>URL Handle</label>
            <div className="flex items-center gap-0">
              <span className="rounded-l-lg border border-r-0 border-edge bg-surface-muted px-3 py-2.5 text-sm text-ink-subtle">/products/</span>
              <input value={seo.handle} onChange={(e) => setSeo({ ...seo, handle: slugify(e.target.value) })}
                placeholder="product-handle" className="flex-1 rounded-r-lg border border-edge px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-edge-focus/30 focus:border-ink-primary" />
            </div>
            <button onClick={() => setSeo({ ...seo, handle: slugify(toText(editing.name) || '') })} type="button"
              className="mt-1 text-sm text-ink-accent hover:text-ink-accent transition">↺ Generate from title</button>
          </div>
        </div>
      </section>

      {/* Custom Metadata */}
      <section className="rounded-md border border-edge bg-white shadow-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-ink-primary">Custom Metadata</p>
            <p className="text-sm text-ink-muted">Certifications, origin, compliance fields, etc.</p>
          </div>
          <button onClick={addMeta} type="button"
            className="inline-flex items-center gap-1 rounded-sm border border-edge px-3 py-1.5 text-sm font-semibold text-ink-secondary hover:border-edge-strong transition">
            <Plus className="h-3.5 w-3.5" /> Add field
          </button>
        </div>
        <div className="space-y-2">
          {meta.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={m.key} onChange={(e) => updateMeta(i, { key: e.target.value })}
                placeholder="Field name" className="flex-1 rounded-sm border border-edge px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-edge-focus/30 focus:border-ink-primary" />
              <input value={m.value} onChange={(e) => updateMeta(i, { value: e.target.value })}
                placeholder="Value" className="flex-1 rounded-sm border border-edge px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-edge-focus/30 focus:border-ink-primary" />
              <button onClick={() => removeMeta(i)} type="button" className="text-ink-subtle hover:text-ink-danger transition">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {meta.length === 0 && <p className="text-sm text-ink-subtle">No custom fields yet.</p>}
        </div>
      </section>
    </div>
  );
}

/* ─── MAIN EDITOR PANEL ─────────────────────────────────────────────────── */
export default function ProductEditorPanel({ editing, onChange, onClose, onSave, saving, err, regions, categories, authFetch }) {
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

  const setEditing = onChange;

  /* helpers */
  const setMedia = (m) => setEditing({ ...editing, _media: m });
  const setRegional = (i, patch) => {
    const r = [...editing._regional]; r[i] = { ...r[i], ...patch }; setEditing({ ...editing, _regional: r });
  };

  return (
    <div className="bg-surface-muted overflow-hidden flex flex-col h-[calc(100vh-140px)] rounded-lg border border-edge shadow-card">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-edge bg-white px-4 py-3 sm:px-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} type="button"
            className="rounded-sm border border-edge p-2 text-ink-muted hover:bg-surface-muted transition">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-sm font-semibold uppercase text-ink-subtle tracking-wide">Products</p>
            <h2 className="text-base font-semibold text-ink-primary">{isNew ? 'New Product' : toText(editing.name) || 'Edit Product'}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-xs px-2.5 py-1 text-[12px] font-semibold uppercase tracking-wide
            ${editing.is_active ? 'bg-brand-success/10 text-ink-success' : 'bg-surface-muted text-ink-muted'}`}>
            {editing.is_active ? 'Active' : 'Draft'}
          </span>
          <button onClick={onSave} disabled={saving} type="button"
            className="inline-flex items-center gap-2 rounded-md bg-ink-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink-primary/90 disabled:opacity-60 transition shadow-card">
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Error banner */}
      {err && (
        <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-6 py-2.5 flex-shrink-0">
          <AlertCircle className="h-4 w-4 text-ink-danger flex-shrink-0" />
          <p className="text-sm text-ink-danger font-medium">{err}</p>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto bg-brand-bg">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Main Content Column */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Basic Information */}
              <div className="rounded-lg border border-edge bg-white p-6 space-y-4 shadow-card">
                <p className="text-sm font-semibold text-ink-primary border-b border-edge-subtle pb-3">Basic Information</p>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={LABEL_CLS}>SKU</label>
                    <input value={editing.sku ?? ''} disabled={!!editing.id}
                      onChange={(e) => setEditing({ ...editing, sku: e.target.value })}
                      placeholder="PROD-001"
                      className={INPUT_CLS + (editing.id ? ' bg-surface-muted cursor-not-allowed opacity-70' : '')} />
                  </div>
                  <div className="col-span-2">
                    <label className={LABEL_CLS}>Product Name</label>
                    <input value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      placeholder="e.g. Whey Protein Isolate 2kg" className={INPUT_CLS} />
                  </div>
                </div>
                <div className="max-w-[240px]">
                  <label className={LABEL_CLS}>HSN code</label>
                  <input
                    value={toText(editing.hsn_code)}
                    onChange={(e) => setEditing({ ...editing, hsn_code: e.target.value })}
                    placeholder="e.g. 21069099"
                    className={INPUT_CLS}
                  />
                  <p className="mt-1 text-[13px] text-ink-subtle">Tax classification code used on invoices.</p>
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
                        className={`rounded-md border-2 p-3 text-left transition
                          ${productType === opt.val ? 'border-ink-primary bg-surface-muted' : 'border-edge bg-white hover:border-edge-strong'}`}>
                        <p className={`text-sm font-semibold ${productType === opt.val ? 'text-ink-accent' : 'text-ink-secondary'}`}>{opt.label}</p>
                        <p className="text-sm text-ink-subtle mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={LABEL_CLS}>Short benefit</label>
                  <input
                    value={toText(editing.short_benefit)}
                    onChange={(e) => setEditing({ ...editing, short_benefit: e.target.value })}
                    placeholder="e.g. Natural OvoShell membrane · Type I, V &amp; X collagen"
                    maxLength={120}
                    className={INPUT_CLS}
                  />
                  <p className="mt-1 text-[13px] text-ink-subtle">
                    One line shown on product cards and as the headline on the product page.
                  </p>
                </div>
                <div>
                  <label className={LABEL_CLS}>Description</label>
                  <textarea value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                    placeholder="Detailed product description…" rows={4}
                    className={INPUT_CLS + ' resize-none'} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={LABEL_CLS}>Benefits</label>
                    <textarea value={editing.benefits ?? ''} onChange={(e) => setEditing({ ...editing, benefits: e.target.value })}
                      placeholder="Key benefits…" rows={3} className={INPUT_CLS + ' resize-none'} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Ingredients</label>
                    <textarea value={editing.ingredients ?? ''} onChange={(e) => setEditing({ ...editing, ingredients: e.target.value })}
                      placeholder="Ingredients list…" rows={3} className={INPUT_CLS + ' resize-none'} />
                  </div>
                </div>
              </div>

              {/* Product Media */}
              <div className="rounded-lg border border-edge bg-white p-6 shadow-card">
                <div className="mb-4">
                  <p className="text-sm font-semibold text-ink-primary">Product Media</p>
                  <p className="text-sm text-ink-subtle mt-0.5">Upload images/videos or add URLs. Drag to reorder. First item is the cover.</p>
                </div>
                <MediaEditor media={editing._media || []} onChange={setMedia} authFetch={authFetch} />
              </div>

              {/* Options & Variants */}
              {isVariable && (
                <div className="rounded-lg border border-edge bg-white p-6 shadow-card">
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-ink-primary">Product Options &amp; Variants</p>
                    <p className="text-sm text-ink-subtle mt-0.5">Define up to 3 option types. Combinations are generated automatically.</p>
                  </div>
                  <VariantsEditor editing={editing} onChange={setEditing} media={editing._media || []} />
                </div>
              )}

              {/* Base price — drives automatic pricing in markets with no explicit price */}
              <div className="rounded-lg border border-edge bg-white p-6 shadow-card space-y-3">
                <div>
                  <p className="text-sm font-semibold text-ink-primary">Base price (GBP)</p>
                  <p className="text-sm text-ink-subtle mt-0.5">
                    Markets with automatic pricing convert this into their own currency. A price set
                    for a specific market below always wins. Leave empty to sell only where you set
                    a price explicitly.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink-muted">£</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editing.base_price ?? ''}
                    onChange={(e) => setEditing({ ...editing, base_price: e.target.value === '' ? null : e.target.value })}
                    placeholder="e.g. 34.00"
                    className={INPUT_CLS + ' max-w-[200px]'}
                  />
                </div>
              </div>

              {/* Pricing & Stock */}
              <div className="rounded-lg border border-edge bg-white p-6 shadow-card space-y-4">
                <div>
                  <p className="text-sm font-semibold text-ink-primary">Regional Pricing &amp; Stock</p>
                  {isVariable ? (
                    <p className="text-sm text-amber-600 mt-1 font-medium">Variable product default regional presets. Individual pricing is managed under Variants.</p>
                  ) : (
                    <p className="text-sm text-ink-subtle mt-0.5">Set selling prices, promotional rates, and available inventory levels per region.</p>
                  )}
                </div>
                <div className="space-y-3">
                  {editing._regional.map((row, i) => (
                    <div key={row.region} className="rounded-md border border-edge p-4 bg-surface-subtle space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-ink-primary uppercase tracking-wider">{row.code} Region</span>
                        <label className="flex items-center gap-1.5 text-sm text-ink-secondary cursor-pointer font-medium">
                          <input type="checkbox" checked={row.is_visible}
                            onChange={(e) => setRegional(i, { is_visible: e.target.checked })} className="accent-ink-primary" />
                          Visible
                        </label>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className={LABEL_CLS}>Price</label>
                          <input value={row.price} onChange={(e) => setRegional(i, { price: e.target.value })}
                            placeholder="0.00" className={INPUT_CLS} />
                        </div>
                        <div>
                          <label className={LABEL_CLS}>Promo Price</label>
                          <input value={row.promotional_price} onChange={(e) => setRegional(i, { promotional_price: e.target.value })}
                            placeholder="0.00" className={INPUT_CLS} />
                        </div>
                        <div>
                          <label className={LABEL_CLS}>Stock (units)</label>
                          <input value={row.available} onChange={(e) => setRegional(i, { available: e.target.value })}
                            type="number" placeholder="0" className={INPUT_CLS} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Specifications & Attributes */}
              <div className="rounded-lg border border-edge bg-white p-6 shadow-card">
                <AttributesEditor editing={editing} onChange={setEditing} />
              </div>

              {/* FAQ Editor */}
              <div className="rounded-lg border border-edge bg-white p-6 shadow-card space-y-4">
                <div className="flex items-center justify-between border-b border-edge-subtle pb-3">
                  <div>
                    <p className="text-sm font-semibold text-ink-primary">Product FAQs</p>
                    <p className="text-sm text-ink-subtle mt-0.5">Add common questions and answers specific to this product.</p>
                  </div>
                  <button onClick={() => setEditing({ ...editing, faq: [...(editing.faq || []), { q: '', a: '' }] })} type="button"
                    className="inline-flex items-center gap-1 rounded-sm border border-edge px-3 py-1.5 text-sm font-semibold text-ink-secondary hover:bg-surface-muted transition">
                    <Plus className="h-3.5 w-3.5" /> Add FAQ
                  </button>
                </div>
                <div className="space-y-3">
                  {(editing.faq || []).map((faq, i) => (
                    <div key={i} className="rounded-md border border-edge p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <input value={faq.q} onChange={(e) => { const f = [...editing.faq]; f[i] = { ...f[i], q: e.target.value }; setEditing({ ...editing, faq: f }); }}
                          placeholder="Question" className="flex-1 rounded-sm border border-edge px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-edge-focus/30" />
                        <button onClick={() => setEditing({ ...editing, faq: editing.faq.filter((_, x) => x !== i) })} type="button"
                          className="text-ink-subtle hover:text-ink-danger transition">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <textarea value={faq.a} onChange={(e) => { const f = [...editing.faq]; f[i] = { ...f[i], a: e.target.value }; setEditing({ ...editing, faq: f }); }}
                        placeholder="Answer" rows={2}
                        className="w-full rounded-sm border border-edge px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-edge-focus/30" />
                    </div>
                  ))}
                  {!(editing.faq || []).length && <p className="text-sm text-ink-subtle">No FAQs added yet.</p>}
                </div>
              </div>

            </div>

            {/* Sidebar Column */}
            <div className="space-y-6">
              
              {/* Product Status & Visibility */}
              <div className="rounded-lg border border-edge bg-white p-6 shadow-card space-y-4">
                <p className="text-sm font-semibold text-ink-primary border-b border-edge-subtle pb-3">Product Status</p>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div onClick={() => setEditing({ ...editing, is_active: !editing.is_active })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${editing.is_active ? 'bg-ink-primary' : 'bg-edge'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${editing.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink-secondary">{editing.is_active ? 'Active' : 'Draft'}</p>
                    <p className="text-sm text-ink-subtle">{editing.is_active ? 'Visible in storefront' : 'Hidden from storefront'}</p>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <div onClick={() => setEditing({ ...editing, is_archived: !editing.is_archived })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${editing.is_archived ? 'bg-brand-accent' : 'bg-edge'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${editing.is_archived ? 'translate-x-6' : 'translate-x-1'}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink-secondary">{editing.is_archived ? 'Archived' : 'Not Archived'}</p>
                    <p className="text-sm text-ink-subtle">Archived products are hidden from all views</p>
                  </div>
                </label>
              </div>

              {/* Collections */}
              <div className="rounded-lg border border-edge bg-white p-6 shadow-card">
                <p className="text-sm font-semibold text-ink-primary mb-3">Collections / Categories</p>
                <div className="flex flex-wrap gap-2">
                  {categories.map(c => {
                    const on = editing._categories.includes(c.id);
                    return (
                      <button key={c.id} type="button"
                        onClick={() => setEditing({ ...editing, _categories: on ? editing._categories.filter(x => x !== c.id) : [...editing._categories, c.id] })}
                        className={`rounded-sm border px-3 py-1 text-sm font-medium transition
                          ${on ? 'border-ink-primary bg-surface-muted text-ink-primary' : 'border-edge bg-white text-ink-secondary hover:border-edge-strong'}`}>
                        {c.name}
                      </button>
                    );
                  })}
                  {categories.length === 0 && <p className="text-sm text-ink-subtle">No collections defined yet.</p>}
                </div>
              </div>

            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
