'use client';

import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import Link from 'next/link';
import {
  Check, Send, Sparkles, Star, ArrowRight,
  Shield, Brain, Zap, Activity, Users, Instagram
} from 'lucide-react';
import StoreShell from '../components/StoreShell';
import HeroSection from '../components/HeroSection';
import ProductCatalog from '../components/ProductCatalog';
import QuizComponent from '../components/QuizComponent';
import { GuaranteeBanner } from '../components/GuaranteeCard';
import { getApiUrl } from '../lib/api';

const SOCIAL_PROOF = {
  customers: '12,000+',
  servings: '50,000+',
  rating: '4.8',
  reviewCount: '1,200',
};

const HEALTH_GOALS = [
  { name: 'Immunity', slug: 'immunity', icon: Shield, desc: 'Immune defence support' },
  { name: 'Sleep & Relax', slug: 'sleep', icon: Brain, desc: 'Stress & sleep recovery' },
  { name: 'Energy & Vitality', slug: 'energy', icon: Zap, desc: 'Mitigate daily fatigue' },
  { name: 'Gut Health', slug: 'gut', icon: Activity, desc: 'Bioactive microbiome' },
  { name: 'Men\'s Health', slug: 'men', icon: Users, desc: 'Hormonal & physical support' },
  { name: 'Women\'s Health', slug: 'women', icon: Users, desc: 'Bone density & balance' },
  { name: 'Skin & Hair', slug: 'collagen', icon: Sparkles, desc: 'Dermatological synthesis' },
  { name: 'Fitness & Muscle', slug: 'fitness', icon: Activity, desc: 'Muscle synthesis & repair' },
];

const TESTIMONIALS = [
  { name: 'Sarah Jenkins', role: 'Verified UK Buyer', rating: 5, text: 'The BJC joint care has been a lifesaver for my daily runs. My knees feel highly lubricated and recovery times are cut in half.', product: 'BJC® Bone & Joint Care' },
  { name: 'Rahul Mehta', role: 'Verified India Buyer', rating: 5, text: 'Absolutely love the label transparency. Unlike other brands in India, Sclero Proteins lists exact composition quantities.', product: 'OvoMatrix ESC' },
  { name: 'James Foster', role: 'Amateur Athlete', rating: 5, text: 'Highest grade protein I have used. Cold-processed active whey makes a massive difference in muscle fullness and digestion.', product: 'Cold-Processed Active Whey' },
];

export default function HomePageClient({ initialBlogs = [] }) {
  const currentRegion = useSelector((state) => state.region.currentRegion);
  const [inquiryName, setInquiryName] = useState('');
  const [inquiryEmail, setInquiryEmail] = useState('');
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [inquirySent, setInquirySent] = useState(false);
  const [cartOpenTrigger, setCartOpenTrigger] = useState(null);

  const handleInquirySubmit = (e) => {
    e.preventDefault();
    if (!(inquiryName && inquiryEmail && inquiryMessage)) return;
    
    fetch(getApiUrl('/api/enquiries/'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: inquiryName,
        email: inquiryEmail,
        message: inquiryMessage,
        enquiry_type: 'DISTRIBUTOR',
        product_interest: 'Wholesale / distribution',
      }),
    })
      .catch(() => {})
      .finally(() => {
        setInquirySent(true);
        setInquiryName('');
        setInquiryEmail('');
        setInquiryMessage('');
      });
  };

  return (
    <StoreShell cartOpenSignal={cartOpenTrigger}>
      {/* Hero Section */}
      <HeroSection />

      {/* Quiet stats ribbon */}
      <div className="hairline border-b border-edge bg-brand-bg">
        <div className="container-page grid grid-cols-2 gap-6 py-8 text-center md:grid-cols-4">
          {[
            [SOCIAL_PROOF.customers, 'Customers worldwide'],
            [SOCIAL_PROOF.servings, 'Servings delivered'],
            [`${SOCIAL_PROOF.rating} / 5`, 'Average rating'],
            [`${SOCIAL_PROOF.reviewCount}+`, 'Verified reviews'],
          ].map(([k, v]) => (
            <div key={v}>
              <div className="font-display text-[30px] font-medium leading-none text-ink-primary">{k}</div>
              <div className="kicker mt-3">{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Shop by Goal Section */}
      <section className="section bg-brand-bg">
        <div className="container-page">
          <div className="reveal mb-12 text-center">
            <span className="kicker">Targeted Actives</span>
            <h2 className="text-heading-1 mt-3">Shop by health goal</h2>
            <p className="mt-3 text-sm text-ink-secondary">Filter Sclero formulations to match your daily wellness goals</p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:gap-5">
            {HEALTH_GOALS.map((goal, idx) => {
              const Icon = goal.icon;
              return (
                <Link
                  key={idx}
                  href={`/products?q=${goal.slug}`}
                  className="reveal group flex h-36 flex-col justify-between rounded-md border border-edge bg-surface p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-edge-strong hover:shadow-elevated"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-sm bg-surface-muted text-ink-accent">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-primary transition-colors group-hover:text-ink-accent">
                      {goal.name}
                    </h3>
                    <p className="mt-1.5 text-[11px] leading-snug text-ink-muted">{goal.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Quiz Section */}
      <section className="section border-y border-edge bg-surface-muted">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="reveal mb-10 text-center">
            <span className="kicker">Personalized Wellness</span>
            <h2 className="text-heading-1 mt-3">Not sure where to start?</h2>
            <p className="mt-3 text-sm text-ink-secondary">
              Take our 4-question quiz to find the perfect collagen or supplement for your goals
            </p>
          </div>

          <QuizComponent
            onComplete={(result) => {
              window.location.href = `/products/${result.recommendation.sku}`;
            }}
          />
        </div>
      </section>

      {/* Science & Purity Section */}
      <section className="section border-b border-edge bg-brand-bg">
        <div className="container-page">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="reveal space-y-6">
              <div>
                <span className="kicker">Scientific Integrity</span>
                <h2 className="text-heading-1 mt-3 leading-tight">Advanced biochemistry for <em className="text-italic-accent">bio-active</em> absorption</h2>
                <p className="mt-5 text-sm leading-[1.8] text-ink-secondary">
                  Our formulations are constructed by molecular biologists to solve a core supplementation issue: bioavailability. By combining active proteins with essential co-factors, we ensure active ingredients cross cellular membranes efficiently instead of being degraded by digestive acids.
                </p>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.14em] text-ink-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-accent" />
                    Zero Fillers
                  </div>
                  <p className="text-xs leading-[1.7] text-ink-muted">No silica, stearates, or synthetic binders. Just 100% active, bio-available ingredients.</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.14em] text-ink-primary">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-accent" />
                    Lab Checked
                  </div>
                  <p className="text-xs leading-[1.7] text-ink-muted">Every batch undergoes rigorous independent analysis to guarantee purity and composition.</p>
                </div>
              </div>
            </div>
            <div className="reveal group relative flex aspect-video items-center justify-center overflow-hidden rounded-lg border border-edge bg-surface-muted shadow-card lg:aspect-square">
              <img
                src="https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=800"
                alt="Clinical laboratory research"
                className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/70 via-black/15 to-transparent p-6">
                <p className="text-xs font-medium leading-relaxed text-white/90">
                  Tested by ISO-accredited third-party laboratories. Full certificates of analysis are published for public verification.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Risk Reversal Banner */}
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <GuaranteeBanner />
      </div>

      {/* Sclero Standard Pillars Section */}
      <section className="section border-b border-edge bg-surface-muted">
        <div className="container-page">
          <div className="reveal mb-14 text-center">
            <span className="kicker">Core Pillars</span>
            <h2 className="text-heading-1 mt-3">The Sclero <em className="text-italic-accent">standard.</em></h2>
            <p className="mt-3 text-sm text-ink-secondary">Every supplement we release meets strict quality and safety thresholds</p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[
              { icon: Shield, h: 'GMP Certified Manufacturing', p: 'All products are synthesized in state-of-the-art certified facilities in the UK and Europe under strict pharmaceutical conditions.' },
              { icon: Zap, h: 'Cold-Processed Peptides', p: 'We use low-temperature extraction technology to keep collagen and protein chains intact, preserving original active enzymes.' },
              { icon: Check, h: 'Absolute Label Honesty', p: 'No proprietary blends with hidden ingredients. We disclose the exact milligram weight of every compound on the label.' },
            ].map(({ icon: Icon, h, p }) => (
              <div key={h} className="reveal group rounded-md border border-edge bg-surface p-8 text-center shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated">
                <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-sm bg-surface-muted text-ink-accent transition-transform duration-300 group-hover:scale-110">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="mb-3 font-display text-[20px] font-semibold leading-tight text-ink-primary">{h}</h3>
                <p className="text-xs leading-[1.75] text-ink-secondary">{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Best Sellers range */}
      <ProductCatalog
        id="products"
        title="Best Sellers"
        subtitle="Our most-requested bioactive joint formulations & active proteins."
        limit={3}
        onOpenCart={() => setCartOpenTrigger(Date.now())}
      />

      <div className="container-page pb-20 text-center">
        <Link href="/products" className="btn-ghost px-8 py-3.5 text-sm">
          Browse full catalog →
        </Link>
      </div>

      {/* Social Proof (Customer Testimonials) */}
      <section className="section border-y border-edge bg-brand-bg">
        <div className="container-page">
          <div className="reveal mb-14 text-center">
            <span className="kicker">Customer Reviews</span>
            <h2 className="text-heading-1 mt-3">Verified <em className="text-italic-accent">trust.</em></h2>
            <p className="mt-3 text-sm text-ink-secondary">What our wellness community says about Sclero Proteins</p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t, idx) => (
              <blockquote key={idx} className="reveal flex flex-col justify-between rounded-md border border-edge bg-surface p-8 shadow-card">
                <div>
                  <div className="mb-4 flex">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-brand-accent text-brand-accent" />
                    ))}
                  </div>
                  <p className="mb-6 font-display text-[18px] font-medium italic leading-[1.6] text-ink-primary">"{t.text}"</p>
                </div>
                <footer className="flex items-center justify-between border-t border-edge pt-4">
                  <div>
                    <h4 className="text-xs font-semibold text-ink-primary">{t.name}</h4>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-ink-muted">{t.role}</p>
                  </div>
                  <span className="rounded-xs bg-surface-muted px-2.5 py-1 text-[9px] font-medium uppercase tracking-wide text-ink-accent">
                    {t.product}
                  </span>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* Instagram Reels Section */}
      <section className="section border-b border-edge bg-surface-muted">
        <div className="container-page">
          <div className="reveal mb-14 text-center">
            <span className="kicker">Social Feed</span>
            <h2 className="text-heading-1 mt-3">Latest from Instagram</h2>
            <p className="mt-3 text-sm text-ink-secondary">Follow our community @scleroproteins for daily fitness and joint care insights</p>
          </div>

          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
            {/* Live Instagram Feed Iframe */}
            <div className="reveal rounded-md border border-edge bg-surface p-4 shadow-card lg:col-span-5">
              <div className="relative flex aspect-[4/5] w-full flex-col items-center justify-center overflow-hidden rounded-sm border border-edge-subtle bg-surface-muted p-6 text-center">
                <iframe
                  src="https://www.instagram.com/scleroproteins/embed"
                  className="absolute inset-0 h-full w-full rounded-sm border-0"
                  allowFullScreen
                  scrolling="no"
                  frameBorder="0"
                  title="Instagram Feed Embed"
                ></iframe>
              </div>
            </div>

            {/* Curated Reels Grid */}
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { title: 'Cold-processed whey vs heat-denatured proteins. Here is the science 🧪', url: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=500', plays: '12.4k' },
                { title: 'Daily joint recovery routine using BJC active peptides 🏋️‍♂️', url: 'https://images.unsplash.com/photo-1579758629938-03607ccdbaba?w=500', plays: '9.8k' },
                { title: 'The truth about proprietary supplement blends. Read labels carefully!', url: 'https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=500', plays: '18.1k' },
                { title: 'How eggshell membrane peptides support cartilage density naturally 🔬', url: 'https://images.unsplash.com/photo-1550572017-edd951b55104?w=500', plays: '15.6k' },
              ].map((reel, idx) => (
                <a
                  key={idx}
                  href="https://www.instagram.com/scleroproteins"
                  target="_blank"
                  rel="noreferrer"
                  className="reveal group relative block aspect-[4/5] overflow-hidden rounded-md border border-edge bg-[#1A1A1A]"
                >
                  <img
                    src={reel.url}
                    alt=""
                    className="h-full w-full object-cover opacity-80 transition-all duration-500 ease-out group-hover:scale-[1.04] group-hover:opacity-60"
                  />
                  <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/85 via-black/20 to-transparent p-5 text-white">
                    <div className="self-end rounded-xs bg-white/15 px-2.5 py-1 text-[9px] font-medium uppercase tracking-luxe backdrop-blur-md">
                      {reel.plays} views
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium leading-normal">{reel.title}</p>
                      <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-luxe text-[#C89838]">
                        <Instagram className="h-3.5 w-3.5" /> Watch reel
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Educational Blog Content */}
      <section id="blog" className="section bg-brand-bg">
        <div className="container-page">
          <div className="reveal mb-14 text-center">
            <span className="kicker">Science Library</span>
            <h2 className="text-heading-1 mt-3">Educational center</h2>
            <p className="mt-3 text-sm text-ink-secondary">Read clinical explanations and formulation insights on active nutrition</p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {initialBlogs.length > 0 ? (
              initialBlogs.map((b) => (
                <article key={b.slug} className="reveal group flex flex-col overflow-hidden rounded-md border border-edge bg-surface shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated">
                  {b.cover_image_url && (
                    <div className="h-44 overflow-hidden">
                      <img src={b.cover_image_url} alt="" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col justify-between space-y-3 p-6">
                    <div>
                      <h4 className="kicker !text-ink-accent">{b.author}</h4>
                      <h3 className="mt-2 font-display text-[19px] font-semibold leading-tight text-ink-primary">{b.title}</h3>
                      <p className="mt-2 text-xs leading-[1.7] text-ink-secondary line-clamp-3">{b.meta_description || b.content}</p>
                    </div>
                    <Link href={`/blog/${b.slug}`} className="flex items-center gap-1 text-[12px] font-medium text-ink-accent underline-offset-4 hover:underline">
                      Read Full Article <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </article>
              ))
            ) : (
              [
                { title: 'Understanding joint mobility nutrition', author: 'Dr. Marcus Vance', desc: 'How eggshell membrane peptides, glucosamine, and targeted vitamins coordinate inside the cartilage matrix.' },
                { title: 'Reading supplement labels with confidence', author: 'Sclero Advisory Board', desc: 'Identify fillers, decipher complex proprietary blends, and verify certificate of analysis tests.' },
                { title: 'Why cold-processing matters in protein', author: 'Dr. Evelyn Carter', desc: 'How heat denatures amino structures and why premium cold-processing preserves original active chains.' }
              ].map((b, idx) => (
                <article key={idx} className="reveal flex flex-col justify-between rounded-md border border-edge bg-surface p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated">
                  <div className="space-y-2">
                    <span className="kicker !text-ink-accent">{b.author}</span>
                    <h3 className="font-display text-[19px] font-semibold leading-tight text-ink-primary">{b.title}</h3>
                    <p className="text-xs leading-[1.7] text-ink-secondary">{b.desc}</p>
                  </div>
                  <Link href="/blog" className="mt-4 flex items-center gap-1 text-[12px] font-medium text-ink-accent underline-offset-4 hover:underline">
                    Read Article <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Wholesale & distributor inquiries */}
      <section id="wholesale" className="mx-auto max-w-4xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <div className="reveal relative overflow-hidden rounded-lg border border-edge bg-surface p-8 shadow-card md:p-10">
          <div className="relative mb-8 text-center">
            <span className="kicker">Partnerships</span>
            <h3 className="mt-3 font-display text-[26px] font-medium leading-tight text-ink-primary md:text-[30px]">
              Wholesale &amp; distributor inquiries
            </h3>
            <p className="mx-auto mt-2 max-w-md text-xs leading-[1.7] text-ink-secondary">
              Partner with Sclero Proteins for regional retail and distribution.
            </p>
          </div>

          {inquirySent ? (
            <div className="rounded-md border border-brand-success/20 bg-brand-success/5 p-6 text-center">
              <Check className="mx-auto mb-2 h-8 w-8 text-ink-success" />
              <p className="text-xs font-medium text-ink-success">
                Inquiry submitted — our team will follow up shortly.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleInquirySubmit}
              className="relative z-10 mx-auto max-w-md space-y-4"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="wholesale-name" className="sr-only">Your name</label>
                  <input
                    id="wholesale-name"
                    type="text"
                    placeholder="Your name"
                    autoComplete="name"
                    value={inquiryName}
                    onChange={(e) => setInquiryName(e.target.value)}
                    className="w-full rounded-sm border border-edge bg-surface p-3 text-xs text-ink-primary focus:border-ink-primary focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="wholesale-email" className="sr-only">Business email</label>
                  <input
                    id="wholesale-email"
                    type="email"
                    placeholder="Business email"
                    autoComplete="email"
                    value={inquiryEmail}
                    onChange={(e) => setInquiryEmail(e.target.value)}
                    className="w-full rounded-sm border border-edge bg-surface p-3 text-xs text-ink-primary focus:border-ink-primary focus:outline-none"
                    required
                  />
                </div>
              </div>
              <div>
                <label htmlFor="wholesale-message" className="sr-only">Distribution request details</label>
                <textarea
                  id="wholesale-message"
                  placeholder="Describe your distribution request..."
                  value={inquiryMessage}
                  onChange={(e) => setInquiryMessage(e.target.value)}
                  rows={3}
                  className="w-full rounded-sm border border-edge bg-surface p-3 text-xs text-ink-primary focus:border-ink-primary focus:outline-none"
                  required
                />
              </div>
              <button type="submit" className="btn-primary w-full py-3.5 text-sm">
                <Send className="h-4 w-4" />
                Submit request
              </button>
            </form>
          )}
        </div>
      </section>

      {/* Floating WhatsApp Button */}
      <a
        href={currentRegion === 'IN' ? 'https://wa.me/918047100000' : 'https://wa.me/442045740000'}
        target="_blank"
        rel="noreferrer"
        aria-label="Chat on WhatsApp"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110 active:scale-95 group focus:outline-none focus:ring-2 focus:ring-[#25D366]/50"
      >
        <svg className="h-7 w-7 fill-white" viewBox="0 0 24 24">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.324 5.328 0 11.859 0c3.166.001 6.141 1.233 8.378 3.469 2.237 2.235 3.469 5.211 3.468 8.378-.003 6.534-5.328 11.858-11.86 11.858-2.001 0-3.968-.507-5.714-1.478L0 24zm6.577-3.472l.409.243c1.517.901 3.254 1.377 5.023 1.378 5.437 0 9.859-4.422 9.863-9.863.002-2.635-1.023-5.113-2.884-6.975C17.186 3.45 14.705 2.427 12.07 2.425c-5.441 0-9.863 4.42-9.867 9.863-.001 1.83.479 3.618 1.39 5.131l.267.443-1.002 3.66 3.774-.994zM16.14 13.12c-.27-.135-1.602-.79-1.85-.88-.25-.09-.43-.135-.61.135-.18.27-.69.88-.84 1.05-.15.17-.3.19-.57.06-.27-.135-1.14-.42-2.17-1.34-.8-.71-1.34-1.6-1.5-1.87-.16-.27-.02-.42.11-.55.12-.12.27-.3.4-.45.13-.15.18-.25.27-.41.09-.17.05-.31-.02-.45-.07-.14-.61-1.47-.84-2.01-.22-.53-.48-.46-.66-.47-.17-.01-.37-.01-.57-.01-.2 0-.52.075-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.47 1.07 2.89 1.22 3.09.15.2 2.1 3.2 5.09 4.49.71.3 1.27.49 1.7.63.72.22 1.37.19 1.88.11.57-.08 1.6-.66 1.83-1.28.23-.61.23-1.14.16-1.28-.07-.14-.25-.22-.52-.35z"/>
        </svg>
        <span className="absolute right-16 scale-0 whitespace-nowrap rounded-sm bg-ink-primary px-3 py-1.5 text-[11px] font-medium text-white shadow-overlay transition-all group-hover:scale-100">
          Chat with us
        </span>
      </a>

    </StoreShell>
  );
}
