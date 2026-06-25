import React, { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { X, Save, ToggleLeft, ToggleRight, Settings, ScrollText, RefreshCw } from 'lucide-react';
import { getApiUrl } from '../lib/api';

export default function AdminDashboardModal({ onClose }) {
  const { currentRegion } = useSelector((state) => state.region);
  const [toggles, setToggles] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditActions, setAuditActions] = useState([]);
  const [auditFilter, setAuditFilter] = useState('');
  const [auditLoading, setAuditLoading] = useState(false);
  const [settings, setSettings] = useState({
    smtp_host: 'smtp.gmail.com',
    smtp_port: '587',
    sender_name: 'Sclero Proteins Support',
    enable_google_auth: true,
    enable_otp_login: true,
    enable_email_pass: true,
  });

  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    // 1. Fetch active toggles
    fetch(getApiUrl(`/api/admin/toggles/active_toggles/?region=${currentRegion}`))
      .then((res) => res.json())
      .then((data) => {
        setToggles(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
      
    // 2. Fetch configurations
    fetch(getApiUrl('/api/admin/settings/SYSTEM_SETTINGS/'))
      .then((res) => {
        if (res.ok) return res.json();
        return null;
      })
      .then((data) => {
        if (data && data.value) {
          setSettings(data.value);
        }
      })
      .catch((err) => console.error(err));
  }, [currentRegion]);

  // Audit logs — send the stored admin token so this also works under RBAC enforcement.
  const loadAuditLogs = useCallback((action = '') => {
    setAuditLoading(true);
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('sclero_access') : null;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const qs = action ? `?action=${encodeURIComponent(action)}` : '';
    fetch(getApiUrl(`/api/admin/audit-logs/${qs}`), { headers })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setAuditLogs(Array.isArray(data) ? data : []))
      .catch(() => setAuditLogs([]))
      .finally(() => setAuditLoading(false));
  }, []);

  useEffect(() => {
    loadAuditLogs();
    const token = typeof window !== 'undefined' ? window.localStorage.getItem('sclero_access') : null;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(getApiUrl('/api/admin/audit-logs/actions/'), { headers })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setAuditActions(Array.isArray(data) ? data : []))
      .catch(() => setAuditActions([]));
  }, [loadAuditLogs]);

  const handleToggleChange = (module_name) => {
    const newVal = !toggles[module_name];
    setToggles({ ...toggles, [module_name]: newVal });
    
    // Simulate updating toggle back to backend
    fetch(getApiUrl('/api/admin/toggles/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        module_name,
        is_enabled: newVal,
        region_code: currentRegion
      })
    })
    .catch((err) => console.error(err));
  };

  const handleSettingsSave = (e) => {
    e.preventDefault();
    setSuccessMsg('');

    // Save SYSTEM_SETTINGS to database key
    fetch(getApiUrl('/api/admin/settings/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'SYSTEM_SETTINGS',
        value: settings,
        description: 'Global configuration settings for auth and SMTP gateways'
      })
    })
      .then((res) => res.json())
      .then((data) => {
        setSuccessMsg('Configurations successfully updated on server!');
      })
      .catch((err) => console.error(err));
  };

  // Lock body scroll while the right-side panel is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  if (loading) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
        <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-3xl items-center justify-center bg-white shadow-2xl">
          <div className="loader"></div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Backdrop — click to close. Solid right panel (not a centered modal). */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Sclero Proteins Admin Settings Console"
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-3xl flex-col bg-white shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-brand-purple" />
            <h2 className="text-lg font-black text-brand-navy">Sclero Proteins Admin Settings Console</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 border border-slate-200 text-brand-text hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-6">

        {successMsg && (
          <p className="text-xs text-brand-success font-semibold bg-brand-success/10 border border-brand-success/20 p-2.5 rounded-lg mb-4">
            {successMsg}
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Column 1: Feature Toggles (Shopify-Style) */}
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold text-brand-navy uppercase tracking-wider">Module Toggles ({currentRegion})</h3>
            <div className="space-y-2.5 bg-slate-50 p-4 border border-slate-200/60 rounded-2xl">
              {Object.keys(toggles).map((module) => (
                <div key={module} className="flex justify-between items-center text-xs">
                  <span className="capitalize text-brand-text font-medium">{module.replace('_', ' ')}</span>
                  <button
                    onClick={() => handleToggleChange(module)}
                    className="focus:outline-none text-brand-purple hover:opacity-85 transition-opacity"
                  >
                    {toggles[module] ? (
                      <ToggleRight className="h-7 w-7 text-brand-purple" />
                    ) : (
                      <ToggleLeft className="h-7 w-7 text-brand-muted" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Column 2: Authentication & Gateways Config */}
          <form onSubmit={handleSettingsSave} className="space-y-4">
            <h3 className="text-xs font-extrabold text-brand-navy uppercase tracking-wider">Auth Flow & Settings Config</h3>
            
            <div className="space-y-3 bg-slate-50 p-4 border border-slate-200/60 rounded-2xl">
              
              {/* Dynamic Auth Toggles */}
              <div className="border-b border-slate-200/60 pb-2.5 mb-2.5 space-y-2">
                <span className="text-[9px] uppercase font-bold text-brand-muted block">Allowed Auth Methods</span>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-brand-text">Standard Email & Password</span>
                  <input
                    type="checkbox"
                    checked={settings.enable_email_pass}
                    onChange={(e) => setSettings({ ...settings, enable_email_pass: e.target.checked })}
                    className="accent-brand-purple"
                  />
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-brand-text">Google Account Login</span>
                  <input
                    type="checkbox"
                    checked={settings.enable_google_auth}
                    onChange={(e) => setSettings({ ...settings, enable_google_auth: e.target.checked })}
                    className="accent-brand-purple"
                  />
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-brand-text">SMS OTP Login Code</span>
                  <input
                    type="checkbox"
                    checked={settings.enable_otp_login}
                    onChange={(e) => setSettings({ ...settings, enable_otp_login: e.target.checked })}
                    className="accent-brand-purple"
                  />
                </div>
              </div>

              {/* SMTP Settings */}
              <div className="space-y-2">
                <span className="text-[9px] uppercase font-bold text-brand-muted block">SMTP Mail Gateway</span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="SMTP Host"
                    value={settings.smtp_host}
                    onChange={(e) => setSettings({ ...settings, smtp_host: e.target.value })}
                    className="bg-white border border-slate-200 rounded-lg p-2 text-xs text-brand-text focus:outline-none focus:border-brand-purple"
                  />
                  <input
                    type="text"
                    placeholder="SMTP Port"
                    value={settings.smtp_port}
                    onChange={(e) => setSettings({ ...settings, smtp_port: e.target.value })}
                    className="bg-white border border-slate-200 rounded-lg p-2 text-xs text-brand-text focus:outline-none focus:border-brand-purple"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Sender Name"
                  value={settings.sender_name}
                  onChange={(e) => setSettings({ ...settings, sender_name: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs text-brand-text focus:outline-none focus:border-brand-purple"
                />
              </div>

            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 bg-brand-gradient text-white rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider hover:opacity-90 shadow-md shadow-brand-purple/15"
            >
              <Save className="h-4 w-4" />
              Save Settings
            </button>
          </form>
        </div>

        {/* Audit Log Viewer */}
        <div className="mt-6 border-t border-slate-100 pt-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScrollText className="h-4 w-4 text-brand-purple" />
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-brand-navy">
                Audit Log
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={auditFilter}
                onChange={(e) => { setAuditFilter(e.target.value); loadAuditLogs(e.target.value); }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-brand-text focus:border-brand-purple focus:outline-none"
              >
                <option value="">All actions</option>
                {auditActions.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <button
                onClick={() => loadAuditLogs(auditFilter)}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-brand-navy hover:border-brand-purple"
              >
                <RefreshCw className="h-3 w-3" /> Refresh
              </button>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200/60 bg-slate-50">
            {auditLoading ? (
              <p className="p-4 text-xs text-brand-muted">Loading…</p>
            ) : auditLogs.length === 0 ? (
              <p className="p-4 text-xs text-brand-muted">No audit entries yet.</p>
            ) : (
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 bg-slate-100 text-brand-muted">
                  <tr>
                    <th className="px-3 py-2 font-bold">When</th>
                    <th className="px-3 py-2 font-bold">Action</th>
                    <th className="px-3 py-2 font-bold">Actor</th>
                    <th className="px-3 py-2 font-bold">Detail</th>
                    <th className="px-3 py-2 font-bold">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="border-t border-slate-200/60 align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-brand-muted">
                        {log.created_at ? new Date(log.created_at).toLocaleString() : ''}
                      </td>
                      <td className="px-3 py-2">
                        <span className="rounded bg-brand-purple/10 px-1.5 py-0.5 font-mono font-bold text-brand-purple">
                          {log.action}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-brand-text">
                        {log.actor_name || log.actor_email || 'System'}
                      </td>
                      <td className="px-3 py-2 text-brand-muted">{log.summary}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-brand-muted">{log.ip_address || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="mt-2 text-[10px] text-brand-muted">
            Showing the {auditLogs.length} most recent entries. Login, product, price, inventory,
            order, refund and address events are tracked automatically.
          </p>
        </div>

        </div>
      </aside>
    </>
  );
}
