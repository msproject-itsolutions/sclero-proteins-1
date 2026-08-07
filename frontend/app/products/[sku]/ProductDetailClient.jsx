'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSelector, useDispatch } from 'react-redux';
import Link from 'next/link';
import {
  Heart, ArrowLeft, ArrowRight, ShieldCheck, Info,
  ShoppingCart, Plus, Minus,
  Sparkles, HeartHandshake, Leaf, Check, FlaskConical, BadgeCheck,
  Rabbit, CandyOff, WheatOff
} from 'lucide-react';
import StoreShell from '../../../components/StoreShell';
import ProductCard from '../../../components/ProductCard';
import { addToCart } from '../../../store/cartSlice';
import { getApiUrl } from '../../../lib/api';
import { authenticatedFetch } from '../../../lib/authFetch';
import { fetchWishlistOnce, invalidateWishlistCache } from '../../../lib/wishlistCache';
import { jsonLdScriptProps } from '../../../lib/jsonLd';
import { trackEvent } from '../../../utils/analytics';

// Benefits arrive in two shapes across the catalogue:
//   "Beauty — a, b, c. Health — d, e."   -> labelled groups
//   "does a; does b; does c"             -> a flat list
// Anything unrecognised falls back to a single unlabelled group so the
// section still renders rather than disappearing.
function parseBenefits(raw) {
  const text = String(raw || '').trim();
  if (!text) return [];

  const groups = [];
  const groupRe = /([A-Za-z][A-Za-z\s&'-]{1,28}?)\s*[—–]\s*([^.]+?)(?=\.\s*[A-Za-z][A-Za-z\s&'-]{1,28}?\s*[—–]|\.\s*$|$)/g;
  let m;
  let firstIndex = -1;
  while ((m = groupRe.exec(text)) !== null) {
    if (firstIndex === -1) firstIndex = m.index;
    const items = m[2].split(/,\s*|;\s*/).map((s) => s.trim()).filter(Boolean);
    if (items.length) groups.push({ label: m[1].trim(), items });
  }
  // Only treat this as the labelled format when the text actually opens with a
  // label. Otherwise a trailing aside like "...chemical free — no herbicides"
  // would hijack the parse and swallow the real semicolon list before it.
  if (groups.length >= 2 && firstIndex === 0) return groups;

  const items = text
    .split(/;\s*|\.\s+/)
    .map((s) => s.replace(/\.$/, '').trim())
    .filter(Boolean);
  return items.length ? [{ label: null, items }] : [];
}

const BENEFIT_ICONS = [Sparkles, HeartHandshake, Leaf, ShieldCheck];

export default function ProductDetailClient({ sku }) {
  const router = useRouter();
  const dispatch = useDispatch();
  const { currentRegion, currencySymbol, session_id } = useSelector((s) => s.region);
  const isAuthenticated = useSelector((s) => s.auth?.isAuthenticated);

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  // Selection states
  const [quantity, setQuantity] = useState(1);
  const [activeImage, setActiveImage] = useState(0);
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
    if (!product || !isAuthenticated) {
      setIsWishlisted(false);
      setWishlistItemId(null);
      return;
    }

    fetchWishlistOnce(currentRegion, isAuthenticated)
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
  }, [product, isAuthenticated, currentRegion]);

  // Wishlist toggle handler
  const handleWishlistToggle = async () => {
    if (!isAuthenticated) {
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
        });
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
        });
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

    const basePrice = promoVal || priceVal;
    const finalPrice = basePrice;

    await dispatch(
      addToCart({
        session_id,
        region: currentRegion,
        product_id: product.id,
        quantity,
        metadata: selectedVariant ? { variant_sku: selectedVariant.sku, variant_name: selectedVariant.name } : null
      })
    ).unwrap().catch(() => null);

    // Track analytics event
    trackEvent('AddToCart', {
      content_ids: [selectedVariant?.sku || product.sku],
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

  const [selectedVariant, setSelectedVariant] = useState(null);

  useEffect(() => {
    if (product?.variants?.length > 0) {
      setSelectedVariant(product.variants[0]);
    }
  }, [product]);

  const images = (product?.media || []).filter((m) => m.media_type === 'IMAGE');
  const videos = (product?.media || []).filter((m) => m.media_type === 'VIDEO');

  const displayPrice = selectedVariant
    ? selectedVariant.price ?? product?.price
    : product?.price;

  const priceVal = displayPrice !== null && displayPrice !== undefined ? parseFloat(displayPrice) : 0;
  const promoVal = product?.promotional_price ? parseFloat(product.promotional_price) : null;
  const basePrice = promoVal || priceVal;
  
  const effectivePrice = basePrice;
  const discount = promoVal && priceVal ? Math.round(((priceVal - promoVal) / priceVal) * 100) : 0;
  const stock = selectedVariant ? (selectedVariant.stock_qty ?? product?.stock_available ?? 100) : (product?.stock_available ?? 100);
  const unavailable = !product || (displayPrice === null && displayPrice === undefined && (!product?.price && product?.price !== 0));
  const nutrition = product?.nutrition_facts || {};
  const nutritionRows = Object.entries(nutrition).filter(
    ([k, v]) => !k.startsWith('_') && (typeof v === 'string' || typeof v === 'number')
  );
  
  const benefitGroups = parseBenefits(product?.benefits);

  // Only the ingestible products carry a serving size. The soil/turf lines do
  // not, and the usage + science copy below is written for supplements — so it
  // is gated rather than shown as false claims on a soil conditioner.
  const servingSize = nutrition['Serving Size'];
  const isSupplement = Boolean(servingSize);
  const usageSteps = isSupplement
    ? [
        `Take ${String(servingSize).toLowerCase()}, at a consistent time each day.`,
        'Swallow with water, or add to your beverage of choice and stir for 30 seconds.',
        'Stay consistent — structural proteins rebuild gradually, not overnight.',
      ]
    : [];

  const rawReviews = product?.reviews || [];
  const reviews = rawReviews;

  const totalReviews = reviews.length;

  const productUrl = (typeof window !== 'undefined' && product)
    ? `${window.location.origin}/products/${product.sku}`
    : (product ? `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/products/${product.sku}` : '');
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
      { '@type': 'ListItem', 'position': 1, 'name': 'Home', 'item': `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/` },
      { '@type': 'ListItem', 'position': 2, 'name': 'Products', 'item': `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/products` },
      ...(primaryCategory ? [{ '@type': 'ListItem', 'position': 3, 'name': primaryCategory, 'item': `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/products?category=${encodeURIComponent(primaryCategory)}` }] : []),
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
                    <span className="kicker !text-ink-success">
                      Third-Party Tested
                    </span>
                  </div>
                  <h1 className="brand-heading-gradient font-display text-[34px] md:text-[42px] font-medium leading-[1.1]">{product.name}</h1>
                  
                  {totalReviews > 0 && (
                    <p className="mt-3 text-sm text-ink-muted">{totalReviews} customer reviews available below.</p>
                  )}
                </div>

                <p className="max-w-2xl text-sm leading-[1.9] text-ink-secondary">{product.description}</p>

                {/* Shopify-Style Variant Selector */}
                {product.variants && product.variants.length > 0 && (
                  <div className="rounded-[24px] border border-edge bg-surface p-5 shadow-card space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold uppercase tracking-luxe text-ink-muted">
                        Select {product.variants[0]?.option_name || 'Size / Option'}
                      </span>
                      {selectedVariant && (
                        <span className="text-xs font-mono text-ink-subtle">SKU: {selectedVariant.sku}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      {product.variants.map((v) => {
                        const isSelected = (selectedVariant?.id === v.id) || (!selectedVariant && v.sku === product.sku);
                        const vPrice = v.price;
                        return (
                          <button
                            key={v.id || v.sku}
                            type="button"
                            onClick={() => setSelectedVariant(v)}
                            className={`px-4 py-2.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer flex items-center gap-2 ${
                              isSelected
                                ? 'border-ink-primary bg-ink-primary text-white shadow-md'
                                : 'border-edge bg-white text-ink-primary hover:border-edge-strong hover:bg-surface-subtle'
                            }`}
                          >
                            <span>{v.name || v.option_value}</span>
                            {vPrice && (
                              <span className={`text-[11px] font-mono ${isSelected ? 'text-white/80' : 'text-ink-subtle'}`}>
                                ({currencySymbol}{parseFloat(vPrice).toFixed(2)})
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Price Display */}
                <div className="rounded-[24px] border border-edge bg-surface p-5 shadow-card">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium uppercase tracking-luxe text-ink-muted">Price</span>
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
                <div id="buy" className="scroll-mt-28 space-y-4 rounded-[24px] border border-edge bg-brand-bg p-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[11px] font-medium uppercase tracking-luxe text-ink-muted">Quantity</span>
                    <div className="flex items-center rounded-full border border-edge bg-surface">
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
                    <span className="text-xs text-ink-muted">
                      {stock > 0 ? `${stock} canisters available` : 'Out of stock'}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={() => handleAddToCart(false)}
                      disabled={stock === 0 || unavailable}
                      className="w-full btn-primary py-3.5 text-sm flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    >
                      <ShoppingCart className="h-4.5 w-4.5" />
                      {unavailable ? 'Not available in your region' : 'Add to Cart'}
                    </button>
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={handleBuyNow}
                        disabled={stock === 0 || unavailable}
                        className="flex-1 btn-ghost py-3.5 text-sm disabled:opacity-50 cursor-pointer"
                      >
                        Buy It Now
                      </button>
                      <button
                        type="button"
                        onClick={handleWishlistToggle}
                        disabled={wishlistLoading}
                        aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
                        className="flex h-12 w-12 items-center justify-center rounded-full border border-edge bg-surface text-ink-muted transition-colors hover:border-ink-primary hover:text-ink-accent shrink-0 cursor-pointer"
                      >
                        <Heart className={`h-5 w-5 ${isWishlisted ? 'fill-brand-accent text-brand-accent' : ''}`} />
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Label claims strip — mirrors the four marks printed on the pack */}
          {isSupplement && (
            <section className="border-y border-edge bg-surface-inverse py-6">
              <div className="container-page">
                <div className="grid grid-cols-2 gap-y-6 md:grid-cols-4">
                  {[
                    { icon: Rabbit, label: "We don't test on animals" },
                    { icon: FlaskConical, label: 'Preservatives & Artificial Flavour Free' },
                    { icon: CandyOff, label: 'No added Sugars or Sweeteners' },
                    { icon: WheatOff, label: 'Gluten & Yeast Free' },
                  ].map((t) => {
                    const Icon = t.icon;
                    return (
                      <div key={t.label} className="flex flex-col items-center gap-3 px-3 text-center">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/30 text-white/80">
                          <Icon className="h-5 w-5" />
                        </span>
                        <p className="max-w-[150px] text-[11px] font-semibold leading-[1.45] text-white">{t.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* Description — the pitch */}
          <section id="description" className="scroll-mt-24 bg-surface section">
            <div className="container-page">
              <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
                <div>
                  <span className="kicker">The Product</span>
                  <h2 className="text-heading-1 mt-3 max-w-xl">{product.short_benefit || 'Built for people who read the label.'}</h2>
                  <p className="mt-5 max-w-xl text-[15px] leading-[1.9] text-ink-secondary">{product.description}</p>
                  {!unavailable && (
                    <a href="#buy" className="btn-primary mt-7 inline-flex px-6 py-3 text-sm">
                      <ShoppingCart className="h-4 w-4" /> Add to cart — {currencySymbol}{effectivePrice.toFixed(2)}
                    </a>
                  )}
                </div>

                {nutritionRows.length > 0 && (
                  <div className="rounded-[28px] border border-edge bg-surface-subtle p-7 shadow-card">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-accent">Supplement facts</p>
                    <div className="mt-5 divide-y divide-edge-subtle">
                      {nutritionRows.map(([k, v], idx) => (
                        <div key={idx} className="flex items-baseline justify-between gap-6 py-3">
                          <span className="text-xs text-ink-muted">{k}</span>
                          <span className="text-right text-sm font-semibold text-ink-primary">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Benefits — the scannable payoff */}
          {benefitGroups.length > 0 && (
            <section id="benefits" className="scroll-mt-24 border-y border-edge bg-surface-subtle section">
              <div className="container-page">
                <div className="max-w-2xl">
                  <span className="kicker">Why It Works</span>
                  <h2 className="text-heading-1 mt-3">What you can expect from daily use.</h2>
                </div>

                <div className={`mt-10 grid gap-5 ${benefitGroups.length > 1 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                  {benefitGroups.map((group, gIdx) => {
                    const Icon = BENEFIT_ICONS[gIdx % BENEFIT_ICONS.length];
                    return group.label ? (
                      <article key={gIdx} className="rounded-[28px] border border-edge bg-white p-7 shadow-card">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle text-ink-accent shadow-card">
                          <Icon className="h-5 w-5" />
                        </div>
                        <h3 className="mt-5 text-xl font-bold capitalize text-ink-primary">{group.label}</h3>
                        <ul className="mt-4 space-y-2.5">
                          {group.items.map((item, i) => (
                            <li key={i} className="flex gap-2.5 text-sm leading-[1.7] text-ink-secondary">
                              <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-brand-success" />
                              <span className="first-letter:uppercase">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </article>
                    ) : (
                      group.items.map((item, i) => (
                        <div key={i} className="flex gap-3 rounded-[20px] border border-edge bg-white p-5 shadow-card">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-success" />
                          <p className="text-sm leading-[1.7] text-ink-secondary first-letter:uppercase">{item}</p>
                        </div>
                      ))
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* Ingredients */}
          <section id="ingredients" className="scroll-mt-24 bg-surface section">
            <div className="container-page">
              <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                {images.length > 0 && (
                  <div className="overflow-hidden rounded-[32px] border border-edge bg-surface-muted shadow-elevated">
                    <img src={images[0].file_url} alt={product.name} className="h-full max-h-[420px] w-full object-cover" loading="lazy" />
                  </div>
                )}
                <div>
                  <span className="kicker">What's Inside</span>
                  <h2 className="text-heading-1 mt-3">Every ingredient, stated plainly.</h2>
                  <p className="mt-5 text-[15px] leading-[1.9] text-ink-secondary">{product.ingredients}</p>
                  {product.dietary_tags?.length > 0 && (
                    <div className="mt-6 flex flex-wrap gap-2">
                      {product.dietary_tags.map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-1.5 rounded-full border border-edge bg-surface-subtle px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
                          <BadgeCheck className="h-3.5 w-3.5 text-brand-success" />
                          {String(tag).replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* How to use — numbered steps */}
          {usageSteps.length > 0 && (
            <section id="how-to-use" className="scroll-mt-24 border-y border-edge bg-surface-subtle section">
              <div className="container-page">
                <div className="max-w-2xl">
                  <span className="kicker">How To Use</span>
                  <h2 className="text-heading-1 mt-3">Three steps, once a day.</h2>
                </div>
                <div className="mt-10 grid gap-5 md:grid-cols-3">
                  {usageSteps.map((step, i) => (
                    <div key={i} className="rounded-[28px] border border-edge bg-white p-7 shadow-card">
                      <span className="font-display text-[32px] font-medium leading-none text-ink-accent">0{i + 1}</span>
                      <p className="mt-4 text-sm leading-[1.8] text-ink-secondary">{step}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Science — dark band for gravitas */}
          {isSupplement && (
          <section id="science" className="scroll-mt-24 bg-surface-inverse section">
            <div className="container-page">
              <div className="mx-auto max-w-3xl text-center">
                <FlaskConical className="mx-auto h-8 w-8 text-white/50" />
                <span className="kicker mt-5 block !text-white/60">Science &amp; Research</span>
                <h2 className="mt-3 font-display text-[28px] font-medium leading-[1.35] text-white md:text-[34px]">
                  Formulated around the structural proteins your body already uses.
                </h2>
                <p className="mt-5 text-[15px] leading-[1.9] text-white/70">
                  Sclero Proteins products are formulated to target articular cartilage synthesis pathways. Independent clinical evaluations of bioactive matrices indicate key cofactors and collagen forms can support mobility and decrease everyday joint friction when maintained continuously as part of an active recovery program.
                </p>
                <Link href="/knowledge-hub" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-white transition-opacity hover:opacity-70">
                  Read the science in our Knowledge Hub <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </section>
          )}

          {/* FAQs */}
          {product.faq?.length > 0 && (
            <section id="faqs" className="scroll-mt-24 border-b border-edge bg-surface section">
              <div className="container-page">
                <div className="text-center">
                  <h2 className="text-[40px] font-extrabold leading-[1.1] tracking-tight text-ink-primary sm:text-[52px]">Q&amp;A</h2>
                  <p className="mx-auto mt-4 max-w-xl text-body">Everything people ask before their first order.</p>
                </div>

                <div className="mt-12 grid gap-x-8 gap-y-5 md:grid-cols-2 md:items-start">
                  {product.faq.map((item, idx) => {
                    const isOpen = expandedFaq === idx;
                    return (
                      <div key={idx} className="overflow-hidden rounded-[18px] bg-surface-subtle transition-colors hover:bg-surface-muted">
                        <button
                          type="button"
                          onClick={() => setExpandedFaq(isOpen ? null : idx)}
                          aria-expanded={isOpen}
                          className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                        >
                          <span className="text-sm font-semibold uppercase leading-[1.5] tracking-[0.06em] text-ink-primary">{item.q}</span>
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-ink-primary/40 text-ink-primary">
                            {isOpen ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                          </span>
                        </button>
                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96' : 'max-h-0'}`}>
                          <p className="px-6 pb-6 text-sm leading-[1.8] text-ink-secondary">{item.a}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* Closing CTA + shipping detail */}
          <section id="shipping" className="scroll-mt-24 bg-surface-subtle section">
            <div className="container-page">
              <div className="grid gap-10 lg:grid-cols-[1fr_0.85fr] lg:items-center">
                <div>
                  <span className="kicker">Shipping &amp; Tax</span>
                  <h2 className="text-heading-1 mt-3">No surprises at checkout.</h2>
                  <ul className="mt-6 space-y-3.5">
                    {[
                      'Next-business-day dispatch from Haywards Heath (UK) and Anand (India).',
                      'Taxes included in the listed price — VAT for the UK, GST for India.',
                      'Free shipping above £50 in the UK and ₹3,000 in India.',
                    ].map((line) => (
                      <li key={line} className="flex gap-3 text-sm leading-[1.8] text-ink-secondary">
                        <Check className="mt-1.5 h-3.5 w-3.5 shrink-0 text-brand-success" />
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-[28px] border border-edge bg-white p-8 text-center shadow-elevated">
                  <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-ink-accent">Ready when you are</p>
                  <p className="mt-4 font-display text-[30px] font-medium text-ink-primary">{product.name}</p>
                  {!unavailable && (
                    <p className="mt-2 text-sm text-ink-muted">
                      <span className="font-display text-[22px] text-ink-primary">{currencySymbol}{effectivePrice.toFixed(2)}</span>
                      {promoVal && <span className="ml-2 text-xs line-through">{currencySymbol}{priceVal.toFixed(2)}</span>}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => handleAddToCart(false)}
                    disabled={stock === 0 || unavailable}
                    className="btn-primary mt-6 w-full justify-center py-3.5 text-sm disabled:opacity-50"
                  >
                    <ShoppingCart className="h-4.5 w-4.5" />
                    {unavailable ? 'Not available in your region' : stock === 0 ? 'Out of stock' : 'Add to Cart'}
                  </button>
                  <p className="mt-3 text-[11px] text-ink-muted">Secure checkout</p>
                </div>
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
              <p className="mb-8 text-sm leading-[1.8] text-ink-secondary">
                Read feedback from customers who have already purchased this product.
              </p>

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
                      <span className="text-[11px] uppercase tracking-luxe text-ink-muted">{r.rating}/5 rating</span>
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
