import StoreShell from '../../components/StoreShell';
import ContactForm from './ContactForm';
import { Mail, MapPin, Phone } from 'lucide-react';

export const metadata = {
  title: 'Contact Us',
  description: 'Contact Sclero Proteins customer support for product, order, wholesale, and regional fulfilment help.',
  alternates: { canonical: '/contact' },
  openGraph: {
    title: 'Contact Sclero Proteins',
    description: 'Reach the Sclero Proteins support team in the UK and India.',
  },
};

export default function ContactPage() {
  return (
    <StoreShell>
      <main className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-12 lg:px-8">
        <section className="reveal lg:col-span-5">
          <p className="kicker mb-4">Contact Us</p>
          <h1 className="text-heading-1">Support for orders, products, and <em className="text-italic-accent">partnerships</em>.</h1>
          <p className="mt-5 max-w-xl text-[15px] leading-[1.75] text-ink-secondary">
            Send our team a message and we will route it to the right support, wholesale, or regional operations contact.
          </p>

          <div className="mt-8 space-y-4 text-sm text-ink-secondary">
            <p className="flex items-start gap-3"><Mail className="mt-0.5 h-5 w-5 text-brand-accent" /> support@scleroproteins.co.uk</p>
            <p className="flex items-start gap-3"><Phone className="mt-0.5 h-5 w-5 text-brand-accent" /> UK: 01293 901941 | India: +91 84888 03622</p>
            <p className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 text-brand-accent" /> UK and India fulfilment hubs for regional support.</p>
          </div>
        </section>

        <section className="reveal lg:col-span-7">
          <ContactForm />
        </section>
      </main>
    </StoreShell>
  );
}
