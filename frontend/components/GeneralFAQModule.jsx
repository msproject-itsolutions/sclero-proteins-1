'use client';

import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, HelpCircle, AlertCircle } from 'lucide-react';
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
      <div className="space-y-4 max-w-4xl mx-auto py-8">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-lg border border-edge bg-white p-5 space-y-3">
            <div className="h-4 w-2/3 bg-surface-muted rounded-sm" />
            <div className="h-3.5 w-full bg-surface-muted rounded-sm" />
            <div className="h-3.5 w-5/6 bg-surface-muted rounded-sm" />
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
    <div className="w-full max-w-4xl mx-auto space-y-6">
      
      {/* Search & Category Filter Header */}
      <div className="bg-white/80 border border-edge rounded-lg p-5 shadow-sm backdrop-blur-md space-y-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Search questions or keywords..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setExpandedIndex(null);
            }}
            className="w-full pl-10 pr-4 py-2.5 rounded-sm border border-edge text-xs md:text-sm text-ink-primary focus:outline-none focus:border-ink-accent focus:ring-1 focus:ring-ink-accent font-semibold"
          />
          <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-brand-muted pointer-events-none" />
        </div>

        {/* Category Pill Buttons */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none flex-wrap">
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
      <div className="space-y-3">
        {filteredFaqs.map((faq, idx) => {
          const isOpen = expandedIndex === idx;
          const categoryName = faq.category || 'General';
          return (
            <div
              key={faq.id || idx}
              className="border border-edge rounded-lg overflow-hidden bg-white hover:border-edge-strong shadow-xs transition-all duration-300"
            >
              <button
                type="button"
                onClick={() => setExpandedIndex(isOpen ? null : idx)}
                className="w-full flex justify-between items-start gap-4 p-4 md:p-5 text-left transition-colors hover:bg-surface-muted"
              >
                <div className="space-y-1">
                  <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-brand-success bg-brand-success/10 px-2 py-0.5 rounded-sm">
                    {categoryName}
                  </span>
                  <h4 className="font-semibold text-xs md:text-sm text-ink-primary flex gap-2 items-start pt-1">
                    <HelpCircle className="h-4.5 w-4.5 text-ink-accent shrink-0 mt-0.5" />
                    <span>{faq.question}</span>
                  </h4>
                </div>
                <ChevronDown className={`h-4.5 w-4.5 text-brand-muted shrink-0 mt-3 transition-transform duration-300 ${isOpen ? 'rotate-180 text-ink-accent' : ''}`} />
              </button>

              <div
                className={`transition-all duration-300 ease-in-out overflow-hidden ${
                  isOpen ? 'max-h-96 border-t border-edge-subtle p-5 bg-surface-muted' : 'max-h-0'
                }`}
              >
                <p className="text-xs md:text-sm leading-relaxed text-ink-secondary whitespace-pre-line">
                  {faq.answer}
                </p>
              </div>
            </div>
          );
        })}

        {filteredFaqs.length === 0 && (
          <div className="text-center py-12 bg-white border border-edge rounded-lg text-brand-muted space-y-2">
            <HelpCircle className="h-10 w-10 mx-auto text-edge-strong" />
            <p className="text-xs font-semibold">No questions matched your search criteria.</p>
          </div>
        )}
      </div>

    </div>
  );
}
