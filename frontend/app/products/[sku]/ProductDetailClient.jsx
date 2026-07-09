'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import { authenticatedFetch } from '../../../lib/authFetch';
import { fetchWishlistOnce, invalidateWishlistCache } from '../../../lib/wishlistCache';
import { jsonLdScriptProps } from '../../../lib/jsonLd';
import { trackEvent } from '../../../utils/analytics';

export default function ProductDetailClient({ sku }) {
  const router = useRouter();
  const dispatch = useDispatch();
  const { currentRegion, currencySymbol, session_id } = useSelector((s) => s.region);
  const accessToken = useSelector((s) => s.auth?.access);

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  // Selection states
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
  const [activeTab, setActiveTab] = useState('description');
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [wishlistItemId, setWishlistItemId] = useState(null);
  const [wishlistLoading, setWishlistLoading] = useState(false);
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

  // Check wishlist status on load or login change
  useEffect(() => {
    if (!product || !accessToken) {
      setIsWishlisted(false);
      setWishlistItemId(null);
      return;
    }

    fetchWishlistOnce(currentRegion, accessToken)
      .then((items) => {
        const found = items.find((item) => item.product_sku === product.sku);
        if (found) {
          setIsWishlisted(true);
          setWishlistItemId(found.id);
        } else {
          setIsWishlisted(false);
          setWishlistItemId(null);
        }
      })
      .catch(() => {});
  }, [product, accessToken, currentRegion]);

  // Wishlist toggle handler
  const handleWishlistToggle = async () => {
    if (!accessToken) {
      router.push('/account');
      return;
    }
    if (!product || wishlistLoading) return;

    setWishlistLoading(true);
    try {
      if (isWishlisted && wishlistItemId) {
        // Remove from wishlist
        const res = await authenticatedFetch(`/api/wishlist/${wishlistItemId}/`, {
          method: 'DELETE',
        }, accessToken);
        if (res.ok) {
          setIsWishlisted(false);
          setWishlistItemId(null);
          invalidateWishlistCache();
        }
      } else {
        // Add to wishlist
        const res = await authenticatedFetch('/api/wishlist/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ product_id: product.id, region: currentRegion })
        }, accessToken);
        if (res.ok) {
          const data = await res.json();
          setIsWishlisted(true);
          setWishlistItemId(data.id);
          invalidateWishlistCache();
        }
      }
    } catch (e) {
      console.error('Error toggling wishlist', e);
    } finally {
      setWishlistLoading(false);
    }
  };

  const handleAddToCart = async (openCheckout = false) => {
    if (!product) return;
    if (product.price === null || product.price === undefined) return; // not sold in this region

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
  const unavailable = !!product && (product.price === null || product.price === undefined);
  const priceVal = product?.price ? parseFloat(product.price) : 0;
  const promoVal = product?.promotional_price ? parseFloat(product.promotional_price) : null;
  const basePrice = promoVal || priceVal;
  
  const effectivePrice = basePrice;
  const discount = promoVal && priceVal ? Math.round(((priceVal - promoVal) / priceVal) * 100) : 0;
  const stock = product?.stock_available || 0;
  const nutrition = product?.nutrition_facts || {};
  const nutritionRows = Object.entries(nutrition).filter(
    ([k, v]) => !k.startsWith('_') && (typeof v === 'string' || typeof v === 'number')
  );
  
  const rawReviews = product?.reviews || [];
  const reviews = rawReviews;

  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0 ? (reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1) : Number(product?.average_rating || 0).toFixed(1);
  const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach((r) => { if (ratingCounts[r.rating] !== undefined) ratingCounts[r.rating]++; });

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
          dangerouslySetInnerHTML={jsonLdScriptProps(productSchema)}
        />
      )}
      {breadcrumbSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScriptProps(breadcrumbSchema)}
        />
      )}

      {/* Breadcrumb */}
      <div className="border-b border-edge bg-surface">
        <div className="container-page py-3.5">
          <nav className="flex items-center gap-2 text-xs text-ink-muted">
            <Link href="/" className="hover:text-ink-primary">Home</Link>
            <span>/</span>
            <Link href="/products" className="hover:text-ink-primary">Products</Link>
            {product && (
              <>
                <span>/</span>
                <span className="font-medium text-ink-primary truncate max-w-[200px]">{product.name}</span>
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
          <Info className="mx-auto mb-4 h-10 w-10 text-ink-subtle" />
          <h1 className="mb-2 font-display text-2xl font-medium text-ink-primary">Product not available</h1>
          <p className="mb-6 text-sm text-ink-secondary">
            This product could not be found in the {currentRegion === 'IN' ? 'India' : 'United Kingdom'} region.
          </p>
          <Link
            href="/products"
            className="btn-primary gap-1 px-5 py-2.5 text-sm"
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
                <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-edge bg-surface-muted">
                  {images.length > 0 ? (
                    <img
                      src={images[activeImage]?.file_url}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Info className="h-12 w-12 text-ink-subtle" />
                  )}
                  {discount > 0 && (
                    <span className="absolute left-4 top-4 rounded-xs bg-surface-inverse px-3 py-1 text-xs font-medium uppercase tracking-wider text-white">
                      Save {discount}%
                    </span>
                  )}
                </div>
                
                {/* Thumbnails list */}
                <div className="flex gap-2.5 overflow-x-auto pb-1">
                  {images.map((img, i) => (
                    <button
                      key={img.id || i}
                      type="button"
                      onClick={() => setActiveImage(i)}
                      aria-label={`Show product image ${i + 1}`}
                      className={`h-16 w-16 overflow-hidden rounded-sm border shrink-0 transition-colors ${
                        activeImage === i ? 'border-ink-primary' : 'border-edge hover:border-edge-strong'
                      }`}
                    >
                      <img src={img.file_url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                  {videos.map((vid, idx) => (
                    <div
                      key={vid.id || idx}
                      className="h-16 w-16 overflow-hidden rounded-sm border border-edge shrink-0 relative bg-surface-inverse flex items-center justify-center cursor-pointer"
                    >
                      <span className="text-[9px] text-white font-medium tracking-widest absolute">VIDEO</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Info Column */}
              <div className="lg:col-span-6 space-y-6">
                <div>
                  <div className="mb-3 flex items-center gap-4">
                    <span className="kicker !text-ink-accent">
                      Verified GMP
                    </span>
                    <span className="kicker !text-ink-success">
                      Third-Party Tested
                    </span>
                  </div>
                  <h1 className="font-display text-[34px] md:text-[42px] font-medium leading-[1.1] text-ink-primary">{product.name}</h1>
                  
                  {/* Reviews Summary */}
                  <div className="mt-2.5 flex items-center gap-2">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i < Math.round(Number(averageRating))
                              ? 'fill-brand-accent text-brand-accent'
                              : 'text-edge'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-semibold text-ink-primary">{averageRating}</span>
                    <span className="text-[11px] text-ink-muted">({totalReviews} verified reviews)</span>
                  </div>
                </div>

                <p className="text-xs md:text-sm leading-relaxed text-ink-secondary">{product.description}</p>

                {/* Price Display */}
                <div className="border border-edge rounded-md p-5 bg-surface space-y-2 shadow-card">
                  <div className="flex items-center justify-between">
                    <span className="kicker">Price</span>
                    <div className="text-right">
                      {unavailable ? (
                        <span className="text-sm font-medium text-brand-warning">Not available in your region</span>
                      ) : promoVal ? (
                        <>
                          <span className="font-display text-[24px] font-medium text-ink-primary mr-2">
                            {currencySymbol}{promoVal.toFixed(2)}
                          </span>
                          <span className="text-xs text-ink-muted line-through">
                            {currencySymbol}{priceVal.toFixed(2)}
                          </span>
                        </>
                      ) : (
                        <span className="font-display text-[24px] font-medium text-ink-primary">
                          {currencySymbol}{priceVal.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Quantity + CTAs */}
                <div className="space-y-3.5">
                  <div className="flex items-center gap-3">
                    <span className="kicker">Quantity:</span>
                    <div className="flex items-center border border-edge rounded-sm bg-surface">
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        aria-label="Decrease quantity"
                        className="flex h-10 w-10 items-center justify-center font-medium text-ink-muted hover:text-ink-primary"
                      >
                        −
                      </button>
                      <span className="w-8 text-center text-xs font-semibold text-ink-primary">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => q + 1)}
                        aria-label="Increase quantity"
                        className="flex h-10 w-10 items-center justify-center font-medium text-ink-muted hover:text-ink-primary"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-[10px] text-ink-muted">
                      {stock > 0 ? `${stock} canisters available` : 'Out of stock'}
                    </span>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleAddToCart(false)}
                      disabled={stock === 0 || unavailable}
                      className="flex-1 btn-primary py-3.5 text-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <ShoppingCart className="h-4.5 w-4.5" />
                      {unavailable ? 'Not available in your region' : 'Add to Cart'}
                    </button>
                    <button
                      type="button"
                      onClick={handleBuyNow}
                      disabled={stock === 0 || unavailable}
                      className="flex-1 btn-ghost py-3.5 text-sm disabled:opacity-50"
                    >
                      Buy It Now
                    </button>
                    <button
                      type="button"
                      onClick={handleWishlistToggle}
                      disabled={wishlistLoading}
                      aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
                      className="rounded-sm border border-edge bg-surface p-3.5 hover:border-ink-primary transition-colors text-ink-muted hover:text-ink-accent shrink-0"
                    >
                      <Heart className={`h-5 w-5 ${isWishlisted ? 'fill-brand-accent text-brand-accent' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Trust Signifiers list */}
                <div className="grid grid-cols-2 gap-3 border-t border-edge-subtle pt-5">
                  <div className="flex items-start gap-2 text-xs">
                    <ShieldCheck className="h-5 w-5 text-brand-success shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-ink-primary">30-Day Refund Guarantee</p>
                      <p className="text-[10px] text-ink-muted">Risk-free purchase satisfaction assurance.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-xs">
                    <Award className="h-5 w-5 text-brand-accent shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-ink-primary">GMP Certified Facilities</p>
                      <p className="text-[10px] text-ink-muted">Manufactured under pharmaceutical controls.</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Product Information tabs */}
          <section className="border-t border-edge bg-brand-bg py-12">
            <div className="container-page">

              {/* Tab Header triggers */}
              <div className="flex border-b border-edge overflow-x-auto gap-2 pb-px scrollbar-none">
                {[
                  { id: 'description', label: 'Description' },
                  { id: 'benefits', label: 'Benefits' },
                  { id: 'ingredients', label: 'Ingredients' },
                  { id: 'how_to_use', label: 'How to Use' },
                  { id: 'science', label: 'Science & Research' },
                  { id: 'faqs', label: 'FAQs' },
                  { id: 'shipping', label: 'Shipping & Tax' },
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={`border-b-2 px-5 py-3 text-xs font-medium uppercase tracking-wider shrink-0 transition-colors ${
                      activeTab === t.id
                        ? 'border-ink-primary text-ink-primary'
                        : 'border-transparent text-ink-muted hover:text-ink-primary'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Tab Content Panels */}
              <div className="py-8 bg-surface border border-t-0 border-edge rounded-b-md p-6 lg:p-8">
                
                {activeTab === 'description' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium uppercase tracking-wider text-ink-primary">Product Summary</h3>
                    <p className="text-xs md:text-sm leading-relaxed text-ink-secondary">{product.description}</p>
                    <div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {nutritionRows.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-ink-primary mb-2">Supplement Facts</h4>
                          <div className="overflow-hidden rounded-md border border-edge">
                            {nutritionRows.map(([k, v], idx) => (
                              <div key={idx} className="flex justify-between px-3.5 py-2 text-xs border-b border-edge-subtle last:border-b-0">
                                <span className="text-ink-muted">{k}</span>
                                <span className="font-medium text-ink-primary">{String(v)}</span>
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
                    <h3 className="text-sm font-medium uppercase tracking-wider text-ink-primary">Primary Benefits</h3>
                    <p className="text-xs md:text-sm leading-relaxed text-ink-secondary">{product.benefits}</p>
                  </div>
                )}

                {activeTab === 'ingredients' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium uppercase tracking-wider text-ink-primary">Active Ingredients</h3>
                    <p className="text-xs md:text-sm leading-relaxed text-ink-secondary">{product.ingredients}</p>
                  </div>
                )}

                {activeTab === 'how_to_use' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium uppercase tracking-wider text-ink-primary">Usage Directions</h3>
                    <p className="text-xs md:text-sm leading-relaxed text-ink-secondary">
                      Add 1 level scoop (included inside the canister) daily to your beverage of choice (water, juice, smoothie, or tea). Stir vigorously for 30 seconds or use a shaker cup for optimal dissolution. For maximum joint matrix assimilation, take consistently at similar times daily.
                    </p>
                  </div>
                )}

                {activeTab === 'science' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium uppercase tracking-wider text-ink-primary">Science &amp; Clinical Background</h3>
                    <p className="text-xs md:text-sm leading-relaxed text-ink-secondary">
                      Sclero Proteins products are formulated to target articular cartilage synthesis pathways. Independent clinical evaluations of bioactive matrices indicate key cofactors and collagen forms can support mobility and decrease everyday joint friction when maintained continuously as part of an active recovery program.
                    </p>
                  </div>
                )}

                {activeTab === 'shipping' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium uppercase tracking-wider text-ink-primary">Fulfillment, Shipping &amp; Taxes</h3>
                    <p className="text-xs md:text-sm leading-relaxed text-ink-secondary">
                      We offer next-business-day shipping from our local Haywards Heath (UK) and Anand (India) logistics centers. Taxes (VAT for UK, GST for India) are completely inclusive in the listed price. Free shipping applies automatically above regional order limits (£50 for UK, ₹3,000 for India).
                    </p>
                  </div>
                )}

                {activeTab === 'faqs' && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium uppercase tracking-wider text-ink-primary">Product Frequently Asked Questions</h3>
                    {product.faq && product.faq.length > 0 ? (
                      <div className="space-y-3 mt-4">
                        {product.faq.map((item, idx) => {
                          const isOpen = expandedFaq === idx;
                          return (
                            <div key={idx} className="border border-edge rounded-lg overflow-hidden bg-white">
                              <button
                                type="button"
                                onClick={() => setExpandedFaq(isOpen ? null : idx)}
                                className="w-full flex justify-between items-center p-4 text-left font-semibold text-xs md:text-sm text-ink-primary hover:bg-surface-muted transition-colors"
                              >
                                <span>{item.q}</span>
                                <ChevronDown className={`h-4 w-4 text-brand-muted shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180 text-ink-accent' : ''}`} />
                              </button>
                              <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-96 border-t border-edge-subtle p-4 bg-surface-muted' : 'max-h-0'}`}>
                                <p className="text-xs md:text-sm leading-relaxed text-ink-secondary">
                                  {item.a}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs md:text-sm leading-relaxed text-brand-muted italic mt-2">
                        No product-specific FAQs available for this item at this time.
                      </p>
                    )}
                  </div>
                )}

              </div>

            </div>
          </section>

          {/* You may also like — Related products */}
          {(relatedLoading || relatedProducts.length > 0) && (
            <section className="py-12 border-t border-edge bg-brand-bg">
              <div className="container-page">
                <div className="mb-8 text-center md:text-left">
                  <span className="kicker !text-ink-accent">Recommended Products</span>
                  <h3 className="text-heading-2 mt-2">You may also like</h3>
                </div>

                {relatedLoading ? (
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="animate-pulse rounded-md bg-surface border border-edge p-5">
                        <div className="h-40 rounded-md bg-surface-muted mb-3" />
                        <div className="h-3 w-1/2 bg-surface-muted rounded-sm mb-2" />
                        <div className="h-3 w-3/4 bg-surface-muted rounded-sm mb-3" />
                        <div className="h-6 w-1/3 bg-surface-muted rounded-sm" />
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
          <section className="border-t border-edge bg-brand-bg py-12">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
              <h2 className="mb-8 text-heading-2">Customer Reviews</h2>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-10 items-center">

                {/* Score badge */}
                <div className="md:col-span-4 text-center p-6 bg-surface border border-edge rounded-md shadow-card">
                  <p className="font-display text-5xl font-medium text-ink-primary">{averageRating}</p>
                  <div className="flex justify-center my-2">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={`h-4.5 w-4.5 ${
                          i < Math.round(Number(averageRating))
                            ? 'fill-brand-accent text-brand-accent'
                            : 'text-edge'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-ink-muted">Based on {totalReviews} reviews</p>
                </div>

                {/* Bars breakdown */}
                <div className="md:col-span-8 space-y-2 text-xs">
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const count = ratingCounts[stars] || 0;
                    const percent = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
                    return (
                      <div key={stars} className="flex items-center gap-3 text-ink-primary">
                        <span className="w-3 text-right font-medium">{stars}</span>
                        <Star className="h-3.5 w-3.5 fill-brand-accent text-brand-accent shrink-0" />
                        <div className="flex-1 h-2 bg-surface-muted rounded-pill overflow-hidden">
                          <div className="h-full bg-brand-accent rounded-pill" style={{ width: `${percent}%` }} />
                        </div>
                        <span className="w-8 text-right text-ink-muted">{percent}%</span>
                      </div>
                    );
                  })}
                </div>

              </div>

              {/* Verified reviews listing */}
              <div className="space-y-4">
                {reviews.length === 0 ? (
                  <div className="rounded-md border border-edge bg-surface p-6 text-center">
                    <p className="text-sm font-medium text-ink-primary">No customer reviews yet.</p>
                    <p className="mt-1 text-xs text-ink-muted">Be the first to review this product after purchase.</p>
                  </div>
                ) : reviews.map((r, i) => (
                  <div key={r.id || i} className="rounded-md border border-edge bg-surface p-6 shadow-card">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-ink-primary">{r.user_name}</span>
                        {r.is_verified_purchase && (
                          <span className="inline-flex items-center gap-1 rounded-xs bg-brand-success/15 px-2 py-0.5 text-[9px] font-medium text-ink-success">
                            Verified Purchase
                          </span>
                        )}
                      </div>
                      <div className="flex">
                        {[...Array(5)].map((_, j) => (
                          <Star
                            key={j}
                            className={`h-3 w-3 ${
                              j < r.rating ? 'fill-brand-accent text-brand-accent' : 'text-edge'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs md:text-sm leading-relaxed text-ink-secondary">{r.comment}</p>
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
