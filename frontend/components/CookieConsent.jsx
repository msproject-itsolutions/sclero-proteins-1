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
      className="fixed bottom-6 left-6 right-6 z-[9999] max-w-xl md:left-auto md:right-8 bg-brand-indigo/95 backdrop-blur-xl border border-white/20 rounded-2xl p-6 shadow-luxe-lg text-white transition-all duration-300 transform translate-y-0 flex flex-col gap-4 font-sans"
    >
      <div>
        <div id="cookie-title" className="text-lg font-bold tracking-wide flex items-center gap-2">
          <span className="text-xl">🍪</span> Cookie Preferences
        </div>
        <p className="text-xs text-gray-200 mt-2 leading-relaxed">
          We use cookies to enhance security, analyze site usage, and support regional configurations. Manage your settings below or accept all to continue.
        </p>
      </div>

      <div className="flex flex-col gap-3 py-3 border-y border-white/10">
        {/* Necessary */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={preferences.necessary}
            disabled
            className="mt-1 h-4 w-4 rounded border-white/20 bg-white/10 text-brand-purple focus:ring-brand-purple cursor-not-allowed accent-brand-purple"
          />
          <div className="text-xs">
            <span className="font-medium text-white">Strictly Necessary (Always Active)</span>
            <p className="text-gray-300">Required for fundamental actions like authentication, regional detection, and cart management.</p>
          </div>
        </label>

        {/* Analytics */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={preferences.analytics}
            onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
            className="mt-1 h-4 w-4 rounded border-white/20 bg-white/10 text-brand-purple focus:ring-brand-purple accent-brand-purple cursor-pointer"
          />
          <div className="text-xs">
            <span className="font-medium text-white">Analytics & Performance</span>
            <p className="text-gray-300">Allows us to analyze site visits and customer journeys to optimize platform performance.</p>
          </div>
        </label>

        {/* Marketing */}
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={preferences.marketing}
            onChange={(e) => setPreferences({ ...preferences, marketing: e.target.checked })}
            className="mt-1 h-4 w-4 rounded border-white/20 bg-white/10 text-brand-purple focus:ring-brand-purple accent-brand-purple cursor-pointer"
          />
          <div className="text-xs">
            <span className="font-medium text-white">Marketing & Personalization</span>
            <p className="text-gray-300">Used to serve relevant promotional offers and tailored advertisements based on preferences.</p>
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
          className="px-4 py-2 text-xs font-semibold text-red-200 border border-red-500/30 rounded-lg hover:bg-red-500/10 transition-all duration-200"
        >
          Reject Optional
        </button>
        <button
          type="button"
          onClick={handleSavePreferences}
          className="px-4 py-2 text-xs font-semibold text-gray-200 border border-white/20 rounded-lg hover:bg-white/10 transition-all duration-200"
        >
          Save Settings
        </button>
        <button
          type="button"
          onClick={handleAcceptAll}
          className="px-5 py-2 text-xs font-semibold text-white bg-brand-orange hover:bg-brand-orange/90 rounded-lg transition-all duration-200 shadow-md shadow-brand-orange/20"
        >
          Accept All
        </button>
      </div>
    </div>
  );
}
