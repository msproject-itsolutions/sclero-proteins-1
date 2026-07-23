import StoreShell from '../../components/StoreShell';
import Link from 'next/link';
import { ArrowRight, FlaskConical, HeartHandshake, ShieldCheck, ShoppingBag } from 'lucide-react';
import EggOText from '../../components/EggOText';

export const metadata = {
  title: 'Our Story | Sclero Proteins',
  description:
    'Discover the story behind Sclero Proteins, our commitment to clarity, trusted quality, and a more human approach to wellness shopping.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'Our Story | Sclero Proteins',
    description:
      'A more human look at how Sclero Proteins approaches quality, transparency, and everyday wellness support.',
  },
};

const STORY_PILLARS = [
  {
    title: 'Clarity before hype',
    copy:
      'We believe customers should understand what they are buying without having to decode complicated labels or exaggerated promises.',
    icon: ShieldCheck,
  },
  {
    title: 'Wellness with purpose',
    copy:
      'Every product is presented to help people shop for support they can actually use in real routines, not just admire in marketing.',
    icon: HeartHandshake,
  },
  {
    title: 'Science made approachable',
    copy:
      'We value research, but we also believe good products should feel understandable, reassuring, and easy to choose.',
    icon: FlaskConical,
  },
];

export default function AboutPage() {
  return (
    <StoreShell>
      <main>
        <section className="border-b border-edge bg-surface section">
          <div className="container-page">
            <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
              <div>
                <p className="kicker mb-4">Our Story</p>
                <h1 className="text-display max-w-3xl">
                  We built <EggOText text="Sclero" /> to make wellness shopping feel more <em className="text-italic-accent">clear, trustworthy, and human</em>.
                </h1>
                <p className="mt-5 max-w-2xl text-[16px] leading-[1.85] text-ink-secondary">
                  Sclero Proteins was shaped around a simple idea: people deserve better guidance when choosing products for collagen support, joint care, and everyday wellness. Instead of creating more noise, we want to create more clarity.
                </p>
                <p className="mt-4 max-w-2xl text-[16px] leading-[1.85] text-ink-secondary">
                  That means cleaner presentation, easier product discovery, and a shopping experience that helps customers feel confident from the first visit through to checkout.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <Link href="/products" className="btn-primary px-6 py-3 text-sm">
                    <ShoppingBag className="h-4 w-4" />
                    Shop products
                  </Link>
                  <Link href="/contact" className="btn-ghost px-6 py-3 text-sm">
                    Talk to our team <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              <div className="gradient-ring overflow-hidden rounded-[28px] border border-edge bg-white shadow-elevated">
                <img
                  src="/about/founder-garden.jpg"
                  alt="Sclero Proteins founder standing in the garden outside the company premises"
                  className="h-full min-h-[420px] w-full object-cover"
                  width={1200}
                  height={1800}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white section">
          <div className="container-page">
            <div className="max-w-3xl">
              <p className="kicker">What Matters To Us</p>
              <h2 className="text-heading-1 mt-3">A stronger product story starts with honesty, consistency, and care.</h2>
              <p className="mt-4 text-[15px] leading-[1.8] text-ink-secondary">
                We know customers are comparing options, reading labels, and trying to make smart decisions quickly. Our role is to make that process easier, not harder.
              </p>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {STORY_PILLARS.map((item) => {
                const Icon = item.icon;
                return (
                  <article key={item.title} className="premium-card rounded-[24px] p-7">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-ink-accent shadow-card">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h2 className="mt-5 text-xl font-bold text-ink-primary">{item.title}</h2>
                    <p className="mt-3 text-sm leading-[1.85] text-ink-secondary">{item.copy}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-white section pt-0">
          <div className="container-page">
            <div className="max-w-3xl">
              <p className="kicker">Behind The Brand</p>
              <h2 className="text-heading-1 mt-3">The people and the place behind every batch.</h2>
              <p className="mt-4 text-[15px] leading-[1.8] text-ink-secondary">
                Sclero is run by people who are present in the day-to-day work, from the office floor to the products
                that leave it.
              </p>
            </div>

            <figure className="mt-10 overflow-hidden rounded-[28px] border border-edge bg-surface-subtle shadow-card">
              <img
                src="/about/founder-office-desk.jpg"
                alt="Sclero Proteins founder seated at his desk beneath the company logo in the head office"
                className="h-full max-h-[560px] w-full object-cover"
                width={1537}
                height={1023}
                loading="lazy"
              />
            </figure>
          </div>
        </section>

        <section className="border-y border-edge bg-surface-subtle section">
          <div className="container-page">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
              <div>
                <p className="kicker">Why It Connects</p>
                <h2 className="text-heading-1 mt-3">People buy with more confidence when the experience feels thoughtful.</h2>
                <p className="mt-4 text-[15px] leading-[1.8] text-ink-secondary">
                  Sclero is not just about what goes into the product. It is also about how the product is explained, how easily it can be compared, and how supported the customer feels while making a decision.
                </p>
                <p className="mt-4 text-[15px] leading-[1.8] text-ink-secondary">
                  That is why we focus on transparent copy, stronger trust signals, product-first navigation, and a polished buying journey designed to support both engagement and conversion.
                </p>
              </div>

              <div className="premium-panel rounded-[24px] p-8">
                <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-accent">Shop with confidence</p>
                <ul className="mt-5 space-y-3 text-sm leading-[1.8] text-ink-secondary">
                  <li>Clearer product storytelling</li>
                  <li>More trustworthy buying signals</li>
                  <li>Cleaner navigation across devices</li>
                  <li>Regional support for UK and India shoppers</li>
                </ul>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href="/products" className="btn-primary px-6 py-3 text-sm">
                    Explore the collection
                  </Link>
                  <Link href="/contact" className="btn-ghost px-6 py-3 text-sm">
                    Contact us <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </StoreShell>
  );
}
