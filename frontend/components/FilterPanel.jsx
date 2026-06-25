'use client';

import React, { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';

export default function FilterPanel({
  categories = [],
  healthGoals = [],
  dietaryFlags = [],
  priceRange = { min: 0, max: 100 },
  onFilterChange = () => {},
  isMobileDrawer = false,
  onClose = () => {},
}) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedHealthGoals, setSelectedHealthGoals] = useState([]);
  const [selectedDietary, setSelectedDietary] = useState([]);
  const [priceMin, setPriceMin] = useState(priceRange.min);
  const [priceMax, setPriceMax] = useState(priceRange.max);
  const [expandedSections, setExpandedSections] = useState({
    category: true,
    healthGoal: true,
    dietary: true,
    price: true,
  });

  // Notify parent of filter changes
  const notifyChanges = (category, goals, dietary, min, max) => {
    onFilterChange({
      category,
      healthGoals: goals,
      dietaryFlags: dietary,
      priceRange: { min, max },
    });
  };

  // Handle category selection (single select)
  const handleCategoryChange = (categorySlug) => {
    const newCategory = selectedCategory === categorySlug ? null : categorySlug;
    setSelectedCategory(newCategory);
    notifyChanges(newCategory, selectedHealthGoals, selectedDietary, priceMin, priceMax);
  };

  // Handle health goal selection (multi-select)
  const handleHealthGoalChange = (slug) => {
    const newGoals = selectedHealthGoals.includes(slug)
      ? selectedHealthGoals.filter((s) => s !== slug)
      : [...selectedHealthGoals, slug];
    setSelectedHealthGoals(newGoals);
    notifyChanges(selectedCategory, newGoals, selectedDietary, priceMin, priceMax);
  };

  // Handle dietary flag selection (multi-select)
  const handleDietaryChange = (slug) => {
    const newDietary = selectedDietary.includes(slug)
      ? selectedDietary.filter((s) => s !== slug)
      : [...selectedDietary, slug];
    setSelectedDietary(newDietary);
    notifyChanges(selectedCategory, selectedHealthGoals, newDietary, priceMin, priceMax);
  };

  // Handle price range changes
  const handlePriceMinChange = (e) => {
    const value = parseFloat(e.target.value);
    if (value < priceMax) {
      setPriceMin(value);
      notifyChanges(selectedCategory, selectedHealthGoals, selectedDietary, value, priceMax);
    }
  };

  const handlePriceMaxChange = (e) => {
    const value = parseFloat(e.target.value);
    if (value > priceMin) {
      setPriceMax(value);
      notifyChanges(selectedCategory, selectedHealthGoals, selectedDietary, priceMin, value);
    }
  };

  // Reset all filters
  const resetFilters = () => {
    setSelectedCategory(null);
    setSelectedHealthGoals([]);
    setSelectedDietary([]);
    setPriceMin(priceRange.min);
    setPriceMax(priceRange.max);
    notifyChanges(null, [], [], priceRange.min, priceRange.max);
  };

  // Toggle section expansion
  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Determine if any filters are active
  const hasActiveFilters =
    selectedCategory ||
    selectedHealthGoals.length > 0 ||
    selectedDietary.length > 0 ||
    priceMin > priceRange.min ||
    priceMax < priceRange.max;

  return (
    <div
      className={`${
        isMobileDrawer
          ? 'fixed inset-0 bg-white z-40 overflow-y-auto flex flex-col'
          : 'w-full max-w-xs'
      }`}
    >
      {/* Mobile Header */}
      {isMobileDrawer && (
        <div className="sticky top-0 border-b border-slate-200 bg-white p-4 flex items-center justify-between">
          <h2 className="font-bold text-brand-navy">Filters</h2>
          <button onClick={onClose} className="p-1 text-brand-muted hover:text-brand-navy">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Filter Content */}
      <div className={isMobileDrawer ? 'flex-1 px-4' : 'px-0'}>
        {/* Reset Button */}
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="w-full mb-4 py-2 text-xs font-bold uppercase text-brand-purple hover:text-brand-purple/80 border-b border-slate-200"
          >
            Clear all filters
          </button>
        )}

        {/* Category Filter */}
        <div className="border-b border-slate-200 py-4">
          <button
            onClick={() => toggleSection('category')}
            className="w-full flex items-center justify-between text-sm font-bold text-brand-navy hover:text-brand-purple"
          >
            Category
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                expandedSections.category ? 'rotate-180' : ''
              }`}
            />
          </button>

          {expandedSections.category && (
            <div className="mt-3 space-y-2">
              {categories.map((cat) => (
                <label
                  key={cat.slug}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <input
                    type="radio"
                    name="category"
                    checked={selectedCategory === cat.slug}
                    onChange={() => handleCategoryChange(cat.slug)}
                    className="w-4 h-4 rounded accent-brand-purple"
                  />
                  <span className="text-xs text-brand-text group-hover:text-brand-purple">
                    {cat.name}
                  </span>
                  <span className="text-[10px] text-brand-muted">({cat.count})</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Health Goal Filter */}
        <div className="border-b border-slate-200 py-4">
          <button
            onClick={() => toggleSection('healthGoal')}
            className="w-full flex items-center justify-between text-sm font-bold text-brand-navy hover:text-brand-purple"
          >
            Health Goals
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                expandedSections.healthGoal ? 'rotate-180' : ''
              }`}
            />
          </button>

          {expandedSections.healthGoal && (
            <div className="mt-3 space-y-2">
              {healthGoals.map((goal) => (
                <label
                  key={goal.slug}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={selectedHealthGoals.includes(goal.slug)}
                    onChange={() => handleHealthGoalChange(goal.slug)}
                    className="w-4 h-4 rounded accent-brand-purple"
                  />
                  <span className="text-xs text-brand-text group-hover:text-brand-purple">
                    {goal.name}
                  </span>
                  <span className="text-[10px] text-brand-muted">({goal.count})</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Dietary Filter */}
        <div className="border-b border-slate-200 py-4">
          <button
            onClick={() => toggleSection('dietary')}
            className="w-full flex items-center justify-between text-sm font-bold text-brand-navy hover:text-brand-purple"
          >
            Dietary & Certifications
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                expandedSections.dietary ? 'rotate-180' : ''
              }`}
            />
          </button>

          {expandedSections.dietary && (
            <div className="mt-3 space-y-2">
              {dietaryFlags.map((flag) => (
                <label
                  key={flag.slug}
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={selectedDietary.includes(flag.slug)}
                    onChange={() => handleDietaryChange(flag.slug)}
                    className="w-4 h-4 rounded accent-brand-purple"
                  />
                  <span className="text-xs text-brand-text group-hover:text-brand-purple">
                    {flag.name}
                  </span>
                  <span className="text-[10px] text-brand-muted">({flag.count})</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Price Range Filter */}
        <div className="border-b border-slate-200 py-4">
          <button
            onClick={() => toggleSection('price')}
            className="w-full flex items-center justify-between text-sm font-bold text-brand-navy hover:text-brand-purple"
          >
            Price Range
            <ChevronDown
              className={`h-4 w-4 transition-transform ${
                expandedSections.price ? 'rotate-180' : ''
              }`}
            />
          </button>

          {expandedSections.price && (
            <div className="mt-4 space-y-4">
              {/* Min Price Slider */}
              <div>
                <label className="text-[10px] font-bold uppercase text-brand-muted">
                  Minimum: £{priceMin.toFixed(2)}
                </label>
                <input
                  type="range"
                  min={priceRange.min}
                  max={priceRange.max}
                  step="0.50"
                  value={priceMin}
                  onChange={handlePriceMinChange}
                  className="w-full accent-brand-purple"
                />
              </div>

              {/* Max Price Slider */}
              <div>
                <label className="text-[10px] font-bold uppercase text-brand-muted">
                  Maximum: £{priceMax.toFixed(2)}
                </label>
                <input
                  type="range"
                  min={priceRange.min}
                  max={priceRange.max}
                  step="0.50"
                  value={priceMax}
                  onChange={handlePriceMaxChange}
                  className="w-full accent-brand-purple"
                />
              </div>

              {/* Price Display */}
              <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                <span className="text-sm font-bold text-brand-navy">
                  £{priceMin.toFixed(2)} - £{priceMax.toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Footer */}
      {isMobileDrawer && (
        <div className="border-t border-slate-200 bg-white p-4 space-y-2">
          <button
            onClick={() => {
              onClose();
            }}
            className="w-full py-2.5 text-sm font-bold uppercase text-white bg-brand-purple rounded-lg hover:bg-brand-purple/90 transition-colors"
          >
            Apply Filters
          </button>
        </div>
      )}
    </div>
  );
}
