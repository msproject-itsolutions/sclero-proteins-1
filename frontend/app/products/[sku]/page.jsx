'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import Link from 'next/link';
import {
  Star, Heart, ArrowLeft, ShieldCheck, ChevronDown, Info,
  Sparkles, ShieldAlert, Award, Calendar, Share2, ShoppingCart, Truck
} from 'lucide-react';
import StoreShell from '../../../components/StoreShell';
import ProductCard from '../../../components/ProductCard';
import { addToCart } from '../../../store/cartSlice';
import { getApiUrl } from '../../../lib/api';
import { trackEvent } from '../../../utils/analytics';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sku = params?.sku;
  const dispatch = useDispatch();
  const { currentRegion, currencySymbol, session_id } = useSelector((s) => s.region);

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  // Selection states
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [activeTab, setActiveTab] = useState('description');
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [cartOpenTrigger, setCartOpenTrigger] = useState(null);
  const [checkoutOpenTrigger, setCheckoutOpenTrigger] = useState(null);

  // Recommended products state
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

  // Fetch product detail
  useEffect(() => {
    if (!sku || !currentRegion) return;
    setLoading(true);
    setError(false);
    fetch(getApiUrl(`/api/products/${sku}/?region=${currentRegion}`))
      .then((res) => {
        if (!res.ok) throw new Error('not found');
        return res.json();
      })
      .then((data) => {
        setProduct(data);
        setActiveImage(0);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, [sku, currentRegion]);

  // Fetch related products via dedicated endpoint
  useEffect(() => {
    if (!sku || !currentRegion) return;
    setRelatedLoading(true);
    fetch(getApiUrl(`/api/products/${sku}/related/?region=${currentRegion}`))
      .then((res) => res.ok ? res.json() : [])
      .then((data) => {
        if (Array.isArray(data)) {
          setRelatedProducts(data.slice(0, 4));
        } else {
          setRelatedProducts([]);
        }
        setRelatedLoading(false);
      })
      .catch(() => {
        setRelatedProducts([]);
        setRelatedLoading(false);
      });
  }, [sku, currentRegion]);

  const handleAddToCart = async (openCheckout = false) => {
    if (!product) return;
    
    const basePrice = promoVal || priceVal;
    const finalPrice = basePrice;

    await dispatch(
      addToCart({
        session_id,
        region: currentRegion,
        product_id: product.id,
        quantity,
        metadata: null
      })
    ).unwrap().catch(() => null);

    // Track analytics event
    trackEvent('AddToCart', {
      content_ids: [product.sku],
      value: finalPrice,
      currency: currentRegion === 'IN' ? 'INR' : 'GBP',
      quantity,
      purchase_type: 'one-time',
      frequency: null
    });

    if (openCheckout) setCheckoutOpenTrigger(Date.now());
    else setCartOpenTrigger(Date.now());
  };

  // Add a specific recommended product to the cart
  const handleAddToCartSpecific = (p) => {
    if (!p) return;
    const price = p.promotional_price ? parseFloat(p.promotional_price) : parseFloat(p.price);
    dispatch(
      addToCart({
        session_id,
        region: currentRegion,
        product_id: p.id,
        quantity: 1,
      })
    );
    trackEvent('AddToCart', {
      content_ids: [p.sku],
      value: price,
      currency: currentRegion === 'IN' ? 'INR' : 'GBP',
      quantity: 1,
      purchase_type: 'one-time',
      frequency: null
    });
    setCartOpenTrigger(Date.now());
  };

  // Quick purchase
  const handleBuyNow = () => {
    handleAddToCart(true);
  };

  const images = (product?.media || []).filter((m) => m.media_type === 'IMAGE');
  const videos = (product?.media || []).filter((m) => m.media_type === 'VIDEO');
  const priceVal = product?.price ? parseFloat(product.price) : 0;
  const promoVal = product?.promotional_price ? parseFloat(product.promotional_price) : null;
  const basePrice = promoVal || priceVal;
  
  // Apply pricing
  const effectivePrice = basePrice;
  const discount = promoVal && priceVal ? Math.round(((priceVal - promoVal) / priceVal) * 100) : 0;
  const stock = product?.stock_available || 0;
  const nutrition = product?.nutrition_facts || {};
  // Only render primitive, non-private entries. The nutrition_facts JSON can
  // carry stray nested objects / metadata (e.g. an "_seo" key) that must not be
  // dumped into the table — rendering an object as a React child crashes the page.
  const nutritionRows = Object.entries(nutrition).filter(
    ([k, v]) => !k.startsWith('_') && (typeof v === 'string' || typeof v === 'number')
  );
  const faqList = product?.faq || [];
  
  const rawReviews = product?.reviews || [];
  const reviews = rawReviews;

  // Review statistics calculation
  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1) : Number(product?.average_rating || 0).toFixed(1);
  const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach((r) => { if (ratingCounts[r.rating] !== undefined) ratingCounts[r.rating]++; });

  // SEO schemas — Product JSON-LD + BreadcrumbList for rich search results.
  const productUrl = (typeof window !== 'undefined' && product)
    ? `${window.location.origin}/products/${product.sku}`
    : (product ? `https://scleroproteins.co.uk/products/${product.sku}` : '');
  const currencyCode = currentRegion === 'IN' ? 'INR' : 'GBP';
  const primaryCategory = product?.categories && product.categories.length > 0
    ? (product.categories[0].name || product.categories[0])
    : null;

  const productSchema = product ? (() => {
    const schema = {
      '@context': 'https://schema.org/',
      '@type': 'Product',
      'name': product.name,
      'image': images.map((m) => m.file_url).filter(Boolean),
      'description': product.description,
      'sku': product.sku,
      'brand': { '@type': 'Brand', 'name': 'Sclero Proteins' },
      'offers': {
        '@type': 'Offer',
        'url': productUrl,
        'priceCurrency': currencyCode,
        'price': String(effectivePrice),
        'availability': stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
        'itemCondition': 'https://schema.org/NewCondition',
      },
    };
    const avg = Number(product.average_rating || 0);
    const cnt = Number(product.total_reviews || 0);
    if (avg > 0 && cnt > 0) {
      schema.aggregateRating = {
        '@type': 'AggregateRating',
        'ratingValue': String(avg),
        'reviewCount': String(cnt),
      };
    }
    return schema;
  })() : null;

  const breadcrumbSchema = product ? {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': 'https://scleroproteins.co.uk/' },
      { '@type': 'ListItem', 'position': 2, 'name': 'Products', 'item': 'https://scleroproteins.co.uk/products' },
      ...(primaryCategory ? [{ '@type': 'ListItem', 'position': 3, 'name': primaryCategory, 'item': `https://scleroproteins.co.uk/products?category=${encodeURIComponent(primaryCategory)}` }] : []),
      { '@type': 'ListItem', 'position': primaryCategory ? 4 : 3, 'name': product.name, 'item': productUrl },
    ],
  } : null;

  return (
    <StoreShell cartOpenSignal={cartOpenTrigger} checkoutOpenSignal={checkoutOpenTrigger}>
      
      {productSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
        />
      )}
      {breadcrumbSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
        />
      )}
      {product && (
        <>
          <title>{`${product.name} | Sclero Proteins`}</title>
          <meta name="description" content={product.description?.slice(0, 160) || `${product.name} from Sclero Proteins.`} />
          <meta property="og:title" content={`${product.name} | Sclero Proteins`} />
          <meta property="og:description" content={product.description?.slice(0, 200) || ''} />
          <meta property="og:type" content="product" />
          {images[0]?.file_url && <meta property="og:image" content={images[0].file_url} />}
          <meta name="twitter:card" content="summary_large_image" />
        </>
      )}

      {/* Breadcrumb */}
      <div className="border-b border-slate-200 bg-white">
        <div className="container-page py-3.5">
          <nav className="flex items-center gap-2 text-xs text-brand-muted">
            <Link href="/" className="hover:text-brand-navy">Home</Link>
            <span>/</span>
            <Link href="/products" className="hover:text-brand-navy">Products</Link>
            {product && (
              <>
                <span>/</span>
                <span className="font-semibold text-brand-navy truncate max-w-[200px]">{product.name}</span>
              </>
            )}
          </nav>
        </div>
      </div>

      {loading ? (
        <div className="flex h-96 items-center justify-center">
          <div className="loader" />
        </div>
      ) : error || !product ? (
        <div className="mx-auto max-w-3xl px-4 py-24 text-center">
          <Info className="mx-auto mb-4 h-10 w-10 text-slate-300" />
          <h1 className="mb-2 text-xl font-black text-brand-navy">Product not available</h1>
          <p className="mb-6 text-sm text-brand-muted">
            This product could not be found in the {currentRegion === 'IN' ? 'India' : 'United Kingdom'} region.
          </p>
          <Link
            href="/products"
            className="inline-flex items-center gap-1 rounded-lg bg-brand-purple px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-purple/90"
          >
            <ArrowLeft className="h-4 w-4" /> Back to all products
          </Link>
        </div>
      ) : (
        <>
          <div className="container-page py-10">
            <div className="grid gap-10 lg:grid-cols-12">
              
              {/* Product Gallery & Videos Column */}
              <div className="lg:col-span-6 space-y-4">
                <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-3xl border border-slate-100 bg-slate-50 shadow-xs">
                  {images.length > 0 ? (
                    <img
                      src={images[activeImage]?.file_url}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Info className="h-12 w-12 text-slate-300" />
                  )}
                  {discount > 0 && (
                    <span className="absolute left-4 top-4 rounded-full bg-brand-danger px-3.5 py-1 text-xs font-bold text-white shadow-sm">
                      Save {discount}%
                    </span>
                  )}
                </div>
                
                {/* Thumbnails list */}
                <div className="flex gap-2.5 overflow-x-auto pb-1">
                  {images.map((img, i) => (
                    <button
                      key={img.id || i}
                      onClick={() => setActiveImage(i)}
                      aria-label={`Show product image ${i + 1}`}
                      className={`h-16 w-16 overflow-hidden rounded-xl border-2 shrink-0 ${
                        activeImage === i ? 'border-brand-purple shadow-sm' : 'border-slate-200'
                      }`}
                    >
                      <img src={img.file_url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                  {videos.map((vid, idx) => (
                    <div
                      key={vid.id || idx}
                      className="h-16 w-16 overflow-hidden rounded-xl border border-slate-200 shrink-0 relative bg-black flex items-center justify-center cursor-pointer"
                    >
                      <span className="text-[9px] text-white font-bold tracking-widest absolute">VIDEO</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Info Column */}
              <div className="lg:col-span-6 space-y-6">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-full bg-brand-purple/10 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-purple">
                      Verified GMP
                    </span>
                    <span className="rounded-full bg-brand-success/10 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-success">
                      Third-Party Tested
                    </span>
                  </div>
                  <h1 className="text-2xl font-black text-brand-navy tracking-tight sm:text-3xl">{product.name}</h1>
                  
                  {/* Reviews Summary */}
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < Math.round(Number(averageRating))
                              ? 'fill-brand-orange text-brand-orange'
                              : 'text-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-bold text-brand-navy">{averageRating}</span>
                    <span className="text-[11px] text-brand-muted">({totalReviews} verified reviews)</span>
                  </div>
                </div>

                <p className="text-xs md:text-sm leading-relaxed text-brand-muted">{product.description}</p>

                {/* Price Display */}
                <div className="border border-slate-200 rounded-3xl p-5 bg-white space-y-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand-muted uppercase tracking-wider">Price</span>
                    <div className="text-right">
                      {promoVal ? (
                        <>
                          <span className="text-2xl font-black text-brand-navy mr-2">
                            {currencySymbol}{promoVal.toFixed(2)}
                          </span>
                          <span className="text-xs text-brand-muted line-through">
                            {currencySymbol}{priceVal.toFixed(2)}
                          </span>
                        </>
                      ) : (
                        <span className="text-2xl font-black text-brand-navy">
                          {currencySymbol}{priceVal.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {/* Quantity + CTAs */}
                <div className="space-y-3.5">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] uppercase font-extrabold text-brand-muted">Quantity:</span>
                    <div className="flex items-center border border-slate-200 rounded-xl bg-white">
                      <button
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        aria-label="Decrease quantity"
                        className="flex h-10 w-10 items-center justify-center font-bold text-brand-muted hover:text-brand-navy"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-xs font-bold text-brand-navy">{quantity}</span>
                      <button
                        onClick={() => setQuantity((q) => q + 1)}
                        aria-label="Increase quantity"
                        className="flex h-10 w-10 items-center justify-center font-bold text-brand-muted hover:text-brand-navy"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-[10px] text-brand-muted">
                      {stock > 0 ? `${stock} canisters available` : 'Out of stock'}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button
                      onClick={() => handleAddToCart(false)}
                      disabled={stock === 0}
                      className="flex-1 btn-primary py-3.5 text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <ShoppingCart className="h-4.5 w-4.5" />
                      Add to Cart
                    </button>
                    <button
                      onClick={handleBuyNow}
                      disabled={stock === 0}
                      className="flex-1 rounded-2xl border border-slate-200 bg-white text-brand-navy py-3.5 text-xs font-bold uppercase tracking-wider hover:border-brand-purple hover:bg-brand-purple/5 transition-all disabled:opacity-50"
                    >
                      Buy It Now
                    </button>
                    <button
                      onClick={() => setIsWishlisted(!isWishlisted)}
                      aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
                      className="rounded-2xl border border-slate-200 bg-white p-3.5 hover:border-brand-purple hover:bg-brand-purple/5 transition-all text-brand-muted hover:text-brand-purple shrink-0"
                    >
                      <Heart className={`h-5 w-5 ${isWishlisted ? 'fill-brand-purple text-brand-purple' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Trust Signifiers list */}
                <div className="grid grid-cols-2 gap-3 border-t border-slate-100 pt-5">
                  <div className="flex items-start gap-2 text-xs">
                    <ShieldCheck className="h-5 w-5 text-brand-success shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-brand-navy">30-Day Refund Guarantee</p>
                      <p className="text-[10px] text-brand-muted">Risk-free purchase satisfaction assurance.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <Award className="h-5 w-5 text-brand-purple shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-brand-navy">GMP Certified Facilities</p>
                      <p className="text-[10px] text-brand-muted">Manufactured under pharmaceutical controls.</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Product Information tabs */}
          <section className="border-t border-slate-200 bg-slate-50/50 py-12">
            <div className="container-page">
              
              {/* Tab Header triggers */}
              <div className="flex border-b border-slate-200 overflow-x-auto gap-2 pb-px scrollbar-none">
                {[
                  { id: 'description', label: 'Description' },
                  { id: 'benefits', label: 'Benefits' },
                  { id: 'ingredients', label: 'Ingredients' },
                  { id: 'how_to_use', label: 'How to Use' },
                  { id: 'science', label: 'Science & Research' },
                  { id: 'shipping', label: 'Shipping & Tax' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`border-b-2 px-5 py-3 text-xs font-bold uppercase tracking-wider shrink-0 transition-colors ${
                      activeTab === t.id
                        ? 'border-brand-purple text-brand-purple font-extrabold'
                        : 'border-transparent text-brand-muted hover:text-brand-navy'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab Content Panels */}
              <div className="py-8 bg-white border border-t-0 border-slate-200 rounded-b-3xl p-6 lg:p-8">
                
                {activeTab === 'description' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-brand-navy uppercase tracking-wider">Product Summary</h3>
                    <p className="text-xs md:text-sm leading-relaxed text-brand-muted">{product.description}</p>
                    <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {nutritionRows.length > 0 && (
                        <div>
                          <h4 className="text-xs font-bold text-brand-navy mb-2">Supplement Facts</h4>
                          <div className="overflow-hidden rounded-xl border border-slate-200">
                            {nutritionRows.map(([k, v], idx) => (
                              <div key={idx} className="flex justify-between px-3.5 py-2 text-xs border-b border-slate-100 last:border-b-0">
                                <span className="text-brand-muted">{k}</span>
                                <span className="font-bold text-brand-navy">{String(v)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'benefits' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-brand-navy uppercase tracking-wider">Primary Benefits</h3>
                    <p className="text-xs md:text-sm leading-relaxed text-brand-muted">{product.benefits}</p>
                  </div>
                )}

                {activeTab === 'ingredients' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-brand-navy uppercase tracking-wider">Active Ingredients</h3>
                    <p className="text-xs md:text-sm leading-relaxed text-brand-muted">{product.ingredients}</p>
                  </div>
                )}

                {activeTab === 'how_to_use' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-brand-navy uppercase tracking-wider">Usage Directions</h3>
                    <p className="text-xs md:text-sm leading-relaxed text-brand-muted">
                      Add 1 level scoop (included inside the canister) daily to your beverage of choice (water, juice, smoothie, or tea). Stir vigorously for 30 seconds or use a shaker cup for optimal dissolution. For maximum joint matrix assimilation, take consistently at similar times daily.
                    </p>
                  </div>
                )}

                {activeTab === 'science' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-brand-navy uppercase tracking-wider">Science &amp; Clinical Background</h3>
                    <p className="text-xs md:text-sm leading-relaxed text-brand-muted">
                      Sclero Proteins products are formulated to target articular cartilage synthesis pathways. Independent clinical evaluations of bioactive matrices indicate key cofactors and collagen forms can support mobility and decrease everyday joint friction when maintained continuously as part of an active recovery program.
                    </p>
                  </div>
                )}

                {activeTab === 'shipping' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-brand-navy uppercase tracking-wider">Fulfillment, Shipping &amp; Taxes</h3>
                    <p className="text-xs md:text-sm leading-relaxed text-brand-muted">
                      We offer next-business-day shipping from our local Haywards Heath (UK) and Anand (India) logistics centers. Taxes (VAT for UK, GST for India) are completely inclusive in the listed price. Free shipping applies automatically above regional order limits (£50 for UK, ₹3,000 for India).
                    </p>
                  </div>
                )}

              </div>

            </div>
          </section>

          {/* You may also like — Related products */}
          {(relatedLoading || relatedProducts.length > 0) && (
            <section className="py-12 border-t border-slate-200 bg-slate-50/20">
              <div className="container-page">
                <div className="mb-8 text-center md:text-left">
                  <span className="text-[10px] font-black uppercase tracking-widest text-brand-purple">Recommended Products</span>
                  <h3 className="text-xl font-black text-brand-navy tracking-tight mt-1">You may also like</h3>
                </div>

                {relatedLoading ? (
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse rounded-3xl bg-white border border-slate-200 p-5">
                        <div className="h-40 rounded-2xl bg-slate-100 mb-3" />
                        <div className="h-3 w-1/2 bg-slate-100 rounded mb-2" />
                        <div className="h-3 w-3/4 bg-slate-100 rounded mb-3" />
                        <div className="h-6 w-1/3 bg-slate-100 rounded" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
                    {relatedProducts.map((p) => (
                      <ProductCard
                        key={p.id || p.sku}
                        product={p}
                        onAddToCart={handleAddToCartSpecific}
                        onViewDetails={(s) => router.push(`/products/${s}?region=${currentRegion}`)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Customer Reviews & Detailed Rating Breakdown */}
          <section className="border-t border-slate-200 bg-slate-50/50 py-12">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
              <h2 className="mb-8 text-xl font-black text-brand-navy uppercase tracking-wider">Customer Reviews</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-10 items-center">
                
                {/* Score badge */}
                <div className="md:col-span-4 text-center p-6 bg-white border border-slate-200 rounded-3xl shadow-xs">
                  <p className="text-5xl font-black text-brand-navy">{averageRating}</p>
                  <div className="flex justify-center my-2">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4.5 w-4.5 ${
                          i < Math.round(Number(averageRating))
                            ? 'fill-brand-orange text-brand-orange'
                            : 'text-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-brand-muted">Based on {totalReviews} reviews</p>
                </div>

                {/* Bars breakdown */}
                <div className="md:col-span-8 space-y-2 text-xs">
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const count = ratingCounts[stars] || 0;
                    const percent = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
                    return (
                      <div key={stars} className="flex items-center gap-3 text-brand-navy">
                        <span className="w-3 text-right font-bold">{stars}</span>
                        <Star className="h-3.5 w-3.5 fill-brand-orange text-brand-orange shrink-0" />
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-orange rounded-full" style={{ width: `${percent}%` }} />
                        </div>
                        <span className="w-8 text-right text-brand-muted">{percent}%</span>
                      </div>
                    );
                  })}
                </div>

              </div>

              {/* Verified reviews listing */}
              <div className="space-y-4">
                {reviews.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
                    <p className="text-sm font-bold text-brand-navy">No customer reviews yet.</p>
                    <p className="mt-1 text-xs text-brand-muted">Be the first to review this product after purchase.</p>
                  </div>
                ) : reviews.map((r, i) => (
                  <div key={r.id || i} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-brand-navy">{r.user_name}</span>
                        {r.is_verified_purchase && (
                          <span className="inline-flex items-center gap-1 rounded bg-brand-success/15 px-2 py-0.5 text-[9px] font-bold text-brand-success">
                            Verified Purchase
                          </span>
                        )}
                      </div>
                      <div className="flex">
                        {[...Array(5)].map((_, j) => (
                          <Star
                            key={j}
                            className={`h-3 w-3 ${
                              j < r.rating ? 'fill-brand-orange text-brand-orange' : 'text-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs md:text-sm leading-relaxed text-brand-muted">{r.comment}</p>
                  </div>
                ))}
              </div>

            </div>
          </section>
        </>
      )}
    </StoreShell>
  );
}
