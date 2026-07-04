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
        className="flex items-center gap-2 rounded-sm border border-edge bg-surface px-4 py-2.5 text-sm font-medium text-ink-primary hover:border-edge-strong transition-colors"
      >
        {currentLabel}
        <ChevronDown
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-md border border-edge bg-surface shadow-elevated z-30">
          {sortOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSort(option.value)}
              className={`w-full px-4 py-3 text-left border-b border-edge-subtle last:border-b-0 transition-colors ${
                currentSort === option.value
                  ? 'bg-surface-muted text-ink-accent'
                  : 'hover:bg-surface-muted/60 text-ink-secondary'
              }`}
            >
              <div className="font-medium text-sm">{option.label}</div>
              <div className="text-[11px] text-ink-muted">{option.description}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
