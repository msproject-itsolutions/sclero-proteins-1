'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Plus, Minus, Search, User, UserPlus, Package, ShoppingCart,
  ChevronRight, ChevronDown, Truck, Tag, FileText, DollarSign,
  AlertCircle, Check, Loader2, ChevronLeft, Save, Eye
} from 'lucide-react';

const LABEL_CLS = 'block text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1';
const INPUT_CLS = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition';

const STEPS = [
  { id: 'customer', label: 'Customer', icon: User },
  { id: 'items',    label: 'Products', icon: Package },
  { id: 'shipping', label: 'Shipping', icon: Truck },
  { id: 'review',   label: 'Review',   icon: Eye },
];

export default function CreateOrderPanel({ authFetch, onClose, onCreated }) {
  const [step, setStep] = useState('customer');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  /* ── Customer ── */
  const [customerMode, setCustomerMode] = useState('search'); // search | new
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [newCustomer, setNewCustomer] = useState({ first_name: '', last_name: '', email: '', phone_number: '' });

  /* ── Products ── */
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [productLoading, setProductLoading] = useState(false);
  const [lineItems, setLineItems] = useState([]);

  /* ── Shipping & extras ── */
  const [shipping, setShipping] = useState({
    name: '', address_line1: '', address_line2: '', city: '', state: '', postal_code: '', country: 'GB',
  });
  const [shippingCost, setShippingCost] = useState('0');
  const [discountCode, setDiscountCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [discountType, setDiscountType] = useState('flat'); // flat | percent
  const [taxRate, setTaxRate] = useState('20');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('COD');
  const [region, setRegion] = useState('GB');
  const [isDraft, setIsDraft] = useState(false);

  /* ── Customer search ── */
  const searchCustomers = useCallback((q) => {
    if (!q.trim()) { setCustomerResults([]); return; }
    setCustomerLoading(true);
    authFetch(`/api/admin/customers/?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(d => setCustomerResults(Array.isArray(d) ? d : d.results || []))
      .catch(() => setCustomerResults([]))
      .finally(() => setCustomerLoading(false));
  }, [authFetch]);

  useEffect(() => {
    const t = setTimeout(() => searchCustomers(customerSearch), 300);
    return () => clearTimeout(t);
  }, [customerSearch, searchCustomers]);

  /* ── Product search ── */
  const searchProducts = useCallback((q) => {
    if (!q.trim()) { setProductResults([]); return; }
    setProductLoading(true);
    authFetch(`/api/admin/products/?search=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(d => setProductResults(Array.isArray(d) ? d : d.results || []))
      .catch(() => setProductResults([]))
      .finally(() => setProductLoading(false));
  }, [authFetch]);

  useEffect(() => {
    const t = setTimeout(() => searchProducts(productSearch), 300);
    return () => clearTimeout(t);
  }, [productSearch, searchProducts]);

  /* ── Line item helpers ── */
  const addProduct = (p) => {
    const exists = lineItems.findIndex(l => l.sku === p.sku);
    if (exists >= 0) {
      const items = [...lineItems]; items[exists].quantity += 1; setLineItems(items);
    } else {
      // Pick first regional price
      const price = p.regional_configs?.[0]?.promotional_price || p.regional_configs?.[0]?.price || '0';
      setLineItems([...lineItems, { sku: p.sku, name: p.name, price, quantity: 1, product: p }]);
    }
    setProductSearch('');
    setProductResults([]);
  };
  const removeItem = (i) => setLineItems(lineItems.filter((_, x) => x !== i));
  const updateQty = (i, delta) => {
    const items = [...lineItems]; items[i].quantity = Math.max(1, (items[i].quantity || 1) + delta); setLineItems(items);
  };
  const updatePrice = (i, price) => { const items = [...lineItems]; items[i].price = price; setLineItems(items); };

  /* ── Totals ── */
  const subtotal = lineItems.reduce((s, l) => s + Number(l.price || 0) * Number(l.quantity || 1), 0);
  const discountValue = discountType === 'percent'
    ? subtotal * (Number(discountAmount) / 100)
    : Number(discountAmount);
  const afterDiscount = Math.max(0, subtotal - discountValue);
  const taxValue = afterDiscount * (Number(taxRate) / 100);
  const total = afterDiscount + taxValue + Number(shippingCost || 0);

  /* ── Navigation ── */
  const stepIdx = STEPS.findIndex(s => s.id === step);
  const canNext = {
    customer: selectedCustomer !== null || (customerMode === 'new' && newCustomer.email),
    items: lineItems.length > 0,
    shipping: true,
    review: true,
  };

  const next = () => { if (stepIdx < STEPS.length - 1) setStep(STEPS[stepIdx + 1].id); };
  const prev = () => { if (stepIdx > 0) setStep(STEPS[stepIdx - 1].id); };

  /* ── Auto-fill shipping from selected customer ── */
  useEffect(() => {
    if (selectedCustomer) {
      setShipping(s => ({
        ...s,
        name: `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim(),
      }));
    }
  }, [selectedCustomer]);

  /* ── Create order ── */
  const handleCreate = async () => {
    setSaving(true); setErr('');
    try {
      let customerId = selectedCustomer?.id;

      // Create new customer if needed
      if (customerMode === 'new' && !customerId) {
        const r = await authFetch('/api/admin/customers/', { method: 'POST', body: JSON.stringify(newCustomer) });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || JSON.stringify(d));
        customerId = d.id;
      }

      const payload = {
        customer: customerId,
        email: selectedCustomer?.email || newCustomer.email,
        items: lineItems.map(l => ({ product_sku: l.sku, quantity: l.quantity, price: l.price })),
        shipping_name: shipping.name,
        shipping_address_line1: shipping.address_line1,
        shipping_address_line2: shipping.address_line2,
        shipping_city: shipping.city,
        shipping_state: shipping.state,
        shipping_postal_code: shipping.postal_code,
        shipping_country: shipping.country,
        shipping_cost: shippingCost,
        discount_code: discountCode || undefined,
        discount_amount: discountValue.toFixed(2),
        tax_rate: taxRate,
        tax_amount: taxValue.toFixed(2),
        subtotal: subtotal.toFixed(2),
        total: total.toFixed(2),
        notes,
        payment_method: paymentMethod,
        region_code: region,
        status: isDraft ? 'PENDING' : 'PROCESSING',
        currency_code: 'GBP',
      };

      const r = await authFetch('/api/admin/orders/', { method: 'POST', body: JSON.stringify(payload) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || JSON.stringify(d));
      onCreated?.(d);
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const activeCustomer = selectedCustomer || (customerMode === 'new' ? newCustomer : null);

  return (
    <div className="fixed inset-y-0 right-0 left-0 md:left-[280px] lg:left-[288px] top-0 md:top-[65px] z-30 bg-slate-50 overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} type="button"
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 transition">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-xs font-semibold uppercase text-slate-400 tracking-wide">Orders</p>
            <h2 className="text-base font-black text-slate-800">Create Order</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input type="checkbox" checked={isDraft} onChange={(e) => setIsDraft(e.target.checked)} className="accent-violet-600" />
            Save as Draft
          </label>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center border-b border-slate-200 bg-white px-4 sm:px-6 flex-shrink-0 overflow-x-auto">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = s.id === step;
          const done = i < stepIdx;
          return (
            <button key={s.id} onClick={() => setStep(s.id)} type="button"
              className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition
                ${active ? 'border-violet-600 text-violet-700' : done ? 'border-transparent text-emerald-600' : 'border-transparent text-slate-400'}`}>
              {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              {s.label}
              {i < STEPS.length - 1 && <ChevronRight className="h-3.5 w-3.5 text-slate-300 ml-1" />}
            </button>
          );
        })}
      </div>

      {err && (
        <div className="flex items-center gap-2 border-b border-red-200 bg-red-50 px-6 py-2.5 flex-shrink-0">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
          <p className="text-xs text-red-700 font-medium">{err}</p>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 space-y-5">

          {/* ── STEP: Customer ── */}
          {step === 'customer' && (
            <div className="space-y-4">
              <div className="flex rounded-xl border border-slate-200 bg-white p-1 gap-1">
                {[{ id: 'search', label: 'Existing Customer', icon: Search },
                  { id: 'new',    label: 'New Customer',      icon: UserPlus }].map(m => (
                  <button key={m.id} onClick={() => { setCustomerMode(m.id); setSelectedCustomer(null); }} type="button"
                    className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition
                      ${customerMode === m.id ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}>
                    <m.icon className="h-4 w-4" /> {m.label}
                  </button>
                ))}
              </div>

              {customerMode === 'search' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}
                      placeholder="Search by name or email…"
                      className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400" />
                    {customerLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-500 animate-spin" />}
                  </div>

                  {selectedCustomer && (
                    <div className="flex items-center justify-between rounded-xl bg-violet-50 border border-violet-200 p-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-200 text-violet-700 font-bold text-sm">
                          {(selectedCustomer.first_name?.[0] || selectedCustomer.email?.[0] || '?').toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{selectedCustomer.first_name} {selectedCustomer.last_name}</p>
                          <p className="text-xs text-slate-500">{selectedCustomer.email}</p>
                        </div>
                      </div>
                      <button onClick={() => setSelectedCustomer(null)} type="button" className="text-slate-400 hover:text-red-500 transition">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}

                  {!selectedCustomer && customerResults.length > 0 && (
                    <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                      {customerResults.slice(0, 6).map(c => (
                        <button key={c.id} onClick={() => { setSelectedCustomer(c); setCustomerResults([]); }} type="button"
                          className="flex w-full items-center gap-3 px-4 py-3 hover:bg-slate-50 transition text-left">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 font-bold text-sm">
                            {(c.first_name?.[0] || c.email?.[0] || '?').toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{c.first_name} {c.last_name}</p>
                            <p className="text-xs text-slate-400">{c.email}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {!selectedCustomer && customerSearch && customerResults.length === 0 && !customerLoading && (
                    <p className="text-center text-sm text-slate-400 py-4">No customers found. Try a different search or create a new customer.</p>
                  )}
                </div>
              )}

              {customerMode === 'new' && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                  <p className="text-sm font-bold text-slate-800">New Customer Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LABEL_CLS}>First Name</label>
                      <input value={newCustomer.first_name} onChange={e => setNewCustomer({ ...newCustomer, first_name: e.target.value })} className={INPUT_CLS} />
                    </div>
                    <div>
                      <label className={LABEL_CLS}>Last Name</label>
                      <input value={newCustomer.last_name} onChange={e => setNewCustomer({ ...newCustomer, last_name: e.target.value })} className={INPUT_CLS} />
                    </div>
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Email *</label>
                    <input type="email" value={newCustomer.email} onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })} className={INPUT_CLS} />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Phone</label>
                    <input value={newCustomer.phone_number} onChange={e => setNewCustomer({ ...newCustomer, phone_number: e.target.value })} className={INPUT_CLS} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP: Products ── */}
          {step === 'items' && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="Search products by name or SKU…"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400" />
                  {productLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-500 animate-spin" />}
                </div>
                {productResults.length > 0 && (
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                    {productResults.slice(0, 6).map(p => (
                      <button key={p.id} onClick={() => addProduct(p)} type="button"
                        className="flex w-full items-center gap-3 px-4 py-3 hover:bg-violet-50 transition text-left">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 overflow-hidden">
                          {p.media?.[0]?.file_url
                            ? <img src={p.media[0].file_url} alt="" className="h-full w-full object-cover" />
                            : <Package className="h-5 w-5 text-slate-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{p.name}</p>
                          <p className="text-xs text-slate-400 font-mono">{p.sku}</p>
                        </div>
                        <span className="text-xs font-bold text-violet-700">
                          {p.regional_configs?.[0]?.promotional_price || p.regional_configs?.[0]?.price || '—'}
                        </span>
                        <Plus className="h-4 w-4 text-violet-500 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Line items */}
              {lineItems.length > 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                  <div className="border-b border-slate-100 px-5 py-3 bg-slate-50">
                    <p className="text-xs font-bold uppercase text-slate-500 tracking-wide">{lineItems.length} item(s)</p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {lineItems.map((item, i) => (
                      <div key={i} className="flex items-center gap-3 px-5 py-4">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 overflow-hidden">
                          {item.product?.media?.[0]?.file_url
                            ? <img src={item.product.media[0].file_url} alt="" className="h-full w-full object-cover" />
                            : <Package className="h-5 w-5 text-slate-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
                          <p className="text-xs font-mono text-slate-400">{item.sku}</p>
                        </div>
                        {/* Price override */}
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-400">£</span>
                          <input value={item.price} onChange={e => updatePrice(i, e.target.value)}
                            className="w-20 rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400" />
                        </div>
                        {/* Qty */}
                        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50">
                          <button onClick={() => updateQty(i, -1)} type="button" className="px-2.5 py-1.5 text-slate-500 hover:text-slate-700 transition">
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="min-w-[24px] text-center text-sm font-bold text-slate-800">{item.quantity}</span>
                          <button onClick={() => updateQty(i, 1)} type="button" className="px-2.5 py-1.5 text-slate-500 hover:text-slate-700 transition">
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="w-16 text-right text-sm font-bold text-slate-800">
                          £{(Number(item.price || 0) * item.quantity).toFixed(2)}
                        </p>
                        <button onClick={() => removeItem(i)} type="button" className="text-slate-400 hover:text-red-500 transition">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-200 py-12">
                  <ShoppingCart className="h-8 w-8 text-slate-300" />
                  <p className="text-sm text-slate-400">Search for products above to add items</p>
                </div>
              )}
            </div>
          )}

          {/* ── STEP: Shipping ── */}
          {step === 'shipping' && (
            <div className="space-y-4">
              {/* Shipping address */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                <p className="text-sm font-bold text-slate-800">Shipping Address</p>
                <div>
                  <label className={LABEL_CLS}>Full Name</label>
                  <input value={shipping.name} onChange={e => setShipping({ ...shipping, name: e.target.value })} className={INPUT_CLS} placeholder="John Smith" />
                </div>
                <div>
                  <label className={LABEL_CLS}>Address Line 1</label>
                  <input value={shipping.address_line1} onChange={e => setShipping({ ...shipping, address_line1: e.target.value })} className={INPUT_CLS} placeholder="123 Main Street" />
                </div>
                <div>
                  <label className={LABEL_CLS}>Address Line 2</label>
                  <input value={shipping.address_line2} onChange={e => setShipping({ ...shipping, address_line2: e.target.value })} className={INPUT_CLS} placeholder="Apt, Suite, etc." />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLS}>City</label>
                    <input value={shipping.city} onChange={e => setShipping({ ...shipping, city: e.target.value })} className={INPUT_CLS} placeholder="London" />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>State / County</label>
                    <input value={shipping.state} onChange={e => setShipping({ ...shipping, state: e.target.value })} className={INPUT_CLS} placeholder="Greater London" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLS}>Postal Code</label>
                    <input value={shipping.postal_code} onChange={e => setShipping({ ...shipping, postal_code: e.target.value })} className={INPUT_CLS} placeholder="SW1A 1AA" />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Country</label>
                    <select value={shipping.country} onChange={e => setShipping({ ...shipping, country: e.target.value })} className={INPUT_CLS}>
                      {[['GB','United Kingdom'],['IN','India'],['US','United States'],['AU','Australia'],['CA','Canada'],['DE','Germany'],['FR','France']].map(([v, l]) =>
                        <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Charges */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                <p className="text-sm font-bold text-slate-800">Charges &amp; Discounts</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLS}>Shipping Cost (£)</label>
                    <input value={shippingCost} onChange={e => setShippingCost(e.target.value)} type="number" step="0.01" className={INPUT_CLS} placeholder="0.00" />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Tax Rate (%)</label>
                    <input value={taxRate} onChange={e => setTaxRate(e.target.value)} type="number" step="0.1" className={INPUT_CLS} placeholder="20" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className={LABEL_CLS}>Discount</label>
                    <input value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} type="number" step="0.01" className={INPUT_CLS} placeholder="0.00" />
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Type</label>
                    <select value={discountType} onChange={e => setDiscountType(e.target.value)} className={INPUT_CLS}>
                      <option value="flat">Fixed (£)</option>
                      <option value="percent">Percent (%)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className={LABEL_CLS}>Discount Code (optional)</label>
                  <input value={discountCode} onChange={e => setDiscountCode(e.target.value)} className={INPUT_CLS} placeholder="SUMMER20" />
                </div>
              </div>

              {/* Payment & notes */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                <p className="text-sm font-bold text-slate-800">Payment &amp; Notes</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={LABEL_CLS}>Payment Method</label>
                    <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className={INPUT_CLS}>
                      {['COD','Stripe','Razorpay','Bank Transfer','PayPal','BACS'].map(m =>
                        <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL_CLS}>Region</label>
                    <select value={region} onChange={e => setRegion(e.target.value)} className={INPUT_CLS}>
                      {[['GB','GB – United Kingdom'],['IN','IN – India'],['US','US – United States'],['AU','AU – Australia']].map(([v,l]) =>
                        <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={LABEL_CLS}>Staff Notes (internal)</label>
                  <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                    placeholder="Internal notes about this order…" className={INPUT_CLS + ' resize-none'} />
                </div>
              </div>
            </div>
          )}

          {/* ── STEP: Review ── */}
          {step === 'review' && (
            <div className="space-y-4">
              {/* Customer summary */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase text-slate-400 tracking-wide mb-3">Customer</p>
                {selectedCustomer ? (
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-100 text-violet-700 font-bold">
                      {(selectedCustomer.first_name?.[0] || selectedCustomer.email?.[0] || '?').toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{selectedCustomer.first_name} {selectedCustomer.last_name}</p>
                      <p className="text-xs text-slate-500">{selectedCustomer.email}</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-semibold text-slate-800">{newCustomer.first_name} {newCustomer.last_name}</p>
                    <p className="text-xs text-slate-500">{newCustomer.email} · New customer will be created</p>
                  </div>
                )}
              </div>

              {/* Items summary */}
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="border-b border-slate-100 px-5 py-3 bg-slate-50">
                  <p className="text-xs font-bold uppercase text-slate-400 tracking-wide">Order Items</p>
                </div>
                <div className="divide-y divide-slate-100">
                  {lineItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{item.name}</p>
                        <p className="text-xs text-slate-400">{item.quantity} × £{Number(item.price).toFixed(2)}</p>
                      </div>
                      <p className="text-sm font-bold text-slate-800">£{(Number(item.price) * item.quantity).toFixed(2)}</p>
                    </div>
                  ))}
                </div>

                {/* Totals */}
                <div className="border-t border-slate-200 bg-slate-50 px-5 py-4 space-y-1.5">
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Subtotal</span><span>£{subtotal.toFixed(2)}</span>
                  </div>
                  {discountValue > 0 && (
                    <div className="flex justify-between text-sm text-emerald-600">
                      <span>Discount {discountCode ? `(${discountCode})` : ''}</span>
                      <span>−£{discountValue.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Tax ({taxRate}%)</span><span>£{taxValue.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Shipping</span><span>£{Number(shippingCost).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-black text-slate-900">
                    <span>Total</span><span>£{total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Shipping address */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase text-slate-400 tracking-wide mb-2">Shipping Address</p>
                <p className="text-sm text-slate-700">
                  {shipping.name}<br />
                  {shipping.address_line1}{shipping.address_line2 ? `, ${shipping.address_line2}` : ''}<br />
                  {shipping.city}{shipping.state ? `, ${shipping.state}` : ''} {shipping.postal_code}<br />
                  {shipping.country}
                </p>
              </div>

              {/* Payment */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-bold uppercase text-slate-400 tracking-wide mb-2">Payment</p>
                <p className="text-sm font-semibold text-slate-700">{paymentMethod} · Region: {region}</p>
                {notes && <p className="mt-2 text-xs text-slate-500 italic">Note: {notes}</p>}
              </div>

              {isDraft && (
                <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 p-4">
                  <FileText className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  <p className="text-sm text-amber-700">This will be saved as a <strong>draft</strong> order (status: PENDING). You can confirm it later.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer nav */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6 flex-shrink-0">
        <button onClick={prev} disabled={stepIdx === 0} type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>

        {/* Live total pill */}
        {lineItems.length > 0 && (
          <div className="hidden sm:flex items-center gap-2 rounded-full bg-slate-100 px-4 py-1.5">
            <ShoppingCart className="h-3.5 w-3.5 text-slate-500" />
            <span className="text-sm font-bold text-slate-700">{lineItems.reduce((s, l) => s + l.quantity, 0)} items · £{total.toFixed(2)}</span>
          </div>
        )}

        {step !== 'review' ? (
          <button onClick={next} disabled={!canNext[step]} type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
            Continue <ChevronRight className="h-4 w-4" />
          </button>
        ) : (
          <button onClick={handleCreate} disabled={saving} type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60 transition shadow-sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {saving ? 'Creating…' : isDraft ? 'Save Draft' : 'Create Order'}
          </button>
        )}
      </div>
    </div>
  );
}
