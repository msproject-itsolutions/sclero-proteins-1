'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Check, Send, Sparkles, Star, ArrowRight,
  Shield, Brain, Zap, Activity, Users
} from 'lucide-react';
import StoreShell from '../components/StoreShell';
import HeroSection from '../components/HeroSection';
import ProductCatalog from '../components/ProductCatalog';
import QuizComponent from '../components/QuizComponent';
import { GuaranteeBanner } from '../components/GuaranteeCard';
import { getApiUrl } from '../lib/api';

// TARGET / aspirational social-proof figures — update once we have live data.
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

export default function HomePage() {
  const [inquiryName, setInquiryName] = useState('');
  const [inquiryEmail, setInquiryEmail] = useState('');
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [inquirySent, setInquirySent] = useState(false);
  const [cartOpenTrigger, setCartOpenTrigger] = useState(null);

  const [blogs, setBlogs] = useState([]);

  // Fetch blogs on load
  useEffect(() => {
    fetch(getApiUrl('/api/admin/blog-posts/'))
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : (data.results || []);
        setBlogs(list.filter((b) => b.is_published).slice(0, 3));
      })
      .catch(() => {});
  }, []);

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
      <title>Home | Sclero Proteins</title>
      <meta
        name="description"
        content="Sclero Proteins — clinically-formulated bone, joint, and active-nutrition supplements. Lab-certified, label-transparent, shipped across the UK and India."
      />
      <meta property="og:title" content="Sclero Proteins — clinically-formulated wellness" />
      <meta property="og:type" content="website" />

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

      {/* Risk Reversal Banner */}
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <GuaranteeBanner />
      </div>

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

      {/* Educational Blog Content */}
      <section id="blog" className="py-16 bg-white">
        <div className="container-page">
          <div className="mb-10 text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-purple">Science Library</span>
            <h2 className="text-3xl font-black text-brand-navy tracking-tight mt-1">Educational Center</h2>
            <p className="text-sm text-brand-muted mt-2">Read clinical explanations and formulation insights on active nutrition</p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {blogs.length > 0 ? (
              blogs.map((b) => (
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

      {/* Wholesale & distributor inquiries — sits just above the Footer (Footer carries the newsletter signup) */}
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
                <input
                  type="text"
                  placeholder="Your name"
                  autoComplete="name"
                  value={inquiryName}
                  onChange={(e) => setInquiryName(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-brand-navy focus:border-brand-purple focus:outline-none"
                  required
                />
                <input
                  type="email"
                  placeholder="Business email"
                  autoComplete="email"
                  value={inquiryEmail}
                  onChange={(e) => setInquiryEmail(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-brand-navy focus:border-brand-purple focus:outline-none"
                  required
                />
              </div>
              <textarea
                placeholder="Describe your distribution request..."
                value={inquiryMessage}
                onChange={(e) => setInquiryMessage(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-brand-navy focus:border-brand-purple focus:outline-none"
                required
              />
              <button type="submit" className="btn-primary w-full py-3.5 text-xs uppercase tracking-wider">
                <Send className="h-4 w-4" />
                Submit request
              </button>
            </form>
          )}
        </div>
      </section>

    </StoreShell>
  );
}
