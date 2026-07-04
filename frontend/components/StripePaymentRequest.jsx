'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  PaymentRequestButtonElement,
  useStripe,
} from '@stripe/react-stripe-js';

/**
 * Renders the Stripe Payment Request Button (Apple Pay / Google Pay).
 *
 * Silent no-op if:
 *   - The publishable key env var is missing.
 *   - Stripe isn't ready yet.
 *   - canMakePayment() returns null (browser/device doesn't support
 *     any wallet — Chrome on desktop without saved cards, Firefox, etc).
 *
 * Must be rendered inside <Elements stripe={stripePromise}>.
 */
export default function StripePaymentRequest({
  amount,
  currency,
  label,
  onSuccess,
  onError,
}) {
  const stripe = useStripe();
  const [paymentRequest, setPaymentRequest] = useState(null);

  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  const totalCents = useMemo(
    () => Math.round((Number(amount) || 0) * 100),
    [amount]
  );

  useEffect(() => {
    if (!publishableKey || !stripe || totalCents <= 0) return;

    const pr = stripe.paymentRequest({
      country: 'GB',
      currency: (currency || 'gbp').toLowerCase(),
      total: { label: label || 'Order total', amount: totalCents },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    let cancelled = false;
    pr.canMakePayment()
      .then((result) => {
        if (cancelled) return;
        if (result) {
          setPaymentRequest(pr);
        } else {
          setPaymentRequest(null);
        }
      })
      .catch(() => {
        if (!cancelled) setPaymentRequest(null);
      });

    return () => {
      cancelled = true;
    };
  }, [stripe, publishableKey, totalCents, currency, label]);

  useEffect(() => {
    if (!paymentRequest) return undefined;

    const handler = async (ev) => {
      try {
        await Promise.resolve(onSuccess?.(ev.paymentMethod.id));
        ev.complete('success');
      } catch (err) {
        ev.complete('fail');
        onError?.(err);
      }
    };

    paymentRequest.on('paymentmethod', handler);
    return () => {
      try { paymentRequest.off('paymentmethod', handler); } catch {}
    };
  }, [paymentRequest, onSuccess, onError]);

  if (!publishableKey || !paymentRequest) return null;

  return (
    <div className="my-2 overflow-hidden rounded-sm">
      <PaymentRequestButtonElement
        options={{
          paymentRequest,
          style: {
            paymentRequestButton: {
              type: 'default',
              theme: 'dark',
              height: '44px',
            },
          },
        }}
      />
    </div>
  );
}
