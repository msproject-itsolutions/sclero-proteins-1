'use client';

import React from 'react';
import { useSelector } from 'react-redux';
import Link from 'next/link';
import { ArrowRight, Mail, MapPin, Phone, ShoppingBag } from 'lucide-react';
import ContactForm from './ContactForm';

export default function ContactClient() {
  const branding = useSelector((state) => state.region.branding);
  const currentRegion = useSelector((state) => state.region.currentRegion);

  const contactEmail = currentRegion === 'IN'
    ? branding?.emailIN
    : branding?.emailUK;

  const contactPhone = currentRegion === 'IN'
    ? branding?.phoneIN
    : branding?.phoneUK;

  const contactPhoneHref = contactPhone ? `tel:${contactPhone.replace(/[^+\d]/g, '')}` : '';

  return (
    <main className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-12 lg:px-8">
      <section className="reveal lg:col-span-5">
        <p className="kicker mb-4">Contact & Wholesale</p>
        <h1 className="text-heading-1 brand-heading-gradient">Support for orders, products, and <em className="text-italic-accent">partnerships</em>.</h1>
        <p className="mt-5 max-w-xl text-[15px] leading-[1.75] text-ink-secondary">
          Send our team a message and we will route it to the right support, wholesale, or regional operations contact.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/products" className="btn-primary px-6 py-3 text-sm">
            <ShoppingBag className="h-4 w-4" />
            Shop products
          </Link>
          <Link href="/bulk" className="btn-ghost px-6 py-3 text-sm">
            Wholesale enquiry <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-8 space-y-4 text-sm text-ink-secondary">
          {contactEmail && (
            <p className="flex items-start gap-3">
              <Mail className="mt-0.5 h-5 w-5 text-brand-accent" />
              <a href={`mailto:${contactEmail}`} className="hover:underline">{contactEmail}</a>
            </p>
          )}
          {contactPhone && (
            <p className="flex items-start gap-3">
              <Phone className="mt-0.5 h-5 w-5 text-brand-accent" />
              <a href={contactPhoneHref} className="hover:underline">
                {currentRegion === 'IN' ? 'India: ' : 'UK: '}{contactPhone}
              </a>
            </p>
          )}
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
