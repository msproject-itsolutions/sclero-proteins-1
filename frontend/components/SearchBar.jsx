'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Search, X, Loader } from 'lucide-react';

export default function SearchBar({ onSearch = null, showFullResults = false }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Mock product suggestions (replace with API call)
  const mockProducts = [
    { sku: 'COMBO-COLLAGEN-60', name: 'Combo Collagen®', category: 'Collagen' },
    { sku: 'OVOSHELL-COLLAGEN-60', name: 'OvoShell Collagen™', category: 'Collagen' },
    { sku: 'BJC-BONE-JOINT-60', name: 'BJC® Bone & Joint Care', category: 'Supplements' },
  ];

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(() => {
      // Filter mock products (in real app, this would be an API call)
      const filtered = mockProducts.filter((p) =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.sku.toLowerCase().includes(query.toLowerCase())
      );
      setSuggestions(filtered);
      setIsLoading(false);
      setShowDropdown(true);
      setActiveIndex(-1);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!showDropdown || suggestions.length === 0) {
      if (e.key === 'Enter' && query) {
        handleSearch();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0) {
          selectProduct(suggestions[activeIndex]);
        } else if (query) {
          handleSearch();
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        break;
      default:
        break;
    }
  };

  // Handle search submission
  const handleSearch = () => {
    if (query.trim()) {
      setShowDropdown(false);
      if (onSearch) {
        onSearch(query);
      } else {
        // Navigate to search results page
        window.location.href = `/products?q=${encodeURIComponent(query)}`;
      }
    }
  };

  // Handle product selection
  const selectProduct = (product) => {
    setQuery('');
    setShowDropdown(false);
    setSuggestions([]);
    window.location.href = `/products/${product.sku}`;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target) &&
        !inputRef.current?.contains(e.target)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full max-w-md">
      {/* Search Input */}
      <div className="relative flex items-center">
        <Search className="absolute left-3 h-4 w-4 text-brand-muted pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && setSuggestions.length > 0 && setShowDropdown(true)}
          placeholder="Search products, benefits, SKU..."
          className="w-full pl-10 pr-10 py-2.5 text-sm border border-slate-200 rounded-lg bg-white focus:border-brand-purple focus:outline-none focus:ring-1 focus:ring-brand-purple/20"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setSuggestions([]);
              setShowDropdown(false);
            }}
            className="absolute right-3 p-1 text-brand-muted hover:text-brand-navy"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {isLoading && (
          <Loader className="absolute right-3 h-4 w-4 animate-spin text-brand-purple" />
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden"
        >
          <div className="max-h-72 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.sku}
                onClick={() => selectProduct(suggestion)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-slate-100 last:border-b-0 transition-colors ${
                  activeIndex === index ? 'bg-brand-purple/10' : 'hover:bg-slate-50'
                }`}
              >
                <Search className="h-4 w-4 mt-0.5 text-brand-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-brand-navy truncate">
                    {suggestion.name}
                  </div>
                  <div className="text-xs text-brand-muted">
                    {suggestion.category}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No Results Message */}
      {showDropdown && query.length >= 2 && suggestions.length === 0 && !isLoading && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-4 text-center">
          <p className="text-sm text-brand-muted">No products found for "{query}"</p>
          <button
            onClick={handleSearch}
            className="mt-2 text-xs font-medium text-brand-purple hover:text-brand-purple/80"
          >
            Search anyway →
          </button>
        </div>
      )}
    </div>
  );
}
