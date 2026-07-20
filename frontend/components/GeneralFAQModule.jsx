'use client';

import React, { useState, useEffect } from 'react';
import { Search, Plus, Minus, HelpCircle, AlertCircle } from 'lucide-react';
import { getApiUrl } from '../lib/api';

export default function GeneralFAQModule() {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [expandedIndex, setExpandedIndex] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(false);
    fetch(getApiUrl('/api/faqs/'))
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch FAQs');
        return res.json();
      })
      .then((data) => {
        setFaqs(Array.isArray(data) ? data : data.results || []);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  // Extract unique categories
  const categories = ['All', ...new Set(faqs.map(faq => faq.category || 'General'))];

  // Filter FAQs based on search and active category
  const filteredFaqs = faqs.filter((faq) => {
    const matchesSearch =
      faq.question.toLowerCase().includes(search.toLowerCase()) ||
      faq.answer.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory =
      activeCategory === 'All' ||
      (faq.category || 'General') === activeCategory;

    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="grid w-full gap-x-8 gap-y-5 py-8 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-[18px] bg-surface-subtle px-6 py-6">
            <div className="h-4 w-2/3 rounded-sm bg-surface-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto my-8 p-6 bg-red-50 border border-red-200 rounded-lg text-center space-y-3">
        <AlertCircle className="h-10 w-10 text-red-500 mx-auto" />
        <h4 className="font-semibold text-ink-primary">Unable to load FAQs</h4>
        <p className="text-xs text-brand-muted">Please check your internet connection or try again later.</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-8">

      {/* Search & Category Filter Header */}
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Search questions or keywords..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setExpandedIndex(null);
            }}
            className="w-full rounded-full border border-edge bg-white py-3 pl-11 pr-4 text-sm font-semibold text-ink-primary focus:border-ink-accent focus:outline-none focus:ring-1 focus:ring-ink-accent"
          />
          <Search className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-brand-muted" />
        </div>

        {/* Category Pill Buttons */}
        <div className="flex flex-wrap justify-center gap-2 pb-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setExpandedIndex(null);
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all border ${
                activeCategory === cat
                  ? 'bg-ink-primary border-ink-primary text-white'
                  : 'bg-white border-edge text-brand-muted hover:text-ink-primary'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Accordion List */}
      <div className="grid gap-x-8 gap-y-5 md:grid-cols-2 md:items-start">
        {filteredFaqs.map((faq, idx) => {
          const isOpen = expandedIndex === idx;
          const categoryName = faq.category || 'General';
          return (
            <div
              key={faq.id || idx}
              className="overflow-hidden rounded-[18px] bg-surface-subtle transition-colors duration-300 hover:bg-surface-muted"
            >
              <button
                type="button"
                onClick={() => setExpandedIndex(isOpen ? null : idx)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
              >
                <span className="space-y-1.5">
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-brand-muted">
                    {categoryName}
                  </span>
                  <span className="block text-sm font-semibold uppercase leading-[1.5] tracking-[0.06em] text-ink-primary">
                    {faq.question}
                  </span>
                </span>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink-primary/40 text-ink-primary">
                  {isOpen ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                </span>
              </button>

              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96' : 'max-h-0'}`}>
                <p className="whitespace-pre-line px-6 pb-6 text-sm leading-[1.8] text-ink-secondary">
                  {faq.answer}
                </p>
              </div>
            </div>
          );
        })}

        {filteredFaqs.length === 0 && (
          <div className="space-y-2 rounded-[18px] bg-surface-subtle py-12 text-center text-brand-muted md:col-span-2">
            <HelpCircle className="mx-auto h-10 w-10 text-edge-strong" />
            <p className="text-xs font-semibold">No questions matched your search criteria.</p>
          </div>
        )}
      </div>

    </div>
  );
}
