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
  { name: 'Immunity', slug: 'immunity', icon: Shield, desc: 'Immune defence support', color: 'bg-emerald-50 text-emerald-600' },
  { name: 'Sleep & Relax', slug: 'sleep', icon: Brain, desc: 'Stress & sleep recovery', color: 'bg-indigo-50 text-indigo-600' },
  { name: 'Energy & Vitality', slug: 'energy', icon: Zap, desc: 'Mitigate daily fatigue', color: 'bg-amber-50 text-amber-600' },
  { name: 'Gut Health', slug: 'gut', icon: Activity, desc: 'Bioactive microbiome', color: 'bg-rose-50 text-rose-600' },
  { name: 'Men\'s Health', slug: 'men', icon: Users, desc: 'Hormonal & physical support', color: 'bg-blue-50 text-blue-600' },
  { name: 'Women\'s Health', slug: 'women', icon: Users, desc: 'Bone density & balance', color: 'bg-pink-50 text-pink-600' },
  { name: 'Skin & Hair', slug: 'collagen', icon: Sparkles, desc: 'Dermatological synthesis', color: 'bg-purple-50 text-brand-purple' },
  { name: 'Fitness & Muscle', slug: 'fitness', icon: Activity, desc: 'Muscle synthesis & repair', color: 'bg-teal-50 text-teal-600' },
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

      {/* Quiet customer-count trust strip */}
      <div className="bg-slate-50/80 border-b border-slate-200/60">
        <div className="container-page py-3">
          <p className="text-center text-[11px] sm:text-xs text-brand-muted font-medium">
            Trusted by <span className="font-bold text-brand-navy">{SOCIAL_PROOF.customers}</span> customers worldwide
            <span className="mx-2 text-slate-300">·</span>
            <span className="font-bold text-brand-navy">{SOCIAL_PROOF.servings}</span> servings delivered
            <span className="mx-2 text-slate-300">·</span>
            <span className="font-bold text-brand-navy">{SOCIAL_PROOF.rating}★</span> average across {SOCIAL_PROOF.reviewCount} reviews
          </p>
        </div>
      </div>

      {/* Shop by Goal Section */}
      <section className="section bg-white">
        <div className="container-page">
          <div className="mb-10 text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-purple">Targeted Actives</span>
            <h2 className="text-3xl font-black text-brand-navy tracking-tight mt-1">Shop by Health Goal</h2>
            <p className="text-sm text-brand-muted mt-2">Filter Sclero formulations to match your daily wellness goals</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {HEALTH_GOALS.map((goal, idx) => {
              const Icon = goal.icon;
              return (
                <Link
                  key={idx}
                  href={`/products?q=${goal.slug}`}
                  className="glass-panel glass-panel-hover rounded-2xl p-5 flex flex-col justify-between h-36 transition-all group"
                >
                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${goal.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-brand-navy uppercase tracking-wider group-hover:text-brand-purple transition-colors">
                      {goal.name}
                    </h3>
                    <p className="text-[10px] text-brand-muted mt-1 leading-snug">{goal.desc}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Quiz Section */}
      <section className="section bg-slate-50/50 border-y border-slate-200/60">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-purple">Personalized Wellness</span>
            <h2 className="text-2xl font-black text-brand-navy mt-1">Not sure where to start?</h2>
            <p className="text-sm text-brand-muted mt-2">
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
      <section className="section bg-slate-50 border-y border-slate-200/60">
        <div className="container-page">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-purple">Scientific Integrity</span>
                <h2 className="text-3xl font-black text-brand-navy mt-2 leading-tight">Advanced Biochemistry for Bio-Active Absorption</h2>
                <p className="text-sm text-brand-muted mt-4 leading-relaxed">
                  Our formulations are constructed by molecular biologists to solve a core supplementation issue: bioavailability. By combining active proteins with essential co-factors, we ensure active ingredients cross cellular membranes efficiently instead of being degraded by digestive acids.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-6 mt-8">
                <div className="space-y-1">
                  <div className="text-sm font-black text-brand-navy flex items-center gap-1.5 uppercase tracking-wide">
                    <span className="h-2 w-2 rounded-full bg-brand-purple animate-pulse" />
                    Zero Fillers
                  </div>
                  <p className="text-xs text-brand-muted leading-relaxed">No silica, stearates, or synthetic binders. Just 100% active, bio-available ingredients.</p>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-black text-brand-navy flex items-center gap-1.5 uppercase tracking-wide">
                    <span className="h-2 w-2 rounded-full bg-brand-purple animate-pulse" />
                    Lab Checked
                  </div>
                  <p className="text-xs text-brand-muted leading-relaxed">Every batch undergoes rigorous independent analysis to guarantee purity and composition.</p>
                </div>
              </div>
            </div>
            <div className="relative rounded-3xl overflow-hidden shadow-lg border border-slate-200/80 aspect-video lg:aspect-square bg-slate-100 flex items-center justify-center group">
              <img
                src="https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=800"
                alt="Clinical laboratory research"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/80 via-brand-navy/20 to-transparent flex items-end p-6">
                <p className="text-xs font-semibold text-white/90 leading-relaxed">
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
      <section className="section bg-white border-b border-slate-200/60">
        <div className="container-page">
          <div className="text-center mb-12">
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-purple">Core Pillars</span>
            <h2 className="text-3xl font-black text-brand-navy mt-1">The Sclero Standard</h2>
            <p className="text-sm text-brand-muted mt-2">Every supplement we release meets strict quality and safety thresholds</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 border border-slate-200/60 rounded-3xl bg-slate-50/50 hover:border-brand-purple/20 transition-all text-center group">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-violet-50 text-brand-purple flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="text-base font-black text-brand-navy mb-2">GMP Certified Manufacturing</h3>
              <p className="text-xs text-brand-muted leading-relaxed">All products are synthesized in state-of-the-art certified facilities in the UK and Europe under strict pharmaceutical conditions.</p>
            </div>
            <div className="p-6 border border-slate-200/60 rounded-3xl bg-slate-50/50 hover:border-brand-purple/20 transition-all text-center group">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-base font-black text-brand-navy mb-2">Cold-Processed Peptides</h3>
              <p className="text-xs text-brand-muted leading-relaxed">We use low-temperature extraction technology to keep collagen and protein chains intact, preserving original active enzymes.</p>
            </div>
            <div className="p-6 border border-slate-200/60 rounded-3xl bg-slate-50/50 hover:border-brand-purple/20 transition-all text-center group">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 transition-transform group-hover:scale-110">
                <Check className="h-6 w-6" />
              </div>
              <h3 className="text-base font-black text-brand-navy mb-2">Absolute Label Honesty</h3>
              <p className="text-xs text-brand-muted leading-relaxed">No proprietary blends with hidden ingredients. We disclose the exact milligram weight of every compound on the label.</p>
            </div>
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

      <div className="container-page pb-16 text-center">
        <Link
          href="/products"
          className="inline-flex rounded-full border border-slate-200 bg-white px-8 py-3 text-xs font-bold uppercase tracking-wider text-brand-purple transition-all hover:border-brand-purple hover:bg-brand-purple/[0.02]"
        >
          Browse full catalog →
        </Link>
      </div>

      {/* Social Proof (Customer Testimonials) */}
      <section className="bg-slate-50 py-16 border-y border-slate-200/60">
        <div className="container-page">
          <div className="mb-10 text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-purple">Customer Reviews</span>
            <h2 className="text-3xl font-black text-brand-navy tracking-tight mt-1">Verified Trust</h2>
            <p className="text-sm text-brand-muted mt-2">What our wellness community says about Sclero Proteins</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex mb-3">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} className="h-4.5 w-4.5 fill-brand-orange text-brand-orange" />
                    ))}
                  </div>
                  <p className="text-xs md:text-sm leading-relaxed text-brand-muted mb-4 italic">"{t.text}"</p>
                </div>
                <div className="flex justify-between items-center border-t border-slate-100 pt-3.5">
                  <div>
                    <h4 className="text-xs font-bold text-brand-navy">{t.name}</h4>
                    <p className="text-[10px] text-brand-muted">{t.role}</p>
                  </div>
                  <span className="text-[9px] font-bold text-brand-purple bg-brand-purple/5 px-2.5 py-1 rounded-xl">
                    {t.product}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Instagram Reels Section */}
      <section className="section bg-slate-50 border-y border-slate-200/60">
        <div className="container-page">
          <div className="mb-10 text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-purple">Social Feed</span>
            <h2 className="text-3xl font-black text-brand-navy tracking-tight mt-1">Latest from Instagram</h2>
            <p className="text-sm text-brand-muted mt-2">Follow our community @scleroproteins for daily fitness and joint care insights</p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Live Instagram Feed Iframe */}
            <div className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-4 shadow-xs">
              <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl bg-slate-50 flex flex-col items-center justify-center text-center p-6 border border-slate-100">
                <iframe
                  src="https://www.instagram.com/scleroproteins/embed"
                  className="w-full h-full absolute inset-0 rounded-2xl border-0"
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
                  className="group relative overflow-hidden rounded-3xl border border-slate-200/80 aspect-[4/5] bg-slate-900 block"
                >
                  <img
                    src={reel.url}
                    alt=""
                    className="h-full w-full object-cover opacity-80 transition-transform duration-300 group-hover:scale-105 group-hover:opacity-60"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent flex flex-col justify-between p-5 text-white">
                    <div className="self-end rounded-full bg-white/20 backdrop-blur-md px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider">
                      {reel.plays} views
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold leading-normal">{reel.title}</p>
                      <span className="text-[10px] font-extrabold uppercase text-brand-purple tracking-widest flex items-center gap-1">
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
      <section id="blog" className="py-16 bg-white">
        <div className="container-page">
          <div className="mb-10 text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-purple">Science Library</span>
            <h2 className="text-3xl font-black text-brand-navy tracking-tight mt-1">Educational Center</h2>
            <p className="text-sm text-brand-muted mt-2">Read clinical explanations and formulation insights on active nutrition</p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {initialBlogs.length > 0 ? (
              initialBlogs.map((b) => (
                <article key={b.slug} className="glass-panel rounded-3xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col">
                  {b.cover_image_url && (
                    <div className="h-44 overflow-hidden">
                      <img src={b.cover_image_url} alt="" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <h4 className="text-xs font-bold text-brand-purple uppercase tracking-wider">{b.author}</h4>
                      <h3 className="text-sm font-black text-brand-navy leading-tight mt-1">{b.title}</h3>
                      <p className="text-xs text-brand-muted leading-relaxed mt-2 line-clamp-3">{b.meta_description || b.content}</p>
                    </div>
                    <Link href={`/blog/${b.slug}`} className="text-[11px] font-bold text-brand-purple hover:underline flex items-center gap-1">
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
                <article key={idx} className="glass-panel rounded-3xl p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-brand-purple">{b.author}</span>
                    <h3 className="text-sm font-black text-brand-navy leading-tight">{b.title}</h3>
                    <p className="text-xs text-brand-muted leading-relaxed">{b.desc}</p>
                  </div>
                  <Link href="/blog" className="text-[11px] font-bold text-brand-purple hover:underline flex items-center gap-1 mt-4">
                    Read Article <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </article>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Wholesale & distributor inquiries */}
      <section id="wholesale" className="mx-auto max-w-4xl px-4 py-16 md:py-24 sm:px-6 lg:px-8">
        <div className="glass-panel relative overflow-hidden rounded-3xl border border-slate-200 p-8 bg-white">
          <div className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-brand-purple/5 blur-3xl" />

          <div className="relative mb-6 text-center">
            <h3 className="text-lg font-black uppercase tracking-wider text-brand-navy">
              Wholesale &amp; distributor inquiries
            </h3>
            <p className="mx-auto max-w-md text-xs text-brand-muted">
              Partner with Sclero Proteins for regional retail and distribution.
            </p>
          </div>

          {inquirySent ? (
            <div className="rounded-2xl border border-brand-success/20 bg-brand-success/5 p-6 text-center">
              <Check className="mx-auto mb-2 h-8 w-8 text-brand-success" />
              <p className="text-xs font-bold text-brand-success">
                Inquiry submitted — our team will follow up shortly.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleInquirySubmit}
              className="relative z-10 mx-auto max-w-md space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="wholesale-name" className="sr-only">Your name</label>
                  <input
                    id="wholesale-name"
                    type="text"
                    placeholder="Your name"
                    autoComplete="name"
                    value={inquiryName}
                    onChange={(e) => setInquiryName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-brand-navy focus:border-brand-purple focus:outline-none"
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
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-brand-navy focus:border-brand-purple focus:outline-none"
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
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-brand-navy focus:border-brand-purple focus:outline-none"
                  required
                />
              </div>
              <button type="submit" className="btn-primary w-full py-3.5 text-xs uppercase tracking-wider">
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
        <span className="absolute right-16 scale-0 rounded bg-brand-navy px-3 py-1.5 text-[11px] font-bold text-white shadow-md transition-all group-hover:scale-100 whitespace-nowrap">
          Chat with us
        </span>
      </a>

    </StoreShell>
  );
}
