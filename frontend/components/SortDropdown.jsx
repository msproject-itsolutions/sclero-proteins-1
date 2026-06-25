'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export default function SortDropdown({ onSortChange = () => {}, currentSort = 'popularity' }) {
  const [isOpen, setIsOpen] = useState(false);

  const sortOptions = [
    { value: 'popularity', label: 'Most Popular', description: 'Best sellers & ratings' },
    { value: 'rating', label: 'Highest Rated', description: 'Best customer reviews' },
    { value: 'newest', label: 'Newest First', description: 'Latest products' },
    { value: 'price_asc', label: 'Price: Low to High', description: 'Most affordable first' },
    { value: 'price_desc', label: 'Price: High to Low', description: 'Premium products first' },
    { value: 'bestseller', label: 'Best Sellers', description: 'Most sold' },
  ];

  const handleSort = (value) => {
    onSortChange(value);
    setIsOpen(false);
  };

  const currentLabel = sortOptions.find((opt) => opt.value === currentSort)?.label || 'Sort by';

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-brand-navy hover:border-brand-purple transition-colors"
      >
        {currentLabel}
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg border border-slate-200 bg-white shadow-lg z-30">
          {sortOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSort(option.value)}
              className={`w-full px-4 py-3 text-left border-b border-slate-100 last:border-b-0 transition-colors ${
                currentSort === option.value
                  ? 'bg-brand-purple/10 text-brand-purple'
                  : 'hover:bg-slate-50 text-brand-text'
              }`}
            >
              <div className="font-semibold text-sm">{option.label}</div>
              <div className="text-[11px] text-brand-muted">{option.description}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
