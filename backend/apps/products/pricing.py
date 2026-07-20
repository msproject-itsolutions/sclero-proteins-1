"""Deciding what a product costs in a given market.

One resolver, used by the catalogue, the product page and checkout. If these
ever disagree, a shopper is shown one price and charged another — so every
caller goes through resolve_price().

Order of precedence:
  1. An explicit ProductRegionConfig for that market (a deliberate price wins).
  2. The product's base_price converted with the market's fx_rate, if the market
     has automatic pricing on.
  3. Nothing — the product is not sold in that market.
"""
from decimal import Decimal, ROUND_HALF_UP, ROUND_UP

PENNY = Decimal('0.01')
_NOT_PROVIDED = object()


def _round_for(region, amount):
    mode = getattr(region, 'price_rounding', 'NONE') or 'NONE'
    if mode == 'WHOLE':
        return amount.to_integral_value(rounding=ROUND_HALF_UP)
    if mode == 'CHARM_99':
        # 12.30 -> 12.99, 12.00 -> 12.99 (never rounds a price *down*).
        whole = amount.to_integral_value(rounding=ROUND_UP)
        candidate = whole - Decimal('0.01')
        if candidate < amount:
            candidate = whole + Decimal('0.99')
        return candidate
    return amount.quantize(PENNY, rounding=ROUND_HALF_UP)


def resolve_price(product, region, config=_NOT_PROVIDED):
    """Return (price, promotional_price, source) for a product in a market.

    price is None when the product is not sellable there. `source` is
    'explicit' or 'converted', useful for admin display and debugging.
    Pass `config` to avoid a query when the caller already has it.
    """
    if product is None or region is None:
        return None, None, None

    if config is _NOT_PROVIDED:
        config = product.regional_configs.filter(region=region).first()

    if config is not None:
        if not config.is_visible:
            return None, None, None
        return config.price, config.promotional_price, 'explicit'

    base = getattr(product, 'base_price', None)
    if base is None or not getattr(region, 'auto_price_enabled', False):
        return None, None, None

    rate = Decimal(str(getattr(region, 'fx_rate', 1) or 0))
    if rate <= 0:
        # A zero/negative rate would give away stock for free.
        return None, None, None

    return _round_for(region, Decimal(str(base)) * rate), None, 'converted'


def resolve_variant_price(variant, region):
    """Resolve a variant price in the shopper's market currency.

    Variant records currently keep explicit INR and base-currency GBP values.
    Other automatically-priced markets convert the GBP value using the same
    exchange rate and rounding policy as ordinary product prices.
    """
    if variant is None or region is None:
        return None

    if getattr(region, 'code', '').upper() == 'IN' and variant.price_inr is not None:
        return Decimal(str(variant.price_inr))

    base = variant.price_gbp
    if base is None:
        return None
    if getattr(region, 'code', '').upper() == 'UK':
        return Decimal(str(base))
    if not getattr(region, 'auto_price_enabled', False):
        return None

    rate = Decimal(str(getattr(region, 'fx_rate', 0) or 0))
    if rate <= 0:
        return None
    return _round_for(region, Decimal(str(base)) * rate)


def sellable_in(region):
    """Q object matching products that have a price in `region`.

    Mirrors resolve_price so the catalogue never lists something checkout
    would then refuse to sell.
    """
    from django.db.models import Q

    explicit = Q(regional_configs__region=region, regional_configs__is_visible=True)
    if not getattr(region, 'auto_price_enabled', False) or Decimal(str(region.fx_rate or 0)) <= 0:
        return explicit
    # Converted pricing applies only where no explicit config exists; a hidden
    # config must keep the product hidden rather than fall through to base price.
    converted = Q(base_price__isnull=False) & ~Q(regional_configs__region=region)
    return explicit | converted
