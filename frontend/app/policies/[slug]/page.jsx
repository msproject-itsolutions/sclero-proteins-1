import React from 'react';
import { Shield, FileText, Truck, RefreshCw, Bookmark, Eye, HeartPulse, Send } from 'lucide-react';
import StoreShell from '../../../components/StoreShell';
import ContactForm from '../../contact/ContactForm';
import Link from 'next/link';

const POLICIES = {
  privacy: {
    title: 'Privacy Policy',
    lastUpdated: 'June 23, 2026',
    icon: Shield,
    metaTitle: 'Privacy Policy | Sclero Proteins Ltd',
    metaDesc: 'How we collect, use, and protect your personal information at Sclero Proteins.',
    sections: [
      {
        heading: '1. Information We Collect',
        text: 'We collect personal details such as your name, email address, phone number, shipping/billing address, and payment method options when you place an order. We also collect automated analytics data (cookies, IP address, browsing behavior) to improve your storefront experience.',
      },
      {
        heading: '2. How We Use Your Data',
        text: 'We process your information to complete transactions, arrange regional shipping, send automated order updates, and—where explicitly opted-in under GDPR or DPDP regulations—send marketing promotions and wellness newsletter updates.',
      },
      {
        heading: '3. Data Security & Storage',
        text: 'Your transactions are processed through secure payment gateways (Stripe, Razorpay, PayPal). We implement standard SSL encryption and tokenization. Sclero Proteins does not store raw credit card details on our local database.',
      },
      {
        heading: '4. Third-Party Sharing',
        text: 'We share your address details with designated regional courier networks (e.g. DPD, DHL, Blue Dart) to fulfill logistics. We do not sell or lease your personal information to third-party advertisers.',
      },
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    lastUpdated: 'June 23, 2026',
    icon: FileText,
    metaTitle: 'Terms & Conditions | Sclero Proteins Ltd',
    metaDesc: 'Terms of service and purchasing conditions for Sclero Proteins.',
    sections: [
      {
        heading: '1. Agreement to Terms',
        text: 'By accessing the Sclero Proteins storefront or placing an order, you agree to comply with and be bound by these Terms & Conditions. These terms govern all purchases made in our regional sub-stores (United Kingdom, India, and global channels).',
      },
      {
        heading: '2. Product Use & Disclaimer',
        text: 'Our bone & joint care (BJC®) and active protein supplements are formulated for dietary support. They are not intended to diagnose, treat, cure, or prevent any medical condition. Please consult a healthcare professional before starting any new dietary supplement regime.',
      },
      {
        heading: '3. Pricing & Regional Currency',
        text: 'Prices are displayed in your detected regional currency (£ for UK, ₹ for India) and include applicable regional taxes (VAT or GST). Sclero Proteins reserves the right to adjust rates, run promotional discounts, or cancel orders due to stock level discrepancies.',
      },
      {
        heading: '4. Limitation of Liability',
        text: 'To the maximum extent permitted by law, Sclero Proteins Ltd shall not be liable for any indirect, incidental, or consequential damages resulting from product use or web storefront downtime.',
      },
    ],
  },
  shipping: {
    title: 'Shipping Policy',
    lastUpdated: 'June 23, 2026',
    icon: Truck,
    metaTitle: 'Shipping & Delivery Policy | Sclero Proteins Ltd',
    metaDesc: 'Regional shipping rates, processing times, and free delivery thresholds.',
    sections: [
      {
        heading: '1. Processing Times',
        text: 'Orders are processed within 24 hours on working days. Once dispatched, tracking codes are automatically synced to your customer dashboard and sent via transactional emails.',
      },
      {
        heading: '2. Regional Courier Partners',
        text: 'United Kingdom: Shipped via Royal Mail or DPD (2-3 business days tracking). India: Shipped via Blue Dart, Delhivery, or Speed Post (3-5 business days tracking). We maintain local warehouses in Haywards Heath (UK) and Samarkha Anand (India) to assure swift local delivery.',
      },
      {
        heading: '3. Shipping Rates & Free Thresholds',
        text: 'United Kingdom: Free standard shipping on orders of £50.00 or more. Orders under £50.00 incur a flat £5.00 delivery fee. India: Free delivery on orders of ₹3,000 or more. Orders below ₹3,000 incur a ₹150 delivery charge.',
      },
      {
        heading: '4. Customs & International Shipping',
        text: 'For international orders outside of our core UK/India hubs, delivery duties are calculated at checkout. Customers are responsible for any border customs clearance fees that may arise.',
      },
    ],
  },
  refund: {
    title: 'Refund & Return Policy',
    lastUpdated: 'June 23, 2026',
    icon: RefreshCw,
    metaTitle: 'Refunds & Returns | Sclero Proteins Ltd',
    metaDesc: 'Learn about our 30-day money-back guarantee and return process.',
    sections: [
      {
        heading: '1. 30-Day Money-Back Guarantee',
        text: 'We are committed to quality. If you are not fully satisfied with your purchase, you can request a full refund within 30 days of purchase. Simply contact our support desk with your order number.',
      },
      {
        heading: '2. Return Requirements',
        text: 'To complete a standard return, product tubs should ideally be unopened or have at least 80% of the active contents remaining if requesting a satisfaction refund. Delivery costs for returns are covered by the customer unless the product arrived damaged.',
      },
      {
        heading: '3. Processing Refunds',
        text: 'Once approved, refunds are credited back to your original payment method (Stripe, Razorpay, PayPal) within 5 to 7 business days. You will receive an automated refund receipt email.',
      },
    ],
  },
  cookie: {
    title: 'Cookie Policy',
    lastUpdated: 'June 23, 2026',
    icon: Eye,
    metaTitle: 'Cookie Policy | Sclero Proteins Ltd',
    metaDesc: 'How Sclero Proteins uses cookies to improve shopping UX and track analytics.',
    sections: [
      {
        heading: '1. What Are Cookies?',
        text: 'Cookies are small text files placed on your browser to recognize your preferences and keep your active shopping cart items saved across storefront visits.',
      },
      {
        heading: '2. How We Use Cookies',
        text: 'We use necessary cookies for session storage and regional routing, analytical cookies to review conversion rates via Google Analytics, and tracking pixels (such as Meta Pixel) to gauge advertisement effectiveness.',
      },
      {
        heading: '3. Managing Your Choices',
        text: 'You can adjust your cookie settings through your browser preferences. Restricting functional cookies may cause parts of the checkout and region-switching flows to work incorrectly.',
      },
    ],
  },
  accessibility: {
    title: 'Accessibility Statement',
    lastUpdated: 'June 23, 2026',
    icon: HeartPulse,
    metaTitle: 'Accessibility | Sclero Proteins Ltd',
    metaDesc: 'Our commitment to web standards and inclusive digital storefront UX.',
    sections: [
      {
        heading: '1. Our Standards',
        text: 'Sclero Proteins Ltd is dedicated to making our digital storefront accessible to all visitors. We build our components in compliance with WCAG 2.1 Level AA accessibility guidelines.',
      },
      {
        heading: '2. Implementation Features',
        text: 'Our frontend includes semantic HTML, proper ARIA labels, strong color contrast values, keyboard-navigable dialogs, and alt tags on active product illustrations.',
      },
      {
        heading: '3. Feedback & Contact',
        text: 'If you encounter any layout issues or accessibility barriers on our storefront, please reach out to our design team at accessibility@scleroproteins.co.uk.',
      },
    ],
  },
  about: {
    title: 'About Sclero Proteins',
    lastUpdated: 'June 23, 2026',
    icon: HeartPulse,
    metaTitle: 'About Us | Sclero Proteins Ltd',
    metaDesc: 'Learn about Sclero Proteins, our science-backed formulations, and GMP standards.',
    sections: [
      {
        heading: 'Our Vision',
        text: 'Sclero Proteins Ltd was founded to challenge the supplement status quo. We believe that what goes into your body should be backed by clinical evidence, manufactured to rigorous pharmaceutical-grade standards, and fully transparent.',
      },
      {
        heading: 'Focus on Joint and Bone Care (BJC®)',
        text: 'Our signature BJC® range combines bioactive peptides, minerals, and vitamins specifically researched to support cartilage integrity, bone density, and everyday joint flexibility. We do not use proprietary blends, allowing you to know exactly how much of each ingredient you take.',
      },
      {
        heading: 'Global Reach & Local Integrity',
        text: 'With headquarters and fulfillment warehouses in Haywards Heath (UK) and Anand (India), we manufacture locally under GMP compliance, reducing transit emissions and providing direct local customer support.',
      },
    ],
  },
  contact: {
    title: 'Contact Us',
    lastUpdated: 'June 23, 2026',
    icon: Send,
    metaTitle: 'Contact Us | Sclero Proteins Ltd',
    metaDesc: 'Get in touch with Sclero Proteins support team in the UK and India.',
    isContactForm: true,
    sections: [
      {
        heading: 'Customer Support Hours',
        text: 'Monday - Friday: 09:00 - 18:00 (GMT / IST). We aim to respond to all inquiries within 1 business day.',
      },
    ],
  },
};

export async function generateMetadata({ params }) {
  const { slug = 'privacy' } = await params;
  const policy = POLICIES[slug] || POLICIES.privacy;
  return {
    title: policy.metaTitle,
    description: policy.metaDesc,
    alternates: {
      canonical: `/policies/${slug}`,
    },
    openGraph: {
      title: policy.metaTitle,
      description: policy.metaDesc,
      type: 'website',
    },
  };
}

export default async function PolicyPage({ params }) {
  const { slug = 'privacy' } = await params;
  const policy = POLICIES[slug] || POLICIES.privacy;
  const IconComponent = policy.icon;

  return (
    <StoreShell>
      <div className="bg-slate-50 py-12 border-b border-slate-200/80">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-purple/10 text-brand-purple">
              <IconComponent className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-purple">
                Legal & Info Center
              </p>
              <h1 className="text-3xl font-black text-brand-navy tracking-tight mt-1">
                {policy.title}
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-12">
          
          {/* Policy Links Navigation */}
          <aside className="md:col-span-3 space-y-2">
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand-muted px-2.5">
              Available Pages
            </p>
            <nav className="flex flex-col gap-1.5">
              {Object.entries(POLICIES).map(([k, val]) => (
                <Link
                  key={k}
                  href={`/policies/${k}`}
                  className={`rounded-xl px-3 py-2 text-xs font-semibold transition-all ${
                    slug === k
                      ? 'bg-brand-purple/10 text-brand-purple font-bold'
                      : 'text-brand-navy hover:bg-slate-50'
                  }`}
                >
                  {val.title}
                </Link>
              ))}
            </nav>
          </aside>

          {/* Main content body */}
          <main className="md:col-span-9 space-y-8">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-4">
              <span className="text-[11px] font-medium text-brand-muted">
                Last updated: {policy.lastUpdated}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-navy">
                Official Document
              </span>
            </div>

            <div className="space-y-6">
              {policy.sections.map((sec, i) => (
                <div key={i} className="space-y-2">
                  <h2 className="text-base font-black text-brand-navy">{sec.heading}</h2>
                  <p className="text-sm leading-relaxed text-brand-muted">{sec.text}</p>
                </div>
              ))}
            </div>

            {/* Special Contact Us Form */}
            {policy.isContactForm && (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-black text-brand-navy uppercase tracking-wider mb-4">
                  Send a Support Ticket
                </h3>
                <ContactForm />
              </div>
            )}
          </main>
        </div>
      </div>
    </StoreShell>
  );
}
