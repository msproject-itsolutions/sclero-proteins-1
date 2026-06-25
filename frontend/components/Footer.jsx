'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import {
  Mail, Phone, MapPin, Heart, Truck, Award, RefreshCw, ShieldCheck,
  Instagram, Facebook, Linkedin, Youtube, Send
} from 'lucide-react';
import Logo from './Logo';
import { getApiUrl } from '../lib/api';

export default function Footer() {
  const { currentRegion } = useSelector((s) => s.region);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | pending | success | error
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setStatus('error');
      setErrorMsg('Please enter a valid email.');
      return;
    }
    setStatus('pending');
    setErrorMsg('');
    try {
      const res = await fetch(getApiUrl('/api/newsletter/subscribe/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, region: currentRegion, source: 'footer' }),
      });
      if (!res.ok) throw new Error('subscribe failed');
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMsg('Could not subscribe. Try again.');
    }
  };

  const shopLinks = [
    { name: 'Collagen', href: '/products?category=collagen' },
    { name: 'BJC® Bone & Joint Care', href: '/products?category=bone-joint-care' },
    { name: 'CalPure', href: '/products?category=calcium' },
    { name: 'Whey Protein', href: '/products?category=protein' },
    { name: 'Creatine', href: '/products?category=creatine' },
    { name: 'All products', href: '/products' },
    { name: 'Wholesale', href: '/bulk' },
  ];

  const careLinks = [
    { name: 'Contact', href: '/contact' },
    { name: 'FAQs', href: '/policies/faq' },
    { name: 'Shipping', href: '/policies/shipping' },
    { name: 'Refund policy', href: '/policies/refund' },
    { name: 'Track order', href: '/account' },
    { name: 'Bulk enquiries', href: '/bulk' },
  ];

  const companyLinks = [
    { name: 'About', href: '/about' },
    { name: 'Science', href: '#' },
    { name: 'Resources', href: '#' },
    { name: 'Blog', href: '/#blog' },
    { name: 'Sustainability', href: '#' },
    { name: 'Careers', href: '#' },
  ];

  const legalLinks = [
    { name: 'Privacy', href: '/policies/privacy' },
    { name: 'Terms', href: '/policies/terms' },
    { name: 'Cookie policy', href: '/policies/cookie' },
    { name: 'Accessibility', href: '/policies/accessibility' },
    { name: 'GDPR data export', href: '/account' },
  ];

  const trustBadges = [
    { icon: Truck, label: 'Free UK shipping over £50' },
    { icon: Award, label: 'GMP-certified manufacture' },
    { icon: RefreshCw, label: '30-day money-back' },
    { icon: ShieldCheck, label: 'Secure SSL & PCI-DSS' },
  ];

  return (
    <footer className="mt-auto bg-brand-navy text-white">
      {/* Trust strip */}
      <div className="border-b border-white/10">
        <div className="container-page grid grid-cols-2 gap-4 py-6 md:grid-cols-4">
          {trustBadges.map((b, i) => {
            const Icon = b.icon;
            return (
              <div key={i} className="flex items-center gap-2.5 text-xs">
                <Icon className="h-5 w-5 shrink-0 text-brand-orange" />
                <span className="font-semibold text-white/90 leading-tight">{b.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Columns */}
      <div className="container-page py-12">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-4">
          {/* Shop */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-white">Shop</h4>
            <ul className="space-y-2 text-xs text-white/70">
              {shopLinks.map((l) => (
                <li key={l.name}>
                  <Link href={l.href} className="hover:text-brand-orange transition-colors">{l.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Customer care */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-white">Customer care</h4>
            <ul className="space-y-2 text-xs text-white/70">
              {careLinks.map((l) => (
                <li key={l.name}>
                  <Link href={l.href} className="hover:text-brand-orange transition-colors">{l.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-white">Company</h4>
            <ul className="space-y-2 text-xs text-white/70">
              {companyLinks.map((l) => (
                <li key={l.name}>
                  <Link href={l.href} className="hover:text-brand-orange transition-colors">{l.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-white">Legal & accessibility</h4>
            <ul className="space-y-2 text-xs text-white/70">
              {legalLinks.map((l) => (
                <li key={l.name}>
                  <Link href={l.href} className="hover:text-brand-orange transition-colors">{l.name}</Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Newsletter signup band */}
      <div className="border-y border-white/10 bg-white/[0.03]">
        <div className="container-page py-10">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="text-center md:text-left">
              <h3 className="text-xl font-black tracking-tight text-white sm:text-2xl">
                Get 10% off your first order
              </h3>
              <p className="mt-1 text-xs text-white/70">
                Join the Sclero community for science-backed wellness updates and members-only offers.
              </p>
            </div>
            <div className="w-full md:w-auto md:min-w-[360px]">
              {status === 'success' ? (
                <div className="rounded-2xl border border-brand-success/30 bg-brand-success/10 px-4 py-3 text-center text-sm font-bold text-brand-success">
                  ✓ You're subscribed.
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    autoComplete="email"
                    required
                    aria-label="Email address"
                    className="flex-1 rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-brand-orange focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={status === 'pending'}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-orange px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-brand-navy transition-all hover:bg-brand-gold disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    {status === 'pending' ? 'Subscribing…' : 'Subscribe'}
                  </button>
                </form>
              )}
              {status === 'error' && errorMsg && (
                <p className="mt-2 text-xs text-red-300">{errorMsg}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom strip */}
      <div className="container-page py-6">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-3">
            <Logo className="h-7 w-7" />
            <div className="text-[11px] text-white/60 leading-relaxed">
              <p>© 2026 Sclero Proteins Ltd. All rights reserved.</p>
              <p>Sclero Proteins Ltd. Registered in England & Wales 14722854 · GSTIN 24AFXFS9162D1ZG</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a href="https://www.instagram.com/scleroproteins.co.uk/" target="_blank" rel="noreferrer" aria-label="Instagram" className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white/70 hover:border-brand-orange hover:text-brand-orange">
              <Instagram className="h-4 w-4" />
            </a>
            <a href="#" target="_blank" rel="noreferrer" aria-label="Facebook" className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white/70 hover:border-brand-orange hover:text-brand-orange">
              <Facebook className="h-4 w-4" />
            </a>
            <a href="#" target="_blank" rel="noreferrer" aria-label="LinkedIn" className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white/70 hover:border-brand-orange hover:text-brand-orange">
              <Linkedin className="h-4 w-4" />
            </a>
            <a href="#" target="_blank" rel="noreferrer" aria-label="YouTube" className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white/70 hover:border-brand-orange hover:text-brand-orange">
              <Youtube className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
