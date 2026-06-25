'use client';

import React, { useEffect, useState } from 'react';
import Navbar from './Navbar';
import Footer from './Footer';
import CartDrawer from './CartDrawer';
import CheckoutModal from './CheckoutModal';
import AdminDashboardModal from './AdminDashboardModal';
import CookieConsent from './CookieConsent';
import PromoBanner from './PromoBanner';
import useStoreBootstrap from '../hooks/useStoreBootstrap';
import usePageView from '../hooks/usePageView';
import { trackEvent } from '../utils/analytics';
import { useSelector } from 'react-redux';

export default function StoreShell({ children, showFooter = true, cartOpenSignal, checkoutOpenSignal }) {
  const { currentRegion } = useStoreBootstrap();
  usePageView();
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

  useEffect(() => {
    if (cartOpenSignal) {
      setCartOpen(true);
    }
  }, [cartOpenSignal]);

  useEffect(() => {
    if (checkoutOpenSignal) {
      setCheckoutOpen(true);
    }
  }, [checkoutOpenSignal]);

  return (
    <div className="flex min-h-screen flex-col bg-brand-bg text-brand-text">
      <PromoBanner />
      <Navbar
        onOpenCart={() => setCartOpen(true)}
        onOpenAdmin={() => setAdminOpen(true)}
      />
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      {showFooter && <Footer />}

      {cartOpen && (
        <CartDrawer
          onClose={() => setCartOpen(false)}
          onOpenCheckout={() => {
            setCheckoutOpen(true);
            trackEvent('InitiateCheckout', {
              currency: currentRegion === 'IN' ? 'INR' : 'GBP',
            });
          }}
        />
      )}

      {checkoutOpen && <CheckoutModal onClose={() => setCheckoutOpen(false)} />}

      {adminOpen && <AdminDashboardModal onClose={() => setAdminOpen(false)} />}

      <CookieConsent />
    </div>
  );
}

export function useStoreModals() {
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const currentRegion = useSelector((state) => state.region.currentRegion);

  const modals = (
    <>
      {cartOpen && (
        <CartDrawer
          onClose={() => setCartOpen(false)}
          onOpenCheckout={() => {
            setCheckoutOpen(true);
            trackEvent('InitiateCheckout', {
              currency: currentRegion === 'IN' ? 'INR' : 'GBP',
            });
          }}
        />
      )}
      {checkoutOpen && <CheckoutModal onClose={() => setCheckoutOpen(false)} />}
      {adminOpen && <AdminDashboardModal onClose={() => setAdminOpen(false)} />}
    </>
  );

  return {
    cartOpen,
    setCartOpen,
    checkoutOpen,
    setCheckoutOpen,
    adminOpen,
    setAdminOpen,
    modals,
  };
}
