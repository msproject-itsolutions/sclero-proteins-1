'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Link from 'next/link';
import {
  LayoutDashboard, Package, Layers, ShoppingCart, Truck, Plus, Pencil, Archive, X, Save,
  ShieldAlert, ShieldCheck, CreditCard, ShoppingBag, Image as ImageIcon, Film, Download, Printer,
  Home, ChevronRight, TrendingUp, Users as UsersIcon, Search,
  Banknote, ReceiptText, MessageSquare, Activity, CheckCircle2, UserRound,
  FileText, BarChart3, HelpCircle, RefreshCw, Sliders, UserPlus, Eye, Settings, Trash2,
  Star, Palette, Cookie, Menu as MenuIcon, Upload, Undo, Link as LinkIcon, Loader2, AlertCircle, ToggleLeft, ToggleRight, BookOpen, Bell
} from 'lucide-react';
import StoreShell from '../../components/StoreShell';
import { fetchProfile } from '../../store/authSlice';
import { getApiUrl } from '../../lib/api';
import { authenticatedFetch } from '../../lib/authFetch';
import { DEFAULT_HOMEPAGE_SETTINGS, normalizeHomepageSettings } from '../../lib/homepageContent';
import { csvCell } from '../../lib/csv';
import ProductEditorPanel from '../../components/admin/ProductEditorPanel';
import CreateOrderPanel from '../../components/admin/CreateOrderPanel';
import ShippingZonePanel from '../../components/admin/ShippingZonePanel';
import MarketsPanel from '../../components/admin/MarketsPanel';
import PasswordInput from '../../components/PasswordInput';

// Hero banner upload sizes. These mirror the <picture> breakpoints and section
// heights in components/HeroSection.jsx (640px / 1024px; 420/480/540px tall),
// doubled for retina. If that component's breakpoints change, change these too.
const BANNER_SPECS = [
  { slot: 'Desktop', size: '2560 × 1080', when: 'above 1024 px' },
  { slot: 'Tablet', size: '2048 × 960', when: '641 – 1024 px' },
  { slot: 'Mobile', size: '1280 × 840', when: 'up to 640 px' },
];

const ORDER_STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED'];
const STATUS_COLOR = {
  PENDING: 'bg-amber-50 text-amber-800 border border-amber-200',
  PROCESSING: 'bg-blue-50 text-blue-700 border border-blue-200',
  SHIPPED: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  DELIVERED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  COMPLETED: 'bg-brand-success/10 text-ink-success border border-brand-success/20',
  CANCELLED: 'bg-slate-50 text-slate-600 border border-slate-200',
  REFUNDED: 'bg-rose-50 text-rose-700 border border-rose-200',
};
const PAYMENT_STATUS_COLOR = {
  PENDING: 'bg-amber-50 text-amber-800 border border-amber-200',
  AUTHORIZED: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
  PARTIALLY_CAPTURED: 'bg-blue-50 text-blue-700 border border-blue-200',
  PAID: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  FAILED: 'bg-rose-50 text-rose-700 border border-rose-200',
  REFUNDED: 'bg-slate-50 text-slate-600 border border-slate-200',
};
const RECOVERY_STATUS_COLOR = {
  NOT_CONTACTED: 'bg-surface-muted text-ink-secondary',
  CONTACTED: 'bg-blue-50 text-blue-700',
  RECOVERED: 'bg-brand-success/10 text-ink-success',
  DISMISSED: 'bg-edge text-ink-secondary',
};
const orderStatusLabel = (status) => status === 'COMPLETED' ? 'Order received' : status;

const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : '—');
const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : '—');
const formatMoney = (currency, value) => `${currency || 'GBP'} ${Number(value || 0).toFixed(2)}`;
const normalize = (value) => String(value || '').toLowerCase();
const toDisplayText = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(toDisplayText).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    return (
      value.title ||
      value.name ||
      value.label ||
      value.handle ||
      value.slug ||
      value.description ||
      value.url ||
      ''
    );
  }
  return '';
};
const toSeoMeta = (value) => ({
  title: toDisplayText(value?.title),
  description: toDisplayText(value?.description),
  handle: toDisplayText(value?.handle),
});
async function uploadAdminMedia(authFetch, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await authFetch('/api/admin/upload-media/', { method: 'POST', body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.file_url) {
    throw new Error(data.error || 'Upload failed.');
  }
  return data.file_url;
}

function useAuthFetch() {
  return useCallback(
    (path, opts = {}) => {
      const headers = {
        ...(opts.headers || {}),
      };
      if (!(opts.body instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
      return authenticatedFetch(path, {
        ...opts,
        headers,
      });
    },
    []
  );
}

/* --------------------------------------------------------- chart primitive */
function MiniBars({ series, height = 120 }) {
  const max = Math.max(1, ...series.map((s) => s.value));
  const barW = 100 / (series.length || 1);
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full text-ink-accent" style={{ height }}>
      {series.map((s, i) => {
        const h = (s.value / max) * (height - 18);
        return (
          <g key={i}>
            <rect x={i * barW + barW * 0.18} y={height - 16 - h} width={barW * 0.64} height={Math.max(h, s.value > 0 ? 2 : 0)}
              rx="1.2" fill="currentColor" opacity={s.value > 0 ? 0.85 : 0.12} />
          </g>
        );
      })}
    </svg>
  );
}

function StatCard({ icon: Icon, label, value, sub, accent, onClick }) {
  return (
    <button onClick={onClick} disabled={!onClick}
      className={`rounded-md border border-edge bg-white shadow-card p-5 text-left transition-all ${onClick ? 'hover:-translate-y-0.5 hover:shadow-elevated' : ''}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className={`flex h-9 w-9 items-center justify-center rounded-md ${accent || 'bg-surface-muted text-ink-accent'}`}>
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
      <p className="font-display text-[28px] font-medium leading-none text-ink-primary">{value}</p>
      <p className="kicker mt-2">{label}</p>
      {sub && <p className="mt-0.5 text-[13px] text-ink-subtle">{sub}</p>}
    </button>
  );
}

/* ---------------------------------------------- Phase C extras: home widgets */
function RevenueTrendCard({ authFetch }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    authFetch('/api/admin/reports/revenue-trend/?days=90')
      .then((r) => r.json()).then(setData).catch(() => setErr(true));
  }, [authFetch]);
  if (err) return <div className="rounded-lg border border-edge bg-white shadow-card p-5 text-sm text-brand-muted">Revenue trend unavailable.</div>;
  if (!data) return <div className="rounded-lg border border-edge bg-white shadow-card p-5"><div className="h-6 w-40 mb-3 rounded bg-surface-muted animate-pulse" /><div className="h-28 rounded bg-surface-muted animate-pulse" /></div>;
  // bucket by currency
  const byCcy = {};
  data.forEach((p) => {
    if (!byCcy[p.currency]) byCcy[p.currency] = {};
    byCcy[p.currency][p.date] = (byCcy[p.currency][p.date] || 0) + p.revenue;
  });
  const days = [];
  const today = new Date();
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const currencies = Object.keys(byCcy).length ? Object.keys(byCcy) : ['GBP', 'INR'];
  return (
    <div className="rounded-lg border border-edge bg-white shadow-card p-5 lg:col-span-2">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-primary">Revenue trend</h3>
        <span className="text-[13px] font-medium text-brand-muted">Last 90 days</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {currencies.map((ccy) => {
          const series = days.map((k, i) => ({ key: k, label: i, value: (byCcy[ccy] || {})[k] || 0 }));
          const total = series.reduce((a, s) => a + s.value, 0);
          return (
            <div key={ccy}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[13px] font-semibold uppercase tracking-wider text-brand-muted">{ccy}</span>
                <span className="text-sm font-semibold text-ink-primary">{ccy} {total.toFixed(0)}</span>
              </div>
              <MiniBars series={series} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FunnelCard({ authFetch }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    authFetch('/api/admin/reports/conversion-funnel/?days=30').then((r) => r.json()).then(setData).catch(() => setData({}));
  }, [authFetch]);
  if (!data) return <div className="rounded-lg border border-edge bg-white shadow-card p-5"><div className="h-32 rounded bg-surface-muted animate-pulse" /></div>;
  const stages = [
    { k: 'pageviews', label: 'Page views' },
    { k: 'product_views', label: 'Product views' },
    { k: 'add_to_carts', label: 'Add to carts' },
    { k: 'checkouts', label: 'Checkouts' },
    { k: 'orders', label: 'Orders' },
  ];
  const max = Math.max(1, data.pageviews || 0);
  return (
    <div className="rounded-lg border border-edge bg-white shadow-card p-5">
      <h3 className="mb-3 text-sm font-semibold text-ink-primary">Conversion funnel</h3>
      {(!data.pageviews && !data.orders) ? <p className="text-sm text-brand-muted">No traffic recorded yet (last 30 days).</p> : (
        <div className="space-y-2">
          {stages.map((s, idx) => {
            const v = Number(data[s.k] || 0);
            const w = Math.max(2, (v / max) * 100);
            const prev = idx > 0 ? Number(data[stages[idx - 1].k] || 0) : 0;
            const pct = idx > 0 && prev > 0 ? Math.round((v / prev) * 100) : null;
            return (
              <div key={s.k}>
                <div className="flex items-center justify-between text-[13px] font-medium text-brand-muted">
                  <span>{s.label}{pct != null && <span className="ml-1 text-ink-subtle">({pct}%)</span>}</span>
                  <span className="text-ink-primary">{v}</span>
                </div>
                <div className="h-2 rounded bg-surface-muted">
                  <div className="h-2 rounded bg-ink-primary" style={{ width: `${w}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TopCustomersCard({ authFetch }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    authFetch('/api/admin/reports/clv/?days=365').then((r) => r.json()).then((d) => setRows(Array.isArray(d) ? d.slice(0, 5) : [])).catch(() => setRows([]));
  }, [authFetch]);
  if (rows === null) return <div className="rounded-lg border border-edge bg-white shadow-card p-5"><div className="h-28 rounded bg-surface-muted animate-pulse" /></div>;
  return (
    <div className="rounded-lg border border-edge bg-white shadow-card p-5">
      <h3 className="mb-3 text-sm font-semibold text-ink-primary">Top customers (CLV)</h3>
      {rows.length === 0 ? <p className="text-sm text-brand-muted">No paid orders yet.</p> : (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.email + r.currency} className="flex items-center justify-between text-sm">
              <span className="truncate font-medium text-ink-primary" title={r.email}>{r.email.length > 24 ? r.email.slice(0, 22) + '…' : r.email}</span>
              <span className="flex items-center gap-2">
                <span className="text-brand-muted">{r.orders}x</span>
                <span className="font-semibold text-ink-primary">{r.currency} {Number(r.total_spend).toFixed(0)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TopProductsCard({ authFetch }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    authFetch('/api/admin/reports/revenue-by-product/?days=90').then((r) => r.json()).then((d) => setRows(Array.isArray(d) ? d.slice(0, 5) : [])).catch(() => setRows([]));
  }, [authFetch]);
  if (rows === null) return <div className="rounded-lg border border-edge bg-white shadow-card p-5"><div className="h-28 rounded bg-surface-muted animate-pulse" /></div>;
  return (
    <div className="rounded-lg border border-edge bg-white shadow-card p-5">
      <h3 className="mb-3 text-sm font-semibold text-ink-primary">Top products (revenue)</h3>
      {rows.length === 0 ? <p className="text-sm text-brand-muted">No sales recorded.</p> : (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={`${r.product_id}-${r.currency}`} className="flex items-center justify-between text-sm">
              <span className="truncate font-medium text-ink-primary" title={r.name}>{(r.name || r.sku || '').slice(0, 28)}</span>
              <span className="flex items-center gap-2">
                <span className="text-brand-muted">{r.units_sold}u</span>
                <span className="font-semibold text-ink-primary">{r.currency} {Number(r.revenue).toFixed(0)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function ReportsTab({ authFetch, initialTab }) {
  const [tab, setTab] = useState(initialTab || 'sales');
  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);
  const [days, setDays] = useState(90);
  const [region, setRegion] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const endpointFor = (t) => ({
    sales: '/api/admin/reports/sales-by-country/',
    clv: '/api/admin/reports/clv/',
    repeat: '/api/admin/reports/repeat-cohort/',
    products: '/api/admin/reports/revenue-by-product/',
    abandoned: '/api/admin/reports/abandoned-conversion/',
  }[t]);

  const csvNameFor = (t) => ({
    sales: 'sales-by-country',
    clv: 'clv',
    repeat: 'repeat-cohort',
    products: 'revenue-by-product',
    abandoned: 'abandoned-conversion',
  }[t]);

  const qs = `?days=${days}&region=${region}`;

  useEffect(() => {
    setLoading(true);
    setData(null);
    authFetch(`${endpointFor(tab)}${qs}`).then((r) => r.json()).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [tab, days, region, authFetch]);

  const downloadCsv = async () => {
    try {
      const res = await authFetch(`${endpointFor(tab)}${qs}&export=csv`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        alert(errJson.detail || 'Failed to download CSV report.');
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sclero-${csvNameFor(tab)}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Could not export CSV file.');
    }
  };

  const TABS = [
    { k: 'sales', label: 'Sales by country' },
    { k: 'clv', label: 'CLV' },
    { k: 'repeat', label: 'Repeat customers' },
    { k: 'products', label: 'Revenue by product' },
    { k: 'abandoned', label: 'Abandoned recovery' },
  ];

  const renderTable = () => {
    if (loading) return <div className="h-40 rounded bg-surface-muted animate-pulse" />;
    if (!data) return <p className="text-sm text-brand-muted">No data.</p>;

    if (tab === 'repeat') {
      return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-md border border-edge bg-surface-muted p-3">
            <p className="kicker">Repeat rate</p>
            <p className="text-2xl font-semibold text-ink-primary">{Math.round((data.repeat_rate || 0) * 100)}%</p>
          </div>
          <div className="rounded-md border border-edge bg-surface-muted p-3">
            <p className="kicker">One-time</p>
            <p className="text-2xl font-semibold text-ink-primary">{data.one_time}</p>
          </div>
          <div className="rounded-md border border-edge bg-surface-muted p-3">
            <p className="kicker">Repeat</p>
            <p className="text-2xl font-semibold text-ink-primary">{data.repeat}</p>
          </div>
          <div className="rounded-md border border-edge bg-surface-muted p-3">
            <p className="kicker">3+ orders</p>
            <p className="text-2xl font-semibold text-ink-primary">{data.three_plus}</p>
          </div>
        </div>
      );
    }
    if (tab === 'abandoned') {
      return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-md border border-edge bg-surface-muted p-3"><p className="kicker">Carts</p><p className="text-2xl font-semibold text-ink-primary">{data.total_carts_with_items}</p></div>
          <div className="rounded-md border border-edge bg-surface-muted p-3"><p className="kicker">Recovered</p><p className="text-2xl font-semibold text-ink-primary">{data.recovered}</p></div>
          <div className="rounded-md border border-edge bg-surface-muted p-3"><p className="kicker">Abandoned</p><p className="text-2xl font-semibold text-ink-primary">{data.abandoned}</p></div>
          <div className="rounded-md border border-edge bg-surface-muted p-3"><p className="kicker">Recovery</p><p className="text-2xl font-semibold text-ink-primary">{Math.round((data.recovery_rate || 0) * 100)}%</p></div>
        </div>
      );
    }

    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) return <p className="text-sm text-brand-muted">No rows for this window.</p>;

    const headers = tab === 'sales'
      ? ['Country', 'Currency', 'Orders', 'Revenue']
      : tab === 'clv'
        ? ['Email', 'Currency', 'Orders', 'Spend', 'First', 'Last']
        : ['SKU', 'Name', 'Currency', 'Units', 'Revenue'];

    return (
      <div className="overflow-x-auto rounded-md border border-edge">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-[12px] font-medium uppercase tracking-wide text-ink-muted border-b border-edge">
            <tr>{headers.map((h) => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-edge-subtle">
                {tab === 'sales' && <>
                  <td className="px-3 py-2 font-mono">{r.country || '—'}</td>
                  <td className="px-3 py-2">{r.currency}</td>
                  <td className="px-3 py-2">{r.order_count}</td>
                  <td className="px-3 py-2 font-semibold">{r.currency} {Number(r.revenue).toFixed(2)}</td>
                </>}
                {tab === 'clv' && <>
                  <td className="px-3 py-2">{r.email}</td>
                  <td className="px-3 py-2">{r.currency}</td>
                  <td className="px-3 py-2">{r.orders}</td>
                  <td className="px-3 py-2 font-semibold">{r.currency} {Number(r.total_spend).toFixed(2)}</td>
                  <td className="px-3 py-2 text-ink-muted">{r.first_order ? r.first_order.slice(0, 10) : ''}</td>
                  <td className="px-3 py-2 text-ink-muted">{r.last_order ? r.last_order.slice(0, 10) : ''}</td>
                </>}
                {tab === 'products' && <>
                  <td className="px-3 py-2 font-mono">{r.sku}</td>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2">{r.currency}</td>
                  <td className="px-3 py-2">{r.units_sold}</td>
                  <td className="px-3 py-2 font-semibold">{r.currency} {Number(r.revenue).toFixed(2)}</td>
                </>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const canDownload = ['sales', 'clv', 'products'].includes(tab);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[13px] font-semibold text-brand-muted">Region</label>
        <select value={region} onChange={(e) => setRegion(e.target.value)} className="rounded-sm border border-edge px-2 py-1 text-sm">
          <option value="all">All</option>
          <option value="UK">UK</option>
          <option value="IN">IN</option>
        </select>
        <label className="text-[13px] font-semibold text-brand-muted ml-2">Days</label>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-sm border border-edge px-2 py-1 text-sm">
          {[7, 30, 90, 180, 365].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        {canDownload && (
          <button onClick={downloadCsv} className="ml-auto inline-flex items-center gap-1.5 rounded-sm border border-edge bg-white px-3 py-1.5 text-sm font-semibold text-ink-primary hover:border-edge-strong">
            <Download className="h-3.5 w-3.5" /> Download CSV
          </button>
        )}
      </div>
      <div className="rounded-lg border border-edge bg-white shadow-card p-5">{renderTable()}</div>
    </div>
  );
}

/* --------------------------------------------------------------------- Home */
function HomeTab({ authFetch, go }) {
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [abandoned, setAbandoned] = useState(0);

  useEffect(() => {
    authFetch('/api/admin/orders/stats/').then((r) => r.json()).then(setStats).catch(() => {});
    authFetch('/api/admin/orders/').then((r) => r.json()).then((d) => setOrders(Array.isArray(d) ? d : d.results || [])).catch(() => {});
    authFetch('/api/admin/products/').then((r) => r.json()).then((d) => setProducts(Array.isArray(d) ? d : d.results || [])).catch(() => {});
    authFetch('/api/admin/abandoned-checkouts/').then((r) => r.json()).then((d) => setAbandoned(Array.isArray(d) ? d.length : 0)).catch(() => {});
  }, [authFetch]);

  const revenueByCcy = {};
  orders.forEach((o) => { revenueByCcy[o.currency_code] = (revenueByCcy[o.currency_code] || 0) + Number(o.total || 0); });
  const revenueChips = Object.entries(revenueByCcy).map(([c, v]) => `${c} ${v.toFixed(0)}`);
  const customers = new Set(orders.map((o) => (o.email || '').toLowerCase()).filter(Boolean)).size;

  const days = [];
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ key, label: d.getDate(), value: 0 });
  }
  orders.forEach((o) => {
    const k = (o.created_at || '').slice(0, 10);
    const day = days.find((x) => x.key === k);
    if (day) day.value += 1;
  });

  const LOW = 20;
  const lowStock = products.filter((p) => (p.regional_stock || []).some((s) => s.available <= LOW))
    .map((p) => ({ name: p.name, sku: p.sku, regions: (p.regional_stock || []).filter((s) => s.available <= LOW).map((s) => `${s.region_code} ${s.available}`).join(' · ') }));

  const recent = [...orders].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 5);
  const pending = stats?.pending_orders ?? 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={ShoppingCart} label="Total orders" value={stats?.total_orders ?? '—'}
          sub={`${stats?.processing_orders ?? 0} processing · ${pending} pending`} onClick={() => go('orders')} />
        <StatCard icon={TrendingUp} label="Revenue" value={revenueChips[0] || '—'}
          sub={revenueChips.slice(1).join(' · ') || 'across all orders'} accent="bg-brand-success/10 text-ink-success" onClick={() => go('orders')} />
        <StatCard icon={UsersIcon} label="Customers" value={customers}
          sub="unique buyers" accent="bg-surface-muted text-ink-accent" onClick={() => go('customers')} />
        <StatCard icon={Package} label="Low stock" value={lowStock.length}
          sub={`≤ ${LOW} units in a region`} accent={lowStock.length ? 'bg-amber-50 text-ink-accent' : 'bg-surface-muted text-ink-muted'}
          onClick={() => go('products')} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <RevenueTrendCard authFetch={authFetch} />

        <div className="rounded-lg border border-edge bg-white shadow-card p-5">
          <h3 className="mb-3 text-sm font-semibold text-ink-primary">Needs attention</h3>
          <div className="space-y-2">
            <button onClick={() => go('orders')} className="flex w-full items-center justify-between rounded-md border border-edge-subtle bg-surface-muted px-3 py-2.5 text-left hover:border-edge-strong">
              <span className="text-sm font-medium text-ink-primary">Pending orders</span>
              <span className={`rounded-xs px-2 py-0.5 text-[12px] font-semibold ${pending ? 'bg-amber-50 text-ink-accent' : 'bg-edge text-ink-muted'}`}>{pending}</span>
            </button>
            <button onClick={() => go('abandoned')} className="flex w-full items-center justify-between rounded-md border border-edge-subtle bg-surface-muted px-3 py-2.5 text-left hover:border-edge-strong">
              <span className="text-sm font-medium text-ink-primary">Abandoned checkouts</span>
              <span className={`rounded-xs px-2 py-0.5 text-[12px] font-semibold ${abandoned ? 'bg-amber-50 text-ink-accent' : 'bg-edge text-ink-muted'}`}>{abandoned}</span>
            </button>
            <button onClick={() => go('products')} className="flex w-full items-center justify-between rounded-md border border-edge-subtle bg-surface-muted px-3 py-2.5 text-left hover:border-edge-strong">
              <span className="text-sm font-medium text-ink-primary">Low-stock products</span>
              <span className={`rounded-xs px-2 py-0.5 text-[12px] font-semibold ${lowStock.length ? 'bg-red-50 text-ink-danger' : 'bg-edge text-ink-muted'}`}>{lowStock.length}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-lg border border-edge bg-white shadow-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink-primary">Recent orders</h3>
            <button onClick={() => go('orders')} className="text-[13px] font-semibold text-ink-accent">View all</button>
          </div>
          {recent.length === 0 ? <p className="text-sm text-brand-muted">No orders yet.</p> : (
            <div className="space-y-1.5">
              {recent.map((o) => (
                <button key={o.id} onClick={() => go('orders')} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-muted">
                  <span className="min-w-0 truncate text-sm font-semibold text-ink-primary">#{o.id} <span className="font-normal text-brand-muted">{o.email}</span></span>
                  <span className="flex shrink-0 items-center gap-2"><span className="text-sm text-ink-primary">{o.currency_code} {o.total}</span>
                    <span className={`rounded-xs px-1.5 py-0.5 text-[13px] font-semibold ${STATUS_COLOR[o.status]}`}>{o.status}</span></span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 rounded-lg border border-edge bg-white shadow-card p-5">
          <h3 className="mb-3 text-sm font-semibold text-ink-primary">Inventory to restock</h3>
          {lowStock.length === 0 ? <p className="text-sm text-brand-muted">All products well stocked.</p> : (
            <div className="space-y-1.5">
              {lowStock.slice(0, 6).map((p) => (
                <div key={p.sku} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5">
                  <span className="min-w-0 truncate text-sm font-medium text-ink-primary">{toDisplayText(p.name) || 'Untitled product'}</span>
                  <span className="shrink-0 text-[12px] font-semibold text-ink-accent">{p.regions}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <FunnelCard authFetch={authFetch} />
        <TopCustomersCard authFetch={authFetch} />
        <TopProductsCard authFetch={authFetch} />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Products */
function ProductsTab({ authFetch, regions, categories }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortOrder, setSortOrder] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 450);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page,
      page_size: pageSize,
      search: debouncedQuery,
    });
    if (selectedCategory) params.append('category', selectedCategory);
    if (sortOrder) params.append('ordering', sortOrder);

    authFetch(`/api/admin/products/?${params.toString()}`).then((r) => r.json())
      .then((d) => {
        setProducts(d.results || []);
        setTotalCount(d.count || 0);
      })
      .catch(() => {
        setProducts([]);
        setTotalCount(0);
      }).finally(() => setLoading(false));
  }, [authFetch, page, pageSize, debouncedQuery, selectedCategory, sortOrder]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, selectedCategory, sortOrder]);

  const blankMedia = () => ({ media_type: 'IMAGE', file_url: '' });
  const startNew = () => setEditing({
    sku: '', name: '', description: '', benefits: '', ingredients: '', is_active: true, is_archived: false,
    short_benefit: '', hsn_code: '', dietary_tags: [], base_price: null,
    product_type: 'Simple', faq: [],
    _regional: regions.map((r) => ({ region: r.id, code: r.code, price: '', promotional_price: '', is_visible: true, available: '' })),
    _categories: [], _media: [],
    _variantOptions: [], _variants: [],
    _specs: [], _meta: [],
    _seo: { title: '', description: '', handle: '' },
    _shipping: { weight_g: '', length_cm: '', width_cm: '', height_cm: '', fragile: false },
  });
  const startEdit = (p) => setEditing({
    ...p,
    sku: toDisplayText(p.sku),
    name: toDisplayText(p.name),
    description: toDisplayText(p.description),
    benefits: toDisplayText(p.benefits),
    ingredients: toDisplayText(p.ingredients),
    product_type: toDisplayText(p.nutrition_facts?._product_type) || 'Simple',
    faq: p.faq || [],
    _regional: regions.map((r) => {
      const cfg = (p.regional_configs || []).find((c) => c.region === r.id);
      const stk = (p.regional_stock || []).find((s) => s.region_id === r.id);
      return { region: r.id, code: r.code, price: cfg?.price || '', promotional_price: cfg?.promotional_price || '', is_visible: cfg ? cfg.is_visible : true, available: stk ? stk.available : 0 };
    }),
    _categories: (p.categories || []).map((c) => c.id),
    _media: (p.media && p.media.length ? p.media.map((m) => ({ media_type: m.media_type, file_url: m.file_url })) : []),
    _variantOptions: p.nutrition_facts?._variantOptions || (p.variants?.length ? [{ name: p.variants[0]?.option_name || 'Size', values: Array.from(new Set(p.variants.map(v => v.option_value || v.name))) }] : []),
    _variants: (p.variants && p.variants.length > 0)
      ? p.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          name: v.name,
          option_name: v.option_name,
          option_value: v.option_value,
          price: v.price_gbp || v.price_inr || '',
          price_gbp: v.price_gbp || '',
          price_inr: v.price_inr || '',
          compare_price: '',
          stock: v.stock_qty != null ? v.stock_qty : 100,
          stock_qty: v.stock_qty != null ? v.stock_qty : 100,
          is_active: v.is_active,
          combination: [v.name || v.option_value],
        }))
      : (p.nutrition_facts?._variants || []),
    _specs: Object.entries(p.nutrition_facts || {})
      .filter(([k, v]) => !k.startsWith('_') && (typeof v === 'string' || typeof v === 'number'))
      .map(([key, value]) => ({ key, value: String(value) })),
    _meta: p.nutrition_facts?._meta || [],
    _seo: toSeoMeta(p.nutrition_facts?._seo),
    _shipping: p.nutrition_facts?._shipping || { weight_g: '', length_cm: '', width_cm: '', height_cm: '', fragile: false },
  });

  const save = () => {
    setSaving(true); setErr('');
    const extendedNutrition = {
      ...Object.fromEntries(
        (editing._specs || [])
          .filter((s) => (s.key || '').trim())
          .map((s) => [s.key.trim(), s.value])
      ),
      _product_type: editing.product_type,
      _variantOptions: editing._variantOptions || [],
      _variants: editing._variants || [],
      _meta: editing._meta || [],
      _seo: editing._seo || {},
      _shipping: editing._shipping || {},
    };
    const payload = {
      sku: editing.sku, name: editing.name, description: editing.description,
      short_benefit: editing.short_benefit || '',
      hsn_code: editing.hsn_code || '',
      dietary_tags: editing.dietary_tags || [],
      base_price: editing.base_price === '' || editing.base_price == null ? null : editing.base_price,
      benefits: editing.benefits, ingredients: editing.ingredients,
      nutrition_facts: extendedNutrition, faq: editing.faq || [],
      is_active: editing.is_active, is_archived: editing.is_archived,
      category_ids: editing._categories,
      regional_configs: editing._regional.filter((r) => r.price !== '' && r.price != null)
        .map((r) => ({ region: r.region, price: r.price, promotional_price: r.promotional_price === '' ? null : r.promotional_price, is_visible: r.is_visible })),
      regional_stock: editing._regional.map((r) => ({ region: r.region, available: r.available === '' || r.available == null ? 0 : Number(r.available) })),
      variants: (editing._variants || []).map((v, idx) => ({
        id: v.id,
        sku: v.sku || `${editing.sku}-V${idx + 1}`,
        name: v.name || (v.combination ? v.combination.join(' / ') : `Variant ${idx + 1}`),
        option_name: v.option_name || 'Size',
        option_value: v.option_value || v.name || (v.combination ? v.combination.join(' / ') : `Variant ${idx + 1}`),
        price_gbp: v.price_gbp !== '' && v.price_gbp != null ? Number(v.price_gbp) : (v.price ? Number(v.price) : null),
        price_inr: v.price_inr !== '' && v.price_inr != null ? Number(v.price_inr) : (v.price ? Number(v.price) : null),
        stock_qty: v.stock_qty != null ? Number(v.stock_qty) : (v.stock != null ? Number(v.stock) : 100),
        is_active: v.is_active !== false,
      })),
      media_files: (editing._media || [])
        .filter((m) => m.file_url && m.file_url.trim())
        .map((m, i) => ({ file_url: m.file_url.trim(), media_type: m.media_type, display_order: i + 1 })),
    };
    const isNew = !editing.id;
    authFetch(isNew ? '/api/admin/products/' : `/api/admin/products/${editing.sku}/`,
      { method: isNew ? 'POST' : 'PUT', body: JSON.stringify(payload) })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => { if (!ok) throw new Error(JSON.stringify(d)); setEditing(null); load(); })
      .catch((e) => setErr(e.message)).finally(() => setSaving(false));
  };

  const archive = (p, e) => {
    e.stopPropagation();
    authFetch(`/api/admin/products/${p.sku}/`, { method: 'PATCH', body: JSON.stringify({ is_archived: !p.is_archived }) }).then(load);
  };

  const deleteProduct = (p, e) => {
    e.stopPropagation();
    if (confirm(`Permanently delete product "${p.name}" (${p.sku})? This action cannot be undone.`)) {
      authFetch(`/api/admin/products/${p.sku}/`, { method: 'DELETE' })
        .then(() => load())
        .catch((err) => alert(err.message || 'Could not delete product.'));
    }
  };

  const handleExport = () => {
    const headers = ['SKU', 'Name', 'Categories', 'Status'];
    const rows = products.map((p) => [p.sku, p.name, (p.categories || []).map((c) => c.name).join(' | '), p.is_archived ? 'ARCHIVED' : 'ACTIVE']);
    const csvContent = [headers.map(csvCell).join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url); link.setAttribute('download', 'sclero_products_export.csv');
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  if (editing) {
    return (
      <ProductEditorPanel
        editing={editing}
        onChange={setEditing}
        onClose={() => { setEditing(null); setErr(''); }}
        onSave={save}
        saving={saving}
        err={err}
        regions={regions}
        categories={categories}
        authFetch={authFetch}
      />
    );
  }

  if (loading && products.length === 0) return <p className="text-sm text-brand-muted font-medium">Loading products…</p>;

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-grow max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products…"
            className="w-full rounded-lg border border-edge bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-edge-focus/30" />
        </div>
        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="rounded-sm border border-edge px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-edge-focus/30">
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="rounded-sm border border-edge px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-edge-focus/30">
          <option value="">Default order</option>
          <option value="name">Name (A-Z)</option>
          <option value="-name">Name (Z-A)</option>
          <option value="sku">SKU (A-Z)</option>
          <option value="-sku">SKU (Z-A)</option>
        </select>
        <p className="text-sm text-brand-muted ml-auto font-medium">{totalCount} products</p>
        <div className="flex gap-2">
          <button onClick={handleExport} className="inline-flex items-center gap-1.5 px-3 py-2 text-sm uppercase border border-edge bg-white rounded-sm hover:bg-surface-muted transition"><Download className="h-3.5 w-3.5" /> Export</button>
          <button onClick={startNew} className="inline-flex items-center gap-1.5 px-4 py-2 text-sm uppercase bg-ink-primary text-white rounded-sm font-semibold hover:bg-ink-primary/90 transition"><Plus className="h-4 w-4" /> Add product</button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-edge bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-muted text-[12px] font-medium uppercase tracking-wide text-ink-muted border-b border-edge">
            <tr>
              <th className="px-3 py-3 font-medium">Product</th>
              <th className="px-3 py-3 font-medium">Categories</th>
              <th className="px-3 py-3 font-medium">Price · Stock</th>
              <th className="px-3 py-3 font-medium">Variants</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => {
              const thumb = p.media?.[0]?.file_url;
              const variantList = (p.variants && p.variants.length > 0)
                ? p.variants
                : (p.nutrition_facts?._variants || []);
              const variantCount = variantList.length;
              const firstConfig = p.regional_configs?.[0];
              const firstStock = p.regional_stock?.find(s => s.region_id === firstConfig?.region);
              const isVariable = variantCount > 0 || p.nutrition_facts?._product_type === 'Variable';

              return (
                <tr key={p.id} className="border-t border-edge-subtle align-middle hover:bg-surface-muted cursor-pointer transition" onClick={() => startEdit(p)}>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-edge bg-surface-muted flex items-center justify-center">
                        {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : <Package className="h-4 w-4 text-ink-subtle" />}
                      </div>
                      <div>
                        <p className="font-semibold text-ink-primary">{toDisplayText(p.name) || 'Untitled product'}</p>
                        <p className="font-mono text-[12px] text-brand-muted">{p.sku} · <span className="rounded bg-surface-muted text-ink-accent px-1 text-[8px] font-semibold uppercase">{isVariable ? 'Variable' : (toDisplayText(p.nutrition_facts?._product_type) || 'Simple')}</span></p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-brand-muted">{(p.categories || []).map((c) => c.name).join(', ') || '—'}</td>
                  <td className="px-3 py-3 text-brand-muted">
                    {firstConfig ? <><span className="font-semibold text-ink-primary">{firstConfig.promotional_price || firstConfig.price}</span> · {firstStock ? firstStock.available : 0} units</> : '—'}
                  </td>
                  <td className="px-3 py-3">
                    {variantCount > 0 ? (
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-[12px] font-semibold text-ink-accent">
                          <Layers className="h-3 w-3" />{variantCount} variants
                        </span>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {variantList.map((v, idx) => (
                            <span key={v.id || idx} className="inline-block bg-brand-bg border border-edge rounded px-1.5 py-0.5 text-[10px] font-mono text-ink-secondary">
                              {v.name || v.option_value || `Variant #${idx + 1}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <span className="text-ink-subtle">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {p.is_archived
                      ? <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[12px] font-semibold text-ink-secondary">ARCHIVED</span>
                      : <span className="rounded bg-brand-success/10 px-1.5 py-0.5 text-[12px] font-semibold text-ink-success">ACTIVE</span>}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={(e) => { e.stopPropagation(); startEdit(p); }} className="text-ink-accent hover:opacity-70" title="Edit product"><Pencil className="h-4 w-4" /></button>
                      <button onClick={(e) => archive(p, e)} className="text-brand-muted hover:text-brand-danger" title={p.is_archived ? "Unarchive product" : "Archive product"}><Archive className="h-4 w-4" /></button>
                      <button onClick={(e) => deleteProduct(p, e)} className="text-brand-muted hover:text-brand-danger" title="Delete product permanently"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-12 text-center text-sm text-brand-muted">No products found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalCount > pageSize && (
        <PaginationControls
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          onChangePage={setPage}
          onChangePageSize={setPageSize}
        />
      )}
    </div>
  );
}

/* ----------------------------------------------------------- Collections */
function CollectionsTab({ authFetch }) {
  const [cats, setCats] = useState([]);
  const [form, setForm] = useState(null);
  const [rulesMap, setRulesMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    uploadAdminMedia(authFetch, file)
      .then((fileUrl) => setForm(p => ({ ...p, image_url: fileUrl })))
      .catch((err) => alert(err.message || 'Image upload failed.'))
      .finally(() => setUploadingImage(false));
  };

  const load = useCallback(() => {
    setLoading(true);
    authFetch('/api/admin/categories/')
      .then((r) => r.json())
      .then((d) => setCats(Array.isArray(d) ? d : d.results || []))
      .catch(() => setCats([]))
      .finally(() => setLoading(false));

    authFetch('/api/admin/settings/CATEGORY_RULES/')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d && d.value) setRulesMap(d.value);
      })
      .catch(() => {});
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (c) => {
    const meta = rulesMap[c.slug] || { type: 'manual', match: 'all', rules: [] };
    setForm({
      ...c,
      image_url: c.image_url || '',
      type: meta.type || 'manual',
      match: meta.match || 'all',
      rules: meta.rules || []
    });
  };

  const startNew = () => {
    setForm({
      name: '',
      slug: '',
      description: '',
      image_url: '',
      type: 'manual',
      match: 'all',
      rules: []
    });
  };

  const addRule = () => {
    const newRules = [...(form.rules || []), { column: 'category', relation: 'equals', value: '' }];
    setForm({ ...form, rules: newRules });
  };

  const removeRule = (idx) => {
    const newRules = (form.rules || []).filter((_, i) => i !== idx);
    setForm({ ...form, rules: newRules });
  };

  const updateRule = (idx, patch) => {
    const newRules = [...(form.rules || [])];
    newRules[idx] = { ...newRules[idx], ...patch };
    setForm({ ...form, rules: newRules });
  };

  const save = () => {
    const isNew = !form.id;
    authFetch(isNew ? '/api/admin/categories/' : `/api/admin/categories/${form.slug}/`, {
      method: isNew ? 'POST' : 'PUT',
      body: JSON.stringify({ name: form.name, slug: form.slug, description: form.description || '', image_url: form.image_url || '' })
    })
      .then((r) => r.json())
      .then((savedCat) => {
        const nextRulesMap = {
          ...rulesMap,
          [form.slug]: { type: form.type, match: form.match, rules: form.rules }
        };
        setRulesMap(nextRulesMap);
        return authFetch('/api/admin/settings/CATEGORY_RULES/', {
          method: 'PUT',
          body: JSON.stringify({ key: 'CATEGORY_RULES', value: nextRulesMap, description: 'Automated rules for collections/categories' })
        })
          .then((r) => {
            if (r.status === 404) {
              return authFetch('/api/admin/settings/', {
                method: 'POST',
                body: JSON.stringify({ key: 'CATEGORY_RULES', value: nextRulesMap, description: 'Automated rules for collections/categories' })
              });
            }
            return r;
          });
      })
      .then(() => {
        setForm(null);
        load();
      });
  };

  const del = (c) => authFetch(`/api/admin/categories/${c.slug}/`, { method: 'DELETE' }).then(load);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-brand-muted">{cats.length} collections</p>
        <button onClick={startNew} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm uppercase">
          <Plus className="h-4 w-4" /> New collection
        </button>
      </div>

      <div className="space-y-2">
        {cats.map((c) => {
          const meta = rulesMap[c.slug] || { type: 'manual' };
          return (
            <div key={c.id} className="flex items-center justify-between rounded-md border border-edge bg-white p-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 overflow-hidden rounded-lg border border-edge bg-surface-muted flex items-center justify-center flex-shrink-0">
                  {c.image_url ? (
                    <img src={c.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Layers className="h-4 w-4 text-ink-subtle" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-primary">
                    {toDisplayText(c.name)} <span className="font-mono text-[12px] text-brand-muted">/{toDisplayText(c.slug)}</span>
                    {meta.type === 'automated' ? (
                      <span className="ml-2 rounded-xs bg-surface-muted text-ink-accent px-1.5 py-0.5 text-[13px] font-semibold">AUTOMATED</span>
                    ) : (
                      <span className="ml-2 rounded-xs bg-surface-muted text-ink-muted px-1.5 py-0.5 text-[13px] font-semibold">MANUAL</span>
                    )}
                  </p>
                  {c.product_count != null && <p className="text-[13px] text-brand-muted">{c.product_count} products</p>}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(c)} className="text-ink-accent hover:opacity-70">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => del(c)} className="text-brand-muted hover:text-brand-danger">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {form && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-surface-muted overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
          <div className="w-full max-w-xl bg-white rounded-lg border border-edge p-6 shadow-card space-y-4 max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-ink-primary">{form.id ? 'Edit' : 'New'} collection</h3>
            
            <div className="space-y-3">
              <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-sm border border-edge p-2.5 text-sm" />
              <input placeholder="Slug" value={form.slug} disabled={!!form.id} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="w-full rounded-sm border border-edge p-2.5 text-sm disabled:bg-surface-muted" />
              <textarea placeholder="Description" rows={2} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-sm border border-edge p-2.5 text-sm" />
              
              <div className="space-y-1">
                <label className="block text-[12px] font-semibold text-brand-muted uppercase">Collection Image URL</label>
                <div className="flex gap-3">
                  <input placeholder="https://example.com/collection-image.jpg" value={form.image_url || ''} onChange={(e) => setForm({ ...form, image_url: e.target.value })} className="flex-1 rounded-sm border border-edge p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-edge-focus/40" />
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-edge px-3 py-2.5 text-sm font-semibold text-ink-primary hover:border-ink-primary">
                    <Upload className="h-3.5 w-3.5" />
                    {uploadingImage ? 'Uploading' : 'Upload'}
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploadingImage} />
                  </label>
                  {form.image_url && (
                    <div className="h-10 w-10 rounded-lg overflow-hidden border border-edge bg-surface-muted flex items-center justify-center flex-shrink-0">
                      <img src={form.image_url} alt="" className="h-full w-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-edge-subtle pt-3">
                <label className="block text-sm font-semibold text-ink-primary mb-2 uppercase">Collection Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-ink-primary font-semibold cursor-pointer">
                    <input type="radio" checked={form.type === 'manual'} onChange={() => setForm({ ...form, type: 'manual' })} />
                    Manual (Manually add products)
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink-primary font-semibold cursor-pointer">
                    <input type="radio" checked={form.type === 'automated'} onChange={() => setForm({ ...form, type: 'automated', rules: form.rules?.length ? form.rules : [{ column: 'category', relation: 'equals', value: '' }] })} />
                    Automated (Match product criteria)
                  </label>
                </div>
              </div>

              {form.type === 'automated' && (
                <div className="bg-surface-muted p-4 rounded-lg border border-edge space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-ink-primary uppercase">Conditions match:</span>
                    <select value={form.match} onChange={(e) => setForm({ ...form, match: e.target.value })} className="text-sm border rounded p-1 bg-white">
                      <option value="all">All Conditions (AND)</option>
                      <option value="any">Any Condition (OR)</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    {(form.rules || []).map((rule, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <select value={rule.column} onChange={(e) => updateRule(idx, { column: e.target.value })} className="text-sm border rounded p-1 bg-white flex-1">
                          <option value="category">Category</option>
                          <option value="ingredients">Ingredients</option>
                          <option value="price">Price</option>
                          <option value="type">Product Type</option>
                        </select>
                        <select value={rule.relation} onChange={(e) => updateRule(idx, { relation: e.target.value })} className="text-sm border rounded p-1 bg-white flex-1">
                          <option value="equals">Equals</option>
                          <option value="contains">Contains</option>
                          <option value="greater_than">Greater than</option>
                          <option value="less_than">Less than</option>
                        </select>
                        <input value={rule.value} onChange={(e) => updateRule(idx, { value: e.target.value })} placeholder="Value" className="text-sm border rounded p-1 bg-white flex-[1.5]" />
                        <button onClick={() => removeRule(idx)} className="text-brand-danger hover:opacity-75 p-1"><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                    <button onClick={addRule} className="text-sm font-semibold text-ink-accent hover:underline">+ Add condition</button>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button onClick={save} className="btn-primary flex-1 py-2.5 text-sm uppercase">Save Collection</button>
                <button onClick={() => setForm(null)} className="flex-1 rounded-sm border border-edge py-2.5 text-sm font-semibold uppercase">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- Orders */
function OrderDetail({ authFetch, order, onClose, onChanged }) {
  const [timeline, setTimeline] = useState([]);
  const [note, setNote] = useState('');
  const [noteKind, setNoteKind] = useState('NOTE');
  const [captureAmount, setCaptureAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const [showFulfillForm, setShowFulfillForm] = useState(false);
  const [carrier, setCarrier] = useState('Delhivery');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');

  const [showRefundForm, setShowRefundForm] = useState(false);
  const [refundAmount, setRefundAmount] = useState(order.total);
  const [refundReason, setRefundReason] = useState('Customer Return');

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, []);

  useEffect(() => {
    authFetch(`/api/admin/orders/${order.id}/timeline/`).then((r) => r.json()).then((d) => setTimeline(Array.isArray(d) ? d : [])).catch(() => setTimeline([]));
  }, [authFetch, order.id]);

  const [downloadingInvoice, setDownloadingInvoice] = useState(false);

  const downloadOrderInvoice = async () => {
    setDownloadingInvoice(true);
    try {
      const res = await authFetch(`/api/admin/orders/${order.id}/invoice/`);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text || 'Download failed'}`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice_Order_${order.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Could not download invoice PDF: ${err.message}`);
    } finally {
      setDownloadingInvoice(false);
    }
  };

  const printPackingSlip = async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Please allow popups to print the packing slip.");
      return;
    }

    const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    })[character]);
    let company = {};
    try {
      const response = await authFetch('/api/admin/settings/COMPANY_INFO/');
      const data = response.ok ? await response.json() : {};
      company = data?.value && typeof data.value === 'object' ? data.value : {};
    } catch {
      company = {};
    }
    const companyName = escapeHtml(company.name || 'Online store');
    const companyContact = escapeHtml(company.support || company.email || '');
    const currencyCode = escapeHtml(order.currency_code || '');

    const items = order.items || [];
    const itemsHtml = items.map(it => {
      const name = escapeHtml(it.product_name || it.product?.name || it.name || 'Product');
      const sku = escapeHtml(it.product_sku || it.product?.sku || it.sku || 'N/A');
      const hsn = escapeHtml(it.hsn_code || it.product?.hsn_code || 'N/A');
      const qty = it.quantity || 1;
      const price = parseFloat(it.price || 0).toFixed(2);
      const total = (parseFloat(it.price || 0) * qty).toFixed(2);
      return `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">
          <strong style="color: #0f172a; font-size: 13px;">${name}</strong><br/>
          <span style="font-size: 11px; font-family: monospace; color: #64748b;">SKU: ${sku}</span>
        </td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #475569;">${hsn}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 13px; font-weight: 700; color: #0f172a;">${qty}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 12px; color: #475569;">${currencyCode} ${price}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; text-align: right; font-size: 12px; font-weight: 600; color: #0f172a;">${currencyCode} ${total}</td>
      </tr>
    `;
    }).join('');

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Shipping & Packing Slip - Order #${order.id}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #1e293b; margin: 30px; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0f172a; padding-bottom: 15px; margin-bottom: 25px; }
          .brand { font-size: 24px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
          .brand span { color: #16a34a; }
          .doc-title { font-size: 18px; font-weight: 700; text-transform: uppercase; color: #0f172a; letter-spacing: 1px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; font-size: 13px; }
          .card-title { margin-top: 0; margin-bottom: 10px; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px; text-transform: uppercase; font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.5px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
          th { background: #f1f5f9; padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase; font-weight: 700; color: #475569; border-bottom: 2px solid #cbd5e1; }
          .summary-table { width: 280px; margin-left: auto; font-size: 13px; margin-bottom: 30px; }
          .summary-table td { padding: 5px 0; }
          .summary-table .total-row { font-weight: 800; font-size: 15px; border-top: 2px solid #0f172a; padding-top: 8px; }
          .footer { text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 40px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="brand">${companyName}</div>
          <div class="doc-title">Shipping & Packing Slip</div>
        </div>
        
        <div class="grid">
          <div class="card">
            <div class="card-title">Order Information</div>
            <strong>Order ID:</strong> #${order.id}<br/>
            <strong>Date:</strong> ${new Date(order.created_at).toLocaleDateString()} ${new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}<br/>
            <strong>Payment Method:</strong> ${escapeHtml(order.payment_method || 'Standard')}<br/>
            <strong>Payment Status:</strong> <span style="font-weight: 700;">${escapeHtml(order.payment_status)}</span><br/>
            <strong>Fulfillment Status:</strong> <span style="font-weight: 700;">${escapeHtml(order.status)}</span>
          </div>
          <div class="card">
            <div class="card-title">Ship To Address</div>
            <strong style="font-size: 14px; color: #0f172a;">${escapeHtml(order.shipping_name || 'Customer')}</strong><br/>
            ${escapeHtml(order.shipping_address_line1)}${order.shipping_address_line2 ? `, ${escapeHtml(order.shipping_address_line2)}` : ''}<br/>
            ${escapeHtml(order.shipping_city)}, ${escapeHtml(order.shipping_state)} ${escapeHtml(order.shipping_postal_code)}<br/>
            <strong>Country:</strong> ${escapeHtml(order.shipping_country || order.region_code)}<br/>
            <strong>Phone:</strong> ${escapeHtml(order.shipping_phone || 'N/A')}<br/>
            <strong>Email:</strong> ${escapeHtml(order.email)}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 40%;">Item Description</th>
              <th style="width: 15%; text-align: center;">HSN Code</th>
              <th style="width: 15%; text-align: center;">Qty</th>
              <th style="width: 15%; text-align: right;">Unit Price</th>
              <th style="width: 15%; text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <table class="summary-table">
          <tr>
            <td>Subtotal:</td>
            <td style="text-align: right;">${currencyCode} ${parseFloat(order.subtotal || 0).toFixed(2)}</td>
          </tr>
          <tr>
            <td>Tax (${order.tax_rate || 0}%):</td>
            <td style="text-align: right;">${currencyCode} ${parseFloat(order.tax_amount || 0).toFixed(2)}</td>
          </tr>
          <tr>
            <td>Shipping:</td>
            <td style="text-align: right;">${currencyCode} ${parseFloat(order.shipping_cost || 0).toFixed(2)}</td>
          </tr>
          <tr class="total-row">
            <td>Grand Total:</td>
            <td style="text-align: right;">${currencyCode} ${parseFloat(order.total || 0).toFixed(2)}</td>
          </tr>
        </table>

        <div class="footer">
          ${companyName}${companyContact ? ` · ${companyContact}` : ''} · Computer-generated packing slip for warehouse dispatch.
        </div>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();
    window.setTimeout(() => printWindow.print(), 250);
  };

  const setStatus = (status) => {
    setSaving(true);
    authFetch(`/api/admin/orders/${order.id}/update_status/`, { method: 'POST', body: JSON.stringify({ status }) })
      .then((r) => r.json())
      .then(() => {
        return authFetch(`/api/admin/orders/${order.id}/`).then(r => r.json());
      })
      .then((updatedOrder) => {
        onChanged(updatedOrder);
        return authFetch(`/api/admin/orders/${order.id}/timeline/`).then((r) => r.json()).then((d) => setTimeline(Array.isArray(d) ? d : []));
      })
      .catch((e) => setErr(e.message))
      .finally(() => setSaving(false));
  };

  const authorized = Number(order.payment_authorized_amount || order.total || 0);
  const captured = Number(order.payment_captured_amount || 0);
  const captureRemaining = Math.max(0, authorized - captured);
  const paymentLogs = order.payment_logs || [];

  const refreshDetail = (nextOrder) => {
    if (nextOrder?.id) onChanged(nextOrder);
    else onChanged();
  };
  const authorizePayment = () => {
    setSaving(true); setErr('');
    authFetch(`/api/admin/orders/${order.id}/authorize_payment/`, { method: 'POST', body: JSON.stringify({ amount: order.total }) })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => { if (!ok) throw new Error(d.error || 'Unable to authorize payment.'); refreshDetail(d); })
      .catch((e) => setErr(e.message)).finally(() => setSaving(false));
  };
  const capturePayment = () => {
    setSaving(true); setErr('');
    authFetch(`/api/admin/orders/${order.id}/capture_payment/`, { method: 'POST', body: JSON.stringify({ amount: captureAmount || captureRemaining }) })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => { if (!ok) throw new Error(d.error || 'Unable to capture payment.'); setCaptureAmount(''); refreshDetail(d); })
      .catch((e) => setErr(e.message)).finally(() => setSaving(false));
  };
  const addTimelineEvent = () => {
    if (!note.trim()) return;
    setSaving(true); setErr('');
    authFetch(`/api/admin/orders/${order.id}/add_timeline_event/`, { method: 'POST', body: JSON.stringify({ note, kind: noteKind }) })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error || 'Unable to add timeline event.');
        setNote('');
        return authFetch(`/api/admin/orders/${order.id}/timeline/`).then((r) => r.json()).then((d) => setTimeline(Array.isArray(d) ? d : []));
      })
      .catch((e) => setErr(e.message)).finally(() => setSaving(false));
  };

  const handleFulfill = () => {
    setSaving(true); setErr('');
    authFetch(`/api/admin/orders/${order.id}/`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'SHIPPED',
        shipping_carrier: carrier,
        tracking_number: trackingNumber,
        tracking_url: trackingUrl || (trackingNumber ? `https://track.scleroproteins.com?num=${trackingNumber}` : ''),
      })
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error || 'Failed to update order status');
        return authFetch(`/api/admin/orders/${order.id}/add_timeline_event/`, {
          method: 'POST',
          body: JSON.stringify({
            note: `Items fulfilled via ${carrier}. Tracking #: ${trackingNumber}${trackingUrl ? ` (${trackingUrl})` : ''}`,
            kind: 'CUSTOMER_COMMUNICATION'
          })
        });
      })
      .then(() => {
        setShowFulfillForm(false);
        setTrackingNumber('');
        setTrackingUrl('');
        return authFetch(`/api/admin/orders/${order.id}/`).then(r => r.json());
      })
      .then((updatedOrder) => {
        onChanged(updatedOrder);
        return authFetch(`/api/admin/orders/${order.id}/timeline/`).then((r) => r.json()).then((d) => setTimeline(Array.isArray(d) ? d : []));
      })
      .catch((e) => setErr(e.message))
      .finally(() => setSaving(false));
  };

  const handleRefund = () => {
    setSaving(true); setErr('');
    authFetch('/api/admin/refunds/', {
      method: 'POST',
      body: JSON.stringify({
        order: order.id,
        amount: Number(refundAmount),
        currency_code: order.currency_code,
        reason: refundReason,
        gateway: order.payment_method || 'COD',
        status: 'PENDING'
      })
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error || 'Failed to create refund record.');
        const refundId = d.id;
        return authFetch(`/api/admin/refunds/${refundId}/process/`, {
          method: 'POST'
        });
      })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error || 'Failed to process refund payment.');
        return authFetch(`/api/admin/orders/${order.id}/update_status/`, {
          method: 'POST',
          body: JSON.stringify({ status: 'REFUNDED' })
        });
      })
      .then(() => {
        setShowRefundForm(false);
        return authFetch(`/api/admin/orders/${order.id}/`).then(r => r.json());
      })
      .then((updatedOrder) => {
        onChanged(updatedOrder);
        return authFetch(`/api/admin/orders/${order.id}/timeline/`).then((r) => r.json()).then((d) => setTimeline(Array.isArray(d) ? d : []));
      })
      .catch((e) => setErr(e.message))
      .finally(() => setSaving(false));
  };

  const handleCancel = () => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    setSaving(true); setErr('');
    authFetch(`/api/admin/orders/${order.id}/update_status/`, {
      method: 'POST',
      body: JSON.stringify({ status: 'CANCELLED' })
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error || 'Failed to cancel order');
        return authFetch(`/api/admin/orders/${order.id}/add_timeline_event/`, {
          method: 'POST',
          body: JSON.stringify({
            note: 'Order was cancelled by staff member.',
            kind: 'NOTE'
          })
        });
      })
      .then(() => {
        return authFetch(`/api/admin/orders/${order.id}/`).then(r => r.json());
      })
      .then((updatedOrder) => {
        onChanged(updatedOrder);
        return authFetch(`/api/admin/orders/${order.id}/timeline/`).then((r) => r.json()).then((d) => setTimeline(Array.isArray(d) ? d : []));
      })
      .catch((e) => setErr(e.message))
      .finally(() => setSaving(false));
  };

  return (
    <div className="fixed top-[65px] bottom-0 right-0 left-0 md:left-[280px] lg:left-[288px] z-30 bg-surface-subtle overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-5xl bg-white rounded-lg border border-edge shadow-card mx-auto overflow-hidden">
        
        {/* Top Sticky Header */}
        <div className="sticky top-0 z-10 border-b border-edge bg-white/95 px-6 py-4 backdrop-blur flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-ink-primary">Order #{order.id}</h3>
                <span className={`rounded-sm px-2 py-0.5 text-[12px] font-bold uppercase tracking-wider ${STATUS_COLOR[order.status]}`}>{order.status}</span>
                <span className={`rounded-sm px-2 py-0.5 text-[12px] font-bold uppercase tracking-wider ${PAYMENT_STATUS_COLOR[order.payment_status] || 'bg-surface-muted text-ink-secondary'}`}>{order.payment_status || 'PAID'}</span>
              </div>
              <p className="text-sm text-ink-subtle mt-0.5">Placed on {formatDateTime(order.created_at)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={downloadOrderInvoice}
              disabled={downloadingInvoice}
              className="inline-flex items-center gap-1.5 rounded-md bg-ink-primary px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-ink-primary/90 transition shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              {downloadingInvoice ? 'Generating Invoice…' : 'Download Invoice (PDF)'}
            </button>
            <button
              onClick={printPackingSlip}
              className="inline-flex items-center gap-1.5 rounded-md border border-edge bg-white px-3.5 py-1.5 text-xs font-semibold text-ink-primary hover:bg-surface-muted transition shadow-sm cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5 text-ink-secondary" /> Print Packing Slip
            </button>
            <button
              onClick={() => {
                if (confirm(`Permanently delete Order #${order.id}? This action cannot be undone.`)) {
                  authFetch(`/api/admin/orders/${order.id}/`, { method: 'DELETE' })
                    .then(() => { onClose(); onChanged(null); })
                    .catch((err) => alert(err.message || 'Could not delete order.'));
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition cursor-pointer"
              title="Delete order permanently"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
            <button onClick={onClose} className="rounded-md border border-edge p-2 text-ink-secondary hover:bg-surface-muted transition cursor-pointer" aria-label="Close order detail"><X className="h-4.5 w-4.5" /></button>
          </div>
        </div>

        {/* 2-Column Shopify Grid */}
        <div className="grid gap-6 p-6 lg:grid-cols-3">
          
          {/* Left Column (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Products Card */}
            <div className="rounded-lg border border-edge bg-white p-6 shadow-card space-y-4">
              <div className="flex items-center justify-between border-b border-edge-subtle pb-3">
                <p className="text-sm font-bold text-ink-primary uppercase tracking-wider">Line Items</p>
                <div className="flex items-center gap-2">
                  <label className="text-[13px] font-semibold text-ink-secondary">Status:</label>
                  <select value={order.status} onChange={(e) => setStatus(e.target.value)} className="rounded border border-edge px-2.5 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-edge-focus">
                    {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="divide-y divide-edge-subtle">
                {(order.items || []).map((it) => (
                  <div key={it.id} className="flex items-center justify-between gap-4 py-3.5 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink-primary truncate">{toDisplayText(it.product_name) || 'Unknown item'}</p>
                      <p className="font-mono text-[12px] text-ink-muted mt-0.5">SKU: {it.product_sku} · Qty: {it.quantity} · {formatMoney(order.currency_code, it.price)} each</p>
                    </div>
                    <p className="font-semibold text-ink-primary text-right">{formatMoney(order.currency_code, Number(it.price) * Number(it.quantity))}</p>
                  </div>
                ))}
              </div>
              
              {/* Financial Breakdowns */}
              <div className="mt-4 space-y-2 border-t border-edge-subtle pt-4 text-sm">
                <div className="flex justify-between text-ink-secondary"><span>Subtotal</span><span className="font-medium">{formatMoney(order.currency_code, order.subtotal)}</span></div>
                <div className="flex justify-between text-ink-secondary"><span>Tax ({order.tax_rate}%)</span><span className="font-medium">{formatMoney(order.currency_code, order.tax_amount)}</span></div>
                <div className="flex justify-between text-ink-secondary"><span>Shipping{order.shipping_method ? ` · ${order.shipping_method}` : ''}</span><span className="font-medium">{formatMoney(order.currency_code, order.shipping_cost)}</span></div>
                <div className="flex justify-between pt-2.5 text-sm font-bold text-ink-primary border-t border-edge-subtle"><span>Total</span><span>{formatMoney(order.currency_code, order.total)}</span></div>
              </div>
            </div>

            {/* Payment Transactions & Capture Card */}
            <div className="rounded-lg border border-edge bg-white p-6 shadow-card space-y-4">
              <div className="flex items-center gap-2 border-b border-edge-subtle pb-3">
                <Banknote className="h-4.5 w-4.5 text-brand-accent" />
                <p className="text-sm font-bold text-ink-primary uppercase tracking-wider">Payment &amp; Transactions</p>
              </div>
              <div className="grid gap-4 text-sm sm:grid-cols-3">
                <div className="bg-surface-subtle p-3 rounded border border-edge-subtle">
                  <p className="text-[12px] text-ink-muted font-bold uppercase tracking-wider mb-1">Gateway Method</p>
                  <p className="text-sm font-bold text-ink-primary">{order.payment_method || 'N/A'}</p>
                </div>
                <div className="bg-surface-subtle p-3 rounded border border-edge-subtle">
                  <p className="text-[12px] text-ink-muted font-bold uppercase tracking-wider mb-1">Authorized</p>
                  <p className="text-sm font-bold text-ink-primary">{formatMoney(order.currency_code, authorized)}</p>
                </div>
                <div className="bg-surface-subtle p-3 rounded border border-edge-subtle">
                  <p className="text-[12px] text-ink-muted font-bold uppercase tracking-wider mb-1">Captured</p>
                  <p className="text-sm font-bold text-ink-primary">{formatMoney(order.currency_code, captured)}</p>
                </div>
              </div>

              {/* Manual capture options if applicable */}
              {captureRemaining > 0 && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-ink-accent">Uncaptured Authorization</p>
                    <span className="rounded bg-amber-100 text-amber-800 px-2 py-0.5 text-[13px] font-bold uppercase tracking-wide">{order.payment_capture_mode || 'MANUAL'} mode</span>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button onClick={authorizePayment} disabled={saving} className="rounded border border-edge bg-white px-3 py-2 text-sm font-semibold text-ink-primary hover:bg-surface-muted transition disabled:opacity-50">Re-Authorize</button>
                    <input value={captureAmount} onChange={(e) => setCaptureAmount(e.target.value)} placeholder={`Remaining ${captureRemaining.toFixed(2)}`} className="min-w-0 flex-1 rounded border border-edge px-3 py-2 text-sm focus:outline-none" />
                    <button onClick={capturePayment} disabled={saving || captureRemaining <= 0} className="btn-primary px-4 py-2 text-sm uppercase disabled:opacity-50 font-semibold shadow-sm">Capture Funds</button>
                  </div>
                  {err && <p className="mt-2 rounded bg-brand-danger/10 p-2 text-sm text-brand-danger font-medium">{err}</p>}
                </div>
              )}

              {/* Transaction Logs */}
              <div className="mt-4 pt-3 border-t border-edge-subtle space-y-2">
                <p className="text-sm font-bold text-ink-secondary">Transaction Logs</p>
                <div className="divide-y divide-edge-subtle">
                  {paymentLogs.map((log, i) => (
                    <div key={`${log.transaction_id}-${i}`} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                      <span className="font-semibold text-ink-primary uppercase">{log.status} | {log.gateway}</span>
                      <span className="text-ink-muted font-mono">{formatMoney(order.currency_code, log.amount)} · {formatDateTime(log.created_at)}</span>
                    </div>
                  ))}
                  {!paymentLogs.length && <p className="text-sm text-ink-muted">No transaction logs available.</p>}
                </div>
              </div>
            </div>

            {/* Timeline Audit Logs */}
            <div className="rounded-lg border border-edge bg-white p-6 shadow-card space-y-4">
              <div className="flex items-center gap-2 border-b border-edge-subtle pb-3">
                <Activity className="h-4.5 w-4.5 text-brand-accent" />
                <p className="text-sm font-bold text-ink-primary uppercase tracking-wider">Order Timeline &amp; History</p>
              </div>
              <ol className="space-y-4 border-l-2 border-edge pl-4 ml-2">
                {timeline.map((e, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[23px] top-1 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-brand-accent ring-4 ring-white" />
                    <p className="text-sm font-bold text-ink-primary">{e.label}</p>
                    {e.detail && <p className="text-sm text-ink-secondary mt-0.5">{e.detail}</p>}
                    <p className="text-[12px] text-ink-subtle mt-0.5">{formatDateTime(e.ts)}</p>
                  </li>
                ))}
                {timeline.length === 0 && <li className="text-sm text-ink-muted">No timeline events logged yet.</li>}
              </ol>
              
              {/* Add Note form */}
              <div className="mt-6 pt-4 border-t border-edge-subtle grid gap-2 sm:grid-cols-[160px_1fr_auto]">
                <select value={noteKind} onChange={(e) => setNoteKind(e.target.value)} className="rounded border border-edge px-3 py-2 text-sm focus:outline-none">
                  <option value="NOTE">Staff Note</option>
                  <option value="CUSTOMER_COMMUNICATION">Customer Update</option>
                </select>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Type order note description..." className="rounded border border-edge px-3 py-2 text-sm focus:outline-none" />
                <button onClick={addTimelineEvent} disabled={saving || !note.trim()} className="rounded border border-edge px-4 py-2 text-sm font-semibold text-ink-primary hover:bg-surface-muted disabled:opacity-50 transition">Add Note</button>
              </div>
            </div>
          </div>

          {/* Right Sidebar Column (1/3 width) */}
          <div className="space-y-6">
            
            {/* Fulfillment & Refund Operations */}
            <div className="rounded-lg border border-edge bg-white p-6 shadow-card space-y-4">
              <p className="text-sm font-bold text-ink-primary border-b border-edge-subtle pb-3 uppercase tracking-wider">Fulfillment &amp; Actions</p>
              
              {order.status !== 'SHIPPED' && order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && order.status !== 'REFUNDED' && (
                <div className="space-y-2">
                  <button onClick={() => setShowFulfillForm(!showFulfillForm)} className="w-full btn-primary text-sm font-semibold uppercase py-2.5 shadow-sm inline-flex items-center justify-center">
                    Fulfill Items
                  </button>
                  {showFulfillForm && (
                    <div className="mt-3 space-y-3 bg-surface-subtle p-4 rounded border border-edge">
                      <div>
                        <label className="text-[12px] text-ink-muted font-bold uppercase tracking-wider mb-1 block">Carrier Service</label>
                        <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className="w-full text-sm rounded border border-edge p-2 bg-white focus:outline-none">
                          <option value="Delhivery">Delhivery</option>
                          <option value="Blue Dart">Blue Dart</option>
                          <option value="DTDC">DTDC</option>
                          <option value="Royal Mail">Royal Mail</option>
                          <option value="DPD">DPD</option>
                          <option value="Evri">Evri</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[12px] text-ink-muted font-bold uppercase tracking-wider mb-1 block">Tracking Reference</label>
                        <input placeholder="Tracking Number (e.g. DEL123456)" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className="w-full text-sm rounded border border-edge p-2 bg-white focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[12px] text-ink-muted font-bold uppercase tracking-wider mb-1 block">Tracking Direct Link (Optional)</label>
                        <input placeholder="https://track.carrier.com/123" value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} className="w-full text-sm rounded border border-edge p-2 bg-white focus:outline-none" />
                      </div>
                      <button onClick={handleFulfill} disabled={!trackingNumber || saving} className="w-full bg-ink-primary text-white text-sm uppercase font-bold py-2 rounded disabled:opacity-50 hover:bg-ink-primary/95 transition">
                        Confirm Shipment
                      </button>
                    </div>
                  )}
                </div>
              )}

              {order.status !== 'CANCELLED' && order.status !== 'REFUNDED' && (
                <div className="space-y-2">
                  <button onClick={() => setShowRefundForm(!showRefundForm)} className="w-full border border-edge text-sm font-bold uppercase py-2.5 text-ink-secondary rounded hover:bg-surface-muted transition">
                    Refund Transactions
                  </button>
                  {showRefundForm && (
                    <div className="mt-3 space-y-3 bg-surface-subtle p-4 rounded border border-edge">
                      <div>
                        <label className="text-[12px] text-ink-muted font-bold block uppercase tracking-wider mb-1">Refund Amount ({order.currency_code})</label>
                        <input type="number" step="0.01" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} className="w-full text-sm rounded border border-edge p-2 bg-white focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[12px] text-ink-muted font-bold block uppercase tracking-wider mb-1">Refund Justification</label>
                        <input placeholder="Reason for return" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} className="w-full text-sm rounded border border-edge p-2 bg-white focus:outline-none" />
                      </div>
                      <button onClick={handleRefund} disabled={!refundAmount || Number(refundAmount) <= 0 || saving} className="w-full bg-brand-danger hover:bg-brand-danger/90 text-white text-sm uppercase font-bold py-2 rounded disabled:opacity-50 transition">
                        Process Refund
                      </button>
                    </div>
                  )}
                </div>
              )}

              {order.status !== 'CANCELLED' && order.status !== 'SHIPPED' && order.status !== 'DELIVERED' && order.status !== 'REFUNDED' && (
                <div>
                  <button onClick={handleCancel} disabled={saving} className="w-full border border-brand-danger/30 text-brand-danger text-sm font-bold uppercase py-2.5 rounded hover:bg-brand-danger/5 transition">
                    Cancel Order
                  </button>
                </div>
              )}
            </div>

            {/* Customer Information Card */}
            <div className="rounded-lg border border-edge bg-white p-6 shadow-card space-y-3">
              <div className="flex items-center gap-2 border-b border-edge-subtle pb-3">
                <UserRound className="h-4.5 w-4.5 text-brand-accent" />
                <p className="text-sm font-bold text-ink-primary uppercase tracking-wider">Customer Details</p>
              </div>
              <p className="font-bold text-ink-primary text-sm">{order.shipping_name}</p>
              <div className="text-sm space-y-1.5 text-ink-secondary">
                <p className="truncate"><span className="font-semibold text-ink-primary">Email:</span> {order.email}</p>
                <p><span className="font-semibold text-ink-primary">Phone:</span> {order.shipping_phone || 'N/A'}</p>
              </div>
              <div className="mt-3 rounded-lg border border-edge bg-surface-subtle p-3.5 text-sm text-ink-secondary leading-relaxed">
                <p className="font-bold text-ink-primary mb-1 uppercase tracking-wider text-[13px] text-ink-muted">Shipping Address</p>
                {order.shipping_address_line1}{order.shipping_address_line2 ? `, ${order.shipping_address_line2}` : ''}<br />
                {order.shipping_city}, {order.shipping_state} {order.shipping_postal_code}<br />
                {order.shipping_country}
                {order.shipping_method && <><br /><span className="font-semibold text-ink-primary">Method:</span> {order.shipping_method}{order.shipping_estimated_days ? ` · ${order.shipping_estimated_days}` : ''}</>}
              </div>
            </div>

            {/* Metadata Summary Card */}
            <div className="rounded-lg border border-edge bg-white p-6 shadow-card space-y-3">
              <p className="text-sm font-bold text-ink-primary border-b border-edge-subtle pb-3 uppercase tracking-wider">Checkout Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-ink-secondary font-medium">Sales Region</span><span className="font-bold text-ink-primary uppercase">{order.region_code || order.region}</span></div>
                <div className="flex justify-between"><span className="text-ink-secondary font-medium">Order Date</span><span className="font-semibold text-ink-primary">{formatDateTime(order.created_at)}</span></div>
                <div className="flex justify-between"><span className="text-ink-secondary font-medium">Updated Date</span><span className="font-semibold text-ink-primary">{formatDateTime(order.updated_at)}</span></div>
                <div className="flex justify-between"><span className="text-ink-secondary font-medium">Gateway Payment ID</span><span className="max-w-[140px] truncate font-mono text-ink-primary" title={order.payment_id}>{order.payment_id || 'N/A'}</span></div>
              </div>
            </div>

            {/* Invoice & Packing Slip actions */}
            <div className="flex flex-col gap-2.5 w-full">
              <button
                type="button"
                onClick={downloadOrderInvoice}
                disabled={downloadingInvoice}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-edge bg-ink-primary text-white px-4 py-3.5 text-sm font-bold hover:bg-ink-primary/90 transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {downloadingInvoice ? 'Generating Invoice PDF…' : 'Download Invoice (PDF)'}
              </button>
              <button
                type="button"
                onClick={printPackingSlip}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-edge bg-white px-4 py-3.5 text-sm font-bold text-ink-primary hover:bg-surface-muted transition shadow-sm cursor-pointer"
              >
                <Printer className="h-4 w-4 text-ink-secondary" /> Print Packing Slip
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
function PaginationControls({ page, pageSize, totalCount, onChangePage, onChangePageSize }) {
  const totalPages = Math.ceil(totalCount / pageSize) || 1;
  const startRange = (page - 1) * pageSize + 1;
  const endRange = Math.min(page * pageSize, totalCount);

  const pages = [];
  const maxButtons = 5;
  let startPage = Math.max(1, page - Math.floor(maxButtons / 2));
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);

  if (endPage - startPage + 1 < maxButtons) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-edge-subtle pt-4 mt-4">
      <div className="text-sm text-brand-muted">
        Showing <span className="font-semibold text-ink-primary">{totalCount > 0 ? startRange : 0}</span> to{' '}
        <span className="font-semibold text-ink-primary">{endRange}</span> of{' '}
        <span className="font-semibold text-ink-primary">{totalCount}</span> results
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={pageSize}
          onChange={(e) => {
            onChangePageSize(Number(e.target.value));
            onChangePage(1);
          }}
          className="rounded-lg border border-edge bg-white px-2.5 py-1.5 text-sm text-ink-primary"
        >
          {[10, 25, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size} per page
            </option>
          ))}
        </select>
        <div className="flex items-center rounded-lg border border-edge bg-white overflow-hidden">
          <button
            onClick={() => onChangePage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm font-semibold text-ink-primary hover:bg-surface-muted disabled:opacity-40 transition-colors border-r border-edge"
          >
            Prev
          </button>
          {pages.map((p) => (
            <button
              key={p}
              onClick={() => onChangePage(p)}
              className={`px-3 py-1.5 text-sm font-semibold border-r border-edge last:border-0 transition-colors ${
                page === p
                  ? 'bg-surface-muted text-ink-accent'
                  : 'text-ink-primary hover:bg-surface-muted'
              }`}
            >
              {p}
            </button>
          ))}
          <button
            onClick={() => onChangePage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm font-semibold text-ink-primary hover:bg-surface-muted disabled:opacity-40 transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function OrdersTab({ authFetch, initialStatus = 'ALL', title = 'orders' }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [status, setStatus] = useState(initialStatus);
  const [paymentStatus, setPaymentStatus] = useState('ALL');
  const [sort, setSort] = useState('newest');
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query);
    }, 450);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page,
      page_size: pageSize,
      status,
      payment_status: paymentStatus,
      search: debouncedQuery,
      ordering: sort,
    });
    authFetch(`/api/admin/orders/?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setOrders(d.results || []);
        setTotalCount(d.count || 0);
      })
      .catch(() => {
        setOrders([]);
        setTotalCount(0);
      })
      .finally(() => setLoading(false));
  }, [authFetch, page, pageSize, status, paymentStatus, debouncedQuery, sort]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    authFetch('/api/admin/orders/stats/')
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, [authFetch]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, status, paymentStatus, sort]);

  const getStatusCount = (s) => {
    if (!stats) return '';
    const key = `${s.toLowerCase()}_orders`;
    return stats[key] !== undefined ? ` (${stats[key]})` : '';
  };

  const deleteOrder = (o, e) => {
    e.stopPropagation();
    if (confirm(`Permanently delete Order #${o.id}? This action cannot be undone.`)) {
      authFetch(`/api/admin/orders/${o.id}/`, { method: 'DELETE' })
        .then(() => {
          if (detail?.id === o.id) setDetail(null);
          load();
        })
        .catch((err) => alert(err.message || 'Could not delete order.'));
    }
  };

  if (loading && orders.length === 0) return <p className="text-sm text-brand-muted font-medium">Loading orders…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-stretch gap-3">
        <div className="min-w-0 flex-1 grid gap-2 rounded-md border border-edge bg-white p-2.5 sm:grid-cols-2 xl:grid-cols-[1fr_auto_auto_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search orders, customer, payment ID" className="w-full rounded-sm border border-edge py-2 pl-9 pr-3 text-sm" />
          </label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-sm border border-edge px-3 py-2 text-sm">
            <option value="ALL">All statuses</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{orderStatusLabel(s)}{getStatusCount(s)}</option>)}
          </select>
          <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="rounded-sm border border-edge px-3 py-2 text-sm">
            <option value="ALL">All payments</option>
            {Object.keys(PAYMENT_STATUS_COLOR).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-sm border border-edge px-3 py-2 text-sm">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="total">Highest total</option>
          </select>
        </div>
        <button
          onClick={() => { setDetail(null); setShowCreate(true); }}
          className="inline-flex items-center gap-2 rounded-md bg-ink-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-ink-primary/90 active:scale-95 transition-all shadow-card whitespace-nowrap flex-shrink-0"
        >
          <Plus className="h-4 w-4" /> Create order
        </button>
      </div>

      <div className="overflow-x-auto rounded-md border border-edge bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-muted text-[12px] font-medium uppercase tracking-wide text-ink-muted border-b border-edge">
            <tr>
              <th className="px-3 py-3 font-medium">Order</th>
              <th className="px-3 py-3 font-medium">Customer</th>
              <th className="px-3 py-3 font-medium">Payment</th>
              <th className="px-3 py-3 font-medium">Total</th>
              <th className="px-3 py-3 font-medium">Date</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="cursor-pointer border-t border-edge-subtle hover:bg-surface-muted transition-colors" onClick={() => { setShowCreate(false); setDetail(o); }}>
                <td className="px-3 py-3"><p className="font-semibold text-ink-primary">#{o.id}</p><p className="text-[12px] text-brand-muted">{o.region_code || o.region}</p></td>
                <td className="px-3 py-3"><p className="font-semibold text-ink-primary">{o.shipping_name || 'Customer'}</p><p className="text-brand-muted">{o.email}</p></td>
                <td className="px-3 py-3">
                  <span className={`rounded px-1.5 py-0.5 text-[12px] font-semibold ${PAYMENT_STATUS_COLOR[o.payment_status] || 'bg-surface-muted text-ink-secondary'}`}>{o.payment_status || 'PAID'}</span>
                  <p className="mt-0.5 font-mono text-[13px] text-ink-subtle">{o.payment_method}</p>
                </td>
                <td className="px-3 py-3 font-semibold text-ink-primary">{o.currency_code} {o.total}</td>
                <td className="px-3 py-3 text-brand-muted">{formatDateTime(o.created_at)}</td>
                <td className="px-3 py-3"><span className={`rounded-xs px-2 py-0.5 text-[13px] font-semibold ${STATUS_COLOR[o.status]}`}>{orderStatusLabel(o.status)}</span></td>
                <td className="px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end items-center gap-1.5">
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          const res = await authFetch(`/api/admin/orders/${o.id}/invoice/`);
                          if (!res.ok) {
                            const text = await res.text().catch(() => '');
                            throw new Error(`HTTP ${res.status}: ${text || 'Download failed'}`);
                          }
                          const blob = await res.blob();
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `Invoice_Order_${o.id}.pdf`;
                          document.body.appendChild(a);
                          a.click();
                          a.remove();
                          window.URL.revokeObjectURL(url);
                        } catch (err) {
                          alert(`Could not download invoice PDF: ${err.message}`);
                        }
                      }}
                      className="inline-flex items-center gap-1 rounded bg-surface-muted border border-edge px-2 py-1 text-[11px] font-semibold text-ink-primary hover:bg-surface-subtle transition cursor-pointer"
                      title="Download Invoice PDF"
                    >
                      <Download className="h-3 w-3 text-brand-accent" /> Invoice
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCreate(false);
                        setDetail(o);
                      }}
                      className="inline-flex items-center gap-1 rounded bg-surface-muted border border-edge px-2 py-1 text-[11px] font-semibold text-ink-primary hover:bg-surface-subtle transition cursor-pointer"
                      title="View Order / Print Packing Slip"
                    >
                      <Printer className="h-3 w-3 text-ink-secondary" /> Details & Slip
                    </button>
                    <button onClick={(e) => deleteOrder(o, e)} className="text-brand-muted hover:text-brand-danger ml-0.5" title="Delete order permanently">
                      <Trash2 className="h-4 w-4 inline-block" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!orders.length && (
              <tr><td colSpan={7} className="px-3 py-10 text-center text-sm text-brand-muted">
                {query || status !== 'ALL' || paymentStatus !== 'ALL'
                  ? 'No orders match these filters.'
                  : <span>No orders yet. <button onClick={() => setShowCreate(true)} className="text-ink-accent font-semibold hover:underline">Create your first order →</button></span>}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalCount > pageSize && (
        <PaginationControls
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          onChangePage={setPage}
          onChangePageSize={setPageSize}
        />
      )}

      {detail && !showCreate && (
        <OrderDetail authFetch={authFetch} order={detail} onClose={() => setDetail(null)} onChanged={(next) => { setDetail(next); load(); }} />
      )}
      {showCreate && (
        <CreateOrderPanel
          authFetch={authFetch}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </div>
  );
}


/* ------------------------------------------------------------ Abandoned */
function AbandonedTab({ authFetch }) {
  const [carts, setCarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [sort, setSort] = useState('recent');

  const load = useCallback(() => {
    setLoading(true);
    authFetch('/api/admin/abandoned-checkouts/')
      .then((r) => r.json())
      .then((d) => setCarts(Array.isArray(d) ? d : []))
      .catch(() => setCarts([]))
      .finally(() => setLoading(false));
  }, [authFetch]);
  useEffect(() => { load(); }, [load]);

  const updateRecovery = (cart, nextStatus) => {
    authFetch(`/api/admin/abandoned-checkouts/${cart.id || cart.session_id}/update_recovery/`, {
      method: 'POST',
      body: JSON.stringify({ recovery_status: nextStatus }),
    }).then(load);
  };

  if (loading) return <p className="text-sm text-brand-muted">Loading...</p>;

  const filtered = carts
    .filter((c) => status === 'ALL' || c.recovery_status === status)
    .filter((c) => {
      const haystack = normalize(`${c.email} ${c.session_id} ${c.region}`);
      return !query || haystack.includes(normalize(query));
    })
    .sort((a, b) => {
      if (sort === 'value') return Number(b.value || 0) - Number(a.value || 0);
      return (b.updated_at || '').localeCompare(a.updated_at || '');
    });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-md border border-edge bg-white p-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search email, session ID" className="w-full rounded-sm border border-edge py-2.5 pl-9 pr-3 text-sm" />
        </label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-sm border border-edge px-3 py-2.5 text-sm">
          <option value="ALL">All recovery states</option>
          {Object.keys(RECOVERY_STATUS_COLOR).map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-sm border border-edge px-3 py-2.5 text-sm">
          <option value="recent">Recently active</option>
          <option value="value">Highest value</option>
        </select>
      </div>
      {filtered.map((c) => (
        <div key={c.id || c.session_id} className="rounded-md border border-edge bg-white shadow-card p-4">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-sm font-semibold text-ink-primary">{c.email || 'Guest'} <span className="ml-1 rounded bg-surface-muted px-1.5 py-0.5 text-[12px] font-semibold text-ink-secondary">{c.region}</span></p>
              <p className="text-[13px] text-brand-muted">{c.item_count} item(s) · {(c.items || []).map((i) => `${i.qty || i.quantity}× ${i.name}`).join(', ')}</p>
              <p className="mt-1 font-mono text-[12px] text-ink-subtle">{c.session_id}</p>
              {c.entity_type === 'PAYMENT_ATTEMPT' && <p className="mt-1 text-[12px] font-semibold text-amber-700">Awaiting confirmed {c.payment_method} payment · checked automatically</p>}
            </div>
            <div className="text-left sm:text-right">
              <p className="text-sm font-semibold text-ink-primary">{c.currency || 'GBP'} {c.value}</p>
              <p className="text-[12px] text-ink-subtle">Active {formatDateTime(c.updated_at)}</p>
              <p className="mt-1 text-[12px] text-brand-muted">{c.recovery_attempts || 0} recovery attempt(s)</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-edge-subtle pt-3">
            <span className={`rounded-xs px-2 py-0.5 text-[12px] font-semibold ${RECOVERY_STATUS_COLOR[c.recovery_status] || RECOVERY_STATUS_COLOR.NOT_CONTACTED}`}>{(c.recovery_status || 'NOT_CONTACTED').replace('_', ' ')}</span>
            {c.entity_type !== 'PAYMENT_ATTEMPT' && <div className="flex flex-wrap gap-2">
              <button onClick={() => updateRecovery(c, 'CONTACTED')} className="rounded-sm border border-edge px-3 py-1.5 text-sm font-semibold text-ink-primary hover:border-ink-primary"><MessageSquare className="mr-1 inline h-3.5 w-3.5" />Mark contacted</button>
              <button onClick={() => updateRecovery(c, 'RECOVERED')} className="rounded-sm border border-edge px-3 py-1.5 text-sm font-semibold text-ink-primary hover:border-brand-success"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />Recovered</button>
            </div>}
          </div>
        </div>
      ))}
      {!filtered.length && <p className="rounded-md border border-edge bg-white shadow-card p-6 text-sm text-brand-muted">No abandoned checkouts match these filters.</p>}
    </div>
  );
}

/* ----------------------------------------------------------- Payments */
function PaymentsTab({ authFetch, regions }) {
  const [activeSubTab, setActiveSubTab] = useState('routing'); // routing | webhooks | fraud
  const [gateways, setGateways] = useState([]);
  const [providerCatalog, setProviderCatalog] = useState([]);
  const [webhookEvents, setWebhookEvents] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [fraudRules, setFraudRules] = useState({
    block_countries: '',
    min_cod_amount: '',
    block_suspicious_emails: true
  });
  const [savingFraud, setSavingFraud] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      authFetch('/api/admin/payment-gateways/').then((r) => r.json()).catch(() => []),
      authFetch('/api/admin/payment-gateways/catalog/').then((r) => r.json()).catch(() => []),
      authFetch('/api/admin/incoming-webhooks/').then((r) => r.json()).catch(() => []),
      authFetch('/api/admin/orders/').then((r) => r.json()).catch(() => []),
      authFetch('/api/admin/settings/PAYMENT_FRAUD_RULES/')
        .then((r) => r.ok ? r.json().then(d => d.value) : null)
        .catch(() => null),
    ]).then(([g, catalogData, webhookData, o, fraudData]) => {
      setGateways(Array.isArray(g) ? g : g.results || []);
      setProviderCatalog(Array.isArray(catalogData) ? catalogData : catalogData.results || []);
      setWebhookEvents(Array.isArray(webhookData) ? webhookData : webhookData.results || []);
      setOrders(Array.isArray(o) ? o : o.results || []);
      if (fraudData) {
        setFraudRules(fraudData);
      }
    }).finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const save = () => {
    const isNew = !form.id;
    authFetch(isNew ? '/api/admin/payment-gateways/' : `/api/admin/payment-gateways/${form.id}/`, {
      method: isNew ? 'POST' : 'PUT',
      body: JSON.stringify({
        code: form.code,
        display_name: form.display_name,
        region: form.region,
        is_enabled: form.is_enabled,
        mode: form.mode,
        publishable_key: form.publishable_key || '',
        secret_key: form.secret_key || '',
        ...((form.webhook_secret || form.webhook_id) ? {
          extra_config: form.code === 'PAYPAL'
            ? { webhook_id: form.webhook_id }
            : { webhook_secret: form.webhook_secret },
        } : {}),
        supports_refunds: form.supports_refunds,
        sort_order: Number(form.sort_order || 0)
      })
    }).then((r) => r.json()).then(() => {
      setForm(null);
      load();
    });
  };

  const saveFraud = () => {
    setSavingFraud(true);
    authFetch('/api/admin/settings/PAYMENT_FRAUD_RULES/', {
      method: 'PUT',
      body: JSON.stringify({ key: 'PAYMENT_FRAUD_RULES', value: fraudRules, description: 'Storefront payment fraud protection settings' })
    })
      .then((r) => {
        if (r.status === 404) {
          return authFetch('/api/admin/settings/', {
            method: 'POST',
            body: JSON.stringify({ key: 'PAYMENT_FRAUD_RULES', value: fraudRules, description: 'Storefront payment fraud protection settings' })
          });
        }
        return r;
      })
      .then(() => alert('Fraud prevention rules updated successfully!'))
      .finally(() => setSavingFraud(false));
  };

  const toggle = (g) => authFetch(`/api/admin/payment-gateways/${g.id}/`, { method: 'PATCH', body: JSON.stringify({ is_enabled: !g.is_enabled }) }).then(load);
  const del = (g) => authFetch(`/api/admin/payment-gateways/${g.id}/`, { method: 'DELETE' }).then(load);
  const syncStatus = (g) => {
    authFetch(`/api/admin/payment-gateways/${g.id}/sync_status/`, { method: 'POST', body: JSON.stringify({}) })
      .then((r) => r.json())
      .then((d) => {
        const stale = d && typeof d.stale_count === 'number' ? d.stale_count : '?';
        const pending = d && typeof d.pending_total === 'number' ? d.pending_total : '?';
        alert(`Sync complete for ${g.display_name}: ${pending} pending, ${stale} flagged stale.`);
      })
      .catch(() => alert('Sync failed — check the gateway logs.'));
  };
  const testConnection = (gateway) => {
    authFetch(`/api/admin/payment-gateways/${gateway.id}/test_connection/`, { method: 'POST', body: JSON.stringify({}) })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Connection test failed.');
        alert(data.message || 'Connection verified.');
      })
      .catch((error) => alert(error.message));
  };
  const retryWebhook = (event) => {
    authFetch(`/api/admin/incoming-webhooks/${event.id}/retry/`, { method: 'POST', body: JSON.stringify({}) })
      .then((response) => {
        if (!response.ok) throw new Error('Could not queue this webhook for retry.');
        load();
      })
      .catch((error) => alert(error.message));
  };
  const regionCode = (id) => regions.find((r) => r.id === id)?.code || id;

  if (loading) return <p className="text-sm text-brand-muted">Loading gateways and rules registry...</p>;

  const manualCapture = orders.filter((o) => ['AUTHORIZED', 'PARTIALLY_CAPTURED', 'PENDING'].includes(o.payment_status));

  // Sort gateways: region code first, then sort_order priority
  const sortedGateways = [...gateways].sort((a, b) => {
    const regA = a.region_code || regionCode(a.region);
    const regB = b.region_code || regionCode(b.region);
    if (regA !== regB) return regA.localeCompare(regB);
    return Number(a.sort_order || 0) - Number(b.sort_order || 0);
  });

  return (
    <div className="space-y-4">
      {/* Subtab Navigation */}
      <div className="flex gap-2 border-b border-edge-subtle pb-2">
        <button onClick={() => setActiveSubTab('routing')} className={`px-4 py-1.5 text-sm font-semibold uppercase rounded-sm ${activeSubTab === 'routing' ? 'bg-ink-primary text-white' : 'text-ink-primary hover:bg-surface-muted'}`}>Gateway Routing &amp; Priority</button>
        <button onClick={() => setActiveSubTab('webhooks')} className={`px-4 py-1.5 text-sm font-semibold uppercase rounded-sm ${activeSubTab === 'webhooks' ? 'bg-ink-primary text-white' : 'text-ink-primary hover:bg-surface-muted'}`}>Webhook Operations</button>
        <button onClick={() => setActiveSubTab('fraud')} className={`px-4 py-1.5 text-sm font-semibold uppercase rounded-sm ${activeSubTab === 'fraud' ? 'bg-ink-primary text-white' : 'text-ink-primary hover:bg-surface-muted'}`}>Fraud Prevention Rules</button>
      </div>

      {activeSubTab === 'routing' ? (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-md border border-edge bg-white shadow-card p-4"><p className="text-sm text-brand-muted">Gateways</p><p className="mt-1 text-2xl font-semibold text-ink-primary">{gateways.length}</p></div>
            <div className="rounded-md border border-edge bg-white shadow-card p-4"><p className="text-sm text-brand-muted">Manual capture queue</p><p className="mt-1 text-2xl font-semibold text-ink-primary">{manualCapture.length}</p></div>
            <div className="rounded-md border border-edge bg-white shadow-card p-4"><p className="text-sm text-brand-muted">Captured orders</p><p className="mt-1 text-2xl font-semibold text-ink-primary">{orders.filter((o) => (o.payment_status || 'PAID') === 'PAID').length}</p></div>
          </div>
          <div className="flex items-center justify-between"><p className="text-sm text-brand-muted">{gateways.length} gateways · region-routed by priority</p><button onClick={() => setForm({ code: providerCatalog[0]?.code || 'RAZORPAY', display_name: providerCatalog[0]?.name || '', region: regions[0]?.id, is_enabled: false, mode: 'TEST', publishable_key: '', secret_key: '', webhook_secret: '', webhook_id: '', supports_refunds: true, sort_order: 0 })} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm uppercase"><Plus className="h-4 w-4" /> New gateway</button></div>
          
          <div className="space-y-2">
            {sortedGateways.map((g) => (
              <div key={g.id} className="flex items-center justify-between rounded-md border border-edge bg-white p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-ink-primary">{g.display_name} <span className="font-mono text-[12px] text-brand-muted">{g.code}</span></p>
                    <span className="rounded bg-surface-muted text-ink-accent px-1.5 py-0.2 text-[13px] font-semibold">Priority #{g.sort_order || 0}</span>
                  </div>
                  <p className="text-[13px] text-brand-muted">Region {g.region_code || regionCode(g.region)} · {g.mode} · {g.is_configured ? 'configured' : 'keys missing'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => toggle(g)} className={`rounded-xs px-2 py-0.5 text-[12px] font-medium uppercase tracking-wide ${g.is_enabled ? 'bg-brand-success/10 text-ink-success' : 'bg-surface-muted text-ink-muted'}`}>{g.is_enabled ? 'ENABLED' : 'DISABLED'}</button>
                  <button onClick={() => syncStatus(g)} title="Reconcile recent orders against this gateway" className="rounded-sm border border-edge px-2 py-1 text-[12px] font-medium uppercase text-ink-primary hover:bg-surface-muted">Sync recent</button>
                  <button onClick={() => testConnection(g)} title="Verify the saved credentials" className="rounded-sm border border-edge px-2 py-1 text-[12px] font-medium uppercase text-ink-primary hover:bg-surface-muted">Test</button>
                  <button onClick={() => setForm({ ...g, webhook_secret: '', webhook_id: '' })} className="text-ink-accent hover:opacity-70"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => del(g)} className="text-brand-muted hover:text-brand-danger"><X className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-md border border-edge bg-white">
            <div className="flex items-center gap-2 border-b border-edge-subtle px-4 py-3"><ReceiptText className="h-4 w-4 text-ink-accent" /><p className="text-sm font-semibold text-ink-primary">Authorization and capture queue</p></div>
            <div className="divide-y divide-edge-subtle">
              {manualCapture.slice(0, 6).map((o) => (
                <div key={o.id} className="flex flex-col justify-between gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center">
                  <div><p className="font-semibold text-ink-primary">Order #{o.id} | {o.email}</p><p className="text-sm text-brand-muted">{o.payment_method} | {formatMoney(o.currency_code, o.payment_captured_amount)} captured of {formatMoney(o.currency_code, o.payment_authorized_amount || o.total)}</p></div>
                  <span className={`w-fit rounded-xs px-2 py-0.5 text-[12px] font-semibold ${PAYMENT_STATUS_COLOR[o.payment_status] || 'bg-surface-muted text-ink-secondary'}`}>{o.payment_status || 'PENDING'}</span>
                </div>
              ))}
              {!manualCapture.length && <p className="px-4 py-5 text-sm text-brand-muted">No orders are waiting for manual capture.</p>}
            </div>
          </div>
        </div>
      ) : activeSubTab === 'webhooks' ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-edge bg-white p-5">
            <h3 className="text-sm font-semibold text-ink-primary">Incoming payment webhooks</h3>
            <p className="mt-1 text-sm text-brand-muted">Review delivery status and safely replay failed events. Duplicate provider event IDs remain idempotent.</p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-edge bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-surface-muted text-left text-ink-muted"><tr><th className="px-4 py-3">Provider</th><th className="px-4 py-3">Event</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Attempts</th><th className="px-4 py-3">Received</th><th className="px-4 py-3"></th></tr></thead>
              <tbody className="divide-y divide-edge-subtle">
                {webhookEvents.slice(0, 50).map((event) => (
                  <tr key={event.id}>
                    <td className="px-4 py-3 font-semibold text-ink-primary">{event.gateway}</td>
                    <td className="px-4 py-3"><p className="font-medium text-ink-primary">{event.event_type}</p><p className="max-w-[240px] truncate font-mono text-[12px] text-ink-subtle">{event.event_id || event.id}</p></td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[12px] font-semibold ${event.status === 'PROCESSED' ? 'bg-brand-success/10 text-ink-success' : event.status === 'PENDING' ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-ink-danger'}`}>{event.status}</span></td>
                    <td className="px-4 py-3 text-ink-secondary">{event.attempts || 0}</td>
                    <td className="px-4 py-3 text-ink-secondary">{formatDateTime(event.created_at)}</td>
                    <td className="px-4 py-3 text-right">{event.status !== 'PROCESSED' && <button onClick={() => retryWebhook(event)} className="btn-secondary px-3 py-1.5 text-xs"><RefreshCw className="h-3.5 w-3.5" /> Retry</button>}</td>
                  </tr>
                ))}
                {!webhookEvents.length && <tr><td colSpan="6" className="px-4 py-8 text-center text-brand-muted">No payment webhooks have been received yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeSubTab === 'fraud' ? (
        <div className="bg-white rounded-lg border border-edge p-5 space-y-4">
          <h3 className="text-sm font-semibold text-ink-primary">Checkout Fraud Filters</h3>
          <p className="text-sm text-brand-muted">Configure security threshold metrics to restrict checkout routing for high-risk buyers.</p>

          <div className="space-y-3 text-sm max-w-md">
            <div>
              <label className="block font-semibold text-ink-primary mb-1">Blocked Countries (Comma separated codes)</label>
              <input type="text" value={fraudRules.block_countries || ''} onChange={(e) => setFraudRules({ ...fraudRules, block_countries: e.target.value })} placeholder="e.g. RU, CN, IR" className="w-full rounded-sm border border-edge p-2.5 font-mono" />
            </div>

            <div>
              <label className="block font-semibold text-ink-primary mb-1">Minimum COD Order Amount (GBP value equivalent)</label>
              <input type="number" value={fraudRules.min_cod_amount || ''} onChange={(e) => setFraudRules({ ...fraudRules, min_cod_amount: e.target.value })} placeholder="e.g. 20" className="w-full rounded-sm border border-edge p-2.5" />
              <p className="text-[12px] text-ink-subtle mt-1">Orders below this value will not be allowed to checkout using Cash on Delivery (prevent fake orders).</p>
            </div>

            <div>
              <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-ink-primary">
                <input type="checkbox" checked={fraudRules.block_suspicious_emails} onChange={(e) => setFraudRules({ ...fraudRules, block_suspicious_emails: e.target.checked })} className="accent-ink-primary" />
                Flag and block disposable/temporary email addresses
              </label>
            </div>

            <button onClick={saveFraud} disabled={savingFraud} className="btn-primary py-2.5 px-6 font-semibold uppercase text-sm disabled:opacity-50">
              {savingFraud ? 'Saving...' : 'Save Fraud Settings'}
            </button>
          </div>
        </div>
      ) : null}

      {form && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-surface-muted overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
          <div className="w-full max-w-md bg-white rounded-lg border border-edge p-6 shadow-card">
            <h3 className="mb-4 text-lg font-semibold text-ink-primary">{form.id ? 'Edit' : 'New'} gateway</h3>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <select value={form.code} onChange={(e) => { const definition = providerCatalog.find((item) => item.code === e.target.value); setForm({ ...form, code: e.target.value, display_name: form.id ? form.display_name : (definition?.name || e.target.value) }); }} className="rounded-sm border border-edge p-2.5">
                  {providerCatalog.map((provider) => <option key={provider.code} value={provider.code}>{provider.name}</option>)}
                </select>
                <select value={form.region} onChange={(e) => setForm({ ...form, region: Number(e.target.value) })} className="rounded-sm border border-edge p-2.5">
                  {regions.map((r) => <option key={r.id} value={r.id}>{r.code} — {r.name}</option>)}
                </select>
              </div>
              <input placeholder="Display name" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} className="w-full rounded-sm border border-edge p-2.5" />
              {providerCatalog.find((item) => item.code === form.code)?.description && <p className="rounded-sm bg-surface-muted px-3 py-2 text-[13px] text-ink-secondary">{providerCatalog.find((item) => item.code === form.code).description}</p>}
              <div className="grid grid-cols-2 gap-3">
                <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} className="rounded-sm border border-edge p-2.5">
                  <option value="TEST">Test</option>
                  <option value="LIVE">Live</option>
                </select>
                <label className="flex items-center gap-2 text-ink-primary font-semibold"><input type="checkbox" checked={form.supports_refunds} onChange={(e) => setForm({ ...form, supports_refunds: e.target.checked })} className="accent-ink-primary" /> Refunds</label>
              </div>
              <input placeholder="Publishable / Key ID" value={form.publishable_key || ''} onChange={(e) => setForm({ ...form, publishable_key: e.target.value })} className="w-full rounded-sm border border-edge p-2.5" />
              <PasswordInput autoComplete="new-password" placeholder="Secret key (leave blank to keep current)" value={form.secret_key || ''} onChange={(e) => setForm({ ...form, secret_key: e.target.value })} className="w-full rounded-sm border border-edge p-2.5" />
              {form.code === 'PAYPAL' ? (
                <input placeholder="Webhook ID (leave blank to keep current)" value={form.webhook_id || ''} onChange={(e) => setForm({ ...form, webhook_id: e.target.value })} className="w-full rounded-sm border border-edge p-2.5" />
              ) : form.code !== 'COD' ? (
                <PasswordInput autoComplete="new-password" placeholder="Webhook signing secret (leave blank to keep current)" value={form.webhook_secret || ''} onChange={(e) => setForm({ ...form, webhook_secret: e.target.value })} className="w-full rounded-sm border border-edge p-2.5" />
              ) : null}
              {form.code !== 'COD' && <div className="rounded-sm border border-edge bg-surface-muted px-3 py-2 text-[12px] text-ink-secondary"><span className="font-semibold text-ink-primary">Webhook URL:</span> {providerCatalog.find((item) => item.code === form.code)?.webhook_path || `/api/webhooks/payment/${form.code.toLowerCase()}/`}</div>}
              
              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block font-semibold text-ink-subtle mb-1">Priority Order</label>
                  <input type="number" placeholder="0" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} className="w-full rounded-sm border border-edge p-2" />
                </div>
                <label className="flex items-center gap-2 text-ink-primary font-semibold self-end mb-2"><input type="checkbox" checked={form.is_enabled} onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })} className="accent-ink-primary" /> Enabled</label>
              </div>

              <div className="flex gap-2">
                <button onClick={save} className="btn-primary flex-1 py-2.5 uppercase font-semibold">Save</button>
                <button onClick={() => setForm(null)} className="flex-1 rounded-sm border border-edge py-2.5 font-semibold uppercase">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- Emails */
// Every event the backend can send. Keep in step with seed_email_templates.py —
// an event missing here cannot be edited by the admin at all.
const EMAIL_EVENTS = [
  ['order_confirmation', 'Order confirmation'],
  ['order_shipped', 'Order shipped'],
  ['shipment_dispatched', 'Shipment dispatched'],
  ['order_delivered', 'Order delivered'],
  ['order_cancelled', 'Order cancelled'],
  ['payment_failed', 'Payment failed'],
  ['refund_processed', 'Refund processed'],
  ['abandoned_cart', 'Abandoned cart reminder'],
  ['review_request', 'Review request'],
  ['welcome', 'Welcome'],
  ['password_reset', 'Password reset'],
  ['contact_received', 'Contact form received'],
];
/* SMTP delivery settings — stored in SystemSetting('SMTP_SETTINGS'), which the
   email service reads on every send. The password is write-only: the API
   redacts it on read and keeps the stored value when submitted blank. */
const SMTP_PRESETS = [
  { label: 'Microsoft 365 / Outlook (GoDaddy email)', host: 'smtp.office365.com', port: '587', tls: true, ssl: false },
  { label: 'GoDaddy classic Workspace email', host: 'smtpout.secureserver.net', port: '465', tls: false, ssl: true },
  { label: 'Gmail / Google Workspace', host: 'smtp.gmail.com', port: '587', tls: true, ssl: false },
];

function SmtpSettingsCard({ authFetch }) {
  const [cfg, setCfg] = useState({
    EMAIL_HOST: '', EMAIL_PORT: '587', EMAIL_USE_TLS: true, EMAIL_USE_SSL: false,
    EMAIL_HOST_USER: '', EMAIL_HOST_PASSWORD: '', DEFAULT_FROM_EMAIL: '',
  });
  const [passwordConfigured, setPasswordConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const asBool = (v) => v === true || ['true', '1', 'yes'].includes(String(v).toLowerCase());

  useEffect(() => {
    authFetch('/api/admin/settings/SMTP_SETTINGS/')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const v = d?.value || {};
        setCfg((prev) => ({
          ...prev,
          EMAIL_HOST: v.EMAIL_HOST || '',
          EMAIL_PORT: String(v.EMAIL_PORT || '587'),
          EMAIL_USE_TLS: v.EMAIL_USE_TLS === undefined ? true : asBool(v.EMAIL_USE_TLS),
          EMAIL_USE_SSL: asBool(v.EMAIL_USE_SSL),
          EMAIL_HOST_USER: v.EMAIL_HOST_USER || '',
          EMAIL_HOST_PASSWORD: '',
          DEFAULT_FROM_EMAIL: v.DEFAULT_FROM_EMAIL || '',
        }));
        setPasswordConfigured((d?.sensitive_fields_configured || []).includes('EMAIL_HOST_PASSWORD'));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authFetch]);

  const set = (key, value) => setCfg((prev) => ({ ...prev, [key]: value }));

  const applyPreset = (preset) => {
    setCfg((prev) => ({
      ...prev,
      EMAIL_HOST: preset.host,
      EMAIL_PORT: preset.port,
      EMAIL_USE_TLS: preset.tls,
      EMAIL_USE_SSL: preset.ssl,
    }));
  };

  const save = () => {
    // The From address must be a real address ("Name <email>" is also fine) —
    // a bare display name is silently rejected by most mail servers.
    if (cfg.DEFAULT_FROM_EMAIL && !cfg.DEFAULT_FROM_EMAIL.includes('@')) {
      setError('The From address must be an email, e.g. support@scleroproteins.co.uk or "Sclero Proteins <support@scleroproteins.co.uk>".');
      return Promise.reject(new Error('invalid_from'));
    }
    setSaving(true);
    setNotice('');
    setError('');
    return authFetch('/api/admin/settings/SMTP_SETTINGS/', {
      method: 'PUT',
      body: JSON.stringify({
        key: 'SMTP_SETTINGS',
        value: {
          ...cfg,
          EMAIL_PORT: String(cfg.EMAIL_PORT || '587'),
          EMAIL_USE_TLS: Boolean(cfg.EMAIL_USE_TLS),
          EMAIL_USE_SSL: Boolean(cfg.EMAIL_USE_SSL),
        },
        description: 'SMTP mail server used for all transactional email',
      }),
    })
      .then((r) => {
        if (!r.ok) throw new Error('The server rejected the settings.');
        setNotice('Email settings saved. Send a test below to confirm delivery.');
        if (cfg.EMAIL_HOST_PASSWORD) setPasswordConfigured(true);
        set('EMAIL_HOST_PASSWORD', '');
      })
      .catch((e) => {
        if (e.message !== 'invalid_from') setError(e.message || 'Could not save email settings.');
        throw e;
      })
      .finally(() => setSaving(false));
  };

  // Always test what is on screen: save the form first, then send. Otherwise a
  // stale saved config gets tested while the admin looks at different values.
  const sendTest = () => {
    save()
      .then(() => {
        setTesting(true);
        setNotice('');
        setError('');
        return authFetch('/api/admin/smtp-test/', {
          method: 'POST',
          body: JSON.stringify({ email: testEmail }),
        })
          .then(async (r) => {
            const d = await r.json().catch(() => ({}));
            if (!r.ok) throw new Error(d.error || 'Test send failed.');
            setNotice(d.message || 'Test email sent.');
          })
          .catch((e) => setError(e.message))
          .finally(() => setTesting(false));
      })
      .catch(() => {});
  };

  if (loading) return null;

  return (
    <form onSubmit={(e) => { e.preventDefault(); save(); }} className="mb-6 rounded-md border border-edge bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-ink-primary">Email delivery (SMTP)</h3>
          <p className="mt-1 text-sm text-brand-muted">
            The mail server used for every store email — order confirmations, sign-in links,
            shipping updates. Use a preset, enter your mailbox login, save, then send a test.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SMTP_PRESETS.map((p) => (
            <button key={p.host} type="button" onClick={() => applyPreset(p)}
              className="rounded-full border border-dashed border-edge px-2.5 py-1 text-[12px] font-semibold text-ink-muted hover:border-ink-primary hover:text-ink-primary">
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="kicker mb-1 block">SMTP host</label>
          <input value={cfg.EMAIL_HOST} onChange={(e) => set('EMAIL_HOST', e.target.value)} className="w-full rounded-sm border border-edge p-2.5" placeholder="e.g. smtp.office365.com" />
        </div>
        <div>
          <label className="kicker mb-1 block">Port</label>
          <input value={cfg.EMAIL_PORT} onChange={(e) => set('EMAIL_PORT', e.target.value)} className="w-full rounded-sm border border-edge p-2.5" placeholder="587" />
        </div>
        <div className="flex items-end gap-4 pb-1">
          <label className="flex cursor-pointer items-center gap-1.5 font-semibold text-ink-primary">
            <input type="checkbox" checked={cfg.EMAIL_USE_TLS} onChange={(e) => set('EMAIL_USE_TLS', e.target.checked)} className="h-4 w-4 accent-ink-primary" /> TLS
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 font-semibold text-ink-primary">
            <input type="checkbox" checked={cfg.EMAIL_USE_SSL} onChange={(e) => set('EMAIL_USE_SSL', e.target.checked)} className="h-4 w-4 accent-ink-primary" /> SSL
          </label>
        </div>
        <div>
          <label className="kicker mb-1 block">Username (mailbox)</label>
          <input value={cfg.EMAIL_HOST_USER} onChange={(e) => set('EMAIL_HOST_USER', e.target.value)} className="w-full rounded-sm border border-edge p-2.5" placeholder="support@scleroproteins.co.uk" autoComplete="off" />
        </div>
        <div>
          <label className="kicker mb-1 block">Password {passwordConfigured && <span className="normal-case font-normal text-ink-success">— configured, blank keeps current</span>}</label>
          <input type="password" value={cfg.EMAIL_HOST_PASSWORD} onChange={(e) => set('EMAIL_HOST_PASSWORD', e.target.value)} className="w-full rounded-sm border border-edge p-2.5" placeholder={passwordConfigured ? '••••••••' : 'Mailbox password'} autoComplete="new-password" />
        </div>
        <div>
          <label className="kicker mb-1 block">From address</label>
          <input value={cfg.DEFAULT_FROM_EMAIL} onChange={(e) => set('DEFAULT_FROM_EMAIL', e.target.value)} className="w-full rounded-sm border border-edge p-2.5" placeholder="support@scleroproteins.co.uk" />
        </div>
      </div>

      {notice && <p className="mt-3 rounded-lg border border-brand-success/30 bg-brand-success/10 px-3 py-2 text-sm font-semibold text-ink-success">{notice}</p>}
      {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-ink-danger">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-edge-subtle pt-4">
        <button type="submit" disabled={saving} className="btn-primary px-5 py-2.5 text-sm uppercase">{saving ? 'Saving…' : 'Save email settings'}</button>
        <div className="ml-auto flex items-center gap-2">
          <input value={testEmail} onChange={(e) => setTestEmail(e.target.value)} placeholder="Send test to…" className="w-56 rounded-sm border border-edge p-2 text-sm" />
          <button type="button" onClick={sendTest} disabled={testing || !testEmail.trim()} className="rounded-lg border border-edge px-4 py-2 text-sm font-semibold text-ink-primary hover:border-ink-primary disabled:opacity-40">
            {testing ? 'Sending…' : 'Send test email'}
          </button>
        </div>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
        Microsoft 365 note: if the test fails with an authentication error, enable
        &quot;Authenticated SMTP&quot; for the mailbox in the Microsoft 365 admin center, then retry.
      </p>
    </form>
  );
}

function EmailsTab({ authFetch, regions }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    authFetch('/api/admin/email-templates/')
      .then((r) => r.json())
      .then((d) => setTemplates(Array.isArray(d) ? d : d.results || []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const save = () => {
    const isNew = !form.id;
    authFetch(isNew ? '/api/admin/email-templates/' : `/api/admin/email-templates/${form.id}/`, {
      method: isNew ? 'POST' : 'PUT',
      body: JSON.stringify({
        event: form.event,
        region: form.region || null,
        subject: form.subject,
        body: form.body,
        is_active: form.is_active
      })
    }).then((r) => r.json()).then(() => {
      setForm(null);
      load();
    });
  };

  const del = (t) => {
    if (confirm(`Are you sure you want to delete the template for event "${t.event}"?`)) {
      authFetch(`/api/admin/email-templates/${t.id}/`, { method: 'DELETE' }).then(load);
    }
  };

  const triggerTestSend = () => {
    if (!form.id) return alert("Please save the template first before sending a test.");
    setSendingTest(true);
    authFetch(`/api/admin/email-templates/${form.id}/send_test/`, {
      method: 'POST',
      body: JSON.stringify({ email: testEmail })
    })
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error || "Unable to send test email.");
        alert(d.message || "Test email sent successfully!");
      })
      .catch(e => alert(e.message))
      .finally(() => setSendingTest(false));
  };

  const renderBodyPreview = (bodyText) => {
    return (bodyText || '')
      .replace(/{customer_name}/g, 'John Doe')
      .replace(/{order_id}/g, '#1024')
      .replace(/{total}/g, '£59.99')
      .replace(/{tax_name}/g, 'VAT');
  };

  if (loading) return <p className="text-sm text-brand-muted">Loading transactional email templates...</p>;

  return (
    <div>
      <SmtpSettingsCard authFetch={authFetch} />

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-brand-muted">{templates.length} templates · region-specific (GST / VAT)</p>
        <button onClick={() => setForm({ event: 'order_confirmation', region: '', subject: '', body: '', is_active: true })} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm uppercase font-semibold"><Plus className="h-4 w-4" /> New template</button>
      </div>

      <div className="grid gap-3">
        {templates.map((t) => (
          <div key={t.id} className="rounded-md border border-edge bg-white shadow-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-ink-primary">
                  {t.event_display || t.event.replace(/_/g, ' ').toUpperCase()} 
                  <span className="ml-2 rounded bg-surface-muted px-1.5 py-0.5 text-[12px] font-semibold text-ink-secondary uppercase">{t.region_code || 'GLOBAL'}</span>
                </p>
                <p className="mt-1 text-sm font-semibold text-ink-accent">{t.subject}</p>
                <p className="mt-1 line-clamp-2 text-sm text-brand-muted font-mono">{t.body}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setForm({ ...t, region: t.region || '' })} className="text-ink-accent hover:opacity-70"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => del(t)} className="text-brand-muted hover:text-brand-danger"><X className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {form && (
        <div className="admin-action-page flex flex-col items-center">
          <div className="my-6 w-full max-w-4xl bg-white rounded-lg border border-edge p-6 shadow-overlay space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-edge-subtle">
              <h3 className="text-lg font-semibold text-ink-primary">{form.id ? 'Edit' : 'New'} email template</h3>
              <button onClick={() => setForm(null)}><X className="h-5 w-5 text-brand-muted" /></button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Form Input fields */}
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <select value={form.event} onChange={(e) => setForm({ ...form, event: e.target.value })} className="rounded-sm border border-edge p-2.5">
                    {EMAIL_EVENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value ? Number(e.target.value) : '' })} className="rounded-sm border border-edge p-2.5">
                    <option value="">Global fallback</option>
                    {regions.map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-ink-primary mb-1">Email Subject Line</label>
                  <input placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full rounded-sm border border-edge p-2.5 text-sm font-semibold text-ink-primary" />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block font-semibold text-ink-primary">Email Template Body</label>
                    <span className="text-[12px] text-ink-accent">Supports variables: {"{customer_name}"}, {"{order_id}"}, {"{total}"}</span>
                  </div>
                  <textarea rows={8} placeholder="Body — Hello {customer_name}, your order {order_id} is processing..." value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="w-full rounded-sm border border-edge p-2.5 font-mono text-sm" />
                </div>

                <label className="flex items-center gap-2 text-ink-primary font-semibold cursor-pointer"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="accent-ink-primary" /> Active Template</label>

                {form.id && (
                  <div className="p-3 bg-surface-muted border border-edge rounded-md space-y-2">
                    <p className="font-semibold text-[12px] text-ink-primary uppercase">Send Test Email Configuration</p>
                    <div className="flex gap-2">
                      <input placeholder="admin@scleroproteins.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="flex-1 rounded-sm border border-edge p-2 text-sm" />
                      <button onClick={triggerTestSend} disabled={sendingTest} className="px-3 py-2 bg-brand-accent hover:bg-brand-accent/90 text-white font-semibold rounded-sm text-[12px] uppercase">
                        {sendingTest ? 'Sending...' : 'Send Test'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button onClick={save} className="btn-primary flex-1 py-2.5 uppercase font-semibold">Save template</button>
                  <button onClick={() => setForm(null)} className="flex-1 rounded-sm border border-edge py-2.5 font-semibold uppercase">Cancel</button>
                </div>
              </div>

              {/* Live Rendered Visual Preview */}
              <div className="rounded-lg border border-edge bg-surface-muted p-4 flex flex-col justify-start">
                <p className="text-[12px] font-semibold text-brand-muted uppercase tracking-wider mb-2 border-b border-edge pb-1.5">Live Template Split-Screen Preview</p>
                <div className="bg-white rounded-md border border-edge shadow-card p-5 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="border-b border-edge-subtle pb-2">
                      <span className="text-[13px] font-semibold text-ink-subtle block uppercase">EMAIL SUBJECT</span>
                      <span className="text-sm font-semibold text-ink-primary">{form.subject || '(No subject provided)'}</span>
                    </div>
                    <div>
                      <span className="text-[13px] font-semibold text-ink-subtle block uppercase">EMAIL BODY</span>
                      <div className="text-sm text-ink-secondary leading-relaxed font-semibold font-mono whitespace-pre-wrap mt-1">
                        {renderBodyPreview(form.body) || '(Enter body copy on the left to preview)'}
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-edge-subtle pt-3 text-center">
                    <p className="text-[13px] text-ink-subtle font-semibold uppercase">Sclero Proteins Ltd · Targeted Cellular Recovery</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- Shipping */
function ShippingTab({ authFetch, regions = [] }) {
  const [activeSubTab, setActiveSubTab] = useState('providers');
  const [zones, setZones] = useState([]);
  const [rates, setRates] = useState([]);
  const [providers, setProviders] = useState([]);
  const [providerCatalog, setProviderCatalog] = useState([]);
  const [providerForm, setProviderForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [editingZone, setEditingZone] = useState(null);  // null | zone object | 'new'
  const [editingRate, setEditingRate] = useState(null);  // null | rate object

  const load = useCallback(() => {
    setLoading(true);
    setErr('');
    const loadList = async (url, label) => {
      const response = await authFetch(url);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || data.error || `Could not load ${label}.`);
      return data;
    };
    Promise.all([
      loadList('/api/admin/shipping-zones/', 'shipping zones'),
      loadList('/api/admin/shipping-rates/', 'shipping rates'),
      loadList('/api/admin/shipping-providers/', 'shipping providers'),
      loadList('/api/admin/shipping-providers/catalog/', 'shipping provider catalog'),
    ]).then(([z, r, p, catalogData]) => {
      setZones(Array.isArray(z) ? z : z.results || []);
      setRates(Array.isArray(r) ? r : r.results || []);
      setProviders(Array.isArray(p) ? p : p.results || []);
      setProviderCatalog(Array.isArray(catalogData) ? catalogData : catalogData.results || []);
    }).catch((error) => {
      setErr(`${error.message} Please confirm the latest database migrations are applied.`);
    }).finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  /* ─── Zone CRUD ─── */
  const saveZone = async (zone) => {
    const isNew = !zone.id;
    const url = isNew ? '/api/admin/shipping-zones/' : `/api/admin/shipping-zones/${zone.id}/`;
    const payload = {
      name: zone.name, region: zone.region, is_active: zone.is_active,
      description: zone.description || '',
      priority: Number(zone.priority || 0),
      countries: Array.isArray(zone.countries) ? zone.countries : [],
      states: Array.isArray(zone.states) ? zone.states : [],
      cities: Array.isArray(zone.cities) ? zone.cities : [],
      postal_ranges: Array.isArray(zone.postal_ranges) ? zone.postal_ranges : [],
    };
    const r = await authFetch(url, { method: isNew ? 'POST' : 'PUT', body: JSON.stringify(payload) });
    if (!r.ok) { const d = await r.json(); throw new Error(d.detail || JSON.stringify(d)); }
    setEditingZone(null); load();
  };

  const deleteZone = (zone) => {
    if (!confirm(`Delete shipping zone "${zone.name}"? This will also remove its rates.`)) return;
    authFetch(`/api/admin/shipping-zones/${zone.id}/`, { method: 'DELETE' }).then(load);
  };

  const duplicateZone = (zone) => {
    authFetch('/api/admin/shipping-zones/', {
      method: 'POST',
      body: JSON.stringify({
        name: `${zone.name} (Copy)`, region: zone.region,
        countries: zone.countries || [], states: zone.states || [],
        cities: zone.cities || [], postal_ranges: zone.postal_ranges || [],
        is_active: false, description: zone.description || '',
      })
    }).then(load);
  };

  /* ─── Rate CRUD ─── */
  const saveRate = async (rate) => {
    const isNew = !rate.id;
    const url = isNew ? '/api/admin/shipping-rates/' : `/api/admin/shipping-rates/${rate.id}/`;
    const payload = {
      zone: rate.zone, name: rate.name, method: rate.method || 'Standard Shipping',
      rate_type: rate.rate_type,
      price: rate.rate_type === 'FREE' ? '0.00' : (rate.price || '0.00'),
      min_value: rate.min_value !== undefined && rate.min_value !== '' ? rate.min_value : null,
      max_value: rate.max_value !== undefined && rate.max_value !== '' ? rate.max_value : null,
      per_unit_price: rate.per_unit_price || '0.00', handling_fee: rate.handling_fee || '0.00',
      free_above: rate.free_above || null, surcharge_postcodes: rate.surcharge_postcodes || '',
      surcharge_amount: rate.surcharge_amount || '0.00', priority: Number(rate.priority || 0),
      estimated_days: rate.estimated_days || '', description: rate.description || '',
      is_active: rate.is_active !== false,
    };
    const r = await authFetch(url, { method: isNew ? 'POST' : 'PUT', body: JSON.stringify(payload) });
    if (!r.ok) { const d = await r.json(); throw new Error(d.detail || JSON.stringify(d)); }
    setEditingRate(null); load();
  };

  const deleteRate = (rate) => {
    if (!confirm(`Delete rate "${rate.name}"?`)) return;
    authFetch(`/api/admin/shipping-rates/${rate.id}/`, { method: 'DELETE' }).then(load);
  };

  const saveProvider = async () => {
    const isNew = !providerForm.id;
    const response = await authFetch(
      isNew ? '/api/admin/shipping-providers/' : `/api/admin/shipping-providers/${providerForm.id}/`,
      {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify({
          code: providerForm.code,
          display_name: providerForm.display_name,
          region: Number(providerForm.region),
          is_enabled: Boolean(providerForm.is_enabled),
          mode: providerForm.mode || 'TEST',
          credentials: providerForm.credentials || {},
          configuration: providerForm.configuration || {},
          webhook_secret: providerForm.webhook_secret || '',
          sort_order: Number(providerForm.sort_order || 0),
        }),
      },
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.is_enabled?.[0] || data.detail || JSON.stringify(data));
    setProviderForm(null);
    load();
  };

  const testProvider = (provider) => {
    authFetch(`/api/admin/shipping-providers/${provider.id}/test_connection/`, { method: 'POST', body: JSON.stringify({}) })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Connection test failed.');
        alert(data.message || 'Connection verified.');
        load();
      })
      .catch((error) => { alert(error.message); load(); });
  };

  const toggleProvider = async (provider) => {
    const response = await authFetch(`/api/admin/shipping-providers/${provider.id}/`, {
      method: 'PATCH', body: JSON.stringify({ is_enabled: !provider.is_enabled }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { alert(data.is_enabled?.[0] || data.detail || 'Complete the provider configuration first.'); return; }
    load();
  };

  const openNewProvider = () => {
    const definition = providerCatalog[0] || { code: 'DHL_EXPRESS', name: 'DHL Express' };
    setProviderForm({
      code: definition.code, display_name: definition.name, region: regions[0]?.id,
      is_enabled: false, mode: 'TEST', credentials: {}, configuration: {},
      webhook_secret: '', sort_order: 0,
    });
  };

  const selectedProviderDefinition = providerForm
    ? providerCatalog.find((item) => item.code === providerForm.code)
    : null;

  if (loading) return (
    <div className="flex items-center gap-3 py-12 justify-center text-ink-subtle">
      <Loader2 className="h-5 w-5 animate-spin" />
      <p className="text-sm">Loading shipping configuration…</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {err && (
        <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-ink-danger flex-shrink-0" />
          <p className="text-sm text-ink-danger">{err}</p>
          <button onClick={() => setErr('')} className="ml-auto text-ink-danger hover:text-ink-danger"><X className="h-4 w-4" /></button>
        </div>
      )}
      <div className="flex flex-wrap gap-2 border-b border-edge-subtle pb-2">
        <button onClick={() => setActiveSubTab('providers')} className={`rounded-sm px-4 py-2 text-sm font-semibold uppercase ${activeSubTab === 'providers' ? 'bg-ink-primary text-white' : 'text-ink-primary hover:bg-surface-muted'}`}>Courier providers</button>
        <button onClick={() => setActiveSubTab('rates')} className={`rounded-sm px-4 py-2 text-sm font-semibold uppercase ${activeSubTab === 'rates' ? 'bg-ink-primary text-white' : 'text-ink-primary hover:bg-surface-muted'}`}>Zones &amp; rates</button>
      </div>

      {activeSubTab === 'providers' ? (
        <div className="space-y-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div><h3 className="text-base font-semibold text-ink-primary">Shipping integrations</h3><p className="text-sm text-ink-muted">Connect a supported courier per market, test credentials, and enable it without a deployment.</p></div>
            <button onClick={openNewProvider} className="btn-primary px-5 py-2.5 text-sm"><Plus className="h-4 w-4" /> Add provider</button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {providers.map((provider) => {
              const definition = providerCatalog.find((item) => item.code === provider.code) || {};
              return (
                <div key={provider.id} className="rounded-lg border border-edge bg-white p-5 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold text-ink-primary">{provider.display_name}</h4><span className="rounded-full bg-surface-muted px-2 py-1 text-[12px] font-semibold text-ink-accent">{provider.region_code}</span></div><p className="mt-1 text-sm text-ink-muted">{definition.description || provider.code}</p></div>
                    <button onClick={() => toggleProvider(provider)} className={`rounded-full px-3 py-1 text-[12px] font-semibold ${provider.is_enabled ? 'bg-brand-success/10 text-ink-success' : 'bg-surface-muted text-ink-muted'}`}>{provider.is_enabled ? 'Enabled' : 'Disabled'}</button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">{(definition.capabilities || []).map((capability) => <span key={capability} className="rounded-full border border-edge px-2.5 py-1 text-[12px] text-ink-secondary">{capability.replaceAll('_', ' ')}</span>)}</div>
                  <div className="mt-4 flex items-center justify-between border-t border-edge-subtle pt-4">
                    <div><p className={`text-sm font-semibold ${provider.connection_status === 'CONNECTED' ? 'text-ink-success' : provider.connection_status === 'ERROR' ? 'text-ink-danger' : 'text-ink-muted'}`}>{provider.connection_status.replaceAll('_', ' ')}</p><p className="text-[12px] text-ink-subtle">{provider.mode} · {provider.is_configured ? 'credentials saved' : 'setup incomplete'}</p></div>
                    <div className="flex gap-2"><button onClick={() => testProvider(provider)} className="btn-secondary px-3 py-2 text-xs">Test</button><button onClick={() => setProviderForm({ ...provider, credentials: {}, webhook_secret: '' })} className="btn-secondary px-3 py-2 text-xs"><Pencil className="h-3.5 w-3.5" /> Edit</button></div>
                  </div>
                  {provider.last_error && <p className="mt-3 rounded-sm bg-red-50 px-3 py-2 text-[12px] text-ink-danger">{provider.last_error}</p>}
                </div>
              );
            })}
          </div>
          {!providers.length && <div className="rounded-lg border-2 border-dashed border-edge py-14 text-center"><Truck className="mx-auto h-9 w-9 text-ink-subtle" /><p className="mt-3 font-semibold text-ink-primary">No courier integration configured</p><p className="mt-1 text-sm text-ink-muted">Add DHL Express, Shiprocket, or manual fulfilment for a market.</p></div>}
        </div>
      ) : <ShippingZonePanel
        zones={zones}
        rates={rates}
        regions={regions}
        editingZone={editingZone}
        editingRate={editingRate}
        onAddZone={() => setEditingZone('new')}
        onEditZone={(z) => setEditingZone(z)}
        onCloseZone={() => setEditingZone(null)}
        onEditRate={(r) => setEditingRate(r)}
        onCloseRate={() => setEditingRate(null)}
        onSaveZone={saveZone}
        onDeleteZone={deleteZone}
        onDuplicateZone={duplicateZone}
        onSaveRate={saveRate}
        onDeleteRate={deleteRate}
      />}

      {providerForm && (
        <div className="admin-action-page flex flex-col items-center">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-lg border border-edge bg-white p-6 shadow-overlay sm:max-w-xl sm:rounded-lg">
            <div className="mb-5 flex items-start justify-between"><div><h3 className="text-lg font-semibold text-ink-primary">{providerForm.id ? 'Edit' : 'Add'} shipping provider</h3><p className="mt-1 text-sm text-ink-muted">Secrets are encrypted and are never returned after saving.</p></div><button onClick={() => setProviderForm(null)} className="p-2 text-ink-muted"><X className="h-4 w-4" /></button></div>
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className="label-base">Provider</label><select value={providerForm.code} disabled={Boolean(providerForm.id)} onChange={(event) => { const definition = providerCatalog.find((item) => item.code === event.target.value); setProviderForm({ ...providerForm, code: event.target.value, display_name: definition?.name || event.target.value, credentials: {}, configuration: {} }); }} className="input-base">{providerCatalog.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></div>
                <div><label className="label-base">Market</label><select value={providerForm.region} disabled={Boolean(providerForm.id)} onChange={(event) => setProviderForm({ ...providerForm, region: Number(event.target.value) })} className="input-base">{regions.map((region) => <option key={region.id} value={region.id}>{region.code} — {region.name}</option>)}</select></div>
              </div>
              <div><label className="label-base">Customer-facing name</label><input value={providerForm.display_name} onChange={(event) => setProviderForm({ ...providerForm, display_name: event.target.value })} className="input-base" /></div>
              {selectedProviderDefinition?.description && <p className="rounded-md bg-surface-muted px-3 py-2 text-ink-secondary">{selectedProviderDefinition.description}</p>}
              {(selectedProviderDefinition?.credential_fields || []).map((field) => <div key={field.key}><label className="label-base">{field.label}{field.required ? ' *' : ''}</label>{field.secret ? <PasswordInput autoComplete="new-password" value={providerForm.credentials?.[field.key] || ''} onChange={(event) => setProviderForm({ ...providerForm, credentials: { ...(providerForm.credentials || {}), [field.key]: event.target.value } })} placeholder={providerForm.credential_status?.[field.key] ? 'Configured — leave blank to keep current' : field.label} className="input-base" /> : <input value={providerForm.credentials?.[field.key] || ''} onChange={(event) => setProviderForm({ ...providerForm, credentials: { ...(providerForm.credentials || {}), [field.key]: event.target.value } })} placeholder={providerForm.credential_status?.[field.key] ? 'Configured — leave blank to keep current' : field.label} className="input-base" />}</div>)}
              {(selectedProviderDefinition?.configuration_fields || []).map((field) => <div key={field.key}><label className="label-base">{field.label}{field.required ? ' *' : ''}</label><input value={providerForm.configuration?.[field.key] || ''} onChange={(event) => setProviderForm({ ...providerForm, configuration: { ...(providerForm.configuration || {}), [field.key]: event.target.value } })} className="input-base" /></div>)}
              <div className="grid gap-3 sm:grid-cols-2"><div><label className="label-base">Environment</label><select value={providerForm.mode} onChange={(event) => setProviderForm({ ...providerForm, mode: event.target.value })} className="input-base"><option value="TEST">Test / Sandbox</option><option value="LIVE">Live</option></select></div><div><label className="label-base">Priority</label><input type="number" min="0" value={providerForm.sort_order || 0} onChange={(event) => setProviderForm({ ...providerForm, sort_order: Number(event.target.value) })} className="input-base" /></div></div>
              <label className="flex items-center gap-2 font-semibold text-ink-primary"><input type="checkbox" checked={Boolean(providerForm.is_enabled)} onChange={(event) => setProviderForm({ ...providerForm, is_enabled: event.target.checked })} /> Enable after saving</label>
              <div className="flex gap-2 pt-2"><button onClick={() => saveProvider().catch((error) => alert(error.message))} className="btn-primary flex-1 py-3">Save provider</button><button onClick={() => setProviderForm(null)} className="btn-ghost flex-1 py-3">Cancel</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- Customers */
function CustomersTab({ authFetch }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerDetails, setCustomerDetails] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [editingCustomer, setEditingCustomer] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 450);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({
      page,
      page_size: pageSize,
      q: debouncedQuery,
    });
    if (sortOrder) params.append('ordering', sortOrder);

    authFetch(`/api/admin/customers/?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        setCustomers(d.results || []);
        setTotalCount(d.count || 0);
      })
      .catch(() => {
        setCustomers([]);
        setTotalCount(0);
      })
      .finally(() => setLoading(false));

  }, [authFetch, page, pageSize, debouncedQuery, sortOrder]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, sortOrder]);

  const viewDetails = (customer) => {
    setSelectedCustomer(customer);

    authFetch(`/api/admin/customers/${customer.id}/details/`)
      .then((r) => r.json())
      .then(setCustomerDetails)
      .catch(() => setCustomerDetails(null));
  };

  const startNew = () => setEditingCustomer({ email: '', first_name: '', last_name: '', phone_number: '' });
  const startEdit = (profile) => {
    const { loyalty_points, ...rest } = profile;
    setEditingCustomer({ ...rest });
  };

  const saveCustomer = () => {
    const isNew = !editingCustomer.id;
    authFetch(isNew ? '/api/admin/customers/' : `/api/admin/customers/${editingCustomer.id}/`, {
      method: isNew ? 'POST' : 'PUT',
      body: JSON.stringify(editingCustomer)
    })
      .then((r) => r.json())
      .then(() => {
        setEditingCustomer(null);
        setSelectedCustomer(null);
        setCustomerDetails(null);
        load();
      });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2 flex-grow max-w-xl">
          <label className="relative block flex-grow max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search email, name..." className="w-full rounded-sm border border-edge py-2 pl-9 pr-3 text-sm focus:outline-none" />
          </label>
          <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="rounded-sm border border-edge px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-edge-focus/30">
            <option value="">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="email">Email (A-Z)</option>
            <option value="-email">Email (Z-A)</option>
          </select>
        </div>
        <button onClick={startNew} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm uppercase"><UserPlus className="h-4 w-4" /> Add Customer</button>
      </div>

      <div className="overflow-x-auto rounded-md border border-edge bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-muted text-[12px] font-medium uppercase tracking-wide text-ink-muted border-b border-edge">
            <tr><th className="px-3 py-3 font-medium">Email</th><th className="px-3 py-3 font-medium">Name</th><th className="px-3 py-3 font-medium">Phone</th><th className="px-3 py-3 font-medium">Staff?</th></tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              return (
                <tr key={c.id} className="cursor-pointer border-t border-edge-subtle hover:bg-surface-muted" onClick={() => viewDetails(c)}>
                  <td className="px-3 py-3 font-semibold text-ink-primary">{c.email}</td>
                  <td className="px-3 py-3 font-semibold">{c.first_name} {c.last_name}</td>
                  <td className="px-3 py-3 text-brand-muted">{c.phone_number || '—'}</td>
                  <td className="px-3 py-3">{c.is_staff ? <span className="rounded bg-surface-muted text-ink-accent px-2 py-0.5 text-[12px] font-semibold">STAFF</span> : <span className="rounded bg-surface-muted text-ink-muted px-2 py-0.5 text-[12px] font-semibold">CUSTOMER</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalCount > pageSize && (
        <PaginationControls
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          onChangePage={setPage}
          onChangePageSize={setPageSize}
        />
      )}

      {/* Selected Customer Details Slide-out */}
      {selectedCustomer && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-surface-muted overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
          <div className="w-full max-w-3xl bg-white rounded-lg border border-edge p-6 shadow-card mx-auto space-y-6">
            <div className="flex items-center justify-between border-b border-edge-subtle pb-3">
              <div>
                <p className="kicker">Customer CRM Profile</p>
                <h3 className="text-xl font-semibold text-ink-primary">{selectedCustomer.first_name} {selectedCustomer.last_name}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => startEdit(selectedCustomer)} className="rounded-sm border border-edge p-2 text-ink-accent hover:bg-surface-muted"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => { setSelectedCustomer(null); setCustomerDetails(null); }} className="rounded-sm border border-edge p-2 text-brand-muted hover:bg-surface-muted"><X className="h-4 w-4" /></button>
              </div>
            </div>

            {customerDetails ? (
              <div className="space-y-6">
                {/* Profile detail cards */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-md border border-edge-subtle bg-surface-muted p-4">
                    <p className="text-sm text-brand-muted font-semibold">LIFETIME SPENT</p>
                    <p className="mt-1 text-xl font-semibold text-ink-primary">GBP {customerDetails.total_spent.toFixed(2)}</p>
                  </div>
                  <div className="rounded-md border border-edge-subtle bg-surface-muted p-4">
                    <p className="text-sm text-brand-muted font-semibold">TOTAL ORDERS</p>
                    <p className="mt-1 text-xl font-semibold text-ink-primary">{customerDetails.orders_count} orders</p>
                  </div>
                </div>


                {/* Addresses */}
                <div>
                  <h4 className="text-sm font-semibold uppercase text-brand-muted mb-2">Addresses ({customerDetails.addresses.length})</h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {customerDetails.addresses.map((addr) => (
                      <div key={addr.id} className="rounded-md border border-edge p-3 text-sm bg-white">
                        <p className="font-semibold text-ink-primary">{addr.full_name}</p>
                        <p>{addr.address_line1}, {addr.city}</p>
                        <p>{addr.state} {addr.postal_code}, {addr.country}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Orders */}
                <div>
                  <h4 className="text-sm font-semibold uppercase text-brand-muted mb-2">Recent Orders</h4>
                  <div className="space-y-1.5">
                    {customerDetails.recent_orders.map((o) => (
                      <div key={o.id} className="flex justify-between items-center rounded-lg border border-edge-subtle p-2 text-sm">
                        <span>Order #{o.id} · {formatDate(o.created_at)}</span>
                        <span className="font-semibold">{o.currency} {o.total} · <span className={`rounded-xs px-2 py-0.5 text-[13px] font-semibold ${STATUS_COLOR[o.status]}`}>{o.status}</span></span>
                      </div>
                    ))}
                    {!customerDetails.recent_orders.length && <p className="text-sm text-brand-muted">No orders placed yet.</p>}
                  </div>
                </div>

                {/* Customer Activities */}
                <div>
                  <h4 className="text-sm font-semibold uppercase text-brand-muted mb-2">Activity Timeline</h4>
                  <div className="border-l border-edge-subtle pl-4 space-y-3">
                    {customerDetails.activities.map((act) => (
                      <div key={act.id} className="relative text-sm">
                        <span className="absolute -left-[21px] top-1 flex h-2.5 w-2.5 rounded-full bg-ink-primary" />
                        <p className="font-semibold text-ink-primary">{act.activity_type.replace('_', ' ')}</p>
                        <p className="text-ink-subtle">{act.description} · {formatDateTime(act.created_at)}</p>
                      </div>
                    ))}
                    {!customerDetails.activities.length && <p className="text-sm text-brand-muted">No activity logs recorded.</p>}
                  </div>
                </div>

                {/* Support Tickets */}
                <div>
                  <h4 className="text-sm font-semibold uppercase text-brand-muted mb-2">Customer Support History</h4>
                  <div className="space-y-1.5">
                    {customerDetails.tickets.map((t) => (
                      <div key={t.id} className="rounded-lg border border-edge-subtle p-2 text-sm">
                        <p className="font-semibold text-ink-primary">{t.subject}</p>
                        <p className="text-ink-subtle">{t.message} · <span className="font-semibold text-ink-accent">{t.status}</span></p>
                      </div>
                    ))}
                    {!customerDetails.tickets.length && <p className="text-sm text-brand-muted">No support tickets.</p>}
                  </div>
                </div>
              </div>
            ) : <p className="text-sm text-brand-muted">Loading CRM logs...</p>}
          </div>
        </div>
      )}

      {/* Editing/new customer workspace */}
      {editingCustomer && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-surface-muted overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
          <div className="w-full max-w-md bg-white rounded-lg border border-edge p-6 shadow-card space-y-4">
            <h3 className="text-lg font-semibold text-ink-primary">{editingCustomer.id ? 'Edit Customer' : 'Add Customer'}</h3>
            <div className="space-y-3">
              <input placeholder="Email Address" value={editingCustomer.email} disabled={!!editingCustomer.id} onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })} className="w-full rounded-sm border border-edge p-2.5 text-sm disabled:bg-surface-muted" />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="First Name" value={editingCustomer.first_name} onChange={(e) => setEditingCustomer({ ...editingCustomer, first_name: e.target.value })} className="rounded-sm border border-edge p-2.5 text-sm" />
                <input placeholder="Last Name" value={editingCustomer.last_name} onChange={(e) => setEditingCustomer({ ...editingCustomer, last_name: e.target.value })} className="rounded-sm border border-edge p-2.5 text-sm" />
              </div>
              <input placeholder="Phone Number" value={editingCustomer.phone_number || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, phone_number: e.target.value })} className="w-full rounded-sm border border-edge p-2.5 text-sm" />
              <div className="flex gap-2">
                <button onClick={saveCustomer} className="btn-primary flex-1 py-2.5 text-sm uppercase font-semibold">Save Profile</button>
                <button onClick={() => setEditingCustomer(null)} className="flex-1 rounded-sm border border-edge py-2.5 text-sm font-semibold uppercase">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ Segments */
function SegmentsTab({ authFetch }) {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    authFetch('/api/admin/customer-segments/')
      .then((r) => r.json())
      .then((d) => setSegments(Array.isArray(d) ? d : d.results || []))
      .catch(() => setSegments([]))
      .finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const save = () => {
    const isNew = !form.id;
    authFetch(isNew ? '/api/admin/customer-segments/' : `/api/admin/customer-segments/${form.id}/`, {
      method: isNew ? 'POST' : 'PUT',
      body: JSON.stringify(form)
    }).then(() => { setForm(null); load(); });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-brand-muted">{segments.length} customer segments</p>
        <button onClick={() => setForm({ name: '', description: '', criteria: {} })} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm uppercase"><Plus className="h-4 w-4" /> Create Segment</button>
      </div>

      <div className="space-y-2">
        {segments.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-md border border-edge bg-white shadow-card p-4">
            <div>
              <p className="text-sm font-semibold text-ink-primary">{s.name}</p>
              <p className="text-sm text-brand-muted">{s.description}</p>
              <p className="mt-1 text-[12px] text-ink-accent font-mono font-semibold">Rules: {JSON.stringify(s.criteria)}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded bg-surface-muted text-ink-accent px-2 py-0.5 text-sm font-semibold">{s.customer_emails?.length || 0} buyers</span>
              <button onClick={() => setForm({ ...s })} className="text-ink-accent hover:opacity-75"><Pencil className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>

      {form && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-surface-muted overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
          <div className="w-full max-w-md bg-white rounded-lg border border-edge p-6 shadow-card space-y-4">
            <h3 className="text-lg font-semibold text-ink-primary">{form.id ? 'Edit Segment' : 'Create Segment'}</h3>
            <div className="space-y-3">
              <input placeholder="Segment Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-sm border border-edge p-2.5 text-sm" />
              <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-sm border border-edge p-2.5 text-sm" />
              <p className="text-[13px] font-semibold text-ink-subtle uppercase">Segment Criteria Rules (JSON)</p>
              <textarea placeholder='e.g. {"min_spend": 200}' value={typeof form.criteria === 'string' ? form.criteria : JSON.stringify(form.criteria)} onChange={(e) => setForm({ ...form, criteria: e.target.value })} className="w-full font-mono rounded-sm border border-edge p-2.5 text-sm" rows={3} />
              <div className="flex gap-2">
                <button onClick={save} className="btn-primary flex-1 py-2.5 text-sm uppercase">Save Segment</button>
                <button onClick={() => setForm(null)} className="flex-1 rounded-sm border border-edge py-2.5 text-sm font-semibold uppercase">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- Support */
/* ------------------------------------------------------------- Glossary Tab */
function GlossaryTab({ authFetch }) {
  const [terms, setTerms] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editTerm, setEditTerm] = useState(null); // When editing/creating
  const [editorOpen, setEditorOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const loadTerms = useCallback(() => {
    setLoading(true);
    authFetch('/api/admin/glossary/')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setTerms(data))
      .catch(() => alert('Failed to load glossary terms.'))
      .finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => {
    loadTerms();
  }, [loadTerms]);

  const handleCreate = () => {
    setEditTerm({ term: '', definition: '', category: '', image_url: '' });
    setEditorOpen(true);
  };

  const handleEdit = (term) => {
    setEditTerm({ ...term });
    setEditorOpen(true);
  };

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this glossary term?')) {
      authFetch(`/api/admin/glossary/${id}/`, { method: 'DELETE' })
        .then((r) => {
          if (r.ok) {
            loadTerms();
          } else {
            alert('Failed to delete term.');
          }
        });
    }
  };

  const handleUploadImage = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadAdminMedia(authFetch, file);
      if (url) {
        setEditTerm((prev) => ({ ...prev, image_url: url }));
      }
    } catch (err) {
      alert('Failed to upload image: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    if (!editTerm.term.trim() || !editTerm.definition.trim()) {
      alert('Term and Definition are required.');
      return;
    }

    const isEdit = !!editTerm.id;
    const url = isEdit ? `/api/admin/glossary/${editTerm.id}/` : '/api/admin/glossary/';
    const method = isEdit ? 'PUT' : 'POST';

    authFetch(url, {
      method,
      body: JSON.stringify(editTerm),
    })
      .then(async (r) => {
        if (r.ok) {
          setEditorOpen(false);
          setEditTerm(null);
          loadTerms();
        } else {
          const errData = await r.json().catch(() => ({}));
          alert('Save failed: ' + (JSON.stringify(errData) || r.statusText));
        }
      });
  };

  const filtered = terms.filter(t => 
    t.term.toLowerCase().includes(search.toLowerCase()) ||
    t.definition.toLowerCase().includes(search.toLowerCase()) ||
    (t.category && t.category.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Search and Add Header */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-brand-muted" />
          <input
            placeholder="Search term, definition, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-edge rounded-md text-sm placeholder:text-brand-muted focus:outline-none focus:border-ink-primary bg-white shadow-card"
          />
        </div>
        <button
          onClick={handleCreate}
          className="btn-primary py-2 px-4 rounded-sm text-sm font-semibold uppercase flex items-center gap-1.5 self-start"
        >
          <Plus className="h-4 w-4" /> Add Glossary Term
        </button>
      </div>

      {/* Glossary Table/List */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-brand-muted" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-edge rounded-lg p-12 text-center shadow-card">
          <BookOpen className="h-10 w-10 text-brand-muted mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-ink-primary">No glossary terms found</h3>
          <p className="text-sm text-brand-muted mt-1">Try modifying your search query or add a new term.</p>
        </div>
      ) : (
        <div className="bg-white border border-edge rounded-lg overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-edge bg-surface-muted/50 text-brand-muted font-semibold uppercase text-[12px]">
                  <th className="px-5 py-3 w-1/4">Term / Word</th>
                  <th className="px-5 py-3 w-1/6">Category</th>
                  <th className="px-5 py-3 w-5/12">Definition</th>
                  <th className="px-5 py-3 w-1/12 text-center">Image</th>
                  <th className="px-5 py-3 w-1/12 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge-subtle">
                {filtered.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-muted/30">
                    <td className="px-5 py-3.5 font-semibold text-ink-primary">{item.term}</td>
                    <td className="px-5 py-3.5">
                      {item.category ? (
                        <span className="bg-brand-success/10 text-ink-success rounded-xs px-2 py-0.5 font-medium uppercase text-[12px]">
                          {item.category}
                        </span>
                      ) : (
                        <span className="text-brand-muted italic text-[12px]">None</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-brand-muted max-w-xs truncate">{item.definition}</td>
                    <td className="px-5 py-3.5 text-center">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.term}
                          className="h-8 w-8 object-contain rounded border border-edge bg-surface-muted mx-auto"
                        />
                      ) : (
                        <span className="text-brand-muted text-[12px]">-</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(item)}
                          className="text-ink-primary hover:text-ink-accent font-semibold flex items-center gap-0.5"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-ink-danger hover:text-red-700 font-semibold flex items-center gap-0.5"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Glossary editor workspace */}
      {editorOpen && editTerm && (
        <div className="admin-action-page flex flex-col items-center">
          <div className="w-full max-w-lg bg-white rounded-lg border border-edge p-6 shadow-overlay space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-edge-subtle pb-3">
              <h3 className="text-md font-semibold text-ink-primary">
                {editTerm.id ? 'Edit Glossary Term' : 'Add New Glossary Term'}
              </h3>
              <button onClick={() => setEditorOpen(false)} className="text-brand-muted hover:text-ink-primary">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-4 text-sm">
              <div>
                <label className="font-semibold text-ink-primary block mb-1">Term / Word *</label>
                <input
                  value={editTerm.term}
                  onChange={(e) => setEditTerm({ ...editTerm, term: e.target.value })}
                  placeholder="e.g. BJC, Collagen, Osteoarthritis"
                  className="w-full rounded-sm border border-edge p-2.5"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-ink-primary block mb-1">Category (Optional)</label>
                <input
                  value={editTerm.category}
                  onChange={(e) => setEditTerm({ ...editTerm, category: e.target.value })}
                  placeholder="e.g. Biochemistry, Nutraceuticals, Biosecurity"
                  className="w-full rounded-sm border border-edge p-2.5"
                />
              </div>

              <div>
                <label className="font-semibold text-ink-primary block mb-1">Definition *</label>
                <textarea
                  value={editTerm.definition}
                  onChange={(e) => setEditTerm({ ...editTerm, definition: e.target.value })}
                  placeholder="Enter a concise, clear definition of this term..."
                  rows={4}
                  className="w-full rounded-sm border border-edge p-2.5"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-ink-primary block mb-1.5">Illustrative Image (Optional)</label>
                <div className="flex gap-4 items-start">
                  <div className="flex-1 space-y-2">
                    <input
                      type="text"
                      placeholder="Paste image URL..."
                      value={editTerm.image_url}
                      onChange={(e) => setEditTerm({ ...editTerm, image_url: e.target.value })}
                      className="w-full rounded-sm border border-edge p-2 text-sm"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-brand-muted font-medium">Or upload file:</span>
                      <label className="cursor-pointer border border-edge px-3 py-1 bg-surface-muted hover:bg-edge/20 rounded text-[12px] font-semibold uppercase flex items-center gap-1">
                        <Upload className="h-3 w-3" />
                        {uploading ? 'Uploading...' : 'Choose File'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleUploadImage(e.target.files[0])}
                          className="hidden"
                          disabled={uploading}
                        />
                      </label>
                    </div>
                  </div>
                  
                  {editTerm.image_url && (
                    <div className="h-16 w-16 border border-edge rounded bg-surface-muted flex items-center justify-center relative group overflow-hidden">
                      <img src={editTerm.image_url} alt="Preview" className="h-full w-full object-contain" />
                      <button 
                        onClick={() => setEditTerm({ ...editTerm, image_url: '' })}
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                        type="button"
                      >
                        <X className="h-4 w-4 text-white" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end border-t border-edge-subtle pt-3">
              <button
                onClick={() => setEditorOpen(false)}
                className="rounded-sm border border-edge px-4 py-2 text-sm font-semibold uppercase hover:bg-surface-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="btn-primary rounded-sm px-5 py-2 text-sm font-semibold uppercase"
              >
                Save Term
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ------------------------------------------------------------- FAQ Tab */
function FAQTab({ authFetch }) {
  const [faqs, setFaqs] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editFaq, setEditFaq] = useState(null); // When editing/creating
  const [editorOpen, setEditorOpen] = useState(false);

  const loadFaqs = useCallback(() => {
    setLoading(true);
    authFetch('/api/admin/faqs/')
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setFaqs(data))
      .catch(() => alert('Failed to load FAQs.'))
      .finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => {
    loadFaqs();
  }, [loadFaqs]);

  const handleCreate = () => {
    setEditFaq({ question: '', answer: '', category: 'General', is_active: true, display_order: 0 });
    setEditorOpen(true);
  };

  const handleEdit = (faq) => {
    setEditFaq({ ...faq });
    setEditorOpen(true);
  };

  const handleDelete = (id) => {
    if (confirm('Are you sure you want to delete this FAQ?')) {
      authFetch(`/api/admin/faqs/${id}/`, { method: 'DELETE' })
        .then((r) => {
          if (r.ok) {
            loadFaqs();
          } else {
            alert('Failed to delete FAQ.');
          }
        });
    }
  };

  const handleSave = () => {
    if (!editFaq.question.trim() || !editFaq.answer.trim()) {
      alert('Question and Answer are required.');
      return;
    }

    const isEdit = !!editFaq.id;
    const url = isEdit ? `/api/admin/faqs/${editFaq.id}/` : `/api/admin/faqs/`;
    const method = isEdit ? 'PUT' : 'POST';

    authFetch(url, {
      method,
      body: JSON.stringify(editFaq)
    })
      .then(async (r) => {
        if (r.ok) {
          setEditorOpen(false);
          setEditFaq(null);
          loadFaqs();
        } else {
          const err = await r.json().catch(() => ({}));
          alert('Failed to save FAQ: ' + JSON.stringify(err));
        }
      });
  };

  const filtered = faqs.filter(f => 
    f.question.toLowerCase().includes(search.toLowerCase()) ||
    f.answer.toLowerCase().includes(search.toLowerCase()) ||
    (f.category || '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <p className="text-sm text-brand-muted">Loading FAQ panel...</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-3 items-center bg-white p-4 rounded-md border border-edge">
        <div className="relative w-full sm:max-w-xs">
          <input
            type="text"
            placeholder="Search FAQs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-sm border border-edge pl-8 pr-3 py-1.5 text-sm text-ink-primary font-semibold"
          />
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-brand-muted" />
        </div>
        <button onClick={handleCreate} className="btn-primary py-1.5 px-3 rounded-sm text-sm font-semibold uppercase flex items-center gap-1 shrink-0">
          <Plus className="h-3.5 w-3.5" /> Add FAQ
        </button>
      </div>

      <div className="bg-white border border-edge rounded-lg overflow-hidden shadow-xs">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-edge bg-surface-muted uppercase text-brand-muted font-bold tracking-wider">
              <th className="p-3.5">Category</th>
              <th className="p-3.5 w-1/3">Question</th>
              <th className="p-3.5 w-1/3">Answer</th>
              <th className="p-3.5 text-center">Order</th>
              <th className="p-3.5 text-center">Status</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge-subtle font-semibold text-ink-primary">
            {filtered.map((faq) => (
              <tr key={faq.id} className="hover:bg-surface-muted transition-colors">
                <td className="p-3.5">
                  <span className="inline-block bg-brand-success/15 text-brand-success text-[12px] uppercase font-bold tracking-wide rounded-sm px-1.5 py-0.5">
                    {faq.category || 'General'}
                  </span>
                </td>
                <td className="p-3.5 font-bold">{faq.question}</td>
                <td className="p-3.5 text-ink-secondary max-w-xs truncate">{faq.answer}</td>
                <td className="p-3.5 text-center">{faq.display_order}</td>
                <td className="p-3.5 text-center">
                  <span className={`text-[12px] font-bold px-2 py-0.5 rounded-xs ${faq.is_active ? 'bg-brand-success/10 text-ink-success' : 'bg-brand-muted/10 text-brand-muted'}`}>
                    {faq.is_active ? 'ACTIVE' : 'HIDDEN'}
                  </span>
                </td>
                <td className="p-3.5 text-right">
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => handleEdit(faq)} className="p-1 rounded-sm border border-edge hover:bg-surface-muted text-brand-muted hover:text-ink-primary" title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(faq.id)} className="p-1 rounded-sm border border-red-200 hover:bg-red-50 text-red-500" title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-brand-muted">
                  No FAQs found. Click "Add FAQ" to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ADD/EDIT FAQ MODAL */}
      {editorOpen && editFaq && (
        <div className="admin-action-page flex flex-col items-center">
          <div className="w-full max-w-md bg-white rounded-lg border border-edge p-6 shadow-overlay space-y-4">
            <div className="flex items-center justify-between border-b border-edge-subtle pb-3">
              <h3 className="text-md font-semibold text-ink-primary">
                {editFaq.id ? 'Edit General FAQ' : 'Add General FAQ'}
              </h3>
              <button onClick={() => setEditorOpen(false)} className="text-brand-muted hover:text-ink-primary">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-3 text-sm font-semibold text-ink-primary">
              <div>
                <label className="block mb-1">Question *</label>
                <input
                  value={editFaq.question}
                  onChange={(e) => setEditFaq({ ...editFaq, question: e.target.value })}
                  placeholder="e.g. How do I request a refund?"
                  className="w-full rounded-sm border border-edge p-2.5 text-sm text-ink-primary font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block mb-1">Answer *</label>
                <textarea
                  value={editFaq.answer}
                  onChange={(e) => setEditFaq({ ...editFaq, answer: e.target.value })}
                  placeholder="Write the FAQ answer..."
                  rows={4}
                  className="w-full rounded-sm border border-edge p-2.5 text-sm text-ink-primary font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block mb-1">Category</label>
                <input
                  value={editFaq.category}
                  onChange={(e) => setEditFaq({ ...editFaq, category: e.target.value })}
                  placeholder="e.g. Shipping, Payments, Returns"
                  className="w-full rounded-sm border border-edge p-2.5 text-sm text-ink-primary font-semibold"
                />
              </div>

              <div>
                <label className="block mb-1">Display Order</label>
                <input
                  type="number"
                  value={editFaq.display_order}
                  onChange={(e) => setEditFaq({ ...editFaq, display_order: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-sm border border-edge p-2.5 text-sm text-ink-primary font-semibold"
                />
              </div>

              <label className="flex items-center gap-1.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={editFaq.is_active}
                  onChange={(e) => setEditFaq({ ...editFaq, is_active: e.target.checked })}
                  className="rounded-xs border border-edge text-ink-accent"
                />
                Active (Show on FAQ Page)
              </label>
            </div>

            <div className="flex gap-2 justify-end border-t border-edge-subtle pt-3">
              <button
                onClick={() => setEditorOpen(false)}
                className="rounded-sm border border-edge px-4 py-2 text-sm font-semibold uppercase hover:bg-surface-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="btn-primary rounded-sm px-5 py-2 text-sm font-semibold uppercase"
              >
                Save FAQ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* --------------------------------------------------------- Content Pages */
function ContentOverviewTab({ authFetch, go }) {
  const [counts, setCounts] = useState({ banners: 0, blogs: 0, media: 0, glossary: 0, faq: 0 });

  useEffect(() => {
    Promise.all([
      authFetch('/api/admin/hero-banners/').then((r) => (r.ok ? r.json() : null)),
      authFetch('/api/admin/blog-posts/').then((r) => (r.ok ? r.json() : null)),
      authFetch('/api/admin/settings/MEDIA_ASSETS/').then((r) => (r.ok ? r.json() : null)),
      authFetch('/api/admin/glossary/').then((r) => (r.ok ? r.json() : null)),
      authFetch('/api/admin/faqs/').then((r) => (r.ok ? r.json() : null)),
    ]).then(([banners, blogs, media, glossary, faqs]) => {
      setCounts({
        banners: Array.isArray(banners) ? banners.length : banners?.results?.length || 0,
        blogs: Array.isArray(blogs) ? blogs.length : blogs?.results?.length || 0,
        media: Array.isArray(media?.value) ? media.value.length : 0,
        glossary: Array.isArray(glossary) ? glossary.length : glossary?.results?.length || 0,
        faq: Array.isArray(faqs) ? faqs.length : faqs?.results?.length || 0,
      });
    }).catch(() => {});
  }, [authFetch]);

  const cards = [
    { key: 'pages', title: 'Banners', detail: `${counts.banners} slides`, icon: ImageIcon },
    { key: 'blogs', title: 'Blog', detail: `${counts.blogs} articles`, icon: Film },
    { key: 'navigation', title: 'Menus', detail: 'Header and footer links', icon: MenuIcon },
    { key: 'glossary', title: 'Glossary Manager', detail: `${counts.glossary} terms`, icon: BookOpen },
    { key: 'faq', title: 'FAQ Manager', detail: `${counts.faq} questions`, icon: HelpCircle },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <button key={`${card.key}-${card.tab || 'main'}`} type="button" onClick={() => go(card.key, card.tab)} className="rounded-lg border border-edge bg-white p-5 text-left hover:border-edge-strong hover:shadow-card transition">
            <Icon className="mb-4 h-5 w-5 text-ink-accent" />
            <p className="text-sm font-semibold text-ink-primary">{card.title}</p>
            <p className="mt-1 text-sm text-brand-muted">{card.detail}</p>
          </button>
        );
      })}
    </div>
  );
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 120);
}


/* ------------------------------------------------------------- Blogs */
function BlogsTab({ authFetch }) {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    authFetch('/api/admin/blog-posts/')
      .then((r) => r.json())
      .then((d) => setBlogs(Array.isArray(d) ? d : d.results || []))
      .catch(() => setBlogs([]))
      .finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const startNew = () => setEditing({
    title: '',
    slug: '',
    content: '',
    author: 'Admin',
    category: 'Biotech',
    cover_image_url: '',
    is_published: true,
    meta_title: '',
    meta_description: '',
  });

  const startEdit = (b) => {
    setEditing({
      id: b.id,
      title: b.title || '',
      slug: b.slug || '',
      author: b.author || 'Admin',
      category: b.category || 'Biotech',
      cover_image_url: b.cover_image_url || '',
      content: b.content || '',
      is_published: Boolean(b.is_published),
      meta_title: b.meta_title || '',
      meta_description: b.meta_description || '',
    });
  };

  const uploadCover = (file) => {
    if (!file) return;
    setUploadingCover(true);
    uploadAdminMedia(authFetch, file)
      .then((fileUrl) => setEditing((prev) => ({ ...prev, cover_image_url: fileUrl })))
      .catch((err) => alert(err.message || 'Cover image upload failed.'))
      .finally(() => setUploadingCover(false));
  };

  const save = () => {
    if (!editing?.title?.trim()) {
      alert('Article title is required.');
      return;
    }
    const isNew = !editing.id;
    const payload = {
      ...editing,
      slug: editing.slug || editing.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    };
    authFetch(isNew ? '/api/admin/blog-posts/' : `/api/admin/blog-posts/${editing.id}/`, {
      method: isNew ? 'POST' : 'PUT',
      body: JSON.stringify(payload)
    }).then(() => { setEditing(null); load(); });
  };

  const deleteItem = (item) => {
    if (confirm(`Delete blog post: ${item.title}?`)) {
      authFetch(`/api/admin/blog-posts/${item.id}/`, { method: 'DELETE' }).then(load);
    }
  };

  const togglePublish = (item) => {
    authFetch(`/api/admin/blog-posts/${item.id}/${item.is_published ? 'unpublish' : 'publish'}/`, { method: 'POST' }).then(load);
  };

  if (loading) return <p className="text-sm text-brand-muted">Loading blogs...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-brand-muted">{blogs.length} articles</p>
        <button onClick={startNew} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm uppercase"><Plus className="h-4 w-4" /> Write Article</button>
      </div>

      <div className="space-y-2">
        {blogs.map((b) => (
          <div key={b.id} className="flex justify-between items-center rounded-md border border-edge bg-white shadow-card p-4">
            <div>
              <p className="text-sm font-semibold text-ink-primary">{toDisplayText(b.title)}</p>
              <p className="text-[12px] text-brand-muted">Category: {b.category || 'Biotech'} · Written by {b.author} · /{b.slug}</p>
              <span className={`mt-1 inline-flex rounded-xs px-2 py-0.5 text-[13px] font-semibold uppercase ${b.is_published ? 'bg-brand-success/10 text-ink-success' : 'bg-surface-muted text-ink-muted'}`}>
                {b.is_published ? 'Published' : 'Draft'}
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => togglePublish(b)} className="text-brand-muted hover:text-ink-accent" title={b.is_published ? 'Unpublish' : 'Publish'}>
                {b.is_published ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
              </button>
              <button onClick={() => startEdit(b)} className="text-ink-accent p-1.5 rounded hover:bg-surface-muted" title="Edit article"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => deleteItem(b)} className="text-brand-muted hover:text-brand-danger p-1.5 rounded" title="Delete article"><X className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-surface-muted overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
          <div className="my-8 w-full max-w-lg bg-white rounded-lg border border-edge p-6 shadow-card space-y-4">
            <h3 className="text-lg font-semibold text-ink-primary">{editing.id ? 'Edit Article' : 'Write Article'}</h3>
            <div className="space-y-3 text-sm">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-muted">Article Title</label>
                <input placeholder="Article Title" value={editing.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full rounded-sm border border-edge p-2.5 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink-muted">Category</label>
                  <input placeholder="Category (e.g. Biotech, Soil Science)" value={editing.category || ''} onChange={(e) => setEditing({ ...editing, category: e.target.value })} className="w-full rounded-sm border border-edge p-2.5 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-ink-muted">Author</label>
                  <input placeholder="Author name" value={editing.author || ''} onChange={(e) => setEditing({ ...editing, author: e.target.value })} className="w-full rounded-sm border border-edge p-2.5 text-sm" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-muted">URL Slug</label>
                <input placeholder="Slug (e.g. joint-care-guide)" value={editing.slug || ''} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className="w-full rounded-sm border border-edge p-2.5 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-muted">Cover Image</label>
                <div className="flex gap-2">
                  <input placeholder="https://..." value={editing.cover_image_url || ''} onChange={(e) => setEditing({ ...editing, cover_image_url: e.target.value })} className="flex-1 rounded-sm border border-edge p-2.5 text-sm" />
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-edge px-3 py-2 text-sm font-semibold text-ink-primary hover:border-ink-primary">
                    <Upload className="h-3.5 w-3.5" />
                    {uploadingCover ? 'Uploading' : 'Upload'}
                    <input type="file" accept="image/*" onChange={(e) => uploadCover(e.target.files?.[0])} disabled={uploadingCover} className="hidden" />
                  </label>
                </div>
                {editing.cover_image_url && <img src={editing.cover_image_url} alt="" className="mt-2 h-28 w-full rounded-lg object-cover" />}
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-muted">Article Content</label>
                <textarea placeholder="Write article content..." value={editing.content || ''} onChange={(e) => setEditing({ ...editing, content: e.target.value })} className="w-full rounded-sm border border-edge p-2.5 font-sans text-sm" rows={8} />
              </div>

              <div className="p-3 bg-surface-muted rounded-md border border-edge-subtle space-y-2">
                <p className="font-semibold text-xs text-ink-muted uppercase">SEO Meta</p>
                <input placeholder="Meta Title" value={editing.meta_title || ''} onChange={(e) => setEditing({ ...editing, meta_title: e.target.value })} className="w-full rounded border border-edge p-2 text-sm bg-white" />
                <textarea placeholder="Meta Description" value={editing.meta_description || ''} onChange={(e) => setEditing({ ...editing, meta_description: e.target.value })} className="w-full rounded border border-edge p-2 text-sm bg-white" rows={2} />
              </div>

              <label className="flex items-center gap-2 text-sm text-ink-primary cursor-pointer">
                <input type="checkbox" checked={Boolean(editing.is_published)} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} className="accent-ink-primary" />
                Publish Article
              </label>
              <div className="flex gap-2 pt-2">
                <button onClick={save} className="btn-primary flex-1 py-2.5 text-sm uppercase font-semibold">Save Article</button>
                <button onClick={() => setEditing(null)} className="flex-1 rounded-sm border border-edge py-2.5 text-sm font-semibold uppercase">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- Analytics */
/* Merged Analytics & Reports surface per spec 2026-06-24 — Overview at top,
   then a sub-tab row delegating to the deep-dive reports. */
function AnalyticsAndReportsTab({ authFetch }) {
  const [view, setView] = useState('overview'); // overview | sales | clv | repeat | products | abandoned | geo
  const VIEWS = [
    { key: 'overview', label: 'Overview' },
    { key: 'sales', label: 'Sales by country' },
    { key: 'clv', label: 'CLV' },
    { key: 'repeat', label: 'Repeat customers' },
    { key: 'products', label: 'Revenue by product' },
    { key: 'abandoned', label: 'Abandoned recovery' },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-edge-subtle pb-2">
        {VIEWS.map((v) => (
          <button key={v.key} onClick={() => setView(v.key)}
            className={`px-3 py-1.5 text-sm font-semibold uppercase rounded-lg ${view === v.key ? 'bg-ink-primary text-white' : 'text-ink-primary hover:bg-surface-muted'}`}>
            {v.label}
          </button>
        ))}
      </div>
      {view === 'overview' && <AnalyticsOverview authFetch={authFetch} />}
      {view !== 'overview' && <ReportsTab authFetch={authFetch} initialTab={view} />}
    </div>
  );
}

function AnalyticsOverview({ authFetch }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scheduler, setScheduler] = useState({ frequency: 'weekly', email: '' });
  const [schedSaved, setSchedSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    authFetch('/api/admin/reports/analytics/')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
    // Load the persisted report schedule.
    authFetch('/api/admin/settings/REPORT_SCHEDULE/')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && d.value && typeof d.value === 'object') setScheduler((s) => ({ ...s, ...d.value })); })
      .catch(() => {});
  }, [authFetch]);

  const triggerPDFDownload = async () => {
    try {
      const res = await authFetch('/api/admin/reports/analytics/?export=pdf');
      if (!res.ok) throw new Error('PDF export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sclero_performance_report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Could not export PDF report.');
    }
  };

  const triggerCSVDownload = async () => {
    try {
      const res = await authFetch('/api/admin/reports/analytics/?export=csv');
      if (!res.ok) throw new Error('CSV export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sclero_sales_report.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Could not export CSV report.');
    }
  };

  const saveScheduler = () => {
    setSchedSaved(false);
    const payload = { key: 'REPORT_SCHEDULE', value: scheduler, description: 'Automated analytics report delivery schedule' };
    authFetch('/api/admin/settings/REPORT_SCHEDULE/', { method: 'PUT', body: JSON.stringify(payload) })
      .then((r) => (r.status === 404
        ? authFetch('/api/admin/settings/', { method: 'POST', body: JSON.stringify(payload) })
        : r))
      .then(() => setSchedSaved(true))
      .catch(() => {});
  };

  if (loading) return <p className="text-sm text-brand-muted">Gathering report analytics...</p>;
  if (!data) return <p className="text-sm text-brand-muted font-semibold">Failed to load analytics.</p>;

  // Safe defaults — prevents TypeError when API returns partial data
  const sales = data.sales || { currency: 'GBP', total_revenue: 0, aov: 0 };
  const customers = data.customers || { repeat_purchase_rate: 0, total_customers: 0 };
  const marketing = Array.isArray(data.marketing) ? data.marketing : [];


  return (
    <div className="space-y-6">
      {/* Action triggers */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-edge-subtle pb-3">
        <h3 className="text-sm font-semibold text-ink-primary">Performance Exporter</h3>
        <div className="flex gap-2">
          <button onClick={triggerPDFDownload} className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-edge bg-white rounded-sm"><Download className="h-3.5 w-3.5 text-ink-accent" /> Export PDF Summary</button>
          <button onClick={triggerCSVDownload} className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-edge bg-white rounded-sm"><Download className="h-3.5 w-3.5 text-ink-accent" /> Export CSV Spreadsheet</button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-md border border-edge bg-white shadow-card p-4">
          <p className="text-sm text-brand-muted font-semibold">GROSS SALES REVENUE</p>
          <p className="mt-1 text-2xl font-semibold text-ink-primary">{sales.currency} {Number(sales.total_revenue || 0).toLocaleString()}</p>
          <p className="text-[12px] text-ink-subtle mt-1">Average Order Value: {sales.currency} {Number(sales.aov || 0).toFixed(2)}</p>
        </div>
        <div className="rounded-md border border-edge bg-white shadow-card p-4">
          <p className="text-sm text-brand-muted font-semibold">REPEAT CUSTOMER RATE</p>
          <p className="mt-1 text-2xl font-semibold text-ink-primary">{Number(customers.repeat_purchase_rate || 0).toFixed(1)}%</p>
          <p className="text-[12px] text-ink-subtle mt-1">Total buyer database size: {customers.total_customers}</p>
        </div>
        <div className="rounded-md border border-edge bg-white shadow-card p-4">
          <p className="text-sm text-brand-muted font-semibold">TOTAL CAMPAIGN CLICKS</p>
          <p className="mt-1 text-2xl font-semibold text-ink-accent">
            {marketing.reduce((acc, c) => acc + c.clicks, 0).toLocaleString()}
          </p>
          <p className="text-[12px] text-ink-subtle mt-1">Total campaign conversions: {marketing.reduce((acc, c) => acc + c.conversions, 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Schedule automated report generation */}
      <div className="rounded-lg border border-edge bg-white shadow-card p-5 space-y-4">
        <div className="border-b border-edge-subtle pb-2">
          <h4 className="text-sm font-semibold text-ink-primary uppercase">Schedule Automated Reports Delivery</h4>
          <p className="text-[13px] text-brand-muted">Configure the platform to automatically compile and email summary performance reports.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 text-sm">
          <div>
            <p className="font-semibold text-brand-muted mb-1">FREQUENCY</p>
            <select value={scheduler.frequency} onChange={(e) => setScheduler({ ...scheduler, frequency: e.target.value })} className="w-full rounded-sm border border-edge p-2 text-sm bg-white">
              <option value="daily">Daily digest</option>
              <option value="weekly">Weekly performance sheet</option>
              <option value="monthly">Monthly audit pack</option>
            </select>
          </div>
          <div>
            <p className="font-semibold text-brand-muted mb-1">RECIPIENT EMAIL</p>
            <input placeholder="admin@scleroproteins.com" value={scheduler.email} onChange={(e) => setScheduler({ ...scheduler, email: e.target.value })} className="w-full rounded-sm border border-edge p-2 text-sm" />
          </div>
          <div className="flex items-end">
            <button onClick={saveScheduler} className="btn-primary w-full py-2 font-semibold uppercase">Schedule Delivery</button>
            {schedSaved && <p className="text-[13px] font-semibold text-brand-success text-center">✓ Schedule saved</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Settings */
function GeneralSettingsTab({ authFetch }) {
  const [checkoutSettings, setCheckoutSettings] = useState({ allow_guest_checkout: true });
  const [checkoutSaving, setCheckoutSaving] = useState(false);
  const [checkoutSaved, setCheckoutSaved] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  // Real, wired tax-mode setting (inclusive | exclusive).
  const [taxMode, setTaxMode] = useState('inclusive');
  const [taxSaving, setTaxSaving] = useState(false);
  const [taxSaved, setTaxSaved] = useState(false);

  // New settings states
  const [companyInfo, setCompanyInfo] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    gst: '',
    cin: '',
    support: ''
  });
  const [companySaving, setCompanySaving] = useState(false);
  const [companySaved, setCompanySaved] = useState(false);

  const [socialLinks, setSocialLinks] = useState({
    facebook: '',
    instagram: '',
    linkedin: '',
    x: '',
    youtube: '',
    pinterest: '',
    whatsapp: '',
    telegram: ''
  });
  const [socialSaving, setSocialSaving] = useState(false);
  const [socialSaved, setSocialSaved] = useState(false);

  const [seoSettings, setSeoSettings] = useState({
    metaTitle: '',
    metaDescription: '',
    metaKeywords: '',
    googleAnalytics: '',
    gtm: '',
    fbPixel: '',
    ogImage: '',
    twitterHandle: '',
    robotsTxt: '',
    schemaMarkup: ''
  });
  const [seoSaving, setSeoSaving] = useState(false);
  const [seoSaved, setSeoSaved] = useState(false);

  useEffect(() => {
    authFetch('/api/admin/tax-settings/')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && d.tax_mode) setTaxMode(d.tax_mode); })
      .catch(() => {});
  }, [authFetch]);

  useEffect(() => {
    authFetch('/api/admin/settings/CHECKOUT_SETTINGS/')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const value = d?.value && typeof d.value === 'object' ? d.value : {};
        const enabled = value.allow_guest_checkout;
        const legacyEnabled = value.guest_checkout_enabled;
        setCheckoutSettings({
          allow_guest_checkout: typeof enabled !== 'undefined'
            ? Boolean(enabled)
            : typeof legacyEnabled !== 'undefined'
              ? Boolean(legacyEnabled)
              : true,
        });
      })
      .catch(() => {});

    authFetch('/api/admin/settings/COMPANY_INFO/')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d && d.value) setCompanyInfo(prev => ({ ...prev, ...d.value }));
      })
      .catch(() => {});

    authFetch('/api/admin/settings/SOCIAL_LINKS/')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d && d.value) setSocialLinks(prev => ({ ...prev, ...d.value }));
      })
      .catch(() => {});

    authFetch('/api/admin/settings/SEO_SETTINGS/')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d && d.value) setSeoSettings(prev => ({ ...prev, ...d.value }));
      })
      .catch(() => {});
  }, [authFetch]);

  const saveTaxMode = (mode) => {
    setTaxMode(mode);
    setTaxSaving(true);
    setTaxSaved(false);
    authFetch('/api/admin/tax-settings/', { method: 'PUT', body: JSON.stringify({ tax_mode: mode }) })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && d.tax_mode) setTaxMode(d.tax_mode); setTaxSaved(true); })
      .catch(() => {})
      .finally(() => setTaxSaving(false));
  };

  const saveCheckoutSettings = async (nextValue) => {
    const value = { allow_guest_checkout: Boolean(nextValue), guest_checkout_enabled: Boolean(nextValue) };
    setCheckoutSettings(value);
    setCheckoutSaving(true);
    setCheckoutError('');
    setCheckoutSaved(false);
    try {
      let response = await authFetch('/api/admin/settings/CHECKOUT_SETTINGS/', {
        method: 'PUT',
        body: JSON.stringify({
          key: 'CHECKOUT_SETTINGS',
          value,
          description: 'Guest checkout availability for the storefront',
        })
      });
      if (response.status === 404) {
        response = await authFetch('/api/admin/settings/', {
          method: 'POST',
          body: JSON.stringify({
            key: 'CHECKOUT_SETTINGS',
            value,
            description: 'Guest checkout availability for the storefront',
          })
        });
      }
      if (!response.ok) {
        throw new Error('Unable to update guest checkout setting right now.');
      }
      setCheckoutSaved(true);
      setTimeout(() => setCheckoutSaved(false), 1800);
    } catch (err) {
      setCheckoutError(err.message || 'Unable to update guest checkout setting right now.');
    } finally {
      setCheckoutSaving(false);
    }
  };

  const saveCompanyInfo = async () => {
    setCompanySaving(true);
    setCompanySaved(false);
    try {
      let response = await authFetch('/api/admin/settings/COMPANY_INFO/', {
        method: 'PUT',
        body: JSON.stringify({ key: 'COMPANY_INFO', value: companyInfo, description: 'Storefront company contact details and tax registrations' })
      });
      if (response.status === 404) {
        response = await authFetch('/api/admin/settings/', {
          method: 'POST',
          body: JSON.stringify({ key: 'COMPANY_INFO', value: companyInfo, description: 'Storefront company contact details and tax registrations' })
        });
      }
      if (response.ok) {
        setCompanySaved(true);
        setTimeout(() => setCompanySaved(false), 2000);
      }
    } catch {}
    setCompanySaving(false);
  };

  const saveSocialLinks = async () => {
    setSocialSaving(true);
    setSocialSaved(false);
    try {
      let response = await authFetch('/api/admin/settings/SOCIAL_LINKS/', {
        method: 'PUT',
        body: JSON.stringify({ key: 'SOCIAL_LINKS', value: socialLinks, description: 'Storefront social media links' })
      });
      if (response.status === 404) {
        response = await authFetch('/api/admin/settings/', {
          method: 'POST',
          body: JSON.stringify({ key: 'SOCIAL_LINKS', value: socialLinks, description: 'Storefront social media links' })
        });
      }
      if (response.ok) {
        setSocialSaved(true);
        setTimeout(() => setSocialSaved(false), 2000);
      }
    } catch {}
    setSocialSaving(false);
  };

  const saveSeoSettings = async () => {
    setSeoSaving(true);
    setSeoSaved(false);
    try {
      let response = await authFetch('/api/admin/settings/SEO_SETTINGS/', {
        method: 'PUT',
        body: JSON.stringify({ key: 'SEO_SETTINGS', value: seoSettings, description: 'SEO settings and tracking tags' })
      });
      if (response.status === 404) {
        response = await authFetch('/api/admin/settings/', {
          method: 'POST',
          body: JSON.stringify({ key: 'SEO_SETTINGS', value: seoSettings, description: 'SEO settings and tracking tags' })
        });
      }
      if (response.ok) {
        setSeoSaved(true);
        setTimeout(() => setSeoSaved(false), 2000);
      }
    } catch {}
    setSeoSaving(false);
  };

  const TAX_OPTIONS = [
    { v: 'inclusive', title: 'Tax inclusive', desc: 'Displayed prices already include VAT/GST. Checkout shows tax as "included" and does not add it on top.' },
    { v: 'exclusive', title: 'Tax exclusive', desc: 'Displayed prices are net. VAT/GST is added as a separate line at checkout.' },
  ];

  return (
    <div className="space-y-8 text-sm">
      {/* Tax & pricing — wired to the live store config */}
      <div className="bg-white rounded-lg border border-edge p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink-primary mb-1 uppercase">Tax &amp; pricing</h3>
            <p className="text-brand-muted">Choose how product prices display and how tax is charged at checkout.</p>
          </div>
          {taxSaved && <span className="text-[13px] font-semibold text-brand-success">✓ Saved</span>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {TAX_OPTIONS.map((o) => (
            <button
              key={o.v}
              type="button"
              disabled={taxSaving}
              onClick={() => saveTaxMode(o.v)}
              className={`text-left rounded-md border p-3.5 transition disabled:opacity-60 ${
                taxMode === o.v ? 'border-ink-primary bg-surface-muted ring-1 ring-edge-focus/30' : 'border-edge hover:border-edge-strong'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold text-ink-primary">
                <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${taxMode === o.v ? 'border-ink-primary' : 'border-edge-strong'}`}>
                  {taxMode === o.v && <span className="h-2 w-2 rounded-full bg-ink-primary" />}
                </span>
                {o.title}
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-brand-muted">{o.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Checkout access */}
      <div className="bg-white rounded-lg border border-edge p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-ink-primary mb-1 uppercase">Checkout access</h3>
            <p className="text-brand-muted mb-0">Control whether shoppers can place orders without signing in.</p>
          </div>
          {checkoutSaved && <span className="text-[13px] font-semibold text-brand-success">✓ Saved</span>}
        </div>
        {checkoutError && <p className="mt-2 text-[13px] font-semibold text-brand-danger">{checkoutError}</p>}
        <button
          type="button"
          onClick={() => saveCheckoutSettings(!checkoutSettings.allow_guest_checkout)}
          disabled={checkoutSaving}
          className={`mt-3 flex w-full items-center justify-between rounded-md border p-3 text-left transition disabled:opacity-60 ${
            checkoutSettings.allow_guest_checkout
              ? 'border-ink-primary bg-surface-muted ring-1 ring-edge-focus/30'
              : 'border-edge hover:border-edge-strong'
          }`}
        >
          <div>
            <div className="flex items-center gap-2 font-semibold text-ink-primary">
              {checkoutSettings.allow_guest_checkout ? (
                <ToggleRight className="h-4 w-4 text-ink-accent" />
              ) : (
                <ToggleLeft className="h-4 w-4 text-ink-subtle" />
              )}
              Guest checkout {checkoutSettings.allow_guest_checkout ? 'enabled' : 'disabled'}
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-brand-muted">
              When enabled, shoppers can complete checkout as guests. When disabled, login is required before payment.
            </p>
          </div>
          <span className="text-[12px] font-semibold uppercase text-brand-muted">
            {checkoutSettings.allow_guest_checkout ? 'On' : 'Off'}
          </span>
        </button>
      </div>

      {/* Company Information */}
      <div className="bg-white rounded-lg border border-edge p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-edge-subtle pb-3">
          <div>
            <h3 className="text-sm font-semibold text-ink-primary uppercase">Company Information</h3>
            <p className="text-brand-muted mt-0.5">Manage registration numbers, tax compliance, and addresses.</p>
          </div>
          <button onClick={saveCompanyInfo} disabled={companySaving} className="btn-primary px-4 py-2 uppercase font-semibold">
            {companySaving ? 'Saving' : companySaved ? 'Saved ✓' : 'Save Info'}
          </button>
        </div>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block font-semibold text-ink-primary mb-1">Company Name</label>
            <input type="text" value={companyInfo.name || ''} onChange={(e) => setCompanyInfo({ ...companyInfo, name: e.target.value })} className="w-full rounded border border-edge p-2 bg-surface" />
          </div>
          <div>
            <label className="block font-semibold text-ink-primary mb-1">Support Contacts</label>
            <input type="text" value={companyInfo.support || ''} onChange={(e) => setCompanyInfo({ ...companyInfo, support: e.target.value })} className="w-full rounded border border-edge p-2 bg-surface" placeholder="e.g. operations@scleroproteins.com" />
          </div>
          <div>
            <label className="block font-semibold text-ink-primary mb-1">Email Addresses</label>
            <input type="text" value={companyInfo.email || ''} onChange={(e) => setCompanyInfo({ ...companyInfo, email: e.target.value })} className="w-full rounded border border-edge p-2 bg-surface" />
          </div>
          <div>
            <label className="block font-semibold text-ink-primary mb-1">Mobile Numbers</label>
            <input type="text" value={companyInfo.phone || ''} onChange={(e) => setCompanyInfo({ ...companyInfo, phone: e.target.value })} className="w-full rounded border border-edge p-2 bg-surface" />
          </div>
          <div>
            <label className="block font-semibold text-ink-primary mb-1">GST/VAT Registration</label>
            <input type="text" value={companyInfo.gst || ''} onChange={(e) => setCompanyInfo({ ...companyInfo, gst: e.target.value })} className="w-full rounded border border-edge p-2 bg-surface" placeholder="e.g. GSTIN 24AAACS7022H1Z1" />
          </div>
          <div>
            <label className="block font-semibold text-ink-primary mb-1">CIN/PAN Registration</label>
            <input type="text" value={companyInfo.cin || ''} onChange={(e) => setCompanyInfo({ ...companyInfo, cin: e.target.value })} className="w-full rounded border border-edge p-2 bg-surface" placeholder="e.g. U74999GJ2026PTC123456" />
          </div>
          <div className="sm:col-span-2">
            <label className="block font-semibold text-ink-primary mb-1">Office Address</label>
            <textarea rows={2} value={companyInfo.address || ''} onChange={(e) => setCompanyInfo({ ...companyInfo, address: e.target.value })} className="w-full rounded border border-edge p-2 bg-surface" />
          </div>
        </div>
      </div>

      {/* Social Media Links */}
      <div className="bg-white rounded-lg border border-edge p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-edge-subtle pb-3">
          <div>
            <h3 className="text-sm font-semibold text-ink-primary uppercase">Social Media Management</h3>
            <p className="text-brand-muted mt-0.5">Control active external community link locations.</p>
          </div>
          <button onClick={saveSocialLinks} disabled={socialSaving} className="btn-primary px-4 py-2 uppercase font-semibold">
            {socialSaving ? 'Saving' : socialSaved ? 'Saved ✓' : 'Save Links'}
          </button>
        </div>
        
        <div className="grid gap-4 sm:grid-cols-2">
          {['facebook', 'instagram', 'linkedin', 'x', 'youtube', 'pinterest', 'whatsapp', 'telegram'].map((platform) => (
            <div key={platform}>
              <label className="block font-semibold text-ink-primary mb-1 capitalize">{platform}</label>
              <input type="text" value={socialLinks[platform] || ''} onChange={(e) => setSocialLinks({ ...socialLinks, [platform]: e.target.value })} className="w-full rounded border border-edge p-2 bg-surface" placeholder={`https://${platform}.com/...`} />
            </div>
          ))}
        </div>
      </div>

      {/* SEO & Tracking pixels */}
      <div className="bg-white rounded-lg border border-edge p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-edge-subtle pb-3">
          <div>
            <h3 className="text-sm font-semibold text-ink-primary uppercase">SEO &amp; Integrations Settings</h3>
            <p className="text-brand-muted mt-0.5">Configure default index keywords, descriptions, sitemaps, and tracking script triggers.</p>
          </div>
          <button onClick={saveSeoSettings} disabled={seoSaving} className="btn-primary px-4 py-2 uppercase font-semibold">
            {seoSaving ? 'Saving' : seoSaved ? 'Saved ✓' : 'Save Settings'}
          </button>
        </div>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block font-semibold text-ink-primary mb-1">Default Meta Title</label>
            <input type="text" value={seoSettings.metaTitle || ''} onChange={(e) => setSeoSettings({ ...seoSettings, metaTitle: e.target.value })} className="w-full rounded border border-edge p-2 bg-surface" />
          </div>
          <div>
            <label className="block font-semibold text-ink-primary mb-1">Default Meta Keywords</label>
            <input type="text" value={seoSettings.metaKeywords || ''} onChange={(e) => setSeoSettings({ ...seoSettings, metaKeywords: e.target.value })} className="w-full rounded border border-edge p-2 bg-surface" />
          </div>
          <div className="sm:col-span-2">
            <label className="block font-semibold text-ink-primary mb-1">Default Meta Description</label>
            <textarea rows={2} value={seoSettings.metaDescription || ''} onChange={(e) => setSeoSettings({ ...seoSettings, metaDescription: e.target.value })} className="w-full rounded border border-edge p-2 bg-surface" />
          </div>
          <div>
            <label className="block font-semibold text-ink-primary mb-1">Google Analytics ID UK (G-XXXXX)</label>
            <input type="text" value={seoSettings.googleAnalytics || ''} onChange={(e) => setSeoSettings({ ...seoSettings, googleAnalytics: e.target.value })} className="w-full rounded border border-edge p-2 bg-surface" />
          </div>
          <div>
            <label className="block font-semibold text-ink-primary mb-1">Google Analytics ID India (G-XXXXX)</label>
            <input type="text" value={seoSettings.googleAnalyticsIN || ''} onChange={(e) => setSeoSettings({ ...seoSettings, googleAnalyticsIN: e.target.value })} className="w-full rounded border border-edge p-2 bg-surface" />
          </div>
          <div>
            <label className="block font-semibold text-ink-primary mb-1">Google Site Verification Token</label>
            <input type="text" value={seoSettings.googleSiteVerification || ''} onChange={(e) => setSeoSettings({ ...seoSettings, googleSiteVerification: e.target.value })} className="w-full rounded border border-edge p-2 bg-surface" placeholder="e.g. google-site-verification-token" />
          </div>
          <div>
            <label className="block font-semibold text-ink-primary mb-1">Google Tag Manager (GTM-XXXXX)</label>
            <input type="text" value={seoSettings.gtm || ''} onChange={(e) => setSeoSettings({ ...seoSettings, gtm: e.target.value })} className="w-full rounded border border-edge p-2 bg-surface" />
          </div>
          <div>
            <label className="block font-semibold text-ink-primary mb-1">Social Share Image URL</label>
            <input type="url" value={seoSettings.ogImage || ''} onChange={(e) => setSeoSettings({ ...seoSettings, ogImage: e.target.value })} className="w-full rounded border border-edge p-2 bg-surface" placeholder="https://…" />
          </div>
          <div>
            <label className="block font-semibold text-ink-primary mb-1">X / Twitter Handle</label>
            <input type="text" value={seoSettings.twitterHandle || ''} onChange={(e) => setSeoSettings({ ...seoSettings, twitterHandle: e.target.value })} className="w-full rounded border border-edge p-2 bg-surface" placeholder="@brand" />
          </div>
          <div>
            <label className="block font-semibold text-ink-primary mb-1">Facebook Pixel ID</label>
            <input type="text" value={seoSettings.fbPixel || ''} onChange={(e) => setSeoSettings({ ...seoSettings, fbPixel: e.target.value })} className="w-full rounded border border-edge p-2 bg-surface" />
          </div>
          <div>
            <label className="block font-semibold text-ink-primary mb-1">Robots.txt content</label>
            <input type="text" value={seoSettings.robotsTxt || ''} onChange={(e) => setSeoSettings({ ...seoSettings, robotsTxt: e.target.value })} className="w-full rounded border border-edge p-2 bg-surface" placeholder="e.g. User-agent: * Allow: /" />
          </div>
          <div className="sm:col-span-2">
            <label className="block font-semibold text-ink-primary mb-1">Structured Schema Markup (JSON-LD)</label>
            <textarea rows={3} value={seoSettings.schemaMarkup || ''} onChange={(e) => setSeoSettings({ ...seoSettings, schemaMarkup: e.target.value })} className="w-full rounded border border-edge p-2 bg-surface font-mono" placeholder='{"@context": "https://schema.org", "@type": "Organization"}' />
          </div>
        </div>
      </div>

    </div>
  );
}

function HomepageSettingsTab({ authFetch }) {
  const [settings, setSettings] = useState(() => normalizeHomepageSettings(DEFAULT_HOMEPAGE_SETTINGS));
  const [activeSection, setActiveSection] = useState('trustSection');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    authFetch('/api/admin/settings/HOMEPAGE_SETTINGS/')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setSettings(normalizeHomepageSettings(d?.value)))
      .catch(() => setSettings(normalizeHomepageSettings(DEFAULT_HOMEPAGE_SETTINGS)));
  }, [authFetch]);

  const SECTION_OPTIONS = [
    { key: 'seo', label: 'SEO' },
    { key: 'highlightStrip', label: 'Highlight Strip' },
    { key: 'trustSection', label: 'Trust Section' },
    { key: 'productShowcase', label: 'Product Showcase' },
    { key: 'quizSection', label: 'Quiz Section' },
    { key: 'chooseSection', label: 'Why Choose Us' },
    { key: 'comparisonSection', label: 'Comparison' },
    { key: 'ingredientsSection', label: 'Ingredients' },
    { key: 'conversionSection', label: 'Conversion Block' },
    { key: 'faqSection', label: 'FAQs' },
    { key: 'educationSection', label: 'Education' },
    { key: 'inquirySection', label: 'Inquiry CTA' },
  ];

  const syncSettings = (next) => {
    setSettings(normalizeHomepageSettings(next));
  };

  const updateSectionField = (sectionKey, field, value) => {
    syncSettings({
      ...settings,
      [sectionKey]: {
        ...settings[sectionKey],
        [field]: value,
      },
    });
  };

  const updateNestedField = (sectionKey, parentKey, field, value) => {
    syncSettings({
      ...settings,
      [sectionKey]: {
        ...settings[sectionKey],
        [parentKey]: {
          ...settings[sectionKey][parentKey],
          [field]: value,
        },
      },
    });
  };

  const updateArrayItem = (sectionKey, arrayKey, index, field, value) => {
    const nextItems = [...(settings[sectionKey][arrayKey] || [])];
    nextItems[index] = {
      ...nextItems[index],
      [field]: value,
    };
    updateSectionField(sectionKey, arrayKey, nextItems);
  };

  const addArrayItem = (sectionKey, arrayKey, template) => {
    updateSectionField(sectionKey, arrayKey, [...(settings[sectionKey][arrayKey] || []), template]);
  };

  const removeArrayItem = (sectionKey, arrayKey, index) => {
    updateSectionField(sectionKey, arrayKey, (settings[sectionKey][arrayKey] || []).filter((_, itemIndex) => itemIndex !== index));
  };

  const updateQuizContent = (field, value) => {
    updateSectionField('quizSection', 'content', { ...settings.quizSection.content, [field]: value });
  };

  const updateQuizStep = (index, field, value) => {
    const steps = [...settings.quizSection.content.steps];
    steps[index] = { ...steps[index], [field]: value };
    updateQuizContent('steps', steps);
  };

  const updateQuizOption = (stepIndex, optionIndex, field, value) => {
    const steps = [...settings.quizSection.content.steps];
    const options = [...steps[stepIndex].options];
    options[optionIndex] = { ...options[optionIndex], [field]: value };
    steps[stepIndex] = { ...steps[stepIndex], options };
    updateQuizContent('steps', steps);
  };

  const addQuizOption = (stepIndex) => {
    const steps = [...settings.quizSection.content.steps];
    steps[stepIndex] = {
      ...steps[stepIndex],
      options: [...steps[stepIndex].options, { value: 'new-option', label: 'New option', icon: '✓', description: 'Add a short description.' }],
    };
    updateQuizContent('steps', steps);
  };

  const removeQuizOption = (stepIndex, optionIndex) => {
    const steps = [...settings.quizSection.content.steps];
    steps[stepIndex] = { ...steps[stepIndex], options: steps[stepIndex].options.filter((_, index) => index !== optionIndex) };
    updateQuizContent('steps', steps);
  };

  const saveHomepageSettings = async () => {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const normalized = normalizeHomepageSettings(settings);
      const payload = {
        key: 'HOMEPAGE_SETTINGS',
        value: normalized,
        description: 'Homepage copy, product showcase labels, CTAs, FAQs, testimonial messaging, and section content.',
      };

      let response = await authFetch('/api/admin/settings/HOMEPAGE_SETTINGS/', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (response.status === 404) {
        response = await authFetch('/api/admin/settings/', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      if (!response.ok) {
        throw new Error('Could not save homepage settings.');
      }
      syncSettings(normalized);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message || 'Could not save homepage settings.');
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    syncSettings(DEFAULT_HOMEPAGE_SETTINGS);
  };

  const InputField = ({ label, value, onChange, placeholder = '' }) => (
    <div>
      <label className="mb-1 block font-semibold text-ink-primary">{label}</label>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded border border-edge p-2 bg-surface"
      />
    </div>
  );

  const TextAreaField = ({ label, value, onChange, rows = 3, placeholder = '' }) => (
    <div>
      <label className="mb-1 block font-semibold text-ink-primary">{label}</label>
      <textarea
        rows={rows}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded border border-edge p-2 bg-surface"
      />
    </div>
  );

  const ToggleField = ({ checked, onChange, label, description }) => (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition ${
        checked ? 'border-ink-primary bg-surface-muted' : 'border-edge bg-white'
      }`}
    >
      <div>
        <p className="font-semibold text-ink-primary">{label}</p>
        {description ? <p className="mt-1 text-[13px] text-brand-muted">{description}</p> : null}
      </div>
      {checked ? <ToggleRight className="h-5 w-5 text-ink-accent" /> : <ToggleLeft className="h-5 w-5 text-ink-subtle" />}
    </button>
  );

  const ArrayCard = ({ title, subtitle, children, onAdd }) => (
    <div className="rounded-lg border border-edge bg-white p-4 space-y-4">
      <div className="flex items-center justify-between gap-3 border-b border-edge-subtle pb-3">
        <div>
          <h4 className="text-sm font-semibold uppercase text-ink-primary">{title}</h4>
          {subtitle ? <p className="mt-1 text-[13px] text-brand-muted">{subtitle}</p> : null}
        </div>
        {onAdd ? (
          <button type="button" onClick={onAdd} className="rounded-sm border border-edge px-3 py-1.5 text-[12px] font-semibold uppercase text-ink-primary">
            Add item
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );

  const renderSectionEditor = () => {
    switch (activeSection) {
      case 'seo':
        return (
          <div className="space-y-4">
            <InputField label="Homepage SEO title" value={settings.seo.metaTitle} onChange={(value) => updateSectionField('seo', 'metaTitle', value)} />
            <TextAreaField label="Homepage SEO description" value={settings.seo.metaDescription} onChange={(value) => updateSectionField('seo', 'metaDescription', value)} />
            <TextAreaField label="Homepage keywords" value={settings.seo.keywords} onChange={(value) => updateSectionField('seo', 'keywords', value)} rows={2} />
          </div>
        );
      case 'highlightStrip':
        return (
          <div className="space-y-4">
            <ToggleField checked={settings.highlightStrip.enabled !== false} onChange={(value) => updateSectionField('highlightStrip', 'enabled', value)} label="Show highlight strip" description="Display the compact reassurance row immediately below the hero banner." />
            <ArrayCard title="Highlights" subtitle="Manage each short reassurance message and its icon." onAdd={() => addArrayItem('highlightStrip', 'items', { label: 'New highlight', icon: 'ShieldCheck' })}>
              <div className="space-y-3">
                {settings.highlightStrip.items.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="rounded-lg border border-edge bg-surface-muted p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold uppercase text-ink-accent">Highlight {index + 1}</p>
                      <button type="button" onClick={() => removeArrayItem('highlightStrip', 'items', index)} className="text-[12px] font-semibold uppercase text-red-600">Remove</button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <InputField label="Label" value={item.label} onChange={(value) => updateArrayItem('highlightStrip', 'items', index, 'label', value)} />
                      <InputField label="Icon name" value={item.icon} onChange={(value) => updateArrayItem('highlightStrip', 'items', index, 'icon', value)} placeholder="ShieldCheck" />
                    </div>
                  </div>
                ))}
              </div>
            </ArrayCard>
          </div>
        );
      case 'trustSection':
        return (
          <div className="space-y-4">
            <ToggleField checked={settings.trustSection.enabled !== false} onChange={(value) => updateSectionField('trustSection', 'enabled', value)} label="Show trust section" description="Display the opening trust and reassurance section on the homepage." />
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField label="Kicker" value={settings.trustSection.kicker} onChange={(value) => updateSectionField('trustSection', 'kicker', value)} />
              <InputField label="Headline" value={settings.trustSection.title} onChange={(value) => updateSectionField('trustSection', 'title', value)} />
            </div>
            <TextAreaField label="Description" value={settings.trustSection.description} onChange={(value) => updateSectionField('trustSection', 'description', value)} />
            <ArrayCard title="Trust cards" subtitle="Manage the short feature cards beside the headline." onAdd={() => addArrayItem('trustSection', 'cards', { title: 'New card', description: 'Add a short description.', icon: 'ShieldCheck' })}>
              <div className="space-y-3">
                {settings.trustSection.cards.map((item, index) => (
                  <div key={`${item.title}-${index}`} className="rounded-lg border border-edge bg-surface-muted p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold uppercase text-ink-accent">Card {index + 1}</p>
                      <button type="button" onClick={() => removeArrayItem('trustSection', 'cards', index)} className="text-[12px] font-semibold uppercase text-red-600">Remove</button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <InputField label="Title" value={item.title} onChange={(value) => updateArrayItem('trustSection', 'cards', index, 'title', value)} />
                      <InputField label="Icon name" value={item.icon} onChange={(value) => updateArrayItem('trustSection', 'cards', index, 'icon', value)} placeholder="ShieldCheck" />
                    </div>
                    <TextAreaField label="Description" value={item.description} onChange={(value) => updateArrayItem('trustSection', 'cards', index, 'description', value)} rows={2} />
                  </div>
                ))}
              </div>
            </ArrayCard>
          </div>
        );
      case 'productShowcase':
        return (
          <div className="space-y-4">
            <ToggleField checked={settings.productShowcase.enabled !== false} onChange={(value) => updateSectionField('productShowcase', 'enabled', value)} label="Show product showcase" description="Display the bestseller and latest-arrivals shopping section." />
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField label="CTA label" value={settings.productShowcase.ctaLabel} onChange={(value) => updateSectionField('productShowcase', 'ctaLabel', value)} />
              <InputField label="CTA URL" value={settings.productShowcase.ctaUrl} onChange={(value) => updateSectionField('productShowcase', 'ctaUrl', value)} />
            </div>
            <ArrayCard title="Product tabs" subtitle="Control each homepage product group, its label, subtitle, and product sort." onAdd={() => addArrayItem('productShowcase', 'tabs', { key: `section-${Date.now()}`, label: 'New product group', subtitle: 'Short supporting text.', apiSort: 'bestseller', limit: 4 })}>
              <div className="space-y-3">
                {settings.productShowcase.tabs.map((item, index) => (
                  <div key={`${item.key}-${index}`} className="rounded-lg border border-edge bg-surface-muted p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold uppercase text-ink-accent">Tab {index + 1}</p>
                      <button type="button" onClick={() => removeArrayItem('productShowcase', 'tabs', index)} className="text-[12px] font-semibold uppercase text-red-600">Remove</button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <InputField label="Unique key" value={item.key} onChange={(value) => updateArrayItem('productShowcase', 'tabs', index, 'key', value)} />
                      <InputField label="Button label" value={item.label} onChange={(value) => updateArrayItem('productShowcase', 'tabs', index, 'label', value)} />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <InputField label="API sort" value={item.apiSort} onChange={(value) => updateArrayItem('productShowcase', 'tabs', index, 'apiSort', value)} placeholder="bestseller or newest" />
                      <InputField label="Limit" value={String(item.limit || '')} onChange={(value) => updateArrayItem('productShowcase', 'tabs', index, 'limit', Number(value) || 4)} />
                    </div>
                    <TextAreaField label="Subtitle" value={item.subtitle} onChange={(value) => updateArrayItem('productShowcase', 'tabs', index, 'subtitle', value)} rows={2} />
                  </div>
                ))}
              </div>
            </ArrayCard>
          </div>
        );
      case 'quizSection':
        return (
          <div className="space-y-4">
            <ToggleField checked={settings.quizSection.enabled !== false} onChange={(value) => updateSectionField('quizSection', 'enabled', value)} label="Show quiz section" description="Display the product match quiz call-to-action block." />
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField label="Kicker" value={settings.quizSection.kicker} onChange={(value) => updateSectionField('quizSection', 'kicker', value)} />
              <InputField label="Headline" value={settings.quizSection.title} onChange={(value) => updateSectionField('quizSection', 'title', value)} />
            </div>
            <TextAreaField label="Description" value={settings.quizSection.description} onChange={(value) => updateSectionField('quizSection', 'description', value)} />
            <TextAreaField label="Card description" value={settings.quizSection.cardDescription} onChange={(value) => updateSectionField('quizSection', 'cardDescription', value)} rows={2} />
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField label="Button label" value={settings.quizSection.buttonLabel} onChange={(value) => updateSectionField('quizSection', 'buttonLabel', value)} />
              <InputField label="Icon name" value={settings.quizSection.icon} onChange={(value) => updateSectionField('quizSection', 'icon', value)} />
            </div>
            <ArrayCard title="Quiz interface labels" subtitle="Edit every heading, instruction, and action shown inside the quiz.">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['questionLabel', 'Question label'], ['ofLabel', 'Progress separator'], ['backLabel', 'Back button'],
                  ['nextLabel', 'Next button'], ['recommendationLabel', 'Recommendation button'], ['resultTitle', 'Result headline'],
                  ['resultDescription', 'Result description'], ['matchLabel', 'Match label'], ['addToCartLabel', 'Add to cart button'],
                  ['startOverLabel', 'Start over button'], ['preferencesLabel', 'Preferences heading'],
                ].map(([field, label]) => (
                  <InputField key={field} label={label} value={settings.quizSection.content[field]} onChange={(value) => updateQuizContent(field, value)} />
                ))}
              </div>
            </ArrayCard>
            <ArrayCard title="Quiz questions" subtitle="Manage each question and all selectable answers." onAdd={() => updateQuizContent('steps', [...settings.quizSection.content.steps, { id: `step-${Date.now()}`, title: 'New question', subtitle: 'Add a short instruction.', options: [] }])}>
              <div className="space-y-4">
                {settings.quizSection.content.steps.map((step, stepIndex) => (
                  <div key={`${step.id}-${stepIndex}`} className="rounded-lg border border-edge bg-surface-muted p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold uppercase text-ink-accent">Question {stepIndex + 1}</p>
                      <button type="button" onClick={() => updateQuizContent('steps', settings.quizSection.content.steps.filter((_, index) => index !== stepIndex))} className="text-[12px] font-semibold uppercase text-red-600">Remove</button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <InputField label="Question ID" value={step.id} onChange={(value) => updateQuizStep(stepIndex, 'id', value)} />
                      <InputField label="Question" value={step.title} onChange={(value) => updateQuizStep(stepIndex, 'title', value)} />
                    </div>
                    <InputField label="Instruction" value={step.subtitle} onChange={(value) => updateQuizStep(stepIndex, 'subtitle', value)} />
                    <div className="space-y-3 border-t border-edge pt-3">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-ink-primary">Answer options</p>
                        <button type="button" onClick={() => addQuizOption(stepIndex)} className="rounded-sm border border-edge bg-white px-3 py-1.5 text-[12px] font-semibold uppercase text-ink-primary">Add option</button>
                      </div>
                      {step.options.map((option, optionIndex) => (
                        <div key={`${option.value}-${optionIndex}`} className="rounded-lg border border-edge bg-white p-3 space-y-3">
                          <div className="flex justify-end">
                            <button type="button" onClick={() => removeQuizOption(stepIndex, optionIndex)} className="text-[12px] font-semibold uppercase text-red-600">Remove option</button>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-3">
                            <InputField label="Value" value={option.value} onChange={(value) => updateQuizOption(stepIndex, optionIndex, 'value', value)} />
                            <InputField label="Label" value={option.label} onChange={(value) => updateQuizOption(stepIndex, optionIndex, 'label', value)} />
                            <InputField label="Icon or emoji" value={option.icon} onChange={(value) => updateQuizOption(stepIndex, optionIndex, 'icon', value)} />
                          </div>
                          <InputField label="Description" value={option.description} onChange={(value) => updateQuizOption(stepIndex, optionIndex, 'description', value)} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ArrayCard>
            <ArrayCard title="Quiz recommendations" subtitle="Match answer keys to the product recommendation shown at completion." onAdd={() => updateQuizContent('recommendations', [...settings.quizSection.content.recommendations, { key: 'goal-time-lifestyle-preference', sku: 'PRODUCT-SKU', name: 'Product name', match: '90%', reason: 'Why this product is a match.' }])}>
              <div className="space-y-3">
                {settings.quizSection.content.recommendations.map((item, index) => (
                  <div key={`${item.key}-${index}`} className="rounded-lg border border-edge bg-surface-muted p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold uppercase text-ink-accent">Recommendation {index + 1}</p>
                      <button type="button" onClick={() => updateQuizContent('recommendations', settings.quizSection.content.recommendations.filter((_, itemIndex) => itemIndex !== index))} className="text-[12px] font-semibold uppercase text-red-600">Remove</button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {['key', 'sku', 'name', 'match'].map((field) => (
                        <InputField key={field} label={field === 'key' ? 'Answer key' : field.toUpperCase()} value={item[field]} onChange={(value) => {
                          const next = [...settings.quizSection.content.recommendations];
                          next[index] = { ...next[index], [field]: value };
                          updateQuizContent('recommendations', next);
                        }} />
                      ))}
                    </div>
                    <InputField label="Reason" value={item.reason} onChange={(value) => {
                      const next = [...settings.quizSection.content.recommendations];
                      next[index] = { ...next[index], reason: value };
                      updateQuizContent('recommendations', next);
                    }} />
                  </div>
                ))}
              </div>
            </ArrayCard>
            <ArrayCard title="Default recommendation" subtitle="Used when no exact answer key is configured.">
              <div className="grid gap-3 sm:grid-cols-2">
                {['sku', 'name', 'match', 'reason'].map((field) => (
                  <InputField key={field} label={field === 'sku' ? 'SKU' : field[0].toUpperCase() + field.slice(1)} value={settings.quizSection.content.fallbackRecommendation[field]} onChange={(value) => updateQuizContent('fallbackRecommendation', { ...settings.quizSection.content.fallbackRecommendation, [field]: value })} />
                ))}
              </div>
            </ArrayCard>
          </div>
        );
      case 'chooseSection':
        return (
          <div className="space-y-4">
            <ToggleField checked={settings.chooseSection.enabled !== false} onChange={(value) => updateSectionField('chooseSection', 'enabled', value)} label="Show Why Choose Us section" description="Display the supporting brand benefit section." />
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField label="Kicker" value={settings.chooseSection.kicker} onChange={(value) => updateSectionField('chooseSection', 'kicker', value)} />
              <InputField label="Headline" value={settings.chooseSection.title} onChange={(value) => updateSectionField('chooseSection', 'title', value)} />
            </div>
            <TextAreaField label="Description" value={settings.chooseSection.description} onChange={(value) => updateSectionField('chooseSection', 'description', value)} />
            <ArrayCard title="Benefit cards" subtitle="Manage the cards in the Why Choose Us section." onAdd={() => addArrayItem('chooseSection', 'cards', { title: 'New card', description: 'Add a short description.', icon: 'HeartHandshake' })}>
              <div className="space-y-3">
                {settings.chooseSection.cards.map((item, index) => (
                  <div key={`${item.title}-${index}`} className="rounded-lg border border-edge bg-surface-muted p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold uppercase text-ink-accent">Card {index + 1}</p>
                      <button type="button" onClick={() => removeArrayItem('chooseSection', 'cards', index)} className="text-[12px] font-semibold uppercase text-red-600">Remove</button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <InputField label="Title" value={item.title} onChange={(value) => updateArrayItem('chooseSection', 'cards', index, 'title', value)} />
                      <InputField label="Icon name" value={item.icon} onChange={(value) => updateArrayItem('chooseSection', 'cards', index, 'icon', value)} />
                    </div>
                    <TextAreaField label="Description" value={item.description} onChange={(value) => updateArrayItem('chooseSection', 'cards', index, 'description', value)} rows={2} />
                  </div>
                ))}
              </div>
            </ArrayCard>
          </div>
        );
      case 'comparisonSection':
        return (
          <div className="space-y-4">
            <ToggleField checked={settings.comparisonSection.enabled !== false} onChange={(value) => updateSectionField('comparisonSection', 'enabled', value)} label="Show comparison section" description="Display the Sclero vs Others comparison table." />
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField label="Kicker" value={settings.comparisonSection.kicker} onChange={(value) => updateSectionField('comparisonSection', 'kicker', value)} />
              <InputField label="Headline" value={settings.comparisonSection.title} onChange={(value) => updateSectionField('comparisonSection', 'title', value)} />
            </div>
            <TextAreaField label="Description" value={settings.comparisonSection.description} onChange={(value) => updateSectionField('comparisonSection', 'description', value)} />
            <div className="grid gap-4 sm:grid-cols-3">
              <InputField label="Header left" value={settings.comparisonSection.headers.left} onChange={(value) => updateNestedField('comparisonSection', 'headers', 'left', value)} />
              <InputField label="Header middle" value={settings.comparisonSection.headers.middle} onChange={(value) => updateNestedField('comparisonSection', 'headers', 'middle', value)} />
              <InputField label="Header right" value={settings.comparisonSection.headers.right} onChange={(value) => updateNestedField('comparisonSection', 'headers', 'right', value)} />
            </div>
            <ArrayCard title="Comparison rows" subtitle="Add, edit, or remove rows in the comparison table." onAdd={() => addArrayItem('comparisonSection', 'rows', { label: 'New point', sclero: 'Sclero value', others: 'Other brands value' })}>
              <div className="space-y-3">
                {settings.comparisonSection.rows.map((item, index) => (
                  <div key={`${item.label}-${index}`} className="rounded-lg border border-edge bg-surface-muted p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold uppercase text-ink-accent">Row {index + 1}</p>
                      <button type="button" onClick={() => removeArrayItem('comparisonSection', 'rows', index)} className="text-[12px] font-semibold uppercase text-red-600">Remove</button>
                    </div>
                    <InputField label="Label" value={item.label} onChange={(value) => updateArrayItem('comparisonSection', 'rows', index, 'label', value)} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <TextAreaField label="Sclero column" value={item.sclero} onChange={(value) => updateArrayItem('comparisonSection', 'rows', index, 'sclero', value)} rows={2} />
                      <TextAreaField label="Others column" value={item.others} onChange={(value) => updateArrayItem('comparisonSection', 'rows', index, 'others', value)} rows={2} />
                    </div>
                  </div>
                ))}
              </div>
            </ArrayCard>
          </div>
        );
      case 'ingredientsSection':
        return (
          <div className="space-y-4">
            <ToggleField checked={settings.ingredientsSection.enabled !== false} onChange={(value) => updateSectionField('ingredientsSection', 'enabled', value)} label="Show ingredients section" description="Display the ingredient image and supporting ingredient cards." />
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField label="Kicker" value={settings.ingredientsSection.kicker} onChange={(value) => updateSectionField('ingredientsSection', 'kicker', value)} />
              <InputField label="Headline" value={settings.ingredientsSection.title} onChange={(value) => updateSectionField('ingredientsSection', 'title', value)} />
            </div>
            <TextAreaField label="Description" value={settings.ingredientsSection.description} onChange={(value) => updateSectionField('ingredientsSection', 'description', value)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField label="Image URL" value={settings.ingredientsSection.imageUrl} onChange={(value) => updateSectionField('ingredientsSection', 'imageUrl', value)} />
              <InputField label="Image alt text" value={settings.ingredientsSection.imageAlt} onChange={(value) => updateSectionField('ingredientsSection', 'imageAlt', value)} />
            </div>
            <ArrayCard title="Ingredient cards" subtitle="Manage the ingredient highlights." onAdd={() => addArrayItem('ingredientsSection', 'cards', { title: 'New ingredient', benefit: 'Add a short customer-friendly benefit.' })}>
              <div className="space-y-3">
                {settings.ingredientsSection.cards.map((item, index) => (
                  <div key={`${item.title}-${index}`} className="rounded-lg border border-edge bg-surface-muted p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold uppercase text-ink-accent">Ingredient {index + 1}</p>
                      <button type="button" onClick={() => removeArrayItem('ingredientsSection', 'cards', index)} className="text-[12px] font-semibold uppercase text-red-600">Remove</button>
                    </div>
                    <InputField label="Title" value={item.title} onChange={(value) => updateArrayItem('ingredientsSection', 'cards', index, 'title', value)} />
                    <TextAreaField label="Benefit" value={item.benefit} onChange={(value) => updateArrayItem('ingredientsSection', 'cards', index, 'benefit', value)} rows={2} />
                  </div>
                ))}
              </div>
            </ArrayCard>
          </div>
        );
      case 'conversionSection':
        return (
          <div className="space-y-4">
            <ToggleField checked={settings.conversionSection.enabled !== false} onChange={(value) => updateSectionField('conversionSection', 'enabled', value)} label="Show conversion block" description="Display the confidence-building conversion section on the homepage." />
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField label="Kicker" value={settings.conversionSection.kicker} onChange={(value) => updateSectionField('conversionSection', 'kicker', value)} />
              <InputField label="Headline" value={settings.conversionSection.title} onChange={(value) => updateSectionField('conversionSection', 'title', value)} />
            </div>
            <TextAreaField label="Description" value={settings.conversionSection.description} onChange={(value) => updateSectionField('conversionSection', 'description', value)} />
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField label="Primary CTA label" value={settings.conversionSection.primaryCtaLabel} onChange={(value) => updateSectionField('conversionSection', 'primaryCtaLabel', value)} />
              <InputField label="Primary CTA URL" value={settings.conversionSection.primaryCtaUrl} onChange={(value) => updateSectionField('conversionSection', 'primaryCtaUrl', value)} />
              <InputField label="Secondary CTA label" value={settings.conversionSection.secondaryCtaLabel} onChange={(value) => updateSectionField('conversionSection', 'secondaryCtaLabel', value)} />
              <InputField label="Secondary CTA URL" value={settings.conversionSection.secondaryCtaUrl} onChange={(value) => updateSectionField('conversionSection', 'secondaryCtaUrl', value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField label="Proof label" value={settings.conversionSection.proofLabel} onChange={(value) => updateSectionField('conversionSection', 'proofLabel', value)} />
              <InputField label="Quote title" value={settings.conversionSection.quoteTitle} onChange={(value) => updateSectionField('conversionSection', 'quoteTitle', value)} />
            </div>
            <TextAreaField label="Quote body" value={settings.conversionSection.quoteBody} onChange={(value) => updateSectionField('conversionSection', 'quoteBody', value)} rows={2} />
            <InputField label="Proof summary" value={settings.conversionSection.proofSummary} onChange={(value) => updateSectionField('conversionSection', 'proofSummary', value)} />
            <ArrayCard title="Trust badges" subtitle="Manage the smaller reassurance badges in this block." onAdd={() => addArrayItem('conversionSection', 'badges', { title: 'New badge', icon: 'ShieldCheck' })}>
              <div className="space-y-3">
                {settings.conversionSection.badges.map((item, index) => (
                  <div key={`${item.title}-${index}`} className="rounded-lg border border-edge bg-surface-muted p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold uppercase text-ink-accent">Badge {index + 1}</p>
                      <button type="button" onClick={() => removeArrayItem('conversionSection', 'badges', index)} className="text-[12px] font-semibold uppercase text-red-600">Remove</button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <InputField label="Title" value={item.title} onChange={(value) => updateArrayItem('conversionSection', 'badges', index, 'title', value)} />
                      <InputField label="Icon name" value={item.icon} onChange={(value) => updateArrayItem('conversionSection', 'badges', index, 'icon', value)} />
                    </div>
                  </div>
                ))}
              </div>
            </ArrayCard>
            <ArrayCard title="Proof highlights" subtitle="Manage the smaller stat-style proof blocks." onAdd={() => addArrayItem('conversionSection', 'proofHighlights', { value: 'New', label: 'Short label' })}>
              <div className="space-y-3">
                {settings.conversionSection.proofHighlights.map((item, index) => (
                  <div key={`${item.value}-${index}`} className="rounded-lg border border-edge bg-surface-muted p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold uppercase text-ink-accent">Highlight {index + 1}</p>
                      <button type="button" onClick={() => removeArrayItem('conversionSection', 'proofHighlights', index)} className="text-[12px] font-semibold uppercase text-red-600">Remove</button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <InputField label="Value" value={item.value} onChange={(value) => updateArrayItem('conversionSection', 'proofHighlights', index, 'value', value)} />
                      <InputField label="Label" value={item.label} onChange={(value) => updateArrayItem('conversionSection', 'proofHighlights', index, 'label', value)} />
                    </div>
                  </div>
                ))}
              </div>
            </ArrayCard>
          </div>
        );
      case 'faqSection':
        return (
          <div className="space-y-4">
            <ToggleField checked={settings.faqSection.enabled !== false} onChange={(value) => updateSectionField('faqSection', 'enabled', value)} label="Show FAQ section" description="Display the FAQ accordion on the homepage." />
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField label="Kicker" value={settings.faqSection.kicker} onChange={(value) => updateSectionField('faqSection', 'kicker', value)} />
              <InputField label="Headline" value={settings.faqSection.title} onChange={(value) => updateSectionField('faqSection', 'title', value)} />
            </div>
            <TextAreaField label="Description" value={settings.faqSection.description} onChange={(value) => updateSectionField('faqSection', 'description', value)} rows={2} />
            <ArrayCard title="FAQ items" subtitle="Manage the questions and answers shown on the homepage." onAdd={() => addArrayItem('faqSection', 'items', { question: 'New question?', answer: 'Add a helpful answer.' })}>
              <div className="space-y-3">
                {settings.faqSection.items.map((item, index) => (
                  <div key={`${item.question}-${index}`} className="rounded-lg border border-edge bg-surface-muted p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold uppercase text-ink-accent">FAQ {index + 1}</p>
                      <button type="button" onClick={() => removeArrayItem('faqSection', 'items', index)} className="text-[12px] font-semibold uppercase text-red-600">Remove</button>
                    </div>
                    <InputField label="Question" value={item.question} onChange={(value) => updateArrayItem('faqSection', 'items', index, 'question', value)} />
                    <TextAreaField label="Answer" value={item.answer} onChange={(value) => updateArrayItem('faqSection', 'items', index, 'answer', value)} rows={3} />
                  </div>
                ))}
              </div>
            </ArrayCard>
          </div>
        );
      case 'educationSection':
        return (
          <div className="space-y-4">
            <ToggleField checked={settings.educationSection.enabled !== false} onChange={(value) => updateSectionField('educationSection', 'enabled', value)} label="Show education section" description="Display the learning and blog section on the homepage." />
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField label="Kicker" value={settings.educationSection.kicker} onChange={(value) => updateSectionField('educationSection', 'kicker', value)} />
              <InputField label="Headline" value={settings.educationSection.title} onChange={(value) => updateSectionField('educationSection', 'title', value)} />
            </div>
            <TextAreaField label="Description" value={settings.educationSection.description} onChange={(value) => updateSectionField('educationSection', 'description', value)} rows={2} />
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField label="CTA label" value={settings.educationSection.ctaLabel} onChange={(value) => updateSectionField('educationSection', 'ctaLabel', value)} />
              <InputField label="CTA URL" value={settings.educationSection.ctaUrl} onChange={(value) => updateSectionField('educationSection', 'ctaUrl', value)} />
              <InputField label="Article link label" value={settings.educationSection.readLabel} onChange={(value) => updateSectionField('educationSection', 'readLabel', value)} />
            </div>
            <ArrayCard title="Fallback articles" subtitle="These cards are shown when no published blog articles are available." onAdd={() => addArrayItem('educationSection', 'fallbackEntries', { title: 'New article', author: 'Sclero Proteins', description: 'Add a short article summary.' })}>
              <div className="space-y-3">
                {settings.educationSection.fallbackEntries.map((item, index) => (
                  <div key={`${item.title}-${index}`} className="rounded-lg border border-edge bg-surface-muted p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-semibold uppercase text-ink-accent">Article {index + 1}</p>
                      <button type="button" onClick={() => removeArrayItem('educationSection', 'fallbackEntries', index)} className="text-[12px] font-semibold uppercase text-red-600">Remove</button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <InputField label="Title" value={item.title} onChange={(value) => updateArrayItem('educationSection', 'fallbackEntries', index, 'title', value)} />
                      <InputField label="Author" value={item.author} onChange={(value) => updateArrayItem('educationSection', 'fallbackEntries', index, 'author', value)} />
                    </div>
                    <TextAreaField label="Description" value={item.description} onChange={(value) => updateArrayItem('educationSection', 'fallbackEntries', index, 'description', value)} rows={2} />
                  </div>
                ))}
              </div>
            </ArrayCard>
          </div>
        );
      case 'inquirySection':
        return (
          <div className="space-y-4">
            <ToggleField checked={settings.inquirySection.enabled !== false} onChange={(value) => updateSectionField('inquirySection', 'enabled', value)} label="Show inquiry section" description="Display the contact and support call-to-action at the bottom of the homepage." />
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField label="Kicker" value={settings.inquirySection.kicker} onChange={(value) => updateSectionField('inquirySection', 'kicker', value)} />
              <InputField label="Headline" value={settings.inquirySection.title} onChange={(value) => updateSectionField('inquirySection', 'title', value)} />
            </div>
            <TextAreaField label="Description" value={settings.inquirySection.description} onChange={(value) => updateSectionField('inquirySection', 'description', value)} rows={2} />
            <div className="grid gap-4 sm:grid-cols-2">
              <InputField label="Button label" value={settings.inquirySection.buttonLabel} onChange={(value) => updateSectionField('inquirySection', 'buttonLabel', value)} />
              <InputField label="Success message" value={settings.inquirySection.successMessage} onChange={(value) => updateSectionField('inquirySection', 'successMessage', value)} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <InputField label="Name placeholder" value={settings.inquirySection.namePlaceholder} onChange={(value) => updateSectionField('inquirySection', 'namePlaceholder', value)} />
              <InputField label="Email placeholder" value={settings.inquirySection.emailPlaceholder} onChange={(value) => updateSectionField('inquirySection', 'emailPlaceholder', value)} />
              <InputField label="Message placeholder" value={settings.inquirySection.messagePlaceholder} onChange={(value) => updateSectionField('inquirySection', 'messagePlaceholder', value)} />
              <InputField label="Sending label" value={settings.inquirySection.sendingLabel} onChange={(value) => updateSectionField('inquirySection', 'sendingLabel', value)} />
              <InputField label="WhatsApp tooltip" value={settings.inquirySection.whatsappLabel} onChange={(value) => updateSectionField('inquirySection', 'whatsappLabel', value)} />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-5 text-sm">
      <div className="rounded-lg border border-edge bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-edge-subtle pb-3">
          <div>
            <h3 className="text-sm font-semibold uppercase text-ink-primary">Homepage Content Manager</h3>
            <p className="mt-1 text-brand-muted">
              Show, hide, and edit each homepage section from one clean screen.
            </p>
            <p className="mt-2 text-brand-muted">
              Hero banners remain editable under <span className="font-semibold text-ink-primary">Pages &amp; Banners → Banners</span>.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetDefaults}
              className="rounded-sm border border-edge px-4 py-2 font-semibold uppercase text-ink-primary"
            >
              Reset to default
            </button>
            <button
              type="button"
              onClick={saveHomepageSettings}
              disabled={saving}
              className="btn-primary px-4 py-2 font-semibold uppercase"
            >
              {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Homepage'}
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700">
            {error}
          </p>
        )}

        <div className="mt-4 grid gap-4 xl:grid-cols-[0.28fr_0.72fr]">
          <div className="space-y-3">
            <div className="rounded-lg border border-edge bg-surface-muted p-4">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-accent">Homepage sections</p>
              <div className="mt-3 space-y-2">
                {SECTION_OPTIONS.map((section) => {
                  const isActive = activeSection === section.key;
                  const isToggleSection = section.key !== 'seo';
                  const isEnabled = isToggleSection ? settings[section.key]?.enabled !== false : true;
                  return (
                    <button
                      key={section.key}
                      type="button"
                      onClick={() => setActiveSection(section.key)}
                      className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition ${
                        isActive ? 'border-ink-primary bg-white shadow-card' : 'border-edge bg-white/70 hover:bg-white'
                      }`}
                    >
                      <span className="font-semibold text-ink-primary">{section.label}</span>
                      {isToggleSection ? (
                        <span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold uppercase ${isEnabled ? 'bg-brand-success/10 text-ink-success' : 'bg-slate-100 text-slate-500'}`}>
                          {isEnabled ? 'Shown' : 'Hidden'}
                        </span>
                      ) : (
                        <span className="rounded-full bg-surface px-2 py-0.5 text-[12px] font-semibold uppercase text-ink-accent">SEO</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-lg border border-edge bg-surface-muted p-4">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-ink-accent">Quick notes</p>
              <ul className="mt-3 space-y-2 text-[13px] leading-[1.7] text-ink-secondary">
                <li>Turn any homepage section on or off instantly.</li>
                <li>Add, edit, or remove repeatable cards, tabs, rows, and FAQs.</li>
                <li>Update text, links, labels, and image URLs without code changes.</li>
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-lg border border-edge bg-white p-5">
              <div className="border-b border-edge-subtle pb-3">
                <h4 className="text-sm font-semibold text-ink-primary">{SECTION_OPTIONS.find((section) => section.key === activeSection)?.label}</h4>
                <p className="mt-1 text-[13px] text-brand-muted">Edit this section using simple fields and repeatable content blocks.</p>
              </div>
              <div className="mt-4">
                {renderSectionEditor()}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function PushNotificationsTab({ authFetch }) {
  const [campaigns, setCampaigns] = useState([]);
  const [configured, setConfigured] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ title: '', body: '', target_url: '/', scheduled_for: '' });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      authFetch('/api/admin/push-campaigns/').then((response) => response.ok ? response.json() : Promise.reject(new Error('Unable to load push campaigns.'))),
      fetch(getApiUrl('/api/push/config/'), { credentials: 'include' }).then((response) => response.ok ? response.json() : { enabled: false }),
    ]).then(([campaignData, configData]) => {
      setCampaigns(Array.isArray(campaignData) ? campaignData : campaignData.results || []);
      setConfigured(Boolean(configData.enabled));
      setError('');
    }).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const queueCampaign = async (event) => {
    event.preventDefault();
    const title = form.title.trim();
    const body = form.body.trim();
    const targetUrl = form.target_url.trim() || '/';
    if (!title || !body) return setError('Enter both a title and message.');
    if (!targetUrl.startsWith('/') || targetUrl.startsWith('//')) return setError('Use a same-site link such as /products.');
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await authFetch('/api/admin/push-campaigns/', {
        method: 'POST',
        body: JSON.stringify({
          title,
          body,
          target_url: targetUrl,
          scheduled_for: form.scheduled_for ? new Date(form.scheduled_for).toISOString() : null,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = data.detail || Object.values(data).flat().find(Boolean);
        throw new Error(typeof detail === 'string' ? detail : 'Unable to queue the notification.');
      }
      setForm({ title: '', body: '', target_url: '/', scheduled_for: '' });
      setSuccess('Push notification queued. The production scheduler will deliver it automatically.');
      load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const cancelCampaign = async (campaign) => {
    const response = await authFetch(`/api/admin/push-campaigns/${campaign.id}/cancel/`, { method: 'POST', body: '{}' });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.detail || 'Unable to cancel the campaign.');
      return;
    }
    load();
  };

  return (
    <div className="space-y-5">
      <div className={`rounded-lg border p-4 ${configured ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <div className="flex items-start gap-3">
          <Bell className="mt-0.5 h-5 w-5" />
          <div>
            <p className="font-semibold">Browser push service: {configured === null ? 'Checking…' : configured ? 'Ready' : 'Not configured'}</p>
            <p className="mt-1 text-sm text-ink-secondary">Customers opt in from the storefront footer. Campaigns are queued here and delivered with retries by the scheduler.</p>
          </div>
        </div>
      </div>

      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {success && <p className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{success}</p>}

      <form onSubmit={queueCampaign} className="rounded-lg border border-edge bg-white p-5 shadow-card space-y-4">
        <div>
          <h3 className="text-base font-semibold text-ink-primary">Create push notification</h3>
          <p className="mt-1 text-sm text-brand-muted">Send immediately or choose a future delivery time.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">Title
            <input maxLength={80} required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="mt-1 w-full rounded border border-edge p-2.5 font-normal" />
          </label>
          <label className="text-sm font-semibold">Storefront link
            <input maxLength={500} required value={form.target_url} onChange={(event) => setForm({ ...form, target_url: event.target.value })} placeholder="/products" className="mt-1 w-full rounded border border-edge p-2.5 font-normal" />
          </label>
        </div>
        <label className="block text-sm font-semibold">Message
          <textarea maxLength={240} required rows={3} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} className="mt-1 w-full rounded border border-edge p-2.5 font-normal" />
          <span className="mt-1 block text-xs font-normal text-brand-muted">{form.body.length}/240 characters</span>
        </label>
        <label className="block max-w-sm text-sm font-semibold">Schedule (optional)
          <input type="datetime-local" value={form.scheduled_for} onChange={(event) => setForm({ ...form, scheduled_for: event.target.value })} className="mt-1 w-full rounded border border-edge p-2.5 font-normal" />
        </label>
        <button type="submit" disabled={saving || configured === false} className="btn-primary px-5 py-2.5 text-sm uppercase">
          {saving ? 'Queueing…' : 'Queue notification'}
        </button>
      </form>

      <div className="rounded-lg border border-edge bg-white shadow-card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-edge bg-surface-muted text-xs uppercase text-ink-muted"><tr><th className="p-3">Campaign</th><th className="p-3">Status</th><th className="p-3">Schedule</th><th className="p-3">Delivery</th><th className="p-3">Action</th></tr></thead>
          <tbody>
            {campaigns.map((campaign) => (
              <tr key={campaign.id} className="border-b border-edge-subtle">
                <td className="p-3"><p className="font-semibold">{campaign.title}</p><p className="mt-1 max-w-md text-xs text-brand-muted">{campaign.body}</p></td>
                <td className="p-3 font-semibold">{campaign.status}</td>
                <td className="p-3">{formatDateTime(campaign.scheduled_for || campaign.created_at)}</td>
                <td className="p-3">{campaign.sent_count}/{campaign.total_recipients} sent{campaign.failed_count ? ` · ${campaign.failed_count} failed` : ''}</td>
                <td className="p-3">{['QUEUED', 'PROCESSING'].includes(campaign.status) && <button type="button" onClick={() => cancelCampaign(campaign)} className="text-xs font-semibold text-red-700">Cancel</button>}</td>
              </tr>
            ))}
            {!loading && campaigns.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-brand-muted">No push campaigns yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Scheduled Jobs */
function ScheduledJobsTab({ authFetch }) {
  const [summary, setSummary] = useState(null);
  const [recentRuns, setRecentRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([
      authFetch('/api/admin/cron-runs/summary/').then((r) => (r.ok ? r.json() : null)),
      authFetch('/api/admin/cron-runs/?status=FAILED').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([summaryData, failedData]) => {
        if (!summaryData) throw new Error('load-failed');
        setSummary(summaryData);
        const failures = Array.isArray(failedData) ? failedData : failedData?.results || [];
        setRecentRuns(failures.slice(0, 15));
      })
      .catch(() => setError('Could not load scheduled job history.'))
      .finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="text-sm text-brand-muted">Loading scheduled jobs...</p>;
  if (error) return <div className="rounded bg-brand-danger/10 p-2.5 text-sm text-brand-danger font-semibold">{error}</div>;

  const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString() : '—');
  const runBadge = (status) => ({
    SUCCESS: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    FAILED: 'bg-rose-50 text-rose-700 border border-rose-200',
    RUNNING: 'bg-blue-50 text-blue-700 border border-blue-200',
  }[status] || 'bg-surface-muted text-ink-muted');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${summary.scheduler_alive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
            <Activity className="h-3.5 w-3.5" />
            Scheduler {summary.scheduler_alive ? 'running' : 'NOT RUNNING'}
          </span>
          {!summary.scheduler_alive && (
            <span className="text-xs text-brand-danger font-semibold">
              No active scheduler lease — background jobs are not being executed.
              In production the &quot;scheduler&quot; container runs this automatically; if it shows here, restart that container.
              For local development start it with: <code className="rounded bg-surface-muted px-1 py-0.5 font-mono">python manage.py run_scheduler</code>
            </span>
          )}
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 rounded-sm border border-edge px-3 py-1.5 text-sm font-semibold text-ink-secondary hover:text-ink-primary">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="overflow-x-auto rounded-md border border-edge bg-white shadow-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-edge bg-surface-muted text-left text-xs font-semibold uppercase tracking-wide text-ink-muted">
              <th className="px-4 py-2.5">Job</th>
              <th className="px-4 py-2.5">Last run</th>
              <th className="px-4 py-2.5">Result</th>
              <th className="px-4 py-2.5">Processed / Failed</th>
              <th className="px-4 py-2.5">Duration</th>
              <th className="px-4 py-2.5">Failures (24h)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge-subtle">
            {summary.jobs.map((job) => {
              const latest = job.latest_run;
              return (
                <tr key={job.job_name} className={job.failures_24h > 0 ? 'bg-rose-50/40' : ''}>
                  <td className="px-4 py-2.5 font-mono text-xs text-ink-primary">{job.job_name}</td>
                  <td className="px-4 py-2.5 text-ink-secondary">{latest ? fmtTime(latest.started_at) : 'never ran'}</td>
                  <td className="px-4 py-2.5">
                    {latest ? (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${runBadge(latest.status)}`}>{latest.status}</span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800 border border-amber-200">no history</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-ink-secondary">{latest ? `${latest.processed} / ${latest.failed}` : '—'}</td>
                  <td className="px-4 py-2.5 text-ink-secondary">{latest?.duration_ms != null ? `${latest.duration_ms} ms` : '—'}</td>
                  <td className={`px-4 py-2.5 font-semibold ${job.failures_24h > 0 ? 'text-brand-danger' : 'text-ink-secondary'}`}>{job.failures_24h}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Recent failed runs</p>
        {recentRuns.length === 0 && <p className="text-sm text-brand-muted">No failed runs recorded. All clear.</p>}
        {recentRuns.map((run) => (
          <div key={run.id} className="rounded-md border border-edge bg-white p-3 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-xs font-semibold text-ink-primary">{run.job_name}</p>
              <p className="text-xs text-ink-muted">{fmtTime(run.started_at)}</p>
            </div>
            {(run.error || run.message) && (
              <p className="mt-1 break-words text-xs text-brand-danger">{run.error || run.message}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsTab({ authFetch, regions, initialTab = 'general' }) {
  const allowedTabs = ['general', 'homepage', 'markets', 'payments', 'shipping', 'discounts', 'emails', 'notifications', 'cookie-consent', 'automation'];
  const [subTab, setSubTab] = useState(allowedTabs.includes(initialTab) ? initialTab : 'general');

  useEffect(() => {
    if (allowedTabs.includes(initialTab)) setSubTab(initialTab);
  }, [initialTab]);

  const SUB_TABS = [
    { key: 'general', label: 'General' },
    { key: 'homepage', label: 'Homepage' },
    { key: 'markets', label: 'Markets' },
    { key: 'payments', label: 'Payments' },
    { key: 'shipping', label: 'Shipping' },
    { key: 'discounts', label: 'Discounts' },
    { key: 'emails', label: 'Emails' },
    { key: 'notifications', label: 'Push notifications' },
    { key: 'cookie-consent', label: 'Cookie Consent' },
    { key: 'automation', label: 'Scheduled Jobs' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-edge-subtle pb-2">
        {SUB_TABS.map((t) => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            className={`px-3 py-1.5 text-sm font-semibold uppercase rounded-lg transition-colors ${subTab === t.key ? 'bg-ink-primary text-white' : 'text-ink-primary hover:bg-surface-muted'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {subTab === 'general' && <GeneralSettingsTab authFetch={authFetch} />}
        {subTab === 'homepage' && <HomepageSettingsTab authFetch={authFetch} />}
        {subTab === 'markets' && <MarketsPanel authFetch={authFetch} />}
        {subTab === 'discounts' && <DiscountsTab authFetch={authFetch} regions={regions} />}
        {subTab === 'payments' && <PaymentsTab authFetch={authFetch} regions={regions} />}
        {subTab === 'emails' && <EmailsTab authFetch={authFetch} regions={regions} />}
        {subTab === 'notifications' && <PushNotificationsTab authFetch={authFetch} />}
        {subTab === 'shipping' && <ShippingTab authFetch={authFetch} regions={regions} />}
        {subTab === 'cookie-consent' && <CookieConsentTab authFetch={authFetch} />}
        {subTab === 'automation' && <ScheduledJobsTab authFetch={authFetch} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Customer Reviews Moderation */
function ReviewsTab({ authFetch }) {
  const [reviews, setReviews] = useState([]);
  const [replies, setReplies] = useState({});
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  
  // State for Admin CRUD operations
  const [editReview, setEditReview] = useState(null);
  const [reviewEditorOpen, setReviewEditorOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      authFetch('/api/admin/reviews/').then((r) => r.json()).catch(() => []),
      authFetch('/api/admin/settings/REVIEW_REPLIES/')
        .then((r) => r.ok ? r.json().then(d => d.value) : {})
        .catch(() => ({})),
      authFetch('/api/admin/products/')
        .then((r) => r.ok ? r.json() : [])
        .catch(() => []),
    ]).then(([revList, replyData, prodList]) => {
      setReviews(Array.isArray(revList) ? revList : revList.results || []);
      setReplies(replyData || {});
      setProducts(Array.isArray(prodList) ? prodList : prodList.results || []);
    }).finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const approve = (id) => {
    authFetch(`/api/admin/reviews/${id}/approve/`, { method: 'POST' }).then(() => load());
  };

  const reject = (id) => {
    authFetch(`/api/admin/reviews/${id}/reject/`, { method: 'POST' }).then(() => load());
  };

  const toggleFeature = (id) => {
    authFetch(`/api/admin/reviews/${id}/toggle_feature/`, { method: 'POST' }).then(() => load());
  };

  const deleteReview = (id) => {
    if (confirm("Are you sure you want to permanently delete this customer review?")) {
      authFetch(`/api/admin/reviews/${id}/`, { method: 'DELETE' }).then(() => load());
    }
  };

  const saveReply = () => {
    if (!replyText.trim()) return;
    const newReplies = { ...replies, [replyingTo]: replyText };
    authFetch('/api/admin/settings/REVIEW_REPLIES/', {
      method: 'PUT',
      body: JSON.stringify({ key: 'REVIEW_REPLIES', value: newReplies })
    })
      .then((r) => {
        if (r.status === 404) {
          return authFetch('/api/admin/settings/', {
            method: 'POST',
            body: JSON.stringify({ key: 'REVIEW_REPLIES', value: newReplies, description: 'Staff replies to reviews' })
          });
        }
        return r;
      })
      .then(() => {
        setReplyText('');
        setReplyingTo(null);
        load();
      });
  };

  const handleSaveReview = () => {
    if (!editReview.product || !editReview.user_name.trim() || !editReview.user_email.trim() || !editReview.comment.trim()) {
      alert("Please fill in all required fields.");
      return;
    }
    const isEdit = !!editReview.id;
    const url = isEdit ? `/api/admin/reviews/${editReview.id}/` : `/api/admin/reviews/`;
    const method = isEdit ? 'PUT' : 'POST';

    authFetch(url, {
      method,
      body: JSON.stringify(editReview)
    })
      .then(async (r) => {
        if (r.ok) {
          setReviewEditorOpen(false);
          setEditReview(null);
          load();
        } else {
          const err = await r.json().catch(() => ({}));
          alert("Failed to save review: " + (JSON.stringify(err) || r.statusText));
        }
      });
  };

  if (loading) return <p className="text-sm text-brand-muted">Loading reviews moderation panel...</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-md border border-edge">
        <p className="text-sm text-brand-muted">{reviews.length} total customer reviews pending or moderated</p>
        <button onClick={() => {
          setEditReview({ product: '', user_name: '', user_email: '', rating: 5, comment: '', is_verified_purchase: false, is_approved: true, is_featured: false, review_media_urls: [] });
          setReviewEditorOpen(true);
        }} className="btn-primary py-1.5 px-3 rounded-sm text-sm font-semibold uppercase flex items-center gap-1">
          <Plus className="h-3.5 w-3.5" /> Add Review
        </button>
      </div>

      <div className="space-y-3">
        {reviews.map((rev) => (
          <div key={rev.id} className="rounded-lg border border-edge bg-white p-5 space-y-3 hover:shadow-elevated transition-shadow">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-surface-muted flex items-center justify-center font-semibold text-ink-accent">
                  {rev.user_name?.substring(0, 2).toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-primary">{rev.user_name} <span className="text-sm font-mono text-ink-subtle">({rev.user_email})</span></p>
                  <p className="text-[13px] text-ink-subtle">on <span className="font-semibold text-ink-accent">{toDisplayText(rev.product_name || rev.product_sku || rev.product) || 'Unknown product'}</span> · {formatDateTime(rev.created_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => toggleFeature(rev.id)} className={`p-1.5 rounded-sm border ${rev.is_featured ? 'bg-amber-50 border-amber-200 text-amber-500' : 'border-edge text-ink-subtle hover:bg-surface-muted'}`} title="Feature Review">
                  <Star className="h-4 w-4 fill-current" />
                </button>
                <span className={`text-[12px] font-semibold px-2 py-0.5 rounded-xs ${rev.is_approved ? 'bg-brand-success/10 text-ink-success' : 'bg-red-50 text-ink-danger'}`}>
                  {rev.is_approved ? 'APPROVED' : 'PENDING MODERATION'}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-4 w-4 ${i < rev.rating ? 'text-amber-400 fill-amber-400' : 'text-edge-strong'}`} />
                ))}
                {rev.is_verified_purchase && (
                  <span className="ml-2 bg-brand-success/10 text-ink-success border border-brand-success/30 rounded px-1.5 py-0.2 text-[13px] font-semibold flex items-center gap-0.5">
                    Verified Buyer
                  </span>
                )}
              </div>
              <p className="text-sm text-ink-primary leading-relaxed italic">"{rev.comment}"</p>
            </div>

            {replies[rev.id] && (
              <div className="p-3.5 bg-surface-muted border border-edge-strong rounded-md space-y-1">
                <p className="text-[12px] font-semibold text-ink-accent uppercase">SCLERO STAFF RESPONSE</p>
                <p className="text-sm text-ink-secondary leading-relaxed font-semibold">"{replies[rev.id]}"</p>
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-edge-subtle justify-end items-center">
              <button onClick={() => { setEditReview({ ...rev }); setReviewEditorOpen(true); }} className="px-2.5 py-1 text-[12px] border border-edge hover:bg-surface-muted text-ink-primary rounded-sm uppercase font-semibold flex items-center gap-0.5"><Pencil className="h-2.5 w-2.5" /> Edit</button>
              <button onClick={() => deleteReview(rev.id)} className="px-2.5 py-1 text-[12px] border border-red-200 hover:bg-red-50 text-red-600 rounded-sm uppercase font-semibold flex items-center gap-0.5"><Trash2 className="h-2.5 w-2.5" /> Delete</button>
              <div className="flex-1" />
              {!rev.is_approved ? (
                <button onClick={() => approve(rev.id)} className="px-3 py-1.5 text-[12px] bg-ink-success hover:bg-ink-success/90 text-white rounded-sm uppercase font-semibold">Approve</button>
              ) : (
                <button onClick={() => reject(rev.id)} className="px-3 py-1.5 text-[12px] bg-surface-muted hover:bg-edge text-ink-secondary rounded-sm uppercase font-semibold">Reject / Hide</button>
              )}
              <button onClick={() => setReplyingTo(rev.id)} className="px-3 py-1.5 text-[12px] border border-ink-primary text-ink-accent hover:bg-surface-muted rounded-sm uppercase font-semibold">Respond</button>
            </div>
          </div>
        ))}

        {reviews.length === 0 && (
          <p className="text-center py-10 text-sm text-brand-muted bg-white border border-edge rounded-lg">No customer reviews found to moderate.</p>
        )}
      </div>

      {replyingTo && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-surface-muted overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
          <div className="w-full max-w-md bg-white rounded-lg border border-edge p-6 shadow-card space-y-4">
            <h3 className="text-lg font-semibold text-ink-primary">Write Staff Response</h3>
            <p className="text-sm text-brand-muted">This response will be visible on the public product page below the customer's comment.</p>
            <textarea
              rows={4}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write your public reply..."
              className="w-full rounded-lg border border-edge p-2.5 text-sm font-semibold text-ink-primary"
            />
            <div className="flex gap-2">
              <button onClick={saveReply} className="btn-primary flex-1 py-2.5 text-sm uppercase font-semibold">Save Response</button>
              <button onClick={() => { setReplyingTo(null); setReplyText(''); }} className="flex-1 rounded-sm border border-edge py-2.5 text-sm font-semibold uppercase">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ADD/EDIT REVIEW MODAL */}
      {reviewEditorOpen && editReview && (
        <div className="admin-action-page flex flex-col items-center">
          <div className="w-full max-w-md bg-white rounded-lg border border-edge p-6 shadow-overlay space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-edge-subtle pb-3">
              <h3 className="text-md font-semibold text-ink-primary">
                {editReview.id ? 'Edit Product Review' : 'Add New Review'}
              </h3>
              <button onClick={() => setReviewEditorOpen(false)} className="text-brand-muted hover:text-ink-primary">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-3.5 text-sm">
              <div>
                <label className="font-semibold text-ink-primary block mb-1">Product *</label>
                <select
                  value={editReview.product}
                  onChange={(e) => setEditReview({ ...editReview, product: e.target.value })}
                  className="w-full rounded-sm border border-edge p-2.5 bg-white text-sm font-semibold text-ink-primary"
                  disabled={!!editReview.id}
                  required
                >
                  <option value="">Select Product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-ink-primary block mb-1">Customer Name *</label>
                <input
                  value={editReview.user_name}
                  onChange={(e) => setEditReview({ ...editReview, user_name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="w-full rounded-sm border border-edge p-2.5 font-semibold text-ink-primary"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-ink-primary block mb-1">Customer Email *</label>
                <input
                  type="email"
                  value={editReview.user_email}
                  onChange={(e) => setEditReview({ ...editReview, user_email: e.target.value })}
                  placeholder="e.g. john@example.com"
                  className="w-full rounded-sm border border-edge p-2.5 font-semibold text-ink-primary"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-ink-primary block mb-1">Rating *</label>
                <select
                  value={editReview.rating}
                  onChange={(e) => setEditReview({ ...editReview, rating: parseInt(e.target.value) })}
                  className="w-full rounded-sm border border-edge p-2.5 bg-white font-semibold text-ink-primary"
                  required
                >
                  {[5, 4, 3, 2, 1].map((r) => (
                    <option key={r} value={r}>
                      {r} Stars
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold text-ink-primary block mb-1">Comment *</label>
                <textarea
                  value={editReview.comment}
                  onChange={(e) => setEditReview({ ...editReview, comment: e.target.value })}
                  placeholder="Write customer review comment..."
                  rows={3}
                  className="w-full rounded-sm border border-edge p-2.5 font-semibold text-ink-primary"
                  required
                />
              </div>

              <div className="flex gap-4 pt-1 flex-wrap">
                <label className="flex items-center gap-1.5 font-semibold text-ink-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editReview.is_verified_purchase}
                    onChange={(e) => setEditReview({ ...editReview, is_verified_purchase: e.target.checked })}
                    className="rounded-xs border border-edge text-ink-accent"
                  />
                  Verified Purchase
                </label>
                
                <label className="flex items-center gap-1.5 font-semibold text-ink-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editReview.is_approved}
                    onChange={(e) => setEditReview({ ...editReview, is_approved: e.target.checked })}
                    className="rounded-xs border border-edge text-ink-accent"
                  />
                  Approved (Visible)
                </label>

                <label className="flex items-center gap-1.5 font-semibold text-ink-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editReview.is_featured}
                    onChange={(e) => setEditReview({ ...editReview, is_featured: e.target.checked })}
                    className="rounded-xs border border-edge text-ink-accent"
                  />
                  Featured
                </label>
              </div>
            </div>

            <div className="flex gap-2 justify-end border-t border-edge-subtle pt-3">
              <button
                onClick={() => setReviewEditorOpen(false)}
                className="rounded-sm border border-edge px-4 py-2 text-sm font-semibold uppercase hover:bg-surface-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveReview}
                className="btn-primary rounded-sm px-5 py-2 text-sm font-semibold uppercase"
              >
                Save Review
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- Theme Branding settings */
function ThemeTab({ authFetch }) {
  const [theme, setTheme] = useState({
    primaryColor: '#6d28d9',
    accentColor: '#3b82f6',
    fontName: 'Inter',
    logoUrl: '/logo-mark.png',
    logoWordmarkUrl: '/logo-wordmark.png',
    whatsappNumberIN: '',
    whatsappNumberUK: '',
    emailIN: '',
    emailUK: '',
    phoneIN: '',
    phoneUK: '',
    announcementEnabled: false,
    announcementIN: '',
    announcementUK: '',
    borderRadius: '6px',
    glassmorphism: 'None'
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingWordmark, setUploadingWordmark] = useState(false);

  useEffect(() => {
    authFetch('/api/admin/settings/THEME_BRANDING/')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && d.value) {
          setTheme(prev => ({ ...prev, ...d.value }));
        }
      });
  }, [authFetch]);

  const save = () => {
    setSaving(true);
    setSuccess(false);
    authFetch('/api/admin/settings/THEME_BRANDING/', {
      method: 'PUT',
      body: JSON.stringify({ key: 'THEME_BRANDING', value: theme, description: 'Storefront branding configuration' })
    })
      .then((r) => {
        if (r.status === 404) {
          return authFetch('/api/admin/settings/', {
            method: 'POST',
            body: JSON.stringify({ key: 'THEME_BRANDING', value: theme, description: 'Storefront branding configuration' })
          });
        }
        return r;
      })
      .then(() => {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      })
      .finally(() => setSaving(false));
  };

  const uploadLogo = (file) => {
    if (!file) return;
    setUploadingLogo(true);
    uploadAdminMedia(authFetch, file)
      .then((fileUrl) => setTheme((prev) => ({ ...prev, logoUrl: fileUrl })))
      .catch((err) => alert(err.message || 'Logo upload failed.'))
      .finally(() => setUploadingLogo(false));
  };

  const uploadWordmark = (file) => {
    if (!file) return;
    setUploadingWordmark(true);
    uploadAdminMedia(authFetch, file)
      .then((fileUrl) => setTheme((prev) => ({ ...prev, logoWordmarkUrl: fileUrl })))
      .catch((err) => alert(err.message || 'Wordmark upload failed.'))
      .finally(() => setUploadingWordmark(false));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
      {/* Settings Form */}
      <div className="rounded-lg border border-edge bg-white shadow-card p-5 space-y-4">
        <h3 className="text-base font-semibold text-ink-primary">Theme Settings</h3>
        <p className="text-sm text-brand-muted">Customize your eCommerce store storefront styling in real-time. Changes are applied instantly without deploys.</p>
        
        <div className="space-y-3 text-sm">
          <div>
            <label className="block font-semibold text-ink-primary mb-1">Typography (Body Font)</label>
            <select value={theme.fontName} onChange={(e) => setTheme({ ...theme, fontName: e.target.value })} className="w-full rounded-sm border border-edge p-2 bg-white text-ink-primary">
              <option value="Inter">Inter (Highly Readable)</option>
              <option value="Playfair Display">Playfair Display (Premium Serif)</option>
              <option value="System">System Sans (Default)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-ink-primary mb-1">Border Roundness</label>
            <select value={theme.borderRadius} onChange={(e) => setTheme({ ...theme, borderRadius: e.target.value })} className="w-full rounded-sm border border-edge p-2 bg-white text-ink-primary">
              <option value="0px">Sharp Corners (0px)</option>
              <option value="6px">Subtle Round (6px)</option>
              <option value="24px">Organic Round (24px)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-ink-primary mb-1">Logo Mark Image (Icon)</label>
            <div className="flex gap-2">
              <input type="text" value={theme.logoUrl || ''} onChange={(e) => setTheme({ ...theme, logoUrl: e.target.value })} className="flex-1 rounded-sm border border-edge p-2" />
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-edge px-3 font-semibold text-ink-primary hover:border-ink-primary">
                <Upload className="h-3.5 w-3.5" />
                {uploadingLogo ? 'Uploading' : 'Upload'}
                <input type="file" accept="image/*" onChange={(e) => uploadLogo(e.target.files?.[0])} className="hidden" disabled={uploadingLogo} />
              </label>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-ink-primary mb-1">Logo Wordmark Image</label>
            <div className="flex gap-2">
              <input type="text" value={theme.logoWordmarkUrl || ''} onChange={(e) => setTheme({ ...theme, logoWordmarkUrl: e.target.value })} className="flex-1 rounded-sm border border-edge p-2" />
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-edge px-3 font-semibold text-ink-primary hover:border-ink-primary">
                <Upload className="h-3.5 w-3.5" />
                {uploadingWordmark ? 'Uploading' : 'Upload'}
                <input type="file" accept="image/*" onChange={(e) => uploadWordmark(e.target.files?.[0])} className="hidden" disabled={uploadingWordmark} />
              </label>
            </div>
          </div>

          <div className="border-t border-edge-subtle pt-3 mt-3">
            <h4 className="font-semibold text-ink-primary uppercase tracking-wider mb-2 text-[12px]">Announcement Banner</h4>
            <label className="mb-2 flex items-center gap-2 text-[13px] font-medium text-ink-primary">
              <input type="checkbox" checked={theme.announcementEnabled === true} onChange={(e) => setTheme({ ...theme, announcementEnabled: e.target.checked })} />
              Show announcement on the storefront
            </label>
            <div className="space-y-2">
              <input type="text" value={theme.announcementIN || ''} onChange={(e) => setTheme({ ...theme, announcementIN: e.target.value })} className="w-full rounded-sm border border-edge p-2" placeholder="India announcement text" />
              <input type="text" value={theme.announcementUK || ''} onChange={(e) => setTheme({ ...theme, announcementUK: e.target.value })} className="w-full rounded-sm border border-edge p-2" placeholder="UK announcement text" />
            </div>
            <p className="mt-1 text-[11px] text-brand-muted">Use shipping or discount claims only when they match your active rates and coupons.</p>
          </div>

          <div className="border-t border-edge-subtle pt-3 mt-3">
            <h4 className="font-semibold text-ink-primary uppercase tracking-wider mb-2 text-[12px]">India Store Info & Widgets</h4>
            <div className="space-y-2">
              <div>
                <label className="block text-[13px] font-medium text-brand-muted mb-0.5">Support Email (IN)</label>
                <input type="email" value={theme.emailIN || ''} onChange={(e) => setTheme({ ...theme, emailIN: e.target.value })} className="w-full rounded-sm border border-edge p-2" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-brand-muted mb-0.5">Support Phone (IN)</label>
                <input type="text" value={theme.phoneIN || ''} onChange={(e) => setTheme({ ...theme, phoneIN: e.target.value })} className="w-full rounded-sm border border-edge p-2" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-brand-muted mb-0.5">WhatsApp Widget Number (IN)</label>
                <input type="text" value={theme.whatsappNumberIN || ''} onChange={(e) => setTheme({ ...theme, whatsappNumberIN: e.target.value })} className="w-full rounded-sm border border-edge p-2" placeholder="e.g. 918047100000" />
              </div>
            </div>
          </div>

          <div className="border-t border-edge-subtle pt-3 mt-3">
            <h4 className="font-semibold text-ink-primary uppercase tracking-wider mb-2 text-[12px]">UK Store Info & Widgets</h4>
            <div className="space-y-2">
              <div>
                <label className="block text-[13px] font-medium text-brand-muted mb-0.5">Support Email (UK)</label>
                <input type="email" value={theme.emailUK || ''} onChange={(e) => setTheme({ ...theme, emailUK: e.target.value })} className="w-full rounded-sm border border-edge p-2" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-brand-muted mb-0.5">Support Phone (UK)</label>
                <input type="text" value={theme.phoneUK || ''} onChange={(e) => setTheme({ ...theme, phoneUK: e.target.value })} className="w-full rounded-sm border border-edge p-2" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-brand-muted mb-0.5">WhatsApp Widget Number (UK)</label>
                <input type="text" value={theme.whatsappNumberUK || ''} onChange={(e) => setTheme({ ...theme, whatsappNumberUK: e.target.value })} className="w-full rounded-sm border border-edge p-2" placeholder="e.g. 442045740000" />
              </div>
            </div>
          </div>

        </div>

        {success && <p className="text-sm bg-brand-success/10 text-ink-success border border-brand-success/30 p-2 rounded-lg font-semibold">Theme published to storefront successfully!</p>}
        <button onClick={save} disabled={saving} className="btn-primary w-full py-2.5 uppercase font-semibold text-sm disabled:opacity-50">
          {saving ? 'Publishing...' : 'Save & Publish Theme'}
        </button>
      </div>

      {/* Live Storefront Preview */}
      <div className="rounded-lg border border-edge bg-surface-inverse p-6 flex flex-col justify-start min-h-[500px]">
        <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
          <p className="text-[12px] uppercase font-medium text-white/50 tracking-wider">LIVE STOREFRONT PREVIEW</p>
          <div className="flex gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            <span className="h-2.5 w-2.5 rounded-full bg-brand-accent" />
            <span className="h-2.5 w-2.5 rounded-full bg-brand-success/100" />
          </div>
        </div>

        <div className="flex-1 bg-[#111110] rounded-md border border-white/10 flex flex-col overflow-hidden text-white" style={{ fontFamily: theme.fontName === 'System' ? 'sans-serif' : theme.fontName }}>
          {/* Header */}
          <header className="px-4 py-3 flex items-center justify-between border-b border-white/10 bg-[#111110]">
            <div className="flex items-center gap-1.5">
              <div className="h-5 w-5 rounded-full bg-brand-accent flex items-center justify-center text-[12px] font-semibold text-white" style={{ backgroundColor: theme.primaryColor }}>S</div>
              <span className="text-sm font-semibold tracking-tight text-white">SCLERO PROTEINS</span>
            </div>
            <nav className="flex gap-3 text-[12px] text-white/50 font-medium">
              <span className="hover:text-white cursor-pointer">Shop</span>
              <span className="hover:text-white cursor-pointer">Science</span>
              <span className="hover:text-white cursor-pointer">About</span>
            </nav>
            <ShoppingCart className="h-3.5 w-3.5 text-white/60" />
          </header>

          {/* Hero section */}
          <div className="p-6 text-center space-y-3 relative overflow-hidden bg-surface-inverse">
            <h1 className="text-lg font-semibold text-white leading-tight">Bio-active Protein Nutrition</h1>
            <p className="text-[12px] text-white/50 max-w-sm mx-auto">Cellular-grade targeted protein peptide concentrates engineered to accelerate structural tissue recovery and muscular restoration.</p>
            <button className="px-4 py-2 text-[12px] font-semibold uppercase text-white hover:opacity-90 inline-block transition-opacity" style={{ backgroundColor: theme.primaryColor, borderRadius: theme.borderRadius }}>
              Explore Formulas
            </button>
          </div>

          {/* Product list */}
          <div className="p-4 grid grid-cols-2 gap-3 bg-[#111110]">
            {[{ name: 'Sclero Isolate 90', price: '£59.99' }, { name: 'Joint Repair Peptide', price: '£72.50' }].map((prod, idx) => (
              <div key={idx} className="p-3 border border-white/10 bg-white/5 relative" style={{ borderRadius: theme.borderRadius, backdropFilter: theme.glassmorphism === 'None' ? 'none' : 'blur(8px)' }}>
                <div className="h-20 bg-white/10 rounded-sm flex items-center justify-center text-[12px] font-medium text-white/40 mb-2">IMAGE</div>
                <h4 className="text-[13px] font-semibold text-white">{prod.name}</h4>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[12px] font-medium text-white/50">{prod.price}</span>
                  <span className="text-[13px] font-semibold uppercase text-amber-500" style={{ color: theme.accentColor }}>★ 4.9</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- GDPR Cookie consent */
function CookieConsentTab({ authFetch }) {
  const [config, setConfig] = useState({
    title: 'Cookie Consent',
    description: 'We use cookies to optimize site features, personalize regulatory settings, and analyze site metrics.',
    acceptText: 'Accept All',
    declineText: 'Customize / Decline',
    layout: 'Floating Card',
    cookiePolicyUrl: '/policies/privacy',
    activeRegions: ['UK', 'IN']
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    authFetch('/api/admin/settings/COOKIE_CONSENT_SETTINGS/')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && d.value) setConfig(d.value);
      });
  }, [authFetch]);

  const save = () => {
    setSaving(true);
    setSuccess(false);
    authFetch('/api/admin/settings/COOKIE_CONSENT_SETTINGS/', {
      method: 'PUT',
      body: JSON.stringify({ key: 'COOKIE_CONSENT_SETTINGS', value: config, description: 'Cookie consent banner configuration' })
    })
      .then((r) => {
        if (r.status === 404) {
          return authFetch('/api/admin/settings/', {
            method: 'POST',
            body: JSON.stringify({ key: 'COOKIE_CONSENT_SETTINGS', value: config, description: 'Cookie consent banner configuration' })
          });
        }
        return r;
      })
      .then(() => {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      })
      .finally(() => setSaving(false));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
      <div className="rounded-lg border border-edge bg-white shadow-card p-5 space-y-4">
        <h3 className="text-base font-semibold text-ink-primary">GDPR & Cookie Banner Settings</h3>
        <p className="text-sm text-brand-muted">Manage the user privacy consent banners and cookie consent opt-in policies for different storefront regions.</p>
        
        <div className="space-y-3 text-sm">
          <div>
            <label className="block font-semibold text-ink-primary mb-1">Banner Title</label>
            <input type="text" value={config.title} onChange={(e) => setConfig({ ...config, title: e.target.value })} className="w-full rounded-sm border border-edge p-2" />
          </div>

          <div>
            <label className="block font-semibold text-ink-primary mb-1">Description message</label>
            <textarea rows={3} value={config.description} onChange={(e) => setConfig({ ...config, description: e.target.value })} className="w-full rounded-sm border border-edge p-2" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-semibold text-ink-primary mb-1">Accept Button Label</label>
              <input type="text" value={config.acceptText} onChange={(e) => setConfig({ ...config, acceptText: e.target.value })} className="w-full rounded-sm border border-edge p-2" />
            </div>
            <div>
              <label className="block font-semibold text-ink-primary mb-1">Decline Button Label</label>
              <input type="text" value={config.declineText} onChange={(e) => setConfig({ ...config, declineText: e.target.value })} className="w-full rounded-sm border border-edge p-2" />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-ink-primary mb-1">Layout Style</label>
            <select value={config.layout} onChange={(e) => setConfig({ ...config, layout: e.target.value })} className="w-full rounded-sm border border-edge p-2">
              <option value="Bottom Bar">Bottom Bar (Full-width banner)</option>
              <option value="Floating Card">Floating Card (Bottom-left/right)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-ink-primary mb-1">Cookie Policy Link</label>
            <input type="text" value={config.cookiePolicyUrl} onChange={(e) => setConfig({ ...config, cookiePolicyUrl: e.target.value })} className="w-full rounded-sm border border-edge p-2" />
          </div>
        </div>

        {success && <p className="text-sm bg-brand-success/10 text-ink-success border border-brand-success/30 p-2 rounded-lg font-semibold">Cookie consent banner updated successfully!</p>}
        <button onClick={save} disabled={saving} className="btn-primary w-full py-2.5 uppercase font-semibold text-sm disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      {/* Visual Banner Preview Panel */}
      <div className="rounded-lg border border-edge bg-surface-muted p-6 flex flex-col justify-between relative min-h-[400px]">
        <div>
          <p className="kicker mb-2">BANNER VISUAL LAYOUT PREVIEW</p>
          <div className="bg-white rounded-md border border-edge p-6 text-center text-sm text-brand-muted italic">
            [ Storefront Mock Screen Container ]
          </div>
        </div>

        {/* Banner rendered matching layout */}
        {config.layout === 'Bottom Bar' ? (
          <div className="w-full bg-surface-inverse border border-white/10 text-white p-4 rounded-md flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div className="space-y-1 max-w-xl text-left">
              <p className="text-sm font-semibold text-white">{config.title}</p>
              <p className="text-[12px] text-white/70 leading-normal">{config.description}</p>
            </div>
            <div className="flex gap-2 whitespace-nowrap self-end md:self-auto">
              <button className="px-3 py-1.5 text-[13px] font-semibold border border-white/20 hover:bg-white/10 text-white/70 rounded-sm">{config.declineText}</button>
              <button className="px-3 py-1.5 text-[13px] font-semibold bg-white text-ink-primary rounded-sm">{config.acceptText}</button>
            </div>
          </div>
        ) : (
          <div className="w-72 bg-surface-inverse border border-white/10 text-white p-4 rounded-lg shadow-overlay space-y-2.5 text-left self-end md:mr-4">
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white flex items-center gap-1.5"><Cookie className="h-4 w-4 text-amber-500 fill-amber-500" /> {config.title}</p>
              <p className="text-[12px] text-white/70 leading-relaxed">{config.description}</p>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 py-1.5 text-[13px] font-semibold border border-white/20 hover:bg-white/10 text-white/70 rounded-sm">{config.declineText}</button>
              <button className="flex-1 py-1.5 text-[13px] font-semibold bg-white text-ink-primary rounded-sm">{config.acceptText}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Header & Footer Builders */
/* Defaults mirror the live storefront exactly (Navbar.jsx fallbackNavLinks and
   Footer.jsx link columns), so the editor always starts from what visitors
   actually see instead of placeholder links to pages that do not exist. */
const DEFAULT_HEADER_LINKS = [
  { label: 'Shop', url: '/products', mega_menu: true },
  { label: 'Our Story', url: '/about' },
  { label: 'Learn', url: '/knowledge-hub' },
  { label: 'Insights', url: '/blog' },
  { label: 'Contact', url: '/contact' },
];

const DEFAULT_FOOTER_LINKS = {
  shop: [
    { label: 'Shop all products', url: '/products' },
    { label: 'Wholesale and bulk', url: '/bulk' },
    { label: 'Track your order', url: '/account' },
  ],
  support: [
    { label: 'Contact us', url: '/contact' },
    { label: 'FAQs', url: '/faq' },
    { label: 'Glossary', url: '/glossary' },
    { label: 'Shipping and delivery', url: '/policies/shipping' },
    { label: 'Returns and refunds', url: '/policies/refund' },
  ],
  legal: [
    { label: 'Privacy policy', url: '/policies/privacy' },
    { label: 'Terms of service', url: '/policies/terms' },
    { label: 'Cookie policy', url: '/policies/cookie' },
    { label: 'Accessibility', url: '/policies/accessibility' },
  ],
};

// Only the columns the storefront footer actually renders.
const FOOTER_COLUMNS = ['shop', 'support', 'legal'];

function NavigationTab({ authFetch, regions }) {
  const [headerLinks, setHeaderLinks] = useState([]);
  const [footerLinks, setFooterLinks] = useState({ shop: [], support: [], legal: [] });
  const [editingItem, setEditingItem] = useState(null); // { type: 'header'|'footer', column?: string, index: number, item: object }
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('header');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      authFetch('/api/admin/settings/NAVIGATION_MENUS/').then(r => r.ok ? r.json() : null).catch(() => null),
      authFetch('/api/admin/settings/FOOTER_SETTINGS/').then(r => r.ok ? r.json() : null).catch(() => null)
    ]).then(([headerData, footerData]) => {
      const rawHeader = headerData?.value;
      setHeaderLinks(Array.isArray(rawHeader) && rawHeader.length ? rawHeader : DEFAULT_HEADER_LINKS);

      const rawFooter = footerData?.value;
      const footerVal = (rawFooter && typeof rawFooter === 'object' && !Array.isArray(rawFooter)) ? rawFooter : {};
      setFooterLinks({
        shop: Array.isArray(footerVal.shop) && footerVal.shop.length ? footerVal.shop : DEFAULT_FOOTER_LINKS.shop,
        support: Array.isArray(footerVal.support) && footerVal.support.length ? footerVal.support : DEFAULT_FOOTER_LINKS.support,
        legal: Array.isArray(footerVal.legal) && footerVal.legal.length ? footerVal.legal : DEFAULT_FOOTER_LINKS.legal,
      });
    }).finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const save = (newHeader, newFooter) => {
    setNotice('');
    setError('');
    Promise.all([
      authFetch('/api/admin/settings/NAVIGATION_MENUS/', {
        method: 'PUT',
        body: JSON.stringify({ key: 'NAVIGATION_MENUS', value: newHeader || headerLinks, description: 'Storefront main header menu links' })
      }),
      authFetch('/api/admin/settings/FOOTER_SETTINGS/', {
        method: 'PUT',
        body: JSON.stringify({ key: 'FOOTER_SETTINGS', value: newFooter || footerLinks, description: 'Storefront footer columns and social links' })
      })
    ]).then(([headerRes, footerRes]) => {
      if (!headerRes.ok || !footerRes.ok) throw new Error('The server rejected the change.');
      setNotice('Menus saved. The storefront header and footer update immediately.');
      load();
    }).catch((e) => {
      setError(e.message || 'Could not save the menus. Please try again.');
      load();
    });
  };

  const deleteHeaderItem = (idx) => {
    const copy = headerLinks.filter((_, i) => i !== idx);
    setHeaderLinks(copy);
    save(copy, null);
  };

  const deleteFooterItem = (column, idx) => {
    const copy = { ...footerLinks, [column]: footerLinks[column].filter((_, i) => i !== idx) };
    setFooterLinks(copy);
    save(null, copy);
  };

  const moveHeader = (idx, direction) => {
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= headerLinks.length) return;
    const copy = [...headerLinks];
    const temp = copy[idx];
    copy[idx] = copy[nextIdx];
    copy[nextIdx] = temp;
    setHeaderLinks(copy);
    save(copy, null);
  };

  const moveFooter = (column, idx, direction) => {
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= footerLinks[column].length) return;
    const copyList = [...footerLinks[column]];
    const temp = copyList[idx];
    copyList[idx] = copyList[nextIdx];
    copyList[nextIdx] = temp;
    const nextFooter = { ...footerLinks, [column]: copyList };
    setFooterLinks(nextFooter);
    save(null, nextFooter);
  };

  const openEdit = (type, column, idx, item) => {
    setEditingItem({
      type,
      column,
      index: idx,
      item: item
        ? {
            ...item,
            label: toDisplayText(item.label),
            url: toDisplayText(item.url),
            region_limit: toDisplayText(item.region_limit),
          }
        : { label: '', url: '', mega_menu: false, region_limit: '' }
    });
  };

  const saveEdit = () => {
    if (editingItem.type === 'header') {
      let copy = [...headerLinks];
      if (editingItem.index === -1) {
        copy.push(editingItem.item);
      } else {
        copy[editingItem.index] = editingItem.item;
      }
      setHeaderLinks(copy);
      save(copy, null);
    } else {
      const col = editingItem.column;
      let copyCol = [...footerLinks[col]];
      if (editingItem.index === -1) {
        copyCol.push(editingItem.item);
      } else {
        copyCol[editingItem.index] = editingItem.item;
      }
      const nextFooter = { ...footerLinks, [col]: copyCol };
      setFooterLinks(nextFooter);
      save(null, nextFooter);
    }
    setEditingItem(null);
  };

  if (loading) return <p className="text-sm text-brand-muted">Loading menus editor...</p>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-edge-subtle pb-2">
        <button onClick={() => setActiveSubTab('header')} className={`px-4 py-1.5 text-sm font-semibold uppercase rounded-sm ${activeSubTab === 'header' ? 'bg-ink-primary text-white' : 'text-ink-primary hover:bg-surface-muted'}`}>Header Menus</button>
        <button onClick={() => setActiveSubTab('footer')} className={`px-4 py-1.5 text-sm font-semibold uppercase rounded-sm ${activeSubTab === 'footer' ? 'bg-ink-primary text-white' : 'text-ink-primary hover:bg-surface-muted'}`}>Footer Columns</button>
      </div>

      {notice && <p className="rounded-lg border border-brand-success/30 bg-brand-success/10 px-3 py-2 text-sm font-semibold text-ink-success">{notice}</p>}
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-ink-danger">{error}</p>}

      {activeSubTab === 'header' ? (
        <div className="bg-white rounded-lg border border-edge p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-semibold text-ink-primary">Header Navigation Links</h4>
            <button onClick={() => openEdit('header', null, -1, null)} className="px-3 py-1.5 text-sm uppercase bg-ink-primary text-white rounded-sm font-semibold inline-flex items-center gap-1"><Plus className="h-3 w-3" /> Add Link</button>
          </div>

          <div className="divide-y divide-edge-subtle border border-edge-subtle rounded-md bg-surface-muted p-2 space-y-1">
            {headerLinks.map((link, idx) => (
              <div key={idx} className="flex justify-between items-center py-2 px-3 bg-white rounded-lg border border-edge-subtle shadow-card">
                <div>
                  <p className="text-sm font-semibold text-ink-primary">{toDisplayText(link.label)} <span className="font-mono text-[12px] text-brand-muted ml-1">{toDisplayText(link.url)}</span></p>
                  {link.mega_menu && <span className="rounded bg-surface-muted text-ink-accent px-1.5 py-0.2 text-[8px] font-semibold">MEGA MENU</span>}
                  {link.region_limit && <span className="rounded bg-amber-50 text-ink-accent ml-1 px-1.5 py-0.2 text-[8px] font-semibold uppercase">Region: {link.region_limit}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => moveHeader(idx, -1)} disabled={idx === 0} className="text-ink-subtle hover:text-ink-primary disabled:opacity-30">▲</button>
                  <button onClick={() => moveHeader(idx, 1)} disabled={idx === headerLinks.length - 1} className="text-ink-subtle hover:text-ink-primary disabled:opacity-30">▼</button>
                  <button onClick={() => openEdit('header', null, idx, link)} className="text-ink-accent hover:opacity-75"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => deleteHeaderItem(idx)} className="text-brand-muted hover:text-brand-danger"><X className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {FOOTER_COLUMNS.map((col) => (
            <div key={col} className="bg-white rounded-lg border border-edge p-4 space-y-3">
              <div className="flex justify-between items-center border-b border-edge-subtle pb-2">
                <h4 className="text-sm font-semibold uppercase text-ink-primary">{col}</h4>
                <button onClick={() => openEdit('footer', col, -1, null)} className="text-ink-accent font-semibold text-[12px] uppercase">Add</button>
              </div>

              <div className="space-y-1.5 min-h-[150px]">
                {footerLinks[col]?.map((link, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 rounded-lg border border-edge-subtle bg-surface-muted text-[13px] font-semibold text-ink-primary">
                    <span className="truncate max-w-[140px]">{toDisplayText(link.label)}</span>
                    <div className="flex gap-1.5">
                      <button onClick={() => moveFooter(col, idx, -1)} disabled={idx === 0} className="text-[13px] text-ink-subtle">▲</button>
                      <button onClick={() => moveFooter(col, idx, 1)} disabled={idx === footerLinks[col].length - 1} className="text-[13px] text-ink-subtle">▼</button>
                      <button onClick={() => openEdit('footer', col, idx, link)} className="text-ink-accent"><Pencil className="h-3 w-3" /></button>
                      <button onClick={() => deleteFooterItem(col, idx)} className="text-brand-danger"><X className="h-3 w-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {editingItem && (
        <div className="admin-action-page flex flex-col items-center">
          <div className="my-10 w-full max-w-md bg-white rounded-lg border border-edge p-6 shadow-overlay space-y-4">
            <h3 className="text-lg font-semibold text-ink-primary">{editingItem.index === -1 ? 'Add Link' : 'Edit Link'}</h3>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block font-semibold text-ink-primary mb-1">Link Text / Label</label>
                <input type="text" value={toDisplayText(editingItem.item.label)} onChange={(e) => setEditingItem({ ...editingItem, item: { ...editingItem.item, label: e.target.value } })} className="w-full rounded-sm border border-edge p-2" />
              </div>
              <div>
                <label className="block font-semibold text-ink-primary mb-1">Destination URL / Path</label>
                <input type="text" value={toDisplayText(editingItem.item.url)} onChange={(e) => setEditingItem({ ...editingItem, item: { ...editingItem.item, url: e.target.value } })} className="w-full rounded-sm border border-edge p-2" />
              </div>
              {editingItem.type === 'header' && (
                <div className="space-y-2 pt-2 border-t border-edge-subtle">
                  <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-ink-primary"><input type="checkbox" checked={editingItem.item.mega_menu || false} onChange={(e) => setEditingItem({ ...editingItem, item: { ...editingItem.item, mega_menu: e.target.checked } })} className="accent-ink-primary" /> Enable Mega Menu (Dropdown Block)</label>
                  <div>
                    <label className="block font-semibold text-ink-subtle mb-1">Limit to Region (leave blank for Global)</label>
                    <select value={editingItem.item.region_limit || ''} onChange={(e) => setEditingItem({ ...editingItem, item: { ...editingItem.item, region_limit: e.target.value } })} className="w-full rounded-sm border border-edge p-1.5">
                      <option value="">Global / All regions</option>
                      {(Array.isArray(regions) && regions.length ? regions : [{ code: 'UK', name: 'United Kingdom' }, { code: 'IN', name: 'India' }]).map((r) => (
                        <option key={r.code} value={r.code}>{r.name} ({r.code})</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-3">
                <button onClick={saveEdit} className="btn-primary flex-1 py-2.5 text-sm uppercase font-semibold">Save Link</button>
                <button onClick={() => setEditingItem(null)} className="flex-1 rounded-sm border border-edge py-2.5 text-sm font-semibold uppercase">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- Media Library */
/* ---------------------------------------------------------- Hero Banners */
const blankHeroBanner = () => ({
  title: '',
  eyebrow: '',
  heading: '',
  subheading: '',
  desktop_media_url: '',
  tablet_media_url: '',
  mobile_media_url: '',
  media_type: 'IMAGE',
  alt_text: '',
  primary_cta_label: '',
  primary_cta_url: '',
  secondary_cta_label: '',
  secondary_cta_url: '',
  text_position: 'LEFT',
  overlay_color_start: '',
  overlay_color_mid: '',
  overlay_color_end: '',
  eyebrow_color: '',
  heading_color: '',
  subheading_color: '',
  primary_cta_bg_color: '',
  primary_cta_text_color: '',
  secondary_cta_bg_color: '',
  secondary_cta_text_color: '',
  accent_color: '',
  // Scheduling / ordering / carousel timing are no longer editable — the save
  // payload forces safe values so a banner is always live.
  sort_order: 0,
  seo_title: '',
  seo_description: '',
});

/* Pages + Banners merged surface per spec 2026-06-24; policy pages added as a
   second sub-tab so every legal/info page is editable from the console. */
function PagesAndBannersTab({ authFetch, initialTab = 'banners' }) {
  const allowedTabs = ['banners'];
  const [subTab, setSubTab] = useState(allowedTabs.includes(initialTab) ? initialTab : 'banners');

  useEffect(() => {
    if (allowedTabs.includes(initialTab)) setSubTab(initialTab);
  }, [initialTab]);

  const SUB_TABS = [
    { key: 'banners', label: 'Banners' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-edge-subtle pb-2">
        {SUB_TABS.map((t) => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            className={`px-3 py-1.5 text-sm font-semibold uppercase rounded-lg transition-colors ${subTab === t.key ? 'bg-ink-primary text-white' : 'text-ink-primary hover:bg-surface-muted'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {subTab === 'banners' && <HeroBannersTab authFetch={authFetch} />}
      </div>
    </div>
  );
}

function StorePagesTab({ authFetch }) {
  const [pages, setPages] = useState([]);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(() => {
    authFetch('/api/admin/content-pages/')
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((d) => setPages((Array.isArray(d) ? d : d.results || []).filter((p) => !p.slug.startsWith(POLICY_SLUG_PREFIX))))
      .catch(() => setPages([]));
  }, [authFetch]);
  useEffect(() => { load(); }, [load]);
  const startNew = () => setEditing({ title: '', slug: '', content: '', page_type: 'STANDARD', is_published: false, meta_title: '', meta_description: '' });
  const save = async () => {
    const title = editing?.title?.trim();
    const slug = slugify(editing?.slug || title);
    if (!title || !slug) { setError('A title and URL slug are required.'); return; }
    if (slug.startsWith(POLICY_SLUG_PREFIX)) { setError('Policy pages must be managed in the Policy Pages tab.'); return; }
    setError('');
    const response = await authFetch(editing.id ? `/api/admin/content-pages/${editing.id}/` : '/api/admin/content-pages/', {
      method: editing.id ? 'PATCH' : 'POST',
      body: JSON.stringify({ ...editing, title, slug }),
    });
    if (!response.ok) { setError('Could not save this page. The URL slug may already be in use.'); return; }
    setEditing(null); load();
  };
  const remove = async (page) => {
    if (!confirm(`Delete “${page.title}”? This cannot be undone.`)) return;
    await authFetch(`/api/admin/content-pages/${page.id}/`, { method: 'DELETE' }); load();
  };
  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3"><p className="text-sm text-brand-muted">Published pages are available at <span className="font-mono">/pages/your-slug</span>.</p><button onClick={startNew} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm uppercase"><Plus className="h-4 w-4" /> Create page</button></div>
    <div className="space-y-2">{pages.map((page) => <div key={page.id} className="flex items-center justify-between gap-3 rounded-md border border-edge bg-white p-4"><div><p className="font-semibold text-ink-primary">{page.title}</p><p className="text-xs text-brand-muted font-mono">/pages/{page.slug} · {page.is_published ? 'Published' : 'Draft'}</p></div><div className="flex gap-2"><button onClick={() => setEditing({ ...page })} className="rounded border border-edge p-2 text-ink-secondary hover:text-ink-primary" aria-label={`Edit ${page.title}`}><Pencil className="h-4 w-4" /></button><button onClick={() => remove(page)} className="rounded border border-edge p-2 text-brand-danger" aria-label={`Delete ${page.title}`}><Trash2 className="h-4 w-4" /></button></div></div>)}</div>
    {editing && <div className="rounded-lg border border-edge bg-white p-5 shadow-card space-y-3"><h3 className="font-semibold text-ink-primary">{editing.id ? 'Edit page' : 'New page'}</h3>{error && <p className="text-sm text-brand-danger">{error}</p>}<input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Page title" className="w-full rounded border border-edge p-2.5 text-sm" /><input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} placeholder="URL slug (generated from title if blank)" className="w-full rounded border border-edge p-2.5 text-sm" /><textarea value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} placeholder="Page content (Markdown supported)" rows={10} className="w-full rounded border border-edge p-2.5 text-sm" /><div className="grid gap-2 sm:grid-cols-2"><input value={editing.meta_title || ''} onChange={(e) => setEditing({ ...editing, meta_title: e.target.value })} placeholder="SEO title" className="rounded border border-edge p-2.5 text-sm" /><input value={editing.meta_description || ''} onChange={(e) => setEditing({ ...editing, meta_description: e.target.value })} placeholder="SEO description" className="rounded border border-edge p-2.5 text-sm" /></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(editing.is_published)} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} /> Publish page</label><div className="flex gap-2"><button onClick={save} className="btn-primary px-4 py-2 text-sm uppercase">Save page</button><button onClick={() => setEditing(null)} className="rounded border border-edge px-4 py-2 text-sm">Cancel</button></div></div>}
  </div>;
}

/* ------------------------------------------------------------- Policy Pages */
const POLICY_SLUG_PREFIX = 'policy-';
const POLICY_ICON_OPTIONS = [
  { value: 'shield', label: 'Shield (privacy)' },
  { value: 'file-text', label: 'Document (terms)' },
  { value: 'truck', label: 'Truck (shipping)' },
  { value: 'refresh-cw', label: 'Refresh (refunds)' },
  { value: 'eye', label: 'Eye (cookies)' },
  { value: 'heart-pulse', label: 'Heart (accessibility / story)' },
  { value: 'send', label: 'Send (contact)' },
  { value: 'bookmark', label: 'Bookmark' },
];

function PolicyPagesTab({ authFetch }) {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    authFetch(`/api/admin/content-pages/?q=${POLICY_SLUG_PREFIX}`)
      .then((r) => r.json())
      .then((d) => {
        const rows = (Array.isArray(d) ? d : d.results || []).filter(
          (p) => typeof p.slug === 'string' && p.slug.startsWith(POLICY_SLUG_PREFIX)
        );
        setPages(rows);
      })
      .catch(() => setError('Could not load policy pages.'))
      .finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const startEdit = (page) => {
    const layout = page.template_layout && typeof page.template_layout === 'object' ? page.template_layout : {};
    setError('');
    setNotice('');
    setEditing({
      id: page.id,
      slug: page.slug,
      title: page.title || '',
      meta_title: page.meta_title || '',
      meta_description: page.meta_description || '',
      is_published: Boolean(page.is_published),
      icon: layout.icon || 'file-text',
      last_updated_label: layout.last_updated_label || '',
      is_contact_form: Boolean(layout.is_contact_form),
      sections: Array.isArray(layout.sections) && layout.sections.length
        ? layout.sections.map((s) => ({ heading: s?.heading || '', text: s?.text || '' }))
        : [{ heading: '', text: '' }],
    });
  };

  const updateSection = (index, field, value) => {
    setEditing((prev) => ({
      ...prev,
      sections: prev.sections.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    }));
  };

  const moveSection = (index, delta) => {
    setEditing((prev) => {
      const next = [...prev.sections];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, sections: next };
    });
  };

  const addSection = () => {
    setEditing((prev) => ({ ...prev, sections: [...prev.sections, { heading: '', text: '' }] }));
  };

  const removeSection = (index) => {
    setEditing((prev) => ({
      ...prev,
      sections: prev.sections.length > 1 ? prev.sections.filter((_, i) => i !== index) : prev.sections,
    }));
  };

  const save = () => {
    if (!editing) return;
    const sections = editing.sections
      .map((s) => ({ heading: s.heading.trim(), text: s.text.trim() }))
      .filter((s) => s.heading || s.text);
    if (!editing.title.trim()) { setError('Title is required.'); return; }
    if (!sections.length) { setError('At least one section with content is required.'); return; }

    setSaving(true);
    setError('');
    authFetch(`/api/admin/content-pages/${editing.id}/`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: editing.title.trim(),
        meta_title: editing.meta_title.trim(),
        meta_description: editing.meta_description.trim(),
        is_published: editing.is_published,
        template_layout: {
          kind: 'policy',
          icon: editing.icon,
          last_updated_label: editing.last_updated_label.trim(),
          is_contact_form: editing.is_contact_form,
          sections,
        },
      }),
    })
      .then((r) => {
        if (!r.ok) throw new Error('save-failed');
        return r.json();
      })
      .then(() => {
        setEditing(null);
        setNotice('Policy page saved. The storefront picks up edits within 5 minutes.');
        load();
      })
      .catch(() => setError('Could not save the policy page. Please try again.'))
      .finally(() => setSaving(false));
  };

  if (loading) return <p className="text-sm text-brand-muted">Loading policy pages...</p>;

  return (
    <div className="space-y-4">
      {notice && <div className="rounded bg-brand-success/10 p-2.5 text-sm text-ink-success font-semibold">{notice}</div>}
      {error && !editing && <div className="rounded bg-brand-danger/10 p-2.5 text-sm text-brand-danger font-semibold">{error}</div>}

      <div className="flex items-center justify-between">
        <p className="text-sm text-brand-muted">
          {pages.length} policy page{pages.length === 1 ? '' : 's'} — Privacy, Terms, Refunds and other
          legal pages shown at <span className="font-mono">/policies/…</span> on the storefront.
        </p>
      </div>

      {pages.length === 0 && (
        <div className="rounded-md border border-edge bg-surface-muted p-4 text-sm text-ink-secondary">
          No policy pages found. Seed them once with
          <span className="mx-1 rounded bg-white px-1.5 py-0.5 font-mono text-xs border border-edge">python manage.py seed_policy_pages</span>
          on the backend, then reload this tab.
        </div>
      )}

      <div className="space-y-3">
        {pages.map((page) => (
          <div key={page.id} className="flex justify-between items-center rounded-md border border-edge bg-white shadow-card p-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold text-ink-primary">{page.title}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${page.is_published ? 'bg-brand-success/10 text-ink-success' : 'bg-surface-muted text-ink-muted'}`}>
                  {page.is_published ? 'Published' : 'Hidden'}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-brand-muted font-mono">/policies/{page.slug.slice(POLICY_SLUG_PREFIX.length)}</p>
            </div>
            <button onClick={() => startEdit(page)} aria-label={`Edit ${page.title}`} className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-edge text-ink-secondary hover:text-ink-primary hover:border-edge-strong">
              <Pencil className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-surface-muted overflow-y-auto p-4 md:p-8">
          <div className="mx-auto max-w-3xl bg-white rounded-lg border border-edge p-6 shadow-card space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-heading-3">Edit {editing.title || 'policy page'}</h3>
              <button onClick={() => setEditing(null)} aria-label="Close editor" className="text-ink-muted hover:text-ink-primary"><X className="h-5 w-5" /></button>
            </div>
            {error && <div className="rounded bg-brand-danger/10 p-2.5 text-sm text-brand-danger font-semibold">{error}</div>}

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-muted">Page title</label>
                <input value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full rounded-sm border border-edge p-2.5 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-muted">Header icon</label>
                <select value={editing.icon} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} className="w-full rounded-sm border border-edge p-2.5 text-sm">
                  {POLICY_ICON_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-muted">"Last updated" label</label>
                <input value={editing.last_updated_label} onChange={(e) => setEditing({ ...editing, last_updated_label: e.target.value })} placeholder="e.g. July 22, 2026" className="w-full rounded-sm border border-edge p-2.5 text-sm" />
                <p className="mt-1 text-[11px] text-ink-muted">Leave blank to show the date of the latest save.</p>
              </div>
              <div className="flex items-end gap-6 pb-1">
                <label className="flex items-center gap-2 text-sm text-ink-primary">
                  <input type="checkbox" checked={editing.is_published} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} className="accent-ink-primary" />
                  Published
                </label>
                <label className="flex items-center gap-2 text-sm text-ink-primary">
                  <input type="checkbox" checked={editing.is_contact_form} onChange={(e) => setEditing({ ...editing, is_contact_form: e.target.checked })} className="accent-ink-primary" />
                  Show contact form
                </label>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Sections</p>
                <button onClick={addSection} className="inline-flex items-center gap-1 text-sm font-semibold text-ink-accent hover:underline">
                  <Plus className="h-4 w-4" /> Add section
                </button>
              </div>
              {editing.sections.map((sec, i) => (
                <div key={i} className="rounded-md border border-edge-subtle bg-surface-muted p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={sec.heading}
                      onChange={(e) => updateSection(i, 'heading', e.target.value)}
                      placeholder="Section heading"
                      className="flex-1 rounded-sm border border-edge p-2 text-sm font-semibold"
                    />
                    <button onClick={() => moveSection(i, -1)} disabled={i === 0} aria-label="Move section up" className="h-8 w-8 rounded-sm border border-edge text-ink-secondary disabled:opacity-30">↑</button>
                    <button onClick={() => moveSection(i, 1)} disabled={i === editing.sections.length - 1} aria-label="Move section down" className="h-8 w-8 rounded-sm border border-edge text-ink-secondary disabled:opacity-30">↓</button>
                    <button onClick={() => removeSection(i)} disabled={editing.sections.length === 1} aria-label="Remove section" className="h-8 w-8 rounded-sm border border-edge text-brand-danger disabled:opacity-30"><X className="mx-auto h-4 w-4" /></button>
                  </div>
                  <textarea
                    value={sec.text}
                    onChange={(e) => updateSection(i, 'text', e.target.value)}
                    rows={4}
                    placeholder="Section text"
                    className="w-full rounded-sm border border-edge p-2.5 text-sm leading-relaxed"
                  />
                </div>
              ))}
            </div>

            <div className="p-3 bg-surface-muted rounded-md border border-edge-subtle space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">SEO</p>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-muted">Meta title</label>
                <input value={editing.meta_title} onChange={(e) => setEditing({ ...editing, meta_title: e.target.value })} className="w-full rounded-sm border border-edge p-2.5 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-muted">Meta description</label>
                <textarea value={editing.meta_description} onChange={(e) => setEditing({ ...editing, meta_description: e.target.value })} rows={2} className="w-full rounded-sm border border-edge p-2.5 text-sm" />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-edge-subtle pt-4">
              <button onClick={() => setEditing(null)} className="rounded-sm border border-edge px-4 py-2 text-sm font-semibold text-ink-secondary">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm uppercase disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save page
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HeroBannersTab({ authFetch }) {
  const [slides, setSlides] = useState([]);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [uploadingMediaKey, setUploadingMediaKey] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    authFetch('/api/admin/hero-banners/')
      .then((r) => r.json())
      .then((d) => setSlides(Array.isArray(d) ? d : d.results || []))
      .catch(() => setError('Could not load hero banner slides.'))
      .finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const startNew = () => {
    setError('');
    setNotice('');
    setEditing(blankHeroBanner());
  };

  const startEdit = (slide) => {
    setError('');
    setNotice('');
    setEditing({ ...slide });
  };

  const setField = (key, value) => setEditing((prev) => ({ ...prev, [key]: value }));

  const uploadHeroMedia = (field, file) => {
    if (!file) return;
    setUploadingMediaKey(field);
    uploadAdminMedia(authFetch, file)
      .then((fileUrl) => setField(field, fileUrl))
      .catch((err) => setError(err.message || 'Media upload failed.'))
      .finally(() => setUploadingMediaKey(''));
  };

  // Scheduling, ordering and carousel timing were removed from this editor.
  // These values are forced so a banner can never end up hidden by a setting
  // the admin can no longer see: the public feed filters on is_enabled and the
  // start/end window, and legibility is now handled by the storefront's scrim.
  const payload = () => ({
    ...editing,
    is_enabled: true,
    starts_at: null,
    ends_at: null,
    sort_order: Number(editing.sort_order || 0),
    overlay_opacity: 0,
    autoplay_enabled: true,
    show_indicators: true,
    display_duration_ms: 6500,
    transition_ms: 500,
  });

  const save = () => {
    if (!editing?.title.trim() || !editing?.heading.trim()) {
      setError('Internal title and heading are required.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    const isNew = !editing.id;
    authFetch(isNew ? '/api/admin/hero-banners/' : `/api/admin/hero-banners/${editing.id}/`, {
      method: isNew ? 'POST' : 'PUT',
      body: JSON.stringify(payload()),
    })
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(JSON.stringify(d));
        setEditing(null);
        setNotice('Hero banner slide saved.');
        load();
      })
      .catch((e) => setError(e.message || 'Could not save hero banner slide.'))
      .finally(() => setSaving(false));
  };

  const remove = (slide) => {
    if (!window.confirm(`Delete hero banner "${slide.title}"?`)) return;
    authFetch(`/api/admin/hero-banners/${slide.id}/`, { method: 'DELETE' })
      .then(() => {
        setNotice('Hero banner slide deleted.');
        load();
      })
      .catch(() => setError('Could not delete hero banner slide.'));
  };

  if (loading) return <p className="text-sm text-brand-muted">Loading hero banners...</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-brand-muted">Manage homepage campaign slides, scheduling, responsive media, CTAs, and carousel timing.</p>
        </div>
        <button onClick={startNew} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm uppercase">
          <Plus className="h-4 w-4" /> New banner
        </button>
      </div>

      {notice && <p className="rounded-lg border border-brand-success/30 bg-brand-success/10 px-3 py-2 text-sm font-semibold text-ink-success">{notice}</p>}
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-ink-danger">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {slides.map((slide) => (
          <div key={slide.id} className="overflow-hidden rounded-lg border border-edge bg-white">
            <div className="relative h-44 bg-surface-muted">
              {slide.desktop_media_url ? (
                slide.media_type === 'VIDEO' ? (
                  <video src={slide.desktop_media_url} className="h-full w-full object-cover" muted />
                ) : (
                  <img src={slide.desktop_media_url} alt={slide.alt_text || slide.heading} className="h-full w-full object-cover" />
                )
              ) : (
                <div className="flex h-full items-center justify-center text-sm font-semibold uppercase text-ink-subtle">No media</div>
              )}
            </div>
            <div className="space-y-3 p-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-ink-accent">{slide.eyebrow || 'Hero slide'}</p>
                <h3 className="mt-1 text-base font-semibold text-ink-primary">{slide.heading}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-brand-muted">{slide.subheading}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-brand-muted">
                <span>Text {String(slide.text_position || '').toLowerCase()}</span>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => startEdit(slide)} className="rounded-sm border border-edge p-2 text-ink-accent hover:bg-surface-muted" aria-label={`Edit ${slide.title}`}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => remove(slide)} className="rounded-sm border border-red-200 p-2 text-ink-danger hover:bg-red-50" aria-label={`Delete ${slide.title}`}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {slides.length === 0 && (
        <div className="rounded-lg border border-dashed border-edge-strong bg-white p-8 text-center">
          <p className="text-sm font-semibold text-ink-primary">No hero banner slides yet.</p>
          <p className="mt-1 text-sm text-brand-muted">Create the first slide to control the homepage hero from the admin console.</p>
        </div>
      )}

      {editing && (
        <div className="admin-action-page">
          <div className="mx-auto my-6 max-w-5xl overflow-hidden rounded-lg border border-edge bg-white shadow-overlay">
            <div className="flex items-center justify-between border-b border-edge px-5 py-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-widest text-ink-accent">Homepage hero</p>
                <h2 className="text-lg font-semibold text-ink-primary">{editing.id ? 'Edit banner slide' : 'New banner slide'}</h2>
              </div>
              <button onClick={() => setEditing(null)} className="rounded-sm border border-edge p-2 text-brand-muted hover:bg-surface-muted" aria-label="Close hero banner editor">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label className="kicker mb-1 block">Internal title</label>
                  <input value={editing.title} onChange={(e) => setField('title', e.target.value)} className="w-full rounded-sm border border-edge p-2.5 text-sm" placeholder="e.g. Summer joint care campaign" />
                </div>
                <div>
                  <label className="kicker mb-1 block">Eyebrow</label>
                  <input value={editing.eyebrow} onChange={(e) => setField('eyebrow', e.target.value)} className="w-full rounded-sm border border-edge p-2.5 text-sm" placeholder="BJC Bone & Joint Care" />
                </div>
                <div>
                  <label className="kicker mb-1 block">Heading</label>
                  <input value={editing.heading} onChange={(e) => setField('heading', e.target.value)} className="w-full rounded-sm border border-edge p-2.5 text-sm" placeholder="Mobility support, backed by science." />
                </div>
                <div>
                  <label className="kicker mb-1 block">Subheading</label>
                  <textarea rows={3} value={editing.subheading} onChange={(e) => setField('subheading', e.target.value)} className="w-full rounded-sm border border-edge p-2.5 text-sm" placeholder="Short campaign message for the hero." />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="kicker mb-1 block">Primary CTA label</label>
                    <input value={editing.primary_cta_label} onChange={(e) => setField('primary_cta_label', e.target.value)} className="w-full rounded-sm border border-edge p-2.5 text-sm" placeholder="Shop now" />
                  </div>
                  <div>
                    <label className="kicker mb-1 block">Primary CTA URL</label>
                    <input value={editing.primary_cta_url} onChange={(e) => setField('primary_cta_url', e.target.value)} className="w-full rounded-sm border border-edge p-2.5 text-sm" placeholder="/products" />
                  </div>
                  <div>
                    <label className="kicker mb-1 block">Secondary CTA label</label>
                    <input value={editing.secondary_cta_label} onChange={(e) => setField('secondary_cta_label', e.target.value)} className="w-full rounded-sm border border-edge p-2.5 text-sm" placeholder="Learn more" />
                  </div>
                  <div>
                    <label className="kicker mb-1 block">Secondary CTA URL</label>
                    <input value={editing.secondary_cta_url} onChange={(e) => setField('secondary_cta_url', e.target.value)} className="w-full rounded-sm border border-edge p-2.5 text-sm" placeholder="/policies/about" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="kicker mb-1 block">Media type</label>
                    <select value={editing.media_type} onChange={(e) => setField('media_type', e.target.value)} className="w-full rounded-sm border border-edge p-2.5 text-sm">
                      <option value="IMAGE">Image</option>
                      <option value="VIDEO">Video</option>
                    </select>
                  </div>
                  <div>
                    <label className="kicker mb-1 block">Horizontal Text</label>
                    <select value={editing.text_position || 'LEFT'} onChange={(e) => setField('text_position', e.target.value)} className="w-full rounded-sm border border-edge p-2.5 text-sm">
                      <option value="LEFT">Left</option>
                      <option value="CENTER">Center</option>
                      <option value="RIGHT">Right</option>
                    </select>
                  </div>
                  <div>
                    <label className="kicker mb-1 block">Vertical Text</label>
                    <select value={editing.vertical_position || 'BOTTOM'} onChange={(e) => setField('vertical_position', e.target.value)} className="w-full rounded-sm border border-edge p-2.5 text-sm">
                      <option value="TOP">Top</option>
                      <option value="CENTER">Center</option>
                      <option value="BOTTOM">Bottom</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="kicker mb-1 block">Navigation Arrows Position</label>
                  <select value={editing.arrow_position || 'BOTTOM'} onChange={(e) => setField('arrow_position', e.target.value)} className="w-full rounded-sm border border-edge p-2.5 text-sm">
                    <option value="BOTTOM">Bottom Bar</option>
                    <option value="SIDES">Vertically Centered on Both Sides</option>
                    <option value="HIDDEN">Hide Arrows Completely</option>
                  </select>
                </div>
                <div className="rounded-lg border border-edge bg-surface-subtle p-3 text-[13px] leading-[1.6] text-ink-secondary">
                  <p className="font-semibold text-ink-primary">Banner sizes — upload at these dimensions</p>
                  <table className="mt-2 w-full">
                    <thead>
                      <tr className="text-left text-ink-muted">
                        <th className="font-semibold">Slot</th>
                        <th className="font-semibold">Size (px)</th>
                        <th className="font-semibold">Shown when</th>
                      </tr>
                    </thead>
                    <tbody>
                      {BANNER_SPECS.map((s) => (
                        <tr key={s.slot}>
                          <td className="pr-2 font-medium text-ink-primary">{s.slot}</td>
                          <td className="pr-2 tabular-nums">{s.size}</td>
                          <td className="text-ink-muted">{s.when}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-ink-muted">
                    Sizes are 2× for sharpness on retina screens. Keep each file under 400&nbsp;KB (JPG or WebP).
                    The image is cropped to fill, so keep the subject centred — edges may be trimmed.
                    Tablet and mobile are optional; if left empty the desktop image is used everywhere.
                  </p>
                </div>
                <div>
                  <label className="kicker mb-1 block">Desktop image/video URL</label>
                  <p className="mb-1.5 text-[12px] text-ink-muted">Recommended 2560 × 1080 px · shown above 1024 px wide</p>
                  <div className="flex gap-2">
                    <input value={editing.desktop_media_url} onChange={(e) => setField('desktop_media_url', e.target.value)} className="flex-1 rounded-sm border border-edge p-2.5 text-sm" placeholder="https://..." />
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-edge px-3 text-sm font-semibold text-ink-primary hover:border-ink-primary">
                      <Upload className="h-3.5 w-3.5" /> {uploadingMediaKey === 'desktop_media_url' ? 'Uploading' : 'Upload'}
                      <input type="file" accept="image/*,video/*" onChange={(e) => uploadHeroMedia('desktop_media_url', e.target.files?.[0])} className="hidden" />
                    </label>
                  </div>
                </div>
                <div>
                  <label className="kicker mb-1 block">Tablet image URL optional</label>
                  <p className="mb-1.5 text-[12px] text-ink-muted">Recommended 2048 × 960 px · shown 641–1024 px wide · falls back to desktop</p>
                  <div className="flex gap-2">
                    <input value={editing.tablet_media_url} onChange={(e) => setField('tablet_media_url', e.target.value)} className="flex-1 rounded-sm border border-edge p-2.5 text-sm" placeholder="https://..." />
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-edge px-3 text-sm font-semibold text-ink-primary hover:border-ink-primary">
                      <Upload className="h-3.5 w-3.5" /> {uploadingMediaKey === 'tablet_media_url' ? 'Uploading' : 'Upload'}
                      <input type="file" accept="image/*" onChange={(e) => uploadHeroMedia('tablet_media_url', e.target.files?.[0])} className="hidden" />
                    </label>
                  </div>
                </div>
                <div>
                  <label className="kicker mb-1 block">Mobile image URL</label>
                  <p className="mb-1.5 text-[12px] text-ink-muted">Recommended 1280 × 840 px · shown up to 640 px wide · falls back to desktop</p>
                  <div className="flex gap-2">
                    <input value={editing.mobile_media_url} onChange={(e) => setField('mobile_media_url', e.target.value)} className="flex-1 rounded-sm border border-edge p-2.5 text-sm" placeholder="https://..." />
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-edge px-3 text-sm font-semibold text-ink-primary hover:border-ink-primary">
                      <Upload className="h-3.5 w-3.5" /> {uploadingMediaKey === 'mobile_media_url' ? 'Uploading' : 'Upload'}
                      <input type="file" accept="image/*" onChange={(e) => uploadHeroMedia('mobile_media_url', e.target.files?.[0])} className="hidden" />
                    </label>
                  </div>
                </div>
                <div>
                  <label className="kicker mb-1 block">Alt text</label>
                  <input value={editing.alt_text} onChange={(e) => setField('alt_text', e.target.value)} className="w-full rounded-sm border border-edge p-2.5 text-sm" placeholder="Describe the banner media for accessibility and SEO" />
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="kicker mb-1 block">SEO title</label>
                  <input value={editing.seo_title} onChange={(e) => setField('seo_title', e.target.value)} className="w-full rounded-sm border border-edge p-2.5 text-sm" maxLength={160} />
                </div>
                <div>
                  <label className="kicker mb-1 block">SEO description</label>
                  <textarea rows={3} value={editing.seo_description} onChange={(e) => setField('seo_description', e.target.value)} className="w-full rounded-sm border border-edge p-2.5 text-sm" />
                </div>
                <div className="overflow-hidden rounded-md border border-edge bg-surface-muted">
                  <div className="relative h-40">
                    {editing.desktop_media_url ? (
                      editing.media_type === 'VIDEO' ? (
                        <video src={editing.desktop_media_url} className="h-full w-full object-cover" muted />
                      ) : (
                        <img src={editing.desktop_media_url} alt={editing.alt_text || editing.heading || ''} className="h-full w-full object-cover" />
                      )
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm font-semibold uppercase text-ink-subtle">Preview media</div>
                    )}
                    <div
                      className="absolute inset-0"
                      style={{
                        background: `linear-gradient(90deg, ${editing.overlay_color_start || '#090C3A'} 0%, ${editing.overlay_color_mid || '#101871'} 48%, ${editing.overlay_color_end || '#1E083B'} 100%)`,
                        opacity: 0.35,
                      }}
                    />
                    <div className="absolute bottom-4 left-4 right-4 text-white">
                      <p className="text-[12px] font-semibold uppercase tracking-wider text-white/75" style={editing.eyebrow_color ? { color: editing.eyebrow_color } : undefined}>{editing.eyebrow}</p>
                      <p className="text-lg font-semibold leading-tight" style={editing.heading_color ? { color: editing.heading_color } : undefined}>{editing.heading || 'Banner heading preview'}</p>
                      {editing.subheading && (
                        <p className="mt-1 line-clamp-1 text-[12px] text-white/85" style={editing.subheading_color ? { color: editing.subheading_color } : undefined}>{editing.subheading}</p>
                      )}
                      {(editing.primary_cta_label || editing.secondary_cta_label) && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {editing.primary_cta_label && (
                            <span
                              className="rounded-pill px-3 py-1 text-[11px] font-semibold"
                              style={{ background: editing.primary_cta_bg_color || '#F5A227', color: editing.primary_cta_text_color || '#171250' }}
                            >{editing.primary_cta_label}</span>
                          )}
                          {editing.secondary_cta_label && (
                            <span
                              className="rounded-pill border border-white/30 px-3 py-1 text-[11px] font-semibold"
                              style={{ background: editing.secondary_cta_bg_color || 'rgba(255,255,255,0.1)', color: editing.secondary_cta_text_color || '#FFFFFF' }}
                            >{editing.secondary_cta_label}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-edge bg-surface-muted px-5 py-4">
              <button onClick={() => setEditing(null)} className="rounded-sm border border-edge bg-white px-4 py-2 text-sm font-semibold uppercase text-ink-primary">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary px-5 py-2 text-sm uppercase">
                {saving ? 'Saving...' : 'Save banner'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DiscountsTab({ authFetch, regions }) {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    authFetch('/api/admin/coupons/')
      .then((r) => r.json())
      .then((d) => setCoupons(Array.isArray(d) ? d : d.results || []))
      .catch(() => setCoupons([]))
      .finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const startNew = () => setEditing({
    code: '', discount_type: 'PERCENTAGE', value: '', region: null,
    min_spend: '0', start_date: '', end_date: '', is_active: true, usage_limit: '',
  });
  const startEdit = (c) => setEditing({
    ...c,
    start_date: c.start_date ? c.start_date.slice(0, 16) : '',
    end_date: c.end_date ? c.end_date.slice(0, 16) : '',
    usage_limit: c.usage_limit ?? '',
  });

  const save = () => {
    const payload = {
      code: editing.code,
      discount_type: editing.discount_type,
      value: editing.value,
      region: editing.region || null,
      min_spend: editing.min_spend || 0,
      start_date: editing.start_date ? new Date(editing.start_date).toISOString() : null,
      end_date: editing.end_date ? new Date(editing.end_date).toISOString() : null,
      is_active: !!editing.is_active,
      usage_limit: editing.usage_limit === '' ? null : Number(editing.usage_limit),
    };
    const isNew = !editing.id;
    authFetch(isNew ? '/api/admin/coupons/' : `/api/admin/coupons/${editing.id}/`, {
      method: isNew ? 'POST' : 'PUT',
      body: JSON.stringify(payload),
    }).then(() => { setEditing(null); load(); });
  };

  const remove = (c) => {
    if (!confirm(`Delete coupon "${c.code}"?`)) return;
    authFetch(`/api/admin/coupons/${c.id}/`, { method: 'DELETE' }).then(load);
  };

  const toggleActive = (c) => {
    authFetch(`/api/admin/coupons/${c.id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: !c.is_active }),
    }).then(load);
  };

  if (loading) return <p className="text-sm text-brand-muted">Loading discounts…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-brand-muted">{coupons.length} coupon codes</p>
        <button onClick={startNew} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm uppercase">
          <Plus className="h-4 w-4" /> New discount
        </button>
      </div>

      <div className="overflow-x-auto rounded-md border border-edge bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-muted text-[12px] font-medium uppercase tracking-wide text-ink-muted border-b border-edge">
            <tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Value</th><th className="px-3 py-2">Region</th><th className="px-3 py-2">Window</th><th className="px-3 py-2">Usage</th><th className="px-3 py-2">Active</th><th className="px-3 py-2"></th></tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id} className="border-t border-edge-subtle">
                <td className="px-3 py-3 font-mono font-semibold text-ink-primary">{c.code}</td>
                <td className="px-3 py-3 text-brand-muted">{c.discount_type}</td>
                <td className="px-3 py-3 font-semibold text-ink-primary">{c.discount_type === 'PERCENTAGE' ? `${c.value}%` : c.value}</td>
                <td className="px-3 py-3 text-brand-muted">{c.region_code || 'GLOBAL'}</td>
                <td className="px-3 py-3 text-brand-muted">{c.start_date ? formatDate(c.start_date) : '—'} → {c.end_date ? formatDate(c.end_date) : '—'}</td>
                <td className="px-3 py-3 text-ink-primary">{c.usage_count}{c.usage_limit ? ` / ${c.usage_limit}` : ''}</td>
                <td className="px-3 py-3">
                  <button onClick={() => toggleActive(c)} className={`rounded px-2 py-0.5 text-[12px] font-semibold ${c.is_active ? 'bg-brand-success/10 text-ink-success' : 'bg-surface-muted text-ink-muted'}`}>{c.is_active ? 'ON' : 'OFF'}</button>
                </td>
                <td className="px-3 py-3 text-right">
                  <button onClick={() => startEdit(c)} className="text-ink-accent"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(c)} className="ml-2 text-brand-muted hover:text-brand-danger"><X className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {coupons.length === 0 && (<tr><td colSpan={8} className="px-3 py-6 text-center text-brand-muted">No discount codes yet.</td></tr>)}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-surface-muted overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
          <div className="my-8 w-full max-w-lg bg-white rounded-lg border border-edge p-6 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-ink-primary">{editing.id ? 'Edit discount' : 'New discount'}</h3>
              <button onClick={() => setEditing(null)} className="text-brand-muted"><X className="h-5 w-5" /></button>
            </div>
            <input placeholder="CODE" value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} className="w-full rounded-sm border border-edge p-2.5 text-sm font-mono uppercase" />
            <div className="grid grid-cols-2 gap-2 text-sm">
              <select value={editing.discount_type} onChange={(e) => setEditing({ ...editing, discount_type: e.target.value })} className="rounded-sm border border-edge p-2">
                <option value="PERCENTAGE">Percentage off</option>
                <option value="FIXED_AMOUNT">Fixed amount</option>
                <option value="TIERED">Tiered</option>
              </select>
              <input type="number" step="0.01" placeholder="Value" value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} className="rounded-sm border border-edge p-2" />
              <select value={editing.region || ''} onChange={(e) => setEditing({ ...editing, region: e.target.value ? Number(e.target.value) : null })} className="rounded-sm border border-edge p-2">
                <option value="">All regions</option>
                {regions.map((r) => <option key={r.id} value={r.id}>{r.code} — {r.name}</option>)}
              </select>
              <input type="number" step="0.01" placeholder="Min spend" value={editing.min_spend} onChange={(e) => setEditing({ ...editing, min_spend: e.target.value })} className="rounded-sm border border-edge p-2" />
              <input type="datetime-local" value={editing.start_date} onChange={(e) => setEditing({ ...editing, start_date: e.target.value })} className="rounded-sm border border-edge p-2" />
              <input type="datetime-local" value={editing.end_date} onChange={(e) => setEditing({ ...editing, end_date: e.target.value })} className="rounded-sm border border-edge p-2" />
              <input type="number" placeholder="Usage limit (optional)" value={editing.usage_limit} onChange={(e) => setEditing({ ...editing, usage_limit: e.target.value })} className="col-span-2 rounded-sm border border-edge p-2" />
            </div>
            <label className="flex items-center gap-2 text-sm text-ink-primary"><input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} className="accent-ink-primary" /> Active</label>
            <div className="flex gap-2 pt-1">
              <button onClick={save} className="btn-primary flex-1 py-2.5 text-sm uppercase">Save</button>
              <button onClick={() => setEditing(null)} className="flex-1 rounded-sm border border-edge py-2.5 text-sm font-semibold uppercase">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ------------------------------------------------------------------ Page */
// Clean, Shopify-style grouping: plain section names, "Home" first, Settings last.
/* ---------------------------------------- Consolidated section wrappers ----
 * Each of these groups what used to be several sidebar entries into one page
 * with tabs. Same components, fewer destinations to hunt through.
 */
function SectionTabs({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 border-b border-edge-subtle pb-2">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold uppercase transition-colors ${
            active === t.key ? 'bg-ink-primary text-white' : 'text-ink-primary hover:bg-surface-muted'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function OrdersSection({ authFetch, initialTab = 'all' }) {
  const allowedTabs = ['all', 'drafts', 'abandoned'];
  const [tab, setTab] = useState(allowedTabs.includes(initialTab) ? initialTab : 'all');
  useEffect(() => {
    if (allowedTabs.includes(initialTab)) setTab(initialTab);
  }, [initialTab]);
  return (
    <div className="space-y-5">
      <SectionTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'all', label: 'All orders' },
          { key: 'drafts', label: 'Drafts' },
          { key: 'abandoned', label: 'Abandoned checkouts' },
        ]}
      />
      {tab === 'all' && <OrdersTab authFetch={authFetch} />}
      {tab === 'drafts' && <OrdersTab authFetch={authFetch} initialStatus="PENDING" title="draft orders" />}
      {tab === 'abandoned' && <AbandonedTab authFetch={authFetch} />}
    </div>
  );
}

function CustomersSection({ authFetch }) {
  const [tab, setTab] = useState('all');
  return (
    <div className="space-y-5">
      <SectionTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'all', label: 'Customers' },
          { key: 'segments', label: 'Segments' },
          { key: 'reviews', label: 'Reviews' },
        ]}
      />
      {tab === 'all' && <CustomersTab authFetch={authFetch} />}
      {tab === 'segments' && <SegmentsTab authFetch={authFetch} />}
      {tab === 'reviews' && <ReviewsTab authFetch={authFetch} />}
    </div>
  );
}

function StaffSection({ authFetch, regions, user, onProfileSaved, initialTab = 'staff' }) {
  const allowedTabs = ['staff', 'roles', 'security_audit'];
  const [tab, setTab] = useState(allowedTabs.includes(initialTab) ? initialTab : 'staff');
  useEffect(() => {
    if (allowedTabs.includes(initialTab)) setTab(initialTab);
  }, [initialTab]);
  return (
    <div className="space-y-5">
      <SectionTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'staff', label: 'Staff Directory' },
          { key: 'roles', label: 'Roles & Permissions' },
          { key: 'security_audit', label: 'Security & Audit Log' },
        ]}
      />
      {tab === 'staff' && <StaffTab authFetch={authFetch} regions={regions} />}
      {tab === 'roles' && <RolesTab authFetch={authFetch} />}
      {tab === 'security_audit' && <SecurityAndAuditTab authFetch={authFetch} user={user} onSaved={onProfileSaved} />}
    </div>
  );
}

function DashboardSection({ authFetch, go, initialTab = 'overview' }) {
  const allowedTabs = ['overview', 'reports'];
  const [tab, setTab] = useState(allowedTabs.includes(initialTab) ? initialTab : 'overview');
  useEffect(() => {
    if (allowedTabs.includes(initialTab)) setTab(initialTab);
  }, [initialTab]);
  return (
    <div className="space-y-5">
      <SectionTabs
        active={tab}
        onChange={setTab}
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'reports', label: 'Reports' },
        ]}
      />
      {tab === 'overview' && <HomeTab authFetch={authFetch} go={go} />}
      {tab === 'reports' && <AnalyticsAndReportsTab authFetch={authFetch} />}
    </div>
  );
}

// Eight top-level sections. Everything else lives as a tab inside one of them —
// e.g. draft orders and abandoned checkouts are views of Orders, not separate
// destinations. Keep this list short; a new nav entry needs a real reason.
const NAV_GROUPS = [
  { title: null, items: [
    { key: 'home', label: 'Dashboard', icon: Home },
    { key: 'orders', label: 'Orders', icon: ShoppingCart },
    { key: 'products', label: 'Products', icon: Package },
    { key: 'categories', label: 'Categories', icon: Layers },
    { key: 'customers', label: 'Customers', icon: UserRound },
    { key: 'content', label: 'Content', icon: FileText },
    { key: 'staff', label: 'Staff Management', icon: UsersIcon },
    { key: 'settings', label: 'Settings', icon: Sliders },
  ] },
];
const NAV = NAV_GROUPS.flatMap((g) => g.items);
const ADMIN_SECTION_KEYS = new Set([
  ...NAV.map((item) => item.key),
  'pages', 'blogs', 'glossary', 'faq', 'navigation',
]);
const LEGACY_ADMIN_ROUTES = {
  audit: { section: 'staff', tab: 'security_audit' },
  security_audit: { section: 'staff', tab: 'security_audit' },
  roles: { section: 'staff', tab: 'roles' },
  abandoned: { section: 'orders', tab: 'abandoned' },
  drafts: { section: 'orders', tab: 'drafts' },
  reports: { section: 'home', tab: 'reports' },
  analytics: { section: 'home', tab: 'reports' },
  shipping: { section: 'settings', tab: 'shipping' },
  markets: { section: 'settings', tab: 'markets' },
  payments: { section: 'settings', tab: 'payments' },
  discounts: { section: 'settings', tab: 'discounts' },
  emails: { section: 'settings', tab: 'emails' },
  notifications: { section: 'settings', tab: 'notifications' },
  homepage: { section: 'settings', tab: 'homepage' },
  cookie_consent: { section: 'settings', tab: 'cookie-consent' },
};


/* ------------------------------------------------------------- Staff Management */
function StaffTab({ authFetch, regions }) {
  const [staff, setStaff] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [editingStaff, setEditingStaff] = useState(null);
  const [isAddingStaff, setIsAddingStaff] = useState(false);
  const [newStaff, setNewStaff] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    roles: [],
    assigned_regions: [],
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      authFetch('/api/admin/staff/').then((r) => r.json()).catch(() => []),
      authFetch('/api/admin/roles/').then((r) => r.json()).catch(() => []),
    ]).then(([sData, rData]) => {
      setStaff(Array.isArray(sData) ? sData : sData.results || []);
      setRoles(Array.isArray(rData) ? rData : rData.results || []);
    }).finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreateStaff = (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!newStaff.email.trim() || !newStaff.password.trim()) {
      setError('Please provide a valid email address and a strong initial password.');
      return;
    }

    let roleIds = newStaff.roles;
    if (roleIds.length === 0) {
      const defaultRole = roles.find(r => r.name === 'Staff') || roles[0];
      if (defaultRole) roleIds = [defaultRole.id];
    }

    authFetch('/api/admin/staff/', {
      method: 'POST',
      body: JSON.stringify({
        first_name: newStaff.first_name.trim(),
        last_name: newStaff.last_name.trim(),
        email: newStaff.email.trim().toLowerCase(),
        password: newStaff.password,
        roles: roleIds,
        assigned_regions: newStaff.assigned_regions,
        is_staff: true,
        is_active: true
      })
    })
    .then((r) => {
      if (!r.ok) return r.json().then(e => { throw new Error(JSON.stringify(e)); });
      return r.json();
    })
    .then(() => {
      setSuccess('Staff member added successfully!');
      setIsAddingStaff(false);
      setNewStaff({ first_name: '', last_name: '', email: '', password: '', roles: [], assigned_regions: [] });
      loadData();
    })
    .catch((e) => setError(e.message));
  };

  const saveStaff = () => {
    setError('');
    authFetch(`/api/admin/staff/${editingStaff.id}/`, {
      method: 'PATCH',
      body: JSON.stringify({
        first_name: editingStaff.first_name,
        last_name: editingStaff.last_name,
        is_staff: editingStaff.is_staff,
        is_active: editingStaff.is_active,
        roles: editingStaff.roles,
        assigned_regions: editingStaff.assigned_regions,
        allowed_ip_range: editingStaff.allowed_ip_range || '',
        two_factor_enabled: editingStaff.two_factor_enabled
      })
    })
    .then((r) => {
      if (!r.ok) return r.json().then(e => { throw new Error(JSON.stringify(e)); });
      return r.json();
    })
    .then(() => { setEditingStaff(null); loadData(); })
    .catch((e) => setError(e.message));
  };

  const toggleStaffActive = (s) => {
    authFetch(`/api/admin/staff/${s.id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: !s.is_active })
    }).then(() => loadData());
  };

  const filteredStaff = staff.filter((s) => {
    const query = search.toLowerCase();
    const fullName = `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase();
    const matchesSearch = fullName.includes(query) || (s.email || '').toLowerCase().includes(query);
    if (roleFilter === 'ALL') return matchesSearch;
    const staffRoleNames = (s.roles || []).map(rId => roles.find(r => r.id === rId)?.name);
    return matchesSearch && staffRoleNames.includes(roleFilter);
  });

  const totalCount = staff.length;
  const adminCount = staff.filter(s => (s.roles || []).some(rId => roles.find(r => r.id === rId)?.name === 'Admin')).length;
  const staffMemberCount = totalCount - adminCount;

  if (loading) return <p className="text-sm text-brand-muted p-4">Loading staff directory...</p>;

  return (
    <div className="space-y-5">
      {/* Metric Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-edge bg-white p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-ink-subtle uppercase tracking-wider">Total Staff Members</p>
            <h3 className="text-2xl font-bold text-ink-primary mt-1">{totalCount}</h3>
          </div>
          <div className="p-3 bg-brand-accent/10 rounded-lg text-ink-accent">
            <UsersIcon className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl border border-edge bg-white p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-ink-subtle uppercase tracking-wider">Administrators</p>
            <h3 className="text-2xl font-bold text-ink-primary mt-1">{adminCount}</h3>
          </div>
          <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-xl border border-edge bg-white p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-ink-subtle uppercase tracking-wider">Store Operations Staff</p>
            <h3 className="text-2xl font-bold text-ink-primary mt-1">{staffMemberCount}</h3>
          </div>
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600">
            <UserRound className="h-5 w-5" />
          </div>
        </div>
      </div>

      {success && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-800 flex justify-between items-center">
          <span>{success}</span>
          <button onClick={() => setSuccess('')}><X className="h-4 w-4 text-emerald-600" /></button>
        </div>
      )}

      {/* Control Bar & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-white p-3 rounded-xl border border-edge shadow-sm">
        <div className="flex flex-1 items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff by name or email..."
              className="w-full rounded-lg border border-edge py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ink-primary"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="rounded-lg border border-edge px-3 py-2 text-sm bg-white focus:outline-none"
          >
            <option value="ALL">All Roles</option>
            <option value="Admin">Admin Only</option>
            <option value="Staff">Staff Only</option>
          </select>
        </div>

        <button
          onClick={() => { setError(''); setIsAddingStaff(true); }}
          className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm cursor-pointer"
        >
          <UserPlus className="h-4 w-4" /> Add Staff Member
        </button>
      </div>

      {/* Staff Directory Table */}
      <div className="overflow-x-auto rounded-xl border border-edge bg-white shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-muted text-[12px] font-semibold uppercase tracking-wider text-ink-muted border-b border-edge">
            <tr>
              <th className="px-4 py-3.5">Member</th>
              <th className="px-4 py-3.5">Assigned Role</th>
              <th className="px-4 py-3.5">Region Scope</th>
              <th className="px-4 py-3.5">Security &amp; 2FA</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-edge-subtle">
            {filteredStaff.map((s) => {
              const assignedRoles = (s.roles || []).map(rId => roles.find(r => r.id === rId)).filter(Boolean);
              const isAdmin = assignedRoles.some(r => r.name === 'Admin');
              return (
                <tr key={s.id} className="hover:bg-surface-muted/50 transition-colors align-middle">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs ${isAdmin ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        {(s.first_name?.[0] || s.email[0] || 'U').toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-ink-primary">{s.first_name || 'Staff'} {s.last_name || ''}</p>
                        <p className="font-mono text-xs text-brand-muted">{s.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {assignedRoles.map((r) => (
                        <span
                          key={r.id}
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.name === 'Admin' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}
                        >
                          {r.name}
                        </span>
                      ))}
                      {assignedRoles.length === 0 && <span className="text-ink-subtle text-xs">Standard Staff</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-xs font-medium text-ink-secondary">
                    {s.assigned_regions_codes?.length > 0 ? (
                      <span className="rounded bg-surface-muted border border-edge px-2 py-0.5 font-mono">
                        {s.assigned_regions_codes.join(', ')}
                      </span>
                    ) : (
                      <span className="text-ink-subtle">Global (All Regions)</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {s.two_factor_enabled ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        <ShieldCheck className="h-3 w-3" /> 2FA Active
                      </span>
                    ) : (
                      <span className="text-xs text-brand-muted">Standard Password</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => toggleStaffActive(s)}
                      className={`cursor-pointer rounded-full px-2.5 py-0.5 text-xs font-semibold transition-opacity hover:opacity-80 ${s.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}
                    >
                      {s.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      onClick={() => { setError(''); setEditingStaff({ ...s }); }}
                      className="text-xs font-semibold text-ink-accent hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Manage
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredStaff.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-brand-muted">
                  No staff members match your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add staff workspace */}
      {isAddingStaff && (
        <div className="admin-action-page flex flex-col items-center">
          <div className="bg-white rounded-2xl border border-edge p-6 shadow-2xl w-full max-w-lg space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-edge">
              <div>
                <h3 className="text-lg font-bold text-ink-primary">Add New Staff Member</h3>
                <p className="text-xs text-brand-muted">Create a staff account and assign immediate store permissions.</p>
              </div>
              <button onClick={() => setIsAddingStaff(false)} className="p-1 rounded-full hover:bg-surface-muted cursor-pointer">
                <X className="h-5 w-5 text-brand-muted" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">First Name</label>
                  <input
                    placeholder="Jane"
                    value={newStaff.first_name}
                    onChange={(e) => setNewStaff({ ...newStaff, first_name: e.target.value })}
                    className="w-full rounded-lg border border-edge p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ink-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">Last Name</label>
                  <input
                    placeholder="Doe"
                    value={newStaff.last_name}
                    onChange={(e) => setNewStaff({ ...newStaff, last_name: e.target.value })}
                    className="w-full rounded-lg border border-edge p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ink-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">Work Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="jane.doe@scleroproteins.co.uk"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  className="w-full rounded-lg border border-edge p-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ink-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">Initial Password</label>
                <PasswordInput
                  autoComplete="new-password"
                  placeholder="Create a strong initial password"
                  value={newStaff.password}
                  onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                  className="w-full rounded-lg border border-edge p-2.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ink-primary"
                />
                <p className="text-[11px] text-brand-muted mt-1">Required. Use at least 8 characters; the server also checks common-password rules.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">Assign Role</label>
                <div className="grid grid-cols-2 gap-2">
                  {roles.map((r) => {
                    const isSelected = newStaff.roles.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          const updated = isSelected ? newStaff.roles.filter(x => x !== r.id) : [r.id];
                          setNewStaff({ ...newStaff, roles: updated });
                        }}
                        className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${isSelected ? 'border-ink-primary bg-brand-accent/5 font-semibold text-ink-primary shadow-xs' : 'border-edge bg-white text-ink-secondary hover:border-edge-subtle'}`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-xs">{r.name}</span>
                          {isSelected && <CheckCircle2 className="h-4 w-4 text-ink-accent" />}
                        </div>
                        <p className="text-[11px] text-brand-muted mt-0.5 line-clamp-1">{r.description || 'Access level role'}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-secondary mb-1">Regional Scope</label>
                <div className="flex gap-4 p-2.5 border border-edge rounded-lg bg-surface-muted/50">
                  {regions.map((r) => {
                    const isAssigned = newStaff.assigned_regions.includes(r.id);
                    return (
                      <label key={r.id} className="flex items-center gap-2 cursor-pointer font-semibold text-xs text-ink-primary">
                        <input
                          type="checkbox"
                          checked={isAssigned}
                          onChange={(e) => {
                            const updated = e.target.checked
                              ? [...newStaff.assigned_regions, r.id]
                              : newStaff.assigned_regions.filter(x => x !== r.id);
                            setNewStaff({ ...newStaff, assigned_regions: updated });
                          }}
                          className="h-4 w-4 accent-ink-primary rounded"
                        />
                        {r.code} ({r.name})
                      </label>
                    );
                  })}
                  {regions.length === 0 && <span className="text-xs text-ink-subtle">Global (All Regions)</span>}
                </div>
              </div>

              {error && <p className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs font-semibold text-rose-700">{error}</p>}

              <div className="flex gap-2 pt-2 border-t border-edge">
                <button type="submit" className="btn-primary flex-1 py-2.5 text-sm font-semibold rounded-lg cursor-pointer">
                  Create Staff Member
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingStaff(false)}
                  className="px-4 py-2.5 border border-edge rounded-lg text-sm font-semibold text-ink-secondary hover:bg-surface-muted cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit / Manage Staff Drawer */}
      {editingStaff && (
        <div className="admin-action-page flex flex-col items-center">
          <div className="bg-white h-full w-full max-w-md border-l border-edge p-6 shadow-2xl overflow-y-auto space-y-5">
            <div className="flex justify-between items-center pb-3 border-b border-edge">
              <div>
                <h3 className="text-lg font-bold text-ink-primary">Manage Staff Member</h3>
                <p className="font-mono text-xs text-brand-muted">{editingStaff.email}</p>
              </div>
              <button onClick={() => setEditingStaff(null)} className="p-1 rounded-full hover:bg-surface-muted cursor-pointer">
                <X className="h-5 w-5 text-brand-muted" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">First Name</label>
                  <input
                    value={editingStaff.first_name || ''}
                    onChange={(e) => setEditingStaff({ ...editingStaff, first_name: e.target.value })}
                    className="w-full rounded-lg border border-edge p-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-ink-secondary mb-1">Last Name</label>
                  <input
                    value={editingStaff.last_name || ''}
                    onChange={(e) => setEditingStaff({ ...editingStaff, last_name: e.target.value })}
                    className="w-full rounded-lg border border-edge p-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-3 bg-surface-muted rounded-xl border border-edge">
                <label className="flex items-center gap-2 font-semibold text-xs text-ink-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingStaff.is_staff}
                    onChange={(e) => setEditingStaff({ ...editingStaff, is_staff: e.target.checked })}
                    className="h-4 w-4 accent-ink-primary"
                  />
                  Staff Access
                </label>
                <label className="flex items-center gap-2 font-semibold text-xs text-ink-primary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingStaff.is_active}
                    onChange={(e) => setEditingStaff({ ...editingStaff, is_active: e.target.checked })}
                    className="h-4 w-4 accent-ink-primary"
                  />
                  Account Active
                </label>
              </div>

              <div>
                <p className="text-xs font-semibold text-ink-subtle uppercase mb-1">Assigned Role</p>
                <div className="space-y-1.5 border border-edge p-2.5 rounded-xl bg-white">
                  {roles.map((r) => {
                    const hasRole = (editingStaff.roles || []).includes(r.id);
                    return (
                      <label key={r.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-muted cursor-pointer font-medium text-xs">
                        <span>{r.name}</span>
                        <input
                          type="checkbox"
                          checked={hasRole}
                          onChange={(e) => {
                            const newRoles = e.target.checked
                              ? [...(editingStaff.roles || []), r.id]
                              : (editingStaff.roles || []).filter(x => x !== r.id);
                            setEditingStaff({ ...editingStaff, roles: newRoles });
                          }}
                          className="h-4 w-4 accent-ink-primary"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-ink-subtle uppercase mb-1">Regional Access Scope</p>
                <div className="flex gap-4 p-3 border border-edge rounded-xl bg-surface-muted/50">
                  {regions.map((r) => {
                    const isAssigned = (editingStaff.assigned_regions || []).includes(r.id);
                    return (
                      <label key={r.id} className="flex items-center gap-2 cursor-pointer font-semibold text-xs text-ink-secondary">
                        <input
                          type="checkbox"
                          checked={isAssigned}
                          onChange={(e) => {
                            const newRegs = e.target.checked
                              ? [...(editingStaff.assigned_regions || []), r.id]
                              : (editingStaff.assigned_regions || []).filter(x => x !== r.id);
                            setEditingStaff({ ...editingStaff, assigned_regions: newRegs });
                          }}
                          className="h-4 w-4 accent-ink-primary"
                        />
                        {r.code} ({r.name})
                      </label>
                    );
                  })}
                  {regions.length === 0 && <span className="text-xs text-ink-subtle">Global Scope</span>}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-ink-subtle uppercase mb-1">Allowed IP Whitelist</p>
                <input
                  placeholder="e.g. 192.168.1.1, 10.0.0.5"
                  value={editingStaff.allowed_ip_range || ''}
                  onChange={(e) => setEditingStaff({ ...editingStaff, allowed_ip_range: e.target.value })}
                  className="w-full rounded-lg border border-edge p-2.5 text-xs font-mono"
                />
                <p className="text-[11px] text-brand-muted mt-1">Comma-separated IPs. Leave empty for unrestricted access.</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-ink-subtle uppercase mb-1">Security</p>
                <label className="flex items-center gap-2 font-semibold text-xs text-ink-primary cursor-pointer p-2.5 border border-edge rounded-xl bg-white">
                  <input
                    type="checkbox"
                    checked={editingStaff.two_factor_enabled}
                    onChange={(e) => setEditingStaff({ ...editingStaff, two_factor_enabled: e.target.checked })}
                    className="h-4 w-4 accent-ink-primary"
                  />
                  Require Two-Factor Authentication (2FA)
                </label>
              </div>

              {error && <p className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs font-semibold text-rose-700">{error}</p>}

              <div className="pt-4 border-t border-edge flex gap-2">
                <button onClick={saveStaff} className="btn-primary flex-1 py-2.5 text-sm font-semibold rounded-lg cursor-pointer">
                  Save Changes
                </button>
                <button onClick={() => setEditingStaff(null)} className="px-4 py-2.5 border border-edge rounded-lg text-sm font-semibold text-ink-secondary hover:bg-surface-muted cursor-pointer">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- Roles & Permissions */
function RolesTab({ authFetch }) {
  const [roles, setRoles] = useState([]);
  const [permCatalog, setPermCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRole, setEditingRole] = useState(null);
  const [error, setError] = useState('');

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      authFetch('/api/admin/roles/').then((r) => r.json()).catch(() => []),
      authFetch('/api/admin/roles/permission_catalog/').then((r) => r.json()).catch(() => []),
    ]).then(([rData, pData]) => {
      setRoles(Array.isArray(rData) ? rData : rData.results || []);
      setPermCatalog(pData || []);
    }).finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => { loadData(); }, [loadData]);

  const saveRole = () => {
    setError('');
    const isNew = !editingRole.id;
    authFetch(isNew ? '/api/admin/roles/' : `/api/admin/roles/${editingRole.id}/`, {
      method: isNew ? 'POST' : 'PUT',
      body: JSON.stringify({
        name: editingRole.name,
        description: editingRole.description,
        permissions: editingRole.permissions
      })
    })
    .then((r) => {
      if (!r.ok) return r.json().then(e => { throw new Error(JSON.stringify(e)); });
      return r.json();
    })
    .then(() => { setEditingRole(null); loadData(); })
    .catch((e) => setError(e.message));
  };

  const deleteRole = (role) => {
    if (role.is_system) return alert("System roles are protected and cannot be deleted.");
    if (confirm(`Are you sure you want to delete the role "${role.name}"?`)) {
      authFetch(`/api/admin/roles/${role.id}/`, { method: 'DELETE' })
        .then(() => loadData());
    }
  };

  if (loading) return <p className="text-sm text-brand-muted p-4">Loading roles &amp; permissions...</p>;

  return (
    <div className="space-y-5">
      {/* Header Info Banner */}
      <div className="bg-white p-5 rounded-2xl border border-edge shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-base font-bold text-ink-primary">Streamlined Role Hierarchy</h3>
          <p className="text-xs text-brand-muted mt-0.5">
            The platform is configured with 2 core roles to maintain a clutter-free, easy-to-understand permission setup.
          </p>
        </div>
        <button
          onClick={() => setEditingRole({ name: '', description: '', permissions: [] })}
          className="btn-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider rounded-lg cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" /> Custom Role
        </button>
      </div>

      {/* Roles Display Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {roles.map((r) => (
          <div key={r.id} className="rounded-2xl border border-edge bg-white shadow-card p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
            <div>
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className={`p-2 rounded-lg ${r.name === 'Admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <h4 className="text-base font-bold text-ink-primary">{r.name}</h4>
                </div>
                {r.is_system && (
                  <span className="rounded-full bg-surface-muted text-ink-muted border border-edge px-2.5 py-0.5 text-xs font-bold">SYSTEM ROLE</span>
                )}
              </div>
              <p className="text-xs text-brand-muted mt-2 min-h-[36px]">
                {r.description || (r.name === 'Admin' ? 'Full unrestricted platform control & management.' : 'Day-to-day store operations: orders, stock, enquiries.')}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-md bg-brand-accent/10 text-ink-accent px-2 py-1 text-xs font-mono font-semibold">
                  {r.permissions.length} Active Permissions
                </span>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-edge-subtle pt-3.5">
              <button
                onClick={() => setEditingRole({ ...r })}
                className="text-xs px-3 py-1.5 rounded-lg border border-edge text-ink-primary hover:bg-surface-muted font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Pencil className="h-3 w-3" /> Configure Permissions
              </button>
              {!r.is_system && (
                <button
                  onClick={() => deleteRole(r)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <X className="h-3 w-3" /> Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Edit/create role workspace */}
      {editingRole && (
        <div className="admin-action-page flex flex-col items-center">
          <div className="bg-white rounded-2xl border border-edge p-6 shadow-2xl w-full max-w-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-edge">
              <h3 className="text-lg font-bold text-ink-primary">{editingRole.id ? `Configure Role: ${editingRole.name}` : 'Create Custom Role'}</h3>
              <button onClick={() => setEditingRole(null)} className="p-1 rounded-full hover:bg-surface-muted cursor-pointer">
                <X className="h-5 w-5 text-brand-muted" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div className="grid gap-3">
                <input
                  placeholder="Role Name"
                  value={editingRole.name}
                  disabled={editingRole.is_system}
                  onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
                  className="w-full rounded-lg border border-edge p-2.5 text-sm font-semibold disabled:bg-surface-muted"
                />
                <textarea
                  placeholder="Description of what this role does..."
                  value={editingRole.description}
                  onChange={(e) => setEditingRole({ ...editingRole, description: e.target.value })}
                  className="w-full rounded-lg border border-edge p-2.5 text-sm"
                  rows={2}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="font-bold text-xs uppercase tracking-wider text-ink-primary">
                    Permission Scope Matrix
                  </p>
                  <span className="text-xs font-mono text-ink-accent font-semibold">
                    {editingRole.permissions.length} of {permCatalog.reduce((n, g) => n + g.permissions.length, 0)} Selected
                  </span>
                </div>

                <div className="grid max-h-80 grid-cols-1 gap-3 overflow-y-auto rounded-xl border border-edge bg-surface-muted/50 p-3 md:grid-cols-2">
                  {permCatalog.map((group) => {
                    const keys = group.permissions.map((p) => p.key);
                    const allOn = keys.every((k) => editingRole.permissions.includes(k));
                    return (
                      <div key={group.group} className="space-y-2 rounded-xl border border-edge bg-white p-3 shadow-xs">
                        <div className="flex items-center justify-between border-b border-edge-subtle pb-1.5">
                          <p className="font-bold text-xs text-ink-primary">{group.group}</p>
                          <button
                            type="button"
                            disabled={editingRole.is_system}
                            onClick={() => setEditingRole({
                              ...editingRole,
                              permissions: allOn
                                ? editingRole.permissions.filter((k) => !keys.includes(k))
                                : [...new Set([...editingRole.permissions, ...keys])],
                            })}
                            className="rounded-full border border-edge px-2 py-0.5 text-[11px] font-semibold text-ink-muted hover:border-ink-primary hover:text-ink-primary disabled:opacity-40"
                          >
                            {allOn ? 'Clear' : 'Select All'}
                          </button>
                        </div>
                        {group.permissions.map((p) => {
                          const active = editingRole.permissions.includes(p.key);
                          return (
                            <label key={p.key} className="flex items-start gap-2 cursor-pointer leading-snug py-0.5">
                              <input
                                type="checkbox"
                                checked={active}
                                disabled={editingRole.is_system}
                                onChange={(e) => setEditingRole({
                                  ...editingRole,
                                  permissions: e.target.checked
                                    ? [...editingRole.permissions, p.key]
                                    : editingRole.permissions.filter((x) => x !== p.key),
                                })}
                                className="mt-0.5 h-3.5 w-3.5 accent-ink-primary rounded"
                              />
                              <span className="text-xs text-ink-secondary">{p.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              {error && <p className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs font-semibold text-rose-700">{error}</p>}

              <div className="flex gap-2 pt-2 border-t border-edge">
                {!editingRole.is_system ? (
                  <button onClick={saveRole} className="btn-primary flex-1 py-2.5 text-sm font-semibold rounded-lg cursor-pointer">
                    Save Role Configuration
                  </button>
                ) : (
                  <p className="flex-1 text-center text-xs font-semibold text-brand-muted py-2">
                    System roles are pre-configured defaults.
                  </p>
                )}
                <button onClick={() => setEditingRole(null)} className="px-4 py-2.5 border border-edge rounded-lg text-sm font-semibold text-ink-secondary hover:bg-surface-muted cursor-pointer">
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- Security & Audit Log */
function SecurityAndAuditTab({ authFetch, user, onSaved }) {
  const [subTab, setSubTab] = useState('audit'); // audit | security
  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-edge-subtle pb-2">
        <button
          onClick={() => setSubTab('audit')}
          className={`px-4 py-1.5 text-xs font-semibold uppercase rounded-md transition-colors ${subTab === 'audit' ? 'bg-ink-primary text-white shadow-xs' : 'text-ink-primary hover:bg-surface-muted'}`}
        >
          Audit Log Trail
        </button>
        <button
          onClick={() => setSubTab('security')}
          className={`px-4 py-1.5 text-xs font-semibold uppercase rounded-md transition-colors ${subTab === 'security' ? 'bg-ink-primary text-white shadow-xs' : 'text-ink-primary hover:bg-surface-muted'}`}
        >
          Security Center
        </button>
      </div>

      {subTab === 'audit' && <AuditTab authFetch={authFetch} />}
      {subTab === 'security' && <SecurityCenterTab authFetch={authFetch} user={user} onSaved={onSaved} />}
    </div>
  );
}

/* ------------------------------------------------------------- AuditTab */
function AuditTab({ authFetch }) {
  const [logs, setLogs] = useState([]);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState(null);
  
  // Filters
  const [filterAction, setFilterAction] = useState('ALL');
  const [filterActor, setFilterActor] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 450);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const loadLogs = useCallback(() => {
    setLoading(true);
    setError('');
    const params = new URLSearchParams({
      page,
      page_size: pageSize,
      search: debouncedQuery,
    });
    if (filterAction !== 'ALL') params.append('action', filterAction);
    if (filterActor.trim()) params.append('actor_email', filterActor);
    
    const readJson = async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || data.error || `Audit request failed (${response.status}).`);
      }
      return data;
    };
    Promise.all([
      authFetch(`/api/admin/audit-logs/?${params.toString()}`).then(readJson),
      authFetch('/api/admin/audit-logs/actions/').then(readJson),
    ]).then(([lData, aData]) => {
      setLogs(lData.results || []);
      setTotalCount(lData.count || 0);
      setActions(aData || []);
    }).catch((requestError) => {
      setLogs([]);
      setTotalCount(0);
      setError(requestError.message || 'Unable to load audit logs.');
    }).finally(() => setLoading(false));
  }, [authFetch, page, pageSize, debouncedQuery, filterAction, filterActor]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQuery, filterAction, filterActor]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert">
          {error} Check that your staff role includes the “Read the audit log” permission.
        </div>
      )}
      {/* Filters bar */}
      <div className="grid gap-3 rounded-md border border-edge bg-white p-3 md:grid-cols-[1fr_200px_200px_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search audit summaries..." className="w-full rounded-sm border border-edge py-2 pl-9 pr-3 text-sm focus:outline-none" />
        </label>
        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="rounded-sm border border-edge px-3 py-2 text-sm bg-white focus:outline-none">
          <option value="ALL">All Actions</option>
          {actions.map((act) => <option key={act} value={act}>{act}</option>)}
        </select>
        <input value={filterActor} onChange={(e) => setFilterActor(e.target.value)} placeholder="Filter actor email" className="rounded-sm border border-edge px-3 py-2 text-sm focus:outline-none" />
        <button onClick={loadLogs} className="btn-primary px-4 py-2 text-sm uppercase font-semibold">Apply</button>
      </div>

      {loading && logs.length === 0 ? (
        <p className="text-sm text-brand-muted">Querying audit logs trail...</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-edge bg-white shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-muted text-[12px] font-medium uppercase tracking-wide text-ink-muted border-b border-edge">
              <tr>
                <th className="px-3 py-3">Timestamp</th>
                <th className="px-3 py-3">Actor</th>
                <th className="px-3 py-3">Action</th>
                <th className="px-3 py-3">Target</th>
                <th className="px-3 py-3">Summary</th>
                <th className="px-3 py-3">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="cursor-pointer border-t border-edge-subtle hover:bg-surface-muted" onClick={() => setSelectedLog(log)}>
                  <td className="px-3 py-3 font-mono text-[12px] text-brand-muted">{formatDateTime(log.created_at)}</td>
                  <td className="px-3 py-3 font-semibold text-ink-primary">{log.actor_email}</td>
                  <td className="px-3 py-3 font-mono text-[12px]"><span className="rounded bg-surface-muted px-1.5 py-0.5 text-ink-accent">{log.action}</span></td>
                  <td className="px-3 py-3 text-ink-muted font-mono text-[12px]">{log.target_type} #{log.target_id}</td>
                  <td className="px-3 py-3 font-semibold text-ink-primary truncate max-w-[200px]">{log.summary}</td>
                  <td className="px-3 py-3 font-mono text-ink-muted">{log.ip_address}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-brand-muted text-sm">No audit logs matching query parameters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {totalCount > pageSize && (
        <PaginationControls
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          onChangePage={setPage}
          onChangePageSize={setPageSize}
        />
      )}

      {selectedLog && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-surface-muted overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
          <div className="w-full max-w-lg bg-white rounded-lg border border-edge p-6 shadow-card space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-edge-subtle">
              <h3 className="text-lg font-semibold text-ink-primary">Audit Log Details</h3>
              <button onClick={() => setSelectedLog(null)}><X className="h-5 w-5 text-brand-muted" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <p><span className="font-semibold uppercase text-brand-muted">Timestamp:</span> {formatDateTime(selectedLog.created_at)}</p>
              <p><span className="font-semibold uppercase text-brand-muted">Actor:</span> {selectedLog.actor_email} (IP: {selectedLog.ip_address})</p>
              <p><span className="font-semibold uppercase text-brand-muted">Action:</span> {selectedLog.action}</p>
              <p><span className="font-semibold uppercase text-brand-muted">Target:</span> {selectedLog.target_type} #{selectedLog.target_id}</p>
              <div className="p-3 bg-surface-muted rounded-md border border-edge-subtle">
                <p className="font-semibold text-ink-subtle mb-1">SUMMARY</p>
                <p className="text-ink-primary font-semibold">{selectedLog.summary}</p>
              </div>
              <div>
                <p className="font-semibold text-brand-muted mb-1">DEVICE USER AGENT</p>
                <p className="font-mono text-[12px] text-ink-muted bg-surface-muted p-2 rounded-lg border border-edge-subtle">{selectedLog.user_agent}</p>
              </div>
              {selectedLog.changes && Object.keys(selectedLog.changes).length > 0 && (
                <div>
                  <p className="font-semibold text-brand-muted mb-1">CHANGESET DIFF (BEFORE → AFTER)</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto bg-surface-muted p-2 rounded-lg border border-edge-subtle font-mono text-[12px] mb-2">
                    {Object.entries(selectedLog.changes).map(([field, val]) => {
                      const before = Array.isArray(val) ? val[0] : '—';
                      const after = Array.isArray(val) ? val[1] : val;
                      return (
                        <div key={field} className="border-b border-edge pb-1">
                          <span className="font-semibold text-ink-accent">{field}:</span>
                          <span className="text-ink-danger line-through ml-1">{JSON.stringify(before)}</span>
                          <span className="text-ink-success ml-1">→ {JSON.stringify(after)}</span>
                        </div>
                      );
                    })}
                  </div>
                  
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------- SecurityCenterTab */
function SecurityCenterTab({ authFetch, user, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  
  const currentSessionId = typeof window !== 'undefined' ? window.localStorage.getItem('sclero_session_id') : '';

  const handleToggle2FA = (e) => {
    const isEnabled = e.target.checked;
    setSaving(true);
    setSuccess('');
    setError('');
    
    authFetch('/api/auth/profile/', {
      method: 'PATCH',
      body: JSON.stringify({ two_factor_enabled: isEnabled })
    })
    .then((r) => {
      if (!r.ok) throw new Error("Could not update 2FA status.");
      return r.json();
    })
    .then(() => {
      setSuccess(`Two-Factor Authentication ${isEnabled ? 'enabled' : 'disabled'} successfully.`);
      onSaved && onSaved();
    })
    .catch((e) => setError(e.message))
    .finally(() => setSaving(false));
  };

  const handleTerminateSessions = () => {
    setSaving(true);
    setSuccess('');
    setError('');
    
    authFetch('/api/auth/profile/terminate-devices/', {
      method: 'POST',
      body: JSON.stringify({ session_id: currentSessionId })
    })
    .then((r) => {
      if (!r.ok) throw new Error("Failed to terminate other sessions.");
      return r.json();
    })
    .then(() => {
      setSuccess("All other active device sessions terminated successfully.");
      onSaved && onSaved();
    })
    .catch((e) => setError(e.message))
    .finally(() => setSaving(false));
  };

  return (
    <div className="space-y-6 text-sm bg-white rounded-lg border border-edge p-5 shadow-card">
      <div>
        <h3 className="text-sm font-semibold text-ink-primary mb-1 uppercase">Account Security Status</h3>
        <p className="text-brand-muted mb-3">Manage Two-Factor Authentication and whitelist range settings for your staff profile.</p>
        
        {success && <p className="rounded bg-brand-success/10 p-2.5 text-sm text-ink-success font-semibold mb-3">{success}</p>}
        {error && <p className="rounded bg-brand-danger/10 p-2.5 text-sm text-brand-danger font-semibold mb-3">{error}</p>}
        
        <div className="space-y-3">
          <label className="flex items-start gap-3 rounded-md border border-edge bg-white shadow-card p-4 cursor-pointer">
            <input type="checkbox" checked={user.two_factor_enabled} disabled={saving} onChange={handleToggle2FA} className="mt-0.5 h-4 w-4 accent-ink-primary" />
            <span>
              <span className="block text-sm font-semibold text-ink-primary">Enable 2-Step OTP Authentication</span>
              <span className="block text-sm text-brand-muted mt-0.5">Enforces a 6-digit OTP code sent to your registered email ({user.email}) during sign-in.</span>
            </span>
          </label>
          
          {user.allowed_ip_range && (
            <div className="rounded-md border border-edge bg-surface-muted p-4 font-mono">
              <span className="block text-[12px] font-semibold text-ink-subtle uppercase mb-1">Active IP Whitelist restrictions</span>
              <span className="text-ink-primary font-semibold">{user.allowed_ip_range}</span>
              <p className="text-[12px] text-ink-subtle mt-1 font-sans">You are restricted to connecting only from these IP addresses. Contact Super Admin to update your IP scope.</p>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-edge-subtle pt-4">
        <h3 className="text-sm font-semibold text-ink-primary mb-1 uppercase">Active login sessions</h3>
        <p className="text-brand-muted mb-3">These devices are currently logged in. Terminating other sessions logs out all other browsers.</p>
        
        <div className="space-y-2 mb-4">
          {(user.current_devices || []).map((dev, idx) => {
            const isCurrent = dev.id === currentSessionId;
            return (
              <div key={idx} className="flex justify-between items-center p-3 rounded-lg border border-edge-subtle bg-surface-muted font-mono text-[12px]">
                <div className="space-y-0.5">
                  <span className="font-semibold text-ink-primary">{dev.ip}</span>
                  <span className="block text-ink-subtle font-sans">{dev.user_agent.substring(0, 50)}...</span>
                </div>
                <div className="text-right">
                  {isCurrent ? (
                    <span className="rounded bg-surface-muted text-ink-accent px-1.5 py-0.5 text-[13px] font-semibold font-sans">CURRENT SESSION</span>
                  ) : (
                    <span className="text-ink-subtle font-sans">Active: {new Date(dev.last_active).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            );
          })}
          {(!user.current_devices || user.current_devices.length === 0) && (
            <p className="text-ink-subtle italic">No device session logging enabled.</p>
          )}
        </div>
        
        <button onClick={handleTerminateSessions} disabled={saving || (user.current_devices || []).length <= 1} className="btn-secondary w-full py-2.5 border border-red-200 text-ink-danger hover:bg-red-50 font-semibold rounded-sm uppercase disabled:opacity-50">Log Out of Other Devices</button>
      </div>
    </div>
  );
}


export default function AdminPage() {
  const dispatch = useDispatch();
  const { user, sessionChecked } = useSelector((s) => s.auth);
  const authFetch = useAuthFetch();
  const [section, setSection] = useState('home');
  const [sectionTab, setSectionTab] = useState('');

  const navigateAdmin = useCallback((requestedSection, requestedTab = '') => {
    const legacy = LEGACY_ADMIN_ROUTES[requestedSection];
    const nextSection = legacy?.section || (ADMIN_SECTION_KEYS.has(requestedSection) ? requestedSection : 'home');
    const nextTab = requestedTab || legacy?.tab || '';
    setSection(nextSection);
    setSectionTab(nextTab);
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams();
      params.set('section', nextSection);
      if (nextTab) params.set('tab', nextTab);
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      navigateAdmin(params.get('section') || 'home', params.get('tab') || '');
    }
  }, [navigateAdmin]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [regions, setRegions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);

  // Lock body scroll while mobile drawer is open
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const prev = document.body.style.overflow;
    if (mobileMenuOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [mobileMenuOpen]);
  // Auto-close drawer when section changes
  useEffect(() => { setMobileMenuOpen(false); }, [section]);
  useEffect(() => {
    if (!user) return;
    authFetch('/api/admin/regions/').then((r) => r.json()).then((d) => setRegions(Array.isArray(d) ? d : d.results || [])).catch(() => setRegions([]));
    authFetch('/api/admin/categories/').then((r) => r.json()).then((d) => setCategories(Array.isArray(d) ? d : d.results || [])).catch(() => setCategories([]));
    authFetch('/api/admin/products/').then((r) => r.json()).then((d) => setProducts(Array.isArray(d) ? d : d.results || [])).catch(() => setProducts([]));
  }, [user, authFetch]);

  const isAdmin = user && (user.is_staff || user.is_superuser);

  if (!sessionChecked) {
    return <StoreShell showFooter={false}><div className="mx-auto max-w-2xl px-4 py-20 text-center text-sm text-ink-muted">Checking your session…</div></StoreShell>;
  }

  if (!user) {
    return (
      <StoreShell showFooter={false}>
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-brand-muted" />
          <h1 className="mb-2 text-xl font-semibold text-ink-primary">Admin access</h1>
          <p className="mb-4 text-sm text-brand-muted">Please log in with an administrator account.</p>
          <Link href="/account" className="btn-primary inline-flex px-5 py-2.5 text-sm uppercase">Go to login</Link>
        </div>
      </StoreShell>
    );
  }
  if (!isAdmin) {
    return (
      <StoreShell showFooter={false}>
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-brand-danger" />
          <h1 className="mb-2 text-xl font-semibold text-ink-primary">Not authorised</h1>
          <p className="text-sm text-brand-muted">Your account ({user.email}) does not have admin access.</p>
        </div>
      </StoreShell>
    );
  }

  const active = NAV.find((n) => n.key === section);

  const SidebarContent = ({ isMobile = false, onClose = () => {} }) => (
    <div className="flex flex-col h-full">
      <div className="mb-3 flex items-center gap-2 px-2 pb-3 border-b border-edge-subtle">
        <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-ink-primary text-white">
          <LayoutDashboard className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <span className="block text-sm font-semibold text-ink-primary">Admin</span>
          <span className="block text-[12px] text-brand-muted">Sclero Proteins</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className="mb-1">
            {group.title && (
              <p className="kicker px-2 pb-1 pt-3">{group.title}</p>
            )}
            {group.items.map((n) => (
              <button key={n.key} onClick={() => { navigateAdmin(n.key); if (isMobile) onClose(); }}
                className={`relative flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-[13px] font-medium transition-colors ${
                  section === n.key ? 'bg-surface-muted text-ink-primary' : 'text-ink-secondary hover:bg-surface-muted hover:text-ink-primary'
                }`}>
                {section === n.key && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-ink-primary" />}
                <n.icon className="h-4 w-4" /> {n.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <StoreShell showFooter={false}>
      <div className="flex min-h-[calc(100vh-92px)] bg-brand-bg relative">
        {/* Desktop Sidebar (Fixed Left) */}
        <aside className="hidden md:block w-64 border-r border-edge bg-white fixed left-0 top-[92px] bottom-0 z-30 p-4">
          <SidebarContent />
        </aside>

        {/* Mobile Sidebar Drawer Overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-surface-overlay backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />

            {/* Drawer Content */}
            <aside className="relative flex w-64 max-w-xs flex-col bg-white p-4 shadow-overlay z-10 h-full">
              <div className="absolute right-2 top-2">
                <button onClick={() => setMobileMenuOpen(false)} className="rounded-sm p-2 text-brand-muted hover:bg-surface-muted">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SidebarContent isMobile={true} onClose={() => setMobileMenuOpen(false)} />
            </aside>
          </div>
        )}

        {/* Main Content Pane */}
        <main className="flex-1 min-w-0 py-4 pr-4 pl-4 sm:py-6 sm:pr-6 sm:pl-6 lg:py-8 lg:pr-8 md:pl-[280px] lg:pl-[288px] space-y-6">
          {/* Top Control Bar for Mobile (sticky) */}
        <div className="sticky top-[92px] z-20 -mx-4 sm:-mx-6 mb-3 flex items-center justify-between gap-3 border-b border-edge bg-white/95 px-4 sm:px-6 py-2.5 backdrop-blur md:hidden">
          <button onClick={() => setMobileMenuOpen(true)} aria-label="Open admin menu" className="inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-sm border border-edge bg-white px-3 text-sm font-semibold text-ink-primary">
            <MenuIcon className="h-5 w-5" />
            <span className="sr-only sm:not-sr-only">Menu</span>
          </button>
          <span className="flex-1 truncate text-center text-sm font-semibold text-ink-primary capitalize">{active?.label}</span>
        </div>

          <div className="mb-6 hidden md:flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-ink-subtle mb-1">
                <button onClick={() => navigateAdmin('home')} className="hover:text-ink-primary transition cursor-pointer">Admin</button>
                <ChevronRight className="h-3 w-3" />
                <button onClick={() => navigateAdmin(section)} className="capitalize hover:text-ink-primary transition cursor-pointer">{active?.label || section}</button>
                {sectionTab && (
                  <>
                    <ChevronRight className="h-3 w-3" />
                    <span className="text-ink-primary font-bold capitalize">{sectionTab.replace(/_/g, ' ')}</span>
                  </>
                )}
              </div>
              <h1 className="mt-1 font-display font-medium text-[26px] text-ink-primary">{active?.label || section}</h1>
            </div>
          </div>

          {/* The eight sections. Former sidebar entries now live as tabs inside
              these (see the *Section wrappers above), so there is one obvious
              place to find each job. */}
          {section === 'home' && <DashboardSection authFetch={authFetch} go={navigateAdmin} initialTab={sectionTab} />}
          {section === 'orders' && <OrdersSection authFetch={authFetch} initialTab={sectionTab} />}
          {section === 'products' && <ProductsTab authFetch={authFetch} regions={regions} categories={categories} />}
          {section === 'categories' && <CollectionsTab authFetch={authFetch} />}
          {section === 'customers' && <CustomersSection authFetch={authFetch} />}
          {section === 'content' && <ContentOverviewTab authFetch={authFetch} go={navigateAdmin} />}
          {section === 'staff' && (
            <StaffSection
              authFetch={authFetch}
              regions={regions}
              user={user}
              onProfileSaved={() => dispatch(fetchProfile())}
              initialTab={sectionTab}
            />
          )}
          {section === 'settings' && <SettingsTab authFetch={authFetch} regions={regions} initialTab={sectionTab} />}

          {/* Content sub-pages, reached from the Content overview rather than
              the sidebar. */}
          {section === 'pages' && <PagesAndBannersTab authFetch={authFetch} initialTab={sectionTab} />}
          {section === 'blogs' && <BlogsTab authFetch={authFetch} />}
          {section === 'glossary' && <GlossaryTab authFetch={authFetch} />}
          {section === 'faq' && <FAQTab authFetch={authFetch} />}
          {section === 'navigation' && <NavigationTab authFetch={authFetch} regions={regions} />}
        </main>
      </div>
    </StoreShell>
  );
}
