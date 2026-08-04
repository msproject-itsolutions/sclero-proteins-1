import StoreShell from '../../components/StoreShell';
import GeneralFAQModule from '../../components/GeneralFAQModule';
import Link from 'next/link';

export const metadata = {
  title: 'Frequently Asked Questions | Sclero Proteins',
  description: 'Find answers to common questions about shipping, delivery, payments, refunds, and our science-backed formulations.',
  alternates: { canonical: '/faq' },
  openGraph: {
    title: 'Frequently Asked Questions | Sclero Proteins',
    description: 'Find answers to common questions about shipping, delivery, payments, refunds, and our science-backed formulations.',
  },
};

export default function FAQPage() {
  return (
    <StoreShell>
      <main>
        {/* Banner Section */}
        <section className="border-b border-edge bg-surface section">
          <div className="container-page text-center">
            <p className="kicker mb-4">Support Hub</p>
            <h1 className="text-display brand-heading-gradient mx-auto max-w-3xl">
              Frequently Asked <em className="text-italic-accent">Questions</em>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-[15px] leading-[1.75] text-ink-secondary">
              Have questions about Sclero Proteins? Browse our categories below or search to find answers regarding ordering, shipping, and scientific backing.
            </p>
          </div>
        </section>

        {/* FAQs List Section */}
        <section className="reveal section">
          <div className="container-page">
            <GeneralFAQModule />
          </div>
        </section>

        {/* CTA Section */}
        <section className="reveal border-t border-edge bg-surface-muted section">
          <div className="container-page space-y-4 text-center">
            <h2 className="text-heading-1">Still need help?</h2>
            <p className="mx-auto max-w-lg text-[15px] leading-[1.75] text-ink-secondary">
              If you couldn't find the answer you were looking for, our friendly support team is here to assist you with order tracing, dosage recommendations, or account changes.
            </p>
            <div className="pt-4 flex justify-center gap-3">
              <Link href="/contact" className="btn-primary px-6 py-3 text-sm">Contact Support</Link>
              <Link href="/about" className="btn-ghost px-6 py-3 text-sm">Learn about us</Link>
            </div>
          </div>
        </section>
      </main>
    </StoreShell>
  );
}
