import StoreShell from '../../components/StoreShell';
import ContactClient from './ContactClient';

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
      <ContactClient />
    </StoreShell>
  );
}
