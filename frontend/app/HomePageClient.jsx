'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Link from 'next/link';
import {
  Check, Send, Sparkles, Star, ArrowRight,
  Shield, Brain, Zap, Activity, Users, Instagram,
  FileText, Award, Leaf, Sprout, Heart, Dumbbell,
  ShieldAlert, BookOpen, ChevronRight, HelpCircle
} from 'lucide-react';
import StoreShell from '../components/StoreShell';
import { addToCart } from '../store/cartSlice';
import { getApiUrl } from '../lib/api';
import { trackEvent } from '../utils/analytics';
import QuizComponent from '../components/QuizComponent';

export default function HomePageClient({ initialBlogs = [] }) {
  const dispatch = useDispatch();
  const currentRegion = useSelector((state) => state.region.currentRegion);
  const currencySymbol = useSelector((state) => state.region.currencySymbol);
  const branding = useSelector((state) => state.region.branding);
  const { session_id } = useSelector((state) => state.region);

  const [allProducts, setAllProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Inquiry Form
  const [inquiryName, setInquiryName] = useState('');
  const [inquiryEmail, setInquiryEmail] = useState('');
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [inquirySent, setInquirySent] = useState(false);
  const [cartOpenTrigger, setCartOpenTrigger] = useState(null);

  const whatsappNumber = currentRegion === 'IN'
    ? (branding?.whatsappNumberIN || '918047100000')
    : (branding?.whatsappNumberUK || '442045740000');

  useEffect(() => {
    if (!currentRegion) return;
    setLoadingProducts(true);
    fetch(getApiUrl(`/api/products/?region=${currentRegion}`))
      .then((res) => res.json())
      .then((data) => {
        setAllProducts(Array.isArray(data) ? data : []);
        setLoadingProducts(false);
      })
      .catch(() => {
        setAllProducts([]);
        setLoadingProducts(false);
      });
  }, [currentRegion]);

  // Map requested product titles to our database SKUs
  const targetProducts = useMemo(() => {
    const map = {
      'combo-collagen': allProducts.find(p => p.sku === 'COMBO-COLLAGEN-60'),
      'bjc': allProducts.find(p => p.sku === 'BJC-BONE-JOINT'),
      'calpure': allProducts.find(p => p.sku === 'CALPURE-60'),
      'soilpro': allProducts.find(p => p.sku === 'SOILPRO-1KG'),
      'lawncal': allProducts.find(p => p.sku === 'LAWNCAL-25KG'),
    };
    return map;
  }, [allProducts]);

  const handleAddToCart = (product) => {
    dispatch(
      addToCart({
        session_id,
        region: currentRegion,
        product_id: product.id,
        quantity: 1,
      })
    );
    trackEvent('AddToCart', {
      content_ids: [product.sku],
      value: product.price,
      currency: currentRegion === 'IN' ? 'INR' : 'GBP',
    });
    setCartOpenTrigger(Date.now());
  };

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
      {/* SECTION 1: HERO SECTION */}
      <section className="relative overflow-hidden border-b border-edge bg-brand-bg py-20 md:py-32">
        <div className="absolute inset-0 opacity-5 bg-[radial-gradient(#C89838_1px,transparent_1px)] [background-size:16px_16px]"></div>
        <div className="container-page relative text-center">
          <span className="kicker mb-3 inline-flex items-center gap-1.5 rounded-full border border-edge bg-surface px-3 py-1 font-semibold text-brand-muted">
            <Sparkles className="h-3 w-3 text-brand-accent animate-pulse" />
            Bioactive Eggshell Ingredient Platform
          </span>
          <h1 className="text-display mx-auto max-w-4xl tracking-tight text-ink-primary">
            Advanced Eggshell Collagen &amp; Calcium Solutions
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[15px] font-medium leading-[1.8] text-ink-secondary">
            Human Nutrition • Agriculture • Bulk Ingredients • OvoMatrix Technology
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/nutrition" className="btn-primary px-8 py-3.5 text-sm font-semibold tracking-wide shadow-lg">
              Shop Sclero Nutrition
            </Link>
            <Link href="/ovomatrix" className="btn-ghost px-8 py-3.5 text-sm font-semibold tracking-wide hover:border-ink-primary">
              Explore OvoMatrix Solutions
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 2: PRODUCT STRIP (5 SKUs) */}
      <section className="border-b border-edge bg-surface py-12">
        <div className="container-page">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-brand-muted">Core Formulations</h2>
            <Link href="/products" className="text-xs font-semibold text-ink-accent hover:underline flex items-center gap-1">
              View All Products <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="flex gap-6 overflow-x-auto pb-4 scrollbar-thin">
            {['combo-collagen', 'bjc', 'calpure', 'soilpro', 'lawncal'].map((key) => {
              const p = targetProducts[key];
              if (!p) return null;
              return (
                <div key={p.id} className="w-72 shrink-0 rounded-md border border-edge bg-surface p-5 shadow-card hover:border-edge-strong transition-all duration-300">
                  <div className="aspect-square w-full overflow-hidden rounded-sm bg-surface-muted mb-4 flex items-center justify-center">
                    {p.media?.[0]?.file_url ? (
                      <img src={p.media[0].file_url} alt={p.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="text-ink-muted text-[10px] uppercase font-bold">Sclero {key}</div>
                    )}
                  </div>
                  <h3 className="font-display text-sm font-bold text-ink-primary line-clamp-1">{p.name}</h3>
                  <p className="mt-1 text-[11px] text-ink-muted leading-relaxed line-clamp-2">{p.short_benefit || p.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs font-bold text-ink-primary">
                      {currencySymbol}{parseFloat(p.promotional_price || p.price).toFixed(2)}
                    </span>
                    <div className="flex gap-2">
                      <Link href={key === 'soilpro' || key === 'lawncal' ? `/ovomatrix/${key}` : `/nutrition/${key}`} className="rounded border border-edge px-2.5 py-1 text-[10px] font-semibold text-ink-primary hover:bg-surface-muted">
                        View
                      </Link>
                      <button onClick={() => handleAddToCart(p)} className="rounded bg-ink-primary px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-ink-secondary">
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* SECTION 3: OVOMATRIX — CORE TECHNOLOGY */}
      <section className="section border-b border-edge bg-brand-bg relative overflow-hidden">
        <div className="container-page">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
            <div className="space-y-6">
              <span className="kicker">Core Technology</span>
              <h2 className="text-heading-1">The Science Behind Every Sclero Product</h2>
              <p className="text-sm leading-[1.8] text-ink-secondary">
                OvoMatrix is our natural eggshell derived ingredient platform delivering minerals, proteins, and bioactives. By combining active proteins with essential mineral co-factors in their native ratio, we preserve the natural synergy of structural proteins essential for joint, skin, and soil health.
              </p>
              <div className="pt-2">
                <Link href="/ovomatrix" className="btn-primary inline-flex items-center gap-1.5 px-6 py-3 text-xs font-semibold">
                  Learn About OvoMatrix <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
            <div className="rounded-lg border border-edge bg-surface p-8 shadow-card flex flex-col justify-center text-center max-w-md mx-auto">
              <Sprout className="h-10 w-10 text-brand-accent mx-auto mb-4" />
              <h3 className="font-display text-lg font-bold text-ink-primary mb-2">100% Traceable Sourcing</h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                Every micro-gram of our OvoMatrix powder is tracked from source validation to micronization and packing under clinical quality standards.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: HUMAN NUTRITION */}
      <section className="section border-b border-edge bg-surface">
        <div className="container-page text-center">
          <div className="mb-12">
            <span className="kicker">Sclero Nutrition</span>
            <h2 className="text-heading-1 mt-3">Premium Collagen &amp; Calcium for Daily Wellness</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-ink-secondary">
              Nourish your structural health with single-source eggshell collagen and mineral matrices.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 text-left">
            {['combo-collagen', 'bjc', 'calpure'].map((key) => {
              const p = targetProducts[key];
              if (!p) return null;
              return (
                <div key={p.id} className="rounded-md border border-edge bg-brand-bg p-6 shadow-card flex flex-col justify-between hover:-translate-y-1 transition-all duration-300">
                  <div>
                    <div className="aspect-video w-full rounded bg-surface-muted mb-4 overflow-hidden flex items-center justify-center">
                      {p.media?.[0]?.file_url ? (
                        <img src={p.media[0].file_url} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <Heart className="h-8 w-8 text-brand-accent" />
                      )}
                    </div>
                    <h3 className="font-display text-base font-bold text-ink-primary">{p.name}</h3>
                    <p className="mt-2 text-xs text-ink-secondary leading-relaxed line-clamp-3">{p.description}</p>
                  </div>
                  <div className="mt-6 flex items-center justify-between pt-4 border-t border-edge-subtle">
                    <span className="text-xs font-bold text-ink-primary">
                      {currencySymbol}{parseFloat(p.promotional_price || p.price).toFixed(2)}
                    </span>
                    <Link href={`/nutrition/${key}`} className="text-xs font-semibold text-brand-muted hover:underline flex items-center gap-0.5">
                      Explore Product <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-12">
            <Link href="/nutrition" className="btn-ghost px-8 py-3.5 text-xs font-semibold">
              Explore Sclero Nutrition
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 5: SOIL & TURF CONDITIONING */}
      <section className="section border-b border-edge bg-brand-bg">
        <div className="container-page text-center">
          <div className="mb-12">
            <span className="kicker">OvoMatrix Solutions</span>
            <h2 className="text-heading-1 mt-3">Advanced Eggshell Calcium for Soil &amp; Turf</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-ink-secondary">
              High-purity bio-mineral conditioners to improve structure, water retention, and root growth without chemicals.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 text-left max-w-4xl mx-auto">
            {['soilpro', 'lawncal'].map((key) => {
              const p = targetProducts[key];
              if (!p) return null;
              return (
                <div key={p.id} className="rounded-md border border-edge bg-surface p-6 shadow-card flex flex-col justify-between hover:-translate-y-1 transition-all duration-300">
                  <div>
                    <div className="aspect-video w-full rounded bg-surface-muted mb-4 overflow-hidden flex items-center justify-center">
                      {p.media?.[0]?.file_url ? (
                        <img src={p.media[0].file_url} alt={p.name} className="h-full w-full object-cover" />
                      ) : (
                        <Leaf className="h-8 w-8 text-brand-accent" />
                      )}
                    </div>
                    <h3 className="font-display text-base font-bold text-ink-primary">{p.name}</h3>
                    <p className="mt-2 text-xs text-ink-secondary leading-relaxed line-clamp-3">{p.description}</p>
                  </div>
                  <div className="mt-6 flex items-center justify-between pt-4 border-t border-edge-subtle">
                    <span className="text-xs font-bold text-ink-primary">
                      {currencySymbol}{parseFloat(p.promotional_price || p.price).toFixed(2)}
                    </span>
                    <Link href={`/ovomatrix/${key}`} className="text-xs font-semibold text-brand-muted hover:underline flex items-center gap-0.5">
                      Explore Product <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-12">
            <Link href="/ovomatrix" className="btn-ghost px-8 py-3.5 text-xs font-semibold">
              Explore OvoMatrix Solutions
            </Link>
          </div>
        </div>
      </section>

      {/* Quiz Section */}
      <section className="section border-y border-edge bg-surface-muted">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <span className="kicker">Personalized Wellness</span>
            <h2 className="text-heading-1 mt-3">Not sure where to start?</h2>
            <p className="mt-3 text-sm text-ink-secondary">
              Take our 4-question quiz to find the perfect collagen or supplement for your goals
            </p>
          </div>

          <QuizComponent
            onComplete={(result) => {
              const catMap = {
                'COMBO-COLLAGEN-60': 'nutrition/combo-collagen',
                'BJC-BONE-JOINT': 'nutrition/bjc',
                'CALPURE-60': 'nutrition/calpure',
                'SOILPRO-1KG': 'ovomatrix/soilpro',
                'LAWNCAL-25KG': 'ovomatrix/lawncal'
              };
              const route = catMap[result.recommendation.sku] || `products/${result.recommendation.sku}`;
              window.location.href = `/${route}`;
            }}
          />
        </div>
      </section>

      {/* SECTION 6: SCIENCE */}
      <section className="section border-b border-edge bg-surface">
        <div className="container-page text-center">
          <div className="mb-12">
            <span className="kicker">R&amp;D Platform</span>
            <h2 className="text-heading-1 mt-3">Backed by Research. Driven by Bioactive Science.</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-ink-secondary">
              Discover the molecular composition and clinically tested benefits behind our purified eggshell inputs.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 text-left">
            {[
              { title: 'Collagen Types I, V, X', desc: 'Preserves critical multi-type structural proteins essential for joint and dermis matrices.', slug: 'collagen' },
              { title: 'Eggshell Membrane Bioactives', desc: 'Naturally contains rich glycosaminoglycans (GAGs), elastin, and structural peptide chains.', slug: 'eggshell' },
              { title: 'Calcium Bioavailability', desc: 'Highly soluble, non-synthetic calcium carbonate that dissolves steadily without stomach fatigue.', slug: 'calcium' },
              { title: 'Clinical Evidence', desc: 'Backed by peer-reviewed human trials and agronomic research assessing structural wellness and soil health.', slug: 'clinical' },
            ].map((s) => (
              <div key={s.slug} className="rounded-md border border-edge bg-brand-bg p-6 shadow-card flex flex-col justify-between hover:border-edge-strong transition-all duration-300">
                <div>
                  <h3 className="font-display text-sm font-bold text-ink-primary mb-2">{s.title}</h3>
                  <p className="text-xs text-ink-secondary leading-relaxed">{s.desc}</p>
                </div>
                <Link href={`/science/${s.slug}`} className="mt-6 text-xs font-semibold text-brand-muted hover:underline flex items-center gap-0.5">
                  Read Science <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-12">
            <Link href="/science" className="btn-ghost px-8 py-3.5 text-xs font-semibold">
              Explore Science
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 7: APPLICATIONS */}
      <section className="section border-b border-edge bg-brand-bg">
        <div className="container-page text-center">
          <div className="mb-12">
            <span className="kicker">Multi-Industry Solutions</span>
            <h2 className="text-heading-1 mt-3">Solutions for Multiple Industries</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-ink-secondary">
              OvoMatrix technology provides scalable applications from consumer nutrition to commercial agriculture.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6 text-center">
            {[
              { name: 'Human Nutrition', icon: Heart, slug: 'human' },
              { name: 'Skin & Joint Health', icon: Activity, slug: 'skin-joint' },
              { name: 'Sports & Recovery', icon: Dumbbell, slug: 'sports' },
              { name: 'Pet Nutrition', icon: Brain, slug: 'pet' },
              { name: 'Agriculture & Soil', icon: Sprout, slug: 'agriculture' },
              { name: 'Food Fortification', icon: Shield, slug: 'food-beverage' },
            ].map((app) => {
              const Icon = app.icon;
              return (
                <Link key={app.slug} href={`/applications/${app.slug}`} className="group rounded-md border border-edge bg-surface p-5 shadow-card hover:border-edge-strong transition-all duration-300">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded bg-surface-muted text-ink-accent group-hover:scale-105 transition-transform">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-primary leading-tight line-clamp-2">
                    {app.name}
                  </h3>
                </Link>
              );
            })}
          </div>

          <div className="mt-12">
            <Link href="/applications" className="btn-ghost px-8 py-3.5 text-xs font-semibold">
              View All Applications
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 8: RESOURCES */}
      <section className="section border-b border-edge bg-surface">
        <div className="container-page text-center">
          <div className="mb-12">
            <span className="kicker">Compliance &amp; Downloads</span>
            <h2 className="text-heading-1 mt-3">Technical Documents &amp; Compliance</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-ink-secondary">
              Access specification sheets, certificates of analysis, and technical whitepapers.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5 text-left max-w-5xl mx-auto">
            {[
              { title: 'COA Samples', desc: 'Third-party certified batch analysis report sheets.', slug: 'coa' },
              { title: 'Product Spec Sheets', desc: 'Granulation sizes, solubility indexes, and purity sheets.', slug: 'spec-sheets' },
              { title: 'Whitepapers', desc: 'Peer-reviewed studies on eggshell bioactives.', slug: 'whitepapers' },
              { title: 'Wholesale Catalogue', desc: 'Standard bulk supply options and packaging metrics.', slug: 'catalogue' },
              { title: 'FAQs', desc: 'General compliance, allergens, and safety queries answered.', slug: 'faq' },
            ].map((res) => (
              <div key={res.slug} className="rounded border border-edge bg-brand-bg p-5 shadow-card flex flex-col justify-between hover:border-edge-strong transition-all duration-300">
                <div>
                  <FileText className="h-6 w-6 text-brand-muted mb-3" />
                  <h3 className="text-xs font-bold text-ink-primary mb-1.5">{res.title}</h3>
                  <p className="text-[10px] text-ink-secondary leading-relaxed line-clamp-3">{res.desc}</p>
                </div>
                <Link href={`/resources/${res.slug}`} className="mt-4 text-[10px] font-semibold text-brand-muted hover:underline flex items-center gap-0.5">
                  Download <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-12">
            <Link href="/resources" className="btn-ghost px-8 py-3.5 text-xs font-semibold">
              Download Resources
            </Link>
          </div>
        </div>
      </section>

      {/* SECTION 9: ABOUT & CONTACT */}
      <section className="section border-b border-edge bg-brand-bg">
        <div className="container-page">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
            <div className="space-y-6">
              <span className="kicker">About Sclero Proteins</span>
              <h2 className="text-heading-1">UK–India Operations. Global Standards.</h2>
              <p className="text-sm leading-[1.8] text-ink-secondary">
                Sclero Proteins Ltd operates premium purification and shipping hubs in Haywards Heath (UK) and Anand, Gujarat (India). This supports localized pricing, prompt shipping, and complete regional tax compliance.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded border border-edge bg-surface p-4">
                  <h4 className="text-xs font-bold text-ink-primary mb-1">Manufacturing</h4>
                  <p className="text-[10px] text-ink-muted">Processed in pharmaceutical-grade GMP certified facilities.</p>
                </div>
                <div className="rounded border border-edge bg-surface p-4">
                  <h4 className="text-xs font-bold text-ink-primary mb-1">Quality Controls</h4>
                  <p className="text-[10px] text-ink-muted">Rigorous heavy metals and microbial screening on every batch.</p>
                </div>
                <div className="rounded border border-edge bg-surface p-4">
                  <h4 className="text-xs font-bold text-ink-primary mb-1">Certifications</h4>
                  <p className="text-[10px] text-ink-muted">Aligns with UK General Product Safety and export rules.</p>
                </div>
                <div className="rounded border border-edge bg-surface p-4">
                  <h4 className="text-xs font-bold text-ink-primary mb-1">Sustainability</h4>
                  <p className="text-[10px] text-ink-muted">Upcycling natural eggshell bypass products to limit landfill waste.</p>
                </div>
              </div>

              <div className="pt-2">
                <Link href="/contact" className="btn-primary inline-flex items-center gap-1.5 px-6 py-3 text-xs font-semibold">
                  Contact Us / Become a Distributor <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Wholesale Inquiry Card inside Section 9 */}
            <div className="rounded-lg border border-edge bg-surface p-8 shadow-card max-w-md mx-auto w-full">
              <h3 className="font-display text-lg font-bold text-ink-primary mb-2 text-center">Distributor Enquiries</h3>
              <p className="text-xs text-ink-secondary mb-6 text-center leading-relaxed">
                Interested in stocking Sclero products or licensing OvoMatrix bulk ingredients? Submit our form.
              </p>
              
              {inquirySent ? (
                <div className="rounded border border-brand-success/20 bg-brand-success/5 p-4 text-center">
                  <Check className="mx-auto mb-1 h-6 w-6 text-ink-success" />
                  <p className="text-[11px] font-semibold text-ink-success">
                    Inquiry submitted. Our operations team will follow up.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleInquirySubmit} className="space-y-4">
                  <div>
                    <label htmlFor="name-input" className="sr-only">Full Name</label>
                    <input id="name-input" type="text" placeholder="Your name" value={inquiryName} onChange={(e) => setInquiryName(e.target.value)} className="w-full rounded border border-edge p-2.5 text-xs text-ink-primary focus:border-ink-primary focus:outline-none" required />
                  </div>
                  <div>
                    <label htmlFor="email-input" className="sr-only">Business Email</label>
                    <input id="email-input" type="email" placeholder="Business email" value={inquiryEmail} onChange={(e) => setInquiryEmail(e.target.value)} className="w-full rounded border border-edge p-2.5 text-xs text-ink-primary focus:border-ink-primary focus:outline-none" required />
                  </div>
                  <div>
                    <label htmlFor="message-input" className="sr-only">Details</label>
                    <textarea id="message-input" placeholder="Message details..." value={inquiryMessage} onChange={(e) => setInquiryMessage(e.target.value)} rows={3} className="w-full rounded border border-edge p-2.5 text-xs text-ink-primary focus:border-ink-primary focus:outline-none" required />
                  </div>
                  <button type="submit" className="w-full btn-primary py-2.5 text-xs font-semibold">
                    Submit Request
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Floating WhatsApp Button */}
      <a
        href={`https://wa.me/${whatsappNumber.replace(/[^+\d]/g, '')}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Chat on WhatsApp"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-110 active:scale-95 group focus:outline-none focus:ring-2 focus:ring-[#25D366]/50"
      >
        <svg className="h-7 w-7 fill-white" viewBox="0 0 24 24">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.324 5.328 0 11.859 0c3.166.001 6.141 1.233 8.378 3.469 2.237 2.235 3.469 5.211 3.468 8.378-.003 6.534-5.328 11.858-11.86 11.858-2.001 0-3.968-.507-5.714-1.478L0 24zm6.577-3.472l.409.243c1.517.901 3.254 1.377 5.023 1.378 5.437 0 9.859-4.422 9.863-9.863.002-2.635-1.023-5.113-2.884-6.975C17.186 3.45 14.705 2.427 12.07 2.425c-5.441 0-9.863 4.42-9.867 9.863-.001 1.83.479 3.618 1.39 5.131l.267.443-1.002 3.66 3.774-.994zM16.14 13.12c-.27-.135-1.602-.79-1.85-.88-.25-.09-.43-.135-.61.135-.18.27-.69.88-.84 1.05-.15.17-.3.19-.57.06-.27-.135-1.14-.42-2.17-1.34-.8-.71-1.34-1.6-1.5-1.87-.16-.27-.02-.42.11-.55.12-.12.27-.3.4-.45.13-.15.18-.25.27-.41.09-.17.05-.31-.02-.45-.07-.14-.61-1.47-.84-2.01-.22-.53-.48-.46-.66-.47-.17-.01-.37-.01-.57-.01-.2 0-.52.075-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.47 1.07 2.89 1.22 3.09.15.2 2.1 3.2 5.09 4.49.71.3 1.27.49 1.7.63.72.22 1.37.19 1.88.11.57-.08 1.6-.66 1.83-1.28.23-.61.23-1.14.16-1.28-.07-.14-.25-.22-.52-.35z"/>
        </svg>
        <span className="absolute right-16 scale-0 whitespace-nowrap rounded bg-ink-primary px-3 py-1.5 text-[11px] font-medium text-white shadow-overlay transition-all group-hover:scale-100">
          Chat with us
        </span>
      </a>
    </StoreShell>
  );
}
