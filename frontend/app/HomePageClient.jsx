'use client';

import React, { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Check,
  FlaskConical,
  HeartHandshake,
  Leaf,
  Minus,
  Plus,
  Shield,
  Send,
  ShieldCheck,
  Sparkles,
  Truck,
  X,
} from 'lucide-react';
import StoreShell from '../components/StoreShell';
import HeroSection from '../components/HeroSection';
import ProductCatalog from '../components/ProductCatalog';
import QuizComponent from '../components/QuizComponent';
import { postJson } from '../lib/api';
import { normalizeHomepageSettings } from '../lib/homepageContent';
import { safePublicHref } from '../lib/safeUrl';
import { firstApiError, validateEnquiry } from '../lib/formValidation';

const EDUCATION_FALLBACKS = [
  {
    title: 'Understanding joint mobility nutrition',
    author: 'Sclero Advisory',
    description: 'A practical guide to collagen, cartilage support, and the cofactors that help them work together.',
  },
  {
    title: 'How to read supplement labels with confidence',
    author: 'Clinical Education',
    description: 'Learn how to spot filler-heavy formulas and compare active ingredient levels in minutes.',
  },
  {
    title: 'Why low-heat processing matters',
    author: 'Product Research',
    description: 'See how ingredient handling can affect the integrity of delicate protein structures.',
  },
];

const ICON_MAP = {
  FlaskConical,
  ShieldCheck,
  Truck,
  HeartHandshake,
  Shield,
  BadgeCheck,
  Leaf,
  Sparkles,
};

function resolveIcon(iconName, fallback) {
  return ICON_MAP[iconName] || fallback;
}

export default function HomePageClient({ initialBlogs = [], initialHomepageSettings }) {
  const currentRegion = useSelector((state) => state.region.currentRegion);
  const branding = useSelector((state) => state.region.branding);
  const whatsappNumber = currentRegion === 'IN'
    ? branding?.whatsappNumberIN
    : branding?.whatsappNumberUK;

  const [quizOpen, setQuizOpen] = useState(false);
  const [inquiryName, setInquiryName] = useState('');
  const [inquiryEmail, setInquiryEmail] = useState('');
  const [inquiryMessage, setInquiryMessage] = useState('');
  const [inquirySent, setInquirySent] = useState(false);
  const [inquiryError, setInquiryError] = useState('');
  const [inquirySubmitting, setInquirySubmitting] = useState(false);
  const [cartOpenTrigger, setCartOpenTrigger] = useState(null);
  const [expandedFaq, setExpandedFaq] = useState(0);
  const homepageSettings = useMemo(
    () => normalizeHomepageSettings(initialHomepageSettings),
    [initialHomepageSettings]
  );
  const showcaseTabs = homepageSettings.productShowcase?.tabs || [];
  const [activeShowcase, setActiveShowcase] = useState(showcaseTabs[0]?.key || 'bestsellers');

  const educationEntries = useMemo(
    () => (initialBlogs.length > 0 ? initialBlogs : EDUCATION_FALLBACKS),
    [initialBlogs]
  );

  const productShowcases = useMemo(
    () => showcaseTabs.reduce((acc, item) => {
      acc[item.key] = item;
      return acc;
    }, {}),
    [showcaseTabs]
  );

  React.useEffect(() => {
    if (!productShowcases[activeShowcase] && showcaseTabs[0]?.key) {
      setActiveShowcase(showcaseTabs[0].key);
    }
  }, [activeShowcase, productShowcases, showcaseTabs]);

  const handleInquirySubmit = async (e) => {
    e.preventDefault();
    setInquiryError('');
    const { cleaned, error } = validateEnquiry({
      name: inquiryName,
      email: inquiryEmail,
      message: inquiryMessage,
    });
    if (error) {
      setInquiryError(error);
      return;
    }
    setInquirySubmitting(true);

    try {
      const { response, data } = await postJson('/api/enquiries/', {
        ...cleaned,
        enquiry_type: 'OTHER',
        product_interest: 'Homepage enquiry',
      });
      if (!response.ok) throw new Error(firstApiError(data, 'Could not send your message.'));
      setInquirySent(true);
      setInquiryName('');
      setInquiryEmail('');
      setInquiryMessage('');
    } catch (error) {
      setInquiryError(error.message || 'Could not send your message.');
    } finally {
      setInquirySubmitting(false);
    }
  };

  return (
    <StoreShell cartOpenSignal={cartOpenTrigger}>
      <HeroSection />

      {homepageSettings.trustSection.enabled !== false && (
      <section className="border-b border-edge bg-white">
        <div className="container-page py-10 md:py-12">
          <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-start lg:gap-10">
            <div className="reveal max-w-[40rem] pt-1">
              <span className="kicker">{homepageSettings.trustSection.kicker}</span>
              <h2 className="mt-3 max-w-[11ch] text-[clamp(2.4rem,4vw,3.65rem)] font-bold leading-[0.98] tracking-[-0.04em] text-ink-primary">
                {homepageSettings.trustSection.title}
              </h2>
              <p className="mt-4 max-w-[34rem] text-[1.02rem] leading-[1.8] text-ink-secondary md:text-[1.08rem]">
                {homepageSettings.trustSection.description}
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3 lg:self-start">
              {homepageSettings.trustSection.cards.map((item) => {
                const Icon = resolveIcon(item.icon, FlaskConical);
                return (
                  <div key={item.title} className="reveal rounded-[24px] border border-edge bg-surface-subtle p-5 shadow-card lg:min-h-[228px]">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-ink-accent shadow-card">
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 text-[1.12rem] font-bold leading-[1.2] text-ink-primary">{item.title}</h3>
                    <p className="mt-3 text-[0.98rem] leading-[1.8] text-ink-secondary">{item.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>
      )}

      {homepageSettings.productShowcase.enabled !== false && (
      <section className="section bg-white pb-16 pt-10 md:pb-20 md:pt-12">
        <div className="container-page">
          <div className="reveal flex flex-wrap items-center gap-3">
            {showcaseTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveShowcase(tab.key)}
                className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300 ${
                  activeShowcase === tab.key
                    ? 'bg-brand-gradient text-white shadow-card'
                    : 'border border-edge bg-white text-ink-primary hover:border-edge-strong hover:bg-surface-subtle'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div key={activeShowcase} className="animate-fade-in">
          <ProductCatalog
            id={productShowcases[activeShowcase]?.key || 'bestsellers'}
            title={productShowcases[activeShowcase]?.label}
            subtitle={productShowcases[activeShowcase]?.subtitle}
            limit={productShowcases[activeShowcase]?.limit || 4}
            apiSort={productShowcases[activeShowcase]?.apiSort || 'bestseller'}
            showRating={false}
            className="pb-0 pt-8"
            onOpenCart={() => setCartOpenTrigger(Date.now())}
          />
        </div>

        <div className="container-page mt-10 flex justify-center md:mt-12">
          <Link href={safePublicHref(homepageSettings.productShowcase.ctaUrl) || '/products'} className="btn-ghost px-8 py-3.5 text-sm">
            {homepageSettings.productShowcase.ctaLabel} <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
      )}

      {homepageSettings.quizSection.enabled !== false && (
      <section className="section bg-surface-subtle">
        <div className="container-page">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="reveal max-w-2xl">
              <span className="kicker">{homepageSettings.quizSection.kicker}</span>
              <h2 className="text-heading-1 mt-3">{homepageSettings.quizSection.title}</h2>
              <p className="mt-4 max-w-xl text-body">
                {homepageSettings.quizSection.description}
              </p>
            </div>
            <div className="reveal rounded-[28px] border border-edge bg-white p-8 shadow-card">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-gradient text-white shadow-card">
                {React.createElement(resolveIcon(homepageSettings.quizSection.icon, HeartHandshake), { className: 'h-6 w-6' })}
              </div>
              <p className="mt-4 text-sm leading-[1.8] text-ink-secondary">
                {homepageSettings.quizSection.cardDescription}
              </p>
              <button
                type="button"
                onClick={() => setQuizOpen(true)}
                className="btn-primary mt-5 px-8 py-3.5 text-sm"
              >
                {homepageSettings.quizSection.buttonLabel}
              </button>
            </div>
          </div>
        </div>
      </section>
      )}

      {homepageSettings.chooseSection.enabled !== false && (
      <section className="section bg-white">
        <div className="container-page">
          <div className="reveal max-w-2xl">
            <span className="kicker">{homepageSettings.chooseSection.kicker}</span>
            <h2 className="text-heading-1 mt-3">{homepageSettings.chooseSection.title}</h2>
            <p className="mt-4 text-body">
              {homepageSettings.chooseSection.description}
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {homepageSettings.chooseSection.cards.map((card) => {
              const Icon = resolveIcon(card.icon, FlaskConical);
              return (
                <div key={card.title} className="reveal rounded-[28px] border border-edge bg-white p-7 shadow-card">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle text-ink-accent">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-ink-primary">{card.title}</h3>
                  <p className="mt-3 text-sm leading-[1.8] text-ink-secondary">{card.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      )}

      {homepageSettings.comparisonSection.enabled !== false && (
      <section className="section bg-surface-subtle">
        <div className="container-page">
          <div className="reveal text-center">
            <span className="kicker">{homepageSettings.comparisonSection.kicker}</span>
            <h2 className="text-heading-1 mt-3">{homepageSettings.comparisonSection.title}</h2>
            <p className="mx-auto mt-4 max-w-3xl text-body">
              {homepageSettings.comparisonSection.description}
            </p>
          </div>

          <div className="reveal mt-10 overflow-hidden rounded-[32px] border border-edge bg-white shadow-elevated">
            <div className="grid grid-cols-[1.1fr_1fr_1fr] border-b border-edge bg-surface-subtle">
              <div className="px-5 py-5 text-sm font-semibold text-ink-primary sm:px-7">{homepageSettings.comparisonSection.headers.left}</div>
              <div className="bg-brand-gradient px-5 py-5 text-sm font-bold text-white sm:px-7">{homepageSettings.comparisonSection.headers.middle}</div>
              <div className="px-5 py-5 text-sm font-semibold text-ink-primary sm:px-7">{homepageSettings.comparisonSection.headers.right}</div>
            </div>

            {homepageSettings.comparisonSection.rows.map((row, index) => (
              <div
                key={row.label}
                className={`grid grid-cols-[1.1fr_1fr_1fr] ${index !== homepageSettings.comparisonSection.rows.length - 1 ? 'border-b border-edge' : ''}`}
              >
                <div className="px-5 py-5 text-sm font-semibold text-ink-primary sm:px-7">{row.label}</div>
                <div className="bg-brand-gradient-soft px-5 py-5 text-sm leading-[1.75] text-ink-primary sm:px-7">
                  <span className="inline-flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-ink-accent" />
                    {row.sclero}
                  </span>
                </div>
                <div className="px-5 py-5 text-sm leading-[1.75] text-ink-secondary sm:px-7">{row.others}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      )}

      {homepageSettings.ingredientsSection.enabled !== false && (
      <section className="section bg-surface-subtle">
        <div className="container-page">
          <div className="grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16">
            <div className="reveal order-2 lg:order-1">
              <div className="overflow-hidden rounded-[34px] border border-edge bg-white shadow-elevated">
                <img
                  src={homepageSettings.ingredientsSection.imageUrl}
                  alt={homepageSettings.ingredientsSection.imageAlt}
                  className="h-full min-h-[420px] w-full object-cover"
                />
              </div>
            </div>
            <div className="reveal order-1 lg:order-2">
              <span className="kicker">{homepageSettings.ingredientsSection.kicker}</span>
              <h2 className="text-heading-1 mt-3">{homepageSettings.ingredientsSection.title}</h2>
              <p className="mt-5 text-body">
                {homepageSettings.ingredientsSection.description}
              </p>
              <div className="mt-8 space-y-4">
                {homepageSettings.ingredientsSection.cards.map((item) => (
                  <div key={item.title} className="rounded-[24px] border border-edge bg-white p-5 shadow-card">
                    <div className="flex items-start gap-4">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-ink-accent">
                        <Leaf className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-ink-primary">{item.title}</h3>
                        <p className="mt-2 text-sm leading-[1.8] text-ink-secondary">{item.benefit}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {homepageSettings.conversionSection.enabled !== false && (
      <section className="section bg-white">
        <div className="container-page">
          <div className="grid items-center gap-10 overflow-hidden rounded-[34px] border border-edge bg-[linear-gradient(90deg,#FFFFFF_0%,#F6F4FB_52%,#E8F5FF_100%)] p-8 shadow-elevated lg:grid-cols-[0.9fr_1.1fr] lg:p-10">
            <div className="reveal">
              <span className="kicker">{homepageSettings.conversionSection.kicker}</span>
              <h2 className="text-heading-1 mt-3">{homepageSettings.conversionSection.title}</h2>
              <p className="mt-4 max-w-xl text-body">
                {homepageSettings.conversionSection.description}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={homepageSettings.conversionSection.primaryCtaUrl} className="btn-primary px-7 py-3.5 text-sm">
                  {homepageSettings.conversionSection.primaryCtaLabel}
                </Link>
                <Link href={homepageSettings.conversionSection.secondaryCtaUrl} className="btn-ghost px-7 py-3.5 text-sm">
                  {homepageSettings.conversionSection.secondaryCtaLabel}
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                {homepageSettings.conversionSection.badges.map((badge) => {
                  const Icon = resolveIcon(badge.icon, ShieldCheck);
                  return (
                    <div key={badge.title} className="inline-flex items-center gap-2 rounded-full border border-edge bg-white px-4 py-2 text-sm font-semibold text-ink-primary shadow-card">
                      <Icon className="h-4 w-4 text-ink-accent" />
                      {badge.title}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="reveal rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-card backdrop-blur">
              <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-ink-accent">{homepageSettings.conversionSection.proofLabel}</p>
              <h3 className="mt-3 text-[36px] font-extrabold leading-[1.05] text-ink-primary">
                {homepageSettings.conversionSection.quoteTitle}
              </h3>
              <p className="mt-4 text-sm font-semibold text-ink-primary">{homepageSettings.conversionSection.quoteBody}</p>
              <div className="mt-6 rounded-[24px] border border-edge bg-white p-5">
                <div className="flex items-center gap-2 text-sm font-semibold text-ink-accent">
                  <Sparkles className="h-4 w-4" />
                  Cleaner labels. Easier comparison. Stronger buying confidence.
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {homepageSettings.conversionSection.proofHighlights.map((item) => (
                    <div key={item.value} className="rounded-[20px] bg-surface-subtle p-4 text-center">
                      <p className="text-2xl font-extrabold text-ink-primary">{item.value}</p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

      {homepageSettings.faqSection.enabled !== false && (
      <section className="section border-y border-edge bg-white">
        <div className="container-page">
          <div className="reveal text-center">
            <h2 className="text-[40px] font-extrabold leading-[1.1] tracking-tight text-ink-primary sm:text-[52px]">
              {homepageSettings.faqSection.kicker}
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-body">{homepageSettings.faqSection.description}</p>
          </div>

          <div className="mt-12 grid gap-x-8 gap-y-5 md:grid-cols-2 md:items-start">
            {homepageSettings.faqSection.items.map((faq, index) => {
              const isOpen = expandedFaq === index;
              return (
                <div key={faq.question} className="reveal overflow-hidden rounded-[18px] bg-surface-subtle">
                  <button
                    type="button"
                    onClick={() => setExpandedFaq(isOpen ? null : index)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center justify-between gap-4 px-6 py-6 text-left"
                  >
                    <span className="text-sm font-semibold uppercase tracking-[0.06em] leading-[1.5] text-ink-primary">
                      {faq.question}
                    </span>
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink-primary/40 text-ink-primary">
                      {isOpen ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                    </span>
                  </button>
                  <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-64' : 'max-h-0'}`}>
                    <p className="px-6 pb-6 text-sm leading-[1.8] text-ink-secondary">{faq.answer}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      )}

      {homepageSettings.educationSection.enabled !== false && (
      <section id="blog" className="section bg-white">
        <div className="container-page">
          <div className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="reveal max-w-2xl">
              <span className="kicker">{homepageSettings.educationSection.kicker}</span>
              <h2 className="text-heading-1 mt-3">{homepageSettings.educationSection.title}</h2>
              <p className="mt-4 text-body">
                {homepageSettings.educationSection.description}
              </p>
            </div>
            <Link href={safePublicHref(homepageSettings.educationSection.ctaUrl) || '/blog'} className="reveal inline-flex items-center gap-2 text-sm font-semibold text-ink-primary transition-colors hover:text-ink-accent">
              {homepageSettings.educationSection.ctaLabel} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {educationEntries.map((entry) => {
              const href = entry.slug ? `/blog/${entry.slug}` : '/blog';
              const excerpt = entry.meta_description || entry.content || entry.description;

              return (
                <article key={entry.slug || entry.title} className="reveal flex h-full flex-col rounded-[28px] border border-edge bg-surface-subtle p-7 shadow-card">
                  <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-ink-accent">
                    <FlaskConical className="h-3.5 w-3.5" /> {entry.author || 'Sclero Proteins'}
                  </div>
                  <h3 className="mt-5 text-[24px] font-bold leading-[1.15] text-ink-primary">{entry.title}</h3>
                  <p className="mt-4 flex-1 text-sm leading-[1.8] text-ink-secondary line-clamp-4">{excerpt}</p>
                  <Link href={href} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-ink-primary transition-colors hover:text-ink-accent">
                    Read guide <ArrowRight className="h-4 w-4" />
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>
      )}

      {homepageSettings.inquirySection.enabled !== false && (
      <section className="section bg-surface-subtle">
        <div className="container-page">
          <div className="grid gap-8 rounded-[32px] border border-edge bg-white p-8 shadow-card md:p-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="reveal">
              <span className="kicker">{homepageSettings.inquirySection.kicker}</span>
              <h2 className="text-heading-1 mt-3">{homepageSettings.inquirySection.title}</h2>
              <p className="mt-4 max-w-md text-body">
                {homepageSettings.inquirySection.description}
              </p>
            </div>

            <div className="reveal">
              {inquirySent ? (
                <div className="rounded-[28px] border border-edge bg-surface-subtle p-8 text-center">
                  <Check className="mx-auto h-8 w-8 text-ink-accent" />
                  <p className="mt-4 text-sm font-semibold text-ink-primary">
                    {homepageSettings.inquirySection.successMessage}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleInquirySubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <input
                      type="text"
                      placeholder="Your name"
                      autoComplete="name"
                      value={inquiryName}
                      onChange={(e) => setInquiryName(e.target.value)}
                      className="input-base"
                      required
                    />
                    <input
                      type="email"
                      placeholder="Email address"
                      autoComplete="email"
                      value={inquiryEmail}
                      onChange={(e) => setInquiryEmail(e.target.value)}
                      className="input-base"
                      required
                    />
                  </div>
                  <textarea
                    placeholder="Tell us how we can help"
                    value={inquiryMessage}
                    onChange={(e) => setInquiryMessage(e.target.value)}
                    rows={5}
                    className="input-base resize-none"
                    required
                    minLength={10}
                  />
                  {inquiryError && (
                    <p className="rounded-sm border border-ink-danger/20 bg-surface-muted px-3 py-2 text-xs font-semibold text-ink-danger">{inquiryError}</p>
                  )}
                  <button type="submit" disabled={inquirySubmitting} className="btn-primary w-full py-3 text-sm disabled:opacity-60">
                    <Send className="h-4 w-4" />
                    {inquirySubmitting ? 'Sending…' : homepageSettings.inquirySection.buttonLabel}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
      )}

      {quizOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[32px] border border-edge bg-white p-4 shadow-overlay sm:p-6">
            <button
              type="button"
              onClick={() => setQuizOpen(false)}
              className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border border-edge bg-surface text-ink-primary transition-colors hover:border-edge-strong"
              aria-label="Close quiz"
            >
              <X className="h-4 w-4" />
            </button>
            <QuizComponent
              onComplete={(result) => {
                setQuizOpen(false);
                window.location.href = `/products/${result.recommendation.sku}`;
              }}
            />
          </div>
        </div>
      )}

      {whatsappNumber && (
      <a
        href={`https://wa.me/${whatsappNumber.replace(/[^\d]/g, '')}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Chat on WhatsApp"
        className="group fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-elevated transition-transform hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[#25D366]/40"
      >
        <svg className="h-7 w-7 fill-white" viewBox="0 0 24 24">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.003 5.324 5.328 0 11.859 0c3.166.001 6.141 1.233 8.378 3.469 2.237 2.235 3.469 5.211 3.468 8.378-.003 6.534-5.328 11.858-11.86 11.858-2.001 0-3.968-.507-5.714-1.478L0 24zm6.577-3.472l.409.243c1.517.901 3.254 1.377 5.023 1.378 5.437 0 9.859-4.422 9.863-9.863.002-2.635-1.023-5.113-2.884-6.975C17.186 3.45 14.705 2.427 12.07 2.425c-5.441 0-9.863 4.42-9.867 9.863-.001 1.83.479 3.618 1.39 5.131l.267.443-1.002 3.66 3.774-.994zM16.14 13.12c-.27-.135-1.602-.79-1.85-.88-.25-.09-.43-.135-.61.135-.18.27-.69.88-.84 1.05-.15.17-.3.19-.57.06-.27-.135-1.14-.42-2.17-1.34-.8-.71-1.34-1.6-1.5-1.87-.16-.27-.02-.42.11-.55.12-.12.27-.3.4-.45.13-.15.18-.25.27-.41.09-.17.05-.31-.02-.45-.07-.14-.61-1.47-.84-2.01-.22-.53-.48-.46-.66-.47-.17-.01-.37-.01-.57-.01-.2 0-.52.075-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.47 1.07 2.89 1.22 3.09.15.2 2.1 3.2 5.09 4.49.71.3 1.27.49 1.7.63.72.22 1.37.19 1.88.11.57-.08 1.6-.66 1.83-1.28.23-.61.23-1.14.16-1.28-.07-.14-.25-.22-.52-.35z" />
        </svg>
        <span className="absolute right-16 scale-0 whitespace-nowrap rounded-full bg-[#101871] px-3 py-1.5 text-[11px] font-semibold text-white shadow-overlay transition-all group-hover:scale-100">
          Chat with us
        </span>
      </a>
      )}
    </StoreShell>
  );
}
