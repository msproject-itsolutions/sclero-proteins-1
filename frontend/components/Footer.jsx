'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useDispatch, useSelector } from 'react-redux';
import {
  Globe,
  Facebook,
  Instagram,
  Linkedin,
  Mail,
  Send,
  Twitter,
  Youtube,
} from 'lucide-react';
import { getApiUrl, postJson } from '../lib/api';
import { setRegion } from '../store/regionSlice';
import { fetchCart } from '../store/cartSlice';
import { isProdHost, crossDomainUrl } from '../lib/region';
import { safePublicHref } from '../lib/safeUrl';
import { firstApiError, isValidEmail } from '../lib/formValidation';
import FooterCredit from './FooterCredit';

const COUNTRIES = [
  { code: 'UK', name: 'United Kingdom' },
  { code: 'IN', name: 'India' },
];

export default function Footer() {
  const dispatch = useDispatch();
  const { currentRegion, session_id } = useSelector((state) => state.region);
  const branding = useSelector((state) => state.region.branding);
  const companyInfo = branding?.companyInfo || {};
  const socialLinks = branding?.socialLinks || {};

  const contactEmail = currentRegion === 'IN'
    ? (branding?.emailIN || companyInfo.support || companyInfo.email)
    : (branding?.emailUK || companyInfo.support || companyInfo.email);

  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
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
    const cleanedEmail = email.trim().toLowerCase();
    if (!isValidEmail(cleanedEmail)) {
      setStatus('error');
      setErrorMsg('Please enter a valid email.');
      return;
    }

    setStatus('pending');
    setErrorMsg('');

    try {
      const { response, data } = await postJson('/api/newsletter/subscribe/', {
        email: cleanedEmail,
        region: currentRegion,
        source: 'footer',
      });
      if (!response.ok) throw new Error(firstApiError(data, 'Could not subscribe. Please try again.'));
      setStatus('success');
      setEmail('');
    } catch (error) {
      setStatus('error');
      setErrorMsg(error.message || 'Could not subscribe. Please try again.');
    }
  };

  const applyRegion = (country) => {
    if (typeof window !== 'undefined' && isProdHost(window.location.hostname)) {
      const { pathname, search } = window.location;
      window.location.href = crossDomainUrl(country.code, pathname, search);
      return;
    }
    dispatch(setRegion(country));
    if (session_id) {
      dispatch(fetchCart({ session_id, region: country.code }));
    }
  };

  const shopLinks = [
    { name: 'Shop all products', href: '/products' },
    { name: 'Wholesale and bulk', href: '/bulk' },
    { name: 'Track your order', href: '/account' },
  ];

  const supportLinks = [
    { name: 'Contact us', href: '/contact' },
    { name: 'FAQs', href: '/faq' },
    { name: 'Glossary', href: '/glossary' },
    { name: 'Shipping and delivery', href: '/policies/shipping' },
    { name: 'Returns and refunds', href: '/policies/refund' },
  ];

  const legalLinks = [
    { name: 'Privacy policy', href: '/policies/privacy' },
    { name: 'Terms of service', href: '/policies/terms' },
    { name: 'Cookie policy', href: '/policies/cookie' },
    { name: 'Accessibility', href: '/policies/accessibility' },
  ];

  const fromCmsLinks = (items, fallback) => {
    if (!Array.isArray(items) || items.length === 0) return fallback;
    return items
      .filter((item) => item?.label && item?.url)
      .filter((item) => {
        const lowerUrl = (item.url || '').toLowerCase();
        const lowerLabel = (item.label || '').toLowerCase();
        return !(
          lowerUrl.includes('science') ||
          lowerLabel.includes('science') ||
          lowerUrl.includes('sustainability') ||
          lowerLabel.includes('sustainability')
        );
      })
      .map((item) => ({ name: item.label, href: safePublicHref(item.url) }))
      .filter((item) => item.href);
  };

  const socials = [
    { icon: Instagram, label: 'Instagram', href: socialLinks.instagram || 'https://www.instagram.com/scleroproteins/' },
    { icon: Facebook, label: 'Facebook', href: socialLinks.facebook },
    { icon: Twitter, label: 'X (Twitter)', href: socialLinks.twitter || socialLinks.x },
    { icon: Linkedin, label: 'LinkedIn', href: socialLinks.linkedin },
    { icon: Youtube, label: 'YouTube', href: socialLinks.youtube },
  ].filter((social) => /^https?:\/\//i.test(social.href || ''));

  const LinkColumn = ({ title, links }) => (
    <div className="space-y-4">
      <h4 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/[0.58]">{title}</h4>
      <ul className="space-y-2.5 text-sm leading-[1.7] text-white/80">
        {links.map((link) => (
          <li key={link.name}>
            <Link href={link.href} className="transition-colors duration-200 hover:text-white">
              {link.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <footer className="mt-auto bg-[linear-gradient(135deg,#101871_0%,#160E55_56%,#520446_100%)] text-white">
      <div className="container-page py-12">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
          <div className="space-y-5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/[0.58]">Stay connected</p>
              <h3 className="mt-2 text-heading-3 text-white">Get product updates and support notes.</h3>
            </div>

            {status === 'success' ? (
              <div className="rounded-[18px] border border-white/[0.14] bg-white/10 px-4 py-3 text-sm font-semibold text-white">
                You&apos;re subscribed. Check your inbox for the next update.
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                    aria-label="Email address"
                    className="flex-1 rounded-full border border-white/[0.18] bg-white/[0.08] px-4 py-3 text-sm text-white caret-white placeholder:text-white/40 focus:border-white/40 focus:outline-none"
                    style={{ WebkitTextFillColor: '#ffffff' }}
                  />
                  <button
                    type="submit"
                    disabled={status === 'pending'}
                    className="btn-primary px-5 py-3 text-[13px]"
                  >
                    <Send className="h-4 w-4" />
                    {status === 'pending' ? 'Subscribing...' : 'Subscribe'}
                  </button>
                </div>
                {status === 'error' && errorMsg && (
                  <p className="text-xs text-rose-200">{errorMsg}</p>
                )}
              </form>
            )}

            {contactEmail && (
              <a href={`mailto:${contactEmail}`} className="inline-flex items-center gap-2 text-sm text-white/[0.82] transition-colors hover:text-white">
                <Mail className="h-4 w-4" />
                {contactEmail}
              </a>
            )}

            <div className="flex flex-wrap gap-2">
              {socials.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={social.label}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/[0.78] transition-colors hover:border-white/35 hover:text-white"
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                );
              })}
            </div>
          </div>

          <LinkColumn title="Shop" links={fromCmsLinks(footerSettings?.shop, shopLinks)} />
          <LinkColumn title="Support" links={fromCmsLinks(footerSettings?.support, supportLinks)} />
          <LinkColumn title="Legal" links={fromCmsLinks(footerSettings?.legal, legalLinks)} />
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-5 py-5 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-3">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-white/[0.56]">
              <Globe className="h-3.5 w-3.5" />
              Country selector
            </div>
            <div className="flex flex-wrap gap-2">
              {COUNTRIES.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => applyRegion(country)}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${
                    currentRegion === country.code
                      ? 'border-transparent bg-white text-[#101871]'
                      : 'border-white/15 bg-white/5 text-white/80 hover:border-white/35'
                  }`}
                >
                  {country.name}
                </button>
              ))}
            </div>
          </div>

          <div className="text-[12px] leading-[1.7] text-white/[0.56] md:text-right">
            <FooterCredit />
            {(companyInfo.cin || companyInfo.gst) && (
              <p>
                {companyInfo.cin ? `Company registration ${companyInfo.cin}` : ''}
                {companyInfo.cin && companyInfo.gst ? ' · ' : ''}
                {companyInfo.gst || ''}
              </p>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
