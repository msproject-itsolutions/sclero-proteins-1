import StoreShell from '../../components/StoreShell';
import ContactForm from './ContactForm';
import { Mail, MapPin, Phone } from 'lucide-react';

export const metadata = {
  title: 'Contact Us | Sclero Proteins Support',
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
      <main className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-12 lg:px-8">
        <section className="lg:col-span-5">
          <p className="text-xs font-black uppercase tracking-widest text-brand-purple">Contact Us</p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-brand-navy">Support for orders, products, and partnerships.</h1>
          <p className="mt-4 text-sm leading-7 text-brand-muted">
            Send our team a message and we will route it to the right support, wholesale, or regional operations contact.
          </p>

          <div className="mt-8 space-y-4 text-sm text-brand-muted">
            <p className="flex items-start gap-3"><Mail className="mt-0.5 h-5 w-5 text-brand-purple" /> support@scleroproteins.co.uk</p>
            <p className="flex items-start gap-3"><Phone className="mt-0.5 h-5 w-5 text-brand-purple" /> UK: 01293 901941 | India: +91 84888 03622</p>
            <p className="flex items-start gap-3"><MapPin className="mt-0.5 h-5 w-5 text-brand-purple" /> UK and India fulfilment hubs for regional support.</p>
          </div>
        </section>

        <section className="lg:col-span-7">
          <ContactForm />
        </section>
      </main>
    </StoreShell>
  );
}
