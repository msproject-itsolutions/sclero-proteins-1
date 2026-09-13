'use client';

import React, { useCallback, useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Clock, Download, Printer, ArrowLeft, ShoppingBag, ChevronRight, XCircle } from 'lucide-react';
import { LogoLockup } from '../../../components/Logo';
import FooterCredit from '../../../components/FooterCredit';
import { getApiUrl, postJson } from '../../../lib/api';

const tokenKey = (orderId) => `sclero_order_token_${orderId}`;

function readStoredToken(orderId) {
  try {
    return sessionStorage.getItem(tokenKey(orderId)) || '';
  } catch {
    return '';
  }
}

function storeToken(orderId, token) {
  try {
    sessionStorage.setItem(tokenKey(orderId), token);
  } catch {
    /* storage unavailable */
  }
}

// What the shopper should be told about the order right now.
function orderState(order) {
  if (order.status === 'AWAITING_PAYMENT') return 'confirming';
  if (order.status === 'CANCELLED') {
    if (order.payment_status === 'EXPIRED') return 'expired';
    if (['PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(order.payment_status)) return 'refunded';
    return 'cancelled';
  }
  if (order.payment_method === 'COD' && order.payment_status === 'PENDING') return 'cod';
  return 'paid';
}

const STATE_VIEW = {
  paid: {
    Icon: CheckCircle, tone: 'text-emerald-600 bg-emerald-50 border-emerald-200', badge: 'Payment received',
    title: 'Thank you! Your payment was received and your order is confirmed.',
    body: (o) => `A confirmation for order #${o.id} is on its way to ${o.email}.`,
  },
  cod: {
    Icon: CheckCircle, tone: 'text-blue-600 bg-blue-50 border-blue-200', badge: 'Pay on delivery',
    title: 'Thank you! Your order is placed.',
    body: (o) => `Please have the payment ready when order #${o.id} is delivered. A confirmation is on its way to ${o.email}.`,
  },
  confirming: {
    Icon: Clock, tone: 'text-amber-600 bg-amber-50 border-amber-200', badge: 'Confirming payment',
    title: 'We are confirming your payment…',
    body: () => 'This usually takes a few seconds. We will email you as soon as the payment is confirmed; you do not need to pay again.',
  },
  expired: {
    Icon: XCircle, tone: 'text-slate-600 bg-slate-50 border-slate-200', badge: 'Checkout expired',
    title: 'This order expired before it was paid.',
    body: () => 'No payment was taken. Your cart is still saved, so you can place the order again.',
  },
  refunded: {
    Icon: XCircle, tone: 'text-rose-600 bg-rose-50 border-rose-200', badge: 'Payment returned',
    title: 'Your payment arrived after the order expired.',
    body: (o) => (o.payment_status === 'REFUNDED'
      ? 'The items were no longer available, so the order was cancelled and your payment was refunded in full.'
      : 'The items were no longer available, so the order was cancelled. Our team is refunding your payment in full.'),
  },
  cancelled: {
    Icon: XCircle, tone: 'text-slate-600 bg-slate-50 border-slate-200', badge: 'Cancelled',
    title: 'This order was cancelled.',
    body: () => 'Contact us if you have any questions about this order.',
  },
};

function RequestOrderLink({ defaultOrderId }) {
  const [orderNumber, setOrderNumber] = useState(defaultOrderId || '');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  const submit = async (event) => {
    event.preventDefault();
    setStatus('sending');
    try {
      const { response, data } = await postJson('/api/orders/access-link/', {
        order_id: orderNumber.trim(),
        email: email.trim(),
      });
      if (!response.ok) throw new Error(data.error || data.detail || 'Please try again in a few minutes.');
      setStatus('sent');
      setMessage(data.detail);
    } catch (err) {
      setStatus('error');
      setMessage(err.message);
    }
  };

  if (status === 'sent') {
    return <p className="rounded-xl border border-edge bg-surface-muted/60 p-4 text-sm text-ink-secondary">{message}</p>;
  }
  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-3 text-left">
      <p className="text-sm text-ink-secondary">Enter your order number and email address and we will email you a secure link to this order.</p>
      <input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="Order number" className="input-base" required />
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email used for the order" className="input-base" required />
      {status === 'error' && <p className="text-xs text-ink-danger">{message}</p>}
      <button type="submit" disabled={status === 'sending'} className="btn-primary w-full py-3 text-sm disabled:opacity-60">
        {status === 'sending' ? 'Sending…' : 'Email me a link'}
      </button>
    </form>
  );
}

function OrderConfirmationContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order') || '';
  const [token, setToken] = useState('');
  const [tokenReady, setTokenReady] = useState(false);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const googleMerchantId = process.env.NEXT_PUBLIC_GOOGLE_MERCHANT_ID || '';

  // An emailed link carries the token in the URL: keep it in this tab only and
  // take it out of the address bar straight away.
  useEffect(() => {
    const fromUrl = searchParams.get('token') || '';
    if (fromUrl) {
      if (orderId) storeToken(orderId, fromUrl);
      window.history.replaceState(null, '', orderId ? `/checkout/success?order=${encodeURIComponent(orderId)}` : '/checkout/success');
    }
    setToken(fromUrl || (orderId ? readStoredToken(orderId) : ''));
    setTokenReady(true);
  }, [orderId, searchParams]);

  const lookup = useCallback(async () => {
    const response = await fetch(getApiUrl(`/api/orders/lookup/?token=${encodeURIComponent(token)}`), { credentials: 'omit' });
    if (!response.ok) {
      const error = new Error(response.status === 404 ? 'This order link is invalid or has expired.' : 'Unable to load the order details.');
      error.permanent = response.status === 404;
      throw error;
    }
    return response.json();
  }, [token]);

  useEffect(() => {
    if (!tokenReady) return undefined;
    if (!token) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    let timer = null;
    let attempts = 0;
    const poll = async () => {
      let again = false;
      try {
        const data = await lookup();
        if (cancelled) return;
        setOrder(data);
        setError('');
        again = data.status === 'AWAITING_PAYMENT';
      } catch (err) {
        if (cancelled) return;
        setError(err.message);
        // A dropped connection should not end the wait; an invalid link should.
        again = !err.permanent;
      } finally {
        if (!cancelled) setLoading(false);
      }
      // A payment the provider is still confirming normally settles within
      // moments; check again every 5 seconds for about two minutes.
      if (again && attempts < 24) {
        attempts += 1;
        timer = setTimeout(poll, 5000);
      }
    };
    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [tokenReady, token, lookup]);

  // Google Customer Reviews opt-in, shown once the order is placed.
  useEffect(() => {
    if (!order || !googleMerchantId || !['paid', 'cod'].includes(orderState(order))) return;
    const deliveryNumbers = String(order.shipping_estimated_days || '').match(/\d+/g);
    if (!deliveryNumbers?.length) return;
    const estDate = new Date();
    estDate.setDate(estDate.getDate() + Math.max(...deliveryNumbers.map(Number)));
    const estimated = `${estDate.getFullYear()}-${String(estDate.getMonth() + 1).padStart(2, '0')}-${String(estDate.getDate()).padStart(2, '0')}`;
    const renderOptIn = () => {
      if (window.gapi && window.gapi.surveyoptin) {
        window.gapi.surveyoptin.render({
          merchant_id: Number(googleMerchantId),
          order_id: String(order.id),
          email: order.email,
          delivery_country: order.shipping_country === 'IN' ? 'IN' : 'GB',
          estimated_delivery_date: estimated,
        });
      }
    };
    if (window.gapi && window.gapi.load) {
      window.gapi.load('surveyoptin', renderOptIn);
      return;
    }
    window.renderOptIn = () => window.gapi.load('surveyoptin', renderOptIn);
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/platform.js?onload=renderOptIn';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, [order, googleMerchantId]);

  const header = (
    <header className="border-b border-edge bg-white/90 backdrop-blur-md py-4 sticky top-0 z-40 shadow-sm print:hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <Link href="/" className="hover:opacity-90 transition">
          <LogoLockup markClass="h-9 w-9" wordClass="h-5" />
        </Link>
        <Link href="/" className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-ink-secondary hover:text-ink-primary transition">
          Storefront <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </header>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-bg text-brand-text p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent mb-4"></div>
        <p className="text-sm font-semibold text-ink-secondary">Loading your order…</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col bg-brand-bg text-brand-text">
        {header}
        <main className="flex-1 max-w-xl mx-auto px-4 py-16 text-center flex flex-col items-center justify-center gap-4">
          <div className="h-14 w-14 bg-surface-muted text-ink-secondary rounded-full flex items-center justify-center">
            <ShoppingBag className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-ink-primary">View your order</h1>
          {error && <p className="text-sm text-ink-danger">{error}</p>}
          <RequestOrderLink defaultOrderId={orderId} />
          <Link href="/" className="text-xs font-bold text-brand-primary hover:underline">Return to the storefront</Link>
        </main>
      </div>
    );
  }

  const state = orderState(order);
  const view = STATE_VIEW[state];
  const invoice = order.invoice;
  const invoiceHref = order.invoice_url ? getApiUrl(order.invoice_url) : null;
  const invoiceNum = invoice?.invoice_number || `Order #${order.id}`;
  const currencySymbol = order.currency_code === 'INR' ? '₹' : order.currency_code === 'GBP' ? '£' : `${order.currency_code} `;
  const items = order.items || [];
  const money = (value) => `${currencySymbol}${parseFloat(value || 0).toFixed(2)}`;

  return (
    <div className="min-h-screen flex flex-col bg-brand-bg text-brand-text print:bg-white print:p-0">
      {header}
      <main className="flex-1 max-w-3xl mx-auto px-4 py-8 sm:py-12 sm:px-6 lg:px-8 flex flex-col items-center">
        <div className={`h-16 w-16 border rounded-full flex items-center justify-center mb-4 shadow-sm print:hidden ${view.tone}`}>
          <view.Icon className="h-10 w-10" />
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 mb-3 rounded-full text-xs font-bold border ${view.tone}`}>{view.badge}</span>
        <h1 className="font-display text-[26px] sm:text-[34px] font-extrabold text-ink-primary tracking-tight mb-3 text-center leading-snug">{view.title}</h1>
        <p className="text-xs sm:text-sm text-ink-secondary max-w-xl text-center leading-[1.6] mb-8 bg-surface-muted/60 p-4 rounded-xl border border-edge">{view.body(order)}</p>

        {['paid', 'cod'].includes(state) && (
          <div className="flex flex-wrap items-center justify-center gap-3 mb-8 w-full print:hidden">
            {invoiceHref && (
              <a href={invoiceHref} target="_blank" rel="noreferrer" className="btn-primary py-3 px-5 text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm">
                <Download className="h-4 w-4" />
                Download PDF Invoice
              </a>
            )}
            <button onClick={() => window.print()} type="button" className="btn-ghost py-3 px-5 text-xs sm:text-sm border border-edge bg-white text-ink-primary hover:border-ink-primary flex items-center justify-center gap-2">
              <Printer className="h-4 w-4 text-ink-muted" />
              Print Order Summary
            </button>
          </div>
        )}

        <div className="w-full bg-white border border-edge rounded-2xl p-6 sm:p-8 text-left space-y-6 shadow-card mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-edge pb-4 gap-2">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-ink-muted block">Order</span>
              <h2 className="text-xl font-bold font-display text-ink-primary">Order #{order.id}</h2>
            </div>
            {invoice && (
              <div className="text-left sm:text-right">
                <span className="text-[10px] uppercase font-bold tracking-wider text-ink-muted block">Invoice Reference</span>
                <span className="font-mono text-sm font-semibold text-ink-primary">{invoiceNum}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs bg-surface-muted/30 p-4 rounded-xl border border-edge-subtle">
            <div>
              <span className="text-ink-muted block text-[10px] font-bold uppercase tracking-wider">Date</span>
              <span className="font-semibold text-ink-primary">{new Date(order.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
            </div>
            <div>
              <span className="text-ink-muted block text-[10px] font-bold uppercase tracking-wider">Payment Method</span>
              <span className="font-semibold text-ink-primary uppercase">{order.payment_method}</span>
            </div>
            <div>
              <span className="text-ink-muted block text-[10px] font-bold uppercase tracking-wider">Payment Status</span>
              <span className="font-bold text-ink-primary uppercase">{String(order.payment_status || '').replace('_', ' ')}</span>
            </div>
            <div>
              <span className="text-ink-muted block text-[10px] font-bold uppercase tracking-wider">Total</span>
              <span className="font-bold text-ink-primary text-sm font-display">{money(order.total)}</span>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-3">Order Items</h3>
            <div className="border border-edge rounded-xl overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-surface-muted border-b border-edge text-ink-secondary font-bold">
                  <tr>
                    <th className="p-3">Product</th>
                    <th className="p-3 text-center">Qty</th>
                    <th className="p-3 text-right">Price</th>
                    <th className="p-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-edge-subtle">
                  {items.map((it, idx) => (
                    <tr key={it.id || idx}>
                      <td className="p-3 font-medium text-ink-primary">
                        <div className="font-bold">{it.product_name || `Item #${it.id}`}</div>
                        {it.variant_name && <div className="text-[10px] text-ink-secondary">Option: {it.variant_name}</div>}
                      </td>
                      <td className="p-3 text-center font-bold text-ink-primary">{it.quantity}</td>
                      <td className="p-3 text-right text-ink-secondary">{money(it.price)}</td>
                      <td className="p-3 text-right font-semibold text-ink-primary">{money(it.quantity * parseFloat(it.price))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <div className="w-full sm:w-72 space-y-2 text-xs">
              <div className="flex justify-between text-ink-secondary"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
              {parseFloat(order.discount_amount) > 0 && (
                <div className="flex justify-between text-ink-success"><span>Discount</span><span>-{money(order.discount_amount)}</span></div>
              )}
              {parseFloat(order.tax_amount) > 0 && (
                <div className="flex justify-between text-ink-secondary"><span>Tax ({parseFloat(order.tax_rate || 0).toFixed(1)}%)</span><span>{money(order.tax_amount)}</span></div>
              )}
              <div className="flex justify-between text-ink-secondary">
                <span>Shipping ({order.shipping_method || 'Standard'})</span>
                <span>{parseFloat(order.shipping_cost) > 0 ? money(order.shipping_cost) : 'Free'}</span>
              </div>
              <div className="border-t border-edge pt-2 flex justify-between font-bold text-sm text-ink-primary">
                <span>Total</span>
                <span className="font-display text-base text-brand-primary">{money(order.total)}</span>
              </div>
            </div>
          </div>

          {order.shipping_address_line1 && (
            <div className="border-t border-edge pt-4 text-xs space-y-1">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Shipping Destination</h3>
              <p className="font-medium text-ink-primary leading-relaxed">
                {order.shipping_name}<br />
                {order.shipping_address_line1}{order.shipping_address_line2 ? `, ${order.shipping_address_line2}` : ''}<br />
                {order.shipping_city}, {order.shipping_state} {order.shipping_postal_code}<br />
                {order.shipping_country}
              </p>
            </div>
          )}
        </div>

        <div className="print:hidden">
          <Link href={state === 'expired' ? '/checkout' : '/'} className="inline-flex items-center gap-2 text-xs font-bold text-brand-primary hover:underline">
            <ArrowLeft className="h-4 w-4" />
            {state === 'expired' ? 'Back to checkout' : 'Return to the storefront'}
          </Link>
        </div>
      </main>

      <footer className="border-t border-edge bg-surface-muted/50 py-8 text-center text-xs text-ink-muted mt-auto print:hidden">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <FooterCredit />
          <div className="flex gap-4">
            <Link href="/policies/privacy" className="hover:text-ink-primary transition">Privacy Policy</Link>
            <Link href="/policies/terms" className="hover:text-ink-primary transition">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-brand-bg text-brand-text">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-accent"></div>
      </div>
    }>
      <OrderConfirmationContent />
    </Suspense>
  );
}
