'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import Link from 'next/link';
import {
  Heart, Sprout, Brain, Shield, Activity, Dumbbell,
  Sparkles, Award, FileText, ChevronRight, Download,
  CheckCircle2, Info, Landmark, HelpCircle, FileDown, ShieldCheck, Mail, Send
} from 'lucide-react';
import StoreShell from '../../components/StoreShell';
import ProductCatalog from '../../components/ProductCatalog';
import { getApiUrl } from '../../lib/api';

export default function CategoryPage() {
  const params = useParams();
  const category = params?.category;
  const currentRegion = useSelector((state) => state.region.currentRegion);
  const currencySymbol = useSelector((state) => state.region.currencySymbol);

  const [inquiryName, setInquiryName] = useState('');
  const [inquiryEmail, setInquiryEmail] = useState('');
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [inquirySent, setInquirySent] = useState(false);

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

  // Render Page Content based on Category slug
  const renderContent = () => {
    if (category === 'nutrition') {
      return (
        <div className="py-8">
          <div className="container-page text-center mb-10">
            <span className="kicker">Sclero Nutrition</span>
            <h1 className="text-display mt-2">Collagen &amp; Calcium Supplements</h1>
            <p className="mx-auto mt-4 max-w-xl text-sm text-ink-secondary">
              Premium bone, joint, and tissue care formulated around purified eggshell bioactives and multi-type collagen.
            </p>
          </div>
          <ProductCatalog filterable={true} />
        </div>
      );
    }

    if (category === 'ovomatrix') {
      // 11-section OvoMatrix solutions page
      return (
        <div className="space-y-16 py-12">
          {/* Section 1: Hero Section */}
          <section className="container-page text-center py-12 bg-brand-bg rounded-lg border border-edge">
            <span className="kicker">Natural Eggshell Ingredient Platform</span>
            <h1 className="text-display mt-3">OvoMatrix — Natural Eggshell Ingredient Platform</h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm text-ink-secondary">
              Mineral • Protein • Bioactive Technology for Nutrition, Soil, Turf &amp; B2B Applications
            </p>
            <p className="mx-auto mt-2 text-xs font-semibold text-brand-muted uppercase tracking-wider">
              One Source. Multiple Industries. Infinite Applications.
            </p>
            <div className="mt-8 flex justify-center gap-3">
              <a href="#applications" className="btn-primary px-6 py-3 text-xs font-semibold">
                Explore OvoMatrix Solutions
              </a>
              <a href="#enquiry" className="btn-ghost px-6 py-3 text-xs font-semibold">
                Bulk &amp; OEM Enquiries
              </a>
            </div>
          </section>

          {/* Section 2: What is OvoMatrix? */}
          <section className="container-page grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="kicker">Platform Overview</span>
              <h2 className="text-heading-1 mt-2">What is OvoMatrix?</h2>
              <p className="mt-4 text-xs md:text-sm text-ink-secondary leading-relaxed space-y-4">
                OvoMatrix is the proprietary eggshell-derived ingredient platform developed by Sclero Proteins. It captures the natural synergy of minerals (calcium-rich matrix), structural proteins (collagen-derived peptides), and bioactive fractions (elastin type, membrane peptides).
              </p>
              <div className="mt-6 grid grid-cols-2 gap-4">
                <div className="p-4 border border-edge rounded bg-surface">
                  <h4 className="text-xs font-bold text-ink-primary">Minerals</h4>
                  <p className="text-[10px] text-ink-muted mt-1">High mineral density calcium carbonate matrix.</p>
                </div>
                <div className="p-4 border border-edge rounded bg-surface">
                  <h4 className="text-xs font-bold text-ink-primary">Proteins</h4>
                  <p className="text-[10px] text-ink-muted mt-1">Collagen types I, V, and X peptides.</p>
                </div>
              </div>
            </div>
            <div className="bg-surface border border-edge rounded-lg p-6 shadow-card">
              <h3 className="font-display text-sm font-bold text-ink-primary mb-4">Core Categories Powered by OvoMatrix:</h3>
              <ul className="space-y-3">
                {[
                  'Human Nutrition (via Sclero Nutrition)',
                  'Soil Conditioning (SoilPro)',
                  'Turf Management (LawnCal)',
                  'Bulk B2B ingredients (ESC, collagen, custom blends)'
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs text-ink-secondary">
                    <CheckCircle2 className="h-4.5 w-4.5 text-ink-success shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Section 3: Why OvoMatrix exists */}
          <section className="bg-surface border-y border-edge py-16">
            <div className="container-page max-w-4xl text-center">
              <span className="kicker">Value Proposition</span>
              <h2 className="text-heading-1 mt-2">Why OvoMatrix Exists</h2>
              <p className="mt-4 text-xs md:text-sm text-ink-secondary leading-relaxed">
                Eggshell is one of nature’s most advanced composite materials. OvoMatrix exists to harness this natural architecture and apply it across industries where purity, consistency, and natural origin matter.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10 text-left">
                {[
                  { title: 'Natural Synergy', desc: 'Combines minerals and proteins in their native ratio.' },
                  { title: 'Traceable Sourcing', desc: '100% verified origin from clean facilities.' },
                  { title: 'Scalable Supply', desc: 'Ready for consumer packets or bulk industrial blends.' }
                ].map((col, idx) => (
                  <div key={idx} className="p-5 border border-edge bg-brand-bg rounded">
                    <h4 className="text-xs font-bold text-ink-primary mb-2">{col.title}</h4>
                    <p className="text-[10px] text-ink-muted leading-relaxed">{col.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Section 4: The OvoMatrix Advantage */}
          <section className="container-page">
            <div className="text-center mb-12">
              <span className="kicker">Technical Edge</span>
              <h2 className="text-heading-1 mt-2">The OvoMatrix Advantage</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { title: 'Natural Origin', desc: 'Derived from purified eggshells without harsh synthetics.' },
                { title: 'Multi Component Matrix', desc: 'Preserves calcium, trace minerals, and elastin type proteins.' },
                { title: 'High Purity', desc: 'Processed to achieve extremely low heavy metal and micro-count sheets.' },
                { title: 'Versatile Applications', desc: 'Used for joint health, cosmetic compounds, and agricultural enrichment.' },
                { title: 'Traceability', desc: 'Controlled batch auditing from source to shipping container.' },
                { title: 'Scalable Blends', desc: 'Available for private label formulations and blenders.' }
              ].map((adv, idx) => (
                <div key={idx} className="p-6 border border-edge bg-surface rounded-md shadow-card">
                  <Award className="h-6 w-6 text-brand-accent mb-3" />
                  <h4 className="text-xs font-bold text-ink-primary mb-1">{adv.title}</h4>
                  <p className="text-[10px] text-ink-secondary leading-relaxed">{adv.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section 5: OvoMatrix Applications */}
          <section id="applications" className="bg-brand-bg border-y border-edge py-16">
            <div className="container-page">
              <div className="text-center mb-12">
                <span className="kicker">Target Sectors</span>
                <h2 className="text-heading-1 mt-2">OvoMatrix Applications</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                  { title: 'Human Nutrition', items: ['Multi-type collagen complexes', 'Calcium mineral supplements', 'Active joint care formulas'] },
                  { title: 'Soil Conditioning', items: ['Calcium-rich soil improvers', 'Humic matter conditioning', 'Plant bioactive additives'] },
                  { title: 'Turf & Landscape', items: ['Multi-mineral turf blends', 'Lawn structure support', 'Golf course surface blenders'] },
                  { title: 'B2B Bulk Supply', items: ['Bulk ESC (25 kg bags)', 'Bulk Collagen (5-10 kg bags)', 'Custom OEM formulations'] }
                ].map((app, idx) => (
                  <div key={idx} className="p-6 border border-edge bg-surface rounded shadow-card">
                    <h4 className="text-xs font-bold text-ink-primary mb-4 pb-2 border-b border-edge-subtle">{app.title}</h4>
                    <ul className="space-y-2">
                      {app.items.map((item, j) => (
                        <li key={j} className="flex items-center gap-1.5 text-[10px] text-ink-secondary">
                          <span className="h-1 w-1 rounded-full bg-brand-accent" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Section 6: Product Lines Under OvoMatrix */}
          <section className="container-page">
            <div className="text-center mb-12">
              <span className="kicker">Core Catalog</span>
              <h2 className="text-heading-1 mt-2">Product Lines Under OvoMatrix Solutions</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div className="p-6 border border-edge rounded-lg bg-surface shadow-card flex flex-col justify-between">
                <div>
                  <Sprout className="h-8 w-8 text-brand-accent mb-4" />
                  <h3 className="font-display text-sm font-bold text-ink-primary">SoilPro — Natural Multi Component Soil Improver</h3>
                  <p className="text-xs text-ink-secondary mt-2 leading-relaxed">
                    A calcium-rich blend with organic matter and natural bioactive inputs designed for pots, beds, compost, and nurseries.
                  </p>
                </div>
                <Link href="/ovomatrix/soilpro" className="btn-ghost mt-6 w-full text-center text-xs py-2">
                  View SoilPro Details
                </Link>
              </div>
              <div className="p-6 border border-edge rounded-lg bg-surface shadow-card flex flex-col justify-between">
                <div>
                  <Leaf className="h-8 w-8 text-brand-accent mb-4" />
                  <h3 className="font-display text-sm font-bold text-ink-primary">LawnCal — Multi Mineral Turf &amp; Lawn Conditioner</h3>
                  <p className="text-xs text-ink-secondary mt-2 leading-relaxed">
                    A calcium-led multi-mineral blend featuring magnesium, iron, and humic substances for sports turf and commercial landscape.
                  </p>
                </div>
                <Link href="/ovomatrix/lawncal" className="btn-ghost mt-6 w-full text-center text-xs py-2">
                  View LawnCal Details
                </Link>
              </div>
            </div>
          </section>

          {/* Section 7: Technology & Processing */}
          <section className="bg-surface border-y border-edge py-16">
            <div className="container-page max-w-3xl text-center">
              <span className="kicker">Production Standard</span>
              <h2 className="text-heading-1 mt-2">Technology &amp; Processing</h2>
              <p className="mt-4 text-xs text-ink-secondary leading-relaxed">
                Our controlled processing keeps peptide bonds active. The raw materials undergo cold purification, enzymatic separation, micronization, and blending under GMP conditions.
              </p>
              <div className="flex flex-wrap justify-center gap-3 mt-8">
                {['Purification', 'Separation', 'Micronization', 'Blending', 'Quality Testing', 'Packaging'].map((step, idx) => (
                  <span key={idx} className="bg-brand-bg border border-edge px-3 py-1.5 rounded-sm text-[10px] font-semibold text-ink-primary">
                    {idx + 1}. {step}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* Section 8: Quality & Compliance */}
          <section className="container-page text-center">
            <span className="kicker">Validation</span>
            <h2 className="text-heading-1 mt-2">Quality &amp; Compliance</h2>
            <p className="mx-auto mt-3 max-w-xl text-xs text-ink-secondary leading-relaxed">
              OvoMatrix ingredients follow strict food-grade processing and meet UK General Product Safety parameters.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-10 text-left">
              {['Physical Testing', 'Microbial Verification', 'Heavy Metal Screening', 'Batch Traceability'].map((q, idx) => (
                <div key={idx} className="p-4 border border-edge bg-brand-bg rounded">
                  <CheckCircle2 className="h-5 w-5 text-ink-success mb-2" />
                  <h4 className="text-xs font-bold text-ink-primary mb-1">{q}</h4>
                  <p className="text-[10px] text-ink-muted">Independent laboratory verified on every production batch.</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section 9: Documentation */}
          <section className="bg-brand-bg border-y border-edge py-12">
            <div className="container-page text-center max-w-2xl">
              <span className="kicker">Technical Sheets</span>
              <h2 className="text-heading-1 mt-2">Technical Documentation</h2>
              <p className="mt-3 text-xs text-ink-secondary leading-relaxed">
                Authorized buyers can download specification sheets, safety data sheets, and bulk catalogue details.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Link href="/resources" className="btn-primary inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold">
                  <Download className="h-4 w-4" /> Download Tech Sheets
                </Link>
              </div>
            </div>
          </section>

          {/* Section 10: Who Uses OvoMatrix? */}
          <section className="container-page text-center">
            <span className="kicker">Partnerships</span>
            <h2 className="text-heading-1 mt-2">Who Uses OvoMatrix?</h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-8">
              {['Supplement Brands', 'Soil Manufacturers', 'Landscape Companies', 'Nurseries', 'Private Label Brands'].map((user, idx) => (
                <div key={idx} className="p-4 border border-edge bg-surface rounded shadow-card">
                  <p className="text-xs font-bold text-ink-primary">{user}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section 11: Enquiry & OEM Support */}
          <section id="enquiry" className="mx-auto max-w-xl px-4 py-8">
            <div className="rounded-lg border border-edge bg-surface p-8 shadow-card w-full">
              <h3 className="font-display text-base font-bold text-ink-primary mb-1 text-center">Enquiry &amp; OEM Support</h3>
              <p className="text-xs text-ink-secondary mb-6 text-center leading-relaxed">
                Contact our bulk supply operations team to register for wholesale blenders or licensing.
              </p>
              {inquirySent ? (
                <div className="rounded border border-brand-success/20 bg-brand-success/5 p-4 text-center">
                  <p className="text-[11px] font-semibold text-ink-success">
                    Your request was submitted. An OEM specialist will contact you.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleInquirySubmit} className="space-y-4">
                  <div>
                    <input type="text" placeholder="Your name" value={inquiryName} onChange={(e) => setInquiryName(e.target.value)} className="w-full rounded border border-edge p-2.5 text-xs text-ink-primary focus:outline-none" required />
                  </div>
                  <div>
                    <input type="email" placeholder="Business email" value={inquiryEmail} onChange={(e) => setInquiryEmail(e.target.value)} className="w-full rounded border border-edge p-2.5 text-xs text-ink-primary focus:outline-none" required />
                  </div>
                  <div>
                    <textarea placeholder="Describe details..." value={inquiryMessage} onChange={(e) => setInquiryMessage(e.target.value)} rows={3} className="w-full rounded border border-edge p-2.5 text-xs text-ink-primary focus:outline-none" required />
                  </div>
                  <button type="submit" className="w-full btn-primary py-2.5 text-xs font-semibold">
                    Submit OEM Request
                  </button>
                </form>
              )}
            </div>
          </section>
        </div>
      );
    }

    if (category === 'science') {
      return (
        <div className="container-page py-12 space-y-12">
          <div className="text-center mb-10">
            <span className="kicker">Research Library</span>
            <h1 className="text-display mt-2">Backed by Research. Driven by Bioactive Science.</h1>
            <p className="mx-auto mt-4 max-w-xl text-sm text-ink-secondary">
              Review molecular analysis and clinical evidence for eggshell calcium, collagen, and mineral bioavailability.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: 'Collagen Types I, V, X', desc: 'Understands how multi-type collagen matrices support joint structure and bone renewal.', slug: 'collagen' },
              { title: 'Eggshell Membrane Bioactives', desc: 'Naturally occurring glycosaminoglycans (GAGs), chondroitin, and elastin profiles.', slug: 'eggshell' },
              { title: 'Calcium Bioavailability', desc: 'Solubility indexes and comparative tests against synthetic calcium carbonate.', slug: 'calcium' },
              { title: 'Extraction & Purification', desc: 'Our clean, cold-extraction technology processes without denaturing essential protein structures.', slug: 'extraction' },
              { title: 'Clinical Evidence', desc: 'Key summaries of trials evaluating eggshell membrane for joint comfort and density support.', slug: 'clinical' },
              { title: 'Safety & Compliance', desc: 'Rigorous third-party lab testing sheets and GMP manufacturing standards.', slug: 'compliance' }
            ].map((s) => (
              <div key={s.slug} className="p-6 border border-edge bg-surface rounded-md shadow-card hover:border-edge-strong transition-all duration-300 flex flex-col justify-between">
                <div>
                  <h3 className="font-display text-sm font-bold text-ink-primary mb-2">{s.title}</h3>
                  <p className="text-xs text-ink-secondary leading-relaxed">{s.desc}</p>
                </div>
                <Link href={`/science/${s.slug}`} className="mt-6 text-xs font-semibold text-brand-muted hover:underline flex items-center gap-0.5">
                  Read Technical Sheet <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (category === 'applications') {
      return (
        <div className="container-page py-12 space-y-12">
          <div className="text-center mb-10">
            <span className="kicker">Multi-Industry Usages</span>
            <h1 className="text-display mt-2">Solutions for Multiple Industries</h1>
            <p className="mx-auto mt-4 max-w-xl text-sm text-ink-secondary">
              OvoMatrix is engineered as a clean platform serving functional nutrition, cosmetics, pet care, and soil restoration.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { title: 'Human Nutrition', icon: Heart, slug: 'human', desc: 'Formulated in BJC and Combo Collagen capsules to provide daily cartilage structure and bone density support.' },
              { title: 'Skin & Joint Health', icon: Activity, slug: 'skin-joint', desc: 'Bioactive peptides and elastin fragments integrated to renew structural tissues.' },
              { title: 'Sports & Recovery', icon: Dumbbell, slug: 'sports', desc: 'Nourishing tendons and ligaments to recover quickly from intense workout loads.' },
              { title: 'Pet Nutrition', icon: Brain, slug: 'pet', desc: 'Pure, safe inputs for premium canine and feline joint supplements.' },
              { title: 'Agriculture & Soil Health', icon: Sprout, slug: 'agriculture', desc: 'Mineral soil builders and organic humic conditioners to replace synthetic agents.' },
              { title: 'Food & Beverage Fortification', icon: Shield, slug: 'food-beverage', desc: 'Water-soluble calcium and protein powders for functional food blends.' }
            ].map((app) => {
              const Icon = app.icon;
              return (
                <div key={app.slug} className="p-6 border border-edge bg-surface rounded-md shadow-card flex flex-col justify-between">
                  <div>
                    <div className="flex h-10 w-10 items-center justify-center rounded bg-surface-muted text-ink-accent mb-4">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-display text-sm font-bold text-ink-primary mb-2">{app.title}</h3>
                    <p className="text-xs text-ink-secondary leading-relaxed">{app.desc}</p>
                  </div>
                  <Link href={`/applications/${app.slug}`} className="mt-6 text-xs font-semibold text-brand-muted hover:underline flex items-center gap-0.5">
                    Read Details <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      );
    }

    if (category === 'resources') {
      return (
        <div className="container-page py-12 space-y-12">
          <div className="text-center mb-10">
            <span className="kicker">Technical Documents</span>
            <h1 className="text-display mt-2">Technical Documents &amp; Compliance</h1>
            <p className="mx-auto mt-4 max-w-xl text-sm text-ink-secondary">
              Review batch certificate parameters, specifications, and whitepapers.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              { title: 'COA Samples', desc: 'Verifies purity, absence of pathogens, and heavy metals content logs.', slug: 'coa' },
              { title: 'Product Specification Sheets', desc: 'Granulation charts, moisture checks, and composition sheets.', slug: 'spec-sheets' },
              { title: 'Whitepapers', desc: 'Access our research whitepapers on OvoMatrix, SoilPro, and LawnCal.', slug: 'whitepapers' },
              { title: 'Wholesale Catalogue', desc: 'Packaging weights, container loading limits, and supply metrics.', slug: 'catalogue' },
              { title: 'FAQs', desc: 'Quick responses to compliance, storage, and processing questions.', slug: 'faq' }
            ].map((res) => (
              <div key={res.slug} className="p-6 border border-edge bg-surface rounded shadow-card flex flex-col justify-between">
                <div>
                  <h3 className="font-display text-sm font-bold text-ink-primary mb-1">{res.title}</h3>
                  <p className="text-xs text-ink-secondary leading-relaxed mt-2">{res.desc}</p>
                </div>
                <Link href={`/resources/${res.slug}`} className="btn-ghost mt-6 w-full text-center text-xs py-2 inline-flex items-center justify-center gap-1">
                  <Download className="h-4 w-4" /> Download {res.title}
                </Link>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (category === 'about') {
      return (
        <div className="container-page py-12 space-y-12 max-w-4xl">
          <div className="text-center mb-10">
            <span className="kicker">Corporate Profile</span>
            <h1 className="text-display mt-2">About Sclero Proteins</h1>
            <p className="mx-auto mt-4 text-sm text-ink-secondary leading-relaxed">
              We engineer advanced active nutrition and soil conditioners from purified, upcycled eggshell matrices, conforming to strict quality, scientific, and operations standards.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 border border-edge bg-surface rounded shadow-card">
              <h3 className="font-display text-sm font-bold text-ink-primary mb-2">Company Profile</h3>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Founded as Sclero Proteins Ltd, we maintain clean extraction standards to deliver organic calcium and structural peptides to blenders, consumers, and agricultural partners worldwide.
              </p>
            </div>
            <div className="p-6 border border-edge bg-surface rounded shadow-card">
              <h3 className="font-display text-sm font-bold text-ink-primary mb-2">UK &amp; India Operations</h3>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Operating regional warehouses in Haywards Heath (UK) and Anand, Gujarat (India) for prompt domestic fulfillment.
              </p>
              <Link href="/about/operations" className="text-xs text-brand-muted hover:underline mt-4 block">Read Operations details</Link>
            </div>
            <div className="p-6 border border-edge bg-surface rounded shadow-card">
              <h3 className="font-display text-sm font-bold text-ink-primary mb-2">Manufacturing &amp; Quality</h3>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Processed in clean, food-grade compliant GMP facilities using zero synthetic fillers or chalk carbonates.
              </p>
            </div>
            <div className="p-6 border border-edge bg-surface rounded shadow-card">
              <h3 className="font-display text-sm font-bold text-ink-primary mb-2">Certifications</h3>
              <p className="text-xs text-ink-secondary leading-relaxed">
                Our facilities, batches, and operations align with UK GPSR regulations and export certification rules.
              </p>
              <Link href="/about/certifications" className="text-xs text-brand-muted hover:underline mt-4 block">Read Certifications details</Link>
            </div>
          </div>
        </div>
      );
    }

    // Fallback if category is unknown
    return (
      <div className="container-page py-20 text-center">
        <h1 className="text-display">Page not found</h1>
        <p className="mt-4 text-sm text-ink-secondary">The requested category hub does not exist.</p>
        <Link href="/" className="btn-primary mt-8 px-6 py-3 text-xs inline-block">Return Home</Link>
      </div>
    );
  };

  return (
    <StoreShell>
      {renderContent()}
    </StoreShell>
  );
}
