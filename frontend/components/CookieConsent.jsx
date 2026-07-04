'use client';

import React, { useEffect, useState } from 'react';

export default function CookieConsent() {
  const [show, setShow] = useState(false);
  const [preferences, setPreferences] = useState({
    necessary: true,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    // Check if consent is already stored in localStorage
    const consent = localStorage.getItem('cookie-consent');
    if (!consent) {
      setShow(true);
    } else {
      try {
        const parsed = JSON.parse(consent);
        setPreferences({ ...parsed, necessary: true });
      } catch (e) {
        setShow(true);
      }
    }
  }, []);

  const saveConsent = (prefs) => {
    localStorage.setItem('cookie-consent', JSON.stringify(prefs));
    
    // Write cookies for each choice (Lax, Secure if possible)
    const maxAge = 365 * 24 * 60 * 60; // 1 year
    document.cookie = `cookie-consent-necessary=true; max-age=${maxAge}; path=/; SameSite=Lax`;
    document.cookie = `cookie-consent-analytics=${prefs.analytics}; max-age=${maxAge}; path=/; SameSite=Lax`;
    document.cookie = `cookie-consent-marketing=${prefs.marketing}; max-age=${maxAge}; path=/; SameSite=Lax`;
    
    // Dispatch a custom event so other components / trackers can react dynamically
    if (typeof window !== 'undefined') {
      const event = new CustomEvent('cookie-consent-updated', { detail: prefs });
      window.dispatchEvent(event);
    }
    
    setShow(false);
  };

  const handleAcceptAll = () => {
    const allAccepted = { necessary: true, analytics: true, marketing: true };
    setPreferences(allAccepted);
    saveConsent(allAccepted);
  };

  const handleSavePreferences = () => {
    saveConsent(preferences);
  };

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-title"
      className="fixed bottom-6 left-6 right-6 z-[9999] max-w-xl md:left-auto md:right-8 bg-surface border border-edge rounded-lg p-6 shadow-overlay text-ink-primary transition-all duration-300 transform translate-y-0 flex flex-col gap-4 font-sans animate-slide-up"
    >
      <div>
        <div id="cookie-title" className="font-display font-medium text-[22px] flex items-center gap-2">
          <span className="text-xl">🍪</span> Cookie Preferences
        </div>
        <p className="text-xs text-ink-muted mt-2 leading-relaxed">
          We use cookies to enhance security, analyze site usage, and support regional configurations. Manage your settings below or accept all to continue.
        </p>
      </div>

      <div className="flex flex-col gap-3 py-3 border-y border-edge-subtle">
        {/* Necessary */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={preferences.necessary}
            disabled
            className="mt-1 h-4 w-4 rounded-xs border-edge bg-surface text-ink-primary focus:ring-ink-primary cursor-not-allowed accent-ink-primary"
          />
          <div className="text-xs">
            <span className="font-medium text-ink-primary">Strictly Necessary (Always Active)</span>
            <p className="text-ink-muted">Required for fundamental actions like authentication, regional detection, and cart management.</p>
          </div>
        </label>

        {/* Analytics */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={preferences.analytics}
            onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
            className="mt-1 h-4 w-4 rounded-xs border-edge bg-surface text-ink-primary focus:ring-ink-primary accent-ink-primary cursor-pointer"
          />
          <div className="text-xs">
            <span className="font-medium text-ink-primary">Analytics & Performance</span>
            <p className="text-ink-muted">Allows us to analyze site visits and customer journeys to optimize platform performance.</p>
          </div>
        </label>

        {/* Marketing */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={preferences.marketing}
            onChange={(e) => setPreferences({ ...preferences, marketing: e.target.checked })}
            className="mt-1 h-4 w-4 rounded-xs border-edge bg-surface text-ink-primary focus:ring-ink-primary accent-ink-primary cursor-pointer"
          />
          <div className="text-xs">
            <span className="font-medium text-ink-primary">Marketing & Personalization</span>
            <p className="text-ink-muted">Used to serve relevant promotional offers and tailored advertisements based on preferences.</p>
          </div>
        </label>
      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-2.5 mt-1">
        <button
          type="button"
          onClick={() => {
            const rejected = { necessary: true, analytics: false, marketing: false };
            setPreferences(rejected);
            saveConsent(rejected);
          }}
          className="btn-ghost px-4 py-2 text-xs"
        >
          Reject Optional
        </button>
        <button
          type="button"
          onClick={handleSavePreferences}
          className="btn-ghost px-4 py-2 text-xs"
        >
          Save Settings
        </button>
        <button
          type="button"
          onClick={handleAcceptAll}
          className="btn-primary px-5 py-2 text-xs"
        >
          Accept All
        </button>
      </div>
    </div>
  );
}
