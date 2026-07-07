'use client';

import React from 'react';
import { useSelector } from 'react-redux';
import { Mail, MapPin, Phone } from 'lucide-react';
import ContactForm from './ContactForm';

export default function ContactClient() {
  const branding = useSelector((state) => state.region.branding);
  const currentRegion = useSelector((state) => state.region.currentRegion);

  const contactEmail = currentRegion === 'IN'
    ? (branding?.emailIN || 'support@scleroproteins.in')
    : (branding?.emailUK || 'support@scleroproteins.co.uk');

  const contactPhone = currentRegion === 'IN'
    ? (branding?.phoneIN || '+91 80 4710 0000')
    : (branding?.phoneUK || '+44 (0)20 4574 0000');

  const contactPhoneHref = `tel:${contactPhone.replace(/[^+\d]/g, '')}`;

  return (
    <main className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-12 lg:px-8">
      <section className="reveal lg:col-span-5">
        <p className="kicker mb-4">Contact Us</p>
        <h1 className="text-heading-1">Support for orders, products, and <em className="text-italic-accent">partnerships</em>.</h1>
        <p className="mt-5 max-w-xl text-[15px] leading-[1.75] text-ink-secondary">
          Send our team a message and we will route it to the right support, wholesale, or regional operations contact.
        </p>

        <div className="mt-8 space-y-4 text-sm text-ink-secondary">
          <p className="flex items-start gap-3">
            <Mail className="mt-0.5 h-5 w-5 text-brand-accent" />
            <a href={`mailto:${contactEmail}`} className="hover:underline">{contactEmail}</a>
          </p>
          <p className="flex items-start gap-3">
            <Phone className="mt-0.5 h-5 w-5 text-brand-accent" />
            <a href={contactPhoneHref} className="hover:underline">
              {currentRegion === 'IN' ? 'India: ' : 'UK: '}{contactPhone}
            </a>
          </p>
          <p className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 text-brand-accent" />
            UK and India fulfilment hubs for regional support.
          </p>
        </div>
      </section>

      <section className="reveal lg:col-span-7">
        <ContactForm />
      </section>
    </main>
  );
}
