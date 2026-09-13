'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchCart, removeFromCart } from '../../store/cartSlice';
import { Trash2, X, CreditCard, Banknote, Wallet, ShieldCheck, ChevronDown, ChevronUp, ShoppingCart, ArrowLeft, HelpCircle } from 'lucide-react';
import { trackEvent } from '../../utils/analytics';
import { getApiUrl, postJson } from '../../lib/api';
import { authenticatedFetch } from '../../lib/authFetch';
import { validateCheckout } from '../../lib/formValidation';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import StripePaymentRequest from '../../components/StripePaymentRequest';
import useStoreBootstrap from '../../hooks/useStoreBootstrap';
import { useRouter } from 'next/navigation';
import { LogoLockup } from '../../components/Logo';
import Link from 'next/link';
import FooterCredit from '../../components/FooterCredit';

const STRIPE_PK_FALLBACK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

const stripeInstances = new Map();
function getStripe(publishableKey) {
  if (!publishableKey) return null;
  if (!stripeInstances.has(publishableKey)) {
    stripeInstances.set(publishableKey, loadStripe(publishableKey));
  }
  return stripeInstances.get(publishableKey);
}

let razorpayScriptPromise = null;
function loadRazorpayScript() {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => {
        razorpayScriptPromise = null;
        resolve(false);
      };
      document.body.appendChild(script);
    });
  }
  return razorpayScriptPromise;
}

function StripeCardSection({ onReady }) {
  const stripe = useStripe();
  const elements = useElements();

  useEffect(() => {
    if (!stripe || !elements) return;
    onReady(async (clientSecret, billingDetails) => {
      const card = elements.getElement(CardElement);
      if (!card) throw new Error('Card details are not ready yet.');
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card, billing_details: billingDetails },
      });
      if (result.error) throw new Error(result.error.message || 'Your card was declined.');
      return result.paymentIntent;
    });
  }, [stripe, elements, onReady]);

  return (
    <div className="rounded-lg border border-edge bg-white p-3.5 shadow-sm focus-within:border-edge-focus focus-within:shadow-focus transition">
      <CardElement
        options={{
          hidePostalCode: true,
          style: {
            base: { fontSize: '14px', color: '#1a1a1a', '::placeholder': { color: '#9ca3af' } },
            invalid: { color: '#dc2626' },
          },
        }}
      />
    </div>
  );
}

const PHASE_COPY = {
  creating: {
    title: 'Securing your order',
    body: 'We are reserving your items and preparing a secure payment.',
  },
  paying: {
    title: 'Complete your payment',
    body: 'Follow the steps from your bank or payment app in the payment window.',
  },
  confirming: {
    title: 'Confirming your payment',
    body: 'We are confirming the payment with the provider. Please do not refresh or close this window.',
  },
};

function CheckoutPageInner({ gateways, gatewayError, fetchGateways, stripeReady }) {
  const router = useRouter();
  const dispatch = useDispatch();
  const { currentRegion, currencyCode, currencySymbol, taxName, taxRate, taxMode, branding } = useSelector((state) => state.region);
  const cartItems = useSelector((state) => state.cart.items);
  const authUser = useSelector((state) => state.auth?.user);
  const guestCheckoutEnabled = useSelector((state) => state.region.guestCheckoutEnabled);
  const storeName = branding?.companyInfo?.name || 'Online store';

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

  const [paymentMethod, setPaymentMethod] = useState('');
  const confirmCardRef = useRef(null);
  const handleCardReady = useCallback((fn) => { confirmCardRef.current = fn; }, []);

  // idle → creating → paying → confirming. A failed or expired payment keeps
  // the cart (and the order), so the shopper can simply try again.
  const [phase, setPhase] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const loading = phase === 'creating' || phase === 'paying' || phase === 'confirming';

  // Shipping address lookup + live fee calculation
  const [pinLookup, setPinLookup] = useState({ status: 'idle', msg: '' });
  const [calcShipping, setCalcShipping] = useState(null);
  const [shippingOptions, setShippingOptions] = useState([]);
  const [selectedShippingRateId, setSelectedShippingRateId] = useState(null);
  const [shippingError, setShippingError] = useState('');
  const [shippingLoading, setShippingLoading] = useState(true);
  const destCountry = currentRegion === 'IN' ? 'IN' : 'GB';
  const shippingAddressReady = zip.replace(/\s/g, '').length >= (currentRegion === 'IN' ? 6 : 5);

  // Mobile Order Summary Expand state
  const [summaryOpen, setSummaryOpen] = useState(false);

  // prefill email if logged in
  useEffect(() => {
    if (authUser?.email) {
      setEmail(authUser.email);
    }
    if (authUser?.name) {
      setName(authUser.name);
    }
  }, [authUser]);

  const handleRemoveItem = (item) => {
    dispatch(
      removeFromCart({
        region: currentRegion,
        cart_item_id: item.id,
        product_id: item.product?.id || item.product,
        variant_sku: item.variant_sku,
      })
    );
  };

  useEffect(() => {
    setPaymentMethod((prev) =>
      gateways.some((g) => g.code === prev) ? prev : (gateways[0]?.code || '')
    );
  }, [gateways]);

  const gatewayIcon = (code) => {
    if (code === 'COD') return Banknote;
    if (code === 'PAYPAL') return Wallet;
    return CreditCard;
  };

  const unitPrice = (p) => {
    const v = p.promotional_price ? parseFloat(p.promotional_price) : parseFloat(p.price);
    return Number.isFinite(v) ? v : 0;
  };
  const subtotal = cartItems.reduce((acc, item) => acc + unitPrice(item.product) * item.quantity, 0);

  const handleApplyCoupon = async () => {
    setCouponError('');
    if (!couponCode.trim()) return;

    try {
      // The server prices the coupon against the cart it holds for this shopper.
      const { response, data } = await postJson('/api/checkout/apply-coupon/', {
        code: couponCode.trim(),
        region: currentRegion,
      });
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

  const taxInclusive = taxMode !== 'exclusive';
  const taxAmount = taxInclusive
    ? taxableSubtotal - (rateFactor ? taxableSubtotal / (1 + rateFactor) : taxableSubtotal)
    : taxableSubtotal * rateFactor;

  const shippingCost = calcShipping != null ? calcShipping : 0;

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
    if (!shippingAddressReady) {
      setShippingLoading(false);
      setShippingError('');
      setShippingOptions([]);
      setSelectedShippingRateId(null);
      setCalcShipping(null);
      return undefined;
    }
    const t = setTimeout(() => {
      setShippingLoading(true);
      // Credentials go with the request so the server can weigh this shopper's cart.
      authenticatedFetch('/api/shipping/calculate/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region: currentRegion, country: destCountry, state: stateVal,
          city, postcode: zip, subtotal: taxableSubtotal,
        }),
      })
        .then(async (r) => {
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(data.error || 'Shipping is not available for this address.');
          return data;
        })
        .then((d) => {
          if (!d || d.shipping_cost == null) return;
          setShippingError('');
          const options = Array.isArray(d.options) ? d.options : [];
          setShippingOptions(options);
          setSelectedShippingRateId((previous) => {
            const selected = options.find((item) => String(item.rate_id) === String(previous)) || options[0];
            setCalcShipping(parseFloat(selected?.cost ?? d.shipping_cost));
            return selected?.rate_id ?? null;
          });
        })
        .catch((error) => {
          setShippingOptions([]);
          setSelectedShippingRateId(null);
          setCalcShipping(null);
          setShippingError(error.message || 'Shipping is not available for this address.');
        })
        .finally(() => setShippingLoading(false));
    }, 400);
    return () => clearTimeout(t);
  }, [zip, stateVal, city, currentRegion, destCountry, taxableSubtotal, shippingAddressReady]);

  const orderDetails = (cleaned, methodCode) => ({
    region: currentRegion,
    email: cleaned.email,
    shipping_name: cleaned.name,
    shipping_phone: cleaned.phone,
    shipping_address_line1: cleaned.address,
    shipping_city: cleaned.city,
    shipping_state: cleaned.state,
    shipping_postal_code: cleaned.zip,
    shipping_country: destCountry,
    payment_method: methodCode,
    coupon_code: activeCoupon ? activeCoupon.code : null,
    shipping_rate_id: selectedShippingRateId,
  });

  const requestError = (response, data, fallback) => {
    const error = new Error(data?.error || fallback);
    error.status = response.status;
    return error;
  };

  // 1. Create (or resume) the order; the server reserves stock and coupon use.
  const createOrder = async (cleaned, methodCode) => {
    const { response, data } = await postJson('/api/checkout/', orderDetails(cleaned, methodCode), { timeoutMs: 30000 });
    if (!response.ok) throw requestError(response, data, 'We could not create your order. Please try again.');
    return data;
  };

  // 3. The server verifies the payment with the provider before recording it.
  const confirmOrder = async (order, extra = {}) => {
    const { response, data } = await postJson('/api/checkout/confirm/', {
      order_id: order.order_id,
      order_token: order.order_token,
      ...extra,
    }, { timeoutMs: 30000 });
    if (!response.ok) throw requestError(response, data, 'We could not confirm your payment.');
    return data;
  };

  const finishOrder = (order) => {
    // The order token stays in this tab; it never goes into a URL that
    // third-party scripts could read.
    try {
      sessionStorage.setItem(`sclero_order_token_${order.order_id}`, order.order_token);
    } catch {
      /* storage unavailable: the confirmation email still carries the link */
    }
    trackEvent('Purchase', {
      transaction_id: order.order_id,
      value: parseFloat(order.amount),
      currency: order.currency,
    });
    dispatch(fetchCart({ region: currentRegion }));
    router.push(`/checkout/success?order=${encodeURIComponent(order.order_id)}`);
  };

  const failPayment = (err) => {
    if (err?.status === 410) {
      setPhase('expired');
      setErrorMsg('This checkout expired before the payment was completed. Please review your cart and place the order again.');
      return;
    }
    setPhase('failed');
    setErrorMsg(`${err?.message || 'The payment was not completed.'} Your cart is saved, so you can try again.`);
  };

  const payWithRazorpay = (payment, cleaned) => new Promise((resolve, reject) => {
    const rzp = new window.Razorpay({
      key: payment.key_id,
      order_id: payment.razorpay_order_id,
      amount: payment.amount,
      currency: payment.currency,
      name: storeName,
      description: `Order · ${cartItems.length} item${cartItems.length === 1 ? '' : 's'}`,
      prefill: { name: cleaned.name, email: cleaned.email, contact: cleaned.phone },
      handler: (response) => resolve(response),
      modal: {
        ondismiss: () => reject(new Error('Payment was cancelled.')),
      },
    });
    rzp.on('payment.failed', (event) => {
      reject(new Error(event?.error?.description || 'The payment failed. Please try another method.'));
    });
    rzp.open();
  });

  // 2. Collect the payment for that order in the browser.
  const payOnline = async (order, cleaned) => {
    const payment = order.payment || {};
    if (payment.simulated) {
      setPhase('confirming');
      return confirmOrder(order, { simulated: true });
    }
    if (order.payment_method === 'STRIPE') {
      if (!payment.client_secret) throw new Error('Card payment is not available right now. Please choose another method.');
      if (!confirmCardRef.current) throw new Error('Card form is still loading. Please try again.');
      setPhase('paying');
      await confirmCardRef.current(payment.client_secret, {
        name: cleaned.name, email: cleaned.email, phone: cleaned.phone,
      });
      setPhase('confirming');
      return confirmOrder(order);
    }
    if (order.payment_method === 'RAZORPAY') {
      const ready = await loadRazorpayScript();
      if (!ready) throw new Error('Could not load Razorpay. Check your connection and try again.');
      setPhase('paying');
      const result = await payWithRazorpay(payment, cleaned);
      setPhase('confirming');
      return confirmOrder(order, {
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_order_id: result.razorpay_order_id,
        razorpay_signature: result.razorpay_signature,
      });
    }
    throw new Error('This payment method is not available.');
  };

  const readyToOrder = () => {
    if (guestCheckoutBlocked) throw new Error('Guest checkout is currently disabled. Please sign in to continue.');
    const { cleaned, error } = validateCheckout({ email, name, phone, address, city, state: stateVal, zip });
    if (error) throw new Error(error);
    if (!selectedShippingRateId || calcShipping == null) throw new Error('Please select an available shipping method.');
    return cleaned;
  };

  // Apple Pay / Google Pay follow the same order-first flow.
  const handleWalletPayment = async (paymentMethodId, stripe, complete) => {
    if (loading) throw new Error('A payment is already in progress.');
    setErrorMsg('');
    const cleaned = readyToOrder();
    setPhase('creating');
    try {
      const order = await createOrder(cleaned, 'STRIPE');
      if (order.payment_status === 'PAID') {
        complete('success');
        finishOrder(order);
        return;
      }
      const payment = order.payment || {};
      if (payment.simulated) {
        complete('success');
        setPhase('confirming');
        await confirmOrder(order, { simulated: true });
        finishOrder(order);
        return;
      }
      if (!payment.client_secret) throw new Error('Wallet payment is not available right now.');
      setPhase('paying');
      const first = await stripe.confirmCardPayment(
        payment.client_secret, { payment_method: paymentMethodId }, { handleActions: false },
      );
      if (first.error) throw new Error(first.error.message || 'Your wallet payment was declined.');
      complete('success');
      if (first.paymentIntent?.status === 'requires_action') {
        const next = await stripe.confirmCardPayment(payment.client_secret);
        if (next.error) throw new Error(next.error.message || 'Your bank did not approve the payment.');
      }
      setPhase('confirming');
      await confirmOrder(order);
      finishOrder(order);
    } catch (err) {
      failPayment(err);
      throw err;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setErrorMsg('');
    let cleaned;
    try {
      cleaned = readyToOrder();
    } catch (err) {
      setErrorMsg(err.message);
      return;
    }
    setEmail(cleaned.email);
    setName(cleaned.name);
    setPhone(cleaned.phone);
    setAddress(cleaned.address);
    setCity(cleaned.city);
    setStateVal(cleaned.state);
    setZip(cleaned.zip);

    setPhase('creating');
    let order;
    try {
      order = await createOrder(cleaned, paymentMethod);
    } catch (err) {
      setPhase(err.status === 410 ? 'expired' : 'idle');
      setErrorMsg(err.message);
      return;
    }
    // Cash on delivery is placed at once; a resumed order may already be paid.
    if (order.payment_method === 'COD' || order.payment_status === 'PAID') {
      finishOrder(order);
      return;
    }
    try {
      await payOnline(order, cleaned);
      finishOrder(order);
    } catch (err) {
      failPayment(err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-brand-bg text-brand-text">
      {/* Full-Screen Payment Processing & Verification Overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 bg-ink-primary/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fade-in">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border border-white/20 flex flex-col items-center text-center space-y-5">
            <div className="relative flex items-center justify-center">
              <div className="h-20 w-20 rounded-full border-4 border-brand-accent/20 border-t-brand-accent animate-spin" />
              <ShieldCheck className="h-8 w-8 text-brand-primary absolute" />
            </div>

            <div>
              <h3 className="text-xl font-bold font-display text-ink-primary mb-1">
                {(PHASE_COPY[phase] || PHASE_COPY.creating).title}
              </h3>
              <p className="text-xs text-ink-secondary leading-relaxed">
                {(PHASE_COPY[phase] || PHASE_COPY.creating).body}
              </p>
            </div>

            <div className="w-full bg-surface-muted/60 rounded-xl p-3 border border-edge text-[11px] font-semibold text-ink-secondary flex items-center justify-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping"></span>
              Do not refresh or close this browser window
            </div>
          </div>
        </div>
      )}
      {/* Distraction-Free Header */}
      <header className="border-b border-edge bg-white/90 backdrop-blur-md py-4 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <Link href="/" className="hover:opacity-90 transition">
            <LogoLockup markClass="h-9 w-9" wordClass="h-5" />
          </Link>
          <Link
            href="/products"
            className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-secondary hover:text-ink-primary transition-all duration-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Continue Shopping
          </Link>
        </div>
      </header>

      {/* Mobile Collapsible Order Summary */}
      <div className="block lg:hidden border-b border-edge bg-surface-muted/30 transition-all duration-300">
        <button
          onClick={() => setSummaryOpen(!summaryOpen)}
          type="button"
          className="w-full px-4 py-4 flex justify-between items-center text-sm font-medium text-ink-primary hover:bg-surface-muted/50 transition-all"
        >
          <span className="flex items-center gap-2 text-ink-accent font-semibold">
            <ShoppingCart className="h-4 w-4" />
            {summaryOpen ? 'Hide order summary' : 'Show order summary'}
            <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${summaryOpen ? 'rotate-180' : ''}`} />
          </span>
          <span className="text-[16px] font-bold font-display">
            {currencySymbol}{grandTotal.toFixed(2)}
          </span>
        </button>

        {summaryOpen && (
          <div className="px-4 pb-6 pt-2 bg-surface-muted/10 border-t border-edge space-y-6 animate-fadeIn">
            {/* Items list */}
            <div className="space-y-4 max-h-60 overflow-y-auto pr-1">
              {cartItems.map((item) => {
                const p = item.product;
                const price = unitPrice(p);
                return (
                  <div key={item.id} className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-3">
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-edge bg-white">
                        {p.thumbnail ? (
                          <img src={p.thumbnail} alt={p.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full bg-surface-muted flex items-center justify-center text-ink-muted">No img</div>
                        )}
                        <span className="absolute -top-1.5 -right-1.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-ink-primary px-1 text-[9px] font-bold text-white shadow-sm">
                          {item.quantity}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-ink-primary block max-w-[200px] truncate">{p.name}</span>
                        <span className="text-[10px] text-ink-muted">Qty: {item.quantity}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-semibold text-ink-primary">{currencySymbol}{(price * item.quantity).toFixed(2)}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item)}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-brand-danger/10 hover:text-ink-danger"
                        title={`Remove ${p.name}`}
                        aria-label={`Remove ${p.name} from cart`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Coupon input */}
            <div className="border-t border-edge pt-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Promo code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  className="input-base py-2 px-3 text-xs bg-white"
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  className="btn-primary py-2 px-4 text-xs shrink-0 rounded-lg shadow-sm"
                >
                  Apply
                </button>
              </div>
              {couponError && <p className="text-[10px] text-ink-danger font-medium mt-1">{couponError}</p>}
              {activeCoupon && (
                <div className="flex items-center justify-between bg-brand-success/5 border border-brand-success/20 rounded-md p-2 mt-2 text-ink-success text-[10px] font-medium">
                  <span>✓ Coupon "{activeCoupon.code}" applied</span>
                  <button type="button" onClick={() => { setActiveCoupon(null); setCouponCode(''); }} className="hover:text-ink-danger font-semibold">Remove</button>
                </div>
              )}
            </div>

            {/* Pricing breakdown */}
            <div className="border-t border-edge pt-4 space-y-2.5 text-xs text-ink-secondary">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="text-ink-primary font-medium">{currencySymbol}{subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-ink-success font-semibold">
                  <span>Discount ({activeCoupon?.code})</span>
                  <span>-{currencySymbol}{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>{taxInclusive ? `Includes ${taxName} (${taxRate}%)` : `${taxName} (${taxRate}%)`}</span>
                <span className="text-ink-primary font-medium">{currencySymbol}{taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping cost</span>
                <span className="text-ink-primary font-medium">{calcShipping == null ? '—' : shippingCost === 0 ? 'FREE' : `${currencySymbol}${shippingCost.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between items-baseline border-t border-edge pt-2.5 font-bold text-sm text-ink-primary">
                <span>Grand Total</span>
                <span className="font-display text-[20px] text-ink-primary">{currencySymbol}{grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Grid Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">

          {/* Left Column: Form Steps */}
          <form onSubmit={handleSubmit} className="lg:col-span-7 space-y-8">

            {/* Contact Step */}
            <section className="bg-white border border-edge rounded-2xl p-6 sm:p-8 shadow-card space-y-4">
              <div className="flex justify-between items-center border-b border-edge pb-3">
                <h2 className="font-display text-xl font-bold text-ink-primary">Contact Information</h2>
                {!authUser && (
                  <span className="text-xs text-ink-muted">
                    Have an account?{' '}
                    <Link href="/account" className="text-ink-accent font-semibold hover:underline">
                      Log in
                    </Link>
                  </span>
                )}
              </div>

              {errorMsg && (
                <p className="text-xs text-ink-danger font-medium bg-red-50 border border-red-200 p-3 rounded-xl">
                  {errorMsg}
                </p>
              )}

              {guestCheckoutBlocked && (
                <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-xs font-semibold text-yellow-800">
                  Guest checkout is currently disabled. Please sign in to continue with your order.
                </div>
              )}

              {authUser ? (
                <div className="flex items-center gap-3 p-3 bg-surface-muted/30 border border-edge rounded-xl">
                  <div className="h-10 w-10 bg-brand-accent/10 rounded-full flex items-center justify-center text-ink-accent font-bold">
                    {authUser.name?.charAt(0) || authUser.email?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink-primary">{authUser.name}</p>
                    <p className="text-xs text-ink-muted">{authUser.email}</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <label className="label-base">Email address</label>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input-base"
                    placeholder="name@example.com"
                    required
                    disabled={loading}
                  />
                </div>
              )}
            </section>

            {/* Delivery / Shipping Step */}
            <section className="bg-white border border-edge rounded-2xl p-6 sm:p-8 shadow-card space-y-4">
              <h2 className="font-display text-xl font-bold text-ink-primary border-b border-edge pb-3">Shipping Address</h2>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="label-base">Full Name</label>
                    <input
                      type="text"
                      autoComplete="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="input-base"
                      placeholder="Jane Doe"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="label-base">Phone Number</label>
                    <input
                      type="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder={currentRegion === 'IN' ? '+91 99999 99999' : '+44 7700 900077'}
                      className="input-base"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="label-base">Address Line 1</label>
                  <input
                    type="text"
                    autoComplete="address-line1"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="input-base"
                    placeholder="Street name and house/flat number"
                    required
                    disabled={loading}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="label-base">City</label>
                    <input
                      type="text"
                      autoComplete="address-level2"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="input-base"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="label-base">State / Region</label>
                    <input
                      type="text"
                      autoComplete="address-level1"
                      value={stateVal}
                      onChange={(e) => setStateVal(e.target.value)}
                      className="input-base"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="label-base">
                      {currentRegion === 'IN' ? 'PIN Code' : 'Postal Code'}
                    </label>
                    <input
                      type="text"
                      autoComplete="postal-code"
                      value={zip}
                      onChange={(e) => setZip(e.target.value)}
                      placeholder={currentRegion === 'IN' ? '560001' : 'SW1A 1AA'}
                      className="input-base"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                {pinLookup.status !== 'idle' && (
                  <p className={`text-[11px] font-semibold transition-all duration-200 ${
                    pinLookup.status === 'ok' ? 'text-ink-success'
                    : pinLookup.status === 'miss' ? 'text-amber-600' : 'text-ink-muted'
                  }`}>
                    {pinLookup.msg}
                  </p>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="label-base">Country</label>
                  <input
                    type="text"
                    value={currentRegion === 'IN' ? 'India' : 'United Kingdom'}
                    className="input-base bg-surface-muted text-ink-muted border-edge-strong cursor-not-allowed"
                    disabled
                  />
                  <p className="text-[10px] text-ink-muted">To ship to another country, please change store region at the navbar.</p>
                </div>
              </div>
            </section>

            {/* Shipping Method display */}
            <section className="bg-white border border-edge rounded-2xl p-6 sm:p-8 shadow-card space-y-4">
              <h2 className="font-display text-xl font-bold text-ink-primary border-b border-edge pb-3">Shipping Method</h2>
              {!shippingAddressReady ? (
                <div className="rounded-xl border border-edge bg-surface-muted p-4 text-sm font-medium text-ink-muted">Enter your delivery postcode above to see available methods and prices.</div>
              ) : shippingLoading ? (
                <div className="rounded-xl border border-edge bg-surface-muted p-4 text-sm font-medium text-ink-muted">Calculating available delivery methods…</div>
              ) : shippingError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-ink-danger">
                  {shippingError} Please review the address or contact us for assistance.
                </div>
              ) : shippingOptions.length === 0 ? (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-ink-danger">No shipping method is available for this address.</div>
              ) : <div className="space-y-2">
                {shippingOptions.map((option) => {
                  const active = String(option.rate_id) === String(selectedShippingRateId);
                  const optionCost = Number(option.cost || 0);
                  return (
                    <button
                      key={option.rate_id}
                      type="button"
                      onClick={() => { setSelectedShippingRateId(option.rate_id); setCalcShipping(optionCost); }}
                      className={`w-full flex justify-between items-center gap-4 p-4 border rounded-xl text-left transition ${active ? 'border-edge-focus bg-surface-muted/20 shadow-sm' : 'border-edge bg-white hover:border-edge-strong'}`}
                    >
                      <span className="flex items-start gap-3">
                        <span className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border ${active ? 'border-ink-primary' : 'border-edge-strong'}`}>
                          {active && <span className="h-2 w-2 rounded-full bg-ink-primary" />}
                        </span>
                        <span>
                          <span className="block text-sm font-semibold text-ink-primary">{option.method || option.name}</span>
                          <span className="block text-xs text-ink-secondary mt-0.5">
                            {option.estimated_days ? `Estimated delivery: ${option.estimated_days}` : 'Calculated for your delivery address'}
                          </span>
                          {option.description && <span className="block text-xs text-ink-muted mt-0.5">{option.description}</span>}
                        </span>
                      </span>
                      <span className="font-semibold text-sm text-ink-primary font-display whitespace-nowrap">
                        {optionCost === 0 ? 'FREE' : `${currencySymbol}${optionCost.toFixed(2)}`}
                      </span>
                    </button>
                  );
                })}
              </div>}
            </section>

            {/* Payment Step */}
            <section className="bg-white border border-edge rounded-2xl p-6 sm:p-8 shadow-card space-y-5">
              <h2 className="font-display text-xl font-bold text-ink-primary border-b border-edge pb-3">Payment Options</h2>

              {/* Apple Pay / Google Pay for UK */}
              {shippingAddressReady && selectedShippingRateId && calcShipping != null && !shippingLoading && !shippingError && currentRegion === 'UK' && stripeReady && gateways.some((g) => g.code === 'STRIPE') && (
                <div className="pb-3 border-b border-edge">
                  <h3 className="label-base mb-3">Express Payment</h3>
                  <StripePaymentRequest
                    amount={grandTotal}
                    currency={currencyCode}
                    label={`Sclero Proteins (${currencySymbol}${grandTotal.toFixed(2)})`}
                    onSuccess={handleWalletPayment}
                    onError={(err) => setErrorMsg(err?.message || 'Wallet payment failed')}
                  />
                  <div className="relative flex py-4 items-center">
                    <div className="flex-grow border-t border-edge"></div>
                    <span className="flex-shrink mx-4 text-ink-muted text-[10px] font-bold uppercase tracking-wider">Or Pay Below</span>
                    <div className="flex-grow border-t border-edge"></div>
                  </div>
                </div>
              )}

              {/* Payment selector */}
              <div className="space-y-4">
                <h3 className="label-base">Select payment option</h3>
                {gateways.length === 0 ? (
                  <div className="rounded-xl border border-edge bg-surface-muted p-6 text-center space-y-3">
                    <p className="text-xs text-ink-secondary">
                      {gatewayError ? 'Failed to connect to payment gateways.' : 'No payment options loaded for this region.'}
                    </p>
                    <button
                      type="button"
                      onClick={fetchGateways}
                      className="btn-secondary text-xs rounded-lg px-4 py-2"
                    >
                      Retry Loading Options
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {gateways.map((g) => {
                      const Icon = gatewayIcon(g.code);
                      const active = paymentMethod === g.code;
                      return (
                        <button
                          key={g.code}
                          type="button"
                          onClick={() => setPaymentMethod(g.code)}
                          className={`flex items-center gap-3 border rounded-xl p-4 text-xs font-semibold transition-all duration-200 ${
                            active
                              ? 'border-ink-primary bg-surface-muted/30 text-ink-primary shadow-sm'
                              : 'border-edge bg-white text-ink-secondary hover:border-edge-strong hover:shadow-sm'
                          }`}
                          disabled={loading}
                        >
                          <Icon className="h-5 w-5 shrink-0 text-brand-accent" />
                          <span className="text-left leading-tight">{g.display_name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Stripe Form Card */}
                {paymentMethod === 'STRIPE' && stripeReady && (
                  <div className="mt-4 p-4 border border-edge bg-surface-muted/10 rounded-xl space-y-2 animate-fadeIn">
                    <label className="label-base">Card details</label>
                    <StripeCardSection onReady={handleCardReady} />
                    <div className="flex items-center gap-1.5 text-[10px] text-ink-muted">
                      <ShieldCheck className="h-3.5 w-3.5 text-brand-success shrink-0" />
                      <span>Your card is processed securely by Stripe. We never store card details.</span>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Action Button */}
            <div className="space-y-4">
              <button
                type="submit"
                disabled={loading || shippingLoading || !shippingAddressReady || !selectedShippingRateId || calcShipping == null || !paymentMethod || guestCheckoutBlocked || Boolean(shippingError)}
                className="btn-primary w-full py-4 text-sm font-semibold rounded-xl shadow-lg disabled:opacity-60 transition"
              >
                {loading
                  ? 'Processing…'
                  : paymentMethod === 'COD'
                  ? `Place Order (${currencySymbol}${grandTotal.toFixed(2)})`
                  : phase === 'failed'
                  ? `Try Payment Again (${currencySymbol}${grandTotal.toFixed(2)})`
                  : `Pay & Finalize Order (${currencySymbol}${grandTotal.toFixed(2)})`}
              </button>

              <div className="flex justify-center items-center gap-1.5 text-xs text-ink-muted font-medium">
                <ShieldCheck className="h-4 w-4 text-brand-success" />
                <span>256-bit Secure Encryption Checkout</span>
              </div>
            </div>
          </form>

          {/* Right Column: Order Summary for Desktop */}
          <div className="hidden lg:block lg:col-span-5 bg-surface-muted/20 border border-edge rounded-2xl p-6 sm:p-8 space-y-6 sticky top-24">
            <h2 className="font-display text-xl font-bold text-ink-primary border-b border-edge pb-3">Order Summary</h2>

            {/* Items list */}
            <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
              {cartItems.map((item) => {
                const p = item.product;
                const price = unitPrice(p);
                return (
                  <div key={item.id} className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-3">
                      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-edge bg-white shadow-sm">
                        {p.thumbnail ? (
                          <img src={p.thumbnail} alt={p.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full bg-surface-muted flex items-center justify-center text-ink-muted">No img</div>
                        )}
                        <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-ink-primary px-1 text-[9px] font-bold text-white shadow-sm">
                          {item.quantity}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-ink-primary block max-w-[180px] truncate">{p.name}</span>
                        <span className="text-[10px] text-ink-muted">Qty: {item.quantity}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-semibold text-ink-primary">{currencySymbol}{(price * item.quantity).toFixed(2)}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item)}
                        className="flex h-7 w-7 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-brand-danger/10 hover:text-ink-danger"
                        title={`Remove ${p.name}`}
                        aria-label={`Remove ${p.name} from cart`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Coupon input */}
            <div className="border-t border-edge pt-5">
              <label className="label-base mb-1.5">Have a coupon?</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Promo code"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  className="input-base py-2 px-3 text-xs bg-white"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={handleApplyCoupon}
                  className="btn-primary py-2 px-4 text-xs shrink-0 rounded-lg shadow-sm"
                  disabled={loading}
                >
                  Apply
                </button>
              </div>
              {couponError && <p className="text-[10px] text-ink-danger font-medium mt-1">{couponError}</p>}
              {activeCoupon && (
                <div className="flex items-center justify-between bg-brand-success/5 border border-brand-success/20 rounded-md p-2 mt-2 text-ink-success text-[10px] font-medium">
                  <span>✓ Coupon "{activeCoupon.code}" applied</span>
                  <button type="button" onClick={() => { setActiveCoupon(null); setCouponCode(''); }} className="hover:text-ink-danger font-semibold" disabled={loading}>Remove</button>
                </div>
              )}
            </div>

            {/* Pricing breakdown */}
            <div className="border-t border-edge pt-5 space-y-3 text-xs text-ink-secondary">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="text-ink-primary font-semibold">{currencySymbol}{subtotal.toFixed(2)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-ink-success font-semibold">
                  <span>Discount ({activeCoupon?.code})</span>
                  <span>-{currencySymbol}{discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>{taxInclusive ? `Includes ${taxName} (${taxRate}%)` : `${taxName} (${taxRate}%)`}</span>
                <span className="text-ink-primary font-semibold">{currencySymbol}{taxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping cost</span>
                <span className="text-ink-primary font-semibold">{calcShipping == null ? '—' : shippingCost === 0 ? 'FREE' : `${currencySymbol}${shippingCost.toFixed(2)}`}</span>
              </div>
              <div className="flex justify-between items-baseline border-t border-edge pt-3 font-bold text-sm text-ink-primary">
                <span>Grand Total</span>
                <span className="font-display text-[22px] text-ink-primary">{currencySymbol}{grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-edge bg-surface-muted/30 py-8 text-center text-xs text-ink-muted mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div>
            <FooterCredit />
          </div>
          <div className="flex gap-4">
            <Link href="/policies/privacy" className="hover:text-ink-primary transition">Privacy Policy</Link>
            <Link href="/policies/terms" className="hover:text-ink-primary transition">Terms of Service</Link>
            <Link href="/policies/shipping" className="hover:text-ink-primary transition">Shipping Policy</Link>
            <Link href="/policies/refund" className="hover:text-ink-primary transition">Refund Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function CheckoutClient() {
  const { currentRegion } = useSelector((state) => state.region);
  const { ready } = useStoreBootstrap();
  const cartItems = useSelector((state) => state.cart.items);
  const [gateways, setGateways] = useState([]);
  const [gatewayError, setGatewayError] = useState(false);

  const fetchGateways = useCallback(() => {
    if (!currentRegion) return;
    const regionCode = typeof currentRegion === 'object' ? (currentRegion.code || 'UK') : (currentRegion || 'UK');
    setGatewayError(false);
    fetch(getApiUrl(`/api/admin/payment-gateways/available/?region=${encodeURIComponent(regionCode)}`))
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((data) => setGateways(Array.isArray(data) ? data : []))
      .catch(() => {
        setGateways([]);
        setGatewayError(true);
      });
  }, [currentRegion]);

  useEffect(() => { fetchGateways(); }, [fetchGateways]);

  const stripeKey =
    gateways.find((g) => g.code === 'STRIPE')?.publishable_key || STRIPE_PK_FALLBACK;
  const stripePromise = useMemo(() => getStripe(stripeKey), [stripeKey]);

  // Loading state
  if (!ready || !currentRegion) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-brand-bg text-ink-primary">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-accent mb-4"></div>
        <p className="text-sm font-semibold tracking-wide text-ink-secondary">Loading secure checkout...</p>
      </div>
    );
  }

  // Empty cart state (only show when not checking out a finished order)
  if (ready && cartItems.length === 0) {
    return (
      <div className="min-h-screen flex flex-col bg-brand-bg text-brand-text">
        <header className="border-b border-edge bg-white/90 backdrop-blur-md py-4 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-center sm:justify-start items-center">
            <Link href="/" className="hover:opacity-90 transition">
              <LogoLockup markClass="h-9 w-9" wordClass="h-5" />
            </Link>
          </div>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-sm mx-auto">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted text-ink-muted mb-4 border border-edge shadow-sm">
            <ShoppingCart className="h-8 w-8" />
          </div>
          <h1 className="text-display font-medium text-[26px] text-ink-primary tracking-tight mb-2">Your cart is empty</h1>
          <p className="text-xs text-ink-muted leading-[1.6] mb-6">
            You don't have any items in your cart. Add products to get started with your order.
          </p>
          <Link href="/products" className="btn-primary w-full py-3.5 text-xs font-semibold rounded-xl">
            Explore products
          </Link>
        </main>
      </div>
    );
  }

  const inner = (
    <CheckoutPageInner
      gateways={gateways}
      gatewayError={gatewayError}
      fetchGateways={fetchGateways}
      stripeReady={!!stripePromise}
    />
  );

  if (!stripePromise) return inner;
  return <Elements stripe={stripePromise} key={stripeKey}>{inner}</Elements>;
}
