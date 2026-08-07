'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { setRegion } from '../store/regionSlice';
import { fetchCart, clearCartLocal, clearCart } from '../store/cartSlice';
import { getApiUrl, postJson } from '../lib/api';
import { isProdHost, crossDomainUrl } from '../lib/region';
import { safePublicHref } from '../lib/safeUrl';
import { firstApiError, isValidEmail } from '../lib/formValidation';
import {
  ChevronDown,
  Globe,
  Menu,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { LogoLockup } from './Logo';

const COUNTRIES = [
  {
    code: 'UK',
    name: 'United Kingdom',
    currency_code: 'GBP',
    currency_symbol: '£',
    domain: 'scleroproteins.co.uk',
    active: true,
  },
  {
    code: 'IN',
    name: 'India',
    currency_code: 'INR',
    currency_symbol: '₹',
    domain: 'scleroproteins.in',
    active: true,
  },
];

function normalizeNavLinks(inputLinks) {
  const normalized = [];

  (inputLinks || []).forEach((link) => {
    if (!link?.label || !link?.url) return;
    const lowerLabel = link.label.toLowerCase();
    const lowerUrl = link.url.toLowerCase();

    if (
      lowerLabel.includes('glossary') ||
      lowerUrl.includes('/glossary') ||
      lowerLabel.includes('science') ||
      lowerLabel.includes('sustainability') ||
      lowerUrl.includes('/science') ||
      lowerUrl.includes('/sustainability') ||
      lowerUrl.includes('#science') ||
      lowerUrl.includes('#sustainability')
    ) {
      return;
    }

    const nextLink = { ...link };
    nextLink.url = safePublicHref(nextLink.url);
    if (!nextLink.url) return;
    if (lowerLabel === 'products') nextLink.label = 'Shop';
    if (lowerLabel === 'knowledge hub') nextLink.label = 'Learn';
    if (lowerLabel === 'about us' || lowerLabel === 'our story') nextLink.label = 'Our Story';
    if (
      lowerLabel.includes('wholesale') ||
      lowerUrl.includes('/bulk') ||
      lowerLabel === 'contact us' ||
      lowerUrl.includes('/contact')
    ) {
      nextLink.label = 'Contact';
      nextLink.url = '/contact';
      if (normalized.some((item) => item.url === '/contact' || item.label === 'Contact')) {
        return;
      }
    }
    normalized.push(nextLink);
  });

  if (!normalized.some((link) => link.url === '/about')) {
    normalized.splice(2, 0, { label: 'Our Story', url: '/about' });
  }

  if (!normalized.some((link) => link.url === '/contact')) {
    normalized.push({ label: 'Contact', url: '/contact' });
  }

  return normalized;
}

export default function Navbar({ onOpenCart, onOpenAdmin }) {
  const dispatch = useDispatch();
  const { currentRegion } = useSelector((state) => state.region);
  const cartItems = useSelector((state) => state.cart.items);
  const session_id = useSelector((state) => state.region.session_id);
  const authUser = useSelector((state) => state.auth?.user);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const firstMobileLinkRef = useRef(null);

  const [showDropdown, setShowDropdown] = useState(false);
  const [categories, setCategories] = useState([]);
  const [cmsNavLinks, setCmsNavLinks] = useState(null);
  const [showShopMenu, setShowShopMenu] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [mounted, setMounted] = useState(false);

  const [showClearCartModal, setShowClearCartModal] = useState(false);
  const [pendingRegion, setPendingRegion] = useState(null);
  const [showFutureRegionModal, setShowFutureRegionModal] = useState(false);
  const [futureRegionName, setFutureRegionName] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [optInSuccess, setOptInSuccess] = useState(false);
  const [optInLoading, setOptInLoading] = useState(false);
  const [optInError, setOptInError] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setShowShopMenu(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    if (!mobileOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!currentRegion) return;
    fetch(getApiUrl(`/api/products/categories/?region=${currentRegion}`))
      .then((res) => res.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]));
  }, [currentRegion]);

  useEffect(() => {
    fetch(getApiUrl('/api/site-settings/NAVIGATION_MENUS/'))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data?.value)) setCmsNavLinks(data.value);
      })
      .catch(() => {});
  }, []);

  const submitSearch = (event) => {
    event.preventDefault();
    if (!searchTerm.trim()) return;
    window.location.href = `/products?search=${encodeURIComponent(searchTerm.trim())}`;
  };

  const submitLaunchNotification = async () => {
    if (!isValidEmail(emailInput)) {
      setOptInError('Please enter a valid email address.');
      return;
    }
    setOptInLoading(true);
    setOptInError('');
    try {
      const { response, data } = await postJson('/api/notifications/launch-opt-in/', {
        email: emailInput,
        region: futureRegionName,
      });
      if (!response.ok) {
        throw new Error(data.error || 'Could not subscribe.');
      }
      setOptInSuccess(true);
    } catch (error) {
      setOptInError(error.message || 'Could not subscribe. Please try again.');
    } finally {
      setOptInLoading(false);
    }
  };

  const closeMobile = () => setMobileOpen(false);
  const totalQty = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  const applyRegion = (country) => {
    if (typeof window !== 'undefined' && isProdHost(window.location.hostname)) {
      const { pathname: currentPath, search } = window.location;
      window.location.href = crossDomainUrl(country.code, currentPath, search);
      return;
    }
    dispatch(setRegion(country));
    if (session_id) {
      dispatch(fetchCart({ session_id, region: country.code }));
    }
  };

  const handleCountrySwitch = (country) => {
    setShowDropdown(false);
    setMobileOpen(false);

    if (!country.active) {
      setFutureRegionName(country.name);
      setShowFutureRegionModal(true);
      return;
    }

    if (currentRegion === country.code) return;

    try {
      localStorage.setItem('sclero_region_set', 'true');
    } catch {}

    if (cartItems.length > 0) {
      setPendingRegion(country);
      setShowClearCartModal(true);
    } else {
      applyRegion(country);
    }
  };

  const fallbackNavLinks = [
    { label: 'Shop', url: '/products', mega_menu: true },
    { label: 'Our Story', url: '/about' },
    { label: 'Learn', url: '/knowledge-hub' },
    { label: 'Insights', url: '/blog' },
    { label: 'Contact', url: '/contact' },
  ];

  const rawNavLinks = cmsNavLinks && cmsNavLinks.length ? cmsNavLinks : fallbackNavLinks;
  const navLinks = normalizeNavLinks(!mounted ? fallbackNavLinks : rawNavLinks)
    .filter((link) => !link.region_limit || String(link.region_limit).toUpperCase() === currentRegion);

  // Keep the public-facing identity stable across country/domain changes.
  // Regional configuration still controls commerce and contact details, but
  // must never swap the official bird mark or wordmark.
  // v2 asset restores the full descenders on the tagline's "g" and "y",
  // which were cropped off in the original export.
  const headerLogoSrc = '/logo-header-tagline-v2.png';

  const formatRegionDisplay = (code) => {
    if (code === 'IN') return 'India';
    if (code === 'UK') return 'United Kingdom';
    if (code === 'US') return 'USA';
    if (code === 'EU') return 'Europe';
    return 'UAE';
  };

  const isActiveLink = (url) => {
    if (url === '/') return pathname === '/';
    return pathname === url || pathname.startsWith(`${url}/`);
  };

  const navLinkClass = 'relative whitespace-nowrap px-1 py-2 text-sm font-bold tracking-[0.01em] text-ink-secondary transition-colors hover:text-ink-primary xl:text-[15px]';
  return (
    <nav className="energy-navbar sticky top-0 z-40 w-full border-b border-edge/80 bg-white/95 shadow-[0_10px_30px_-24px_rgba(16,24,113,0.55)] backdrop-blur-xl">
      <div className="mx-auto flex h-[92px] max-w-container items-center justify-between gap-3 px-3 sm:px-5 lg:px-4">
        <div className="flex min-w-0 items-center gap-5 lg:gap-7 xl:gap-9">
          <Link href="/" aria-label="Sclero Proteins home" className="shrink-0">
            <LogoLockup
              assetSrc={headerLogoSrc}
              showMarkWithAsset
              markClass="h-[54px] w-[54px] sm:h-[60px] sm:w-[60px] lg:h-[64px] lg:w-[64px]"
              wordClass="h-[40px] sm:h-[46px] lg:h-[50px]"
            />
          </Link>

          <div className="hidden items-center gap-5 xl:flex xl:gap-7">
            {navLinks.map((link, index) => {
              const isProducts = link.mega_menu || link.url === '/products';
              const activeClass = isActiveLink(link.url) ? 'text-ink-primary' : '';

              if (isProducts) {
                return (
                  <div
                    key={`${link.label}-${index}`}
                    className="relative"
                    onMouseEnter={() => setShowShopMenu(true)}
                    onMouseLeave={() => setShowShopMenu(false)}
                  >
                    <Link
                      href={link.url}
                      className={`${navLinkClass} ${activeClass}`}
                      onClick={() => setShowShopMenu((prev) => !prev)}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {link.label}
                        {categories.length > 0 && <ChevronDown className="h-3.5 w-3.5" />}
                      </span>
                      <span className={`absolute inset-x-1 -bottom-[14px] h-[2px] rounded-full bg-brand-gradient transition-opacity ${isActiveLink(link.url) ? 'opacity-100' : 'opacity-0'}`} />
                    </Link>
                    {showShopMenu && categories.length > 0 && (
                      <div className="animate-fade-in absolute left-0 top-full origin-top-left pt-4">
                        <div className="w-72 rounded-[24px] border border-edge bg-white p-3 shadow-elevated">
                          <Link
                            href="/products"
                            onClick={() => setShowShopMenu(false)}
                            className="block rounded-2xl px-4 py-3 text-sm font-semibold text-ink-primary transition-colors hover:bg-surface-muted"
                          >
                            Shop all products
                          </Link>
                          <div className="my-2 border-t border-edge-subtle" />
                          {categories.map((category) => (
                            <Link
                              key={category.slug}
                              href={`/products?category=${category.slug}`}
                              onClick={() => setShowShopMenu(false)}
                              className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm text-ink-primary transition-colors hover:bg-surface-muted"
                            >
                              <span>{category.name}</span>
                              {typeof category.product_count === 'number' && (
                                <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[10px] font-semibold text-ink-accent">
                                  {category.product_count}
                                </span>
                              )}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link key={`${link.label}-${index}`} href={link.url} className={`${navLinkClass} ${activeClass}`}>
                  {link.label}
                  <span className={`absolute inset-x-1 -bottom-[14px] h-[2px] rounded-full bg-brand-gradient transition-opacity ${isActiveLink(link.url) ? 'opacity-100' : 'opacity-0'}`} />
                </Link>
              );
            })}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <form onSubmit={submitSearch} className="relative hidden xl:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
            <input
              type="text"
              aria-label="Search products"
              autoComplete="off"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search"
              className="w-32 rounded-full border border-edge bg-surface-muted py-2.5 pl-9 pr-4 text-xs text-ink-primary focus:border-edge-focus focus:bg-white focus:outline-none 2xl:w-40"
            />
          </form>

          <div className="relative hidden md:block">
            <button
              type="button"
              onClick={() => setShowDropdown((value) => !value)}
              aria-haspopup="listbox"
              aria-expanded={showDropdown}
              className="inline-flex items-center gap-2 rounded-full border border-edge bg-white px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-primary transition-colors hover:border-edge-focus"
            >
              <Globe className="h-3.5 w-3.5 text-ink-muted" />
              <span>{mounted ? formatRegionDisplay(currentRegion) : 'United Kingdom'}</span>
              <ChevronDown className="h-3.5 w-3.5 text-ink-muted" />
            </button>

            {showDropdown && (
              <div className="absolute right-0 z-50 mt-2 w-56 rounded-[24px] border border-edge bg-white p-2 shadow-elevated">
                {COUNTRIES.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => handleCountrySwitch(country)}
                    className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left text-xs font-semibold transition-colors hover:bg-surface-muted ${
                      currentRegion === country.code ? 'text-ink-accent' : 'text-ink-primary'
                    }`}
                  >
                    <span>
                      {country.code === 'IN' ? '🇮🇳 ' : '🇬🇧 '}
                      {country.name}
                    </span>
                    <span className="text-[10px] text-ink-subtle">
                      {country.currency_code} ({country.currency_symbol})
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {authUser && (authUser.is_staff || authUser.is_superuser) && (
            <Link
              href="/admin"
              title="Admin console"
              className="hidden rounded-full border border-edge bg-surface px-4 py-2.5 text-xs font-semibold text-ink-primary transition-all hover:border-edge-focus hover:text-ink-accent sm:inline-flex"
            >
              Admin
            </Link>
          )}

          <Link
            href="/account"
            title={authUser ? 'My account' : 'Log in / Sign up'}
            aria-label={authUser ? 'My account' : 'Log in or sign up'}
            className="relative flex items-center justify-center rounded-full border border-edge bg-white p-2.5 text-ink-primary transition-all hover:border-edge-focus hover:text-ink-accent"
          >
            <User className="h-4 w-4" />
            {authUser && (
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-brand-success ring-2 ring-white" />
            )}
          </Link>

          <button
            type="button"
            onClick={onOpenCart}
            aria-label={`Open cart${totalQty > 0 ? ` with ${totalQty} items` : ''}`}
            className="relative flex items-center justify-center rounded-full border border-edge bg-white p-2.5 text-ink-primary transition-all hover:border-edge-focus hover:text-ink-accent"
          >
            <ShoppingBag className="h-4 w-4" />
            {totalQty > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-gradient text-[9px] font-bold text-white">
                {totalQty}
              </span>
            )}
          </button>

          {authUser && (authUser.is_staff || authUser.is_superuser) && (
            <button
              type="button"
              onClick={onOpenAdmin}
              aria-label="Open system settings"
              className="hidden items-center justify-center rounded-full border border-edge bg-surface-muted p-2.5 text-ink-muted transition-all hover:text-ink-accent sm:flex"
              title="System settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-drawer"
            className="hit-target flex items-center justify-center rounded-full border border-edge bg-white p-2.5 text-ink-primary transition-all hover:border-edge-focus hover:text-ink-accent xl:hidden"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div id="mobile-nav-drawer" className="fixed inset-0 z-[80] xl:hidden" role="dialog" aria-modal="true" aria-label="Mobile navigation">
          <div className="absolute inset-0 bg-surface-overlay backdrop-blur-sm" onClick={closeMobile} />

          <nav aria-label="Mobile navigation" className="fixed left-0 top-0 flex h-dvh w-[min(92vw,24rem)] max-w-full flex-col overflow-y-auto bg-white shadow-overlay animate-drawer-in-left">
            <div className="flex items-center justify-between border-b border-edge px-5 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <Link href="/" ref={firstMobileLinkRef} onClick={closeMobile} aria-label="Sclero Proteins home">
                <LogoLockup
                  assetSrc={headerLogoSrc}
                  showMarkWithAsset
                  markClass="h-[60px] w-[60px]"
                  wordClass="h-[48px]"
                />
              </Link>
              <button
                type="button"
                onClick={closeMobile}
                aria-label="Close navigation menu"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-edge text-ink-muted transition-colors hover:text-ink-primary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={submitSearch} className="border-b border-edge px-5 py-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
                <input
                  type="search"
                  aria-label="Search products"
                  autoComplete="off"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search products"
                  className="w-full rounded-full border border-edge bg-surface-muted py-3 pl-10 pr-4 text-sm text-ink-primary focus:border-edge-focus focus:bg-white focus:outline-none"
                />
              </div>
            </form>

            <div className="border-b border-edge px-5 py-4">
              <h4 className="kicker mb-3">Country</h4>
              <div className="grid grid-cols-2 gap-2">
                {COUNTRIES.filter((country) => country.active).map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => handleCountrySwitch(country)}
                    className={`flex items-center justify-center gap-1.5 rounded-full border px-2.5 py-2.5 text-xs font-semibold transition-colors ${
                      currentRegion === country.code
                        ? 'border-transparent bg-brand-gradient text-white shadow-card'
                        : 'border-edge bg-white text-ink-secondary hover:border-edge-focus'
                    }`}
                  >
                    {country.code === 'IN' ? '🇮🇳' : '🇬🇧'} <span>{country.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="border-b border-edge px-5 py-4">
              <h4 className="kicker mb-3">Shop</h4>
              <div className="flex flex-col gap-1 text-sm font-semibold text-ink-primary">
                <Link href="/products" onClick={closeMobile} className="rounded-2xl px-3 py-2.5 hover:bg-surface-muted">
                  All products
                </Link>
                {categories.slice(0, 6).map((category) => (
                  <Link
                    key={category.slug}
                    href={`/products?category=${category.slug}`}
                    onClick={closeMobile}
                    className="rounded-2xl px-3 py-2 text-xs font-semibold text-ink-muted transition-colors hover:bg-surface-muted hover:text-ink-primary"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            </div>

            <div className="border-b border-edge px-5 py-4">
              <h4 className="kicker mb-3">Browse</h4>
              <div className="flex flex-col gap-1 text-sm font-semibold text-ink-primary">
                {navLinks.filter((link) => link.url !== '/products').map((link, index) => (
                  <Link key={`${link.label}-${index}`} href={link.url} onClick={closeMobile} className="rounded-2xl px-3 py-2.5 hover:bg-surface-muted">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            <div className="px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <h4 className="kicker mb-3">Account</h4>
              <div className="flex flex-col gap-1 text-sm font-semibold text-ink-primary">
                {authUser ? (
                  <>
                    <div className="rounded-2xl bg-surface-muted px-3 py-2 text-xs font-semibold text-ink-muted">
                      Hi, <span className="font-bold text-ink-primary">{authUser.first_name || authUser.email || 'there'}</span>
                    </div>
                    <Link href="/account" onClick={closeMobile} className="rounded-2xl px-3 py-2.5 hover:bg-surface-muted">
                      My account
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                        } catch {}
                        closeMobile();
                        window.location.href = '/account';
                      }}
                      className="rounded-2xl px-3 py-2.5 text-left text-xs font-semibold text-ink-danger hover:bg-surface-muted"
                    >
                      Log out
                    </button>
                  </>
                ) : (
                  <Link href="/account" onClick={closeMobile} className="rounded-2xl px-3 py-2.5 hover:bg-surface-muted">
                    Log in / Sign up
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    closeMobile();
                    if (onOpenCart) onOpenCart();
                  }}
                  className="mt-1 flex items-center justify-between rounded-2xl px-3 py-2.5 text-left hover:bg-surface-muted"
                >
                  <span>Cart</span>
                  {totalQty > 0 && (
                    <span className="rounded-full bg-brand-gradient px-2 py-0.5 text-[10px] font-bold text-white">{totalQty}</span>
                  )}
                </button>
              </div>
            </div>
          </nav>
        </div>
      )}

      {mounted && typeof document !== 'undefined' && showClearCartModal && createPortal(
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', zIndex: 999999 }}
          className="flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-fade-in"
        >
          <div className="relative my-auto w-full max-w-md rounded-3xl border border-edge bg-white p-6 sm:p-8 text-center shadow-2xl animate-slide-up">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-accent/10 text-brand-accent">
              <Globe className="h-7 w-7 text-brand-accent" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-ink-primary">Change shopping region?</h3>
            <p className="mb-6 text-sm leading-relaxed text-ink-secondary">
              Changing your shopping region will clear your cart because pricing, inventory, taxes, and shipping rules differ between regions.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowClearCartModal(false);
                  setPendingRegion(null);
                }}
                className="w-1/2 rounded-full border border-edge bg-white py-3 px-4 text-xs font-semibold text-ink-primary transition hover:bg-surface-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingRegion) {
                    if (session_id) {
                      dispatch(clearCart({ session_id, region: pendingRegion.code }));
                    } else {
                      dispatch(clearCartLocal());
                    }
                    applyRegion(pendingRegion);
                  }
                  setShowClearCartModal(false);
                  setPendingRegion(null);
                }}
                className="w-1/2 rounded-full bg-brand-gradient py-3 px-4 text-xs font-bold text-white shadow-md transition hover:opacity-90"
              >
                Confirm &amp; clear
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {mounted && typeof document !== 'undefined' && showFutureRegionModal && createPortal(
        <div
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', zIndex: 999999 }}
          className="flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-fade-in"
        >
          <div className="relative my-auto w-full max-w-md rounded-3xl border border-edge bg-white p-6 sm:p-8 text-center shadow-2xl animate-slide-up">
            <button
              type="button"
              onClick={() => {
                setShowFutureRegionModal(false);
                setOptInSuccess(false);
                setOptInError('');
                setEmailInput('');
              }}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-edge bg-surface-muted text-ink-muted transition-colors hover:text-ink-primary"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-accent/10">
              <Sparkles className="h-7 w-7 text-brand-accent" />
            </div>
            <h3 className="mb-2 text-xl font-bold text-ink-primary">{futureRegionName} store coming soon</h3>
            <p className="mb-5 text-sm leading-relaxed text-ink-secondary">
              We are setting up regional warehouses and local operations in {futureRegionName} to support domestic shipping and local compliance.
            </p>

            {optInSuccess ? (
              <div className="rounded-2xl border border-brand-success/20 bg-brand-success/10 p-3.5 text-sm font-semibold text-ink-success">
                You&apos;ve been added to the notification list.
              </div>
            ) : (
              <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); submitLaunchNotification(); }}>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  autoComplete="email"
                  placeholder="Enter your email for launch updates"
                  required
                  className="w-full rounded-full border border-edge bg-white py-3 px-4 text-sm text-[#1a1a1a] caret-[#1a1a1a] [-webkit-text-fill-color:#1a1a1a] placeholder:text-ink-subtle focus:border-edge-focus focus:outline-none"
                  style={{ color: '#1a1a1a', WebkitTextFillColor: '#1a1a1a', caretColor: '#1a1a1a' }}
                />
                {optInError && <p className="text-xs font-semibold text-ink-danger">{optInError}</p>}
                <button
                  type="submit"
                  disabled={optInLoading}
                  className="btn-primary w-full py-3 text-sm disabled:opacity-60"
                >
                  {optInLoading ? 'Subscribing…' : 'Notify me at launch'}
                </button>
              </form>
            )}
          </div>
        </div>,
        document.body
      )}
    </nav>
  );
}
