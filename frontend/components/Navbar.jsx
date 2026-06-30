'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import { setRegion } from '../store/regionSlice';
import { fetchCart, clearCartLocal } from '../store/cartSlice';
import { getApiUrl } from '../lib/api';
import { isProdHost, crossDomainUrl } from '../lib/region';
import { ShoppingBag, Globe, Settings, ChevronDown, User, Search, X, Sparkles, Menu } from 'lucide-react';
import Logo from './Logo';

export default function Navbar({ onOpenCart, onOpenAdmin }) {
  const dispatch = useDispatch();
  const { currentRegion } = useSelector((state) => state.region);
  const cartItems = useSelector((state) => state.cart.items);
  const session_id = useSelector((state) => state.region.session_id);
  const authUser = useSelector((state) => state.auth?.user);

  const [showDropdown, setShowDropdown] = useState(false);
  const [categories, setCategories] = useState([]);
  const [cmsNavLinks, setCmsNavLinks] = useState(null);
  const [showShopMenu, setShowShopMenu] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const pathname = usePathname();
  const firstMobileLinkRef = useRef(null);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll while mobile drawer is open
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      // Focus the first link
      setTimeout(() => {
        if (firstMobileLinkRef.current) firstMobileLinkRef.current.focus();
      }, 50);
      return () => { document.body.style.overflow = prev; };
    }
  }, [mobileOpen]);

  // Modals state for region switcher
  const [showClearCartModal, setShowClearCartModal] = useState(false);
  const [pendingRegion, setPendingRegion] = useState(null);
  const [showFutureRegionModal, setShowFutureRegionModal] = useState(false);
  const [futureRegionName, setFutureRegionName] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [optInSuccess, setOptInSuccess] = useState(false);

  const submitSearch = (e) => {
    e.preventDefault();
    const q = searchTerm.trim();
    if (q) window.location.href = `/products?q=${encodeURIComponent(q)}`;
  };

  const closeMobile = () => setMobileOpen(false);

  const totalQty = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  // Load category facets for the "Shop" dropdown menu.
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

  // Only live regions are shown — no "coming soon" placeholders.
  const countries = [
    {
      code: 'UK',
      name: 'United Kingdom',
      currency_code: 'GBP',
      currency_symbol: '£',
      tax_name: 'VAT',
      tax_rate: 20.0,
      domain: 'scleroproteins.co.uk',
      active: true,
    },
    {
      code: 'IN',
      name: 'India',
      currency_code: 'INR',
      currency_symbol: '₹',
      tax_name: 'GST',
      tax_rate: 18.0,
      domain: 'scleroproteins.in',
      active: true,
    },
  ];

  // Apply a region choice. On a real ccTLD (scleroproteins.in / .co.uk) each
  // region lives on its own domain, so switching means navigating there (the
  // ?set_region flag makes the destination remember the choice and not bounce
  // the shopper back). On localhost / previews there is only one host, so we
  // swap currency/tax in place via Redux.
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

  const handleCountrySwitch = (country) => {
    setShowDropdown(false);

    // If it's a future region, show coming soon modal
    if (!country.active) {
      setFutureRegionName(country.name);
      setShowFutureRegionModal(true);
      return;
    }

    // If the region hasn't actually changed, do nothing
    if (currentRegion === country.code) return;

    // Mark that the user has manually chosen a region — geo-IP auto-detect
    // must respect this choice on subsequent visits.
    try { localStorage.setItem('sclero_region_set', 'true'); } catch {}

    // Check if cart has items to trigger Cart Lock Modal
    if (cartItems.length > 0) {
      setPendingRegion(country);
      setShowClearCartModal(true);
    } else {
      applyRegion(country);
    }
  };

  const navLinkClass =
    'text-brand-muted transition-colors hover:text-brand-purple';
  const fallbackNavLinks = [
    { label: 'Products', url: '/products', mega_menu: true },
    { label: 'Wholesale', url: '/bulk' },
    { label: 'Insights', url: '/blog' },
  ];
  const navLinks = (cmsNavLinks && cmsNavLinks.length ? cmsNavLinks : fallbackNavLinks)
    .filter((link) => !link.region_limit || String(link.region_limit).toUpperCase() === currentRegion)
    .filter((link) => link.label && link.url);

  const formatRegionDisplay = (code) => {
    if (code === 'IN') return '🇮🇳 India';
    if (code === 'UK') return '🇬🇧 UK';
    if (code === 'US') return '🇺🇸 USA';
    if (code === 'EU') return '🇪🇺 EU';
    return '🇦🇪 UAE';
  };

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white shadow-sm md:bg-white/95 md:backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-8 w-8" />
          <span className="text-lg font-black tracking-tight text-brand-navy">
            Sclero <span className="text-brand-purple">Proteins</span>
          </span>
        </Link>

        <div className="hidden items-center gap-6 text-sm font-medium md:flex">
          {navLinks.map((link, index) => {
            const isProducts = link.mega_menu || link.url === '/products';
            if (isProducts) {
              return (
                <div
                  key={`${link.label}-${index}`}
                  className="relative"
                  onMouseEnter={() => setShowShopMenu(true)}
                  onMouseLeave={() => setShowShopMenu(false)}
                >
                  <Link href={link.url} className={`flex items-center gap-1 ${navLinkClass}`}>
                    {link.label}
                    {categories.length > 0 && <ChevronDown className="h-3.5 w-3.5" />}
                  </Link>
                  {showShopMenu && categories.length > 0 && (
                    <div className="absolute left-0 top-full pt-2">
                      <div className="w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                        <Link href="/products" className="block rounded-lg px-3 py-2 text-xs font-bold uppercase tracking-wide text-brand-purple hover:bg-slate-50">
                          All products
                        </Link>
                        <div className="my-1 border-t border-slate-100" />
                        {categories.map((c) => (
                          <Link key={c.slug} href={`/products?category=${c.slug}`} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-brand-navy hover:bg-slate-50 hover:text-brand-purple">
                            <span>{c.name}</span>
                            {typeof c.product_count === 'number' && <span className="text-xs text-slate-400">{c.product_count}</span>}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            }
            return (
              <Link key={`${link.label}-${index}`} href={link.url} className={navLinkClass}>
                {link.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <form onSubmit={submitSearch} className="relative hidden lg:block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-brand-muted" />
            <input
              type="text"
              aria-label="Search products"
              autoComplete="off"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search products…"
              className="w-44 rounded-full border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-brand-navy focus:w-56 focus:border-brand-purple focus:outline-none transition-all"
            />
          </form>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowDropdown(!showDropdown)}
              aria-haspopup="listbox"
              aria-expanded={showDropdown}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-navy transition-all hover:border-brand-purple/30"
            >
              <Globe className="h-3.5 w-3.5 text-brand-purple" />
              <span>{formatRegionDisplay(currentRegion)}</span>
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-lg z-50">
                {countries.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleCountrySwitch(c)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-medium transition-colors hover:bg-slate-50 ${
                      currentRegion === c.code ? 'text-brand-purple' : 'text-brand-navy'
                    }`}
                  >
                    <span>
                      {c.code === 'IN' ? '🇮🇳 ' : c.code === 'UK' ? '🇬🇧 ' : c.code === 'US' ? '🇺🇸 ' : c.code === 'EU' ? '🇪🇺 ' : '🇦🇪 '}
                      {c.name}
                      {!c.active && <span className="ml-1 text-[9px] text-brand-purple bg-brand-purple/10 px-1 py-0.5 rounded">Future</span>}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {c.currency_code} ({c.currency_symbol})
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
              className="inline-flex rounded-full border border-brand-purple/30 bg-brand-purple/5 px-3 py-1.5 text-xs font-semibold text-brand-purple transition-all hover:bg-brand-purple/10"
            >
              Admin
            </Link>
          )}

          <Link
            href="/account"
            title={authUser ? 'My account' : 'Log in / Sign up'}
            aria-label={authUser ? 'My account' : 'Log in or sign up'}
            className="relative flex items-center justify-center rounded-full border border-slate-200 bg-white p-2 text-brand-navy transition-all hover:border-brand-purple/30"
          >
            <User className="h-4 w-4" />
            {authUser && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-brand-success ring-2 ring-white" />
            )}
          </Link>

          <button
            type="button"
            onClick={onOpenCart}
            aria-label={`Open cart${totalQty > 0 ? ` with ${totalQty} items` : ''}`}
            className="relative flex items-center justify-center rounded-full border border-slate-200 bg-white p-2 text-brand-navy transition-all hover:border-brand-purple/30"
          >
            <ShoppingBag className="h-4 w-4" />
            {totalQty > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-purple text-[9px] font-bold text-white">
                {totalQty}
              </span>
            )}
          </button>

          {authUser && (authUser.is_staff || authUser.is_superuser) && (
            <button
              type="button"
              onClick={onOpenAdmin}
              aria-label="Open system settings"
              className="flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 p-2 text-brand-muted transition-all hover:text-brand-purple"
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
            className="hit-target flex items-center justify-center rounded-full border border-slate-200 bg-white p-2 text-brand-navy transition-all hover:border-brand-purple/30 md:hidden"
          >
            <Menu className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div id="mobile-nav-drawer" className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Mobile navigation">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-brand-navy/40 backdrop-blur-sm"
            onClick={closeMobile}
          />
          {/* Left-slide drawer */}
          <nav aria-label="Mobile navigation" className="relative flex h-full w-[85vw] max-w-sm flex-col bg-white shadow-2xl animate-[slideInLeft_0.25s_ease-out] overflow-y-auto">
            <style jsx>{`
              @keyframes slideInLeft {
                from { transform: translateX(-100%); }
                to { transform: translateX(0); }
              }
            `}</style>

            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <Link href="/" ref={firstMobileLinkRef} onClick={closeMobile} className="flex items-center gap-2">
                <Logo className="h-8 w-8" />
                <span className="text-base font-black text-brand-navy">Sclero <span className="text-brand-purple">Proteins</span></span>
              </Link>
              <button
                type="button"
                onClick={closeMobile}
                aria-label="Close navigation menu"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-brand-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Region selector */}
            <div className="border-b border-slate-100 px-5 py-4">
              <h4 className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">Region</h4>
              <div className="grid grid-cols-2 gap-2">
                {countries.filter((c) => c.active).map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => handleCountrySwitch(c)}
                    className={`flex items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-semibold transition-colors ${
                      currentRegion === c.code
                        ? 'border-brand-purple bg-brand-purple/5 text-brand-purple'
                        : 'border-slate-200 bg-white text-brand-navy hover:border-brand-purple/40'
                    }`}
                  >
                    {c.code === 'IN' ? '🇮🇳' : '🇬🇧'} <span>{c.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Search */}
            <form onSubmit={submitSearch} className="border-b border-slate-100 px-5 py-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                <input
                  type="search"
                  aria-label="Search products"
                  autoComplete="off"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search products..."
                  className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-brand-navy focus:border-brand-purple focus:outline-none"
                />
              </div>
            </form>

            {/* Shop section */}
            <div className="border-b border-slate-100 px-5 py-4">
              <h4 className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">Shop</h4>
              <div className="flex flex-col gap-0.5 text-sm font-bold text-brand-navy">
                <Link href="/products" onClick={closeMobile} className="rounded-lg px-2 py-2 hover:bg-slate-50">All products</Link>
                {categories.slice(0, 6).map((c) => (
                  <Link key={c.slug} href={`/products?category=${c.slug}`} onClick={closeMobile} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-brand-muted hover:bg-slate-50 hover:text-brand-purple">
                    {c.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Categories quick section */}
            <div className="border-b border-slate-100 px-5 py-4">
              <h4 className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">Browse</h4>
              <div className="flex flex-col gap-0.5 text-sm font-bold text-brand-navy">
                {navLinks.filter((link) => link.url !== '/products').map((link, index) => (
                  <Link key={`${link.label}-${index}`} href={link.url} onClick={closeMobile} className="rounded-lg px-2 py-2 hover:bg-slate-50">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Account section */}
            <div className="px-5 py-4">
              <h4 className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-brand-muted">Account</h4>
              <div className="flex flex-col gap-0.5 text-sm font-bold text-brand-navy">
                {authUser ? (
                  <>
                    <div className="rounded-lg px-2 py-2 text-xs font-semibold text-brand-muted">
                      Hi, <span className="font-bold text-brand-navy">{authUser.first_name || authUser.email || 'there'}</span>
                    </div>
                    <Link href="/account" onClick={closeMobile} className="rounded-lg px-2 py-2 hover:bg-slate-50">My account</Link>
                    <button
                      type="button"
                      onClick={() => {
                        try { localStorage.removeItem('sclero_auth_token'); } catch {}
                        closeMobile();
                        window.location.href = '/account';
                      }}
                      className="rounded-lg px-2 py-2 text-left text-xs font-semibold text-brand-danger hover:bg-slate-50"
                    >
                      Log out
                    </button>
                  </>
                ) : (
                  <>
                    <Link href="/account" onClick={closeMobile} className="rounded-lg px-2 py-2 hover:bg-slate-50">Log in / Sign up</Link>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    closeMobile();
                    if (onOpenCart) onOpenCart();
                  }}
                  className="flex items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-slate-50"
                >
                  <span>Cart</span>
                  {totalQty > 0 && (
                    <span className="rounded-full bg-brand-purple px-2 py-0.5 text-[10px] font-bold text-white">{totalQty}</span>
                  )}
                </button>
              </div>
            </div>
          </nav>
        </div>
      )}

      {/* Cart Switch Confirmation Modal */}
      {showClearCartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/25 p-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl bg-white border border-slate-100">
            <h3 className="text-base font-black text-brand-navy mb-2">Change Shopping Region?</h3>
            <p className="text-xs text-brand-muted mb-6 leading-relaxed">
              Changing your shopping region will clear your cart because product pricing, inventory, taxes, and shipping rules differ between regions.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowClearCartModal(false);
                  setPendingRegion(null);
                }}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-brand-text hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (pendingRegion) {
                    dispatch(clearCartLocal());
                    applyRegion(pendingRegion);
                  }
                  setShowClearCartModal(false);
                  setPendingRegion(null);
                }}
                className="flex-1 bg-brand-gradient text-white rounded-xl py-2.5 text-xs font-bold uppercase tracking-wider hover:opacity-90 shadow-md shadow-brand-purple/15"
              >
                Confirm & Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Future Region Modal */}
      {showFutureRegionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/25 p-4 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-sm rounded-3xl p-6 text-center shadow-2xl bg-white border border-slate-100 relative">
            <button
              type="button"
              onClick={() => {
                setShowFutureRegionModal(false);
                setOptInSuccess(false);
                setEmailInput('');
              }}
              className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-slate-50 border border-slate-200 text-brand-muted hover:text-brand-navy"
            >
              <X className="h-3 w-3" />
            </button>
            <Sparkles className="h-10 w-10 text-brand-purple mx-auto mb-3 animate-pulse" />
            <h3 className="text-base font-black text-brand-navy mb-1.5">{futureRegionName} Store Coming Soon!</h3>
            <p className="text-xs text-brand-muted mb-5 leading-relaxed">
              We are currently setting up regional warehouses and local operations in {futureRegionName} to support domestic shipping and local compliance.
            </p>
            
            {optInSuccess ? (
              <div className="bg-brand-success/10 border border-brand-success/20 rounded-xl p-2.5 text-brand-success text-xs font-bold">
                ✓ You've been added to the notification list!
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  autoComplete="email"
                  placeholder="Enter your email for launch updates"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs text-brand-navy focus:border-brand-purple focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (emailInput.trim()) {
                      setOptInSuccess(true);
                    }
                  }}
                  className="w-full bg-brand-gradient text-white rounded-xl py-2 text-xs font-bold uppercase tracking-wider hover:opacity-90 shadow-md shadow-brand-purple/15"
                >
                  Notify Me At Launch
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
