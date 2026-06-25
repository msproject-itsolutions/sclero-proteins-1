'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useDispatch, useSelector } from 'react-redux';
import { Search, X, ChevronDown, SlidersHorizontal, ShieldCheck, Sparkles } from 'lucide-react';
import { addToCart } from '../store/cartSlice';
import { getApiUrl } from '../lib/api';
import { trackEvent } from '../utils/analytics';
import ProductCard from './ProductCard';
import SortDropdown from './SortDropdown';
import PaginationControl from './PaginationControl';

const PAGE_SIZE = 12;

// Category headers info
const CATEGORY_DETAILS = {
  'bone-joint-care': {
    title: 'BJC® Bone & Joint Care',
    intro: 'Support your mobility with clinically informed active nutrition. Our signature BJC® range combines bioactive eggshell membrane, highly soluble collagen peptides, and target mineral cofactors to support cartilage comfort and bone density retention.',
  },
  protein: {
    title: 'Active Bioactive Protein',
    intro: 'Fuel muscle repair and joint recovery with pure, cold-processed bioactive proteins. Free from proprietary blends, fillers, or artificial sweeteners, these formulations are optimized for bioavailability and daily performance.',
  },
  creatine: {
    title: 'Creatine',
    intro: 'Support strength, power output, and high-intensity training with clean, transparent creatine formulations.',
  },
  recovery: {
    title: 'Recovery',
    intro: 'Target daily recovery with amino acids and active nutrition designed for soreness, repair, and training consistency.',
  },
  collagen: {
    title: 'Collagen',
    intro: 'Structural protein support for joints, skin, connective tissue, and active lifestyles.',
  },
  calcium: {
    title: 'Calcium',
    intro: 'Targeted mineral support for bone density, skeletal resilience, and daily wellness routines.',
  },
  'skin-beauty': {
    title: 'Skin & Beauty',
    intro: 'Beauty-from-within formulations focused on collagen support, skin structure, and everyday radiance.',
  },
};

// Available Filter Choices
const HEALTH_GOALS = [
  { slug: 'immunity', name: 'Immunity' },
  { slug: 'sleep', name: 'Sleep & Relaxation' },
  { slug: 'energy', name: 'Energy & Vitality' },
  { slug: 'gut', name: 'Gut Health' },
  { slug: 'mens-health', name: 'Men\'s Health' },
  { slug: 'womens-health', name: 'Women\'s Health' },
  { slug: 'skin-hair', name: 'Skin & Hair' },
  { slug: 'fitness', name: 'Fitness & Muscle' },
  { slug: 'joint-comfort', name: 'Joint Comfort' },
];

const FORMS = [
  { slug: 'capsule', name: 'Capsules' },
  { slug: 'powder', name: 'Powders' },
  { slug: 'gummies', name: 'Gummies' },
];

const DIETARY = [
  { slug: 'vegan', name: 'Vegan' },
  { slug: 'gluten-free', name: 'Gluten-Free' },
  { slug: 'dairy-free', name: 'Dairy-Free' },
];

export default function ProductCatalog({
  id,
  title = 'Products',
  subtitle,
  limit,
  onOpenCart,
  className = '',
  filterable = false,
}) {
  const dispatch = useDispatch();
  const router = useRouter();
  const { currentRegion, currencySymbol, session_id } = useSelector((state) => state.region);

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [activeCategory, setActiveCategory] = useState(null);
  const [selectedGoals, setSelectedGoals] = useState([]);
  const [selectedForms, setSelectedForms] = useState([]);
  const [selectedDietary, setSelectedDietary] = useState([]);
  const [priceMax, setPriceMax] = useState(100);
  const [selectedRating, setSelectedRating] = useState(0);
  const [sort, setSort] = useState('popularity');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Mobile filters drawer
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  // FAQ Accordion state
  const [openFaq, setOpenFaq] = useState(null);

  // Pagination
  const [page, setPage] = useState(1);
  const gridRef = useRef(null);

  // Pre-select category/search query on load
  useEffect(() => {
    if (!filterable || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const slug = params.get('category');
    if (slug) setActiveCategory(slug);
    const q = params.get('q');
    if (q) { setSearchInput(q); setSearch(q); }
    const pageParam = parseInt(params.get('page') || '1', 10);
    if (!Number.isNaN(pageParam) && pageParam > 0) setPage(pageParam);
  }, [filterable]);

  // Reset page to 1 when any filter/search/sort changes
  useEffect(() => {
    setPage(1);
  }, [activeCategory, selectedGoals, selectedForms, selectedDietary, priceMax, selectedRating, sort, search]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fetch Category Facets
  useEffect(() => {
    if (!filterable || !currentRegion) return;
    fetch(getApiUrl(`/api/products/categories/?region=${currentRegion}`))
      .then((res) => res.json())
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => setCategories([]));
  }, [filterable, currentRegion]);

  // Fetch products
  useEffect(() => {
    if (!currentRegion) return;
    let ignore = false;
    setLoading(true);

    const params = new URLSearchParams({ region: currentRegion });
    // Fetch category filter directly from backend if selected
    if (activeCategory) params.append('category', activeCategory);
    if (search) params.set('search', search);

    fetch(getApiUrl(`/api/products/?${params.toString()}`))
      .then((res) => res.json())
      .then((data) => {
        if (ignore) return;
        setProducts(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        if (ignore) return;
        setProducts([]);
        setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [currentRegion, activeCategory, search]);

  // Filter products client-side for advanced choices (Goals, Dietary, Form, Price, Ratings)
  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Filter by Health Goals
    if (selectedGoals.length > 0) {
      result = result.filter((p) => {
        const text = `${p.name} ${p.description} ${p.benefits}`.toLowerCase();
        return selectedGoals.some((g) => {
          if (g === 'immunity') return text.includes('immun') || text.includes('defense');
          if (g === 'sleep') return text.includes('sleep') || text.includes('relax') || text.includes('rest');
          if (g === 'energy') return text.includes('energy') || text.includes('vitality') || text.includes('stamina');
          if (g === 'gut') return text.includes('gut') || text.includes('digest') || text.includes('microbiome');
          if (g === 'mens-health') return text.includes('men') || text.includes('male');
          if (g === 'womens-health') return text.includes('women') || text.includes('female');
          if (g === 'skin-hair') return text.includes('skin') || text.includes('hair') || text.includes('nail') || text.includes('collagen');
          if (g === 'fitness') return text.includes('fitness') || text.includes('muscle') || text.includes('workout');
          if (g === 'joint-comfort') return text.includes('joint') || text.includes('bone') || text.includes('cartilage') || text.includes('mobility');
          return text.includes(g);
        });
      });
    }

    // Filter by Form
    if (selectedForms.length > 0) {
      result = result.filter((p) => {
        const text = `${p.name} ${p.description}`.toLowerCase();
        return selectedForms.some((f) => {
          if (f === 'capsule') return text.includes('capsule') || text.includes('pill') || text.includes('cap');
          if (f === 'powder') return text.includes('powder') || text.includes('canister') || text.includes('tub');
          if (f === 'gummies') return text.includes('gummy') || text.includes('gummies');
          return text.includes(f);
        });
      });
    }

    // Filter by Dietary
    if (selectedDietary.length > 0) {
      result = result.filter((p) => {
        const text = `${p.name} ${p.description} ${p.benefits} ${p.ingredients}`.toLowerCase();
        return selectedDietary.every((d) => {
          if (d === 'gluten-free') return text.includes('gluten-free') || text.includes('gluten free');
          if (d === 'dairy-free') return text.includes('dairy-free') || text.includes('dairy free');
          return text.includes(d);
        });
      });
    }

    // Filter by Price Max
    result = result.filter((p) => {
      const price = parseFloat(p.promotional_price || p.price || 0);
      return price <= priceMax;
    });

    // Filter by Rating
    if (selectedRating > 0) {
      result = result.filter((p) => {
        const rating = parseFloat(p.average_rating || 5.0);
        return rating >= selectedRating;
      });
    }

    // Sort result
    if (sort === 'newest') {
      result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    } else if (sort === 'name') {
      result.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'price_asc') {
      result.sort((a, b) => parseFloat(a.promotional_price || a.price) - parseFloat(b.promotional_price || b.price));
    } else if (sort === 'price_desc') {
      result.sort((a, b) => parseFloat(b.promotional_price || b.price) - parseFloat(a.promotional_price || a.price));
    } else if (sort === 'rating') {
      result.sort((a, b) => parseFloat(b.average_rating || 5) - parseFloat(a.average_rating || 5));
    }

    return result;
  }, [products, selectedGoals, selectedForms, selectedDietary, priceMax, selectedRating, sort]);

  const handleAddToCart = (product) => {
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
    if (onOpenCart) onOpenCart();
  };

  const clearAllFilters = () => {
    setActiveCategory(null);
    setSelectedGoals([]);
    setSelectedForms([]);
    setSelectedDietary([]);
    setPriceMax(currentRegion === 'IN' ? 8000 : 100);
    setSelectedRating(0);
    setSearchInput('');
    setSearch('');
  };

  // Adjust price slider limit based on region
  useEffect(() => {
    setPriceMax(currentRegion === 'IN' ? 8000 : 100);
  }, [currentRegion]);

  const categoryInfo = activeCategory ? CATEGORY_DETAILS[activeCategory] : null;

  const faqs = [
    {
      q: 'What makes Sclero Proteins supplements premium?',
      a: 'We formulate our products under clinical guidance with complete ingredient transparency—no proprietary blends, no fillers, and no synthetic binders. Every single batch is independently third-party tested and verified.',
    },
    {
      q: 'How does regional pricing and fulfillment work?',
      a: 'We operate local distribution centers in the UK (Haywards Heath) and India (Anand, Gujarat). This ensures domestic shipping (2-4 business days), local currencies (£/₹), and regional tax compliance with zero surprise customs fees.',
    },
    {
      q: 'Are Sclero Proteins products suitable for specific dietary needs?',
      a: 'Most of our products are naturally gluten-free and non-GMO. Specific dietary markers (such as Vegan, Vegetarian, and Dairy-Free) are highlighted on each product page and filterable in our catalog.',
    },
  ];

  // Pagination calculations (only when filterable and no hard `limit` override)
  const totalCount = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const effectivePage = Math.min(page, totalPages);

  const visibleProducts = limit
    ? filteredProducts.slice(0, limit)
    : filterable
      ? filteredProducts.slice((effectivePage - 1) * PAGE_SIZE, effectivePage * PAGE_SIZE)
      : filteredProducts;

  const handlePageChange = (next) => {
    setPage(next);
    if (filterable && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (next > 1) params.set('page', String(next));
      else params.delete('page');
      const qs = params.toString();
      router.replace(`${window.location.pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    }
    if (gridRef.current) {
      gridRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const SidebarFilters = () => (
    <div className="space-y-6">
      {/* Category radios */}
      <div className="border-b border-slate-200 pb-5">
        <h3 className="text-xs font-black uppercase tracking-wider text-brand-navy mb-3">Category</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2.5 text-xs text-brand-muted hover:text-brand-navy cursor-pointer">
            <input
              type="radio"
              name="category"
              checked={!activeCategory}
              onChange={() => setActiveCategory(null)}
              className="accent-brand-purple"
            />
            <span>All Categories</span>
          </label>
          {categories.map((c) => (
            <label key={c.slug} className="flex items-center gap-2.5 text-xs text-brand-muted hover:text-brand-navy cursor-pointer">
              <input
                type="radio"
                name="category"
                checked={activeCategory === c.slug}
                onChange={() => setActiveCategory(c.slug)}
                className="accent-brand-purple"
              />
              <span className="capitalize">{c.name.replace(/-/g, ' ')}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Health goals checkbox */}
      <div className="border-b border-slate-200 pb-5">
        <h3 className="text-xs font-black uppercase tracking-wider text-brand-navy mb-3">Health Goal</h3>
        <div className="space-y-2">
          {HEALTH_GOALS.map((g) => (
            <label key={g.slug} className="flex items-center gap-2.5 text-xs text-brand-muted hover:text-brand-navy cursor-pointer">
              <input
                type="checkbox"
                checked={selectedGoals.includes(g.slug)}
                onChange={(e) => {
                  if (e.target.checked) setSelectedGoals([...selectedGoals, g.slug]);
                  else setSelectedGoals(selectedGoals.filter((item) => item !== g.slug));
                }}
                className="rounded accent-brand-purple"
              />
              <span>{g.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Form checkbox */}
      <div className="border-b border-slate-200 pb-5">
        <h3 className="text-xs font-black uppercase tracking-wider text-brand-navy mb-3">Supplement Form</h3>
        <div className="space-y-2">
          {FORMS.map((f) => (
            <label key={f.slug} className="flex items-center gap-2.5 text-xs text-brand-muted hover:text-brand-navy cursor-pointer">
              <input
                type="checkbox"
                checked={selectedForms.includes(f.slug)}
                onChange={(e) => {
                  if (e.target.checked) setSelectedForms([...selectedForms, f.slug]);
                  else setSelectedForms(selectedForms.filter((item) => item !== f.slug));
                }}
                className="rounded accent-brand-purple"
              />
              <span>{f.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Dietary preferences checkbox */}
      <div className="border-b border-slate-200 pb-5">
        <h3 className="text-xs font-black uppercase tracking-wider text-brand-navy mb-3">Dietary Preferences</h3>
        <div className="space-y-2">
          {DIETARY.map((d) => (
            <label key={d.slug} className="flex items-center gap-2.5 text-xs text-brand-muted hover:text-brand-navy cursor-pointer">
              <input
                type="checkbox"
                checked={selectedDietary.includes(d.slug)}
                onChange={(e) => {
                  if (e.target.checked) setSelectedDietary([...selectedDietary, d.slug]);
                  else setSelectedDietary(selectedDietary.filter((item) => item !== d.slug));
                }}
                className="rounded accent-brand-purple"
              />
              <span>{d.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Price Slider */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-brand-navy">Max Price</h3>
          <span className="text-xs font-bold text-brand-purple">{currencySymbol}{priceMax}</span>
        </div>
        <input
          type="range"
          min="0"
          max={currentRegion === 'IN' ? 8000 : 100}
          step={currentRegion === 'IN' ? 100 : 1}
          value={priceMax}
          onChange={(e) => setPriceMax(Number(e.target.value))}
          className="w-full accent-brand-purple"
        />
      </div>

      {/* Star ratings */}
      <div className="pb-5">
        <h3 className="text-xs font-black uppercase tracking-wider text-brand-navy mb-3">Customer Rating</h3>
        <div className="space-y-2">
          {[4, 3, 2].map((stars) => (
            <label key={stars} className="flex items-center gap-2.5 text-xs text-brand-muted hover:text-brand-navy cursor-pointer">
              <input
                type="radio"
                name="rating-filter"
                checked={selectedRating === stars}
                onChange={() => setSelectedRating(stars)}
                className="accent-brand-purple"
              />
              <span className="flex items-center gap-1">
                {stars} Stars &amp; Above
              </span>
            </label>
          ))}
          <label className="flex items-center gap-2.5 text-xs text-brand-muted hover:text-brand-navy cursor-pointer">
            <input
              type="radio"
              name="rating-filter"
              checked={selectedRating === 0}
              onChange={() => setSelectedRating(0)}
              className="accent-brand-purple"
            />
            <span>All Ratings</span>
          </label>
        </div>
      </div>
    </div>
  );

  return (
    <section id={id} className={`container-page py-8 ${className}`}>
      
      {/* Category Intro Content Box */}
      {filterable && categoryInfo && (
        <div className="mb-10 rounded-3xl border border-brand-purple/10 bg-brand-purple/[0.02] p-6 lg:p-8 flex flex-col md:flex-row gap-6 items-center shadow-xs">
          <div className="flex-1">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-purple mb-2">
              <Sparkles className="h-4 w-4" />
              <span>Sclero Formulation Guide</span>
            </div>
            <h2 className="text-2xl font-black text-brand-navy mb-3">
              {categoryInfo.title}
            </h2>
            <p className="text-xs md:text-sm text-brand-muted leading-relaxed">
              {categoryInfo.intro}
            </p>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 p-4 text-center shrink-0 w-full md:w-56 shadow-xs">
            <ShieldCheck className="h-8 w-8 text-brand-success mx-auto mb-2" />
            <h4 className="text-xs font-bold text-brand-navy uppercase mb-1">Standard Assured</h4>
            <p className="text-[10px] text-brand-muted">GMP Compliant, Third-Party Lab Verified Ingredients.</p>
          </div>
        </div>
      )}

      {(title || subtitle) && !categoryInfo && (
        <div className="mb-10 text-center lg:text-left">
          {title ? (
            <>
              <h2 className="text-3xl font-black tracking-tight text-brand-navy sm:text-4xl">
                {title}
              </h2>
              <p className="mt-3 text-sm text-brand-muted">
                {subtitle ||
                  `Available in the ${currentRegion === 'IN' ? '🇮🇳 India' : '🇬🇧 United Kingdom'} region.`}
              </p>
            </>
          ) : subtitle ? (
            <p className="text-sm text-brand-muted">{subtitle}</p>
          ) : null}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-10">
        
        {/* Left Column Sidebar Filters (Desktop) */}
        {filterable && (
          <aside className="hidden lg:block w-64 shrink-0 bg-white border border-slate-200 rounded-3xl p-6 h-fit shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h2 className="text-sm font-black text-brand-navy uppercase tracking-wider">Filters</h2>
              <button onClick={clearAllFilters} className="text-[11px] font-bold text-brand-purple hover:underline">
                Reset
              </button>
            </div>
            <SidebarFilters />
          </aside>
        )}

        {/* Right Column Product Grid & Top Bar */}
        <div className="flex-1 space-y-6">
          
          {filterable && (
            <div className="flex flex-wrap gap-4 items-center justify-between">
              
              {/* Search box */}
              <div className="relative w-full sm:max-w-sm">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search brand products…"
                  className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-xs focus:border-brand-purple focus:outline-none"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={() => setSearchInput('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-navy"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Sort + Mobile Filter button */}
              <div className="flex gap-2 items-center w-full sm:w-auto justify-between sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowMobileFilters(true)}
                  className="lg:hidden flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-brand-navy hover:border-brand-purple"
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  <span>Filters</span>
                </button>
                <SortDropdown currentSort={sort} onSortChange={setSort} />
              </div>

            </div>
          )}

          {/* Product grid */}
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="loader" />
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="py-20 text-center text-brand-muted">
              <p className="text-sm">No products match your active filters.</p>
              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-4 text-xs font-bold text-brand-purple hover:underline"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div ref={gridRef} className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {visibleProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onAddToCart={handleAddToCart}
                  onViewDetails={(sku) => router.push(`/products/${sku}?region=${currentRegion}`)}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {filterable && !limit && totalCount > PAGE_SIZE && (
            <PaginationControl
              variant="pagination"
              currentPage={effectivePage}
              totalPages={totalPages}
              totalItems={totalCount}
              itemsPerPage={PAGE_SIZE}
              onPageChange={handlePageChange}
            />
          )}

        </div>

      </div>

      {/* Collection Buying Guide & SEO FAQ accordion (Rendered at bottom of collections page) */}
      {filterable && (
        <div className="mt-20 border-t border-slate-200 pt-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            
            {/* Buying guide */}
            <div className="lg:col-span-5 space-y-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-purple">Buying Guide</span>
              <h2 className="text-2xl font-black text-brand-navy tracking-tight">How to choose your supplements</h2>
              <p className="text-xs leading-relaxed text-brand-muted">
                Selecting high-quality supplements requires examining ingredient delivery, clean labeling, and manufacturing certifications. At Sclero Proteins, we ensure all materials undergo cold-extraction to prevent bioavailability decay. Check our regional labels to review active compounds per dose and select your health goals on the sidebar filters to identify your ideal formulation matches.
              </p>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <h4 className="text-xs font-bold text-brand-navy mb-1 flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-purple/10 text-brand-purple text-[10px]">1</span>
                  Understand the active matrix
                </h4>
                <p className="text-[10px] text-brand-muted pl-6">Review elements such as glycosaminoglycans or type-specific collagen forms rather than plain bulk proteins.</p>
              </div>
            </div>

            {/* FAQs Accordion */}
            <div className="lg:col-span-7 space-y-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-purple">FAQ Schema</span>
              <h2 className="text-2xl font-black text-brand-navy tracking-tight">Collection FAQ</h2>
              
              <div className="space-y-2">
                {faqs.map((f, i) => (
                  <div key={i} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <button
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className="flex w-full items-center justify-between px-5 py-4 text-left font-bold text-xs text-brand-navy hover:text-brand-purple transition-colors"
                    >
                      <span>{f.q}</span>
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 text-brand-muted transition-transform ${
                          openFaq === i ? 'rotate-180' : ''
                        }`}
                      />
                    </button>
                    {openFaq === i && (
                      <p className="border-t border-slate-100 px-5 py-4 text-xs leading-relaxed text-brand-muted bg-slate-50/50">
                        {f.a}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Mobile Filters Drawer Modal */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-50 flex bg-brand-navy/30 backdrop-blur-xs justify-end">
          <div className="w-full max-w-xs bg-white h-full flex flex-col p-6 overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-5">
              <h2 className="text-sm font-black text-brand-navy uppercase tracking-wider">Filters</h2>
              <button
                type="button"
                onClick={() => setShowMobileFilters(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-50 border border-slate-200 text-brand-text"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarFilters />
            <button
              onClick={() => setShowMobileFilters(false)}
              className="mt-6 w-full btn-primary py-3 text-xs uppercase"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}

    </section>
  );
}
