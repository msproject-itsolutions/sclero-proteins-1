'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Loader } from 'lucide-react';
import { useSelector } from 'react-redux';
import { getApiUrl } from '../lib/api';

export default function SearchBar({ onSearch = null, showFullResults = false }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const currentRegion = useSelector((state) => state.region.currentRegion || 'UK');

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          region: currentRegion,
          search: query.trim(),
        });
        const response = await fetch(getApiUrl(`/api/products/?${params}`), {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Search request failed');
        const payload = await response.json();
        const products = Array.isArray(payload) ? payload : (payload.results || []);
        setSuggestions(products.slice(0, 6));
        setShowDropdown(true);
        setActiveIndex(-1);
      } catch (error) {
        if (error.name !== 'AbortError') {
          setSuggestions([]);
          setShowDropdown(true);
        }
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, currentRegion]);

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
        <Search className="absolute left-3 h-4 w-4 text-ink-muted pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 2 && suggestions.length > 0 && setShowDropdown(true)}
          placeholder="Search products, benefits, SKU..."
          className="w-full pl-10 pr-10 py-2.5 text-sm border border-edge rounded-sm bg-surface focus:border-ink-primary focus:outline-none focus:ring-1 focus:ring-ink-primary/10"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setSuggestions([]);
              setShowDropdown(false);
            }}
            className="absolute right-3 p-1 text-ink-muted hover:text-ink-primary"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {isLoading && (
          <Loader className="absolute right-3 h-4 w-4 animate-spin text-brand-accent" />
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {showDropdown && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-1 bg-surface border border-edge rounded-md shadow-overlay z-50 overflow-hidden"
        >
          <div className="max-h-72 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.sku}
                onClick={() => selectProduct(suggestion)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left border-b border-edge-subtle last:border-b-0 transition-colors ${
                  activeIndex === index ? 'bg-surface-muted' : 'hover:bg-surface-muted/60'
                }`}
              >
                <Search className="h-4 w-4 mt-0.5 text-ink-subtle shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-ink-primary truncate">
                    {suggestion.name}
                  </div>
                  <div className="text-xs text-ink-muted">
                    {suggestion.short_benefit || suggestion.sku}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No Results Message */}
      {showDropdown && query.length >= 2 && suggestions.length === 0 && !isLoading && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-edge rounded-md shadow-overlay z-50 p-4 text-center">
          <p className="text-sm text-ink-muted">No products found for "{query}"</p>
          <button
            onClick={handleSearch}
            className="mt-2 text-xs font-medium text-ink-accent underline-offset-4 hover:underline"
          >
            Search anyway →
          </button>
        </div>
      )}
    </div>
  );
}
