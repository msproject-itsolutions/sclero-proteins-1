'use client';

import React, { useEffect, useState } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import CartDrawer from './CartDrawer';
import CookieConsent from './CookieConsent';
import PromoBanner from './PromoBanner';
import useStoreBootstrap from '../hooks/useStoreBootstrap';
import usePageView from '../hooks/usePageView';
import { trackEvent } from '../utils/analytics';
import { useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';

export default function StoreShell({ children, showFooter = true, cartOpenSignal, checkoutOpenSignal }) {
  const router = useRouter();
  const { currentRegion } = useStoreBootstrap();
  usePageView();
  const [cartOpen, setCartOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  // Scroll-reveal: elements with .reveal fade/rise in as they enter the
  // viewport. A MutationObserver keeps watching so client-rendered sections
  // (product grids etc.) get picked up after data loads.
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 }
    );
    const watch = () => {
      document.querySelectorAll('.reveal:not(.reveal-visible)').forEach((el) => io.observe(el));
    };
    watch();
    const mo = new MutationObserver(watch);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, []);

  useEffect(() => {
    if (cartOpenSignal) {
      setCartOpen(true);
    }
  }, [cartOpenSignal]);

  useEffect(() => {
    if (checkoutOpenSignal) {
      router.push('/checkout');
    }
  }, [checkoutOpenSignal, router]);

  return (
    <div className="flex min-h-screen flex-col bg-brand-bg text-brand-text">
      <PromoBanner />
      <Navbar
        onOpenCart={() => setCartOpen(true)}
        onOpenAdmin={() => { window.location.href = '/admin?section=audit'; }}
      />
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      {showFooter && <Footer />}

      {cartOpen && (
        <CartDrawer
          onClose={() => setCartOpen(false)}
          onOpenCheckout={() => {
            router.push('/checkout');
            trackEvent('InitiateCheckout', {
              currency: currentRegion === 'IN' ? 'INR' : 'GBP',
            });
          }}
        />
      )}



      <CookieConsent />
    </div>
  );
}

export function useStoreModals() {
  const router = useRouter();
  const [cartOpen, setCartOpen] = useState(false);
  const currentRegion = useSelector((state) => state.region.currentRegion);

  const modals = (
    <>
      {cartOpen && (
        <CartDrawer
          onClose={() => setCartOpen(false)}
          onOpenCheckout={() => {
            router.push('/checkout');
            trackEvent('InitiateCheckout', {
              currency: currentRegion === 'IN' ? 'INR' : 'GBP',
            });
          }}
        />
      )}
    </>
  );

  return {
    cartOpen,
    setCartOpen,
    checkoutOpen: false,
    setCheckoutOpen: () => { router.push('/checkout'); },
    adminOpen: false,
    setAdminOpen: () => { window.location.href = '/admin?section=audit'; },
    modals,
  };
}
