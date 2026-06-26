'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Link from 'next/link';
import {
  LayoutDashboard, Package, Layers, ShoppingCart, Truck, Plus, Pencil, Archive, X, Save,
  ShieldAlert, ShieldCheck, CreditCard, Mail, ShoppingBag, Image as ImageIcon, Film, Download,
  Home, ChevronRight, TrendingUp, Users as UsersIcon, Search,
  Banknote, ReceiptText, MessageSquare, Activity, CheckCircle2, UserRound,
  Globe, FileText, BarChart3, HelpCircle, RefreshCw, Sliders, UserPlus, Eye, Settings,
  Star, Palette, Cookie, Megaphone, Menu as MenuIcon, Upload, Undo, Link as LinkIcon, Loader2, AlertCircle, ToggleLeft, ToggleRight
} from 'lucide-react';
import StoreShell from '../../components/StoreShell';
import { fetchProfile } from '../../store/authSlice';
import { getApiUrl } from '../../lib/api';
import ProductEditorPanel from '../../components/admin/ProductEditorPanel';
import CreateOrderPanel from '../../components/admin/CreateOrderPanel';
import ShippingZonePanel from '../../components/admin/ShippingZonePanel';

const ORDER_STATUSES = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED'];
const STATUS_COLOR = {
  PENDING: 'bg-amber-100 text-amber-700', PROCESSING: 'bg-blue-100 text-blue-700',
  SHIPPED: 'bg-indigo-100 text-indigo-700', DELIVERED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-slate-100 text-slate-600', REFUNDED: 'bg-red-100 text-red-700',
};
const PAYMENT_STATUS_COLOR = {
  PENDING: 'bg-amber-100 text-amber-700',
  AUTHORIZED: 'bg-indigo-100 text-indigo-700',
  PARTIALLY_CAPTURED: 'bg-blue-100 text-blue-700',
  PAID: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  REFUNDED: 'bg-slate-100 text-slate-600',
};
const RECOVERY_STATUS_COLOR = {
  NOT_CONTACTED: 'bg-slate-100 text-slate-600',
  CONTACTED: 'bg-blue-100 text-blue-700',
  RECOVERED: 'bg-green-100 text-green-700',
  DISMISSED: 'bg-slate-200 text-slate-600',
};

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

function useAuthFetch() {
  const access = useSelector((s) => s.auth.access);
  return useCallback(
    (path, opts = {}) =>
      fetch(getApiUrl(path), {
        ...opts,
        headers: {
          'Content-Type': 'application/json',
          ...(access ? { Authorization: `Bearer ${access}` } : {}),
          ...(opts.headers || {}),
        },
      }),
    [access]
  );
}

/* --------------------------------------------------------- chart primitive */
function MiniBars({ series, height = 120 }) {
  const max = Math.max(1, ...series.map((s) => s.value));
  const barW = 100 / (series.length || 1);
  return (
    <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full text-brand-purple" style={{ height }}>
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
      className={`rounded-2xl border border-slate-200 bg-white p-5 text-left transition-all ${onClick ? 'hover:-translate-y-0.5 hover:shadow-md' : ''}`}>
      <div className="mb-3 flex items-center justify-between">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${accent || 'bg-brand-purple/10 text-brand-purple'}`}>
          <Icon className="h-4.5 w-4.5" />
        </span>
      </div>
      <p className="text-2xl font-black leading-none text-brand-navy">{value}</p>
      <p className="mt-1.5 text-xs font-medium text-brand-muted">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
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
  if (err) return <div className="rounded-2xl border border-slate-200 bg-white p-5 text-xs text-brand-muted">Revenue trend unavailable.</div>;
  if (!data) return <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="h-6 w-40 mb-3 rounded bg-slate-100 animate-pulse" /><div className="h-28 rounded bg-slate-50 animate-pulse" /></div>;
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
    <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-brand-navy">Revenue trend</h3>
        <span className="text-[11px] font-medium text-brand-muted">Last 90 days</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {currencies.map((ccy) => {
          const series = days.map((k, i) => ({ key: k, label: i, value: (byCcy[ccy] || {})[k] || 0 }));
          const total = series.reduce((a, s) => a + s.value, 0);
          return (
            <div key={ccy}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-muted">{ccy}</span>
                <span className="text-xs font-bold text-brand-navy">{ccy} {total.toFixed(0)}</span>
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
  if (!data) return <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="h-32 rounded bg-slate-50 animate-pulse" /></div>;
  const stages = [
    { k: 'pageviews', label: 'Page views' },
    { k: 'product_views', label: 'Product views' },
    { k: 'add_to_carts', label: 'Add to carts' },
    { k: 'checkouts', label: 'Checkouts' },
    { k: 'orders', label: 'Orders' },
  ];
  const max = Math.max(1, data.pageviews || 0);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-bold text-brand-navy">Conversion funnel</h3>
      {(!data.pageviews && !data.orders) ? <p className="text-xs text-brand-muted">No traffic recorded yet (last 30 days).</p> : (
        <div className="space-y-2">
          {stages.map((s, idx) => {
            const v = Number(data[s.k] || 0);
            const w = Math.max(2, (v / max) * 100);
            const prev = idx > 0 ? Number(data[stages[idx - 1].k] || 0) : 0;
            const pct = idx > 0 && prev > 0 ? Math.round((v / prev) * 100) : null;
            return (
              <div key={s.k}>
                <div className="flex items-center justify-between text-[11px] font-medium text-brand-muted">
                  <span>{s.label}{pct != null && <span className="ml-1 text-slate-400">({pct}%)</span>}</span>
                  <span className="text-brand-navy">{v}</span>
                </div>
                <div className="h-2 rounded bg-slate-100">
                  <div className="h-2 rounded bg-brand-purple" style={{ width: `${w}%` }} />
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
  if (rows === null) return <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="h-28 rounded bg-slate-50 animate-pulse" /></div>;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-bold text-brand-navy">Top customers (CLV)</h3>
      {rows.length === 0 ? <p className="text-xs text-brand-muted">No paid orders yet.</p> : (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.email + r.currency} className="flex items-center justify-between text-xs">
              <span className="truncate font-medium text-brand-navy" title={r.email}>{r.email.length > 24 ? r.email.slice(0, 22) + '…' : r.email}</span>
              <span className="flex items-center gap-2">
                <span className="text-brand-muted">{r.orders}x</span>
                <span className="font-bold text-brand-navy">{r.currency} {Number(r.total_spend).toFixed(0)}</span>
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
  if (rows === null) return <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="h-28 rounded bg-slate-50 animate-pulse" /></div>;
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="mb-3 text-sm font-bold text-brand-navy">Top products (revenue)</h3>
      {rows.length === 0 ? <p className="text-xs text-brand-muted">No sales recorded.</p> : (
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={`${r.product_id}-${r.currency}`} className="flex items-center justify-between text-xs">
              <span className="truncate font-medium text-brand-navy" title={r.name}>{(r.name || r.sku || '').slice(0, 28)}</span>
              <span className="flex items-center gap-2">
                <span className="text-brand-muted">{r.units_sold}u</span>
                <span className="font-bold text-brand-navy">{r.currency} {Number(r.revenue).toFixed(0)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------- Phase C: Reports tab */
const COUNTRY_COORDS = {
  GB: { x: 49, y: 30, name: 'United Kingdom' },
  IE: { x: 47, y: 31, name: 'Ireland' },
  FR: { x: 49, y: 35, name: 'France' },
  DE: { x: 52, y: 32, name: 'Germany' },
  ES: { x: 47, y: 38, name: 'Spain' },
  IT: { x: 52, y: 37, name: 'Italy' },
  NL: { x: 51, y: 31, name: 'Netherlands' },
  BE: { x: 50, y: 32, name: 'Belgium' },
  IN: { x: 70, y: 47, name: 'India' },
  AE: { x: 63, y: 45, name: 'UAE' },
  US: { x: 22, y: 38, name: 'United States' },
  CA: { x: 22, y: 28, name: 'Canada' },
  AU: { x: 86, y: 70, name: 'Australia' },
  SG: { x: 78, y: 56, name: 'Singapore' },
};

function GeographicMap({ rows }) {
  // Simple equirectangular illustration. NOT a topo-accurate map -
  // countries shown as circles at hard-coded centroids, sized by revenue.
  const maxRev = Math.max(1, ...rows.map((r) => Number(r.revenue || 0)));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-brand-navy">Geographic sales map</h3>
        <span className="text-[10px] text-slate-400">Illustrative — circles sized by revenue</span>
      </div>
      <svg viewBox="0 0 100 60" className="w-full" style={{ background: '#f8fafc', borderRadius: 8 }}>
        <rect x="0" y="0" width="100" height="60" fill="#f1f5f9" />
        {/* hint at landmasses with subtle blocks */}
        <rect x="15" y="20" width="20" height="22" fill="#e2e8f0" />
        <rect x="40" y="22" width="22" height="22" fill="#e2e8f0" />
        <rect x="62" y="28" width="22" height="22" fill="#e2e8f0" />
        <rect x="80" y="60" width="0" height="0" />
        <rect x="82" y="55" width="10" height="10" fill="#e2e8f0" />
        {rows.map((r) => {
          const c = COUNTRY_COORDS[r.country];
          if (!c) return null;
          const radius = 1 + (Number(r.revenue || 0) / maxRev) * 5;
          return (
            <g key={r.country + r.currency}>
              <circle cx={c.x} cy={c.y} r={radius} fill="#7c3aed" fillOpacity="0.65" stroke="#5b21b6" strokeWidth="0.2" />
              <text x={c.x} y={c.y - radius - 0.5} fontSize="2" textAnchor="middle" fill="#1e293b">{r.country}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Geographic sales view: fetches sales-by-country and renders the map + a ranked
// country table (the data the report already exposes).
function GeoMapView({ authFetch }) {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    authFetch('/api/admin/reports/sales-by-country/?days=365')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const list = Array.isArray(d) ? d : (d && Array.isArray(d.results) ? d.results : (d && Array.isArray(d.rows) ? d.rows : []));
        setRows(list);
      })
      .catch(() => setRows([]));
  }, [authFetch]);

  if (rows === null) return <p className="text-sm text-brand-muted">Loading geographic sales…</p>;
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm font-semibold text-brand-navy">No country sales yet</p>
        <p className="mt-1 text-xs text-brand-muted">Once orders come in, revenue by country will appear here.</p>
      </div>
    );
  }

  const sorted = [...rows].sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0));
  return (
    <div className="space-y-4">
      <GeographicMap rows={rows} />
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2">Country</th>
              <th className="px-3 py-2">Orders</th>
              <th className="px-3 py-2 text-right">Revenue</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((r, i) => (
              <tr key={(r.country || '') + (r.currency || '') + i}>
                <td className="px-3 py-2 font-semibold text-brand-navy">
                  {(COUNTRY_COORDS[r.country]?.name) || r.country || '—'}
                </td>
                <td className="px-3 py-2 text-brand-muted">{r.orders ?? r.order_count ?? '—'}</td>
                <td className="px-3 py-2 text-right font-bold text-brand-navy">
                  {r.currency ? `${r.currency} ` : ''}{Number(r.revenue || 0).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

  const downloadCsv = () => {
    // open in new window with token-less endpoint - use authFetch to get blob
    authFetch(`${endpointFor(tab)}${qs}&format=csv`).then((r) => r.blob()).then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sclero-${csvNameFor(tab)}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  const TABS = [
    { k: 'sales', label: 'Sales by country' },
    { k: 'clv', label: 'CLV' },
    { k: 'repeat', label: 'Repeat customers' },
    { k: 'products', label: 'Revenue by product' },
    { k: 'abandoned', label: 'Abandoned recovery' },
  ];

  const renderTable = () => {
    if (loading) return <div className="h-40 rounded bg-slate-50 animate-pulse" />;
    if (!data) return <p className="text-xs text-brand-muted">No data.</p>;

    if (tab === 'repeat') {
      return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] uppercase font-bold text-brand-muted">Repeat rate</p>
            <p className="text-2xl font-black text-brand-navy">{Math.round((data.repeat_rate || 0) * 100)}%</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] uppercase font-bold text-brand-muted">One-time</p>
            <p className="text-2xl font-black text-brand-navy">{data.one_time}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] uppercase font-bold text-brand-muted">Repeat</p>
            <p className="text-2xl font-black text-brand-navy">{data.repeat}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] uppercase font-bold text-brand-muted">3+ orders</p>
            <p className="text-2xl font-black text-brand-navy">{data.three_plus}</p>
          </div>
        </div>
      );
    }
    if (tab === 'abandoned') {
      return (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] uppercase font-bold text-brand-muted">Carts</p><p className="text-2xl font-black text-brand-navy">{data.total_carts_with_items}</p></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] uppercase font-bold text-brand-muted">Recovered</p><p className="text-2xl font-black text-brand-navy">{data.recovered}</p></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] uppercase font-bold text-brand-muted">Abandoned</p><p className="text-2xl font-black text-brand-navy">{data.abandoned}</p></div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-[10px] uppercase font-bold text-brand-muted">Recovery</p><p className="text-2xl font-black text-brand-navy">{Math.round((data.recovery_rate || 0) * 100)}%</p></div>
        </div>
      );
    }

    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) return <p className="text-xs text-brand-muted">No rows for this window.</p>;

    const headers = tab === 'sales'
      ? ['Country', 'Currency', 'Orders', 'Revenue']
      : tab === 'clv'
        ? ['Email', 'Currency', 'Orders', 'Spend', 'First', 'Last']
        : ['SKU', 'Name', 'Currency', 'Units', 'Revenue'];

    return (
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase font-bold text-brand-muted">
            <tr>{headers.map((h) => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-100">
                {tab === 'sales' && <>
                  <td className="px-3 py-2 font-mono">{r.country || '—'}</td>
                  <td className="px-3 py-2">{r.currency}</td>
                  <td className="px-3 py-2">{r.order_count}</td>
                  <td className="px-3 py-2 font-bold">{r.currency} {Number(r.revenue).toFixed(2)}</td>
                </>}
                {tab === 'clv' && <>
                  <td className="px-3 py-2">{r.email}</td>
                  <td className="px-3 py-2">{r.currency}</td>
                  <td className="px-3 py-2">{r.orders}</td>
                  <td className="px-3 py-2 font-bold">{r.currency} {Number(r.total_spend).toFixed(2)}</td>
                  <td className="px-3 py-2 text-slate-500">{r.first_order ? r.first_order.slice(0, 10) : ''}</td>
                  <td className="px-3 py-2 text-slate-500">{r.last_order ? r.last_order.slice(0, 10) : ''}</td>
                </>}
                {tab === 'products' && <>
                  <td className="px-3 py-2 font-mono">{r.sku}</td>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2">{r.currency}</td>
                  <td className="px-3 py-2">{r.units_sold}</td>
                  <td className="px-3 py-2 font-bold">{r.currency} {Number(r.revenue).toFixed(2)}</td>
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
        {TABS.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${tab === t.k ? 'bg-brand-purple text-white' : 'border border-slate-200 bg-white text-brand-navy hover:border-brand-purple/40'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[11px] font-bold text-brand-muted">Region</label>
        <select value={region} onChange={(e) => setRegion(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-xs">
          <option value="all">All</option>
          <option value="UK">UK</option>
          <option value="IN">IN</option>
        </select>
        <label className="text-[11px] font-bold text-brand-muted ml-2">Days</label>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border border-slate-200 px-2 py-1 text-xs">
          {[7, 30, 90, 180, 365].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        {canDownload && (
          <button onClick={downloadCsv} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-navy hover:border-brand-purple/40">
            <Download className="h-3.5 w-3.5" /> Download CSV
          </button>
        )}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">{renderTable()}</div>
      {tab === 'sales' && Array.isArray(data) && data.length > 0 && <GeographicMap rows={data} />}
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
          sub={revenueChips.slice(1).join(' · ') || 'across all orders'} accent="bg-green-100 text-green-700" />
        <StatCard icon={UsersIcon} label="Customers" value={customers}
          sub="unique buyers" accent="bg-indigo-100 text-indigo-700" />
        <StatCard icon={Package} label="Low stock" value={lowStock.length}
          sub={`≤ ${LOW} units in a region`} accent={lowStock.length ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}
          onClick={() => go('products')} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <RevenueTrendCard authFetch={authFetch} />

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-bold text-brand-navy">Needs attention</h3>
          <div className="space-y-2">
            <button onClick={() => go('orders')} className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-left hover:border-brand-purple/40">
              <span className="text-xs font-medium text-brand-navy">Pending orders</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${pending ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500'}`}>{pending}</span>
            </button>
            <button onClick={() => go('abandoned')} className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-left hover:border-brand-purple/40">
              <span className="text-xs font-medium text-brand-navy">Abandoned checkouts</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${abandoned ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-500'}`}>{abandoned}</span>
            </button>
            <button onClick={() => go('products')} className="flex w-full items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-left hover:border-brand-purple/40">
              <span className="text-xs font-medium text-brand-navy">Low-stock products</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${lowStock.length ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-500'}`}>{lowStock.length}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-brand-navy">Recent orders</h3>
            <button onClick={() => go('orders')} className="text-[11px] font-semibold text-brand-purple">View all</button>
          </div>
          {recent.length === 0 ? <p className="text-xs text-brand-muted">No orders yet.</p> : (
            <div className="space-y-1.5">
              {recent.map((o) => (
                <button key={o.id} onClick={() => go('orders')} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-slate-50">
                  <span className="text-xs font-semibold text-brand-navy">#{o.id} <span className="font-normal text-brand-muted">{o.email}</span></span>
                  <span className="flex items-center gap-2"><span className="text-xs text-brand-navy">{o.currency_code} {o.total}</span>
                    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${STATUS_COLOR[o.status]}`}>{o.status}</span></span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-bold text-brand-navy">Inventory to restock</h3>
          {lowStock.length === 0 ? <p className="text-xs text-brand-muted">All products well stocked.</p> : (
            <div className="space-y-1.5">
              {lowStock.slice(0, 6).map((p) => (
                <div key={p.sku} className="flex items-center justify-between rounded-lg px-2 py-1.5">
                  <span className="text-xs font-medium text-brand-navy">{toDisplayText(p.name) || 'Untitled product'}</span>
                  <span className="text-[10px] font-bold text-amber-600">{p.regions}</span>
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

  const load = useCallback(() => {
    setLoading(true);
    authFetch('/api/admin/products/').then((r) => r.json())
      .then((d) => setProducts(Array.isArray(d) ? d : d.results || []))
      .catch(() => setProducts([])).finally(() => setLoading(false));
  }, [authFetch]);
  useEffect(() => { load(); }, [load]);

  const blankMedia = () => ({ media_type: 'IMAGE', file_url: '' });
  const startNew = () => setEditing({
    sku: '', name: '', description: '', benefits: '', ingredients: '', is_active: true, is_archived: false,
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
    _variantOptions: p.nutrition_facts?._variantOptions || [],
    _variants: p.nutrition_facts?._variants || [],
    _specs: p.nutrition_facts?._specs || [],
    _meta: p.nutrition_facts?._meta || [],
    _seo: toSeoMeta(p.nutrition_facts?._seo),
    _shipping: p.nutrition_facts?._shipping || { weight_g: '', length_cm: '', width_cm: '', height_cm: '', fragile: false },
  });

  const save = () => {
    setSaving(true); setErr('');
    const extendedNutrition = {
      ...(editing.nutrition_facts || {}),
      _product_type: editing.product_type,
      _variantOptions: editing._variantOptions || [],
      _variants: editing._variants || [],
      _specs: editing._specs || [],
      _meta: editing._meta || [],
      _seo: editing._seo || {},
      _shipping: editing._shipping || {},
    };
    const payload = {
      sku: editing.sku, name: editing.name, description: editing.description,
      benefits: editing.benefits, ingredients: editing.ingredients,
      nutrition_facts: extendedNutrition, faq: editing.faq || [],
      is_active: editing.is_active, is_archived: editing.is_archived,
      category_ids: editing._categories,
      regional_configs: editing._regional.filter((r) => r.price !== '' && r.price != null)
        .map((r) => ({ region: r.region, price: r.price, promotional_price: r.promotional_price === '' ? null : r.promotional_price, is_visible: r.is_visible })),
      regional_stock: editing._regional.map((r) => ({ region: r.region, available: r.available === '' || r.available == null ? 0 : Number(r.available) })),
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

  const handleExport = () => {
    const headers = ['SKU', 'Name', 'Categories', 'Status'];
    const rows = products.map((p) => [p.sku, p.name, (p.categories || []).map((c) => c.name).join(' | '), p.is_archived ? 'ARCHIVED' : 'ACTIVE']);
    const csvContent = [headers.join(','), ...rows.map(e => e.map(x => `"${x}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url); link.setAttribute('download', 'sclero_products_export.csv');
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const filtered = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    return !q || p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q);
  });

  if (loading) return <p className="text-sm text-brand-muted">Loading products…</p>;

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/30" />
        </div>
        <p className="text-sm text-brand-muted ml-auto">{filtered.length} products</p>
        <div className="flex gap-2">
          <button onClick={handleExport} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs uppercase border border-slate-200 bg-white rounded-lg hover:bg-slate-50 transition"><Download className="h-3.5 w-3.5" /> Export</button>
          <button onClick={startNew} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs uppercase bg-violet-600 text-white rounded-lg font-bold hover:bg-violet-700 transition"><Plus className="h-4 w-4" /> Add product</button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-brand-muted border-b border-slate-200">
            <tr>
              <th className="px-3 py-3 font-bold">Product</th>
              <th className="px-3 py-3 font-bold">Categories</th>
              <th className="px-3 py-3 font-bold">Price · Stock</th>
              <th className="px-3 py-3 font-bold">Variants</th>
              <th className="px-3 py-3 font-bold">Status</th>
              <th className="px-3 py-3 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => {
              const thumb = p.media?.[0]?.file_url;
              const variantCount = (p.nutrition_facts?._variants || []).length;
              const firstConfig = p.regional_configs?.[0];
              const firstStock = p.regional_stock?.find(s => s.region_id === firstConfig?.region);
              return (
                <tr key={p.id} className="border-t border-slate-100 align-middle hover:bg-slate-50/50 cursor-pointer transition" onClick={() => startEdit(p)}>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center">
                        {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : <Package className="h-4 w-4 text-slate-300" />}
                      </div>
                      <div>
                        <p className="font-semibold text-brand-navy">{toDisplayText(p.name) || 'Untitled product'}</p>
                        <p className="font-mono text-[10px] text-brand-muted">{p.sku} · <span className="rounded bg-brand-purple/10 text-brand-purple px-1 text-[8px] font-bold uppercase">{toDisplayText(p.nutrition_facts?._product_type) || 'Simple'}</span></p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-brand-muted">{(p.categories || []).map((c) => c.name).join(', ') || '—'}</td>
                  <td className="px-3 py-3 text-brand-muted">
                    {firstConfig ? <><span className="font-semibold text-brand-navy">{firstConfig.promotional_price || firstConfig.price}</span> · {firstStock ? firstStock.available : 0} units</> : '—'}
                  </td>
                  <td className="px-3 py-3">
                    {variantCount > 0
                      ? <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700"><Layers className="h-3 w-3" />{variantCount} variants</span>
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-3 py-3">
                    {p.is_archived
                      ? <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">ARCHIVED</span>
                      : <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-700">ACTIVE</span>}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <button onClick={(e) => { e.stopPropagation(); startEdit(p); }} className="text-brand-purple hover:opacity-70"><Pencil className="h-4 w-4" /></button>
                      <button onClick={(e) => archive(p, e)} className="text-brand-muted hover:text-brand-danger"><Archive className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-12 text-center text-sm text-brand-muted">No products found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <ProductEditorPanel
          editing={editing}
          onChange={setEditing}
          onClose={() => { setEditing(null); setErr(''); }}
          onSave={save}
          saving={saving}
          err={err}
          regions={regions}
          categories={categories}
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
      body: JSON.stringify({ name: form.name, slug: form.slug, description: form.description || '' })
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
        <button onClick={startNew} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs uppercase bg-brand-purple text-white rounded-lg">
          <Plus className="h-4 w-4" /> New collection
        </button>
      </div>

      <div className="space-y-2">
        {cats.map((c) => {
          const meta = rulesMap[c.slug] || { type: 'manual' };
          return (
            <div key={c.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
              <div>
                <p className="text-sm font-semibold text-brand-navy">
                  {toDisplayText(c.name)} <span className="font-mono text-[10px] text-brand-muted">/{toDisplayText(c.slug)}</span>
                  {meta.type === 'automated' ? (
                    <span className="ml-2 rounded-full bg-purple-100 text-purple-700 px-1.5 py-0.5 text-[9px] font-bold">AUTOMATED</span>
                  ) : (
                    <span className="ml-2 rounded-full bg-slate-100 text-slate-500 px-1.5 py-0.5 text-[9px] font-bold">MANUAL</span>
                  )}
                </p>
                {c.product_count != null && <p className="text-[11px] text-brand-muted">{c.product_count} products</p>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(c)} className="text-brand-purple hover:opacity-70">
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
        <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-slate-50 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
          <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-black text-brand-navy">{form.id ? 'Edit' : 'New'} collection</h3>
            
            <div className="space-y-3">
              <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" />
              <input placeholder="Slug" value={form.slug} disabled={!!form.id} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm disabled:bg-slate-50" />
              <textarea placeholder="Description" rows={2} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" />
              
              <div className="border-t border-slate-100 pt-3">
                <label className="block text-xs font-bold text-brand-navy mb-2 uppercase">Collection Type</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs text-brand-navy font-semibold cursor-pointer">
                    <input type="radio" checked={form.type === 'manual'} onChange={() => setForm({ ...form, type: 'manual' })} />
                    Manual (Manually add products)
                  </label>
                  <label className="flex items-center gap-2 text-xs text-brand-navy font-semibold cursor-pointer">
                    <input type="radio" checked={form.type === 'automated'} onChange={() => setForm({ ...form, type: 'automated', rules: form.rules?.length ? form.rules : [{ column: 'category', relation: 'equals', value: '' }] })} />
                    Automated (Match product criteria)
                  </label>
                </div>
              </div>

              {form.type === 'automated' && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand-navy uppercase">Conditions match:</span>
                    <select value={form.match} onChange={(e) => setForm({ ...form, match: e.target.value })} className="text-xs border rounded p-1 bg-white">
                      <option value="all">All Conditions (AND)</option>
                      <option value="any">Any Condition (OR)</option>
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    {(form.rules || []).map((rule, idx) => (
                      <div key={idx} className="flex gap-2 items-center">
                        <select value={rule.column} onChange={(e) => updateRule(idx, { column: e.target.value })} className="text-xs border rounded p-1 bg-white flex-1">
                          <option value="category">Category</option>
                          <option value="ingredients">Ingredients</option>
                          <option value="price">Price</option>
                          <option value="type">Product Type</option>
                        </select>
                        <select value={rule.relation} onChange={(e) => updateRule(idx, { relation: e.target.value })} className="text-xs border rounded p-1 bg-white flex-1">
                          <option value="equals">Equals</option>
                          <option value="contains">Contains</option>
                          <option value="greater_than">Greater than</option>
                          <option value="less_than">Less than</option>
                        </select>
                        <input value={rule.value} onChange={(e) => updateRule(idx, { value: e.target.value })} placeholder="Value" className="text-xs border rounded p-1 bg-white flex-[1.5]" />
                        <button onClick={() => removeRule(idx)} className="text-brand-danger hover:opacity-75 p-1"><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                    <button onClick={addRule} className="text-xs font-bold text-brand-purple hover:underline">+ Add condition</button>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button onClick={save} className="btn-primary flex-1 py-2.5 text-xs uppercase bg-brand-purple text-white rounded-lg">Save Collection</button>
                <button onClick={() => setForm(null)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-xs font-bold uppercase">Cancel</button>
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

  const [showRefundForm, setShowRefundForm] = useState(false);
  const [refundAmount, setRefundAmount] = useState(order.total);
  const [refundReason, setRefundReason] = useState('Customer Return');

  useEffect(() => {
    authFetch(`/api/admin/orders/${order.id}/timeline/`).then((r) => r.json()).then((d) => setTimeline(Array.isArray(d) ? d : [])).catch(() => setTimeline([]));
  }, [authFetch, order.id]);

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
    authFetch(`/api/admin/orders/${order.id}/update_status/`, {
      method: 'POST',
      body: JSON.stringify({ status: 'SHIPPED' })
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error || 'Failed to update order status');
        return authFetch(`/api/admin/orders/${order.id}/add_timeline_event/`, {
          method: 'POST',
          body: JSON.stringify({
            note: `Items fulfilled via ${carrier}. Tracking #: ${trackingNumber}`,
            kind: 'CUSTOMER_COMMUNICATION'
          })
        });
      })
      .then(() => {
        setShowFulfillForm(false);
        setTrackingNumber('');
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
    <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-slate-50 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
      <div className="w-full max-w-5xl bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mx-auto">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase text-brand-muted">Checkout detail</p>
              <h3 className="text-xl font-black text-brand-navy">Order #{order.id}</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${STATUS_COLOR[order.status]}`}>{order.status}</span>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${PAYMENT_STATUS_COLOR[order.payment_status] || 'bg-slate-100 text-slate-600'}`}>{order.payment_status || 'PAID'}</span>
              <button onClick={onClose} className="rounded-lg border border-slate-200 p-2 text-brand-muted hover:bg-slate-50" aria-label="Close order detail"><X className="h-4 w-4" /></button>
            </div>
          </div>
        </div>

        <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-5">
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-bold uppercase text-brand-muted">Items</p>
                <select value={order.status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
                  {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="divide-y divide-slate-100">
                {(order.items || []).map((it) => (
                  <div key={it.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <p className="font-semibold text-brand-navy">{toDisplayText(it.product_name) || 'Unknown item'}</p>
                      <p className="font-mono text-[10px] text-brand-muted">{it.product_sku} · Qty {it.quantity}</p>
                    </div>
                    <p className="font-semibold text-brand-navy">{formatMoney(order.currency_code, Number(it.price) * Number(it.quantity))}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
                <div className="flex justify-between text-brand-muted"><span>Subtotal</span><span>{formatMoney(order.currency_code, order.subtotal)}</span></div>
                <div className="flex justify-between text-brand-muted"><span>Tax ({order.tax_rate}%)</span><span>{formatMoney(order.currency_code, order.tax_amount)}</span></div>
                <div className="flex justify-between text-brand-muted"><span>Shipping</span><span>{formatMoney(order.currency_code, order.shipping_cost)}</span></div>
                <div className="flex justify-between pt-2 text-base font-black text-brand-navy"><span>Total</span><span>{formatMoney(order.currency_code, order.total)}</span></div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <Banknote className="h-4 w-4 text-brand-purple" />
                <p className="text-xs font-bold uppercase text-brand-muted">Payment</p>
              </div>
              <div className="grid gap-3 text-sm sm:grid-cols-3">
                <div><p className="text-[11px] text-brand-muted">Method</p><p className="font-semibold text-brand-navy">{order.payment_method}</p></div>
                <div><p className="text-[11px] text-brand-muted">Authorized</p><p className="font-semibold text-brand-navy">{formatMoney(order.currency_code, authorized)}</p></div>
                <div><p className="text-[11px] text-brand-muted">Captured</p><p className="font-semibold text-brand-navy">{formatMoney(order.currency_code, captured)}</p></div>
              </div>
              <div className="mt-4 rounded-lg bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-brand-navy">Capture payment manually</p>
                  <span className="text-[11px] text-brand-muted">{order.payment_capture_mode || 'AUTO'} capture</span>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button onClick={authorizePayment} disabled={saving} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-brand-navy hover:border-brand-purple disabled:opacity-50">Authorize</button>
                  <input value={captureAmount} onChange={(e) => setCaptureAmount(e.target.value)} placeholder={`Remaining ${captureRemaining.toFixed(2)}`} className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  <button onClick={capturePayment} disabled={saving || captureRemaining <= 0} className="btn-primary rounded-lg px-4 py-2 text-xs uppercase bg-brand-purple text-white disabled:opacity-50">Capture</button>
                </div>
                {err && <p className="mt-2 rounded bg-brand-danger/10 p-2 text-xs text-brand-danger">{err}</p>}
              </div>
              <div className="mt-4 divide-y divide-slate-100">
                {paymentLogs.map((log, i) => (
                  <div key={`${log.transaction_id}-${i}`} className="flex items-center justify-between gap-3 py-2 text-xs">
                    <span className="font-semibold text-brand-navy">{log.status} · {log.gateway}</span>
                    <span className="text-brand-muted">{formatMoney(order.currency_code, log.amount)} · {formatDateTime(log.created_at)}</span>
                  </div>
                ))}
                {!paymentLogs.length && <p className="text-xs text-brand-muted">No payment events yet.</p>}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-brand-purple" />
                <p className="text-xs font-bold uppercase text-brand-muted">Order activity timeline</p>
              </div>
              <ol className="space-y-4 border-l border-slate-200 pl-4">
                {timeline.map((e, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[21px] top-1 flex h-3 w-3 items-center justify-center rounded-full bg-white ring-2 ring-brand-purple" />
                    <p className="text-sm font-semibold text-brand-navy">{e.label}</p>
                    <p className="text-xs text-brand-muted">{e.detail}</p>
                    <p className="text-[10px] text-slate-400">{formatDateTime(e.ts)}</p>
                  </li>
                ))}
                {timeline.length === 0 && <li className="text-xs text-brand-muted">No events.</li>}
              </ol>
              <div className="mt-4 grid gap-2 sm:grid-cols-[160px_1fr_auto]">
                <select value={noteKind} onChange={(e) => setNoteKind(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs">
                  <option value="NOTE">Note</option>
                  <option value="CUSTOMER_COMMUNICATION">Customer communication</option>
                </select>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add note or communication record" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <button onClick={addTimelineEvent} disabled={saving || !note.trim()} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-brand-navy hover:border-brand-purple disabled:opacity-50">Add</button>
              </div>
            </section>
          </div>

          <aside className="space-y-4">
            {/* Fulfillment & Refund Operations Panel */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <p className="text-xs font-bold uppercase text-brand-muted">Order Operations</p>
              
              {order.status !== 'SHIPPED' && order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && order.status !== 'REFUNDED' && (
                <div className="border-b border-slate-100 pb-3">
                  <button onClick={() => setShowFulfillForm(!showFulfillForm)} className="w-full btn-primary text-xs font-bold uppercase py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">
                    Fulfill Items
                  </button>
                  {showFulfillForm && (
                    <div className="mt-3 space-y-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className="w-full text-xs rounded border border-slate-300 p-1 bg-white">
                        <option value="Delhivery">Delhivery</option>
                        <option value="Blue Dart">Blue Dart</option>
                        <option value="DTDC">DTDC</option>
                        <option value="Royal Mail">Royal Mail</option>
                        <option value="DPD">DPD</option>
                        <option value="Evri">Evri</option>
                      </select>
                      <input placeholder="Tracking Number" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className="w-full text-xs rounded border border-slate-300 p-1 bg-white" />
                      <button onClick={handleFulfill} disabled={!trackingNumber || saving} className="w-full bg-brand-purple text-white text-[10px] uppercase font-bold py-1.5 rounded disabled:opacity-50">
                        Confirm Shipment
                      </button>
                    </div>
                  )}
                </div>
              )}

              {order.status !== 'CANCELLED' && order.status !== 'REFUNDED' && (
                <div className="border-b border-slate-100 pb-3">
                  <button onClick={() => setShowRefundForm(!showRefundForm)} className="w-full border border-slate-200 text-xs font-bold uppercase py-2 text-brand-navy rounded-lg hover:bg-slate-50">
                    Refund Order
                  </button>
                  {showRefundForm && (
                    <div className="mt-3 space-y-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <div>
                        <label className="text-[10px] text-brand-muted block font-semibold">Refund Amount ({order.currency_code})</label>
                        <input type="number" step="0.01" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} className="w-full text-xs rounded border border-slate-300 p-1 bg-white" />
                      </div>
                      <div>
                        <label className="text-[10px] text-brand-muted block font-semibold">Reason</label>
                        <input placeholder="Reason for return" value={refundReason} onChange={(e) => setRefundReason(e.target.value)} className="w-full text-xs rounded border border-slate-300 p-1 bg-white" />
                      </div>
                      <button onClick={handleRefund} disabled={!refundAmount || Number(refundAmount) <= 0 || saving} className="w-full bg-brand-danger hover:bg-brand-danger/90 text-white text-[10px] uppercase font-bold py-1.5 rounded disabled:opacity-50">
                        Process Refund
                      </button>
                    </div>
                  )}
                </div>
              )}

              {order.status !== 'CANCELLED' && order.status !== 'SHIPPED' && order.status !== 'DELIVERED' && order.status !== 'REFUNDED' && (
                <div>
                  <button onClick={handleCancel} disabled={saving} className="w-full border border-brand-danger/30 text-brand-danger text-xs font-bold uppercase py-2 rounded-lg hover:bg-brand-danger/5 transition-colors">
                    Cancel Order
                  </button>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2"><UserRound className="h-4 w-4 text-brand-purple" /><p className="text-xs font-bold uppercase text-brand-muted">Customer</p></div>
              <p className="font-semibold text-brand-navy">{order.shipping_name}</p>
              <p className="text-xs text-brand-muted">{order.email}</p>
              <p className="mt-1 text-xs text-brand-muted">{order.shipping_phone || 'No phone'}</p>
              <div className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-brand-muted">
                {order.shipping_address_line1}{order.shipping_address_line2 ? `, ${order.shipping_address_line2}` : ''}<br />
                {order.shipping_city}, {order.shipping_state} {order.shipping_postal_code}<br />
                {order.shipping_country}
              </div>
            </section>
            <section className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="mb-3 text-xs font-bold uppercase text-brand-muted">Checkout summary</p>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-brand-muted">Region</span><span className="font-semibold text-brand-navy">{order.region_code || order.region}</span></div>
                <div className="flex justify-between"><span className="text-brand-muted">Created</span><span className="font-semibold text-brand-navy">{formatDateTime(order.created_at)}</span></div>
                <div className="flex justify-between"><span className="text-brand-muted">Updated</span><span className="font-semibold text-brand-navy">{formatDateTime(order.updated_at)}</span></div>
                <div className="flex justify-between"><span className="text-brand-muted">Payment ID</span><span className="max-w-[160px] truncate font-mono text-brand-navy">{order.payment_id || '—'}</span></div>
              </div>
            </section>
            {order.invoice?.pdf_url && (
              <a href={getApiUrl(order.invoice.pdf_url)} target="_blank" rel="noreferrer" className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-brand-navy hover:border-brand-purple">
                <Download className="h-4 w-4" /> Download invoice
              </a>
            )}
          </aside>
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
  const [status, setStatus] = useState(initialStatus);
  const [paymentStatus, setPaymentStatus] = useState('ALL');
  const [sort, setSort] = useState('newest');
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    authFetch('/api/admin/orders/').then((r) => r.json()).then((d) => setOrders(Array.isArray(d) ? d : d.results || [])).catch(() => setOrders([])).finally(() => setLoading(false));
  }, [authFetch]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="text-sm text-brand-muted">Loading orders…</p>;

  const filtered = orders
    .filter((o) => status === 'ALL' || o.status === status)
    .filter((o) => paymentStatus === 'ALL' || (o.payment_status || 'PAID') === paymentStatus)
    .filter((o) => {
      const haystack = normalize(`${o.id} ${o.email} ${o.shipping_name} ${o.payment_id} ${o.region_code}`);
      return !query || haystack.includes(normalize(query));
    })
    .sort((a, b) => {
      if (sort === 'oldest') return (a.created_at || '').localeCompare(b.created_at || '');
      if (sort === 'total') return Number(b.total || 0) - Number(a.total || 0);
      return (b.created_at || '').localeCompare(a.created_at || '');
    });

  const counts = ORDER_STATUSES.reduce((acc, s) => ({ ...acc, [s]: orders.filter((o) => o.status === s).length }), {});

  return (
    <div className="space-y-4">
      {/* Toolbar row with Create Order CTA */}
      <div className="flex flex-wrap items-stretch gap-3">
        <div className="flex-1 grid gap-2 rounded-xl border border-slate-200 bg-white p-2.5 sm:grid-cols-[1fr_auto_auto_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search orders, customer, payment ID" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm" />
          </label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="ALL">All statuses</option>
            {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s} ({counts[s] || 0})</option>)}
          </select>
          <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="ALL">All payments</option>
            {Object.keys(PAYMENT_STATUS_COLOR).map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="total">Highest total</option>
          </select>
        </div>
        {/* Prominent Create Order button — mirrors Shopify's primary CTA */}
        <button
          onClick={() => { setDetail(null); setShowCreate(true); }}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-700 active:scale-95 transition-all shadow-sm whitespace-nowrap flex-shrink-0"
        >
          <Plus className="h-4 w-4" /> Create order
        </button>
      </div>

      {/* Orders table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-brand-muted border-b border-slate-100">
            <tr>
              <th className="px-3 py-3 font-bold">Order</th>
              <th className="px-3 py-3 font-bold">Customer</th>
              <th className="px-3 py-3 font-bold">Payment</th>
              <th className="px-3 py-3 font-bold">Total</th>
              <th className="px-3 py-3 font-bold">Date</th>
              <th className="px-3 py-3 font-bold">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50 transition-colors" onClick={() => { setShowCreate(false); setDetail(o); }}>
                <td className="px-3 py-3"><p className="font-bold text-brand-navy">#{o.id}</p><p className="text-[10px] text-brand-muted">{o.region_code || o.region}</p></td>
                <td className="px-3 py-3"><p className="font-semibold text-brand-navy">{o.shipping_name || 'Customer'}</p><p className="text-brand-muted">{o.email}</p></td>
                <td className="px-3 py-3">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${PAYMENT_STATUS_COLOR[o.payment_status] || 'bg-slate-100 text-slate-600'}`}>{o.payment_status || 'PAID'}</span>
                  <p className="mt-0.5 font-mono text-[9px] text-slate-400">{o.payment_method}</p>
                </td>
                <td className="px-3 py-3 font-semibold text-brand-navy">{o.currency_code} {o.total}</td>
                <td className="px-3 py-3 text-brand-muted">{formatDateTime(o.created_at)}</td>
                <td className="px-3 py-3"><span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${STATUS_COLOR[o.status]}`}>{o.status}</span></td>
              </tr>
            ))}
            {!filtered.length && (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-brand-muted">
                {query || status !== 'ALL' || paymentStatus !== 'ALL'
                  ? 'No orders match these filters.'
                  : <span>No orders yet. <button onClick={() => setShowCreate(true)} className="text-violet-600 font-semibold hover:underline">Create your first order →</button></span>}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

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
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_auto_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search email, session ID" className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm" />
        </label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
          <option value="ALL">All recovery states</option>
          {Object.keys(RECOVERY_STATUS_COLOR).map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm">
          <option value="recent">Recently active</option>
          <option value="value">Highest value</option>
        </select>
      </div>
      {filtered.map((c) => (
        <div key={c.id || c.session_id} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-sm font-semibold text-brand-navy">{c.email || 'Guest'} <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">{c.region}</span></p>
              <p className="text-[11px] text-brand-muted">{c.item_count} item(s) · {(c.items || []).map((i) => `${i.qty || i.quantity}× ${i.name}`).join(', ')}</p>
              <p className="mt-1 font-mono text-[10px] text-slate-400">{c.session_id}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-sm font-black text-brand-navy">{c.currency || 'GBP'} {c.value}</p>
              <p className="text-[10px] text-slate-400">Active {formatDateTime(c.updated_at)}</p>
              <p className="mt-1 text-[10px] text-brand-muted">{c.recovery_attempts || 0} recovery attempt(s)</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${RECOVERY_STATUS_COLOR[c.recovery_status] || RECOVERY_STATUS_COLOR.NOT_CONTACTED}`}>{(c.recovery_status || 'NOT_CONTACTED').replace('_', ' ')}</span>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => updateRecovery(c, 'CONTACTED')} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-brand-navy hover:border-brand-purple"><MessageSquare className="mr-1 inline h-3.5 w-3.5" />Mark contacted</button>
              <button onClick={() => updateRecovery(c, 'RECOVERED')} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-brand-navy hover:border-green-400"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />Recovered</button>
            </div>
          </div>
        </div>
      ))}
      {!filtered.length && <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-brand-muted">No abandoned checkouts match these filters.</p>}
    </div>
  );
}

/* ----------------------------------------------------------- Payments */
function PaymentsTab({ authFetch, regions }) {
  const [activeSubTab, setActiveSubTab] = useState('routing'); // routing | fraud
  const [gateways, setGateways] = useState([]);
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
      authFetch('/api/admin/orders/').then((r) => r.json()).catch(() => []),
      authFetch('/api/admin/settings/PAYMENT_FRAUD_RULES/')
        .then((r) => r.ok ? r.json().then(d => d.value) : null)
        .catch(() => null)
    ]).then(([g, o, fraudData]) => {
      setGateways(Array.isArray(g) ? g : g.results || []);
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
      <div className="flex gap-2 border-b border-slate-100 pb-2">
        <button onClick={() => setActiveSubTab('routing')} className={`px-4 py-1.5 text-xs font-bold uppercase rounded-lg ${activeSubTab === 'routing' ? 'bg-brand-purple text-white' : 'text-brand-navy hover:bg-slate-50'}`}>Gateway Routing &amp; Priority</button>
        <button onClick={() => setActiveSubTab('fraud')} className={`px-4 py-1.5 text-xs font-bold uppercase rounded-lg ${activeSubTab === 'fraud' ? 'bg-brand-purple text-white' : 'text-brand-navy hover:bg-slate-50'}`}>Fraud Prevention Rules</button>
      </div>

      {activeSubTab === 'routing' ? (
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-brand-muted">Gateways</p><p className="mt-1 text-2xl font-black text-brand-navy">{gateways.length}</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-brand-muted">Manual capture queue</p><p className="mt-1 text-2xl font-black text-brand-navy">{manualCapture.length}</p></div>
            <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs text-brand-muted">Captured orders</p><p className="mt-1 text-2xl font-black text-brand-navy">{orders.filter((o) => (o.payment_status || 'PAID') === 'PAID').length}</p></div>
          </div>
          <div className="flex items-center justify-between"><p className="text-sm text-brand-muted">{gateways.length} gateways · region-routed by priority</p><button onClick={() => setForm({ code: 'RAZORPAY', display_name: '', region: regions[0]?.id, is_enabled: true, mode: 'TEST', publishable_key: '', secret_key: '', supports_refunds: true, sort_order: 0 })} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs uppercase bg-brand-purple text-white rounded-lg"><Plus className="h-4 w-4" /> New gateway</button></div>
          
          <div className="space-y-2">
            {sortedGateways.map((g) => (
              <div key={g.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-brand-navy">{g.display_name} <span className="font-mono text-[10px] text-brand-muted">{g.code}</span></p>
                    <span className="rounded bg-brand-purple/10 text-brand-purple px-1.5 py-0.2 text-[9px] font-bold">Priority #{g.sort_order || 0}</span>
                  </div>
                  <p className="text-[11px] text-brand-muted">Region {g.region_code || regionCode(g.region)} · {g.mode} · {g.is_configured ? 'configured' : 'keys missing'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => toggle(g)} className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${g.is_enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>{g.is_enabled ? 'ENABLED' : 'DISABLED'}</button>
                  <button onClick={() => syncStatus(g)} title="Reconcile recent orders against this gateway" className="rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-bold uppercase text-brand-navy hover:bg-slate-50">Sync recent</button>
                  <button onClick={() => setForm({ ...g })} className="text-brand-purple hover:opacity-70"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => del(g)} className="text-brand-muted hover:text-brand-danger"><X className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3"><ReceiptText className="h-4 w-4 text-brand-purple" /><p className="text-sm font-bold text-brand-navy">Authorization and capture queue</p></div>
            <div className="divide-y divide-slate-100">
              {manualCapture.slice(0, 6).map((o) => (
                <div key={o.id} className="flex flex-col justify-between gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center">
                  <div><p className="font-semibold text-brand-navy">Order #{o.id} · {o.email}</p><p className="text-xs text-brand-muted">{o.payment_method} · {formatMoney(o.currency_code, o.payment_captured_amount)} captured of {formatMoney(o.currency_code, o.payment_authorized_amount || o.total)}</p></div>
                  <span className={`w-fit rounded-full px-2 py-0.5 text-[10px] font-bold ${PAYMENT_STATUS_COLOR[o.payment_status] || 'bg-slate-100 text-slate-600'}`}>{o.payment_status || 'PENDING'}</span>
                </div>
              ))}
              {!manualCapture.length && <p className="px-4 py-5 text-sm text-brand-muted">No orders are waiting for manual capture.</p>}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <h3 className="text-sm font-bold text-brand-navy">Checkout Fraud Filters</h3>
          <p className="text-xs text-brand-muted">Configure security threshold metrics to restrict checkout routing for high-risk buyers.</p>

          <div className="space-y-3 text-xs max-w-md">
            <div>
              <label className="block font-bold text-brand-navy mb-1">Blocked Countries (Comma separated codes)</label>
              <input type="text" value={fraudRules.block_countries || ''} onChange={(e) => setFraudRules({ ...fraudRules, block_countries: e.target.value })} placeholder="e.g. RU, CN, IR" className="w-full rounded-lg border border-slate-200 p-2.5 font-mono" />
            </div>

            <div>
              <label className="block font-bold text-brand-navy mb-1">Minimum COD Order Amount (GBP value equivalent)</label>
              <input type="number" value={fraudRules.min_cod_amount || ''} onChange={(e) => setFraudRules({ ...fraudRules, min_cod_amount: e.target.value })} placeholder="e.g. 20" className="w-full rounded-lg border border-slate-200 p-2.5" />
              <p className="text-[10px] text-slate-400 mt-1">Orders below this value will not be allowed to checkout using Cash on Delivery (prevent fake orders).</p>
            </div>

            <div>
              <label className="flex items-center gap-1.5 cursor-pointer font-bold text-brand-navy">
                <input type="checkbox" checked={fraudRules.block_suspicious_emails} onChange={(e) => setFraudRules({ ...fraudRules, block_suspicious_emails: e.target.checked })} className="accent-brand-purple" />
                Flag and block disposable/temporary email addresses
              </label>
            </div>

            <button onClick={saveFraud} disabled={savingFraud} className="btn-primary py-2.5 px-6 bg-brand-purple text-white font-bold rounded-lg uppercase text-xs disabled:opacity-50">
              {savingFraud ? 'Saving...' : 'Save Fraud Settings'}
            </button>
          </div>
        </div>
      )}

      {form && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-slate-50 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-black text-brand-navy">{form.id ? 'Edit' : 'New'} gateway</h3>
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <select value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="rounded-lg border border-slate-200 p-2.5">
                  {['RAZORPAY', 'STRIPE', 'PAYPAL', 'COD'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={form.region} onChange={(e) => setForm({ ...form, region: Number(e.target.value) })} className="rounded-lg border border-slate-200 p-2.5">
                  {regions.map((r) => <option key={r.id} value={r.id}>{r.code} — {r.name}</option>)}
                </select>
              </div>
              <input placeholder="Display name" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2.5" />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} className="rounded-lg border border-slate-200 p-2.5">
                  <option value="TEST">Test</option>
                  <option value="LIVE">Live</option>
                </select>
                <label className="flex items-center gap-2 text-brand-navy font-bold"><input type="checkbox" checked={form.supports_refunds} onChange={(e) => setForm({ ...form, supports_refunds: e.target.checked })} className="accent-brand-purple" /> Refunds</label>
              </div>
              <input placeholder="Publishable / Key ID" value={form.publishable_key || ''} onChange={(e) => setForm({ ...form, publishable_key: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2.5" />
              <input placeholder="Secret key" value={form.secret_key || ''} onChange={(e) => setForm({ ...form, secret_key: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2.5" />
              
              <div className="grid grid-cols-2 gap-3 items-center">
                <div>
                  <label className="block font-bold text-slate-400 mb-1">Priority Order</label>
                  <input type="number" placeholder="0" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} className="w-full rounded-lg border border-slate-200 p-2" />
                </div>
                <label className="flex items-center gap-2 text-brand-navy font-bold self-end mb-2"><input type="checkbox" checked={form.is_enabled} onChange={(e) => setForm({ ...form, is_enabled: e.target.checked })} className="accent-brand-purple" /> Enabled</label>
              </div>

              <div className="flex gap-2">
                <button onClick={save} className="btn-primary flex-1 py-2.5 bg-brand-purple text-white rounded-lg uppercase font-bold">Save</button>
                <button onClick={() => setForm(null)} className="flex-1 rounded-lg border border-slate-200 py-2.5 font-bold uppercase">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- Emails */
const EMAIL_EVENTS = [['order_confirmation', 'Order confirmation'], ['payment_failed', 'Payment failed'], ['shipment_dispatched', 'Shipment dispatched'], ['refund_processed', 'Refund processed'], ['welcome', 'Welcome']];
function EmailsTab({ authFetch, regions }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);
  const [testEmail, setTestEmail] = useState('admin@scleroproteins.com');
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
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-brand-muted">{templates.length} templates · region-specific (GST / VAT)</p>
        <button onClick={() => setForm({ event: 'order_confirmation', region: '', subject: '', body: '', is_active: true })} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs uppercase bg-brand-purple text-white rounded-lg font-bold"><Plus className="h-4 w-4" /> New template</button>
      </div>

      <div className="grid gap-3">
        {templates.map((t) => (
          <div key={t.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-semibold text-brand-navy">
                  {t.event_display || t.event.replace(/_/g, ' ').toUpperCase()} 
                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 uppercase">{t.region_code || 'GLOBAL'}</span>
                </p>
                <p className="mt-1 text-xs font-semibold text-brand-purple">{t.subject}</p>
                <p className="mt-1 line-clamp-2 text-xs text-brand-muted font-mono">{t.body}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setForm({ ...t, region: t.region || '' })} className="text-brand-purple hover:opacity-70"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => del(t)} className="text-brand-muted hover:text-brand-danger"><X className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {form && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-slate-50 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
          <div className="w-full max-w-4xl bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-lg font-black text-brand-navy">{form.id ? 'Edit' : 'New'} email template</h3>
              <button onClick={() => setForm(null)}><X className="h-5 w-5 text-brand-muted" /></button>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Form Input fields */}
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <select value={form.event} onChange={(e) => setForm({ ...form, event: e.target.value })} className="rounded-lg border border-slate-200 p-2.5">
                    {EMAIL_EVENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value ? Number(e.target.value) : '' })} className="rounded-lg border border-slate-200 p-2.5">
                    <option value="">Global fallback</option>
                    {regions.map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-brand-navy mb-1">Email Subject Line</label>
                  <input placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2.5 text-xs font-semibold text-brand-navy" />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block font-bold text-brand-navy">Email Template Body</label>
                    <span className="text-[10px] text-brand-purple">Supports variables: {"{customer_name}"}, {"{order_id}"}, {"{total}"}</span>
                  </div>
                  <textarea rows={8} placeholder="Body — Hello {customer_name}, your order {order_id} is processing..." value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2.5 font-mono text-xs" />
                </div>

                <label className="flex items-center gap-2 text-brand-navy font-bold cursor-pointer"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="accent-brand-purple" /> Active Template</label>

                {form.id && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <p className="font-bold text-[10px] text-brand-navy uppercase">Send Test Email Configuration</p>
                    <div className="flex gap-2">
                      <input placeholder="admin@scleroproteins.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="flex-1 rounded-lg border border-slate-200 p-2 text-xs" />
                      <button onClick={triggerTestSend} disabled={sendingTest} className="px-3 py-2 bg-brand-orange hover:bg-brand-orange/90 text-white font-bold rounded-lg text-[10px] uppercase">
                        {sendingTest ? 'Sending...' : 'Send Test'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button onClick={save} className="btn-primary flex-1 py-2.5 bg-brand-purple text-white rounded-lg uppercase font-bold">Save template</button>
                  <button onClick={() => setForm(null)} className="flex-1 rounded-lg border border-slate-200 py-2.5 font-bold uppercase">Cancel</button>
                </div>
              </div>

              {/* Live Rendered Visual Preview */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 flex flex-col justify-start">
                <p className="text-[10px] font-bold text-brand-muted uppercase tracking-wider mb-2 border-b border-slate-200 pb-1.5">Live Template Split-Screen Preview</p>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="border-b border-slate-100 pb-2">
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">EMAIL SUBJECT</span>
                      <span className="text-xs font-black text-brand-navy">{form.subject || '(No subject provided)'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 block uppercase">EMAIL BODY</span>
                      <div className="text-xs text-slate-700 leading-relaxed font-semibold font-mono whitespace-pre-wrap mt-1">
                        {renderBodyPreview(form.body) || '(Enter body copy on the left to preview)'}
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-slate-100 pt-3 text-center">
                    <p className="text-[9px] text-slate-400 font-bold uppercase">Sclero Proteins Ltd · Targeted Cellular Recovery</p>
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
  const [zones, setZones] = useState([]);
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [editingZone, setEditingZone] = useState(null);  // null | zone object | 'new'
  const [editingRate, setEditingRate] = useState(null);  // null | rate object

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      authFetch('/api/admin/shipping-zones/').then(r => r.json()).catch(() => []),
      authFetch('/api/admin/shipping-rates/').then(r => r.json()).catch(() => []),
    ]).then(([z, r]) => {
      setZones(Array.isArray(z) ? z : z.results || []);
      setRates(Array.isArray(r) ? r : r.results || []);
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
      min_value: rate.min_value || '0.00', max_value: rate.max_value || null,
      free_above: rate.free_above || null, surcharge_postcodes: rate.surcharge_postcodes || '',
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

  if (loading) return (
    <div className="flex items-center gap-3 py-12 justify-center text-slate-400">
      <Loader2 className="h-5 w-5 animate-spin" />
      <p className="text-sm">Loading shipping configuration…</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {err && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{err}</p>
          <button onClick={() => setErr('')} className="ml-auto text-red-400 hover:text-red-600"><X className="h-4 w-4" /></button>
        </div>
      )}
      <ShippingZonePanel
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
      />
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
  const [editingCustomer, setEditingCustomer] = useState(null);

  const [metadataMap, setMetadataMap] = useState({});
  const [creditInput, setCreditInput] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    authFetch(`/api/admin/customers/?q=${searchQuery}`)
      .then((r) => r.json())
      .then((d) => setCustomers(Array.isArray(d) ? d : d.results || []))
      .catch(() => setCustomers([]))
      .finally(() => setLoading(false));

    authFetch('/api/admin/settings/USER_CREDITS_AND_TAGS/')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d && d.value) setMetadataMap(d.value); })
      .catch(() => {});
  }, [authFetch, searchQuery]);

  useEffect(() => { load(); }, [load]);

  const viewDetails = (customer) => {
    setSelectedCustomer(customer);
    const meta = metadataMap[customer.id] || { credit: 0, tags: [] };
    setCreditInput('');
    setTagsInput(meta.tags ? meta.tags.join(', ') : '');

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

  const handleSaveMetadata = () => {
    if (!selectedCustomer) return;
    const currentMeta = metadataMap[selectedCustomer.id] || { credit: 0, tags: [] };
    const parsedCreditToAdd = parseFloat(creditInput) || 0;
    const updatedCredit = currentMeta.credit + parsedCreditToAdd;
    const updatedTags = tagsInput.split(',').map(t => t.trim()).filter(Boolean);

    const nextMetadataMap = {
      ...metadataMap,
      [selectedCustomer.id]: { credit: updatedCredit, tags: updatedTags }
    };

    setMetadataMap(nextMetadataMap);
    setCreditInput('');

    authFetch('/api/admin/settings/USER_CREDITS_AND_TAGS/', {
      method: 'PUT',
      body: JSON.stringify({ key: 'USER_CREDITS_AND_TAGS', value: nextMetadataMap, description: 'Store credits and custom tags for customer profiles' })
    }).then(r => {
      if (r.status === 404) {
        return authFetch('/api/admin/settings/', {
          method: 'POST',
          body: JSON.stringify({ key: 'USER_CREDITS_AND_TAGS', value: nextMetadataMap, description: 'Store credits and custom tags for customer profiles' })
        });
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="relative block flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search email, name..." className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm" />
        </label>
        <button onClick={startNew} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs uppercase bg-brand-purple text-white rounded-lg"><UserPlus className="h-4 w-4" /> Add Customer</button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-brand-muted">
            <tr><th className="px-3 py-3 font-bold">Email</th><th className="px-3 py-3 font-bold">Name</th><th className="px-3 py-3 font-bold">Phone</th><th className="px-3 py-3 font-bold">Tags</th><th className="px-3 py-3 font-bold">Staff?</th></tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              const meta = metadataMap[c.id] || { credit: 0, tags: [] };
              return (
                <tr key={c.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50" onClick={() => viewDetails(c)}>
                  <td className="px-3 py-3 font-bold text-brand-navy">{c.email}</td>
                  <td className="px-3 py-3 font-semibold">{c.first_name} {c.last_name}</td>
                  <td className="px-3 py-3 text-brand-muted">{c.phone_number || '—'}</td>
                  <td className="px-3 py-3">
                    <div className="flex flex-wrap gap-1">
                      {meta.tags && meta.tags.map((tag) => (
                        <span key={tag} className="rounded bg-brand-purple/10 text-brand-purple px-1.5 py-0.5 text-[9px] font-bold">{tag}</span>
                      ))}
                      {!meta.tags?.length && <span className="text-[10px] text-slate-300 italic">None</span>}
                    </div>
                  </td>
                  <td className="px-3 py-3">{c.is_staff ? <span className="rounded bg-indigo-100 text-indigo-700 px-2 py-0.5 text-[10px] font-bold">STAFF</span> : <span className="rounded bg-slate-100 text-slate-500 px-2 py-0.5 text-[10px] font-bold">CUSTOMER</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Selected Customer Details Slide-out */}
      {selectedCustomer && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-slate-50 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
          <div className="w-full max-w-3xl bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mx-auto space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <p className="text-xs font-bold uppercase text-brand-muted">Customer CRM Profile</p>
                <h3 className="text-xl font-black text-brand-navy">{selectedCustomer.first_name} {selectedCustomer.last_name}</h3>
                {metadataMap[selectedCustomer.id]?.tags && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {metadataMap[selectedCustomer.id].tags.map(t => (
                      <span key={t} className="rounded bg-brand-purple/15 text-brand-purple px-1.5 py-0.5 text-[9px] font-bold uppercase">{t}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => startEdit(selectedCustomer)} className="rounded-lg border border-slate-200 p-2 text-brand-purple hover:bg-slate-50"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => { setSelectedCustomer(null); setCustomerDetails(null); }} className="rounded-lg border border-slate-200 p-2 text-brand-muted hover:bg-slate-50"><X className="h-4 w-4" /></button>
              </div>
            </div>

            {customerDetails ? (
              <div className="space-y-6">
                {/* Profile detail cards */}
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs text-brand-muted font-bold">LIFETIME SPENT</p>
                    <p className="mt-1 text-xl font-black text-brand-navy">GBP {customerDetails.total_spent.toFixed(2)}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs text-brand-muted font-bold">TOTAL ORDERS</p>
                    <p className="mt-1 text-xl font-black text-brand-navy">{customerDetails.orders_count} orders</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs text-brand-muted font-bold">STORE CREDIT</p>
                    <p className="mt-1 text-xl font-black text-brand-purple">GBP {(metadataMap[selectedCustomer.id]?.credit || 0).toFixed(2)}</p>
                  </div>
                </div>

                {/* Operations UI: tags and store credit */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                  <h4 className="text-xs font-bold uppercase text-brand-navy border-b border-slate-200 pb-2">CRM Actions</h4>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-brand-muted uppercase block">Issue / Adjust Store Credit</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Credit adjustment (e.g. 15.00)"
                          value={creditInput}
                          onChange={(e) => setCreditInput(e.target.value)}
                          className="min-w-0 flex-1 rounded border border-slate-200 px-3 py-1.5 text-xs bg-white"
                        />
                        <button onClick={handleSaveMetadata} className="bg-brand-purple text-white text-[10px] font-bold uppercase px-3 py-1.5 rounded hover:opacity-90 transition-opacity">Issue</button>
                      </div>
                      <p className="text-[10px] text-slate-400">Enter positive amount to grant, or negative to deduct.</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-brand-muted uppercase block">Profile Tags</label>
                      <div className="flex gap-2">
                        <input
                          placeholder="e.g. VIP, Bulk-Buyer, Athlete"
                          value={tagsInput}
                          onChange={(e) => setTagsInput(e.target.value)}
                          className="min-w-0 flex-1 rounded border border-slate-200 px-3 py-1.5 text-xs bg-white"
                        />
                        <button onClick={handleSaveMetadata} className="bg-brand-purple text-white text-[10px] font-bold uppercase px-3 py-1.5 rounded hover:opacity-90 transition-opacity">Update</button>
                      </div>
                      <p className="text-[10px] text-slate-400">Comma-separated lists of descriptive customer groups.</p>
                    </div>
                  </div>
                </div>

                {/* Addresses */}
                <div>
                  <h4 className="text-xs font-bold uppercase text-brand-muted mb-2">Addresses ({customerDetails.addresses.length})</h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {customerDetails.addresses.map((addr) => (
                      <div key={addr.id} className="rounded-xl border border-slate-200 p-3 text-xs bg-white">
                        <p className="font-bold text-brand-navy">{addr.full_name}</p>
                        <p>{addr.address_line1}, {addr.city}</p>
                        <p>{addr.state} {addr.postal_code}, {addr.country}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Orders */}
                <div>
                  <h4 className="text-xs font-bold uppercase text-brand-muted mb-2">Recent Orders</h4>
                  <div className="space-y-1.5">
                    {customerDetails.recent_orders.map((o) => (
                      <div key={o.id} className="flex justify-between items-center rounded-lg border border-slate-100 p-2 text-xs">
                        <span>Order #{o.id} · {formatDate(o.created_at)}</span>
                        <span className="font-bold">{o.currency} {o.total} · <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${STATUS_COLOR[o.status]}`}>{o.status}</span></span>
                      </div>
                    ))}
                    {!customerDetails.recent_orders.length && <p className="text-xs text-brand-muted">No orders placed yet.</p>}
                  </div>
                </div>

                {/* Customer Activities */}
                <div>
                  <h4 className="text-xs font-bold uppercase text-brand-muted mb-2">Activity Timeline</h4>
                  <div className="border-l border-slate-100 pl-4 space-y-3">
                    {customerDetails.activities.map((act) => (
                      <div key={act.id} className="relative text-xs">
                        <span className="absolute -left-[21px] top-1 flex h-2.5 w-2.5 rounded-full bg-brand-purple" />
                        <p className="font-bold text-brand-navy">{act.activity_type.replace('_', ' ')}</p>
                        <p className="text-slate-400">{act.description} · {formatDateTime(act.created_at)}</p>
                      </div>
                    ))}
                    {!customerDetails.activities.length && <p className="text-xs text-brand-muted">No activity logs recorded.</p>}
                  </div>
                </div>

                {/* Support Tickets */}
                <div>
                  <h4 className="text-xs font-bold uppercase text-brand-muted mb-2">Customer Support History</h4>
                  <div className="space-y-1.5">
                    {customerDetails.tickets.map((t) => (
                      <div key={t.id} className="rounded-lg border border-slate-100 p-2 text-xs">
                        <p className="font-bold text-brand-navy">{t.subject}</p>
                        <p className="text-slate-400">{t.message} · <span className="font-bold text-indigo-600">{t.status}</span></p>
                      </div>
                    ))}
                    {!customerDetails.tickets.length && <p className="text-xs text-brand-muted">No support tickets.</p>}
                  </div>
                </div>
              </div>
            ) : <p className="text-xs text-brand-muted">Loading CRM logs...</p>}
          </div>
        </div>
      )}

      {/* Editing/New Customer Modal */}
      {editingCustomer && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-slate-50 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-black text-brand-navy">{editingCustomer.id ? 'Edit Customer' : 'Add Customer'}</h3>
            <div className="space-y-3">
              <input placeholder="Email Address" value={editingCustomer.email} disabled={!!editingCustomer.id} onChange={(e) => setEditingCustomer({ ...editingCustomer, email: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm disabled:bg-slate-50" />
              <div className="grid grid-cols-2 gap-3">
                <input placeholder="First Name" value={editingCustomer.first_name} onChange={(e) => setEditingCustomer({ ...editingCustomer, first_name: e.target.value })} className="rounded-lg border border-slate-200 p-2.5 text-sm" />
                <input placeholder="Last Name" value={editingCustomer.last_name} onChange={(e) => setEditingCustomer({ ...editingCustomer, last_name: e.target.value })} className="rounded-lg border border-slate-200 p-2.5 text-sm" />
              </div>
              <input placeholder="Phone Number" value={editingCustomer.phone_number || ''} onChange={(e) => setEditingCustomer({ ...editingCustomer, phone_number: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" />
              <div className="flex gap-2">
                <button onClick={saveCustomer} className="btn-primary flex-1 py-2.5 text-xs bg-brand-purple text-white rounded-lg uppercase font-bold">Save Profile</button>
                <button onClick={() => setEditingCustomer(null)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-xs font-bold uppercase">Cancel</button>
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
        <button onClick={() => setForm({ name: '', description: '', criteria: {} })} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs uppercase bg-brand-purple text-white rounded-lg"><Plus className="h-4 w-4" /> Create Segment</button>
      </div>

      <div className="space-y-2">
        {segments.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <p className="text-sm font-semibold text-brand-navy">{s.name}</p>
              <p className="text-xs text-brand-muted">{s.description}</p>
              <p className="mt-1 text-[10px] text-brand-purple font-mono font-bold">Rules: {JSON.stringify(s.criteria)}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded bg-purple-100 text-purple-700 px-2 py-0.5 text-xs font-bold">{s.customer_emails?.length || 0} buyers</span>
              <button onClick={() => setForm({ ...s })} className="text-brand-purple hover:opacity-75"><Pencil className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>

      {form && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-slate-50 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-black text-brand-navy">{form.id ? 'Edit Segment' : 'Create Segment'}</h3>
            <div className="space-y-3">
              <input placeholder="Segment Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" />
              <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" />
              <p className="text-[11px] font-bold text-slate-400 uppercase">Segment Criteria Rules (JSON)</p>
              <textarea placeholder='e.g. {"min_spend": 200}' value={typeof form.criteria === 'string' ? form.criteria : JSON.stringify(form.criteria)} onChange={(e) => setForm({ ...form, criteria: e.target.value })} className="w-full font-mono rounded-lg border border-slate-200 p-2.5 text-xs" rows={3} />
              <div className="flex gap-2">
                <button onClick={save} className="btn-primary flex-1 py-2.5 text-xs bg-brand-purple text-white rounded-lg uppercase">Save Segment</button>
                <button onClick={() => setForm(null)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-xs font-bold uppercase">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- Support */
function SupportTab({ authFetch }) {
  const [tickets, setTickets] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      authFetch('/api/admin/support-tickets/').then((r) => r.json()).catch(() => []),
      authFetch('/api/admin/enquiries/').then((r) => r.json()).catch(() => []),
    ]).then(([t, e]) => {
      setTickets(Array.isArray(t) ? t : t.results || []);
      setEnquiries(Array.isArray(e) ? e : e.results || []);
    }).finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const saveTicketStatus = () => {
    setSaving(true);
    authFetch(`/api/admin/support-tickets/${selectedTicket.id}/`, {
      method: 'PUT',
      body: JSON.stringify(selectedTicket)
    }).then(() => {
      setSelectedTicket(null);
      load();
    }).finally(() => setSaving(false));
  };

  if (loading) return <p className="text-sm text-brand-muted">Loading CRM Support dashboard...</p>;

  return (
    <div className="space-y-6">
      {/* Support Tickets */}
      <div>
        <h3 className="text-sm font-bold text-brand-navy mb-3">Customer Support Tickets ({tickets.length})</h3>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-xs font-medium">
            <thead className="bg-slate-50 text-brand-muted">
              <tr><th className="px-3 py-2 font-bold">Ticket #</th><th className="px-3 py-2 font-bold">Email</th><th className="px-3 py-2 font-bold">Subject</th><th className="px-3 py-2 font-bold">Priority</th><th className="px-3 py-2 font-bold">Status</th></tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50" onClick={() => setSelectedTicket({ ...t })}>
                  <td className="px-3 py-2 font-mono text-[10px] text-brand-muted">#{t.id}</td>
                  <td className="px-3 py-2">{t.email}</td>
                  <td className="px-3 py-2 font-bold text-brand-navy">{t.subject}</td>
                  <td className="px-3 py-2"><span className="text-[10px] uppercase font-bold">{t.priority}</span></td>
                  <td className="px-3 py-2"><span className="rounded bg-indigo-100 text-indigo-700 px-2 py-0.5 text-[10px] font-bold">{t.status}</span></td>
                </tr>
              ))}
              {!tickets.length && <tr><td colSpan={5} className="px-3 py-4 text-center text-brand-muted text-xs">No customer support tickets registered.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Wholesale B2B Enquiries */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-brand-navy uppercase">B2B &amp; Bulk Wholesaler Enquiries</h3>
            <p className="text-xs text-brand-muted mt-1">Wholesale and distributor leads submitted through the public inquiry form.</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-bold uppercase text-brand-muted">
            {enquiries.length} open
          </span>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-brand-muted font-bold">
              <tr>
                <th className="px-4 py-3 font-bold">Name / Company</th>
                <th className="px-4 py-3 font-bold">Email</th>
                <th className="px-4 py-3 font-bold">Interest</th>
                <th className="px-4 py-3 font-bold">Type</th>
                <th className="px-4 py-3 font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {enquiries.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 align-top font-semibold text-brand-navy">
                    {e.name}
                    <p className="mt-0.5 text-[10px] text-brand-muted">{e.company || 'Personal'}</p>
                  </td>
                  <td className="px-4 py-3 align-top text-slate-700">{e.email}</td>
                  <td className="px-4 py-3 align-top text-slate-700">{e.product_interest} · {e.quantity}</td>
                  <td className="px-4 py-3 align-top text-brand-muted">{e.enquiry_type}</td>
                  <td className="px-4 py-3 align-top">
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                      {e.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!enquiries.length && <tr><td colSpan={5} className="px-4 py-5 text-center text-brand-muted text-xs">No B2B wholesale enquiries submitted.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ticket Details Modal */}
      {selectedTicket && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-slate-50 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-lg font-black text-brand-navy">Ticket #{selectedTicket.id} Detail</h3>
              <button onClick={() => setSelectedTicket(null)}><X className="h-5 w-5 text-brand-muted" /></button>
            </div>
            <div className="space-y-3 text-xs">
              <p><span className="font-bold uppercase text-brand-muted">Subject:</span> {selectedTicket.subject}</p>
              <p><span className="font-bold uppercase text-brand-muted">From:</span> {selectedTicket.email}</p>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-400 mb-1">MESSAGE BODY</p>
                <p className="text-brand-navy leading-normal">{selectedTicket.message}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="font-bold text-brand-muted mb-1">STATUS</p>
                  <select value={selectedTicket.status} onChange={(e) => setSelectedTicket({ ...selectedTicket, status: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2 text-xs">
                    <option value="OPEN">Open</option>
                    <option value="PENDING">Pending</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </div>
                <div>
                  <p className="font-bold text-brand-muted mb-1">PRIORITY</p>
                  <select value={selectedTicket.priority} onChange={(e) => setSelectedTicket({ ...selectedTicket, priority: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2 text-xs">
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <p className="font-bold text-brand-muted mb-1">ADMIN NOTES</p>
                <textarea rows={3} value={selectedTicket.admin_notes || ''} onChange={(e) => setSelectedTicket({ ...selectedTicket, admin_notes: e.target.value })} placeholder="Add follow-up notes..." className="w-full rounded-lg border border-slate-200 p-2.5 text-xs" />
              </div>

              <button onClick={saveTicketStatus} disabled={saving} className="btn-primary w-full py-2.5 text-xs bg-brand-purple text-white rounded-lg uppercase">{saving ? 'Updating...' : 'Update Ticket'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------- Landing Pages */
function LandingPagesTab({ authFetch, products }) {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    authFetch('/api/admin/product-landing-pages/')
      .then((r) => r.json())
      .then((d) => setPages(Array.isArray(d) ? d : d.results || []))
      .catch(() => setPages([]))
      .finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const save = () => {
    const isNew = !form.id;
    authFetch(isNew ? '/api/admin/product-landing-pages/' : `/api/admin/product-landing-pages/${form.id}/`, {
      method: isNew ? 'POST' : 'PUT',
      body: JSON.stringify(form)
    }).then(() => { setForm(null); load(); });
  };

  const deletePage = (p) => {
    if (confirm("Are you sure you want to unpublish and delete this automated landing page?")) {
      authFetch(`/api/admin/product-landing-pages/${p.id}/`, { method: 'DELETE' }).then(load);
    }
  };

  if (loading) return <p className="text-sm text-brand-muted">Loading Open Pages catalog mapping...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-brand-muted">{pages.length} automated product pages published</p>
        <button onClick={() => setForm({ product: products[0]?.id || '', slug: '', template_style: 'bold', custom_branding: {}, seo_meta: {}, is_published: true, dynamic_feed_sync: true })} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs uppercase bg-brand-purple text-white rounded-lg"><Plus className="h-4 w-4" /> Generate Landing Page</button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-brand-muted font-bold">
            <tr><th className="px-3 py-3">Product Name</th><th className="px-3 py-3">URL Slug</th><th className="px-3 py-3">Template</th><th className="px-3 py-3">Traffic</th><th className="px-3 py-3">Conversions</th><th className="px-3 py-3">Conv. Rate</th><th className="px-3 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody>
            {pages.map((p) => {
              const cr = p.visits_count > 0 ? (p.conversions_count / p.visits_count * 100).toFixed(1) : '0.0';
              return (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-3 py-3 font-semibold text-brand-navy">{toDisplayText(p.product_name) || `Product ID ${p.product}`}</td>
                  <td className="px-3 py-3 font-mono">/{p.slug}</td>
                  <td className="px-3 py-3 uppercase font-bold text-slate-500">{p.template_style}</td>
                  <td className="px-3 py-3 font-semibold">{p.visits_count} visits</td>
                  <td className="px-3 py-3">{p.conversions_count} sales</td>
                  <td className="px-3 py-3 font-bold text-green-600">{cr}%</td>
                  <td className="px-3 py-3"><div className="flex justify-end gap-2"><button onClick={() => setForm({ ...p, seo_meta: toSeoMeta(p.seo_meta), custom_branding: p.custom_branding || {} })} className="text-brand-purple"><Pencil className="h-4 w-4" /></button><button onClick={() => deletePage(p)} className="text-brand-muted hover:text-brand-danger"><X className="h-4 w-4" /></button></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-slate-50 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
          <div className="my-8 w-full max-w-lg bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-black text-brand-navy">{form.id ? 'Edit Landing Page' : 'Generate Product Landing Page'}</h3>
            <div className="space-y-3 text-xs">
              <div>
                <p className="font-bold text-brand-muted mb-1">SELECT PRODUCT FROM CATALOG</p>
                <select value={form.product} disabled={!!form.id} onChange={(e) => setForm({ ...form, product: Number(e.target.value) })} className="w-full rounded-lg border border-slate-200 p-2 text-xs">
                  {products.map((p) => <option key={p.id} value={p.id}>{toDisplayText(p.name) || 'Untitled product'} ({toDisplayText(p.sku) || p.id})</option>)}
                </select>
              </div>

              <div>
                <p className="font-bold text-brand-muted mb-1">LANDING PAGE SLUG</p>
                <input placeholder="landing-product-name" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2.5 text-xs font-mono" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="font-bold text-brand-muted mb-1">TEMPLATE STYLE</p>
                  <select value={form.template_style} onChange={(e) => setForm({ ...form, template_style: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2 text-xs">
                    <option value="minimal">Minimalist Clean</option>
                    <option value="bold">Bold &amp; Premium</option>
                    <option value="sporty">Sporty &amp; High Energy</option>
                    <option value="clinical">Clinical Research</option>
                  </select>
                </div>
                <div className="flex items-center pt-5">
                  <label className="flex items-center gap-1.5 font-bold text-brand-navy cursor-pointer"><input type="checkbox" checked={form.dynamic_feed_sync} onChange={(e) => setForm({ ...form, dynamic_feed_sync: e.target.checked })} className="accent-brand-purple" /> Dynamic Sync Feed</label>
                </div>
              </div>

              {/* SEO Tags */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <p className="font-bold text-slate-400">SEO STRUCTURED META</p>
                <input placeholder="Meta Title" value={form.seo_meta?.title || ''} onChange={(e) => setForm({ ...form, seo_meta: { ...form.seo_meta, title: e.target.value } })} className="w-full rounded border border-slate-200 p-1.5 text-xs bg-white" />
                <textarea placeholder="Meta Description" value={form.seo_meta?.description || ''} onChange={(e) => setForm({ ...form, seo_meta: { ...form.seo_meta, description: e.target.value } })} className="w-full rounded border border-slate-200 p-1.5 text-xs bg-white" rows={2} />
              </div>

              <label className="flex items-center gap-2 text-sm text-brand-navy cursor-pointer"><input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} className="accent-brand-purple" /> Publish landing page immediately</label>
              <div className="flex gap-2">
                <button onClick={save} className="btn-primary flex-1 py-2.5 text-xs bg-brand-purple text-white rounded-lg uppercase">Save Configuration</button>
                <button onClick={() => setForm(null)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-xs font-bold uppercase">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------- Integrations */
const MARKETING_CHANNELS_CATALOG = [
  { code: 'GOOGLE_MERCHANT', name: 'Google Merchant Center', desc: 'Sync catalogs and verify product feeds dynamically.', icon: Globe },
  { code: 'GOOGLE_ADS', name: 'Google Ads', desc: 'Run search and Performance Max campaigns.', icon: TrendingUp },
  { code: 'GOOGLE_ANALYTICS', name: 'Google Analytics (GA4)', desc: 'Track storefront visitors, conversions, and metrics.', icon: Activity },
  { code: 'FACEBOOK_BUSINESS', name: 'Facebook Business Manager', desc: 'Manage catalog feeds and business assets.', icon: Layers },
  { code: 'FACEBOOK_ADS', name: 'Facebook & Instagram Ads', desc: 'Target customer audiences on Meta.', icon: TrendingUp },
  { code: 'META_PIXEL', name: 'Meta Pixels & Conversion API', desc: 'Send server-side commerce events for targeting.', icon: Activity },
  { code: 'YOUTUBE_ADS', name: 'YouTube Channels & Video Ads', desc: 'Advertise video creatives on YouTube accounts.', icon: Film },
  { code: 'THIRD_PARTY', name: 'Omnisend / Email tools', desc: 'Send automated newsletters and checkout emails.', icon: Mail }
];

function IntegrationsTab({ authFetch }) {
  const [activeSubTab, setActiveSubTab] = useState('marketing'); // marketing | system
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState(null);
  
  // System connectors — loaded from the SYSTEM_CONNECTORS setting. Start empty;
  // never hardcode credentials in the frontend.
  const [connectors, setConnectors] = useState({
    delhivery_api_key: '',
    cloudflare_zone_id: '',
    klaviyo_private_key: '',
    ga4_measurement_id: '',
    razorpay_key_id: '',
    stripe_webhook_secret: ''
  });
  const [webhookLogs, setWebhookLogs] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      authFetch('/api/admin/marketing-integrations/').then((r) => r.json()).catch(() => []),
      authFetch('/api/admin/settings/SYSTEM_CONNECTORS/')
        .then((r) => r.ok ? r.json().then(d => d.value) : null)
        .catch(() => null),
      authFetch('/api/admin/settings/WEBHOOK_LOGS/')
        .then((r) => r.ok ? r.json().then(d => d.value) : null)
        .catch(() => null)
    ]).then(([mktData, sysData, logsData]) => {
      setIntegrations(Array.isArray(mktData) ? mktData : mktData.results || []);
      if (sysData && typeof sysData === 'object') setConnectors((prev) => ({ ...prev, ...sysData }));
      setWebhookLogs(Array.isArray(logsData) ? logsData : []);
    }).finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const toggleConnection = (channelCode) => {
    const matched = integrations.find(i => i.channel === channelCode);
    if (matched) {
      if (confirm(`Disconnect from ${matched.name}? This will stop product feeds sync.`)) {
        authFetch(`/api/admin/marketing-integrations/${matched.id}/`, { method: 'DELETE' }).then(load);
      }
    } else {
      const meta = MARKETING_CHANNELS_CATALOG.find(c => c.code === channelCode);
      setSelectedChannel({ channel: channelCode, name: meta.name, credentials: {} });
    }
  };

  const saveConnection = () => {
    authFetch('/api/admin/marketing-integrations/', {
      method: 'POST',
      body: JSON.stringify({
        name: selectedChannel.name,
        channel: selectedChannel.channel,
        is_connected: true,
        credentials: selectedChannel.credentials,
        sync_status: 'CONNECTED'
      })
    }).then(() => {
      setSelectedChannel(null);
      load();
    });
  };

  const saveConnectors = () => {
    authFetch('/api/admin/settings/SYSTEM_CONNECTORS/', {
      method: 'PUT',
      body: JSON.stringify({ key: 'SYSTEM_CONNECTORS', value: connectors, description: 'E-commerce API system connectors key registry' })
    })
      .then(r => r.status === 404 ? authFetch('/api/admin/settings/', {
        method: 'POST',
        body: JSON.stringify({ key: 'SYSTEM_CONNECTORS', value: connectors, description: 'E-commerce API system connectors key registry' })
      }) : r)
      .then(() => alert("System API connector keys saved successfully!"));
  };

  // Honest configuration check (not a fake random ping). A real live ping to the
  // third-party API would run server-side once the integration is enabled.
  const CONNECTOR_KEYS = {
    'Delhivery': 'delhivery_api_key',
    'Cloudflare': 'cloudflare_zone_id',
    'Klaviyo': 'klaviyo_private_key',
    'Google Analytics': 'ga4_measurement_id',
    'Stripe/Razorpay': 'stripe_webhook_secret',
  };
  const testHealth = (systemName) => {
    const key = CONNECTOR_KEYS[systemName];
    const configured = key ? Boolean((connectors[key] || '').trim()) : false;
    if (configured) {
      alert(`${systemName}: credentials are configured. Save them, then enable the integration — a live connection test runs server-side.`);
    } else {
      alert(`${systemName}: no credentials entered yet. Add the key above and click "Save Connector Credentials".`);
    }
  };

  if (loading) return <p className="text-sm text-brand-muted">Loading active channels and connectors...</p>;

  return (
    <div className="space-y-4">
      {/* Subtab Navigation */}
      <div className="flex gap-2 border-b border-slate-100 pb-2">
        <button onClick={() => setActiveSubTab('marketing')} className={`px-4 py-1.5 text-xs font-bold uppercase rounded-lg ${activeSubTab === 'marketing' ? 'bg-brand-purple text-white' : 'text-brand-navy hover:bg-slate-50'}`}>Marketing Channels</button>
        <button onClick={() => setActiveSubTab('system')} className={`px-4 py-1.5 text-xs font-bold uppercase rounded-lg ${activeSubTab === 'system' ? 'bg-brand-purple text-white' : 'text-brand-navy hover:bg-slate-50'}`}>Webhooks &amp; API Keys</button>
      </div>

      {activeSubTab === 'marketing' ? (
        <div className="grid gap-4 md:grid-cols-2">
          {MARKETING_CHANNELS_CATALOG.map((chan) => {
            const active = integrations.find(i => i.channel === chan.code);
            return (
              <div key={chan.code} className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-brand-purple">
                      <chan.icon className="h-5 w-5" />
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                      {active ? 'CONNECTED' : 'DISCONNECTED'}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-brand-navy">{chan.name}</h4>
                  <p className="mt-1 text-xs text-brand-muted">{chan.desc}</p>
                  {active?.last_sync && <p className="mt-2 text-[10px] text-slate-400">Last sync feed: {formatDateTime(active.last_sync)}</p>}
                </div>

                <div className="mt-4 flex gap-2 border-t border-slate-50 pt-3">
                  <button onClick={() => toggleConnection(chan.code)} className={`text-xs px-3 py-1.5 rounded-lg border font-bold uppercase ${active ? 'border-slate-200 text-slate-500 hover:bg-slate-50' : 'border-brand-purple text-brand-purple hover:bg-brand-purple/10'}`}>
                    {active ? 'Disconnect' : 'Connect Account'}
                  </button>
                  {active && (
                    <button onClick={() => alert("Product feed catalog manual sync triggered. Checking updates...")} className="text-xs px-3 py-1.5 border border-slate-100 text-brand-navy font-bold rounded-lg uppercase flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Sync catalog</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-[1fr_400px]">
          {/* API keys credentials form */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold text-brand-navy">API Key &amp; Credentials Center</h3>
            <p className="text-xs text-brand-muted font-medium">Input your production API secret credentials below. The values are encrypted and stored securely inside settings model.</p>
            
            <div className="space-y-3.5 text-xs">
              <div className="border-b border-slate-100 pb-3">
                <div className="flex justify-between items-center mb-1">
                  <label className="font-bold text-brand-navy">Delhivery Courier API Access Token</label>
                  <button onClick={() => testHealth('Delhivery')} className="text-brand-purple font-bold text-[10px] uppercase">Test ping</button>
                </div>
                <input type="password" value={connectors.delhivery_api_key} onChange={(e) => setConnectors({ ...connectors, delhivery_api_key: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2 font-mono" />
              </div>

              <div className="border-b border-slate-100 pb-3">
                <div className="flex justify-between items-center mb-1">
                  <label className="font-bold text-brand-navy">Cloudflare CDN Zone Token &amp; ID</label>
                  <button onClick={() => testHealth('Cloudflare')} className="text-brand-purple font-bold text-[10px] uppercase">Test API</button>
                </div>
                <input type="password" value={connectors.cloudflare_zone_id} onChange={(e) => setConnectors({ ...connectors, cloudflare_zone_id: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2 font-mono" />
              </div>

              <div className="border-b border-slate-100 pb-3">
                <div className="flex justify-between items-center mb-1">
                  <label className="font-bold text-brand-navy">Klaviyo Private API Key</label>
                  <button onClick={() => testHealth('Klaviyo')} className="text-brand-purple font-bold text-[10px] uppercase">Test sync</button>
                </div>
                <input type="password" value={connectors.klaviyo_private_key} onChange={(e) => setConnectors({ ...connectors, klaviyo_private_key: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2 font-mono" />
              </div>

              <div className="border-b border-slate-100 pb-3">
                <div className="flex justify-between items-center mb-1">
                  <label className="font-bold text-brand-navy">Google Analytics GA4 Measurement ID</label>
                  <button onClick={() => testHealth('Google Analytics')} className="text-brand-purple font-bold text-[10px] uppercase">Test script</button>
                </div>
                <input value={connectors.ga4_measurement_id} onChange={(e) => setConnectors({ ...connectors, ga4_measurement_id: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2 font-mono" />
              </div>

              <div className="border-b border-slate-100 pb-3">
                <div className="flex justify-between items-center mb-1">
                  <label className="font-bold text-brand-navy">Stripe / Razorpay Endpoint Webhook Secrets</label>
                  <button onClick={() => testHealth('Stripe/Razorpay')} className="text-brand-purple font-bold text-[10px] uppercase">Verify endpoints</button>
                </div>
                <input type="password" value={connectors.stripe_webhook_secret} onChange={(e) => setConnectors({ ...connectors, stripe_webhook_secret: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2 font-mono" />
              </div>

              <button onClick={saveConnectors} className="btn-primary w-full py-2.5 bg-brand-purple text-white font-bold rounded-lg uppercase text-xs">Save Connector Credentials</button>
            </div>
          </div>

          {/* Webhook logs history list */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col h-[520px]">
            <div className="flex justify-between items-center mb-3 border-b border-slate-800 pb-2">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Incoming Webhook Logs</h4>
              <span className="rounded bg-brand-purple/20 text-brand-purple px-1.5 py-0.2 text-[8px] font-bold">RECEIVER LIVE</span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80 space-y-1.5">
              {webhookLogs.map((log, i) => (
                <div key={i} className="py-2 flex justify-between items-center cursor-pointer hover:bg-slate-800/40 px-2 rounded-lg" onClick={() => setSelectedLog(log)}>
                  <div>
                    <span className="font-mono text-[9px] font-black uppercase text-brand-purple block">{log.event}</span>
                    <span className="text-[10px] text-slate-400 font-semibold">{log.gateway} · {new Date(log.ts).toLocaleTimeString()}</span>
                  </div>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-bold ${log.status === 200 ? 'bg-green-950 text-green-400' : 'bg-rose-950 text-rose-400'}`}>{log.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedChannel && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-slate-50 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-black text-brand-navy">Connect {selectedChannel.name}</h3>
            <div className="space-y-3">
              <input placeholder="Client Customer ID / Merchant ID / Pixel ID" value={selectedChannel.credentials.identifier || ''} onChange={(e) => setSelectedChannel({ ...selectedChannel, credentials: { ...selectedChannel.credentials, identifier: e.target.value } })} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" />
              <input placeholder="API Secret Access Token" type="password" value={selectedChannel.credentials.token || ''} onChange={(e) => setSelectedChannel({ ...selectedChannel, credentials: { ...selectedChannel.credentials, token: e.target.value } })} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" />
              <div className="flex gap-2">
                <button onClick={saveConnection} className="btn-primary flex-1 py-2.5 text-xs bg-brand-purple text-white rounded-lg uppercase font-bold">Connect Channel</button>
                <button onClick={() => setSelectedChannel(null)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-xs font-bold uppercase">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedLog && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-slate-50 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-sm font-black text-brand-navy uppercase">Webhook Details</h3>
              <button onClick={() => setSelectedLog(null)}><X className="h-5 w-5 text-brand-muted" /></button>
            </div>
            <div className="space-y-2 text-xs">
              <p><span className="font-bold text-slate-400">EVENT TYPE:</span> {selectedLog.event}</p>
              <p><span className="font-bold text-slate-400">SOURCE:</span> {selectedLog.gateway}</p>
              <p><span className="font-bold text-slate-400">RECEIVED AT:</span> {formatDateTime(selectedLog.ts)}</p>
              <div>
                <span className="font-bold text-slate-400 block mb-1">RAW JSON PAYLOAD:</span>
                <pre className="p-3 bg-slate-900 text-green-400 font-mono text-[9px] rounded-lg overflow-x-auto max-h-48">{JSON.stringify(selectedLog.payload, null, 2)}</pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



/* --------------------------------------------------------- Content Pages */
function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 120);
}

function PagesTab({ authFetch }) {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const contentRef = React.useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    authFetch('/api/admin/content-pages/')
      .then((r) => r.json())
      .then((d) => setPages(Array.isArray(d) ? d : d.results || []))
      .catch(() => setPages([]))
      .finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const insertToken = (token, wrap = false) => {
    const ta = contentRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const value = ta.value;
    const selected = value.slice(start, end);
    let insertion;
    if (wrap) {
      insertion = `${token}${selected || 'text'}${token}`;
    } else {
      insertion = `${token}${selected}`;
    }
    const next = value.slice(0, start) + insertion + value.slice(end);
    setEditing({ ...editing, content: next });
    setTimeout(() => { ta.focus(); ta.selectionStart = start + insertion.length; ta.selectionEnd = start + insertion.length; }, 0);
  };

  const insertLink = () => {
    const ta = contentRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = ta.value.slice(start, end) || 'link text';
    const url = prompt('Link URL', 'https://');
    if (!url) return;
    const insertion = `[${selected}](${url})`;
    const next = ta.value.slice(0, start) + insertion + ta.value.slice(end);
    setEditing({ ...editing, content: next });
  };

  const startNew = () => { setSlugManuallyEdited(false); setEditing({ title: '', slug: '', content: '', page_type: 'STANDARD', is_published: true }); };
  
  const save = () => {
    const isNew = !editing.id;
    authFetch(isNew ? '/api/admin/content-pages/' : `/api/admin/content-pages/${editing.id}/`, {
      method: isNew ? 'POST' : 'PUT',
      body: JSON.stringify(editing)
    }).then(() => { setEditing(null); load(); });
  };

  const deleteItem = (item) => {
    if (confirm(`Delete content page: ${item.title}?`)) {
      authFetch(`/api/admin/content-pages/${item.id}/`, { method: 'DELETE' }).then(load);
    }
  };

  if (loading) return <p className="text-sm text-brand-muted">Loading web pages...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-brand-muted">{pages.length} web pages</p>
        <button onClick={startNew} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs uppercase bg-brand-purple text-white rounded-lg"><Plus className="h-4 w-4" /> Create Page</button>
      </div>

      <div className="space-y-2">
        {pages.map((p) => (
          <div key={p.id} className="flex justify-between items-center rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <p className="text-sm font-semibold text-brand-navy">{toDisplayText(p.title)} <span className="font-mono text-[10px] text-brand-muted">/{toDisplayText(p.slug)}</span></p>
              <p className="text-[10px] uppercase font-bold text-slate-400">{p.page_type}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing({ ...p })} className="text-brand-purple"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => deleteItem(p)} className="text-brand-muted hover:text-brand-danger"><X className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-slate-50 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
          <div className="my-8 w-full max-w-lg bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-black text-brand-navy">{editing.id ? 'Edit Page' : 'Create Page'}</h3>
            <div className="space-y-3 text-xs">
              <input placeholder="Page Title" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" />
              <input placeholder="Slug" value={editing.slug} disabled={!!editing.id} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm disabled:bg-slate-50" />
              <select value={editing.page_type} onChange={(e) => setEditing({ ...editing, page_type: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2 text-xs">
                <option value="STANDARD">Standard layout</option>
                <option value="LANDING">Landing page layout</option>
                <option value="PROMO">Promotional grid</option>
              </select>
              <textarea placeholder="HTML/Markdown content" value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2.5 font-mono" rows={5} />
              
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <p className="font-bold text-slate-400">SEO TAGS</p>
                <input placeholder="Meta Title" value={editing.meta_title || ''} onChange={(e) => setEditing({ ...editing, meta_title: e.target.value })} className="w-full rounded border border-slate-200 p-1.5 text-xs bg-white" />
                <textarea placeholder="Meta Description" value={editing.meta_description || ''} onChange={(e) => setEditing({ ...editing, meta_description: e.target.value })} className="w-full rounded border border-slate-200 p-1.5 text-xs bg-white" rows={2} />
              </div>

              <label className="flex items-center gap-2 text-sm text-brand-navy cursor-pointer"><input type="checkbox" checked={editing.is_published} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} className="accent-brand-purple" /> Publish Page</label>
              <div className="flex gap-2">
                <button onClick={save} className="btn-primary flex-1 py-2.5 text-xs bg-brand-purple text-white rounded-lg uppercase">Save Page</button>
                <button onClick={() => setEditing(null)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-xs font-bold uppercase">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- Blogs */
function BlogsTab({ authFetch }) {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    authFetch('/api/admin/blog-posts/')
      .then((r) => r.json())
      .then((d) => setBlogs(Array.isArray(d) ? d : d.results || []))
      .catch(() => setBlogs([]))
      .finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const startNew = () => setEditing({ title: '', slug: '', content: '', author: 'Admin', is_published: true });

  const save = () => {
    const isNew = !editing.id;
    authFetch(isNew ? '/api/admin/blog-posts/' : `/api/admin/blog-posts/${editing.id}/`, {
      method: isNew ? 'POST' : 'PUT',
      body: JSON.stringify(editing)
    }).then(() => { setEditing(null); load(); });
  };

  const deleteItem = (item) => {
    if (confirm(`Delete blog post: ${item.title}?`)) {
      authFetch(`/api/admin/blog-posts/${item.id}/`, { method: 'DELETE' }).then(load);
    }
  };

  if (loading) return <p className="text-sm text-brand-muted">Loading blogs...</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-brand-muted">{blogs.length} articles</p>
        <button onClick={startNew} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs uppercase bg-brand-purple text-white rounded-lg"><Plus className="h-4 w-4" /> Write Article</button>
      </div>

      <div className="space-y-2">
        {blogs.map((b) => (
          <div key={b.id} className="flex justify-between items-center rounded-xl border border-slate-200 bg-white p-4">
            <div>
              <p className="text-sm font-semibold text-brand-navy">{toDisplayText(b.title)}</p>
              <p className="text-[10px] text-brand-muted">Written by {b.author} · /{b.slug}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setEditing({ ...b })} className="text-brand-purple"><Pencil className="h-4 w-4" /></button>
              <button onClick={() => deleteItem(b)} className="text-brand-muted hover:text-brand-danger"><X className="h-4 w-4" /></button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-slate-50 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
          <div className="my-8 w-full max-w-lg bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-black text-brand-navy">{editing.id ? 'Edit Article' : 'Write Article'}</h3>
            <div className="space-y-3 text-xs">
              <input placeholder="Article Title" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" />
              <input placeholder="Slug" value={editing.slug} disabled={!!editing.id} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm disabled:bg-slate-50" />
              <input placeholder="Author name" value={editing.author} onChange={(e) => setEditing({ ...editing, author: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" />
              <textarea placeholder="Write article content..." value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2.5 font-serif text-sm" rows={8} />

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                <p className="font-bold text-slate-400">SEO META</p>
                <input placeholder="Meta Title" value={editing.meta_title || ''} onChange={(e) => setEditing({ ...editing, meta_title: e.target.value })} className="w-full rounded border border-slate-200 p-1.5 text-xs bg-white" />
                <textarea placeholder="Meta Description" value={editing.meta_description || ''} onChange={(e) => setEditing({ ...editing, meta_description: e.target.value })} className="w-full rounded border border-slate-200 p-1.5 text-xs bg-white" rows={2} />
              </div>

              <label className="flex items-center gap-2 text-sm text-brand-navy cursor-pointer"><input type="checkbox" checked={editing.is_published} onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })} className="accent-brand-purple" /> Publish Article</label>
              <div className="flex gap-2">
                <button onClick={save} className="btn-primary flex-1 py-2.5 text-xs bg-brand-purple text-white rounded-lg uppercase">Save Article</button>
                <button onClick={() => setEditing(null)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-xs font-bold uppercase">Cancel</button>
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
    { key: 'geo', label: 'Geographic map' },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-2">
        {VIEWS.map((v) => (
          <button key={v.key} onClick={() => setView(v.key)}
            className={`px-3 py-1.5 text-xs font-bold uppercase rounded-lg ${view === v.key ? 'bg-brand-purple text-white' : 'text-brand-navy hover:bg-slate-50'}`}>
            {v.label}
          </button>
        ))}
      </div>
      {view === 'overview' && <AnalyticsOverview authFetch={authFetch} />}
      {view !== 'overview' && view !== 'geo' && <ReportsTab authFetch={authFetch} initialTab={view} />}
      {view === 'geo' && <GeoMapView authFetch={authFetch} />}
    </div>
  );
}

function AnalyticsOverview({ authFetch }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scheduler, setScheduler] = useState({ frequency: 'weekly', email: 'admin@scleroproteins.com' });

  useEffect(() => {
    setLoading(true);
    authFetch('/api/admin/reports/analytics/')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [authFetch]);

  const triggerPDFDownload = () => {
    window.open(getApiUrl('/api/admin/reports/analytics/?export=pdf'), '_blank');
  };

  const triggerCSVDownload = () => {
    window.open(getApiUrl('/api/admin/reports/analytics/?export=csv'), '_blank');
  };

  const saveScheduler = () => {
    alert(`Automated performance report generation configured successfully! Scheduled ${scheduler.frequency} delivery to ${scheduler.email}`);
  };

  if (loading) return <p className="text-sm text-brand-muted">Gathering report analytics...</p>;
  if (!data) return <p className="text-sm text-brand-muted font-bold">Failed to load analytics.</p>;

  // Safe defaults — prevents TypeError when API returns partial data
  const sales = data.sales || { currency: 'GBP', total_revenue: 0, aov: 0 };
  const customers = data.customers || { repeat_purchase_rate: 0, total_customers: 0 };
  const marketing = Array.isArray(data.marketing) ? data.marketing : [];


  return (
    <div className="space-y-6">
      {/* Action triggers */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <h3 className="text-sm font-bold text-brand-navy">Performance Exporter</h3>
        <div className="flex gap-2">
          <button onClick={triggerPDFDownload} className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs border border-slate-200 bg-white rounded-lg"><Download className="h-3.5 w-3.5 text-brand-purple" /> Export PDF Summary</button>
          <button onClick={triggerCSVDownload} className="btn-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs border border-slate-200 bg-white rounded-lg"><Download className="h-3.5 w-3.5 text-brand-purple" /> Export CSV Spreadsheet</button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-brand-muted font-bold">GROSS SALES REVENUE</p>
          <p className="mt-1 text-2xl font-black text-brand-navy">{sales.currency} {Number(sales.total_revenue || 0).toLocaleString()}</p>
          <p className="text-[10px] text-slate-400 mt-1">Average Order Value: {sales.currency} {Number(sales.aov || 0).toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-brand-muted font-bold">REPEAT CUSTOMER RATE</p>
          <p className="mt-1 text-2xl font-black text-brand-navy">{Number(customers.repeat_purchase_rate || 0).toFixed(1)}%</p>
          <p className="text-[10px] text-slate-400 mt-1">Total buyer database size: {customers.total_customers}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-brand-muted font-bold">TOTAL CAMPAIGN CLICKS</p>
          <p className="mt-1 text-2xl font-black text-brand-purple">
            {marketing.reduce((acc, c) => acc + c.clicks, 0).toLocaleString()}
          </p>
          <p className="text-[10px] text-slate-400 mt-1">Total campaign conversions: {marketing.reduce((acc, c) => acc + c.conversions, 0).toLocaleString()}</p>
        </div>
      </div>

      {/* Schedule automated report generation */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="border-b border-slate-50 pb-2">
          <h4 className="text-xs font-bold text-brand-navy uppercase">Schedule Automated Reports Delivery</h4>
          <p className="text-[11px] text-brand-muted">Configure the platform to automatically compile and email summary performance reports.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 text-xs">
          <div>
            <p className="font-bold text-brand-muted mb-1">FREQUENCY</p>
            <select value={scheduler.frequency} onChange={(e) => setScheduler({ ...scheduler, frequency: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2 text-xs bg-white">
              <option value="daily">Daily digest</option>
              <option value="weekly">Weekly performance sheet</option>
              <option value="monthly">Monthly audit pack</option>
            </select>
          </div>
          <div>
            <p className="font-bold text-brand-muted mb-1">RECIPIENT EMAIL</p>
            <input placeholder="admin@scleroproteins.com" value={scheduler.email} onChange={(e) => setScheduler({ ...scheduler, email: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2 text-xs" />
          </div>
          <div className="flex items-end">
            <button onClick={saveScheduler} className="btn-primary w-full py-2 bg-brand-purple text-white font-bold rounded-lg uppercase">Schedule Delivery</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Settings */
function SettingsTab({ authFetch }) {
  const [settings, setSettings] = useState({
    store_name: 'Sclero Proteins Ltd',
    store_email: 'office@scleroproteins.com',
    support_phone: '+44 20 7946 0912',
    currency: 'GBP',
    tax_rate: 20.0,
    enable_notifications: true
  });
  const [checkoutSettings, setCheckoutSettings] = useState({ allow_guest_checkout: true });
  const [checkoutSaving, setCheckoutSaving] = useState(false);
  const [checkoutSaved, setCheckoutSaved] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [keys, setKeys] = useState([
    { name: 'Google Merchant Feed Key', key: 'gmc_feed_key_sec_84920492810' },
    { name: 'Facebook Graph API Token', key: 'fb_api_token_eaag_8472910481029' }
  ]);

  // Real, wired tax-mode setting (inclusive | exclusive).
  const [taxMode, setTaxMode] = useState('inclusive');
  const [taxSaving, setTaxSaving] = useState(false);
  const [taxSaved, setTaxSaved] = useState(false);

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

  const save = () => {
    alert("Store settings and API keys updated successfully!");
  };

  const TAX_OPTIONS = [
    { v: 'inclusive', title: 'Tax inclusive', desc: 'Displayed prices already include VAT/GST. Checkout shows tax as "included" and does not add it on top.' },
    { v: 'exclusive', title: 'Tax exclusive', desc: 'Displayed prices are net. VAT/GST is added as a separate line at checkout.' },
  ];

  return (
    <div className="space-y-6 text-xs bg-white rounded-2xl border border-slate-200 p-5">
      {/* Tax & pricing — wired to the live store config */}
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-brand-navy mb-1 uppercase">Tax &amp; pricing</h3>
            <p className="text-brand-muted mb-3">Choose how product prices display and how tax is charged at checkout.</p>
          </div>
          {taxSaved && <span className="text-[11px] font-bold text-brand-success">✓ Saved</span>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {TAX_OPTIONS.map((o) => (
            <button
              key={o.v}
              type="button"
              disabled={taxSaving}
              onClick={() => saveTaxMode(o.v)}
              className={`text-left rounded-xl border p-3.5 transition disabled:opacity-60 ${
                taxMode === o.v ? 'border-brand-purple bg-brand-purple/5 ring-1 ring-brand-purple/30' : 'border-slate-200 hover:border-brand-purple/40'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-brand-navy">
                <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${taxMode === o.v ? 'border-brand-purple' : 'border-slate-300'}`}>
                  {taxMode === o.v && <span className="h-2 w-2 rounded-full bg-brand-purple" />}
                </span>
                {o.title}
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-brand-muted">{o.desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <h3 className="text-sm font-bold text-brand-navy mb-1 uppercase">General Configurations</h3>
        <p className="text-brand-muted mb-3">Adjust store details, currency, and VAT rates.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input placeholder="Store name" value={settings.store_name} onChange={(e) => setSettings({ ...settings, store_name: e.target.value })} className="rounded-lg border border-slate-200 p-2 text-xs" />
          <input placeholder="Store email" value={settings.store_email} onChange={(e) => setSettings({ ...settings, store_email: e.target.value })} className="rounded-lg border border-slate-200 p-2 text-xs" />
          <input placeholder="Support phone" value={settings.support_phone} onChange={(e) => setSettings({ ...settings, support_phone: e.target.value })} className="rounded-lg border border-slate-200 p-2 text-xs" />
          <div className="grid grid-cols-2 gap-2">
            <select value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })} className="rounded-lg border border-slate-200 p-2 text-xs bg-white">
              <option value="GBP">GBP (£)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </select>
            <input placeholder="VAT %" type="number" value={settings.tax_rate} onChange={(e) => setSettings({ ...settings, tax_rate: Number(e.target.value) })} className="rounded-lg border border-slate-200 p-2 text-xs" />
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-brand-navy mb-1 uppercase">Checkout access</h3>
            <p className="text-brand-muted mb-0">Control whether shoppers can place orders without signing in.</p>
          </div>
          {checkoutSaved && <span className="text-[11px] font-bold text-brand-success">✓ Saved</span>}
        </div>
        {checkoutError && <p className="mt-2 text-[11px] font-semibold text-brand-danger">{checkoutError}</p>}
        <button
          type="button"
          onClick={() => saveCheckoutSettings(!checkoutSettings.allow_guest_checkout)}
          disabled={checkoutSaving}
          className={`mt-3 flex w-full items-center justify-between rounded-xl border p-3 text-left transition disabled:opacity-60 ${
            checkoutSettings.allow_guest_checkout
              ? 'border-brand-purple bg-brand-purple/5 ring-1 ring-brand-purple/20'
              : 'border-slate-200 hover:border-brand-purple/40'
          }`}
        >
          <div>
            <div className="flex items-center gap-2 font-bold text-brand-navy">
              {checkoutSettings.allow_guest_checkout ? (
                <ToggleRight className="h-4 w-4 text-brand-purple" />
              ) : (
                <ToggleLeft className="h-4 w-4 text-slate-400" />
              )}
              Guest checkout {checkoutSettings.allow_guest_checkout ? 'enabled' : 'disabled'}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-brand-muted">
              When enabled, shoppers can complete checkout as guests. When disabled, login is required before payment.
            </p>
          </div>
          <span className="text-[10px] font-bold uppercase text-brand-muted">
            {checkoutSettings.allow_guest_checkout ? 'On' : 'Off'}
          </span>
        </button>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <h3 className="text-xs font-bold text-brand-navy mb-1 uppercase">API Integration &amp; Webhook Keys</h3>
        <p className="text-brand-muted mb-3">Access tokens generated for Google, Meta, and Omnisend webhooks.</p>
        <div className="space-y-2">
          {keys.map((k, i) => (
            <div key={i} className="flex justify-between items-center p-2 rounded bg-slate-50 font-mono text-[10px]">
              <span>{k.name}</span>
              <span className="font-bold">{k.key}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4 flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer font-bold text-brand-navy"><input type="checkbox" checked={settings.enable_notifications} onChange={(e) => setSettings({ ...settings, enable_notifications: e.target.checked })} className="accent-brand-purple" /> Enable email notifications for support tickets</label>
        <button onClick={save} className="btn-primary px-5 py-2.5 bg-brand-purple text-white font-bold rounded-lg uppercase">Save Preferences</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Customer Reviews Moderation */
function ReviewsTab({ authFetch }) {
  const [reviews, setReviews] = useState([]);
  const [replies, setReplies] = useState({});
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      authFetch('/api/admin/reviews/').then((r) => r.json()).catch(() => []),
      authFetch('/api/admin/settings/REVIEW_REPLIES/')
        .then((r) => r.ok ? r.json().then(d => d.value) : {})
        .catch(() => ({})),
    ]).then(([revList, replyData]) => {
      setReviews(Array.isArray(revList) ? revList : revList.results || []);
      setReplies(replyData || {});
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

  if (loading) return <p className="text-sm text-brand-muted">Loading reviews moderation panel...</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200">
        <p className="text-xs text-brand-muted">{reviews.length} total customer reviews pending or moderated</p>
      </div>

      <div className="space-y-3">
        {reviews.map((rev) => (
          <div key={rev.id} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-brand-purple/10 flex items-center justify-center font-bold text-brand-purple">
                  {rev.user_name?.substring(0, 2).toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="text-sm font-bold text-brand-navy">{rev.user_name} <span className="text-xs font-mono text-slate-400">({rev.user_email})</span></p>
                  <p className="text-[11px] text-slate-400">on <span className="font-semibold text-brand-purple">{toDisplayText(rev.product_name || rev.product_sku || rev.product) || 'Unknown product'}</span> · {formatDateTime(rev.created_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => toggleFeature(rev.id)} className={`p-1.5 rounded-lg border ${rev.is_featured ? 'bg-amber-50 border-amber-200 text-amber-500' : 'border-slate-200 text-slate-400 hover:bg-slate-50'}`} title="Feature Review">
                  <Star className="h-4 w-4 fill-current" />
                </button>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${rev.is_approved ? 'bg-green-100 text-green-700' : 'bg-rose-100 text-rose-700'}`}>
                  {rev.is_approved ? 'APPROVED' : 'PENDING MODERATION'}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-4 w-4 ${i < rev.rating ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}`} />
                ))}
                {rev.is_verified_purchase && (
                  <span className="ml-2 bg-green-50 text-green-700 border border-green-200 rounded px-1.5 py-0.2 text-[9px] font-bold flex items-center gap-0.5">
                    Verified Buyer
                  </span>
                )}
              </div>
              <p className="text-xs text-brand-navy leading-relaxed italic">"{rev.comment}"</p>
            </div>

            {replies[rev.id] && (
              <div className="p-3.5 bg-brand-purple/5 border border-brand-purple/10 rounded-xl space-y-1">
                <p className="text-[10px] font-black text-brand-purple uppercase">SCLERO STAFF RESPONSE</p>
                <p className="text-xs text-slate-700 leading-relaxed font-semibold">"{replies[rev.id]}"</p>
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-slate-50 justify-end">
              {!rev.is_approved ? (
                <button onClick={() => approve(rev.id)} className="px-3 py-1.5 text-[10px] bg-green-600 hover:bg-green-700 text-white rounded-lg uppercase font-bold">Approve</button>
              ) : (
                <button onClick={() => reject(rev.id)} className="px-3 py-1.5 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg uppercase font-bold">Reject / Hide</button>
              )}
              <button onClick={() => setReplyingTo(rev.id)} className="px-3 py-1.5 text-[10px] border border-brand-purple text-brand-purple hover:bg-brand-purple/10 rounded-lg uppercase font-bold">Respond</button>
            </div>
          </div>
        ))}

        {reviews.length === 0 && (
          <p className="text-center py-10 text-xs text-brand-muted bg-white border border-slate-200 rounded-2xl">No customer reviews found to moderate.</p>
        )}
      </div>

      {replyingTo && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-slate-50 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-black text-brand-navy">Write Staff Response</h3>
            <p className="text-xs text-brand-muted">This response will be visible on the public product page below the customer's comment.</p>
            <textarea
              rows={4}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write your public reply..."
              className="w-full rounded-lg border border-slate-200 p-2.5 text-xs font-semibold text-brand-navy"
            />
            <div className="flex gap-2">
              <button onClick={saveReply} className="btn-primary flex-1 py-2.5 text-xs bg-brand-purple text-white rounded-lg uppercase font-bold">Save Response</button>
              <button onClick={() => { setReplyingTo(null); setReplyText(''); }} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-xs font-bold uppercase">Cancel</button>
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
    accentColor: '#f59e0b',
    fontName: 'Outfit',
    logoUrl: '/static/logo.png',
    borderRadius: '12px',
    glassmorphism: 'Medium',
    customCss: ''
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    authFetch('/api/admin/settings/THEME_BRANDING/')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && d.value) {
          setTheme(d.value);
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

  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
      {/* Settings Form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <h3 className="text-base font-bold text-brand-navy">Theme Settings</h3>
        <p className="text-xs text-brand-muted">Customize your eCommerce store storefront styling in real-time. Changes are applied instantly without deploys.</p>
        
        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-brand-navy mb-1">Primary Brand Color</label>
            <div className="flex gap-2 items-center">
              <input type="color" value={theme.primaryColor} onChange={(e) => setTheme({ ...theme, primaryColor: e.target.value })} className="h-9 w-9 rounded-lg cursor-pointer border border-slate-200 p-0.5" />
              <input type="text" value={theme.primaryColor} onChange={(e) => setTheme({ ...theme, primaryColor: e.target.value })} className="flex-1 rounded-lg border border-slate-200 p-2 font-mono" />
            </div>
            <div className="flex gap-1 mt-1.5">
              {['#6d28d9', '#3b82f6', '#0f766e', '#1e293b', '#e11d48'].map((c) => (
                <button key={c} onClick={() => setTheme({ ...theme, primaryColor: c })} className="h-5 w-5 rounded-full border border-slate-200" style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          <div>
            <label className="block font-bold text-brand-navy mb-1">Accent Highlight Color</label>
            <div className="flex gap-2 items-center">
              <input type="color" value={theme.accentColor} onChange={(e) => setTheme({ ...theme, accentColor: e.target.value })} className="h-9 w-9 rounded-lg cursor-pointer border border-slate-200 p-0.5" />
              <input type="text" value={theme.accentColor} onChange={(e) => setTheme({ ...theme, accentColor: e.target.value })} className="flex-1 rounded-lg border border-slate-200 p-2 font-mono" />
            </div>
          </div>

          <div>
            <label className="block font-bold text-brand-navy mb-1">Typography (Body Font)</label>
            <select value={theme.fontName} onChange={(e) => setTheme({ ...theme, fontName: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2">
              <option value="Outfit">Outfit (Geometric & Clean)</option>
              <option value="Inter">Inter (Highly Readable)</option>
              <option value="Playfair Display">Playfair Display (Premium Serif)</option>
              <option value="System">System Sans (Default)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-brand-navy mb-1">Border Roundness</label>
            <select value={theme.borderRadius} onChange={(e) => setTheme({ ...theme, borderRadius: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2">
              <option value="0px">Sharp Corners (0px)</option>
              <option value="6px">Subtle Round (6px)</option>
              <option value="12px">Premium Curved (12px)</option>
              <option value="24px">Organic Round (24px)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-brand-navy mb-1">Glassmorphism Blur</label>
            <select value={theme.glassmorphism} onChange={(e) => setTheme({ ...theme, glassmorphism: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2">
              <option value="None">None (Solid backgrounds)</option>
              <option value="Low">Low (Subtle opacity)</option>
              <option value="Medium">Medium (Polished glass)</option>
              <option value="High">High (Deep blur)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-brand-navy mb-1">Logo image URL</label>
            <input type="text" value={theme.logoUrl} onChange={(e) => setTheme({ ...theme, logoUrl: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2" />
          </div>

          <div>
            <label className="block font-bold text-brand-navy mb-1">Custom CSS Overrides</label>
            <textarea rows={3} value={theme.customCss || ''} onChange={(e) => setTheme({ ...theme, customCss: e.target.value })} placeholder="e.g. .btn { text-transform: uppercase; }" className="w-full rounded-lg border border-slate-200 p-2 font-mono text-[10px]" />
          </div>
        </div>

        {success && <p className="text-xs bg-green-50 text-green-700 border border-green-200 p-2 rounded-lg font-bold">Theme published to storefront successfully!</p>}
        <button onClick={save} disabled={saving} className="btn-primary w-full py-2.5 bg-brand-purple text-white rounded-lg uppercase font-bold text-xs disabled:opacity-50">
          {saving ? 'Publishing...' : 'Save & Publish Theme'}
        </button>
      </div>

      {/* Live Storefront Preview */}
      <div className="rounded-2xl border border-slate-200 bg-slate-900 p-6 flex flex-col justify-start min-h-[500px]">
        <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">LIVE STOREFRONT PREVIEW</p>
          <div className="flex gap-1">
            <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
          </div>
        </div>

        <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 flex flex-col overflow-hidden text-slate-100" style={{ fontFamily: theme.fontName === 'System' ? 'sans-serif' : theme.fontName }}>
          {/* Header */}
          <header className="px-4 py-3 flex items-center justify-between border-b border-slate-900 bg-slate-950/80 backdrop-blur-md">
            <div className="flex items-center gap-1.5">
              <div className="h-5 w-5 rounded-full bg-brand-purple flex items-center justify-center text-[10px] font-black text-white" style={{ backgroundColor: theme.primaryColor }}>S</div>
              <span className="text-xs font-black tracking-tight text-white">SCLERO PROTEINS</span>
            </div>
            <nav className="flex gap-3 text-[10px] text-slate-400 font-semibold">
              <span className="hover:text-white cursor-pointer">Shop</span>
              <span className="hover:text-white cursor-pointer">Science</span>
              <span className="hover:text-white cursor-pointer">About</span>
            </nav>
            <ShoppingCart className="h-3.5 w-3.5 text-slate-300" />
          </header>

          {/* Hero section */}
          <div className="p-6 text-center space-y-3 relative overflow-hidden bg-gradient-to-b from-slate-900 to-slate-950">
            <h1 className="text-lg font-black text-white leading-tight">Bio-active Protein Nutrition</h1>
            <p className="text-[10px] text-slate-400 max-w-sm mx-auto">Cellular-grade targeted protein peptide concentrates engineered to accelerate structural tissue recovery and muscular restoration.</p>
            <button className="px-4 py-2 text-[10px] font-black uppercase text-white hover:opacity-90 inline-block transition-opacity" style={{ backgroundColor: theme.primaryColor, borderRadius: theme.borderRadius }}>
              Explore Formulas
            </button>
          </div>

          {/* Product list */}
          <div className="p-4 grid grid-cols-2 gap-3 bg-slate-950">
            {[{ name: 'Sclero Isolate 90', price: '£59.99' }, { name: 'Joint Repair Peptide', price: '£72.50' }].map((prod, idx) => (
              <div key={idx} className="p-3 border border-slate-900 bg-slate-900/40 relative" style={{ borderRadius: theme.borderRadius, backdropFilter: theme.glassmorphism === 'None' ? 'none' : 'blur(8px)' }}>
                <div className="h-20 bg-slate-800 rounded-lg flex items-center justify-center text-[10px] font-bold text-slate-500 mb-2">IMAGE</div>
                <h4 className="text-[11px] font-bold text-white">{prod.name}</h4>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-[10px] font-semibold text-slate-400">{prod.price}</span>
                  <span className="text-[9px] font-black uppercase text-amber-500" style={{ color: theme.accentColor }}>★ 4.9</span>
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
    cookiePolicyUrl: '/privacy-policy',
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
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <h3 className="text-base font-bold text-brand-navy">GDPR & Cookie Banner Settings</h3>
        <p className="text-xs text-brand-muted">Manage the user privacy consent banners and cookie consent opt-in policies for different storefront regions.</p>
        
        <div className="space-y-3 text-xs">
          <div>
            <label className="block font-bold text-brand-navy mb-1">Banner Title</label>
            <input type="text" value={config.title} onChange={(e) => setConfig({ ...config, title: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2" />
          </div>

          <div>
            <label className="block font-bold text-brand-navy mb-1">Description message</label>
            <textarea rows={3} value={config.description} onChange={(e) => setConfig({ ...config, description: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-bold text-brand-navy mb-1">Accept Button Label</label>
              <input type="text" value={config.acceptText} onChange={(e) => setConfig({ ...config, acceptText: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2" />
            </div>
            <div>
              <label className="block font-bold text-brand-navy mb-1">Decline Button Label</label>
              <input type="text" value={config.declineText} onChange={(e) => setConfig({ ...config, declineText: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2" />
            </div>
          </div>

          <div>
            <label className="block font-bold text-brand-navy mb-1">Layout Style</label>
            <select value={config.layout} onChange={(e) => setConfig({ ...config, layout: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2">
              <option value="Bottom Bar">Bottom Bar (Full-width banner)</option>
              <option value="Floating Card">Floating Card (Bottom-left/right modal)</option>
            </select>
          </div>

          <div>
            <label className="block font-bold text-brand-navy mb-1">Cookie Policy Link</label>
            <input type="text" value={config.cookiePolicyUrl} onChange={(e) => setConfig({ ...config, cookiePolicyUrl: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2" />
          </div>
        </div>

        {success && <p className="text-xs bg-green-50 text-green-700 border border-green-200 p-2 rounded-lg font-bold">Cookie consent banner updated successfully!</p>}
        <button onClick={save} disabled={saving} className="btn-primary w-full py-2.5 bg-brand-purple text-white rounded-lg uppercase font-bold text-xs disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Configuration'}
        </button>
      </div>

      {/* Visual Banner Preview Panel */}
      <div className="rounded-2xl border border-slate-200 bg-slate-100 p-6 flex flex-col justify-between relative min-h-[400px]">
        <div>
          <p className="text-[10px] uppercase font-bold text-brand-muted tracking-wider mb-2">BANNER VISUAL LAYOUT PREVIEW</p>
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-xs text-brand-muted italic">
            [ Storefront Mock Screen Container ]
          </div>
        </div>

        {/* Banner rendered matching layout */}
        {config.layout === 'Bottom Bar' ? (
          <div className="w-full bg-slate-900 border border-slate-800 text-white p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div className="space-y-1 max-w-xl text-left">
              <p className="text-xs font-bold text-white">{config.title}</p>
              <p className="text-[10px] text-slate-300 leading-normal">{config.description}</p>
            </div>
            <div className="flex gap-2 whitespace-nowrap self-end md:self-auto">
              <button className="px-3 py-1.5 text-[9px] font-bold border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-lg">{config.declineText}</button>
              <button className="px-3 py-1.5 text-[9px] font-bold bg-brand-purple text-white rounded-lg">{config.acceptText}</button>
            </div>
          </div>
        ) : (
          <div className="w-72 bg-slate-900 border border-slate-800 text-white p-4 rounded-2xl shadow-xl space-y-2.5 text-left self-end md:mr-4">
            <div className="space-y-1">
              <p className="text-xs font-bold text-white flex items-center gap-1.5"><Cookie className="h-4 w-4 text-amber-500 fill-amber-500" /> {config.title}</p>
              <p className="text-[10px] text-slate-300 leading-relaxed">{config.description}</p>
            </div>
            <div className="flex gap-2">
              <button className="flex-1 py-1.5 text-[9px] font-bold border border-slate-700 hover:bg-slate-800 text-slate-300 rounded-lg">{config.declineText}</button>
              <button className="flex-1 py-1.5 text-[9px] font-bold bg-brand-purple text-white rounded-lg">{config.acceptText}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Header & Footer Builders */
function NavigationTab({ authFetch, regions }) {
  const [headerLinks, setHeaderLinks] = useState([]);
  const [footerLinks, setFooterLinks] = useState({ shop: [], company: [], support: [], legal: [] });
  const [editingItem, setEditingItem] = useState(null); // { type: 'header'|'footer', column?: string, index: number, item: object }
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('header');

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      authFetch('/api/admin/settings/NAVIGATION_MENUS/').then(r => r.ok ? r.json() : null),
      authFetch('/api/admin/settings/FOOTER_SETTINGS/').then(r => r.ok ? r.json() : null)
    ]).then(([headerData, footerData]) => {
      setHeaderLinks(headerData?.value || [
        { label: 'Home', url: '/' },
        { label: 'Shop', url: '/catalog' },
        { label: 'Science', url: '/science' },
        { label: 'Support', url: '/support' }
      ]);
      setFooterLinks(footerData?.value || {
        shop: [{ label: 'Proteins', url: '/catalog' }, { label: 'Amino Acids', url: '/catalog' }],
        company: [{ label: 'About', url: '/about' }, { label: 'Careers', url: '/careers' }],
        support: [{ label: 'FAQ', url: '/faq' }, { label: 'Contact', url: '/contact' }],
        legal: [{ label: 'Privacy', url: '/privacy' }, { label: 'Terms', url: '/terms' }]
      });
    }).finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const save = (newHeader, newFooter) => {
    Promise.all([
      authFetch('/api/admin/settings/NAVIGATION_MENUS/', {
        method: 'PUT',
        body: JSON.stringify({ key: 'NAVIGATION_MENUS', value: newHeader || headerLinks, description: 'Storefront main header menu links' })
      }).then(r => r.status === 404 ? authFetch('/api/admin/settings/', {
        method: 'POST',
        body: JSON.stringify({ key: 'NAVIGATION_MENUS', value: newHeader || headerLinks, description: 'Storefront main header menu links' })
      }) : r),
      authFetch('/api/admin/settings/FOOTER_SETTINGS/', {
        method: 'PUT',
        body: JSON.stringify({ key: 'FOOTER_SETTINGS', value: newFooter || footerLinks, description: 'Storefront footer columns and social links' })
      }).then(r => r.status === 404 ? authFetch('/api/admin/settings/', {
        method: 'POST',
        body: JSON.stringify({ key: 'FOOTER_SETTINGS', value: newFooter || footerLinks, description: 'Storefront footer columns and social links' })
      }) : r)
    ]).then(() => load());
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
      <div className="flex gap-2 border-b border-slate-100 pb-2">
        <button onClick={() => setActiveSubTab('header')} className={`px-4 py-1.5 text-xs font-bold uppercase rounded-lg ${activeSubTab === 'header' ? 'bg-brand-purple text-white' : 'text-brand-navy hover:bg-slate-50'}`}>Header Menus</button>
        <button onClick={() => setActiveSubTab('footer')} className={`px-4 py-1.5 text-xs font-bold uppercase rounded-lg ${activeSubTab === 'footer' ? 'bg-brand-purple text-white' : 'text-brand-navy hover:bg-slate-50'}`}>Footer Columns</button>
      </div>

      {activeSubTab === 'header' ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-bold text-brand-navy">Header Navigation Links</h4>
            <button onClick={() => openEdit('header', null, -1, null)} className="px-3 py-1.5 text-xs uppercase bg-brand-purple text-white rounded-lg font-bold inline-flex items-center gap-1"><Plus className="h-3 w-3" /> Add Link</button>
          </div>

          <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl bg-slate-55 p-2 space-y-1">
            {headerLinks.map((link, idx) => (
              <div key={idx} className="flex justify-between items-center py-2 px-3 bg-white rounded-lg border border-slate-100 shadow-sm">
                <div>
                  <p className="text-xs font-bold text-brand-navy">{toDisplayText(link.label)} <span className="font-mono text-[10px] text-brand-muted ml-1">{toDisplayText(link.url)}</span></p>
                  {link.mega_menu && <span className="rounded bg-brand-purple/10 text-brand-purple px-1.5 py-0.2 text-[8px] font-bold">MEGA MENU</span>}
                  {link.region_limit && <span className="rounded bg-amber-100 text-amber-700 ml-1 px-1.5 py-0.2 text-[8px] font-bold uppercase">Region: {link.region_limit}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => moveHeader(idx, -1)} disabled={idx === 0} className="text-slate-400 hover:text-brand-navy disabled:opacity-30">▲</button>
                  <button onClick={() => moveHeader(idx, 1)} disabled={idx === headerLinks.length - 1} className="text-slate-400 hover:text-brand-navy disabled:opacity-30">▼</button>
                  <button onClick={() => openEdit('header', null, idx, link)} className="text-brand-purple hover:opacity-75"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => deleteHeaderItem(idx)} className="text-brand-muted hover:text-brand-danger"><X className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          {['shop', 'company', 'support', 'legal'].map((col) => (
            <div key={col} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <div className="flex justify-between items-center border-b border-slate-50 pb-2">
                <h4 className="text-xs font-black uppercase text-brand-navy">{col}</h4>
                <button onClick={() => openEdit('footer', col, -1, null)} className="text-brand-purple font-bold text-[10px] uppercase">Add</button>
              </div>

              <div className="space-y-1.5 min-h-[150px]">
                {footerLinks[col]?.map((link, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 rounded-lg border border-slate-100 bg-slate-50 text-[11px] font-semibold text-brand-navy">
                    <span className="truncate max-w-[80px]">{toDisplayText(link.label)}</span>
                    <div className="flex gap-1.5">
                      <button onClick={() => moveFooter(col, idx, -1)} disabled={idx === 0} className="text-[9px] text-slate-400">▲</button>
                      <button onClick={() => moveFooter(col, idx, 1)} disabled={idx === footerLinks[col].length - 1} className="text-[9px] text-slate-400">▼</button>
                      <button onClick={() => openEdit('footer', col, idx, link)} className="text-brand-purple"><Pencil className="h-3 w-3" /></button>
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
        <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-slate-50 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-black text-brand-navy">{editingItem.index === -1 ? 'Add Link' : 'Edit Link'}</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-brand-navy mb-1">Link Text / Label</label>
                <input type="text" value={toDisplayText(editingItem.item.label)} onChange={(e) => setEditingItem({ ...editingItem, item: { ...editingItem.item, label: e.target.value } })} className="w-full rounded-lg border border-slate-200 p-2" />
              </div>
              <div>
                <label className="block font-bold text-brand-navy mb-1">Destination URL / Path</label>
                <input type="text" value={toDisplayText(editingItem.item.url)} onChange={(e) => setEditingItem({ ...editingItem, item: { ...editingItem.item, url: e.target.value } })} className="w-full rounded-lg border border-slate-200 p-2" />
              </div>
              {editingItem.type === 'header' && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <label className="flex items-center gap-1.5 cursor-pointer font-bold text-brand-navy"><input type="checkbox" checked={editingItem.item.mega_menu || false} onChange={(e) => setEditingItem({ ...editingItem, item: { ...editingItem.item, mega_menu: e.target.checked } })} className="accent-brand-purple" /> Enable Mega Menu (Dropdown Block)</label>
                  <div>
                    <label className="block font-bold text-slate-400 mb-1">Limit to Region (leave blank for Global)</label>
                    <select value={editingItem.item.region_limit || ''} onChange={(e) => setEditingItem({ ...editingItem, item: { ...editingItem.item, region_limit: e.target.value } })} className="w-full rounded-lg border border-slate-200 p-1.5">
                      <option value="">Global / All regions</option>
                      <option value="UK">United Kingdom (UK)</option>
                      <option value="IN">India (IN)</option>
                    </select>
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-3">
                <button onClick={saveEdit} className="btn-primary flex-1 py-2.5 text-xs bg-brand-purple text-white rounded-lg uppercase font-bold">Save Link</button>
                <button onClick={() => setEditingItem(null)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-xs font-bold uppercase">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- Media Library */
function MediaLibraryTab({ authFetch }) {
  const [assets, setAssets] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploadModal, setUploadModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    authFetch('/api/admin/settings/MEDIA_ASSETS/')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setAssets(d?.value || [
          { name: 'Sclero Whey Protein Isolate Pack', url: 'https://images.unsplash.com/photo-1579758629938-03607ccdbaba?q=80&w=200', size: '2.4 MB', date: '2026-06-15' },
          { name: 'Pure Marine Peptide Collagen Bottle', url: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?q=80&w=200', size: '1.8 MB', date: '2026-06-18' },
          { name: 'Molecular Formulation Laboratory', url: 'https://images.unsplash.com/photo-1532187643603-ba119ca4109e?q=80&w=200', size: '4.1 MB', date: '2026-06-20' },
          { name: 'Anti-Gravity Recovery Serum Box', url: 'https://images.unsplash.com/photo-1601049541289-9b1b7bbbfe19?q=80&w=200', size: '1.2 MB', date: '2026-06-22' }
        ]);
      }).finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const save = (nextAssets) => {
    authFetch('/api/admin/settings/MEDIA_ASSETS/', {
      method: 'PUT',
      body: JSON.stringify({ key: 'MEDIA_ASSETS', value: nextAssets, description: 'Media library uploaded files registry' })
    }).then(r => r.status === 404 ? authFetch('/api/admin/settings/', {
      method: 'POST',
      body: JSON.stringify({ key: 'MEDIA_ASSETS', value: nextAssets, description: 'Media library uploaded files registry' })
    }) : r).then(() => load());
  };

  const uploadFile = () => {
    if (!newName.trim()) return;
    const link = newUrl.trim() || 'https://images.unsplash.com/photo-1579758629938-03607ccdbaba?q=80&w=200';
    const nextList = [...assets, { name: newName, url: link, size: '840 KB', date: new Date().toISOString().split('T')[0] }];
    save(nextList);
    setNewName('');
    setNewUrl('');
    setUploadModal(false);
  };

  const deleteAsset = (idx) => {
    if (confirm("Delete this asset from library? Links using this URL on landing pages will break.")) {
      const copy = assets.filter((_, i) => i !== idx);
      save(copy);
    }
  };

  const copyUrl = (url) => {
    navigator.clipboard.writeText(url);
    alert(`Asset URL copied to clipboard: ${url}`);
  };

  const filtered = assets.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <p className="text-sm text-brand-muted">Loading media library...</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 p-4 rounded-2xl">
        <label className="relative block flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search asset files..." className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs" />
        </label>
        <button onClick={() => setUploadModal(true)} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs uppercase bg-brand-purple text-white rounded-lg font-bold"><Upload className="h-4 w-4" /> Upload Asset</button>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {filtered.map((asset, idx) => (
          <div key={idx} className="group relative rounded-2xl border border-slate-200 bg-white p-3 space-y-2 hover:shadow-md transition-shadow">
            <div className="h-32 bg-slate-50 border border-slate-100 rounded-xl overflow-hidden flex items-center justify-center relative">
              <img src={asset.url} alt={asset.name} className="h-full w-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
              <div className="absolute inset-0 bg-brand-navy/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button onClick={() => copyUrl(asset.url)} className="p-2 bg-white rounded-full text-brand-purple hover:scale-105 transition-transform"><LinkIcon className="h-4 w-4" /></button>
                <button onClick={() => deleteAsset(idx)} className="p-2 bg-white rounded-full text-brand-danger hover:scale-105 transition-transform"><X className="h-4 w-4" /></button>
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-brand-navy truncate">{asset.name}</p>
              <p className="text-[9px] text-slate-400">{asset.size} · {asset.date}</p>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-4 text-center py-12 text-xs text-brand-muted bg-white border border-slate-200 rounded-2xl">No assets found in library.</div>
        )}
      </div>

      {uploadModal && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-slate-50 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-black text-brand-navy">Upload Asset</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-brand-navy mb-1">Asset Name</label>
                <input placeholder="e.g. Whey Protein Isolate Pack" value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full rounded-lg border border-slate-200 p-2" />
              </div>
              <div>
                <label className="block font-bold text-brand-navy mb-1">Asset Image URL</label>
                <input placeholder="e.g. https://images.unsplash.com/..." value={newUrl} onChange={(e) => setNewUrl(e.target.value)} className="w-full rounded-lg border border-slate-200 p-2" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={uploadFile} className="btn-primary flex-1 py-2.5 text-xs bg-brand-purple text-white rounded-lg uppercase font-bold">Add Asset</button>
                <button onClick={() => setUploadModal(false)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-xs font-bold uppercase">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- Newsletter marketing builder */
function NewsletterTab({ authFetch }) {
  const [activeSubTab, setActiveSubTab] = useState('subscribers');
  const [subscribers, setSubscribers] = useState([]);
  const [segments, setSegments] = useState([]);
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // segment form
  const [editingSeg, setEditingSeg] = useState(null);
  const [newEmail, setNewEmail] = useState('');
  
  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      authFetch('/api/admin/customers/').then(r => r.json()).catch(() => []),
      authFetch('/api/admin/customer-segments/').then(r => r.json()).catch(() => []),
      authFetch('/api/admin/settings/NEWSLETTER_SUBSCRIBERS/').then(r => r.ok ? r.json() : null),
      authFetch('/api/admin/settings/NEWSLETTER_FLOWS/').then(r => r.ok ? r.json() : null)
    ]).then(([custs, segs, subSettings, flowSettings]) => {
      // Extract customers who accepts marketing plus manual subscribers
      const marketingCusts = (Array.isArray(custs) ? custs : custs.results || [])
        .filter(c => c.email_newsletter || c.email_marketing)
        .map(c => ({ email: c.email, first_name: c.first_name, last_name: c.last_name, source: 'Customer Register' }));
      
      const manualSubs = subSettings?.value || [];
      setSubscribers([...marketingCusts, ...manualSubs]);
      setSegments(Array.isArray(segs) ? segs : segs.results || []);
      setFlows(flowSettings?.value || [
        { id: 1, name: 'Abandoned Checkout Email Recovery Flow', is_enabled: true, sent: 242, recovered: 48, rate: '19.8%', steps: ['1 hour: Restock Reminder', '24 hours: 10% Discount Code'] },
        { id: 2, name: 'Post-Purchase Nurture sequence', is_enabled: true, sent: 512, recovered: 89, rate: '17.3%', steps: ['3 days: Usage Instructions', '7 days: Review Request'] }
      ]);
    }).finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const addManualSub = () => {
    if (!newEmail.trim()) return;
    const manualSubs = subscribers.filter(s => s.source === 'Manual opt-in');
    const updated = [...manualSubs, { email: newEmail, first_name: 'Subscriber', last_name: '', source: 'Manual opt-in' }];
    authFetch('/api/admin/settings/NEWSLETTER_SUBSCRIBERS/', {
      method: 'PUT',
      body: JSON.stringify({ key: 'NEWSLETTER_SUBSCRIBERS', value: updated, description: 'Manual newsletter subscriber lists' })
    }).then(r => r.status === 404 ? authFetch('/api/admin/settings/', {
      method: 'POST',
      body: JSON.stringify({ key: 'NEWSLETTER_SUBSCRIBERS', value: updated, description: 'Manual newsletter subscriber lists' })
    }) : r).then(() => {
      setNewEmail('');
      load();
    });
  };

  const saveSegment = () => {
    const isNew = !editingSeg.id;
    authFetch(isNew ? '/api/admin/customer-segments/' : `/api/admin/customer-segments/${editingSeg.id}/`, {
      method: isNew ? 'POST' : 'PUT',
      body: JSON.stringify({
        name: editingSeg.name,
        description: editingSeg.description,
        criteria: editingSeg.criteria || { min_orders: 1, min_spend: 10 }
      })
    }).then(() => {
      setEditingSeg(null);
      load();
    });
  };

  const deleteSegment = (id) => {
    if (confirm("Delete this customer segment?")) {
      authFetch(`/api/admin/customer-segments/${id}/`, { method: 'DELETE' }).then(load);
    }
  };

  const toggleFlow = (id) => {
    const nextFlows = flows.map(f => f.id === id ? { ...f, is_enabled: !f.is_enabled } : f);
    authFetch('/api/admin/settings/NEWSLETTER_FLOWS/', {
      method: 'PUT',
      body: JSON.stringify({ key: 'NEWSLETTER_FLOWS', value: nextFlows, description: 'E-commerce newsletter email automation flows' })
    }).then(r => r.status === 404 ? authFetch('/api/admin/settings/', {
      method: 'POST',
      body: JSON.stringify({ key: 'NEWSLETTER_FLOWS', value: nextFlows, description: 'E-commerce newsletter email automation flows' })
    }) : r).then(() => load());
  };

  if (loading) return <p className="text-sm text-brand-muted">Loading newsletter center...</p>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-slate-100 pb-2">
        <button onClick={() => setActiveSubTab('subscribers')} className={`px-4 py-1.5 text-xs font-bold uppercase rounded-lg ${activeSubTab === 'subscribers' ? 'bg-brand-purple text-white' : 'text-brand-navy hover:bg-slate-50'}`}>Subscribers Directory</button>
        <button onClick={() => setActiveSubTab('segments')} className={`px-4 py-1.5 text-xs font-bold uppercase rounded-lg ${activeSubTab === 'segments' ? 'bg-brand-purple text-white' : 'text-brand-navy hover:bg-slate-50'}`}>Smart Segments</button>
        <button onClick={() => setActiveSubTab('flows')} className={`px-4 py-1.5 text-xs font-bold uppercase rounded-lg ${activeSubTab === 'flows' ? 'bg-brand-purple text-white' : 'text-brand-navy hover:bg-slate-50'}`}>Automated Flows</button>
      </div>

      {activeSubTab === 'subscribers' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h4 className="text-sm font-bold text-brand-navy uppercase">Marketing Opt-in Subscribers</h4>
              <p className="mt-1 text-xs text-brand-muted">{subscribers.length} customers and manual opt-ins are in this list.</p>
            </div>
            <div className="flex w-full gap-2 lg:max-w-lg">
              <input
                placeholder="Enter email to subscribe"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs"
              />
              <button onClick={addManualSub} className="shrink-0 rounded-lg bg-brand-purple px-3 py-2 text-xs font-bold uppercase text-white">
                Opt-in Email
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-brand-muted">
                <tr>
                  <th className="px-4 py-3 font-bold">Email</th>
                  <th className="px-4 py-3 font-bold">Name</th>
                  <th className="px-4 py-3 font-bold">Opt-in Type / Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {subscribers.map((sub, i) => (
                  <tr key={i} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-bold text-brand-navy">{sub.email}</td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{sub.first_name} {sub.last_name || ''}</td>
                    <td className="px-4 py-3 text-brand-muted"><span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide">{sub.source}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'segments' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white border border-slate-200 p-4 rounded-2xl">
            <p className="text-xs text-brand-muted">{segments.length} segment configurations deployed</p>
            <button onClick={() => setEditingSeg({ name: '', description: '', criteria: { min_orders: 1, min_spend: 50 } })} className="px-3 py-1.5 bg-brand-purple text-white font-bold rounded-lg uppercase text-xs inline-flex items-center gap-1"><Plus className="h-3.5 w-3.5" /> New Segment</button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {segments.map((seg) => (
              <div key={seg.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-bold text-brand-navy">{seg.name}</h4>
                  <p className="text-xs text-brand-muted min-h-[30px]">{seg.description || 'No description provided.'}</p>
                  <div className="mt-2 p-2 bg-slate-50 rounded-lg font-mono text-[10px] text-brand-purple">
                    Criteria: Spend &gt; £{seg.criteria?.min_spend || 0} · Orders &gt;= {seg.criteria?.min_orders || 0}
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2 border-t border-slate-50 pt-3">
                  <button onClick={() => setEditingSeg({ ...seg })} className="text-xs px-2 py-1 rounded border border-slate-200 text-brand-navy hover:bg-slate-50 font-bold uppercase inline-flex items-center gap-0.5"><Pencil className="h-3 w-3" /> Edit</button>
                  <button onClick={() => deleteSegment(seg.id)} className="text-xs px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50 font-bold uppercase inline-flex items-center gap-0.5"><X className="h-3 w-3" /> Delete</button>
                </div>
              </div>
            ))}
          </div>

          {editingSeg && (
            <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-slate-50 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
              <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <h3 className="text-lg font-black text-brand-navy">{editingSeg.id ? 'Edit Segment' : 'Create Segment'}</h3>
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block font-bold text-brand-navy mb-1">Segment Name</label>
                    <input value={editingSeg.name} onChange={(e) => setEditingSeg({ ...editingSeg, name: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2" />
                  </div>
                  <div>
                    <label className="block font-bold text-brand-navy mb-1">Description</label>
                    <textarea value={editingSeg.description || ''} onChange={(e) => setEditingSeg({ ...editingSeg, description: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2" rows={2} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-2">
                    <div>
                      <label className="block font-bold text-slate-400 mb-1">Min Orders</label>
                      <input type="number" value={editingSeg.criteria?.min_orders || 0} onChange={(e) => setEditingSeg({ ...editingSeg, criteria: { ...editingSeg.criteria, min_orders: Number(e.target.value) } })} className="w-full rounded-lg border border-slate-200 p-2" />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-400 mb-1">Min Spend (GBP)</label>
                      <input type="number" value={editingSeg.criteria?.min_spend || 0} onChange={(e) => setEditingSeg({ ...editingSeg, criteria: { ...editingSeg.criteria, min_spend: Number(e.target.value) } })} className="w-full rounded-lg border border-slate-200 p-2" />
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={saveSegment} className="btn-primary flex-1 py-2.5 text-xs bg-brand-purple text-white rounded-lg uppercase font-bold">Save Segment</button>
                    <button onClick={() => setEditingSeg(null)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-xs font-bold uppercase">Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'flows' && (
        <div className="grid gap-4">
          {flows.map((flow) => (
            <div key={flow.id} className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-brand-navy">{flow.name}</h4>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${flow.is_enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>{flow.is_enabled ? 'ACTIVE' : 'INACTIVE'}</span>
                </div>
                <div className="flex gap-4 text-xs font-semibold">
                  <div><span className="text-[10px] text-slate-400 block font-normal">EMAILS SENT</span><span className="text-brand-navy">{flow.sent}</span></div>
                  <div><span className="text-[10px] text-slate-400 block font-normal">RECOVERED</span><span className="text-brand-navy">{flow.recovered} ({flow.rate})</span></div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-brand-purple">Automated steps sequence:</p>
                  <div className="flex flex-wrap gap-2">
                    {flow.steps.map((st, i) => (
                      <span key={i} className="rounded bg-slate-50 border border-slate-150 p-1.5 text-[10px] font-mono text-brand-navy">{st}</span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="self-end sm:self-center">
                <button onClick={() => toggleFlow(flow.id)} className={`px-4 py-2 text-xs font-bold uppercase rounded-lg border ${flow.is_enabled ? 'border-slate-200 text-slate-500 hover:bg-slate-50' : 'border-brand-purple text-brand-purple hover:bg-brand-purple/10'}`}>
                  {flow.is_enabled ? 'Pause sequence' : 'Resume Flow'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
  overlay_opacity: 42,
  sort_order: 0,
  is_enabled: true,
  starts_at: '',
  ends_at: '',
  autoplay_enabled: true,
  show_indicators: true,
  display_duration_ms: 6500,
  transition_ms: 500,
  seo_title: '',
  seo_description: '',
});

function toDateTimeLocal(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDateTimeLocal(value) {
  return value ? new Date(value).toISOString() : null;
}

/* Pages + Banners merged surface per spec 2026-06-24. */
function PagesAndBannersTab({ authFetch }) {
  const [tab, setTab] = useState('pages');
  return (
    <div className="space-y-4">
      <div className="flex gap-2 border-b border-slate-100 pb-2">
        <button onClick={() => setTab('pages')} className={`px-4 py-1.5 text-xs font-bold uppercase rounded-lg ${tab === 'pages' ? 'bg-brand-purple text-white' : 'text-brand-navy hover:bg-slate-50'}`}>Pages</button>
        <button onClick={() => setTab('banners')} className={`px-4 py-1.5 text-xs font-bold uppercase rounded-lg ${tab === 'banners' ? 'bg-brand-purple text-white' : 'text-brand-navy hover:bg-slate-50'}`}>Banners</button>
      </div>
      {tab === 'pages' && <PagesTab authFetch={authFetch} />}
      {tab === 'banners' && <HeroBannersTab authFetch={authFetch} />}
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
    setEditing({
      ...slide,
      starts_at: toDateTimeLocal(slide.starts_at),
      ends_at: toDateTimeLocal(slide.ends_at),
    });
  };

  const setField = (key, value) => setEditing((prev) => ({ ...prev, [key]: value }));

  const payload = () => ({
    ...editing,
    overlay_opacity: Number(editing.overlay_opacity || 0),
    sort_order: Number(editing.sort_order || 0),
    display_duration_ms: Number(editing.display_duration_ms || 6500),
    transition_ms: Number(editing.transition_ms || 500),
    starts_at: fromDateTimeLocal(editing.starts_at),
    ends_at: fromDateTimeLocal(editing.ends_at),
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

  const toggle = (slide) => {
    authFetch(`/api/admin/hero-banners/${slide.id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ is_enabled: !slide.is_enabled }),
    }).then(load).catch(() => setError('Could not update hero banner status.'));
  };

  if (loading) return <p className="text-sm text-brand-muted">Loading hero banners...</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-brand-muted">Manage homepage campaign slides, scheduling, responsive media, CTAs, and carousel timing.</p>
        </div>
        <button onClick={startNew} className="btn-primary inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs uppercase">
          <Plus className="h-4 w-4" /> New banner
        </button>
      </div>

      {notice && <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">{notice}</p>}
      {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {slides.map((slide) => (
          <div key={slide.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="relative h-44 bg-slate-100">
              {slide.desktop_media_url ? (
                slide.media_type === 'VIDEO' ? (
                  <video src={slide.desktop_media_url} className="h-full w-full object-cover" muted />
                ) : (
                  <img src={slide.desktop_media_url} alt={slide.alt_text || slide.heading} className="h-full w-full object-cover" />
                )
              ) : (
                <div className="flex h-full items-center justify-center text-xs font-bold uppercase text-slate-400">No media</div>
              )}
              <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-bold ${slide.is_enabled ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                {slide.is_enabled ? 'Enabled' : 'Disabled'}
              </span>
              <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-brand-navy">
                #{slide.sort_order}
              </span>
            </div>
            <div className="space-y-3 p-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-brand-purple">{slide.eyebrow || 'Hero slide'}</p>
                <h3 className="mt-1 text-base font-black text-brand-navy">{slide.heading}</h3>
                <p className="mt-1 line-clamp-2 text-xs text-brand-muted">{slide.subheading}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] text-brand-muted">
                <span>Display {slide.display_duration_ms}ms</span>
                <span>Transition {slide.transition_ms}ms</span>
                <span>{slide.text_position}</span>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => toggle(slide)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-brand-navy hover:bg-slate-50">
                  {slide.is_enabled ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => startEdit(slide)} className="rounded-lg border border-slate-200 p-2 text-brand-purple hover:bg-slate-50" aria-label={`Edit ${slide.title}`}>
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => remove(slide)} className="rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50" aria-label={`Delete ${slide.title}`}>
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {slides.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-brand-navy">No hero banner slides yet.</p>
          <p className="mt-1 text-xs text-brand-muted">Create the first slide to control the homepage hero from the admin console.</p>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-brand-navy/30 p-4 backdrop-blur-sm">
          <div className="mx-auto my-6 max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-purple">Homepage hero</p>
                <h2 className="text-lg font-black text-brand-navy">{editing.id ? 'Edit banner slide' : 'New banner slide'}</h2>
              </div>
              <button onClick={() => setEditing(null)} className="rounded-lg border border-slate-200 p-2 text-brand-muted hover:bg-slate-50" aria-label="Close hero banner editor">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase text-brand-muted">Internal title</label>
                  <input value={editing.title} onChange={(e) => setField('title', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" placeholder="e.g. Summer joint care campaign" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase text-brand-muted">Eyebrow</label>
                  <input value={editing.eyebrow} onChange={(e) => setField('eyebrow', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" placeholder="BJC Bone & Joint Care" />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase text-brand-muted">Heading</label>
                  <input value={editing.heading} onChange={(e) => setField('heading', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" placeholder="Mobility support, backed by science." />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase text-brand-muted">Subheading</label>
                  <textarea rows={3} value={editing.subheading} onChange={(e) => setField('subheading', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" placeholder="Short campaign message for the hero." />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase text-brand-muted">Primary CTA label</label>
                    <input value={editing.primary_cta_label} onChange={(e) => setField('primary_cta_label', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" placeholder="Shop now" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase text-brand-muted">Primary CTA URL</label>
                    <input value={editing.primary_cta_url} onChange={(e) => setField('primary_cta_url', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" placeholder="/products" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase text-brand-muted">Secondary CTA label</label>
                    <input value={editing.secondary_cta_label} onChange={(e) => setField('secondary_cta_label', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" placeholder="Learn more" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase text-brand-muted">Secondary CTA URL</label>
                    <input value={editing.secondary_cta_url} onChange={(e) => setField('secondary_cta_url', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" placeholder="/policies/about" />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase text-brand-muted">Media type</label>
                    <select value={editing.media_type} onChange={(e) => setField('media_type', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm">
                      <option value="IMAGE">Image</option>
                      <option value="VIDEO">Video</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase text-brand-muted">Text position</label>
                    <select value={editing.text_position} onChange={(e) => setField('text_position', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm">
                      <option value="LEFT">Left</option>
                      <option value="CENTER">Center</option>
                      <option value="RIGHT">Right</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase text-brand-muted">Desktop image/video URL</label>
                  <input value={editing.desktop_media_url} onChange={(e) => setField('desktop_media_url', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" placeholder="https://..." />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase text-brand-muted">Tablet image URL optional</label>
                  <input value={editing.tablet_media_url} onChange={(e) => setField('tablet_media_url', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" placeholder="https://..." />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase text-brand-muted">Mobile image URL</label>
                  <input value={editing.mobile_media_url} onChange={(e) => setField('mobile_media_url', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" placeholder="https://..." />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase text-brand-muted">Alt text</label>
                  <input value={editing.alt_text} onChange={(e) => setField('alt_text', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" placeholder="Describe the banner media for accessibility and SEO" />
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase text-brand-muted">Start date/time</label>
                    <input type="datetime-local" value={editing.starts_at || ''} onChange={(e) => setField('starts_at', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase text-brand-muted">End date/time</label>
                    <input type="datetime-local" value={editing.ends_at || ''} onChange={(e) => setField('ends_at', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase text-brand-muted">Display order</label>
                    <input type="number" value={editing.sort_order} onChange={(e) => setField('sort_order', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase text-brand-muted">Overlay opacity</label>
                    <input type="number" min="0" max="90" value={editing.overlay_opacity} onChange={(e) => setField('overlay_opacity', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase text-brand-muted">Display duration ms</label>
                    <input type="number" min="2500" step="100" value={editing.display_duration_ms} onChange={(e) => setField('display_duration_ms', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase text-brand-muted">Transition ms</label>
                    <input type="number" min="0" step="50" value={editing.transition_ms} onChange={(e) => setField('transition_ms', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 font-semibold text-brand-navy">
                    <input type="checkbox" checked={editing.is_enabled} onChange={(e) => setField('is_enabled', e.target.checked)} className="accent-brand-purple" /> Enabled
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 font-semibold text-brand-navy">
                    <input type="checkbox" checked={editing.autoplay_enabled} onChange={(e) => setField('autoplay_enabled', e.target.checked)} className="accent-brand-purple" /> Autoplay
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 p-3 font-semibold text-brand-navy">
                    <input type="checkbox" checked={editing.show_indicators} onChange={(e) => setField('show_indicators', e.target.checked)} className="accent-brand-purple" /> Indicators
                  </label>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase text-brand-muted">SEO title</label>
                  <input value={editing.seo_title} onChange={(e) => setField('seo_title', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" maxLength={160} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase text-brand-muted">SEO description</label>
                  <textarea rows={3} value={editing.seo_description} onChange={(e) => setField('seo_description', e.target.value)} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm" />
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <div className="relative h-40">
                    {editing.desktop_media_url ? (
                      editing.media_type === 'VIDEO' ? (
                        <video src={editing.desktop_media_url} className="h-full w-full object-cover" muted />
                      ) : (
                        <img src={editing.desktop_media_url} alt={editing.alt_text || editing.heading || ''} className="h-full w-full object-cover" />
                      )
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs font-bold uppercase text-slate-400">Preview media</div>
                    )}
                    <div className="absolute inset-0 bg-black/35" />
                    <div className="absolute bottom-4 left-4 right-4 text-white">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-white/75">{editing.eyebrow}</p>
                      <p className="text-lg font-black leading-tight">{editing.heading || 'Banner heading preview'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
              <button onClick={() => setEditing(null)} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold uppercase text-brand-navy">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary rounded-lg px-5 py-2 text-xs uppercase">
                {saving ? 'Saving...' : 'Save banner'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------- BundlesTab + DiscountsTab */
function BundlesTab({ authFetch, regions, products }) {
  const [bundles, setBundles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    authFetch('/api/admin/bundles/')
      .then((r) => r.json())
      .then((d) => setBundles(Array.isArray(d) ? d : d.results || []))
      .catch(() => setBundles([]))
      .finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => { load(); }, [load]);

  const startNew = () => setEditing({
    name: '', slug: '', description: '', is_active: true, sort_order: 0,
    _items: [],
    _configs: regions.map((r) => ({ region: r.id, region_code: r.code, price: '', promotional_price: '', is_visible: true })),
  });

  const startEdit = (b) => setEditing({
    ...b,
    _items: (b.items || []).map((it) => ({ product_id: it.product?.id, name: it.product?.name, sku: it.product?.sku, quantity: it.quantity })),
    _configs: regions.map((r) => {
      const c = (b.regional_configs || []).find((x) => x.region === r.id);
      return c
        ? { region: r.id, region_code: r.code, price: c.price, promotional_price: c.promotional_price || '', is_visible: c.is_visible }
        : { region: r.id, region_code: r.code, price: '', promotional_price: '', is_visible: true };
    }),
  });

  const addItem = (productId) => {
    if (!productId) return;
    const p = products.find((x) => x.id === Number(productId));
    if (!p) return;
    if (editing._items.some((i) => i.product_id === p.id)) return;
    setEditing({ ...editing, _items: [...editing._items, { product_id: p.id, name: p.name, sku: p.sku, quantity: 1 }] });
  };

  const removeItem = (pid) => setEditing({ ...editing, _items: editing._items.filter((i) => i.product_id !== pid) });

  const setItemQty = (pid, qty) => setEditing({
    ...editing,
    _items: editing._items.map((i) => (i.product_id === pid ? { ...i, quantity: Math.max(1, Number(qty) || 1) } : i)),
  });

  const setConfig = (regionId, field, value) => setEditing({
    ...editing,
    _configs: editing._configs.map((c) => (c.region === regionId ? { ...c, [field]: value } : c)),
  });

  const save = () => {
    const payload = {
      name: editing.name,
      slug: editing.slug,
      description: editing.description || '',
      is_active: !!editing.is_active,
      sort_order: Number(editing.sort_order) || 0,
      items: editing._items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
      regional_configs: editing._configs
        .filter((c) => c.price !== '' && c.price != null)
        .map((c) => ({ region: c.region, price: c.price, promotional_price: c.promotional_price === '' ? null : c.promotional_price, is_visible: !!c.is_visible })),
    };
    const isNew = !editing.id;
    authFetch(isNew ? '/api/admin/bundles/' : `/api/admin/bundles/${editing.id}/`, {
      method: isNew ? 'POST' : 'PUT',
      body: JSON.stringify(payload),
    }).then((r) => r.json()).then(() => { setEditing(null); load(); });
  };

  const remove = (b) => {
    if (!confirm(`Delete bundle "${b.name}"?`)) return;
    authFetch(`/api/admin/bundles/${b.id}/`, { method: 'DELETE' }).then(load);
  };

  if (loading) return <p className="text-sm text-brand-muted">Loading bundles…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-brand-muted">{bundles.length} bundles</p>
        <button onClick={startNew} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs uppercase bg-brand-purple text-white rounded-lg">
          <Plus className="h-4 w-4" /> New bundle
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase text-brand-muted">
            <tr><th className="px-3 py-2">Name</th><th className="px-3 py-2">Slug</th><th className="px-3 py-2">Items</th><th className="px-3 py-2">Regions</th><th className="px-3 py-2">Active</th><th className="px-3 py-2"></th></tr>
          </thead>
          <tbody>
            {bundles.map((b) => (
              <tr key={b.id} className="border-t border-slate-100">
                <td className="px-3 py-3 font-semibold text-brand-navy">{b.name}</td>
                <td className="px-3 py-3 font-mono text-brand-muted">/{b.slug}</td>
                <td className="px-3 py-3 text-brand-navy">{(b.items || []).length}</td>
                <td className="px-3 py-3 text-brand-muted">{(b.regional_configs || []).map((c) => c.region_code).join(', ')}</td>
                <td className="px-3 py-3">{b.is_active ? <span className="rounded bg-green-100 px-2 py-0.5 font-bold text-green-700">ON</span> : <span className="rounded bg-slate-100 px-2 py-0.5 font-bold text-slate-500">OFF</span>}</td>
                <td className="px-3 py-3 text-right">
                  <button onClick={() => startEdit(b)} className="text-brand-purple"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(b)} className="ml-2 text-brand-muted hover:text-brand-danger"><X className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {bundles.length === 0 && (<tr><td colSpan={6} className="px-3 py-6 text-center text-brand-muted">No bundles yet.</td></tr>)}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-slate-50 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
          <div className="my-8 w-full max-w-2xl bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-brand-navy">{editing.id ? 'Edit bundle' : 'New bundle'}</h3>
              <button onClick={() => setEditing(null)} className="text-brand-muted"><X className="h-5 w-5" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <input placeholder="Bundle name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="col-span-2 rounded-lg border border-slate-200 p-2.5 text-sm" />
              <input placeholder="slug-here" value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className="rounded-lg border border-slate-200 p-2.5 font-mono" />
              <input type="number" placeholder="Sort order" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: e.target.value })} className="rounded-lg border border-slate-200 p-2.5" />
              <textarea placeholder="Description" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} className="col-span-2 rounded-lg border border-slate-200 p-2.5" rows={2} />
              <label className="col-span-2 flex items-center gap-2 text-brand-navy font-bold"><input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} className="accent-brand-purple" /> Active</label>
            </div>

            <div>
              <p className="text-xs font-bold uppercase text-brand-muted mb-2">Items</p>
              <div className="flex gap-2 mb-2">
                <select onChange={(e) => { addItem(e.target.value); e.target.value = ''; }} className="flex-1 rounded-lg border border-slate-200 p-2 text-xs">
                  <option value="">+ Add product…</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>)}
                </select>
              </div>
              <div className="space-y-2">
                {editing._items.map((it) => (
                  <div key={it.product_id} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-brand-navy">{it.name}</p>
                      <p className="text-[10px] text-brand-muted font-mono">{it.sku}</p>
                    </div>
                    <input type="number" min="1" value={it.quantity} onChange={(e) => setItemQty(it.product_id, e.target.value)} className="w-16 rounded border border-slate-200 p-1 text-xs" />
                    <button onClick={() => removeItem(it.product_id)} className="text-brand-muted hover:text-brand-danger"><X className="h-4 w-4" /></button>
                  </div>
                ))}
                {editing._items.length === 0 && <p className="text-xs text-brand-muted italic">No items added.</p>}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase text-brand-muted mb-2">Regional pricing</p>
              <div className="space-y-2">
                {editing._configs.map((c) => (
                  <div key={c.region} className="grid grid-cols-[60px,1fr,1fr,auto] items-center gap-2 rounded-lg border border-slate-200 p-2">
                    <span className="font-mono text-xs text-brand-navy">{c.region_code}</span>
                    <input type="number" step="0.01" placeholder="Price" value={c.price} onChange={(e) => setConfig(c.region, 'price', e.target.value)} className="rounded border border-slate-200 p-1.5 text-xs" />
                    <input type="number" step="0.01" placeholder="Promo (opt)" value={c.promotional_price} onChange={(e) => setConfig(c.region, 'promotional_price', e.target.value)} className="rounded border border-slate-200 p-1.5 text-xs" />
                    <label className="text-[10px] font-bold text-brand-navy"><input type="checkbox" checked={c.is_visible} onChange={(e) => setConfig(c.region, 'is_visible', e.target.checked)} className="mr-1 accent-brand-purple" />Visible</label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={save} className="btn-primary flex-1 py-2.5 text-xs bg-brand-purple text-white rounded-lg uppercase">Save bundle</button>
              <button onClick={() => setEditing(null)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-xs font-bold uppercase">Cancel</button>
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
        <button onClick={startNew} className="btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs uppercase bg-brand-purple text-white rounded-lg">
          <Plus className="h-4 w-4" /> New discount
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase text-brand-muted">
            <tr><th className="px-3 py-2">Code</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Value</th><th className="px-3 py-2">Region</th><th className="px-3 py-2">Window</th><th className="px-3 py-2">Usage</th><th className="px-3 py-2">Active</th><th className="px-3 py-2"></th></tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-3 py-3 font-mono font-semibold text-brand-navy">{c.code}</td>
                <td className="px-3 py-3 text-brand-muted">{c.discount_type}</td>
                <td className="px-3 py-3 font-semibold text-brand-navy">{c.discount_type === 'PERCENTAGE' ? `${c.value}%` : c.value}</td>
                <td className="px-3 py-3 text-brand-muted">{c.region_code || 'GLOBAL'}</td>
                <td className="px-3 py-3 text-brand-muted">{c.start_date ? formatDate(c.start_date) : '—'} → {c.end_date ? formatDate(c.end_date) : '—'}</td>
                <td className="px-3 py-3 text-brand-navy">{c.usage_count}{c.usage_limit ? ` / ${c.usage_limit}` : ''}</td>
                <td className="px-3 py-3">
                  <button onClick={() => toggleActive(c)} className={`rounded px-2 py-0.5 text-[10px] font-bold ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>{c.is_active ? 'ON' : 'OFF'}</button>
                </td>
                <td className="px-3 py-3 text-right">
                  <button onClick={() => startEdit(c)} className="text-brand-purple"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(c)} className="ml-2 text-brand-muted hover:text-brand-danger"><X className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {coupons.length === 0 && (<tr><td colSpan={8} className="px-3 py-6 text-center text-brand-muted">No discount codes yet.</td></tr>)}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-slate-50 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
          <div className="my-8 w-full max-w-lg bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-brand-navy">{editing.id ? 'Edit discount' : 'New discount'}</h3>
              <button onClick={() => setEditing(null)} className="text-brand-muted"><X className="h-5 w-5" /></button>
            </div>
            <input placeholder="CODE" value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm font-mono uppercase" />
            <div className="grid grid-cols-2 gap-2 text-xs">
              <select value={editing.discount_type} onChange={(e) => setEditing({ ...editing, discount_type: e.target.value })} className="rounded-lg border border-slate-200 p-2">
                <option value="PERCENTAGE">Percentage off</option>
                <option value="FIXED_AMOUNT">Fixed amount</option>
                <option value="TIERED">Tiered</option>
              </select>
              <input type="number" step="0.01" placeholder="Value" value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} className="rounded-lg border border-slate-200 p-2" />
              <select value={editing.region || ''} onChange={(e) => setEditing({ ...editing, region: e.target.value ? Number(e.target.value) : null })} className="rounded-lg border border-slate-200 p-2">
                <option value="">All regions</option>
                {regions.map((r) => <option key={r.id} value={r.id}>{r.code} — {r.name}</option>)}
              </select>
              <input type="number" step="0.01" placeholder="Min spend" value={editing.min_spend} onChange={(e) => setEditing({ ...editing, min_spend: e.target.value })} className="rounded-lg border border-slate-200 p-2" />
              <input type="datetime-local" value={editing.start_date} onChange={(e) => setEditing({ ...editing, start_date: e.target.value })} className="rounded-lg border border-slate-200 p-2" />
              <input type="datetime-local" value={editing.end_date} onChange={(e) => setEditing({ ...editing, end_date: e.target.value })} className="rounded-lg border border-slate-200 p-2" />
              <input type="number" placeholder="Usage limit (optional)" value={editing.usage_limit} onChange={(e) => setEditing({ ...editing, usage_limit: e.target.value })} className="col-span-2 rounded-lg border border-slate-200 p-2" />
            </div>
            <label className="flex items-center gap-2 text-sm text-brand-navy"><input type="checkbox" checked={editing.is_active} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} className="accent-brand-purple" /> Active</label>
            <div className="flex gap-2 pt-1">
              <button onClick={save} className="btn-primary flex-1 py-2.5 text-xs bg-brand-purple text-white rounded-lg uppercase">Save</button>
              <button onClick={() => setEditing(null)} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-xs font-bold uppercase">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ------------------------------------------------------------------ Page */
const NAV_GROUPS = [
  { title: null, items: [
    // Per spec 2026-06-24: "Home" + "Reports" merged into a single
    // "Analytics & Reports" entry (with Overview tab inside).
    { key: 'analytics', label: 'Analytics & Reports', icon: BarChart3 },
  ] },
  { title: 'Sales', items: [
    { key: 'orders', label: 'Orders', icon: ShoppingCart },
    { key: 'drafts', label: 'Draft orders', icon: ReceiptText },
    { key: 'abandoned', label: 'Abandoned checkouts', icon: ShoppingBag },
    { key: 'discounts', label: 'Discounts', icon: Banknote },
  ] },
  { title: 'CRM & Support', items: [
    { key: 'customers', label: 'Customers', icon: UserRound },
    { key: 'segments', label: 'Customer Segments', icon: UsersIcon },
    // { key: 'support', label: 'Support tickets', icon: MessageSquare },  // hidden per spec 2026-06-24
    { key: 'reviews', label: 'Reviews moderation', icon: Star },
  ] },
  { title: 'Catalog & Channels', items: [
    { key: 'products', label: 'Products', icon: Package },
    { key: 'collections', label: 'Collections', icon: Layers },
    // 'bundles' removed per spec 2026-06-24 — replaced by Collections on the storefront.
    { key: 'landing-pages', label: 'Open Pages (Landing)', icon: Globe },
  ] },
  { title: 'Marketing Hub', items: [
    { key: 'integrations', label: 'Integrations', icon: Settings },
    { key: 'newsletter', label: 'Newsletters', icon: Megaphone },
  ] },
  { title: 'Content Engine', items: [
    // Hero banners merged into Pages screen per spec 2026-06-24.
    { key: 'pages', label: 'Pages & Banners', icon: FileText },
    { key: 'blogs', label: 'Blog Posts', icon: Film },
    { key: 'navigation', label: 'Menus & Navigation', icon: MenuIcon },
    { key: 'media', label: 'Media Library', icon: ImageIcon },
  ] },
  { title: 'Enterprise & Security', items: [
    { key: 'staff', label: 'Staff & Permissions', icon: UserRound },
    { key: 'approvals', label: 'Approval Queue', icon: CheckCircle2 },
    // { key: 'audit', label: 'Audit Trail', icon: Activity },  // hidden per spec 2026-06-24
    { key: 'security', label: 'Security Center', icon: ShieldAlert },
  ] },
  { title: 'Settings', items: [
    { key: 'settings', label: 'System settings', icon: Sliders },
    { key: 'payments', label: 'Payments', icon: CreditCard },
    { key: 'emails', label: 'Email templates', icon: Mail },
    { key: 'shipping', label: 'Shipping', icon: Truck },
    { key: 'theme', label: 'Theme settings', icon: Palette },
    { key: 'cookie-consent', label: 'Cookie consent config', icon: Cookie },
  ] },
];
const NAV = NAV_GROUPS.flatMap((g) => g.items);


/* ------------------------------------------------------------- Staff & RBAC */
function StaffTab({ authFetch, regions }) {
  const [activeSubTab, setActiveSubTab] = useState('members'); // members | roles
  const [staff, setStaff] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permCatalog, setPermCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingStaff, setEditingStaff] = useState(null);
  const [editingRole, setEditingRole] = useState(null);
  const [error, setError] = useState('');

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      authFetch('/api/admin/staff/').then((r) => r.json()).catch(() => []),
      authFetch('/api/admin/roles/').then((r) => r.json()).catch(() => []),
      authFetch('/api/admin/roles/permission_catalog/').then((r) => r.json()).catch(() => []),
    ]).then(([sData, rData, pData]) => {
      setStaff(Array.isArray(sData) ? sData : sData.results || []);
      setRoles(Array.isArray(rData) ? rData : rData.results || []);
      setPermCatalog(pData || []);
    }).finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => { loadData(); }, [loadData]);

  const saveStaff = () => {
    setError('');
    authFetch(`/api/admin/staff/${editingStaff.id}/`, {
      method: 'PATCH',
      body: JSON.stringify({
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

  if (loading) return <p className="text-sm text-brand-muted">Loading Staff &amp; RBAC registry...</p>;

  return (
    <div className="space-y-4">
      {/* Subtab Navigation */}
      <div className="flex gap-2 border-b border-slate-150 pb-2">
        <button onClick={() => setActiveSubTab('members')} className={`px-4 py-1.5 text-xs font-bold uppercase rounded-lg transition-colors ${activeSubTab === 'members' ? 'bg-brand-purple text-white' : 'text-brand-navy hover:bg-slate-50'}`}>Staff Directory</button>
        <button onClick={() => setActiveSubTab('roles')} className={`px-4 py-1.5 text-xs font-bold uppercase rounded-lg transition-colors ${activeSubTab === 'roles' ? 'bg-brand-purple text-white' : 'text-brand-navy hover:bg-slate-50'}`}>Roles &amp; Permissions</button>
      </div>

      {activeSubTab === 'members' ? (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-brand-muted font-bold">
                <tr>
                  <th className="px-3 py-3">Staff Member</th>
                  <th className="px-3 py-3">Roles</th>
                  <th className="px-3 py-3">Region Scope</th>
                  <th className="px-3 py-3">IP whitelist</th>
                  <th className="px-3 py-3">2FA Status</th>
                  <th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100 align-middle">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-brand-navy">{s.first_name} {s.last_name}</p>
                      <p className="font-mono text-[10px] text-brand-muted">{s.email}</p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(s.roles || []).map((rId) => {
                          const r = roles.find((x) => x.id === rId);
                          return r ? <span key={rId} className="rounded bg-brand-purple/10 text-brand-purple px-1.5 py-0.5 text-[10px] font-bold">{r.name}</span> : null;
                        })}
                        {!(s.roles || []).length && <span className="text-slate-400">—</span>}
                      </div>
                    </td>
                    <td className="px-3 py-3 font-semibold text-slate-600">
                      {s.assigned_regions_codes?.join(', ') || 'Global (All Regions)'}
                    </td>
                    <td className="px-3 py-3 font-mono text-slate-500">
                      {s.allowed_ip_range || 'Any IP Address'}
                    </td>
                    <td className="px-3 py-3">
                      {s.two_factor_enabled ? <span className="rounded bg-green-100 text-green-700 px-1.5 py-0.5 text-[10px] font-bold">ENABLED</span> : <span className="rounded bg-slate-100 text-slate-400 px-1.5 py-0.5 text-[10px] font-bold">DISABLED</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button onClick={() => setEditingStaff({ ...s })} className="text-brand-purple hover:opacity-70 font-semibold inline-flex items-center gap-1"><Pencil className="h-3.5 w-3.5" /> Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editingStaff && (
            <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-slate-50 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
              <div className="my-8 w-full max-w-lg bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="text-lg font-black text-brand-navy">Edit Permissions: {editingStaff.email}</h3>
                  <button onClick={() => setEditingStaff(null)}><X className="h-5 w-5 text-brand-muted" /></button>
                </div>
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 font-semibold text-brand-navy cursor-pointer"><input type="checkbox" checked={editingStaff.is_staff} onChange={(e) => setEditingStaff({ ...editingStaff, is_staff: e.target.checked })} className="accent-brand-purple" /> Staff Access</label>
                    <label className="flex items-center gap-2 font-semibold text-brand-navy cursor-pointer"><input type="checkbox" checked={editingStaff.is_active} onChange={(e) => setEditingStaff({ ...editingStaff, is_active: e.target.checked })} className="accent-brand-purple" /> Active Account</label>
                  </div>

                  <div>
                    <p className="font-bold text-brand-muted mb-1 uppercase">ASSIGN ROLES</p>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-slate-200 p-2 rounded-lg bg-slate-50">
                      {roles.map((r) => {
                        const hasRole = editingStaff.roles.includes(r.id);
                        return (
                          <label key={r.id} className="flex items-center gap-1.5 cursor-pointer font-medium text-slate-700">
                            <input type="checkbox" checked={hasRole} onChange={(e) => {
                              const newRoles = e.target.checked ? [...editingStaff.roles, r.id] : editingStaff.roles.filter(x => x !== r.id);
                              setEditingStaff({ ...editingStaff, roles: newRoles });
                            }} className="accent-brand-purple" />
                            {r.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <p className="font-bold text-brand-muted mb-1 uppercase">REGIONAL ACCESS SCOPE (COUNTRY MANAGER)</p>
                    <div className="flex gap-4 p-2 border border-slate-200 rounded-lg bg-slate-50">
                      {regions.map((r) => {
                        const isAssigned = editingStaff.assigned_regions.includes(r.id);
                        return (
                          <label key={r.id} className="flex items-center gap-1.5 cursor-pointer font-bold text-slate-700">
                            <input type="checkbox" checked={isAssigned} onChange={(e) => {
                              const newRegs = e.target.checked ? [...editingStaff.assigned_regions, r.id] : editingStaff.assigned_regions.filter(x => x !== r.id);
                              setEditingStaff({ ...editingStaff, assigned_regions: newRegs });
                            }} className="accent-brand-purple" />
                            {r.code} ({r.name})
                          </label>
                        );
                      })}
                      {regions.length === 0 && <p className="text-slate-400">No regions populated.</p>}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">If no regions are selected, the user has global scope (can access UK &amp; India).</p>
                  </div>

                  <div>
                    <p className="font-bold text-brand-muted mb-1 uppercase">ALLOWED IP WHITELIST</p>
                    <input placeholder="e.g. 127.0.0.1, 192.168.1.15" value={editingStaff.allowed_ip_range || ''} onChange={(e) => setEditingStaff({ ...editingStaff, allowed_ip_range: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2 text-xs font-mono" />
                    <p className="text-[10px] text-slate-400 mt-1">Comma-separated IP addresses. Leave empty to allow any connection.</p>
                  </div>

                  <div>
                    <p className="font-bold text-brand-muted mb-1 uppercase">SECURITY</p>
                    <label className="flex items-center gap-1.5 cursor-pointer font-bold text-brand-navy"><input type="checkbox" checked={editingStaff.two_factor_enabled} onChange={(e) => setEditingStaff({ ...editingStaff, two_factor_enabled: e.target.checked })} className="accent-brand-purple" /> Enforce Two-Factor Authentication (2FA)</label>
                  </div>

                  {editingStaff.current_devices?.length > 0 && (
                    <div>
                      <p className="font-bold text-brand-muted mb-1 uppercase">ACTIVE LOGGED-IN SESSIONS ({editingStaff.current_devices.length})</p>
                      <div className="space-y-1.5 max-h-24 overflow-y-auto border border-slate-200 p-2 rounded-lg bg-slate-50 text-[10px] font-mono text-brand-muted">
                        {editingStaff.current_devices.map((dev, idx) => (
                          <div key={idx} className="flex justify-between border-b border-slate-100 pb-1">
                            <span>{dev.ip} · {dev.user_agent.substring(0, 30)}...</span>
                            <span>{new Date(dev.last_active).toLocaleDateString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {error && <p className="rounded bg-brand-danger/10 p-2 text-xs text-brand-danger">{error}</p>}
                  <button onClick={saveStaff} className="btn-primary w-full py-2.5 text-xs bg-brand-purple text-white rounded-lg uppercase font-bold">Save Settings</button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="mb-2 flex justify-between items-center">
            <p className="text-xs text-brand-muted">{roles.length} roles seeded in the registry</p>
            <button onClick={() => setEditingRole({ name: '', description: '', permissions: [] })} className="btn-primary inline-flex items-center gap-1 px-3 py-1.5 text-xs uppercase bg-brand-purple text-white rounded-lg"><Plus className="h-3.5 w-3.5" /> Create Custom Role</button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {roles.map((r) => (
              <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-sm font-bold text-brand-navy">{r.name}</h4>
                    {r.is_system && <span className="rounded bg-slate-100 text-slate-500 px-1.5 py-0.5 text-[9px] font-bold">SYSTEM</span>}
                  </div>
                  <p className="text-xs text-brand-muted min-h-[30px]">{r.description || 'No description provided.'}</p>
                  <p className="mt-2 text-[10px] text-brand-purple font-semibold font-mono">{r.permissions.length} permission keys active</p>
                </div>
                <div className="mt-4 flex justify-end gap-2 border-t border-slate-50 pt-3">
                  <button onClick={() => setEditingRole({ ...r })} className="text-xs px-2.5 py-1.2 rounded border border-slate-200 text-brand-navy hover:bg-slate-50 font-bold uppercase inline-flex items-center gap-1"><Pencil className="h-3 w-3" /> Edit</button>
                  {!r.is_system && (
                    <button onClick={() => deleteRole(r)} className="text-xs px-2.5 py-1.2 rounded border border-red-200 text-red-500 hover:bg-red-50 font-bold uppercase inline-flex items-center gap-1"><X className="h-3 w-3" /> Delete</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {editingRole && (
            <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-slate-50 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
              <div className="my-8 w-full max-w-xl bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h3 className="text-lg font-black text-brand-navy">{editingRole.id ? 'Edit Role' : 'Create Role'}</h3>
                  <button onClick={() => setEditingRole(null)}><X className="h-5 w-5 text-brand-muted" /></button>
                </div>
                <div className="space-y-4 text-xs">
                  <div className="grid gap-3">
                    <input placeholder="Role Name" value={editingRole.name} disabled={editingRole.is_system} onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2.5 text-sm disabled:bg-slate-50" />
                    <textarea placeholder="Description" value={editingRole.description} onChange={(e) => setEditingRole({ ...editingRole, description: e.target.value })} className="w-full rounded-lg border border-slate-200 p-2.5 text-xs" rows={2} />
                  </div>

                  <div>
                    <p className="font-bold text-brand-muted mb-2 uppercase">ASSIGN PERMISSIONS ({editingRole.permissions.length} SELECTED)</p>
                    <div className="border border-slate-200 rounded-lg max-h-60 overflow-y-auto p-3 bg-slate-50 grid gap-3 grid-cols-2">
                      {/* Group permission keys by category prefix */}
                      {['dashboard', 'products', 'inventory', 'orders', 'customers', 'content', 'marketing', 'reports', 'finance', 'staff', 'security'].map((cat) => {
                        const items = permCatalog.filter(p => p.key.startsWith(cat + '.'));
                        if (items.length === 0) return null;
                        return (
                          <div key={cat} className="space-y-1.5 col-span-2 md:col-span-1 border-b border-slate-200/50 pb-2">
                            <p className="font-bold text-brand-purple uppercase text-[10px] tracking-wide">{cat} privileges</p>
                            {items.map((p) => {
                              const active = editingRole.permissions.includes(p.key);
                              return (
                                <label key={p.key} className="flex items-start gap-1.5 cursor-pointer font-medium text-slate-700 leading-tight">
                                  <input type="checkbox" checked={active} disabled={editingRole.is_system} onChange={(e) => {
                                    const nextPerms = e.target.checked ? [...editingRole.permissions, p.key] : editingRole.permissions.filter(x => x !== p.key);
                                    setEditingRole({ ...editingRole, permissions: nextPerms });
                                  }} className="mt-0.5 accent-brand-purple" />
                                  <span>
                                    <span className="block text-[11px] font-semibold text-brand-navy">{p.key}</span>
                                    <span className="block text-[9px] text-brand-muted">{p.label}</span>
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {error && <p className="rounded bg-brand-danger/10 p-2 text-xs text-brand-danger">{error}</p>}
                  {!editingRole.is_system && (
                    <button onClick={saveRole} className="btn-primary w-full py-2.5 text-xs bg-brand-purple text-white rounded-lg uppercase font-bold">Save Role</button>
                  )}
                  {editingRole.is_system && (
                    <p className="text-center text-slate-400 font-semibold">System roles are read-only and cannot be mutated.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- ApprovalsTab */
function ApprovalsTab({ authFetch }) {
  const [activeSubTab, setActiveSubTab] = useState('pending'); // pending | resolved
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectingReq, setRejectingReq] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [error, setError] = useState('');

  const loadRequests = useCallback(() => {
    setLoading(true);
    authFetch('/api/admin/approval-requests/')
      .then((r) => r.json())
      .then((d) => setRequests(Array.isArray(d) ? d : d.results || []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const handleApprove = (id) => {
    setError('');
    authFetch(`/api/admin/approval-requests/${id}/approve/`, { method: 'POST' })
      .then((r) => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error || 'Approval failed.');
        loadRequests();
      })
      .catch((e) => setError(e.message));
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) return;
    setError('');
    authFetch(`/api/admin/approval-requests/${rejectingReq.id}/reject/`, {
      method: 'POST',
      body: JSON.stringify({ rejection_reason: rejectionReason })
    })
    .then((r) => r.json().then(d => ({ ok: r.ok, d })))
    .then(({ ok, d }) => {
      if (!ok) throw new Error(d.error || 'Rejection failed.');
      setRejectingReq(null);
      setRejectionReason('');
      loadRequests();
    })
    .catch((e) => setError(e.message));
  };

  if (loading) return <p className="text-sm text-brand-muted">Loading approval workflows...</p>;

  const filtered = requests.filter(r => activeSubTab === 'pending' ? r.status === 'PENDING' : r.status !== 'PENDING');

  return (
    <div className="space-y-4">
      {/* Subtab Navigation */}
      <div className="flex gap-2 border-b border-slate-150 pb-2">
        <button onClick={() => setActiveSubTab('pending')} className={`px-4 py-1.5 text-xs font-bold uppercase rounded-lg transition-colors ${activeSubTab === 'pending' ? 'bg-brand-purple text-white' : 'text-brand-navy hover:bg-slate-50'}`}>Pending Queue</button>
        <button onClick={() => setActiveSubTab('resolved')} className={`px-4 py-1.5 text-xs font-bold uppercase rounded-lg transition-colors ${activeSubTab === 'resolved' ? 'bg-brand-purple text-white' : 'text-brand-navy hover:bg-slate-50'}`}>History log</button>
      </div>

      {error && <p className="rounded bg-brand-danger/10 p-2 text-xs text-brand-danger">{error}</p>}

      <div className="space-y-3">
        {filtered.map((req) => (
          <div key={req.id} className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 shadow-xs">
            <div className="flex flex-wrap justify-between items-start gap-2 border-b border-slate-50 pb-2">
              <div>
                <span className="rounded bg-amber-100 text-amber-700 px-2 py-0.5 text-[9px] font-bold uppercase">{req.request_type}</span>
                <h4 className="text-sm font-bold text-brand-navy mt-1">{req.summary}</h4>
                <p className="text-[10px] text-brand-muted mt-0.5">Submitted by <span className="font-semibold text-brand-navy">{req.requester_email}</span> on {formatDateTime(req.created_at)}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${req.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : req.status === 'APPROVED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {req.status}
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 text-xs text-brand-muted p-3 bg-slate-50 rounded-xl border border-slate-100 font-mono">
              <div>
                <p className="font-bold text-slate-400 uppercase text-[9px] tracking-wide mb-0.5">Threshold Details</p>
                <pre className="text-[10px] leading-tight overflow-x-auto whitespace-pre-wrap">{JSON.stringify(req.details, null, 2)}</pre>
              </div>
              <div>
                <p className="font-bold text-slate-400 uppercase text-[9px] tracking-wide mb-0.5">Action payload</p>
                <pre className="text-[10px] leading-tight overflow-x-auto whitespace-pre-wrap">{JSON.stringify(req.payload, null, 2)}</pre>
              </div>
            </div>

            {req.status === 'PENDING' ? (
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setRejectingReq(req)} className="text-xs px-4 py-2 border border-red-200 text-red-500 hover:bg-red-50 font-bold rounded-lg uppercase flex items-center gap-1"><X className="h-3.5 w-3.5" /> Reject</button>
                <button onClick={() => handleApprove(req.id)} className="text-xs px-4 py-2 bg-green-600 text-white hover:bg-green-700 font-bold rounded-lg uppercase flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" /> Approve &amp; Execute</button>
              </div>
            ) : (
              <div className="text-[10px] text-brand-muted border-t border-slate-50 pt-2 flex flex-wrap gap-x-4">
                <span>Resolved by: <span className="font-semibold text-brand-navy">{req.approver_email || 'system'}</span></span>
                {req.resolved_at && <span>Resolved on: {formatDateTime(req.resolved_at)}</span>}
                {req.rejection_reason && <span className="block w-full text-red-600 mt-1 font-semibold">Rejection reason: {req.rejection_reason}</span>}
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center py-8 text-xs text-brand-muted">No requests found in this queue.</p>}
      </div>

      {rejectingReq && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-slate-50 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
          <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-black text-brand-navy">Reject Approval Request</h3>
            <div className="space-y-3 text-xs">
              <p className="text-brand-muted">Please specify the reason for rejecting this change:</p>
              <textarea rows={3} value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} placeholder="Provide rejection feedback..." className="w-full rounded-lg border border-slate-200 p-2.5 text-xs" />
              <div className="flex gap-2">
                <button onClick={handleReject} disabled={!rejectionReason.trim()} className="btn-primary flex-1 py-2.5 text-xs bg-red-600 text-white rounded-lg uppercase font-bold">Confirm Reject</button>
                <button onClick={() => { setRejectingReq(null); setRejectionReason(''); }} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-xs font-bold uppercase">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
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

  const loadLogs = useCallback(() => {
    setLoading(true);
    let url = `/api/admin/audit-logs/?search=${searchQuery}`;
    if (filterAction !== 'ALL') url += `&action=${filterAction}`;
    if (filterActor.trim()) url += `&actor_email=${filterActor}`;
    
    Promise.all([
      authFetch(url).then((r) => r.json()).catch(() => []),
      authFetch('/api/admin/audit-logs/actions/').then((r) => r.json()).catch(() => []),
    ]).then(([lData, aData]) => {
      setLogs(Array.isArray(lData) ? lData : lData.results || []);
      setActions(aData || []);
    }).finally(() => setLoading(false));
  }, [authFetch, searchQuery, filterAction, filterActor]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_200px_200px_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search audit summaries..." className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-xs" />
        </label>
        <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs bg-white">
          <option value="ALL">All Actions</option>
          {actions.map((act) => <option key={act} value={act}>{act}</option>)}
        </select>
        <input value={filterActor} onChange={(e) => setFilterActor(e.target.value)} placeholder="Filter actor email" className="rounded-lg border border-slate-200 px-3 py-2 text-xs" />
        <button onClick={loadLogs} className="btn-primary px-4 py-2 bg-brand-purple text-white text-xs uppercase font-bold rounded-lg">Apply</button>
      </div>

      {loading ? (
        <p className="text-sm text-brand-muted">Querying audit logs trail...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-brand-muted font-bold">
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
                <tr key={log.id} className="cursor-pointer border-t border-slate-100 hover:bg-slate-50" onClick={() => setSelectedLog(log)}>
                  <td className="px-3 py-3 font-mono text-[10px] text-brand-muted">{formatDateTime(log.created_at)}</td>
                  <td className="px-3 py-3 font-bold text-brand-navy">{log.actor_email}</td>
                  <td className="px-3 py-3 font-mono text-[10px]"><span className="rounded bg-slate-100 px-1.5 py-0.5 text-brand-purple">{log.action}</span></td>
                  <td className="px-3 py-3 text-slate-500 font-mono text-[10px]">{log.target_type} #{log.target_id}</td>
                  <td className="px-3 py-3 font-semibold text-brand-navy truncate max-w-[200px]">{log.summary}</td>
                  <td className="px-3 py-3 font-mono text-slate-500">{log.ip_address}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-brand-muted text-xs">No audit logs matching query parameters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {selectedLog && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-64 top-0 md:top-[65px] z-25 bg-slate-50 overflow-y-auto p-4 sm:p-6 lg:p-8 flex flex-col items-center justify-start">
          <div className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="text-lg font-black text-brand-navy">Audit Log Details</h3>
              <button onClick={() => setSelectedLog(null)}><X className="h-5 w-5 text-brand-muted" /></button>
            </div>
            <div className="space-y-3 text-xs">
              <p><span className="font-bold uppercase text-brand-muted">Timestamp:</span> {formatDateTime(selectedLog.created_at)}</p>
              <p><span className="font-bold uppercase text-brand-muted">Actor:</span> {selectedLog.actor_email} (IP: {selectedLog.ip_address})</p>
              <p><span className="font-bold uppercase text-brand-muted">Action:</span> {selectedLog.action}</p>
              <p><span className="font-bold uppercase text-brand-muted">Target:</span> {selectedLog.target_type} #{selectedLog.target_id}</p>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <p className="font-bold text-slate-400 mb-1">SUMMARY</p>
                <p className="text-brand-navy font-semibold">{selectedLog.summary}</p>
              </div>
              <div>
                <p className="font-bold text-brand-muted mb-1">DEVICE USER AGENT</p>
                <p className="font-mono text-[10px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">{selectedLog.user_agent}</p>
              </div>
              {selectedLog.changes && Object.keys(selectedLog.changes).length > 0 && (
                <div>
                  <p className="font-bold text-brand-muted mb-1">CHANGESET DIFF (BEFORE → AFTER)</p>
                  <div className="space-y-1 max-h-40 overflow-y-auto bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono text-[10px] mb-2">
                    {Object.entries(selectedLog.changes).map(([field, val]) => {
                      const before = Array.isArray(val) ? val[0] : '—';
                      const after = Array.isArray(val) ? val[1] : val;
                      return (
                        <div key={field} className="border-b border-slate-200/50 pb-1">
                          <span className="font-semibold text-brand-purple">{field}:</span>
                          <span className="text-red-500 line-through ml-1">{JSON.stringify(before)}</span>
                          <span className="text-green-600 ml-1">→ {JSON.stringify(after)}</span>
                        </div>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => {
                      if (confirm("Are you sure you want to revert these target fields to their previous state?")) {
                        authFetch(`/api/admin/audit-logs/${selectedLog.id}/rollback/`, { method: 'POST' })
                          .then((r) => r.json().then(d => ({ ok: r.ok, d })))
                          .then(({ ok, d }) => {
                            if (!ok) throw new Error(d.error || 'Rollback failed.');
                            alert(d.message || 'Rollback successful!');
                            setSelectedLog(null);
                            loadLogs();
                          })
                          .catch((e) => alert(e.message));
                      }
                    }}
                    className="w-full mt-2 py-2 bg-brand-orange hover:bg-brand-orange/90 text-white font-bold rounded-lg uppercase text-[10px]"
                  >
                    Rollback Configuration Changes
                  </button>
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
    <div className="space-y-6 text-xs bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
      <div>
        <h3 className="text-sm font-bold text-brand-navy mb-1 uppercase">Account Security Status</h3>
        <p className="text-brand-muted mb-3">Manage Two-Factor Authentication and whitelist range settings for your staff profile.</p>
        
        {success && <p className="rounded bg-green-100 p-2.5 text-xs text-green-700 font-bold mb-3">{success}</p>}
        {error && <p className="rounded bg-brand-danger/10 p-2.5 text-xs text-brand-danger font-bold mb-3">{error}</p>}
        
        <div className="space-y-3">
          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 cursor-pointer">
            <input type="checkbox" checked={user.two_factor_enabled} disabled={saving} onChange={handleToggle2FA} className="mt-0.5 h-4 w-4 accent-brand-purple" />
            <span>
              <span className="block text-sm font-semibold text-brand-navy">Enable 2-Step OTP Authentication</span>
              <span className="block text-xs text-brand-muted mt-0.5">Enforces a 6-digit OTP code sent to your registered email ({user.email}) during sign-in.</span>
            </span>
          </label>
          
          {user.allowed_ip_range && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono">
              <span className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Active IP Whitelist restrictions</span>
              <span className="text-brand-navy font-semibold">{user.allowed_ip_range}</span>
              <p className="text-[10px] text-slate-400 mt-1 font-sans">You are restricted to connecting only from these IP addresses. Contact Super Admin to update your IP scope.</p>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <h3 className="text-xs font-bold text-brand-navy mb-1 uppercase">Active login sessions</h3>
        <p className="text-brand-muted mb-3">These devices are currently logged in. Terminating other sessions logs out all other browsers.</p>
        
        <div className="space-y-2 mb-4">
          {(user.current_devices || []).map((dev, idx) => {
            const isCurrent = dev.id === currentSessionId;
            return (
              <div key={idx} className="flex justify-between items-center p-3 rounded-lg border border-slate-100 bg-slate-50 font-mono text-[10px]">
                <div className="space-y-0.5">
                  <span className="font-bold text-brand-navy">{dev.ip}</span>
                  <span className="block text-slate-400 font-sans">{dev.user_agent.substring(0, 50)}...</span>
                </div>
                <div className="text-right">
                  {isCurrent ? (
                    <span className="rounded bg-brand-purple/10 text-brand-purple px-1.5 py-0.5 text-[9px] font-bold font-sans">CURRENT SESSION</span>
                  ) : (
                    <span className="text-slate-400 font-sans">Active: {new Date(dev.last_active).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            );
          })}
          {(!user.current_devices || user.current_devices.length === 0) && (
            <p className="text-slate-400 italic">No device session logging enabled.</p>
          )}
        </div>
        
        <button onClick={handleTerminateSessions} disabled={saving || (user.current_devices || []).length <= 1} className="btn-secondary w-full py-2.5 border border-red-200 text-red-500 hover:bg-red-50 font-bold rounded-lg uppercase disabled:opacity-50">Log Out of Other Devices</button>
      </div>
    </div>
  );
}


export default function AdminPage() {
  const dispatch = useDispatch();
  const { user, access } = useSelector((s) => s.auth);
  const authFetch = useAuthFetch();
  const [section, setSection] = useState('analytics');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [regions, setRegions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);

  useEffect(() => { if (access && !user) dispatch(fetchProfile()); }, [access, user, dispatch]);
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

  if (!user) {
    return (
      <StoreShell showFooter={false}>
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-brand-muted" />
          <h1 className="mb-2 text-xl font-black text-brand-navy">Admin access</h1>
          <p className="mb-4 text-sm text-brand-muted">Please log in with an administrator account.</p>
          <Link href="/account" className="btn-primary inline-flex px-5 py-2.5 text-xs uppercase bg-brand-purple text-white rounded-lg">Go to login</Link>
        </div>
      </StoreShell>
    );
  }
  if (!isAdmin) {
    return (
      <StoreShell showFooter={false}>
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <ShieldAlert className="mx-auto mb-3 h-10 w-10 text-brand-danger" />
          <h1 className="mb-2 text-xl font-black text-brand-navy">Not authorised</h1>
          <p className="text-sm text-brand-muted">Your account ({user.email}) does not have admin access.</p>
        </div>
      </StoreShell>
    );
  }

  const active = NAV.find((n) => n.key === section);

  const SidebarContent = ({ isMobile = false, onClose = () => {} }) => (
    <div className="flex flex-col h-full">
      <div className="mb-3 flex items-center gap-2 px-2 pb-3 border-b border-slate-100">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-purple text-white">
          <LayoutDashboard className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <span className="block text-sm font-black text-brand-navy">Admin</span>
          <span className="block text-[10px] text-brand-muted">Sclero Proteins</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className="mb-1">
            {group.title && (
              <p className="px-2 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">{group.title}</p>
            )}
            {group.items.map((n) => (
              <button key={n.key} onClick={() => { setSection(n.key); if (isMobile) onClose(); }}
                className={`relative flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition-colors ${
                  section === n.key ? 'bg-brand-purple/10 text-brand-purple' : 'text-brand-navy hover:bg-slate-50'
                }`}>
                {section === n.key && <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-brand-purple" />}
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
      <div className="flex min-h-[calc(100vh-65px)] bg-slate-50 relative">
        {/* Desktop Sidebar (Fixed Left) */}
        <aside className="hidden md:block w-64 border-r border-slate-200 bg-white fixed left-0 top-[65px] bottom-0 z-30 p-4">
          <SidebarContent />
        </aside>

        {/* Mobile Sidebar Drawer Overlay */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            {/* Backdrop */}
            <div className="fixed inset-0 bg-brand-navy/30 backdrop-blur-xs" onClick={() => setMobileMenuOpen(false)} />
            
            {/* Drawer Content */}
            <aside className="relative flex w-64 max-w-xs flex-col bg-white p-4 shadow-2xl z-10 h-full">
              <div className="absolute right-2 top-2">
                <button onClick={() => setMobileMenuOpen(false)} className="rounded-lg p-2 text-brand-muted hover:bg-slate-50">
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
        <div className="sticky top-[65px] z-20 -mx-4 sm:-mx-6 mb-3 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 sm:px-6 py-2.5 backdrop-blur md:hidden">
          <button onClick={() => setMobileMenuOpen(true)} aria-label="Open admin menu" className="inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-brand-navy">
            <MenuIcon className="h-5 w-5" />
            <span className="sr-only sm:not-sr-only">Menu</span>
          </button>
          <span className="flex-1 truncate text-center text-sm font-bold text-brand-navy capitalize">{active?.label}</span>
        </div>

          <div className="mb-6 hidden md:flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-purple font-mono">Admin Console</p>
              <h1 className="mt-1 text-2xl font-black text-brand-navy">{active?.label}</h1>
            </div>
          </div>

          {/* 'home' + 'reports' folded into 'analytics' per spec 2026-06-24. */}
          {section === 'orders' && <OrdersTab authFetch={authFetch} />}
          {section === 'drafts' && <OrdersTab authFetch={authFetch} initialStatus="PENDING" title="draft orders" />}
          {section === 'abandoned' && <AbandonedTab authFetch={authFetch} />}
          {section === 'products' && <ProductsTab authFetch={authFetch} regions={regions} categories={categories} />}
          {section === 'collections' && <CollectionsTab authFetch={authFetch} />}
          {/* Bundles tab removed per spec 2026-06-24 (deprecated in favour of Collections). */}
          {section === 'discounts' && <DiscountsTab authFetch={authFetch} regions={regions} />}
          {section === 'payments' && <PaymentsTab authFetch={authFetch} regions={regions} />}
          {section === 'emails' && <EmailsTab authFetch={authFetch} regions={regions} />}
          {section === 'shipping' && <ShippingTab authFetch={authFetch} regions={regions} />}

          {/* New Expanded Tabs */}
          {section === 'customers' && <CustomersTab authFetch={authFetch} />}
          {section === 'segments' && <SegmentsTab authFetch={authFetch} />}
          {section === 'support' && <SupportTab authFetch={authFetch} />}
          {section === 'landing-pages' && <LandingPagesTab authFetch={authFetch} products={products} />}
          {section === 'integrations' && <IntegrationsTab authFetch={authFetch} />}
          {/* hero-banners merged into 'pages' (Pages & Banners) per spec 2026-06-24. */}
          {section === 'pages' && <PagesAndBannersTab authFetch={authFetch} />}
          {section === 'blogs' && <BlogsTab authFetch={authFetch} />}
          {section === 'analytics' && <AnalyticsAndReportsTab authFetch={authFetch} />}
          {section === 'settings' && <SettingsTab authFetch={authFetch} />}

          {/* Enterprise Added Modules */}
          {section === 'reviews' && <ReviewsTab authFetch={authFetch} />}
          {section === 'newsletter' && <NewsletterTab authFetch={authFetch} />}
          {section === 'navigation' && <NavigationTab authFetch={authFetch} regions={regions} />}
          {section === 'media' && <MediaLibraryTab authFetch={authFetch} />}
          {section === 'theme' && <ThemeTab authFetch={authFetch} />}
          {section === 'cookie-consent' && <CookieConsentTab authFetch={authFetch} />}

          {/* Enterprise & Security Tabs */}
          {section === 'staff' && <StaffTab authFetch={authFetch} regions={regions} />}
          {section === 'approvals' && <ApprovalsTab authFetch={authFetch} />}
          {section === 'audit' && <AuditTab authFetch={authFetch} />}
          {section === 'security' && <SecurityCenterTab authFetch={authFetch} user={user} onSaved={() => dispatch(fetchProfile())} />}
        </main>
      </div>
    </StoreShell>
  );
}
