import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { clearCartLocal } from '../store/cartSlice';
import { X, CheckCircle, Download, CreditCard, Banknote, Wallet, ShieldCheck } from 'lucide-react';
import { trackEvent } from '../utils/analytics';
import { getApiUrl } from '../lib/api';
import { Elements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import StripePaymentRequest from './StripePaymentRequest';

// Load Stripe once at module scope (NOT inside the component) so a new
// Stripe instance isn't created on every render.
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise = STRIPE_PK ? loadStripe(STRIPE_PK) : null;

function CheckoutModalInner({ onClose }) {
  const dispatch = useDispatch();
  const { currentRegion, currencySymbol, taxName, taxRate, taxMode, session_id } = useSelector((state) => state.region);
  const cartItems = useSelector((state) => state.cart.items);
  const authUser = useSelector((state) => state.auth?.user);
  const guestCheckoutEnabled = useSelector((state) => state.region.guestCheckoutEnabled);

  const modalRef = React.useRef(null);

  // Form Fields
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [zip, setZip] = useState('');

  // Coupon States
  const [couponCode, setCouponCode] = useState('');
  const [activeCoupon, setActiveCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');

  // Payment gateways — loaded from the admin-configured, region-scoped list.
  const [gateways, setGateways] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [gatewayError, setGatewayError] = useState(false);

  // Checkout statuses
  const [loading, setLoading] = useState(false);
  const [completedOrder, setCompletedOrder] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Shipping address lookup + live fee calculation
  const [pinLookup, setPinLookup] = useState({ status: 'idle', msg: '' });
  const [calcShipping, setCalcShipping] = useState(null);
  const destCountry = currentRegion === 'IN' ? 'IN' : 'GB';

  // 1. Accessibility listener: Escape key and Tab focus trap
  useEffect(() => {
    const prevActiveElement = document.activeElement;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }

      if (e.key === 'Tab') {
        if (!modalRef.current) return;
        const focusableElements = modalRef.current.querySelectorAll(
          'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]'
        );
        if (focusableElements.length === 0) return;
        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    if (modalRef.current) {
      const firstInput = modalRef.current.querySelector('input');
      if (firstInput) {
        firstInput.focus();
      } else {
        const closeBtn = modalRef.current.querySelector('button[aria-label="Close checkout"]');
        if (closeBtn) closeBtn.focus();
      }
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (prevActiveElement && typeof prevActiveElement.focus === 'function') {
        prevActiveElement.focus();
      }
    };
  }, [onClose]);

  // 2. Fetch gateways driven by region configuration
  const fetchGateways = React.useCallback(() => {
    setGatewayError(false);
    fetch(getApiUrl(`/api/admin/payment-gateways/available/?region=${currentRegion}`))
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setGateways(list);
        setPaymentMethod((prev) =>
          list.some((g) => g.code === prev) ? prev : (list[0]?.code || '')
        );
      })
      .catch(() => {
        setGateways([]);
        setGatewayError(true);
      });
  }, [currentRegion]);

  useEffect(() => {
    fetchGateways();
  }, [fetchGateways]);

  const gatewayIcon = (code) => {
    if (code === 'COD') return Banknote;
    if (code === 'PAYPAL') return Wallet;
    return CreditCard;
  };

  // NaN-safe unit price (a product without a regional price returns null).
  const unitPrice = (p) => {
    const v = p.promotional_price ? parseFloat(p.promotional_price) : parseFloat(p.price);
    return Number.isFinite(v) ? v : 0;
  };
  const subtotal = cartItems.reduce((acc, item) => acc + unitPrice(item.product) * item.quantity, 0);

  const handleApplyCoupon = async () => {
    setCouponError('');
    if (!couponCode.trim()) return;

    try {
      const response = await fetch(getApiUrl('/api/checkout/apply-coupon/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponCode,
          region: currentRegion,
          subtotal: subtotal
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to apply coupon');
      }
      setActiveCoupon(data);
    } catch (err) {
      setCouponError(err.message);
      setActiveCoupon(null);
    }
  };

  const discountAmount = activeCoupon ? parseFloat(activeCoupon.discount_amount) : 0;
  const taxableSubtotal = Math.max(subtotal - discountAmount, 0);
  const rateFactor = (taxRate || 0) / 100;

  // Tax mode: 'inclusive' extracts the tax already inside the price; 'exclusive'
  // adds it on top. Mirrors the backend CheckoutView math.
  const taxInclusive = taxMode !== 'exclusive';
  const taxAmount = taxInclusive
    ? taxableSubtotal - (rateFactor ? taxableSubtotal / (1 + rateFactor) : taxableSubtotal)
    : taxableSubtotal * rateFactor;

  // Shipping cost: prefer the server-calculated fee (admin zones), fall back to
  // the regional default rule until the calculation resolves.
  let fallbackShipping = 0;
  if (currentRegion === 'IN') {
    fallbackShipping = taxableSubtotal >= 3000 ? 0 : 150;
  } else {
    fallbackShipping = taxableSubtotal >= 50 ? 0 : 5;
  }
  const shippingCost = calcShipping != null ? calcShipping : fallbackShipping;

  // Inclusive: tax is already inside taxableSubtotal, so don't add it again.
  const grandTotal = (taxInclusive ? taxableSubtotal : taxableSubtotal + taxAmount) + shippingCost;
  const guestCheckoutBlocked = !authUser && !guestCheckoutEnabled;

  // Postcode/PIN -> auto-fill city + state (debounced).
  useEffect(() => {
    const code = zip.replace(/\s/g, '');
    const minLen = currentRegion === 'IN' ? 6 : 5;
    if (code.length < minLen) { setPinLookup({ status: 'idle', msg: '' }); return; }
    setPinLookup({ status: 'loading', msg: 'Looking up…' });
    const t = setTimeout(() => {
      fetch(getApiUrl(`/api/shipping/lookup/?country=${destCountry}&code=${encodeURIComponent(zip.trim())}`))
        .then((r) => (r.ok ? r.json() : {}))
        .then((d) => {
          if (d && d.state) {
            if (d.city) setCity(d.city);
            setStateVal(d.state);
            setPinLookup({ status: 'ok', msg: `✓ ${d.city ? d.city + ', ' : ''}${d.state}` });
          } else {
            setPinLookup({ status: 'miss', msg: 'Not found — enter city & state manually' });
          }
        })
        .catch(() => setPinLookup({ status: 'idle', msg: '' }));
    }, 500);
    return () => clearTimeout(t);
  }, [zip, currentRegion, destCountry]);

  // Live shipping fee from the server (admin zones) whenever destination/value changes.
  useEffect(() => {
    const t = setTimeout(() => {
      fetch(getApiUrl('/api/shipping/calculate/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ region: currentRegion, country: destCountry, state: stateVal, postcode: zip, subtotal: taxableSubtotal }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (d && d.shipping_cost != null) setCalcShipping(parseFloat(d.shipping_cost)); })
        .catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [zip, stateVal, currentRegion, destCountry, taxableSubtotal]);

  const submitCheckout = async ({ paymentMethodCode, paymentId } = {}) => {
    // Apple Pay / Google Pay tokens flow through the existing Stripe path —
    // backend treats payment_method='STRIPE' with payment_id=pm_xxx the same
    // way as a regular Stripe card charge.
    const response = await fetch(getApiUrl('/api/checkout/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id,
        region: currentRegion,
        email,
        shipping_name: name,
        shipping_phone: phone,
        shipping_address_line1: address,
        shipping_city: city,
        shipping_state: stateVal,
        shipping_postal_code: zip,
        shipping_country: currentRegion === 'IN' ? 'IN' : 'GB',
        payment_method: paymentMethodCode || paymentMethod,
        payment_id: paymentId || ('ch_' + Math.random().toString(36).substring(2, 12)),
        coupon_code: activeCoupon ? activeCoupon.code : null,
      })
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Checkout transaction failed');
    }
    return data;
  };

  const handleWalletSuccess = async (paymentMethodId) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await submitCheckout({
        paymentMethodCode: 'STRIPE',
        paymentId: paymentMethodId,
      });
      setCompletedOrder(data.order);
      trackEvent('Purchase', {
        transaction_id: data.order.id,
        value: parseFloat(data.order.total),
        currency: data.order.currency_code,
      });
      dispatch(clearCartLocal());
    } catch (err) {
      setErrorMsg(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (guestCheckoutBlocked) {
      setErrorMsg('Guest checkout is currently disabled. Please sign in to continue.');
      return;
    }
    setLoading(true);
    setErrorMsg('');

    try {
      const data = await submitCheckout();
      setCompletedOrder(data.order);
      
      // Trigger conversion pixel track event for purchase success
      trackEvent('Purchase', {
        transaction_id: data.order.id,
        value: parseFloat(data.order.total),
        currency: data.order.currency_code
      });

      dispatch(clearCartLocal());
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (completedOrder) {
    const invoice = completedOrder.invoice;
    const pdfUrl = invoice && invoice.pdf_url ? getApiUrl(invoice.pdf_url) : '#';
    const invoiceNum = invoice ? invoice.invoice_number : `SP-2026-${completedOrder.id}`;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/25 p-4 backdrop-blur-sm">
        <div className="glass-panel w-full max-w-md rounded-3xl p-6 text-center shadow-2xl relative">
          <button
            onClick={onClose}
            aria-label="Close order confirmation"
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 border border-slate-200 text-brand-text hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>

          <CheckCircle className="h-16 w-16 text-brand-success mx-auto mb-4 animate-bounce" />
          <h2 className="text-xl font-black text-brand-navy mb-2">Order Confirmed!</h2>
          <p className="text-xs text-brand-muted mb-6">
            Thank you for shopping with Sclero Proteins. Your order has been registered and is being processed.
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left text-xs mb-6 space-y-2.5">
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-brand-muted">Order ID:</span>
              <span className="font-bold text-brand-text">#{completedOrder.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-muted">Invoice Number:</span>
              <span className="font-bold text-brand-text font-mono">{invoiceNum}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-muted">Amount Paid:</span>
              <span className="font-black text-brand-purple">{currencySymbol}{parseFloat(completedOrder.total).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-muted">Region Store:</span>
              <span className="font-bold text-brand-navy uppercase">{currentRegion} ({currencySymbol})</span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full bg-brand-gradient text-white rounded-xl py-3 text-xs font-bold uppercase tracking-wider hover:opacity-90 shadow-md shadow-brand-purple/15"
            >
              <Download className="h-4 w-4" />
              Download {taxName} Invoice PDF
            </a>
            <button
              onClick={onClose}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 text-xs font-bold text-brand-text hover:bg-slate-100"
            >
              Back to Storefront
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/25 p-4 backdrop-blur-sm overflow-y-auto">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkout-title"
        className="glass-panel w-full max-w-3xl rounded-3xl overflow-hidden flex flex-col md:flex-row shadow-2xl relative my-8"
      >
        
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close checkout"
          className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 border border-slate-200 text-brand-text hover:bg-slate-100"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Left Side: Checkout Form */}
        <form onSubmit={handleSubmit} className="w-full md:w-3/5 p-6 space-y-4">
          <h2 id="checkout-title" className="text-lg font-black text-brand-navy border-b border-slate-100 pb-2">Delivery & Shipping Address</h2>
          {errorMsg && <p className="text-xs text-brand-danger font-semibold bg-brand-danger/10 border border-brand-danger/20 p-2.5 rounded-lg">{errorMsg}</p>}
          {guestCheckoutBlocked && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold text-amber-800">
              Guest checkout is currently disabled. Please sign in to continue with your order.
            </div>
          )}

          <div className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase font-bold text-brand-muted">Name</label>
                <input
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-brand-text focus:outline-none focus:border-brand-purple"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase font-bold text-brand-muted">Email</label>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-brand-text focus:outline-none focus:border-brand-purple"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase font-bold text-brand-muted">Phone Number</label>
              <input
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91..."
                className="bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-brand-text focus:outline-none focus:border-brand-purple"
                required
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[9px] uppercase font-bold text-brand-muted">Address Line 1</label>
              <input
                type="text"
                autoComplete="address-line1"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-brand-text focus:outline-none focus:border-brand-purple"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase font-bold text-brand-muted">City</label>
                <input
                  type="text"
                  autoComplete="address-level2"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-brand-text focus:outline-none focus:border-brand-purple"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase font-bold text-brand-muted">State / Region</label>
                <input
                  type="text"
                  autoComplete="address-level1"
                  value={stateVal}
                  onChange={(e) => setStateVal(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-brand-text focus:outline-none focus:border-brand-purple"
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase font-bold text-brand-muted">
                  {currentRegion === 'IN' ? 'PIN Code' : 'Postal Code'}
                </label>
                <input
                  type="text"
                  autoComplete="postal-code"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  placeholder={currentRegion === 'IN' ? '560001' : 'SW1A 1AA'}
                  className="bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-brand-text focus:outline-none focus:border-brand-purple"
                  required
                />
              </div>
            </div>
            {pinLookup.status !== 'idle' && (
              <p className={`text-[10px] font-semibold ${
                pinLookup.status === 'ok' ? 'text-brand-success'
                : pinLookup.status === 'miss' ? 'text-amber-600' : 'text-brand-muted'
              }`}>
                {pinLookup.msg}
              </p>
            )}
          </div>

          {/* Apple Pay / Google Pay (UK only, requires Stripe gateway enabled + browser support) */}
          {currentRegion === 'UK' && STRIPE_PK && gateways.some((g) => g.code === 'STRIPE') && (
            <div className="pt-2">
              <h3 className="text-xs font-extrabold text-brand-navy uppercase tracking-wider mb-2.5">
                Apple Pay / Google Pay
              </h3>
              <StripePaymentRequest
                amount={grandTotal}
                currency={'GBP'}
                label={`Sclero Proteins (${currencySymbol}${grandTotal.toFixed(2)})`}
                onSuccess={handleWalletSuccess}
                onError={(err) => setErrorMsg(err?.message || 'Wallet payment failed')}
              />
            </div>
          )}

          {/* Payment method selector — driven by admin-configured gateways for this region */}
          <div className="pt-2">
            <h3 className="text-xs font-extrabold text-brand-navy uppercase tracking-wider mb-2.5">
              Select payment option
            </h3>
            {gateways.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                <p className="text-[11px] text-brand-muted mb-2">
                  {gatewayError ? 'Failed to connect to payment gateways.' : 'No payment options loaded for this region.'}
                </p>
                <button
                  type="button"
                  onClick={fetchGateways}
                  className="rounded-lg bg-brand-purple/10 px-3.5 py-1.5 text-[10px] font-bold text-brand-purple hover:bg-brand-purple/20 transition-all"
                >
                  Retry Loading Options
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {gateways.map((g) => {
                  const Icon = gatewayIcon(g.code);
                  const active = paymentMethod === g.code;
                  return (
                    <button
                      key={g.code}
                      type="button"
                      onClick={() => setPaymentMethod(g.code)}
                      className={`flex items-center gap-2 border rounded-2xl p-3 text-xs font-bold transition-all ${
                        active
                          ? 'border-brand-purple bg-brand-purple/5 text-brand-purple font-extrabold'
                          : 'border-slate-200 bg-white text-brand-muted hover:border-slate-300'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-brand-purple" />
                      <span className="text-left leading-tight">{g.display_name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !paymentMethod || guestCheckoutBlocked}
            className="btn-primary w-full py-3.5 text-xs uppercase tracking-wider disabled:opacity-60"
          >
            {loading ? 'Processing Order...' : `Pay & Finalize Order (${currencySymbol}${grandTotal.toFixed(2)})`}
          </button>
        </form>

        {/* Right Side: Order Summary */}
        <div className="w-full md:w-2/5 bg-slate-50/50 p-6 border-t md:border-t-0 md:border-l border-slate-100 flex flex-col justify-between">
          <div>
            <h3 className="text-base font-black text-brand-navy mb-4 border-b border-slate-100 pb-2">Order Review</h3>
            <div className="space-y-3.5 max-h-64 overflow-y-auto pr-2 mb-4">
              {cartItems.map((item) => {
                const p = item.product;
                const price = unitPrice(p);
                return (
                  <div key={item.id} className="flex justify-between items-center text-xs">
                    <div>
                      <span className="font-bold text-brand-navy block">{p.name}</span>
                      <span className="text-[10px] text-brand-muted">Qty: {item.quantity}</span>
                    </div>
                    <span className="font-bold text-brand-navy">{currencySymbol}{(price * item.quantity).toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
            {/* Coupon Code Block */}
            <div className="border-t border-slate-100 pt-4 mb-4">
              <label className="text-[10px] font-extrabold uppercase text-brand-navy block mb-1.5">
                Have a coupon?
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  autoComplete="off"
                  placeholder="Promo code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl py-1.5 px-3 text-xs text-brand-text focus:outline-none focus:border-brand-purple flex-1"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  className="bg-brand-navy hover:bg-brand-navy/90 text-white rounded-xl px-3 py-1.5 text-xs font-bold transition-all"
                >
                  Apply
                </button>
              </div>
              {couponError && <p className="text-[10px] text-brand-danger font-semibold mt-1">{couponError}</p>}
              {activeCoupon && (
                <div className="flex items-center justify-between bg-brand-success/5 border border-brand-success/20 rounded-xl p-2 mt-2 text-brand-success text-[10px] font-bold">
                  <span>✓ Coupon "{activeCoupon.code}" applied</span>
                  <button type="button" onClick={() => { setActiveCoupon(null); setCouponCode(''); }} className="hover:text-brand-danger">Remove</button>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-2.5 text-xs text-brand-muted">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="text-brand-text">{currencySymbol}{subtotal.toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-brand-success font-bold">
                <span>Discount ({activeCoupon?.code})</span>
                <span>-{currencySymbol}{discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>{taxInclusive ? `Includes ${taxName} (${taxRate}%)` : `${taxName} (${taxRate}%)`}</span>
              <span className="text-brand-text">{currencySymbol}{taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping cost</span>
              <span className="text-brand-text">{shippingCost === 0 ? 'FREE' : `${currencySymbol}${shippingCost.toFixed(2)}`}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-2.5 font-extrabold text-sm text-brand-navy">
              <span>Grand Total</span>
              <span className="text-brand-purple text-base font-black">{currencySymbol}{grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

/**
 * Public wrapper. Wraps the modal in Stripe <Elements> when the Stripe
 * publishable key is configured, so the Payment Request Button (Apple Pay
 * / Google Pay) can render inside CheckoutModalInner.
 */
export default function CheckoutModal(props) {
  if (stripePromise) {
    return (
      <Elements stripe={stripePromise}>
        <CheckoutModalInner {...props} />
      </Elements>
    );
  }
  return <CheckoutModalInner {...props} />;
}
