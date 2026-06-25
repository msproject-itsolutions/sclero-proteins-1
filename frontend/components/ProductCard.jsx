import React from 'react';
import { useSelector } from 'react-redux';
import {
  Star, AlertTriangle, CheckCircle, Info, Heart,
  Leaf, Wheat, MilkOff, Candy, Beef, ShieldCheck, FlaskConical, Sprout
} from 'lucide-react';
import { CompactTrustBadges } from './TrustBadges';

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
            className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-brand-muted"
          >
            <Icon className="h-2.5 w-2.5 text-brand-success" />
            <span>{meta.label}</span>
          </span>
        );
      })}
      {extra > 0 && (
        <span className="text-[9px] font-bold text-brand-muted">+{extra} more</span>
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
  const { currencySymbol, currentRegion } = useSelector((state) => state.region);
  const [isWishlisted, setIsWishlisted] = React.useState(false);
  const taxNote = currentRegion === 'IN' ? 'inc. GST' : 'inc. VAT';

  const priceVal = product.price ? parseFloat(product.price) : 0;
  const promoPriceVal = product.promotional_price
    ? parseFloat(product.promotional_price)
    : null;
  const stock = product.stock_available || 0;

  // Calculate discount percentage
  const discountPercent = promoPriceVal && priceVal
    ? Math.round(((priceVal - promoPriceVal) / priceVal) * 100)
    : 0;

  if (variant === 'compact') {
    // Compact card for grid display
    return (
      <div className="glass-panel glass-panel-hover relative flex flex-col justify-between overflow-hidden rounded-2xl p-4 group">
        {/* Image */}
        <div className="relative mb-3 flex h-40 w-full items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50">
          {product.thumbnail ? (
            <img
              src={product.thumbnail}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <Info className="h-8 w-8 text-slate-300" />
          )}

          {/* Discount Badge */}
          {discountPercent > 0 && (
            <div className="absolute right-2 top-2 rounded-full bg-brand-danger text-white px-2 py-1 text-[10px] font-bold">
              -{discountPercent}%
            </div>
          )}

          {/* Stock Badge */}
          {stock === 0 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <span className="text-white font-bold text-sm">Out of Stock</span>
            </div>
          )}
        </div>

        {/* Rating & Reviews */}
        <div className="mb-2 flex items-center gap-1">
          <Star className="h-3 w-3 fill-brand-orange text-brand-orange" />
          <span className="text-[10px] font-bold text-brand-navy">
            {product.average_rating || 5.0}
          </span>
          <span className="text-[9px] text-brand-muted">
            ({product.review_count || 0})
          </span>
        </div>

        {/* Name */}
        <h3 className="mb-1 line-clamp-2 text-sm font-bold text-brand-navy">
          {product.name}
        </h3>

        {/* Short benefit */}
        {product.short_benefit && (
          <p className="mb-1.5 line-clamp-2 text-xs text-brand-muted">{product.short_benefit}</p>
        )}

        {/* Price */}
        <div className="mb-2 flex items-baseline gap-2">
          {promoPriceVal ? (
            <>
              <span className="text-lg font-black text-brand-purple">
                {currencySymbol}{promoPriceVal.toFixed(2)}
              </span>
              <span className="text-[10px] text-brand-muted line-through">
                {currencySymbol}{priceVal.toFixed(2)}
              </span>
            </>
          ) : (
            <span className="text-lg font-black text-brand-navy">
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
            disabled={stock === 0}
            className="flex-1 btn-primary py-2 text-xs uppercase font-bold disabled:opacity-50"
          >
            Add to cart
          </button>
          <button
            onClick={() => setIsWishlisted(!isWishlisted)}
            aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
            className="px-3 py-2 rounded-lg border border-slate-200 hover:border-brand-purple hover:bg-brand-purple/5 transition-colors"
          >
            <Heart
              className={`h-4 w-4 ${isWishlisted ? 'fill-brand-purple text-brand-purple' : 'text-brand-muted'}`}
            />
          </button>
        </div>
      </div>
    );
  }

  // Standard card
  return (
    <div className="glass-panel glass-panel-hover relative flex flex-col justify-between overflow-hidden rounded-3xl p-5 group">
      {/* Top Badges */}
      <div className="absolute right-4 top-4 z-10 flex flex-col gap-2">
        {discountPercent > 0 && (
          <span className="inline-flex items-center rounded-full bg-brand-danger text-white px-3 py-1 text-[10px] font-bold">
            Save {discountPercent}%
          </span>
        )}

        {stock === 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-brand-danger/20 bg-brand-danger/10 px-2.5 py-0.5 text-[10px] font-bold text-brand-danger">
            OUT OF STOCK
          </span>
        ) : stock <= 15 ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            LOW STOCK
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-brand-success/20 bg-brand-success/10 px-2.5 py-0.5 text-[10px] font-bold text-brand-success">
            <CheckCircle className="h-3 w-3" />
            IN STOCK
          </span>
        )}
      </div>

      {/* Image */}
      <div className="relative mb-4 flex h-48 w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
        {product.thumbnail ? (
          <img
            src={product.thumbnail}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-slate-300">
            <Info className="mb-2 h-10 w-10" />
            <span className="text-xs">No image available</span>
          </div>
        )}
      </div>

      {/* Rating & Reviews */}
      <div className="mb-2 flex items-center gap-2">
        <div className="flex items-center gap-1">
          <Star className="h-3.5 w-3.5 fill-brand-orange text-brand-orange" />
          <span className="text-xs font-bold text-brand-navy">
            {product.average_rating || 5.0}
          </span>
        </div>
        <span className="text-[10px] text-brand-muted">
          {product.review_count ? `${product.review_count} reviews` : 'New product'}
        </span>
      </div>

      {/* Name */}
      <h3 className="mb-1 line-clamp-2 text-base font-bold text-brand-navy">
        {product.name}
      </h3>

      {/* Short benefit */}
      {product.short_benefit && (
        <p className="mb-2 line-clamp-2 text-xs text-brand-muted">{product.short_benefit}</p>
      )}

      {/* SKU & Key Specs */}
      <div className="mb-3 space-y-1">
        <p className="font-mono text-[10px] uppercase text-brand-muted">
          SKU: {product.sku}
        </p>
        {product.serving_size && (
          <p className="text-[11px] text-brand-muted">
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
              <span className="text-xl font-black text-brand-purple">
                {currencySymbol}
                {promoPriceVal.toFixed(2)}
              </span>
              <span className="text-xs text-brand-muted line-through">
                {currencySymbol}
                {priceVal.toFixed(2)}
              </span>
            </>
          ) : (
            <span className="text-xl font-black text-brand-navy">
              {currencySymbol}
              {priceVal.toFixed(2)}
            </span>
          )}
        </div>
        <span className="text-[10px] text-brand-muted">{taxNote}</span>
        {/* Dietary badges */}
        <DietaryBadgeRow tags={product.dietary_tags} max={3} />
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onAddToCart(product)}
          disabled={stock === 0}
          className="btn-primary w-full py-2.5 text-xs uppercase tracking-wider disabled:opacity-50"
        >
          {stock === 0 ? 'Out of stock' : 'Add to cart'}
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
  );
}
