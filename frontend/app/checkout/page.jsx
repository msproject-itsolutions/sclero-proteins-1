import React from 'react';
import CheckoutClient from './CheckoutClient';

export const metadata = {
  title: 'Secure Checkout | Sclero Proteins',
  description: 'Complete your order securely at Sclero Proteins. Enter your shipping details and select a payment method.',
  robots: { index: false, follow: false },
  alternates: {
    canonical: '/checkout',
  },
  openGraph: {
    title: 'Secure Checkout | Sclero Proteins',
    description: 'Complete your order securely at Sclero Proteins. Enter your shipping details and select a payment method.',
  },
};

export default function CheckoutPage() {
  return <CheckoutClient />;
}
