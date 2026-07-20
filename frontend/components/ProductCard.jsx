import React from 'react';
import { useSelector } from 'react-redux';
import {
  AlertTriangle,
  Check,
  CheckCircle,
  Heart,
  Info,
  Leaf,
  MilkOff,
  ShieldCheck,
  Star,
  Wheat,
  Candy,
  Beef,
  FlaskConical,
  Sprout,
} from 'lucide-react';
import { CompactTrustBadges } from './TrustBadges';
import { authenticatedFetch } from '../lib/authFetch';
import { fetchWishlistOnce, invalidateWishlistCache } from '../lib/wishlistCache';

const DIETARY_TAG_MAP = {
  vegan: { label: 'Vegan', icon: Leaf },
  vegetarian: { label: 'Vegetarian', icon: Sprout },
  gluten_free: { label: 'Gluten-free', icon: Wheat },
  'gluten-free': { label: 'Gluten-free', icon: Wheat },
  dairy_free: { label: 'Dairy-free', icon: MilkOff },
  'dairy-free': { label: 'Dairy-free', icon: MilkOff },
  sugar_free: { label: 'Sugar-free', icon: Candy },
  'sugar-free': { label: 'Sugar-free', icon: Candy },
  halal: { label: 'Halal', icon: Beef },
  kosher: { label: 'Kosher', icon: Beef },
  gmp_certified: { label: 'GMP certified', icon: ShieldCheck },
  'gmp-certified': { label: 'GMP certified', icon: ShieldCheck },
  lab_tested: { label: 'Lab tested', icon: FlaskConical },
  'lab-tested': { label: 'Lab tested', icon: FlaskConical },
  non_gmo: { label: 'Non-GMO', icon: Leaf },
  'non-gmo': { label: 'Non-GMO', icon: Leaf },
  third_party_tested: { label: '3rd-party tested', icon: FlaskConical },
  'third-party-tested': { label: '3rd-party tested', icon: FlaskConical },
};

function DietaryBadgeRow({ tags = [], max = 3 }) {
  if (!tags || tags.length === 0) return null;
  const known = tags.filter((t) => DIETARY_TAG_MAP[t]);
  const shown = known.slice(0, max);
  const extra = known.length - shown.length;
  if (shown.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {shown.map((slug) => {
        const meta = DIETARY_TAG_MAP[slug];
        const Icon = meta.icon;
        return (
          <span
            key={slug}
            title={meta.label}
            className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-ink-accent"
          >
            <Icon className="h-2.5 w-2.5 text-brand-accent" />
            <span>{meta.label}</span>
          </span>
        );
      })}
      {extra > 0 && (
        <span className="text-[10px] font-semibold text-ink-muted">+{extra} more</span>
      )}
    </div>
  );
}

function getBenefitList(product) {
  const candidates = [
    product.short_benefit,
    product.benefits,
    product.description,
  ].filter(Boolean);

  const lines = candidates
    .flatMap((entry) => String(entry).split(/[\n,.;•]+/))
    .map((item) => item.trim())
    .filter((item) => item.length > 12);

  const unique = [];
  for (const line of lines) {
    if (!unique.some((existing) => existing.toLowerCase() === line.toLowerCase())) {
      unique.push(line);
    }
    if (unique.length === 3) break;
  }

  return unique;
}

function RatingRow({ rating }) {
  const safeRating = Number.isFinite(rating) ? rating : 5;
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 text-amber-500">
        {[0, 1, 2, 3, 4].map((index) => (
          <Star key={index} className={`h-3.5 w-3.5 ${safeRating >= index + 1 ? 'fill-current' : 'text-amber-200'}`} />
        ))}
      </div>
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {safeRating.toFixed(1)} rating
      </span>
    </div>
  );
}

export default function ProductCard({
  product,
  onAddToCart,
  onViewDetails,
  variant = 'standard',
  showRating = true,
}) {
  const { currencySymbol, currentRegion, taxMode } = useSelector((state) => state.region);
  const isAuthenticated = useSelector((state) => state.auth?.isAuthenticated);
  const [isWishlisted, setIsWishlisted] = React.useState(false);
  const [wishlistItemId, setWishlistItemId] = React.useState(null);
  const [wishlistLoading, setWishlistLoading] = React.useState(false);

  const taxLabel = currentRegion === 'IN' ? 'GST' : 'VAT';
  const thumbnail =
    product.thumbnail ||
    product.media?.find((m) => m.media_type === 'IMAGE')?.file_url ||
    product.media?.[0]?.file_url ||
    null;
  const taxNote = taxMode === 'exclusive' ? `+ ${taxLabel} at checkout` : `inc. ${taxLabel}`;
  const unavailable = product.price === null || product.price === undefined;
  const priceVal = product.price ? parseFloat(product.price) : 0;
  const promoPriceVal = product.promotional_price ? parseFloat(product.promotional_price) : null;
  const stock = product.stock_available || 0;
  const rating = parseFloat(product.average_rating || 5);
  const benefits = getBenefitList(product);

  const discountPercent = promoPriceVal && priceVal
    ? Math.round(((priceVal - promoPriceVal) / priceVal) * 100)
    : 0;

  React.useEffect(() => {
    if (!isAuthenticated || unavailable) return;
    fetchWishlistOnce(currentRegion, isAuthenticated)
      .then((items) => {
        const found = items.find((item) => item.product_sku === product.sku);
        if (found) {
          setIsWishlisted(true);
          setWishlistItemId(found.id);
        }
      })
      .catch(() => {});
  }, [isAuthenticated, product.sku, currentRegion, unavailable]);

  const handleWishlistToggle = async (e) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      window.location.href = '/account';
      return;
    }
    if (wishlistLoading) return;
    setWishlistLoading(true);
    try {
      if (isWishlisted && wishlistItemId) {
        const res = await authenticatedFetch(`/api/wishlist/${wishlistItemId}/`, {
          method: 'DELETE',
        });
        if (res.ok) {
          setIsWishlisted(false);
          setWishlistItemId(null);
          invalidateWishlistCache();
        }
      } else {
        const res = await authenticatedFetch('/api/wishlist/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ product_id: product.id, region: currentRegion }),
        });
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
    return (
      <div className="reveal group gradient-ring relative flex flex-col justify-between overflow-hidden rounded-[24px] border border-edge bg-white p-4 shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:shadow-elevated">
        <div className="relative mb-3 flex h-40 w-full items-center justify-center overflow-hidden rounded-[18px] bg-surface-muted">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
            />
          ) : (
            <Info className="h-8 w-8 text-ink-subtle" />
          )}

          {discountPercent > 0 && (
            <div className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-accent">
              -{discountPercent}%
            </div>
          )}

          {stock === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-[#101871]/55">
              <span className="rounded-full bg-white/[0.14] px-3 py-1 text-sm font-semibold text-white">Out of stock</span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          {showRating && <RatingRow rating={rating} />}
          <h3 className="line-clamp-2 text-lg font-bold leading-tight text-ink-primary">
            {product.name}
          </h3>
          {product.short_benefit && (
            <p className="line-clamp-2 text-sm text-ink-secondary">{product.short_benefit}</p>
          )}
        </div>

        <div className="mt-4 flex items-baseline gap-2">
          {promoPriceVal ? (
            <>
              <span className="text-lg font-bold text-ink-accent">
                {currencySymbol}{promoPriceVal.toFixed(2)}
              </span>
              <span className="text-[11px] text-ink-subtle line-through">
                {currencySymbol}{priceVal.toFixed(2)}
              </span>
            </>
          ) : (
            <span className="text-lg font-bold text-ink-primary">
              {currencySymbol}{priceVal.toFixed(2)}
            </span>
          )}
        </div>

        <DietaryBadgeRow tags={product.dietary_tags} max={3} />

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => onAddToCart(product)}
            disabled={stock === 0 || unavailable}
            className="btn-primary flex-1 py-2.5 text-xs disabled:opacity-50"
          >
            {unavailable ? 'Unavailable here' : 'Add to cart'}
          </button>
          <button
            onClick={handleWishlistToggle}
            disabled={wishlistLoading}
            aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
            className="rounded-full border border-edge px-3 py-2.5 transition-colors hover:border-edge-focus hover:bg-surface-muted disabled:opacity-60"
          >
            <Heart className={`h-4 w-4 ${isWishlisted ? 'fill-brand-accent text-brand-accent' : 'text-ink-muted'}`} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="reveal group gradient-ring relative flex flex-col overflow-hidden rounded-[26px] border border-edge bg-white shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:shadow-elevated">
      <div className="absolute right-4 top-4 z-10 flex flex-col items-end gap-2">
        {discountPercent > 0 && (
          <span className="inline-flex items-center rounded-full bg-white/95 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-accent shadow-card">
            Save {discountPercent}%
          </span>
        )}

        {stock === 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-danger shadow-card">
            Out of stock
          </span>
        ) : stock <= 15 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-warning shadow-card">
            <AlertTriangle className="h-3 w-3" />
            Low stock
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-success shadow-card">
            <CheckCircle className="h-3 w-3" />
            In stock
          </span>
        )}
      </div>

      <div className="relative aspect-[4/4] w-full overflow-hidden bg-[linear-gradient(180deg,#F6F4FB_0%,#FFFFFF_100%)] p-2">
        {thumbnail ? (
          <>
            <div className="absolute inset-x-[18%] bottom-[10%] h-24 rounded-full bg-brand-gradient opacity-15 blur-3xl" />
            <img
              src={thumbnail}
              alt={product.name}
              className="relative z-[1] h-full w-full object-contain p-2 transition-transform duration-700 group-hover:scale-[1.05]"
              loading="lazy"
            />
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center text-ink-subtle">
            <Info className="mb-2 h-10 w-10" />
            <span className="text-xs">No image available</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-6">
        <div className="mb-3 flex items-start justify-between gap-3">
          {showRating ? <RatingRow rating={rating} /> : <div />}
          <button
            type="button"
            onClick={handleWishlistToggle}
            disabled={wishlistLoading}
            aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
            className="rounded-full border border-edge p-2 transition-colors hover:border-edge-focus hover:bg-surface-muted disabled:opacity-60 cursor-pointer"
          >
            <Heart className={`h-4 w-4 ${isWishlisted ? 'fill-brand-accent text-brand-accent' : 'text-ink-muted'}`} />
          </button>
        </div>

        <h3 className="line-clamp-2 text-xl font-bold leading-tight text-ink-primary min-h-[52px] flex items-center">
          {product.name}
        </h3>

        <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-ink-secondary min-h-[40px]">
          {product.short_benefit || 'Natural bio-mineral wellness formulation'}
        </p>

        {benefits.length > 0 && (
          <div className="mt-4 space-y-2 rounded-[18px] bg-surface-subtle p-3.5">
            {benefits.slice(0, 2).map((benefit) => (
              <div key={benefit} className="flex items-start gap-2 text-xs leading-snug text-ink-secondary">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white text-ink-accent shadow-xs">
                  <Check className="h-2.5 w-2.5" />
                </span>
                <span className="line-clamp-1 font-medium">{benefit}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-auto pt-4">
          <div className="flex items-baseline gap-2">
            {promoPriceVal ? (
              <>
                <span className="text-xl font-bold text-ink-accent">
                  {currencySymbol}{promoPriceVal.toFixed(2)}
                </span>
                <span className="text-xs text-ink-subtle line-through">
                  {currencySymbol}{priceVal.toFixed(2)}
                </span>
              </>
            ) : (
              <span className="text-xl font-bold text-ink-primary">
                {currencySymbol}{priceVal.toFixed(2)}
              </span>
            )}
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-subtle block mt-0.5">{taxNote}</span>
          {product.variants && product.variants.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              <span className="text-[10px] font-semibold text-ink-muted uppercase tracking-wider">Variants:</span>
              {product.variants.map((v) => (
                <span key={v.id || v.sku} className="rounded bg-surface-muted border border-edge px-1.5 py-0.5 text-[10px] font-medium text-ink-primary">
                  {v.name || v.option_value}
                </span>
              ))}
            </div>
          )}
          <DietaryBadgeRow tags={product.dietary_tags} max={3} />
        </div>

        <div className="mt-4 flex flex-col gap-2 pt-2">
          <button
            type="button"
            onClick={() => onAddToCart(product)}
            disabled={stock === 0 || unavailable}
            className="btn-primary w-full py-2.5 text-xs font-semibold rounded-lg disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {unavailable ? 'Not available in your region' : stock === 0 ? 'Out of stock' : 'Add to cart'}
          </button>
          <button
            type="button"
            onClick={() => onViewDetails(product.sku)}
            className="btn-ghost w-full py-2 text-xs font-semibold rounded-lg cursor-pointer"
          >
            View details
          </button>
        </div>
      </div>
    </div>
  );
}
