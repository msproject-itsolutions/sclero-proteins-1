import Link from 'next/link';
import EssenceNewsletterForm from './EssenceNewsletterForm';
import FooterCredit from '../../components/FooterCredit';

export const metadata = {
  title: 'Essence Preview | Sclero Proteins',
  description: 'Isolated preview of the essence redesign direction. Not indexed.',
  robots: { index: false, follow: false },
};

const FEATURED = [
  {
    slug: 'whey-isolate-90',
    name: 'Whey Isolate 90',
    kicker: 'Best seller',
    blurb: '27 g protein · 0 g sugar · third-party tested',
    price: '£42',
  },
  {
    slug: 'plant-protein-pea-rice',
    name: 'Plant Protein · Pea + Rice',
    kicker: 'Vegan',
    blurb: '24 g protein · smooth vanilla · organic-certified',
    price: '£38',
  },
  {
    slug: 'creatine-monohydrate',
    name: 'Creatine Monohydrate',
    kicker: 'New',
    blurb: 'Micronised 200 mesh · unflavoured · 100 servings',
    price: '£22',
  },
];

const WHY = [
  { h: 'Clinically dosed', p: 'Every active is in the range shown to work in peer-reviewed trials — never a fairy dust sprinkle.' },
  { h: 'Third-party tested', p: 'Every batch, every SKU. Certificates of analysis published on the product page.' },
  { h: 'Transparent labels', p: 'No proprietary blends. Every ingredient in mg, every source disclosed.' },
  { h: 'Made responsibly', p: 'GMP-certified facilities in the UK and India. Traceable supply chain, quiet packaging.' },
];

const FAQ = [
  { q: 'Do you ship internationally?', a: 'We ship across the UK, EU, India, and the UAE. Duties are pre-paid at checkout so nothing is charged on delivery.' },
  { q: 'Are your products third-party tested?', a: 'Yes. Every batch is tested for potency, purity, and heavy metals. The certificate of analysis lives on each product page.' },
  { q: 'What is your returns policy?', a: 'If you are not happy for any reason within 30 days, we refund the product cost in full. No questions, no return required for opened items under £50.' },
  { q: 'Do you offer subscriptions?', a: 'Not yet. We are focused on getting the essentials right first. Subscriptions arrive in the next release.' },
];

const ESSENCE_CSS = `
.essence {
  --e-canvas: #FAFAF7;
  --e-canvas-2: #F3F1EA;
  --e-surface: #FFFFFF;
  --e-ink: #1A1A1A;
  --e-ink-2: #4A4A4A;
  --e-ink-3: #6E6A61;
  --e-edge: #E8E6E1;
  --e-edge-strong: #D6D2C7;
  --e-accent: #A8791E;
  --e-accent-ink: #6E4F13;
  --e-shadow: 0 1px 2px rgba(20,20,20,0.04), 0 8px 24px -12px rgba(20,20,20,0.08);
  background: var(--e-canvas);
  color: var(--e-ink);
  font-family: 'Inter', 'Outfit', system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
  letter-spacing: 0;
}
.essence .e-serif { font-family: 'Cormorant Garamond','Times New Roman',Georgia,serif; }
.essence .e-italic { font-style: italic; font-family: 'Cormorant Garamond','Times New Roman',Georgia,serif; font-weight: 500; }
.essence h1, .essence h2, .essence h3 { color: var(--e-ink); letter-spacing: -0.02em; }
.essence a.e-link { color: var(--e-accent-ink); text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 4px; }
.essence a.e-link:hover { color: var(--e-ink); }
.essence .e-btn {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 14px 26px; font-size: 14px; font-weight: 500; letter-spacing: 0.02em;
  border: 1px solid var(--e-ink); background: var(--e-ink); color: #fff;
  transition: all .18s ease;
}
.essence .e-btn:hover { background: transparent; color: var(--e-ink); }
.essence .e-btn-ghost {
  display: inline-flex; align-items: center; justify-content: center;
  padding: 14px 26px; font-size: 14px; font-weight: 500; letter-spacing: 0.02em;
  border: 1px solid var(--e-edge-strong); background: transparent; color: var(--e-ink);
  transition: all .18s ease;
}
.essence .e-btn-ghost:hover { border-color: var(--e-ink); }
.essence .e-hairline { border-top: 1px solid var(--e-edge); }
.essence .e-card { background: var(--e-surface); border: 1px solid var(--e-edge); border-radius: 6px; box-shadow: var(--e-shadow); }
.essence .e-kicker { font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--e-ink-3); }
.essence details[open] summary .e-plus { transform: rotate(45deg); }
.essence details summary { list-style: none; cursor: pointer; }
.essence details summary::-webkit-details-marker { display: none; }
`;

export default function EssencePreviewPage() {
  return (
    <div className="essence min-h-screen">
      <style dangerouslySetInnerHTML={{ __html: ESSENCE_CSS }} />

      {/* Preview banner */}
      <div className="w-full text-center py-2 text-[11px] tracking-[0.2em] uppercase" style={{ background: '#1A1A1A', color: '#FAFAF7' }}>
        Essence preview · not the live site · <Link href="/" className="underline underline-offset-4">back to production home</Link>
      </div>

      {/* Nav */}
      <header className="e-hairline" style={{ borderTop: 'none', borderBottom: '1px solid var(--e-edge)' }}>
        <nav className="max-w-[1200px] mx-auto flex items-center justify-between px-6 lg:px-10 h-[72px]">
          <div className="flex items-center gap-2">
            <span className="e-serif text-[22px] tracking-tight">Sclero</span>
            <span className="e-kicker mt-1">Proteins</span>
          </div>
          <ul className="hidden md:flex items-center gap-10 text-[14px]" style={{ color: 'var(--e-ink-2)' }}>
            <li><a href="#collection">Products</a></li>
            <li><a href="#brand">About</a></li>
            <li><a href="#science">Science</a></li>
            <li><a href="#faq">Support</a></li>
          </ul>
          <div className="flex items-center gap-4">
            <span className="e-kicker">£ GBP</span>
            <a className="e-btn-ghost !py-2 !px-4 text-[13px]" href="#">Account</a>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="max-w-[1200px] mx-auto px-6 lg:px-10 py-24 lg:py-32 text-center">
        <p className="e-kicker mb-8">Est. 2024 · UK &amp; India</p>
        <h1 className="e-serif text-[44px] md:text-[64px] leading-[1.05] max-w-3xl mx-auto">
          Clinically <span className="e-italic">crafted</span> nutrition.
        </h1>
        <p className="mt-6 max-w-xl mx-auto text-[15px] leading-[1.75]" style={{ color: 'var(--e-ink-2)' }}>
          Supplements engineered for athletes, wellness enthusiasts and professionals —
          third-party tested, transparently formulated, quietly designed.
        </p>
        <div className="mt-10 flex items-center justify-center gap-3 flex-wrap">
          <a className="e-btn" href="#collection">Shop the range</a>
          <a className="e-btn-ghost" href="#science">Read the science</a>
        </div>
      </section>

      {/* Stats ribbon */}
      <section className="e-hairline">
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            ['27 g', 'Protein per serving'],
            ['0 g', 'Added sugar'],
            ['100%', 'Third-party tested'],
            ['12,000+', 'Orders shipped'],
          ].map(([k, v]) => (
            <div key={v}>
              <div className="e-serif text-[32px] leading-none">{k}</div>
              <div className="e-kicker mt-3">{v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Collection */}
      <section id="collection" className="max-w-[1200px] mx-auto px-6 lg:px-10 py-24 lg:py-32">
        <div className="flex items-end justify-between mb-12">
          <div>
            <p className="e-kicker mb-4">The collection</p>
            <h2 className="e-serif text-[36px] md:text-[44px] leading-tight">Considered formulas.</h2>
          </div>
          <a className="hidden md:inline e-link text-[14px]" href="#">View all →</a>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FEATURED.map((p) => (
            <article key={p.slug} className="e-card overflow-hidden group">
              <div className="aspect-[4/5]" style={{ background: 'var(--e-canvas-2)' }} aria-hidden />
              <div className="p-6">
                <p className="e-kicker mb-3">{p.kicker}</p>
                <h3 className="e-serif text-[22px] leading-tight">{p.name}</h3>
                <p className="mt-2 text-[13.5px] leading-[1.7]" style={{ color: 'var(--e-ink-2)' }}>{p.blurb}</p>
                <div className="mt-6 flex items-center justify-between">
                  <span className="text-[15px]">{p.price}</span>
                  <a className="e-link text-[13px]" href="#">Add to bag →</a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Brand block */}
      <section id="brand" className="e-hairline" style={{ background: 'var(--e-canvas-2)', borderTopColor: 'var(--e-edge)' }}>
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-24 lg:py-32 grid md:grid-cols-12 gap-12 items-start">
          <div className="md:col-span-5">
            <p className="e-kicker mb-4">The philosophy</p>
            <h2 className="e-serif text-[36px] md:text-[44px] leading-tight">
              A quieter kind of <span className="e-italic">supplement brand.</span>
            </h2>
          </div>
          <div className="md:col-span-7 grid sm:grid-cols-2 gap-x-10 gap-y-10">
            {WHY.map((w) => (
              <div key={w.h}>
                <h3 className="text-[15px] font-medium tracking-tight">{w.h}</h3>
                <p className="mt-3 text-[14px] leading-[1.75]" style={{ color: 'var(--e-ink-2)' }}>{w.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Reviews strip */}
      <section className="max-w-[1200px] mx-auto px-6 lg:px-10 py-24 text-center">
        <p className="e-kicker mb-4">Reviews</p>
        <h2 className="e-serif text-[36px] md:text-[44px] leading-tight">
          4.9 <span className="e-italic">/ 5</span> across 12,000+ orders.
        </h2>
        <div className="grid md:grid-cols-3 gap-6 mt-14 text-left">
          {[
            ['“Actually tastes like nothing — which is what I want in a whey. And the label is honest.”', 'Amit R.', 'Bangalore'],
            ['“Third batch, no bloating, no crash. The dose is finally what it says on the tin.”', 'Hannah W.', 'Manchester'],
            ['“Packaging looks like something I want on the counter, not hidden in a cupboard.”', 'Priya K.', 'London'],
          ].map(([q, name, city]) => (
            <blockquote key={name} className="e-card p-8">
              <p className="e-serif text-[19px] leading-[1.6]">{q}</p>
              <footer className="mt-6 e-kicker">{name} · {city}</footer>
            </blockquote>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="e-hairline">
        <div className="max-w-[820px] mx-auto px-6 lg:px-10 py-24 lg:py-32">
          <div className="text-center mb-12">
            <p className="e-kicker mb-4">Support</p>
            <h2 className="e-serif text-[36px] md:text-[44px] leading-tight">Questions, answered clearly.</h2>
          </div>
          <div className="divide-y" style={{ borderColor: 'var(--e-edge)' }}>
            {FAQ.map((f, i) => (
              <details key={f.q} className="py-6" open={i === 0}>
                <summary className="flex items-center justify-between gap-6">
                  <span className="text-[16px] font-medium">{f.q}</span>
                  <span className="e-plus text-[20px] leading-none transition-transform duration-200" aria-hidden>+</span>
                </summary>
                <p className="mt-4 text-[14.5px] leading-[1.8]" style={{ color: 'var(--e-ink-2)' }}>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="e-hairline" style={{ background: 'var(--e-canvas-2)' }}>
        <div className="max-w-[720px] mx-auto px-6 lg:px-10 py-20 text-center">
          <p className="e-kicker mb-4">The letter</p>
          <h2 className="e-serif text-[32px] md:text-[38px] leading-tight">Nutrition, quietly delivered.</h2>
          <p className="mt-4 text-[14.5px]" style={{ color: 'var(--e-ink-2)' }}>
            One thoughtful email a month. New formulas, batch reports, no marketing noise.
          </p>
          <EssenceNewsletterForm />
        </div>
      </section>

      {/* Footer */}
      <footer style={{ background: 'var(--e-ink)', color: '#EDEBE4' }}>
        <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-16 grid grid-cols-2 md:grid-cols-4 gap-10 text-[13.5px]">
          <div className="col-span-2 md:col-span-1">
            <div className="e-serif text-[22px] text-white">Sclero</div>
            <p className="mt-4 leading-[1.7]" style={{ color: '#BFB9AE' }}>
              Clinically crafted nutrition. Made in the UK and India.
            </p>
          </div>
          {[
            ['Shop', ['Whey', 'Plant Protein', 'Creatine', 'View all']],
            ['Company', ['About', 'Science', 'Careers', 'Press']],
            ['Support', ['Shipping', 'Returns', 'Contact', 'FAQ']],
          ].map(([title, items]) => (
            <div key={title}>
              <p className="e-kicker" style={{ color: '#BFB9AE' }}>{title}</p>
              <ul className="mt-4 space-y-3">
                {items.map((it) => <li key={it}><a href="#" className="hover:underline underline-offset-4">{it}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t" style={{ borderColor: '#2B2B2B' }}>
          <div className="max-w-[1200px] mx-auto px-6 lg:px-10 py-6 flex flex-wrap items-center justify-between gap-4 text-[12px]" style={{ color: '#8F8A80' }}>
            <FooterCredit />
            <p>Registered in England &amp; Wales. VAT-registered.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
