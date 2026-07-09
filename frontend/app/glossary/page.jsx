'use client';

import React, { useState, useMemo } from 'react';
import { useGlossary } from '../../components/GlossaryContext';
import StoreShell from '../../components/StoreShell';
import { BookOpen, Search, HelpCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function GlossaryPage() {
  const { terms } = useGlossary();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Dynamically extract categories from glossary terms
  const categories = useMemo(() => {
    const cats = new Set(['All']);
    terms.forEach((t) => {
      if (t.category) {
        cats.add(t.category);
      }
    });
    return Array.from(cats);
  }, [terms]);

  // Filter terms by search query and category
  const filteredTerms = useMemo(() => {
    return terms.filter((t) => {
      const matchesSearch = t.term.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            t.definition.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || t.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [terms, searchQuery, selectedCategory]);

  // Group terms alphabetically
  const groupedTerms = useMemo(() => {
    const groups = {};
    filteredTerms.forEach((t) => {
      const firstLetter = t.term.charAt(0).toUpperCase();
      if (!groups[firstLetter]) {
        groups[firstLetter] = [];
      }
      groups[firstLetter].push(t);
    });
    // Sort keys alphabetically
    return Object.keys(groups)
      .sort()
      .reduce((obj, key) => {
        obj[key] = groups[key];
        return obj;
      }, {});
  }, [filteredTerms]);

  return (
    <StoreShell>
      <title>Sclero Glossary | Avian Bioactives &amp; Active Nutrition Dictionary</title>
      <meta name="description" content="Explore Sclero Proteins technical dictionary. Learn about collagen types I, V, X, calcite crystal lattices, and bio-mineralization science." />
      
      <main className="min-h-screen bg-brand-bg py-12 md:py-20">
        <div className="container-page max-w-5xl">
          
          {/* Header Section */}
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="kicker">Scientific Terminology</span>
            <h1 className="text-display mt-3">Sclero Glossary</h1>
            <p className="mt-4 text-xs md:text-sm text-ink-secondary leading-relaxed">
              Understand the science behind Sclero Proteins. Explore definitions of our avian-derived ingredients, bioactives, extraction technologies, and clinical parameters.
            </p>
          </div>

          {/* Search & Filter Bar */}
          <div className="bg-white border border-edge rounded-lg p-5 shadow-card space-y-4 mb-10">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted" />
              <input
                type="text"
                placeholder="Search technical terms, abbreviations, or definitions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-surface-subtle border border-edge rounded-md text-xs md:text-sm text-ink-primary placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-edge-focus/30 focus:border-edge-focus transition-all"
              />
            </div>

            {/* Category Filters */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-edge-subtle">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-sm text-[10px] md:text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
                    selectedCategory === cat
                      ? 'bg-brand-accent text-white shadow-sm'
                      : 'bg-surface-muted text-ink-secondary hover:bg-edge/40'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Glossary Terms Listing */}
          {Object.keys(groupedTerms).length > 0 ? (
            <div className="space-y-12">
              {Object.entries(groupedTerms).map(([letter, items]) => (
                <section key={letter} className="grid grid-cols-1 md:grid-cols-4 gap-6 border-t border-edge-subtle pt-8">
                  {/* Letter Header */}
                  <div className="md:col-span-1">
                    <h2 className="font-display text-4xl font-bold text-brand-accent leading-none">{letter}</h2>
                  </div>
                  
                  {/* Terms in this letter group */}
                  <div className="md:col-span-3 space-y-6">
                    {items.map((item) => (
                      <article
                        key={item.id}
                        id={`term-${item.term.toLowerCase().replace(/\s+/g, '-')}`}
                        className="bg-white border border-edge rounded-lg p-6 hover:shadow-card hover:border-edge-strong transition-all duration-300"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                          <h3 className="font-display text-base font-bold text-ink-primary tracking-wide">
                            {item.term}
                          </h3>
                          {item.category && (
                            <span className="rounded bg-surface-muted text-brand-accent px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                              {item.category}
                            </span>
                          )}
                        </div>
                        <p className="text-xs md:text-sm text-ink-secondary leading-relaxed">
                          {item.definition}
                        </p>
                        {item.image_url && (
                          <div className="mt-4 max-w-md rounded overflow-hidden border border-edge-subtle">
                            <img src={item.image_url} alt={item.term} className="w-full h-auto object-cover max-h-48" />
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white border border-edge rounded-lg shadow-card">
              <HelpCircle className="h-10 w-10 text-ink-muted mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-ink-primary">No glossary terms found</h3>
              <p className="text-xs text-ink-secondary mt-1">Try refining your search query or changing filters.</p>
            </div>
          )}

          {/* Bottom Actions */}
          <div className="mt-16 text-center border-t border-edge pt-12">
            <Link href="/products" className="btn-primary px-6 py-3 text-xs font-semibold uppercase tracking-wider inline-flex items-center gap-1.5">
              Shop Our Science-Backed Products
            </Link>
          </div>

        </div>
      </main>
    </StoreShell>
  );
}
