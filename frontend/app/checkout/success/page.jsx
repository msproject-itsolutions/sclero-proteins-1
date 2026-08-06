'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Download, Printer, ArrowLeft, ShoppingBag, Truck, PackageCheck, FileText, ChevronRight } from 'lucide-react';
import { LogoLockup } from '../../../components/Logo';
import FooterCredit from '../../../components/FooterCredit';
import { getApiUrl } from '../../../lib/api';

function OrderConfirmationContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id') || searchParams.get('id');
  const email = searchParams.get('email') || '';

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      setError('No order ID provided.');
      return;
    }

    let isMounted = true;
    const fetchOrder = async () => {
      try {
        const url = getApiUrl(`/api/orders/lookup/?id=${orderId}${email ? `&email=${encodeURIComponent(email)}` : ''}`);
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error('Order not found or access expired.');
        }
        const data = await res.json();
        if (isMounted) {
          setOrder(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Unable to load order details.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchOrder();
    return () => { isMounted = false; };
  }, [orderId, email]);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-brand-bg text-brand-text p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent mb-4"></div>
        <p className="text-sm font-semibold text-ink-secondary">Loading your order confirmation...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex flex-col bg-brand-bg text-brand-text">
        <header className="border-b border-edge bg-white py-4 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 flex justify-between items-center">
            <Link href="/" className="hover:opacity-90 transition">
              <LogoLockup markClass="h-9 w-9" wordClass="h-5" />
            </Link>
          </div>
        </header>
        <main className="flex-1 max-w-xl mx-auto px-4 py-16 text-center flex flex-col items-center justify-center">
          <div className="h-14 w-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4">
            <ShoppingBag className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-ink-primary mb-2">Order Not Found</h1>
          <p className="text-sm text-ink-secondary mb-6">
            {error || 'We could not locate the details for this order.'}
          </p>
          <Link href="/" className="btn-primary py-3 px-6 text-sm">
            Return to Storefront
          </Link>
        </main>
      </div>
    );
  }

  const invoice = order.invoice;
  const pdfUrl = invoice && invoice.pdf_file
    ? getApiUrl(invoice.pdf_file.startsWith('/') ? invoice.pdf_file : `/media/${invoice.pdf_file}`)
    : null;

  const invoiceNum = invoice?.invoice_number || `SP-${new Date(order.created_at || Date.now()).getFullYear()}-${String(order.id).padStart(5, '0')}`;
  const currencySymbol = order.region?.currency_symbol || (order.currency_code === 'INR' ? '₹' : order.currency_code === 'GBP' ? '£' : '$');
  const items = order.items || [];

  const orderStages = [
    { key: 'CONFIRMED', label: 'Order Confirmed' },
    { key: 'PROCESSING', label: 'Preparing Items' },
    { key: 'SHIPPED', label: 'Dispatched' },
    { key: 'DELIVERED', label: 'Delivered' },
  ];

  const currentStatus = (order.status || 'CONFIRMED').toUpperCase();
  const activeStageIndex = currentStatus === 'DELIVERED'
    ? 3
    : currentStatus === 'SHIPPED'
    ? 2
    : currentStatus === 'PROCESSING'
    ? 1
    : 0;

  return (
    <div className="min-h-screen flex flex-col bg-brand-bg text-brand-text print:bg-white print:p-0">
      {/* Non-printable Header */}
      <header className="border-b border-edge bg-white/90 backdrop-blur-md py-4 sticky top-0 z-40 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <Link href="/" className="hover:opacity-90 transition">
            <LogoLockup markClass="h-9 w-9" wordClass="h-5" />
          </Link>
          <div className="flex items-center gap-3">
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold text-brand-primary hover:text-brand-accent transition"
              >
                <Download className="h-4 w-4" />
                PDF Invoice
              </a>
            )}
            <Link
              href="/"
              className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-ink-secondary hover:text-ink-primary transition"
            >
              Storefront <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto px-4 py-8 sm:py-12 sm:px-6 lg:px-8 flex flex-col items-center">
        {/* Reassurance Badge */}
        <div className="h-16 w-16 bg-emerald-50 border border-emerald-200 rounded-full flex items-center justify-center mb-4 shadow-sm print:hidden">
          <CheckCircle className="h-10 w-10 text-emerald-600 animate-bounce" />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 mb-3 print:hidden">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span className="h-2 w-2 rounded-full bg-emerald-600"></span>
            Payment Successful
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            Order Confirmed
          </span>
        </div>

        <h1 className="font-display text-[26px] sm:text-[34px] font-extrabold text-ink-primary tracking-tight mb-3 text-center leading-snug">
          Thank you! We have successfully received your payment, and your order has been confirmed.
        </h1>

        <p className="text-xs sm:text-sm text-ink-secondary max-w-xl text-center leading-[1.6] mb-8 bg-surface-muted/60 p-4 rounded-xl border border-edge">
          Your order <span className="font-bold text-ink-primary">#{order.id}</span> is being processed. A confirmation email has been dispatched to <span className="font-bold text-ink-primary">{order.email}</span> along with your official tax invoice.
        </p>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-8 w-full print:hidden">
          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-primary py-3 px-5 text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm"
            >
              <Download className="h-4 w-4" />
              Download Official PDF Invoice
            </a>
          )}
          <button
            onClick={handlePrint}
            type="button"
            className="btn-ghost py-3 px-5 text-xs sm:text-sm border border-edge bg-white text-ink-primary hover:border-ink-primary flex items-center justify-center gap-2"
          >
            <Printer className="h-4 w-4 text-ink-muted" />
            Print Order Summary
          </button>
        </div>

        {/* Order Tracker */}
        <div className="w-full bg-white border border-edge rounded-2xl p-6 shadow-card mb-8 text-left print:border-none print:shadow-none print:p-0">
          <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-4">Order Progress Status</h3>
          <div className="relative flex items-center justify-between">
            <div className="absolute top-1/2 left-0 right-0 h-1 bg-edge -translate-y-1/2 z-0" />
            <div
              className="absolute top-1/2 left-0 h-1 bg-brand-accent -translate-y-1/2 z-0 transition-all duration-500"
              style={{ width: `${(activeStageIndex / (orderStages.length - 1)) * 100}%` }}
            />
            {orderStages.map((stage, idx) => {
              const isPassed = idx <= activeStageIndex;
              const isCurrent = idx === activeStageIndex;
              return (
                <div key={stage.key} className="relative z-10 flex flex-col items-center">
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                      isPassed
                        ? 'bg-ink-primary text-white ring-4 ring-ink-primary/10'
                        : 'bg-white border-2 border-edge text-ink-muted'
                    }`}
                  >
                    {isPassed ? '✓' : idx + 1}
                  </div>
                  <span
                    className={`mt-2 text-[10px] font-semibold text-center hidden sm:block max-w-[75px] ${
                      isCurrent ? 'text-ink-primary font-bold' : isPassed ? 'text-ink-secondary' : 'text-ink-muted'
                    }`}
                  >
                    {stage.label}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-edge-subtle pt-3 text-xs">
            <span className="text-ink-secondary font-medium">Status: <span className="font-bold text-emerald-700 uppercase">{order.status || 'CONFIRMED'}</span></span>
            {order.shipping_estimated_days && (
              <span className="text-ink-muted">Estimated Delivery: <span className="font-semibold text-ink-primary">{order.shipping_estimated_days}</span></span>
            )}
          </div>
        </div>

        {/* Order Details Container */}
        <div className="w-full bg-white border border-edge rounded-2xl p-6 sm:p-8 text-left space-y-6 shadow-card mb-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-edge pb-4 gap-2">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-ink-muted block">Order Confirmation</span>
              <h2 className="text-xl font-bold font-display text-ink-primary">Order #{order.id}</h2>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-[10px] uppercase font-bold tracking-wider text-ink-muted block">Invoice Reference</span>
              <span className="font-mono text-sm font-semibold text-ink-primary">{invoiceNum}</span>
            </div>
          </div>

          {/* Key Overview Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs bg-surface-muted/30 p-4 rounded-xl border border-edge-subtle">
            <div>
              <span className="text-ink-muted block text-[10px] font-bold uppercase tracking-wider">Date</span>
              <span className="font-semibold text-ink-primary">{new Date(order.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
            </div>
            <div>
              <span className="text-ink-muted block text-[10px] font-bold uppercase tracking-wider">Payment Method</span>
              <span className="font-semibold text-ink-primary uppercase">{order.payment_method || 'ONLINE'}</span>
            </div>
            <div>
              <span className="text-ink-muted block text-[10px] font-bold uppercase tracking-wider">Payment Status</span>
              <span className="font-bold text-emerald-700 uppercase">{order.payment_status || 'PAID'}</span>
            </div>
            <div>
              <span className="text-ink-muted block text-[10px] font-bold uppercase tracking-wider">Total Paid</span>
              <span className="font-bold text-ink-primary text-sm font-display">{currencySymbol}{parseFloat(order.total).toFixed(2)}</span>
            </div>
          </div>

          {/* Items Summary Table */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-ink-muted mb-3">Order Items</h3>
            <div className="border border-edge rounded-xl overflow-hidden">
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
                    <tr key={it.id || idx} className="hover:bg-surface-muted/20">
                      <td className="p-3 font-medium text-ink-primary">
                        <div className="font-bold">{it.product_name || it.name || `Item #${it.id}`}</div>
                        {it.product_sku && <div className="text-[10px] text-ink-muted font-mono">SKU: {it.product_sku}</div>}
                        {it.variant_name && <div className="text-[10px] text-ink-secondary">Option: {it.variant_name}</div>}
                      </td>
                      <td className="p-3 text-center font-bold text-ink-primary">{it.quantity}</td>
                      <td className="p-3 text-right text-ink-secondary">{currencySymbol}{parseFloat(it.price).toFixed(2)}</td>
                      <td className="p-3 text-right font-semibold text-ink-primary">{currencySymbol}{(it.quantity * parseFloat(it.price)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pricing Totals */}
          <div className="flex justify-end pt-2">
            <div className="w-full sm:w-72 space-y-2 text-xs">
              <div className="flex justify-between text-ink-secondary">
                <span>Subtotal</span>
                <span>{currencySymbol}{parseFloat(order.subtotal || order.total).toFixed(2)}</span>
              </div>

              {parseFloat(order.tax_amount) > 0 && (
                <div className="flex justify-between text-ink-secondary">
                  <span>{order.region?.tax_name || 'Tax'} ({parseFloat(order.tax_rate || 0).toFixed(1)}%)</span>
                  <span>{currencySymbol}{parseFloat(order.tax_amount).toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-ink-secondary">
                <span>Shipping ({order.shipping_method || 'Standard'})</span>
                <span>{parseFloat(order.shipping_cost) > 0 ? `${currencySymbol}${parseFloat(order.shipping_cost).toFixed(2)}` : 'Free'}</span>
              </div>

              <div className="border-t border-edge pt-2 flex justify-between font-bold text-sm text-ink-primary">
                <span>Total Paid</span>
                <span className="font-display text-base text-brand-primary">{currencySymbol}{parseFloat(order.total).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          {order.shipping_address_line1 && (
            <div className="border-t border-edge pt-4 text-xs space-y-1">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">Shipping Destination</h3>
              <p className="font-medium text-ink-primary leading-relaxed">
                {order.shipping_name}<br />
                {order.shipping_address_line1}{order.shipping_address_line2 ? `, ${order.shipping_address_line2}` : ''}<br />
                {order.shipping_city}, {order.shipping_state} {order.shipping_postal_code}<br />
                {order.shipping_country}
              </p>
              {order.shipping_phone && <p className="text-ink-secondary text-[11px]">Phone: {order.shipping_phone}</p>}
            </div>
          )}
        </div>

        {/* Back Link */}
        <div className="print:hidden">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-brand-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to Sclero Proteins Storefront
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
