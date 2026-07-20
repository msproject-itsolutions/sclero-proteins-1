'use client';

import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { X } from 'lucide-react';

const STORAGE_KEY = 'sclero_promo_dismissed';

export default function PromoBanner() {
  const { currentRegion, branding } = useSelector((s) => s.region);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const message = currentRegion === 'IN'
    ? branding?.announcementIN
    : branding?.announcementUK;
  const enabled = branding?.announcementEnabled === true && Boolean(message?.trim());

  useEffect(() => {
    setMounted(true);
    try {
      setVisible(localStorage.getItem(STORAGE_KEY) !== message);
    } catch {
      setVisible(true);
    }
  }, [message]);

  if (!mounted || !visible || !enabled) return null;

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, message); } catch {}
    setVisible(false);
  };

  return (
    <div
      className="relative w-full bg-surface-inverse text-white animate-[fadeDown_0.3s_ease-out]"
      role="region"
      aria-label="Site-wide promotion"
    >
      <style jsx>{`
        @keyframes fadeDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="mx-auto flex max-w-container items-center justify-center px-4 py-2 text-[10.5px] font-medium uppercase tracking-[0.14em] sm:px-6 lg:px-8">
        <span className="text-center">{message}</span>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss promotional banner"
          className="absolute right-3 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-full text-white/80 hover:bg-white/10 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
