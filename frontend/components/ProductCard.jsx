import React from 'react';
import { useSelector } from 'react-redux';
import {
  Star, AlertTriangle, CheckCircle, Info, Heart,
  Leaf, Wheat, MilkOff, Candy, Beef, ShieldCheck, FlaskConical, Sprout
} from 'lucide-react';
import { CompactTrustBadges } from './TrustBadges';
import { getApiUrl } from '../lib/api';
import { authenticatedFetch } from '../lib/authFetch';
import { fetchWishlistOnce, invalidateWishlistCache } from '../lib/wishlistCache';

// Slug -> label + icon
const DIETARY_TAG_MAP = {
  vegan:              { label: 'Vegan',              icon: Leaf },
  vegetarian:         { label: 'Vegetarian',         icon: Sprout },
  gluten_free:        { label: 'Gluten-free',        icon: Wheat },
  'gluten-free':      { label: 'Gluten-free',        icon: Wheat },
  dairy_free:         { label: 'Dairy-free',         icon: MilkOff },
  'dairy-free':       { label: 'Dairy-free',         icon: MilkOff },
  sugar_free:         { label: 'Sugar-free',         icon: Candy },
  'sugar-free':       { label: 'Sugar-free',         icon: Candy },
  halal:              { label: 'Halal',              icon: Beef },
  kosher:             { label: 'Kosher',             icon: Beef },
  gmp_certified:      { label: 'GMP certified',      icon: ShieldCheck },
  'gmp-certified':    { label: 'GMP certified',      icon: ShieldCheck },
  lab_tested:         { label: 'Lab tested',         icon: FlaskConical },
  'lab-tested':       { label: 'Lab tested',         icon: FlaskConical },
  non_gmo:            { label: 'Non-GMO',            icon: Leaf },
  'non-gmo':          { label: 'Non-GMO',            icon: Leaf },
  third_party_tested: { label: '3rd-party tested',   icon: FlaskConical },
  'third-party-tested': { label: '3rd-party tested', icon: FlaskConical },
};

function DietaryBadgeRow({ tags = [], max = 3 }) {
  if (!tags || tags.length === 0) return null;
  const known = tags.filter((t) => DIETARY_TAG_MAP[t]);
  const shown = known.slice(0, max);
  const extra = known.length - shown.length;
  if (shown.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1">
      {shown.map((slug) => {
        const meta = DIETARY_TAG_MAP[slug];
        const Icon = meta.icon;
        return (
          <span
            key={slug}
            title={meta.label}
            className="inline-flex items-center gap-1 rounded-xs bg-surface-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-luxe text-ink-accent"
          >
            <Icon className="h-2.5 w-2.5 text-brand-accent" />
            <span>{meta.label}</span>
          </span>
        );
      })}
      {extra > 0 && (
        <span className="text-[9px] font-medium text-ink-muted">+{extra} more</span>
      )}
    </div>
  );
}

export default function ProductCard({
  product,
  onAddToCart,
  onViewDetails,
  variant = 'standard', // 'standard' | 'compact' | 'featured'
}) {
  const { currencySymbol, currentRegion, taxMode } = useSelector((state) => state.region);
  const accessToken = useSelector((state) => state.auth?.access);
  const [isWishlisted, setIsWishlisted] = React.useState(false);
  const [wishlistItemId, setWishlistItemId] = React.useState(null);
  const [wishlistLoading, setWishlistLoading] = React.useState(false);

  const taxLabel = currentRegion === 'IN' ? 'GST' : 'VAT';

  // Some endpoints (product detail / related) ship a `media` array instead of
  // the list serializer's `thumbnail` — fall back so cards never render blank.
  const thumbnail =
    product.thumbnail ||
    product.media?.find((m) => m.media_type === 'IMAGE')?.file_url ||
    product.media?.[0]?.file_url ||
    null;
  const taxNote = taxMode === 'exclusive' ? `+ ${taxLabel} at checkout` : `inc. ${taxLabel}`;

  // No regional price config for this region -> not sellable here.
  const unavailable = product.price === null || product.price === undefined;
  const priceVal = product.price ? parseFloat(product.price) : 0;
  const promoPriceVal = product.promotional_price
    ? parseFloat(product.promotional_price)
    : null;
  const stock = product.stock_available || 0;

  // Calculate discount percentage
  const discountPercent = promoPriceVal && priceVal
    ? Math.round(((priceVal - promoPriceVal) / priceVal) * 100)
    : 0;

  React.useEffect(() => {
    if (!accessToken || unavailable) return;
    fetchWishlistOnce(currentRegion, accessToken)
      .then((items) => {
        const found = items.find((item) => item.product_sku === product.sku);
        if (found) {
          setIsWishlisted(true);
          setWishlistItemId(found.id);
        }
      })
      .catch(() => {});
  }, [accessToken, product.sku, currentRegion, unavailable]);

  const handleWishlistToggle = async (e) => {
    e.stopPropagation();
    if (!accessToken) {
      window.location.href = '/account';
      return;
    }
    if (wishlistLoading) return;
    setWishlistLoading(true);
    try {
      if (isWishlisted && wishlistItemId) {
        const res = await authenticatedFetch(`/api/wishlist/${wishlistItemId}/`, {
          method: 'DELETE',
        }, accessToken);
        if (res.ok) {
          setIsWishlisted(false);
          setWishlistItemId(null);
          invalidateWishlistCache();
        }
      } else {
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
      console.error(e);
    } finally {
      setWishlistLoading(false);
    }
  };

  if (variant === 'compact') {
    // Compact card for grid display
    return (
      <div className="reveal group relative flex flex-col justify-between overflow-hidden rounded-md border border-edge bg-surface p-4 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-edge-strong hover:shadow-elevated">
        {/* Image */}
        <div className="relative mb-3 flex h-40 w-full items-center justify-center overflow-hidden rounded-sm border border-edge-subtle bg-surface-muted">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            />
          ) : (
            <Info className="h-8 w-8 text-ink-subtle" />
          )}

          {/* Discount Badge */}
          {discountPercent > 0 && (
            <div className="absolute right-2 top-2 rounded-xs bg-white/90 px-2 py-1 text-[10px] font-medium uppercase tracking-luxe text-ink-accent">
              -{discountPercent}%
            </div>
          )}

          {/* Stock Badge */}
          {stock === 0 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white font-medium text-sm">Out of Stock</span>
            </div>
          )}
        </div>

        {/* Rating & Reviews */}
        <div className="mb-2 flex items-center gap-1">
          <Star className="h-3 w-3 fill-brand-accent text-brand-accent" />
          <span className="text-[10px] font-medium text-ink-primary">
            {product.average_rating || 5.0}
          </span>
          <span className="text-[9px] text-ink-subtle">
            ({product.review_count || 0})
          </span>
        </div>

        {/* Name */}
        <h3 className="mb-1 line-clamp-2 font-display text-[16px] font-semibold leading-tight text-ink-primary">
          {product.name}
        </h3>

        {/* Short benefit */}
        {product.short_benefit && (
          <p className="mb-1.5 line-clamp-2 text-xs text-ink-secondary">{product.short_benefit}</p>
        )}

        {/* Price */}
        <div className="mb-2 flex items-baseline gap-2">
          {promoPriceVal ? (
            <>
              <span className="font-display text-[17px] font-medium text-ink-accent">
                {currencySymbol}{promoPriceVal.toFixed(2)}
              </span>
              <span className="text-[10px] text-ink-subtle line-through">
                {currencySymbol}{priceVal.toFixed(2)}
              </span>
            </>
          ) : (
            <span className="font-display text-[17px] font-medium text-ink-primary">
              {currencySymbol}{priceVal.toFixed(2)}
            </span>
          )}
        </div>

        {/* Dietary badges */}
        <DietaryBadgeRow tags={product.dietary_tags} max={3} />

        {/* CTAs */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => onAddToCart(product)}
            disabled={stock === 0 || unavailable}
            className="flex-1 btn-primary py-2 text-xs disabled:opacity-50"
          >
            {unavailable ? 'Unavailable here' : 'Add to cart'}
          </button>
          <button
            onClick={handleWishlistToggle}
            disabled={wishlistLoading}
            aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
            className="px-3 py-2 rounded-sm border border-edge hover:border-edge-strong hover:bg-surface-muted transition-colors disabled:opacity-60"
          >
            <Heart
              className={`h-4 w-4 ${isWishlisted ? 'fill-brand-accent text-brand-accent' : 'text-ink-muted'}`}
            />
          </button>
        </div>
      </div>
    );
  }

  // Standard card
  return (
    <div className="reveal group relative flex flex-col overflow-hidden rounded-md border border-edge bg-surface shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-edge-strong hover:shadow-elevated">
      {/* Top Badges */}
      <div className="absolute right-4 top-4 z-10 flex flex-col items-end gap-2">
        {discountPercent > 0 && (
          <span className="inline-flex items-center rounded-xs bg-white/90 px-2 py-1 text-[10px] font-medium uppercase tracking-luxe text-ink-accent">
            Save {discountPercent}%
          </span>
        )}

        {stock === 0 ? (
          <span className="inline-flex items-center gap-1 rounded-xs bg-white/90 px-2 py-1 text-[10px] font-medium uppercase tracking-luxe text-ink-danger">
            OUT OF STOCK
          </span>
        ) : stock <= 15 ? (
          <span className="inline-flex items-center gap-1 rounded-xs bg-white/90 px-2 py-1 text-[10px] font-medium uppercase tracking-luxe text-brand-warning">
            <AlertTriangle className="h-3 w-3" />
            LOW STOCK
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-xs bg-white/90 px-2 py-1 text-[10px] font-medium uppercase tracking-luxe text-ink-success">
            <CheckCircle className="h-3 w-3" />
            IN STOCK
          </span>
        )}
      </div>

      {/* Image */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface-muted">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center text-ink-subtle">
            <Info className="mb-2 h-10 w-10" />
            <span className="text-xs">No image available</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-6">
        {/* Rating & Reviews */}
        <div className="mb-2 flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Star className="h-3.5 w-3.5 fill-brand-accent text-brand-accent" />
            <span className="text-xs font-medium text-ink-primary">
              {product.average_rating || 5.0}
            </span>
          </div>
          <span className="text-[10px] text-ink-subtle">
            {product.review_count ? `${product.review_count} reviews` : 'New product'}
          </span>
        </div>

        {/* Name */}
        <h3 className="mb-1 line-clamp-2 font-display text-[20px] font-semibold leading-tight text-ink-primary">
          {product.name}
        </h3>

        {/* Short benefit */}
        {product.short_benefit && (
          <p className="mb-2 line-clamp-2 text-[13px] text-ink-secondary">{product.short_benefit}</p>
        )}

        {/* SKU & Key Specs */}
        <div className="mb-3 space-y-1">
          <p className="font-mono text-[10px] uppercase text-ink-subtle">
            SKU: {product.sku}
          </p>
          {product.serving_size && (
            <p className="text-[11px] text-ink-muted">
              {product.serving_size} • {product.servings_per_container} servings
            </p>
          )}
        </div>

        {/* Trust Badges */}
        {product.certifications && product.certifications.length > 0 && (
          <div className="mb-3">
            <CompactTrustBadges certifications={product.certifications} />
          </div>
        )}

        {/* Price */}
        <div className="mb-4">
          <div className="flex items-baseline gap-2">
            {promoPriceVal ? (
              <>
                <span className="font-display text-[17px] font-medium text-ink-accent">
                  {currencySymbol}
                  {promoPriceVal.toFixed(2)}
                </span>
                <span className="text-xs text-ink-subtle line-through">
                  {currencySymbol}
                  {priceVal.toFixed(2)}
                </span>
              </>
            ) : (
              <span className="font-display text-[17px] font-medium text-ink-primary">
                {currencySymbol}
                {priceVal.toFixed(2)}
              </span>
            )}
          </div>
          <span className="text-[10px] text-ink-subtle">{taxNote}</span>
          {/* Dietary badges */}
          <DietaryBadgeRow tags={product.dietary_tags} max={3} />
        </div>

        {/* CTAs */}
        <div className="mt-auto flex flex-col gap-2">
          <button
            type="button"
            onClick={() => onAddToCart(product)}
            disabled={stock === 0 || unavailable}
            className="btn-primary w-full py-2.5 text-xs disabled:opacity-50"
          >
            {unavailable ? 'Not available in your region' : stock === 0 ? 'Out of stock' : 'Add to cart'}
          </button>
          <button
            type="button"
            onClick={() => onViewDetails(product.sku)}
            className="btn-ghost w-full py-2.5 text-xs"
          >
            View details
          </button>
        </div>
      </div>
    </div>
  );
}
