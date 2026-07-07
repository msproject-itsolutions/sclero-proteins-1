'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSelector } from 'react-redux';
import {
  Mail, Phone, MapPin, Truck, Award, RefreshCw, ShieldCheck,
  Instagram, Facebook, Linkedin, Youtube, Send, CheckCircle2,
} from 'lucide-react';
import Logo, { LogoLockup } from './Logo';
import { getApiUrl } from '../lib/api';

const COMPANY_REGISTRATION_NUMBER =
  process.env.NEXT_PUBLIC_COMPANY_REGISTRATION_NUMBER || '';
const INDIA_GSTIN = process.env.NEXT_PUBLIC_IN_GSTIN || '';

// Region-aware copy so the UK store never shows a £ message to an India shopper.
const REGION_COPY = {
  IN: {
    freeShip: 'Free delivery on orders over ₹3,000',
    taxBadge: 'GST-compliant invoicing',
    email: 'support@scleroproteins.in',
    phone: '+91 80 4710 0000',
    phoneHref: 'tel:+918047100000',
    address: '',
  },
  UK: {
    freeShip: 'Free UK shipping over £50',
    taxBadge: 'VAT receipts on every order',
    email: 'support@scleroproteins.co.uk',
    phone: '+44 (0)20 4574 0000',
    phoneHref: 'tel:+442045740000',
    address: COMPANY_REGISTRATION_NUMBER
      ? `Registered in England & Wales · Company No. ${COMPANY_REGISTRATION_NUMBER}`
      : '',
  },
};

export default function Footer() {
  const { currentRegion } = useSelector((s) => s.region);
  const branding = useSelector((s) => s.region.branding);
  const copy = REGION_COPY[currentRegion === 'IN' ? 'IN' : 'UK'];

  const contactEmail = currentRegion === 'IN'
    ? (branding?.emailIN || 'support@scleroproteins.in')
    : (branding?.emailUK || 'support@scleroproteins.co.uk');

  const contactPhone = currentRegion === 'IN'
    ? (branding?.phoneIN || '+91 80 4710 0000')
    : (branding?.phoneUK || '+44 (0)20 4574 0000');

  const contactPhoneHref = `tel:${contactPhone.replace(/[^+\d]/g, '')}`;
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | pending | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const [footerSettings, setFooterSettings] = useState(null);

  useEffect(() => {
    fetch(getApiUrl('/api/site-settings/FOOTER_SETTINGS/'))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.value && typeof data.value === 'object') setFooterSettings(data.value);
      })
      .catch(() => {});
  }, []);

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
      setEmail('');
    } catch (err) {
      setStatus('error');
      setErrorMsg('Could not subscribe. Try again.');
    }
  };

  const shopLinks = [
    { name: 'Combo Collagen®', href: '/products/COMBO-COLLAGEN-60' },
    { name: 'OvoShell Collagen™', href: '/products/OVOSHELL-COLLAGEN-60' },
    { name: 'BJC® Bone & Joint Care', href: '/products/BJC-BONE-JOINT' },
    { name: 'SoilPro™', href: '/products/SOILPRO-1KG' },
    { name: 'LawnCal™', href: '/products/LAWNCAL-25KG' },
    { name: 'OvoMatrix™ technology', href: '/pages/ovomatrix' },
    { name: 'Shop all products', href: '/products' },
    { name: 'Wholesale & bulk', href: '/bulk' },
  ];

  const careLinks = [
    { name: 'Contact us', href: '/contact' },
    { name: 'FAQs', href: '/policies/faq' },
    { name: 'Shipping & delivery', href: '/policies/shipping' },
    { name: 'Returns & refunds', href: '/policies/refund' },
    { name: 'Track your order', href: '/account' },
    { name: 'Bulk enquiries', href: '/bulk' },
  ];

  const companyLinks = [
    { name: 'About us', href: '/about' },
    { name: 'Our science', href: '/about#science' },
    { name: 'Sustainability', href: '/about#sustainability' },
    { name: 'Blog & insights', href: '/blog' },
    { name: 'Wholesale partners', href: '/bulk' },
  ];

  const legalLinks = [
    { name: 'Privacy policy', href: '/policies/privacy' },
    { name: 'Terms of service', href: '/policies/terms' },
    { name: 'Cookie policy', href: '/policies/cookie' },
    { name: 'Accessibility', href: '/policies/accessibility' },
    { name: 'GDPR data export', href: '/account' },
  ];

  const fromCmsLinks = (items, fallback) => {
    if (!Array.isArray(items) || items.length === 0) return fallback;
    return items
      .filter((item) => item?.label && item?.url)
      .map((item) => ({ name: item.label, href: item.url }));
  };
  const effectiveShopLinks = fromCmsLinks(footerSettings?.shop, shopLinks);
  const effectiveCompanyLinks = fromCmsLinks(footerSettings?.company, companyLinks);
  const effectiveCareLinks = fromCmsLinks(footerSettings?.support, careLinks);
  const effectiveLegalLinks = fromCmsLinks(footerSettings?.legal, legalLinks);

  const trustBadges = [
    { icon: Truck, label: copy.freeShip },
    { icon: Award, label: 'GMP-certified manufacture' },
    { icon: RefreshCw, label: '30-day money-back guarantee' },
    { icon: ShieldCheck, label: 'Secure SSL & PCI-DSS checkout' },
  ];

  const socials = [
    { icon: Instagram, label: 'Instagram', href: 'https://www.instagram.com/scleroproteins' },
    { icon: Facebook, label: 'Facebook', href: 'https://www.facebook.com/scleroproteins' },
    { icon: Linkedin, label: 'LinkedIn', href: 'https://www.linkedin.com/company/scleroproteins' },
    { icon: Youtube, label: 'YouTube', href: 'https://www.youtube.com/@scleroproteins' },
  ];

  const LinkColumn = ({ title, links }) => (
    <div className="space-y-4">
      <h4 className="text-[11px] font-medium uppercase tracking-luxe text-[#BFB9AE]">{title}</h4>
      <ul className="space-y-2.5 text-[13.5px] text-[#EDEBE4]/80">
        {links.map((l) => (
          <li key={l.name}>
            <Link href={l.href} className="transition-colors duration-200 hover:text-white hover:underline underline-offset-4">{l.name}</Link>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <footer className="mt-auto bg-surface-inverse text-[#EDEBE4]">
      {/* Trust strip */}
      <div className="border-b border-white/10">
        <div className="container-page grid grid-cols-2 gap-4 py-7 md:grid-cols-4">
          {trustBadges.map((b, i) => {
            const Icon = b.icon;
            return (
              <div key={i} className="flex items-center gap-2.5 text-xs">
                <Icon className="h-5 w-5 shrink-0 text-[#C89838]" />
                <span className="font-medium leading-tight text-[#EDEBE4]/90">{b.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main grid: brand/contact block + link columns */}
      <div className="container-page py-14 lg:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 lg:grid-cols-12">
          {/* Brand + contact */}
          <div className="space-y-5 sm:col-span-2 lg:col-span-4">
            <Link href="/" aria-label="Sclero Proteins home">
              <LogoLockup markClass="h-10 w-10" wordClass="h-[16px]" inverse />
            </Link>
            <p className="max-w-sm text-[13.5px] leading-[1.7] text-[#BFB9AE]">
              Clinically-formulated collagen, bone &amp; joint, and active-nutrition supplements —
              manufactured to GMP standards and third-party tested for purity and potency.
            </p>
            <ul className="space-y-2.5 text-[13px] text-[#EDEBE4]/80">
              <li>
                <a href={`mailto:${contactEmail}`} className="flex items-center gap-2.5 transition-colors hover:text-white">
                  <Mail className="h-4 w-4 shrink-0 text-[#C89838]" /> {contactEmail}
                </a>
              </li>
              <li>
                <a href={contactPhoneHref} className="flex items-center gap-2.5 transition-colors hover:text-white">
                  <Phone className="h-4 w-4 shrink-0 text-[#C89838]" /> {contactPhone}
                </a>
              </li>
              {copy.address && (
                <li className="flex items-start gap-2.5">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#C89838]" />
                  <span className="text-[#BFB9AE]">{copy.address}</span>
                </li>
              )}
            </ul>
            {/* Socials */}
            <div className="flex items-center gap-3 pt-1">
              {socials.map((s) => {
                const Icon = s.icon;
                return (
                  <a key={s.label} href={s.href} target="_blank" rel="noreferrer" aria-label={s.label}
                    className="flex h-9 w-9 items-center justify-center rounded-sm border border-white/15 text-[#EDEBE4]/70 transition-colors hover:border-[#C89838] hover:text-[#C89838]">
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Link columns */}
          <div className="sm:col-span-1 lg:col-span-2"><LinkColumn title="Shop" links={effectiveShopLinks} /></div>
          <div className="sm:col-span-1 lg:col-span-2"><LinkColumn title="Customer care" links={effectiveCareLinks} /></div>
          <div className="sm:col-span-1 lg:col-span-2"><LinkColumn title="Company" links={effectiveCompanyLinks} /></div>
          <div className="sm:col-span-1 lg:col-span-2"><LinkColumn title="Legal" links={effectiveLegalLinks} /></div>
        </div>
      </div>

      {/* Newsletter band */}
      <div className="border-y border-white/10 bg-white/[0.03]">
        <div className="container-page py-12">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="max-w-md text-center md:text-left">
              <h3 className="font-display text-[26px] font-medium tracking-tight text-white sm:text-[30px]">
                Get 10% off your first order
              </h3>
              <p className="mt-1.5 text-[13.5px] leading-[1.7] text-[#BFB9AE]">
                Join the Sclero community for science-backed wellness tips, new-product drops, and members-only offers.
              </p>
            </div>
            <div className="w-full md:w-auto md:min-w-[380px]">
              {status === 'success' ? (
                <div className="flex items-center justify-center gap-2 rounded-sm border border-brand-success/30 bg-brand-success/10 px-4 py-3 text-center text-sm font-medium text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" /> You&apos;re subscribed — check your inbox.
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    aria-label="Email address"
                    className="flex-1 rounded-sm border border-white/20 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-[#C89838] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={status === 'pending'}
                    className="inline-flex items-center justify-center gap-1.5 rounded-sm border border-white bg-white px-5 py-2.5 text-[13px] font-medium tracking-[0.02em] text-[#1A1A1A] transition-all hover:bg-transparent hover:text-white disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                    {status === 'pending' ? 'Subscribing…' : 'Subscribe'}
                  </button>
                </form>
              )}
              {status === 'error' && errorMsg && (
                <p className="mt-2 text-xs text-red-300">{errorMsg}</p>
              )}
              <p className="mt-2 text-[11px] text-[#8F8A80]">
                By subscribing you agree to our <Link href="/policies/privacy" className="underline underline-offset-4 hover:text-[#EDEBE4]">Privacy Policy</Link>. Unsubscribe anytime.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Payment + bottom strip */}
      <div className="container-page py-6">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-3">
            <Logo className="h-7 w-7" />
            <div className="text-[11.5px] leading-relaxed text-[#8F8A80]">
              <p>© 2026 Sclero Proteins Ltd. All rights reserved.</p>
              {(COMPANY_REGISTRATION_NUMBER || INDIA_GSTIN) && (
                <p>
                  {COMPANY_REGISTRATION_NUMBER
                    ? `Registered in England & Wales ${COMPANY_REGISTRATION_NUMBER}`
                    : ''}
                  {COMPANY_REGISTRATION_NUMBER && INDIA_GSTIN ? ' · ' : ''}
                  {INDIA_GSTIN ? `GSTIN ${INDIA_GSTIN}` : ''}
                </p>
              )}
              <p>Designed by MSProject.in</p>
            </div>
          </div>

          {/* Accepted payment methods */}
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-luxe text-[#8F8A80]">
            <span className="hidden sm:inline">We accept</span>
            {['Visa', 'Mastercard', 'Amex', currentRegion === 'IN' ? 'UPI' : 'PayPal'].map((m) => (
              <span key={m} className="rounded-xs border border-white/15 bg-white/5 px-2 py-1 text-[#EDEBE4]/70">{m}</span>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
