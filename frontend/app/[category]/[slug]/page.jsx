'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import Link from 'next/link';
import {
  Check, ArrowRight, ShieldCheck, Heart, Leaf, Sprout, Award,
  Activity, Dumbbell, Shield, HelpCircle, FileDown, BookOpen, ChevronRight, ShoppingCart
} from 'lucide-react';
import StoreShell from '../../../components/StoreShell';
import { addToCart } from '../../../store/cartSlice';
import { getApiUrl } from '../../../lib/api';
import { trackEvent } from '../../../utils/analytics';
import { parseMarkdownBlocks, renderInlineMarkdown } from '../../../lib/markdown';

export default function SubpageOrProduct() {
  const params = useParams();
  const router = useRouter();
  const dispatch = useDispatch();
  const category = params?.category;
  const slug = params?.slug;

  const currentRegion = useSelector((state) => state.region.currentRegion);
  const currencySymbol = useSelector((state) => state.region.currencySymbol);
  const { session_id } = useSelector((state) => state.region);

  const [product, setProduct] = useState(null);
  const [cmsPage, setCmsPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState(null);

  // Determine if this is a product URL mapping
  const productSku = useMemo(() => {
    if (category === 'nutrition') {
      if (slug === 'combo-collagen') return 'COMBO-COLLAGEN-60';
      if (slug === 'bjc') return 'BJC-BONE-JOINT';
      if (slug === 'calpure') return 'CALPURE-60';
    }
    if (category === 'ovomatrix') {
      if (slug === 'soilpro') return 'SOILPRO-1KG';
      if (slug === 'lawncal') return 'LAWNCAL-25KG';
    }
    return null;
  }, [category, slug]);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);

    if (productSku) {
      // Fetch Product Details
      fetch(getApiUrl(`/api/products/${productSku}/?region=${currentRegion}`))
        .then((res) => {
          if (!res.ok) throw new Error();
          return res.json();
        })
        .then((data) => {
          setProduct(data);
          setCmsPage(null);
          setLoading(false);
        })
        .catch(() => {
          setProduct(null);
          setLoading(false);
        });
    } else {
      // Fetch CMS Page by slug or category-slug
      fetch(getApiUrl(`/api/content-pages/${slug}/`))
        .then(res => res.ok ? res.json() : fetch(getApiUrl(`/api/content-pages/${category}-${slug}/`)).then(r => r.ok ? r.json() : null))
        .then((data) => {
          if (data) {
            setCmsPage(data);
            setProduct(null);
          }
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    }
  }, [slug, productSku, currentRegion]);

  const handleAddToCart = () => {
    if (!product) return;
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
  };

  // Pre-seeded static data fallback for CMS subpages
  const staticFallback = useMemo(() => {
    if (productSku) return null;

    // Science subpages
    if (category === 'science') {
      if (slug === 'collagen') {
        return {
          title: 'Collagen Types I, V, X',
          desc: 'Eggshell membrane naturally contains types I, V, and X collagen. This multi-type combination is essential for bone mineralization, joint cartilage elasticity, and cell signaling in skin layers.',
          sections: [
            { h: 'Collagen Type I', p: 'The most abundant collagen in the human body, providing tensile strength to tendons, skin, and bones.' },
            { h: 'Collagen Type V', p: 'Fibrillar collagen that works co-operatively with Type I to control fiber diameters in tissues and support healthy skin growth.' },
            { h: 'Collagen Type X', p: 'A marker for endochondral ossification, localized primarily in articular cartilage and mineralizing bone matrix.' }
          ]
        };
      }
      if (slug === 'eggshell') {
        return {
          title: 'Eggshell Membrane Bioactives',
          desc: 'Our purified eggshell membrane is a natural, whole-food matrix rich in key glycosaminoglycans (GAGs) and protein structures.',
          sections: [
            { h: 'Elastin Peptides', p: 'Maintains tissue elasticity, allowing ligaments, veins, and cartilage to stretch and recoil smoothly.' },
            { h: 'Glucosamine & Chondroitin', p: 'Critical building blocks for cartilage repair, joint cushioning, and fluid retention.' },
            { h: 'Hyaluronic Acid', p: 'A natural lubricant for synovial fluid, reducing mechanical friction in moving joints.' }
          ]
        };
      }
      if (slug === 'calcium') {
        return {
          title: 'Calcium Bioavailability',
          desc: 'Eggshell calcium (ESC) exhibits superior bio-absorption profiles compared to standard mineral chalk carbonates.',
          sections: [
            { h: 'Steady Dissolution Rate', p: 'Unlike synthetic calcium, eggshell calcium dissolves gradually in gastric fluids, preventing spiking.' },
            { h: 'Trace Mineral Matrix', p: 'Naturally contains trace boron, phosphorus, and strontium that assist osteoblasts in absorbing calcium into bones.' }
          ]
        };
      }
      if (slug === 'extraction') {
        return {
          title: 'Extraction & Purification',
          desc: 'Our extraction system uses zero harsh acids or chemical solvents to isolate active compounds.',
          sections: [
            { h: 'Cold Purification', p: 'Keeps temperature low so that delicate protein chains and bioactive enzymes are not denatured.' },
            { h: 'Mechanical Separation', p: 'Gentle water-centrifuge separation of membrane from shell, yielding high-purity outputs.' }
          ]
        };
      }
      if (slug === 'clinical') {
        return {
          title: 'Clinical Evidence',
          desc: 'Peer-reviewed human trials show the effectiveness of eggshell membrane inputs for joint mobility.',
          sections: [
            { h: 'Rapid Support', p: 'Trials indicate joint comfort and flexibility improvements within 7–10 days of daily supplement intake.' },
            { h: 'Cartilage Integrity', p: 'Long-term studies suggest CTX-II markers (indicating cartilage degradation) decline with regular supplementation.' }
          ]
        };
      }
    }

    // Applications subpages
    if (category === 'applications') {
      const appTitles = {
        'human': 'Human Nutrition & Dermal Synthesis',
        'agriculture': 'Agriculture & Organic Soil Restoration',
        'pet': 'Pet Nutrition & Canine Joint Support',
        'skin-joint': 'Skin Elasticity & Articular Cartilage Nourishment',
        'sports': 'Sports Performance, Tendon & Fascia Recovery',
        'food-beverage': 'Functional Food & Beverage Fortification'
      };
      if (appTitles[slug]) {
        return {
          title: appTitles[slug],
          desc: `OvoMatrix provides targeted active compounds for ${appTitles[slug].toLowerCase()}. Our purified materials are prepared to align with strict industry parameters, ensuring stable, bioavailable active ingredients.`,
          sections: [
            { h: 'Key Application Value', p: 'Clean label compliance, zero synthetic fillers, high organic solubility, and neutral odor/taste characteristics.' },
            { h: 'Standardization', p: 'We standardize our bulk ingredients for consistent calcium content, peptide size, and microbial safety.' }
          ]
        };
      }
    }

    // About subpages
    if (category === 'about') {
      if (slug === 'operations') {
        return {
          title: 'UK & India Operations',
          desc: 'Sclero Proteins maintains dedicated fulfillment hubs to serve regional markets directly and transparently.',
          sections: [
            { h: 'UK Operations (Haywards Heath)', p: 'Fulfills domestic UK orders within 2-4 business days. Integrates local customer service and British business compliance.' },
            { h: 'India Operations (Anand, Gujarat)', p: 'Processes domestic Indian orders directly from our Anand logistics hub, offering local currency payments and GST invoices.' }
          ]
        };
      }
      if (slug === 'certifications') {
        return {
          title: 'Certifications & Quality Compliance',
          desc: 'Our manufacturing operations and ingredient sources are vetted against strict regulatory standards.',
          sections: [
            { h: 'GMP Compliant Facilities', p: 'All encapsulation, grading, and testing are done under strict Good Manufacturing Practices.' },
            { h: 'UK GPSR Alignment', p: 'All products conform fully to the UK General Product Safety Regulations for consumer wellness.' }
          ]
        };
      }
    }

    // Resources subpages / Whitepapers
    if (category === 'resources') {
      if (slug === 'whitepapers') {
        return {
          title: 'Whitepapers & Technical Research Reports',
          desc: 'Review the technical whitepapers written by Sclero Proteins specialists regarding our eggshell extraction and mineral chemistry.',
          sections: [
            {
              h: 'Whitepaper 1: OvoMatrix Platform',
              p: 'Executive Summary: OvoMatrix is a natural eggshell-derived ingredient platform. It integrates minerals, structural proteins, and bioactive fractions into a single, scalable technology used across human nutrition, soil conditioning, turf management, and B2B bulk ingredients. OvoMatrix delivers purity, consistency, and multi-industry versatility.'
            },
            {
              h: 'Whitepaper 2: SoilPro Natural Improver',
              p: 'Executive Summary: SoilPro is a calcium-rich, multi-component soil improver powered by OvoMatrix. It combines calcium sources, organic matter, plant-derived compounds, and bioactive soil conditioners. Designed for gardens, beds, pots, and compost mixes to improve texture and water retention.'
            },
            {
              h: 'Whitepaper 3: LawnCal Turf Conditioner',
              p: 'Executive Summary: LawnCal is a multi-mineral turf conditioner powered by OvoMatrix. It combines calcium sources, magnesium-bearing minerals, sulphur compounds, iron based inputs, and organic humic matter. Designed to support surface preparation and root zones for golf courses and sports lawns.'
            },
            {
              h: 'Whitepaper 4: Bulk ESC & Bulk Collagen Portfolio',
              p: 'Executive Summary: This document outlines the composition, processing, and advantages of our bulk B2B ingredient portfolio. Sclero Proteins offers bulk ESC in 25 kg bags and hydrolyzed eggshell collagen in 5–10 kg boxes for nutraceutical and cosmetic formulators.'
            }
          ]
        };
      }
      const resTitles = {
        'coa': 'Certificate of Analysis (COA) Samples',
        'spec-sheets': 'Product Specification & Parameter Sheets',
        'catalogue': 'Wholesale & B2B Product Catalogue',
        'faq': 'Frequently Asked Questions & Compliance Reference'
      };
      if (resTitles[slug]) {
        return {
          title: resTitles[slug],
          desc: `Technical file download for ${resTitles[slug].toLowerCase()}. Sclero Proteins maintains full transparency by publishing standard batch specifications and answers to regulatory queries.`,
          sections: [
            { h: 'Technical Document Summary', p: 'Purity limits, heavy metal indicators, trace elements, particle sizing, and shelf life parameters.' },
            { h: 'Document Access', p: 'To download signed or batch-specific copies, please log into the distributor portal or contact support.' }
          ]
        };
      }
    }

    // OvoMatrix subpages
    if (category === 'ovomatrix') {
      const ovoTitles = {
        'bulk': 'Bulk Supply & OEM Solutions',
        'science': 'OvoMatrix Science & Composition',
        'applications': 'OvoMatrix Industrial Applications'
      };
      if (ovoTitles[slug]) {
        return {
          title: ovoTitles[slug],
          desc: `${ovoTitles[slug]} details. The OvoMatrix platform delivers clean mineral and protein fractions from natural upcycled eggshells, designed for high solubility and consistent performance.`,
          sections: [
            { h: 'Standardization', p: 'Every production run is graded for particle size, active GAG percentages, and microbiological limits.' },
            { h: 'OEM & Packaging', p: 'Available in standard B2B weights (25 kg bags for calcium, 5-10 kg boxes for collagen) or custom dry blending options.' }
          ]
        };
      }
    }

    return null;
  }, [category, slug, productSku]);

  if (loading) {
    return (
      <StoreShell>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="loader" />
        </div>
      </StoreShell>
    );
  }

  // -------------------------------------------------------------
  // RENDER DYNAMIC PRODUCT PAGE (11 SECTIONS)
  // -------------------------------------------------------------
  if (productSku && product) {
    const isAgri = product.sku.includes('SOILPRO') || product.sku.includes('LAWNCAL');
    const packSize = product.sku.includes('60') ? '60 Capsules' : product.sku.includes('1KG') ? '1 kg' : '25 kg bag';

    // Composition info based on SKU
    const compositionData = productSku === 'COMBO-COLLAGEN-60'
      ? ['Type I Collagen (ESM derived)', 'Type V Collagen (ESM derived)', 'Type X Collagen (ESM derived)', 'Elastin Peptides', 'Natural Bioactive Peptides', 'Capsule Shell (Gelatine)']
      : productSku === 'BJC-BONE-JOINT'
      ? ['Collagen Peptides (ESM derived)', 'Elastin Peptides', 'Glycosaminoglycans (GAGs)', 'Natural Eggshell Calcium', 'Bioactive Peptides', 'Capsule Shell (Gelatine)']
      : productSku === 'CALPURE-60'
      ? ['Eggshell Derived Calcium', 'Naturally Occurring Peptide Fractions', 'Capsule Shell (Gelatine)']
      : productSku === 'SOILPRO-1KG'
      ? ['Natural calcium sources (ESC based)', 'Organic matter (humic substances, plant-derived)', 'Bioactive soil conditioners', 'Natural mineral inputs', 'Plant based soil enhancers']
      : ['Natural calcium sources', 'Magnesium bearing minerals', 'Sulphur rich mineral compounds', 'Iron based soil inputs', 'Organic matter (humic substances)'];

    // Mechanism steps
    const mechanismSteps = isAgri
      ? [
          { title: 'Calcium Dissolution', desc: 'ESC integrates into the soil profile, dissolving steadily.' },
          { title: 'Soil Structure Improvement', desc: 'Calcium ions aggregate soil particles, improving texture and aeration.' },
          { title: 'Organic Matter Activation', desc: 'Humic substances support beneficial microbial colonies.' },
          { title: 'Root Development & Uptake', desc: 'Conditioned soil structure supports deep root expansion and nutrient uptake.' }
        ]
      : [
          { title: 'Efficient Absorption', desc: 'Hydrolyzed peptides are efficiently absorbed in the small intestine.' },
          { title: 'Fibroblast Stimulation', desc: 'Peptides act as bio-signals to stimulate cells to synthesis new collagen.' },
          { title: 'Matrix Support', desc: 'Provides structural amino acids for joint cartilage and skin dermis.' },
          { title: 'Mobility & Dermal Comfort', desc: 'Consistent intake maintains tissue resilience, joint flexibility, and skin hydration.' }
        ];

    // FAQs list
    const productFaqs = productSku === 'COMBO-COLLAGEN-60'
      ? [
          { q: 'Is Combo Collagen for skin or joints?', a: 'Both. It contains types I, V, and X collagen, designed as a whole body structural support.' },
          { q: 'How is it different from BJC?', a: 'BJC is specifically engineered for bone and joint care. Combo Collagen is a multi-type formula for overall body collagen.' },
          { q: 'Is it natural?', a: 'Yes. It is derived entirely from purified eggshell membrane, not synthetic sources.' }
        ]
      : productSku === 'BJC-BONE-JOINT'
      ? [
          { q: 'Is BJC only for joints?', a: 'No, it contains natural eggshell calcium and Type X collagen, supporting both bone matrix density and joint flexibility.' },
          { q: 'How is it different from Combo Collagen?', a: 'BJC targets joint comfort, tendons, and bone resilience. Combo Collagen supports overall body tissue.' },
          { q: 'Is the calcium natural?', a: 'Yes, it comes directly from the organic mineral shell matrix.' }
        ]
      : productSku === 'CALPURE-60'
      ? [
          { q: 'Is CalPure a collagen supplement?', a: 'No. CalPure is a calcium-first mineral formula with naturally occurring peptide fractions.' },
          { q: 'How is it different from Combo Collagen?', a: 'Combo Collagen is a structural protein complex. CalPure is a mineral formula for skeletal strength.' },
          { q: 'Is the calcium natural?', a: 'Yes, derived directly from purified eggshell.' }
        ]
      : productSku === 'SOILPRO-1KG'
      ? [
          { q: 'Is SoilPro a fertiliser?', a: 'No. SoilPro is a soil conditioner, not a chemical NPK fertiliser.' },
          { q: 'Is it safe for organic gardens?', a: 'Yes, it contains natural mineral and organic compounds and no synthetic chemical additives.' },
          { q: 'Can it be mixed with compost?', a: 'Yes. It is ideal to blend into compost or soil potting mixes during bed preparation.' }
        ]
      : [
          { q: 'Is LawnCal a fertiliser?', a: 'No. LawnCal is a multi-mineral soil and turf conditioner.' },
          { q: 'Can it be used on commercial turf?', a: 'Yes, it is designed for sports grounds, golf courses, nurseries, and home lawns.' },
          { q: 'How is it different from SoilPro?', a: 'SoilPro is a fine eggshell calcium powder for soil mixes. LawnCal is a multi-mineral turf conditioning blend.' }
        ];

    const relatedProductsList = [
      { name: 'Combo Collagen® (60 caps)', slug: 'combo-collagen', sku: 'COMBO-COLLAGEN-60', cat: 'nutrition' },
      { name: 'BJC® Bone & Joint Care (60 caps)', slug: 'bjc', sku: 'BJC-BONE-JOINT', cat: 'nutrition' },
      { name: 'CalPure® Beyond Calcium (60 caps)', slug: 'calpure', sku: 'CALPURE-60', cat: 'nutrition' },
      { name: 'SoilPro™ Soil Improver (1 kg)', slug: 'soilpro', sku: 'SOILPRO-1KG', cat: 'ovomatrix' },
      { name: 'LawnCal™ Turf Conditioner (25 kg)', slug: 'lawncal', sku: 'LAWNCAL-25KG', cat: 'ovomatrix' },
    ].filter(rp => rp.sku !== product.sku).slice(0, 3);

    return (
      <StoreShell>
        <div className="space-y-16 py-8 md:py-16">
          
          {/* 1. PRODUCT HERO SECTION */}
          <section className="container-page grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="aspect-square bg-surface-muted border border-edge rounded-lg flex items-center justify-center overflow-hidden">
              {product.media?.[0]?.file_url ? (
                <img src={product.media[0].file_url} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <div className="text-ink-muted text-xs uppercase font-bold">Product Image</div>
              )}
            </div>
            <div className="space-y-6">
              <span className="kicker uppercase font-bold text-brand-muted">{packSize} — {product.sku}</span>
              <h1 className="text-display leading-tight">{product.name}</h1>
              <p className="text-xs font-semibold text-brand-muted tracking-wider uppercase">
                {product.short_benefit || 'Advanced Eggshell Formulation'}
              </p>
              
              <div className="border-t border-b border-edge-subtle py-4 flex items-center justify-between">
                <span className="text-xl font-bold text-ink-primary">
                  {currencySymbol}{parseFloat(product.promotional_price || product.price).toFixed(2)}
                </span>
                <span className="text-[10px] text-ink-muted">In stock · Ready to ship</span>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-ink-primary">Key Highlights:</h4>
                <ul className="space-y-2">
                  {(product.benefits || 'Pure ESM matrix\nEasy absorption').split('\n').slice(0, 3).map((hl, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-xs text-ink-secondary">
                      <Check className="h-4.5 w-4.5 text-ink-success" />
                      <span>{hl}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={handleAddToCart} className="btn-primary flex-1 py-3.5 text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-lg">
                  <ShoppingCart className="h-4.5 w-4.5" /> Buy Now
                </button>
                <Link href="/contact" className="btn-ghost px-6 py-3.5 text-sm font-semibold">
                  Enquire for Bulk
                </Link>
              </div>
            </div>
          </section>

          {/* 2. SCIENTIFIC SUMMARY */}
          <section className="bg-brand-bg border-y border-edge py-12">
            <div className="container-page max-w-3xl text-center">
              <span className="kicker">Scientific Summary</span>
              <h2 className="text-heading-2 mt-2">Formulation Summary</h2>
              <p className="mt-4 text-xs md:text-sm leading-[1.8] text-ink-secondary text-left md:text-center">
                {product.description}
              </p>
            </div>
          </section>

          {/* 3. KEY BENEFITS */}
          <section className="container-page max-w-4xl">
            <div className="text-center mb-10">
              <span className="kicker">Targeted Support</span>
              <h2 className="text-heading-2 mt-2">Key Benefits</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(product.benefits || '').split('\n').map((benefit, idx) => {
                if (!benefit.trim()) return null;
                return (
                  <div key={idx} className="p-4 border border-edge bg-surface rounded flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-ink-success shrink-0" />
                    <p className="text-xs text-ink-secondary font-medium">{benefit}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 4. WHAT MAKES IT DIFFERENT (USP) */}
          <section className="container-page border-t border-edge pt-12">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="p-6 bg-brand-bg border border-edge rounded">
                <h4 className="text-xs font-bold text-ink-primary mb-2">OvoMatrix Technology</h4>
                <p className="text-[10px] text-ink-secondary leading-relaxed">
                  Utilizes our proprietary ingredient separation process to deliver native minerals and proteins together.
                </p>
              </div>
              <div className="p-6 bg-brand-bg border border-edge rounded">
                <h4 className="text-xs font-bold text-ink-primary mb-2">100% Organic Origin</h4>
                <p className="text-[10px] text-ink-secondary leading-relaxed">
                  Naturally sourced from purified eggshells. Zero synthetic additives or chalk carbonate fillers.
                </p>
              </div>
              <div className="p-6 bg-brand-bg border border-edge rounded">
                <h4 className="text-xs font-bold text-ink-primary mb-2">GMP Certified Sourcing</h4>
                <p className="text-[10px] text-ink-secondary leading-relaxed">
                  Processed in clean, accredited facilities under strict QA protocols for heavy metal and microbial screening.
                </p>
              </div>
            </div>
          </section>

          {/* 5. COMPOSITION / INGREDIENTS */}
          <section className="bg-surface border-y border-edge py-12">
            <div className="container-page max-w-2xl">
              <h2 className="text-heading-2 mb-6 text-center">Composition &amp; Ingredients</h2>
              <div className="border border-edge rounded-md overflow-hidden bg-brand-bg">
                <div className="bg-surface px-4 py-2.5 border-b border-edge font-bold text-[10px] text-brand-muted uppercase tracking-wider">
                  Active Compounds per Serving
                </div>
                <div className="divide-y divide-edge-subtle px-4">
                  {compositionData.map((item, idx) => (
                    <div key={idx} className="py-2.5 text-xs text-ink-secondary flex justify-between">
                      <span>{item}</span>
                      <span className="font-semibold text-ink-primary">Verified pure</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* 6. HOW IT WORKS */}
          <section className="container-page max-w-4xl">
            <h2 className="text-heading-2 mb-10 text-center">How It Works (Mechanism)</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {mechanismSteps.map((step, idx) => (
                <div key={idx} className="relative p-5 border border-edge bg-surface rounded shadow-card">
                  <div className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-ink-primary text-white flex items-center justify-center text-xs font-bold">
                    {idx + 1}
                  </div>
                  <h4 className="text-xs font-bold text-ink-primary mb-2 pr-4">{step.title}</h4>
                  <p className="text-[10px] text-ink-secondary leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 7. USAGE INSTRUCTIONS */}
          <section className="bg-brand-bg border-y border-edge py-12">
            <div className="container-page max-w-xl text-center">
              <span className="kicker">Directions</span>
              <h2 className="text-heading-2 mt-2">Usage Instructions</h2>
              <p className="mt-4 text-xs text-ink-secondary leading-relaxed">
                {isAgri 
                  ? 'Apply SoilPro at 1 kg per 100 sq ft, blending evenly into beds. For LawnCal, spread using granular turf equipment uniformly across sports lawns.'
                  : 'Take 2 capsules daily (or 1 capsule daily for Combo Collagen) with plenty of water. Can be consumed with or without food. Consistency over weeks is recommended for structural protein benefits.'}
              </p>
            </div>
          </section>

          {/* 8. TECHNICAL SPECIFICATIONS */}
          <section className="container-page max-w-3xl">
            <h2 className="text-heading-2 mb-6 text-center">Technical Specifications</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border border-edge rounded bg-surface p-6">
              {[
                { label: 'Source Material', value: 'Purified Eggshell Membrane (ESM) / Shell' },
                { label: 'Form', value: isAgri ? 'Powder Blend / Granules' : 'Capsules' },
                { label: 'Shelf Life', value: '24 Months' },
                { label: 'Storage', value: 'Store in a cool, dry place away from direct sunlight.' },
                { label: 'Compliance', value: 'GMP Compliant Facility, UK GPSR Aligned' }
              ].map((spec, i) => (
                <div key={i} className="border-b border-edge-subtle pb-2">
                  <span className="block text-[10px] uppercase font-bold text-brand-muted">{spec.label}</span>
                  <span className="text-xs font-medium text-ink-primary mt-1 block">{spec.value}</span>
                </div>
              ))}
            </div>
          </section>

          {/* 9. COA & DOCUMENTATION */}
          <section className="bg-brand-bg border-y border-edge py-12">
            <div className="container-page text-center max-w-xl">
              <span className="kicker">Downloads</span>
              <h2 className="text-heading-2 mt-2">Product Documentation</h2>
              <p className="mt-3 text-xs text-ink-secondary mb-6">
                Download verified certificate sheets and safety reports.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Link href="/resources/spec-sheets" className="btn-primary inline-flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider">
                  <FileDown className="h-4 w-4" /> Spec Sheet
                </Link>
                <Link href="/resources/whitepapers" className="btn-ghost inline-flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider">
                  <BookOpen className="h-4 w-4" /> Whitepaper
                </Link>
              </div>
            </div>
          </section>

          {/* 10. FAQs */}
          <section className="container-page max-w-2xl">
            <h2 className="text-heading-2 mb-6 text-center">Frequently Asked Questions</h2>
            <div className="space-y-3">
              {productFaqs.map((faq, i) => (
                <div key={i} className="border border-edge rounded bg-surface overflow-hidden">
                  <button onClick={() => setOpenFaq(openFaq === i ? null : i)} className="w-full flex items-center justify-between px-5 py-4 text-left font-bold text-xs text-ink-primary hover:text-ink-accent transition-colors">
                    <span>{faq.q}</span>
                    <ChevronRight className={`h-4.5 w-4.5 text-ink-muted transition-transform ${openFaq === i ? 'rotate-90' : ''}`} />
                  </button>
                  {openFaq === i && (
                    <p className="px-5 py-4 border-t border-edge-subtle text-xs text-ink-secondary bg-surface-muted/50 leading-relaxed">
                      {faq.a}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* 11. RELATED PRODUCTS */}
          <section className="container-page border-t border-edge pt-12">
            <h2 className="text-heading-2 mb-8 text-center">Related Products</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {relatedProductsList.map((rp, i) => (
                <div key={i} className="p-5 border border-edge bg-surface rounded shadow-card hover:border-edge-strong transition-all duration-300 flex flex-col justify-between">
                  <div>
                    <h4 className="text-[10px] uppercase font-bold text-brand-muted">{rp.cat}</h4>
                    <h3 className="font-display text-xs font-bold text-ink-primary mt-1">{rp.name}</h3>
                  </div>
                  <Link href={`/${rp.cat}/${rp.slug}`} className="mt-4 text-xs font-semibold text-brand-muted hover:underline flex items-center gap-0.5">
                    View Product <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          </section>

        </div>
      </StoreShell>
    );
  }

  // -------------------------------------------------------------
  // RENDER CMS PAGE OR STATIC FALLBACK SUBPAGE
  // -------------------------------------------------------------
  const displayTitle = cmsPage?.title || staticFallback?.title;
  const displayDesc = cmsPage?.meta_description || staticFallback?.desc;
  const displayContent = cmsPage?.content;
  const displaySections = staticFallback?.sections;

  if (displayTitle) {
    return (
      <StoreShell>
        <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
          <span className="kicker uppercase font-bold tracking-wider text-brand-muted">{category} / {slug}</span>
          <h1 className="text-display mt-2 leading-tight">{displayTitle}</h1>
          {displayDesc && (
            <p className="mt-4 text-sm leading-[1.8] text-ink-secondary font-medium border-l-2 border-brand-accent pl-4 py-1">
              {displayDesc}
            </p>
          )}

          <div className="mt-10 space-y-6">
            {displayContent ? (
              <div className="prose-content space-y-4 text-xs sm:text-sm leading-relaxed text-ink-secondary">
                {parseMarkdownBlocks(displayContent).map((b, i) => {
                  if (b.type === 'h1') return <h2 key={i} className="text-heading-2 mt-8 mb-4">{renderInlineMarkdown(b.text, `h1-${i}`)}</h2>;
                  if (b.type === 'h2') return <h3 key={i} className="text-heading-3 mt-6 mb-3">{renderInlineMarkdown(b.text, `h2-${i}`)}</h3>;
                  if (b.type === 'ul') return (
                    <ul key={i} className="list-disc space-y-1.5 pl-6 my-4">
                      {b.items.map((it, j) => <li key={j}>{renderInlineMarkdown(it, `li-${i}-${j}`)}</li>)}
                    </ul>
                  );
                  return <p key={i}>{renderInlineMarkdown(b.text, `p-${i}`)}</p>;
                })}
              </div>
            ) : (
              <div className="space-y-8">
                {displaySections?.map((section, idx) => (
                  <div key={idx} className="border-b border-edge-subtle pb-6 last:border-0">
                    <h3 className="font-display text-sm font-bold text-ink-primary mb-2">{section.h}</h3>
                    <p className="text-xs sm:text-sm text-ink-secondary leading-relaxed">{section.p}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-16 pt-8 border-t border-edge-subtle flex justify-between items-center">
            <Link href={`/${category}`} className="text-xs font-semibold text-brand-muted hover:underline flex items-center gap-1">
              ← Return to {category}
            </Link>
            <Link href="/contact" className="text-xs font-semibold text-ink-accent hover:underline">
              Partner Enquiry
            </Link>
          </div>
        </article>
      </StoreShell>
    );
  }

  // -------------------------------------------------------------
  // FALLBACK: PAGE NOT FOUND
  // -------------------------------------------------------------
  return (
    <StoreShell>
      <div className="container-page py-20 text-center">
        <h1 className="text-display">Page not found</h1>
        <p className="mt-4 text-sm text-ink-secondary">The requested subpage does not exist.</p>
        <Link href="/" className="btn-primary mt-8 px-6 py-3 text-xs inline-block">Return Home</Link>
      </div>
    </StoreShell>
  );
}
