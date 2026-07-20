"""Single source of truth for what a cart costs.

Both the payment-intent endpoint and checkout price the same cart. If they ever
disagree by even a penny, the gateway adapters' amount check rejects the payment
and the customer cannot buy anything — so the arithmetic lives here once and is
called by both. This module is deliberately free of side effects: no stock
deduction, no coupon usage increment. Callers do that.
"""
import re
from decimal import Decimal

from django.utils import timezone

from apps.products.pricing import resolve_price, resolve_variant_price
from apps.regions.shipping import calculate_shipping


class PricingError(Exception):
    """A cart cannot be priced (e.g. a product isn't sold in this region)."""


def valid_coupon_for(code, region, subtotal):
    """Return a usable Coupon for this cart, or None. Does not consume it."""
    if not code:
        return None
    from .models import Coupon  # local import: avoids a circular import at load

    coupon = Coupon.objects.filter(code__iexact=code, is_active=True).first()
    if not coupon:
        return None

    now = timezone.now()
    valid_date = (not coupon.start_date or coupon.start_date <= now) and (
        not coupon.end_date or coupon.end_date >= now
    )
    valid_region = not coupon.region or coupon.region == region
    valid_spend = subtotal >= coupon.min_spend
    valid_limit = not coupon.usage_limit or coupon.usage_count < coupon.usage_limit

    return coupon if (valid_date and valid_region and valid_spend and valid_limit) else None


def coupon_discount(coupon, subtotal):
    if not coupon:
        return Decimal('0.00')
    if coupon.discount_type == 'PERCENTAGE':
        discount = subtotal * (Decimal(str(coupon.value)) / Decimal('100.00'))
    elif coupon.discount_type in ('FIXED_AMOUNT', 'TIERED'):
        discount = Decimal(str(coupon.value))
    else:
        return Decimal('0.00')
    return min(discount, subtotal)


def _configured_weight_g(product):
    """Read the product weight maintained in the existing admin product form."""
    facts = product.nutrition_facts if isinstance(product.nutrition_facts, dict) else {}
    shipping = facts.get('_shipping') if isinstance(facts.get('_shipping'), dict) else {}
    configured = _dec_for_weight(shipping.get('weight_g'))
    if configured > 0:
        return configured

    # Backward-compatible fallback for older products that encode size only in
    # their SKU/name. New products should use Shipping & Physical Info.
    match = re.search(r'(\d+(?:\.\d+)?)\s*(kg|g)', f'{product.sku} {product.name}'.lower())
    if not match:
        return Decimal('0')
    value = Decimal(match.group(1))
    return value * Decimal('1000') if match.group(2) == 'kg' else value


def _variant_weight_g(variant):
    if variant is None:
        return Decimal('0')
    match = re.search(
        r'(\d+(?:\.\d+)?)\s*(kg|g)',
        f'{variant.option_value} {variant.name}'.lower(),
    )
    if not match:
        return Decimal('0')
    value = Decimal(match.group(1))
    return value * Decimal('1000') if match.group(2) == 'kg' else value


def _active_variant(product, sku):
    if not sku:
        return None
    # Calling .all() uses the prefetched relation when checkout has loaded it,
    # avoiding one extra query for every cart line.
    return next(
        (variant for variant in product.variants.all()
         if variant.sku == sku and variant.is_active),
        None,
    )


def _dec_for_weight(value):
    try:
        return Decimal(str(value or 0))
    except (ArithmeticError, TypeError, ValueError):
        return Decimal('0')


def cart_shipping_metrics(cart):
    weight_g = Decimal('0')
    quantity = 0
    for item in cart.items.all():
        variant = _active_variant(item.product, item.variant_sku)
        item_weight = _variant_weight_g(variant) or _configured_weight_g(item.product)
        weight_g += item_weight * item.quantity
        quantity += item.quantity
    return weight_g, quantity


def quote_cart(region, cart, *, country=None, state=None, city=None, postal_code=None,
               coupon_code=None, shipping_rate_id=None):
    """Price a cart. Raises PricingError if an item isn't sellable in `region`.

    Returns a dict carrying both the money and the resolved line items, so the
    caller can deduct stock without re-reading prices (and risking a mismatch).
    """
    from apps.admin_dashboard.store_config import get_store_tax_mode
    items = []
    subtotal = Decimal('0.00')
    total_weight_g = Decimal('0')
    total_qty = 0
    for item in cart.items.all():
        product = item.product
        # 1. Determine variant & weight
        variant = _active_variant(product, item.variant_sku)
        if item.variant_sku and variant is None:
            raise PricingError(
                f"The selected option for {product.name} is no longer available. "
                "Remove it from your cart and choose another option."
            )
        weight_g = _variant_weight_g(variant)

        if weight_g <= 0 and product:
            weight_g = _configured_weight_g(product)

        total_weight_g += (weight_g * item.quantity)
        total_qty += item.quantity

        # 2. Resolve item price
        list_price, promo_price, _source = resolve_price(product, region)
        if variant:
            list_price = resolve_variant_price(variant, region)
            # A product-level promotional price cannot safely describe every
            # differently-priced option, so variant rows use their resolved
            # price as the checkout source of truth.
            promo_price = None

        if list_price is None:
            raise PricingError(f"{product.name} is not available in your region.")
        price = Decimal(str(promo_price if promo_price else list_price))
        subtotal += price * item.quantity
        items.append((product, variant, item.quantity, price))

    if not items:
        raise PricingError("Cart is empty or invalid.")

    coupon = valid_coupon_for(coupon_code, region, subtotal)
    discount_amount = coupon_discount(coupon, subtotal)

    tax_rate = Decimal(str(region.tax_rate))
    rate_factor = tax_rate / Decimal('100.00')
    taxable_amount = max(subtotal - discount_amount, Decimal('0.00'))
    tax_mode = get_store_tax_mode()

    if tax_mode == 'inclusive':
        # Displayed prices already include tax: extract the embedded portion
        # rather than adding it on top.
        net = (taxable_amount / (Decimal('1') + rate_factor)) if rate_factor else taxable_amount
        tax_amount = (taxable_amount - net).quantize(Decimal('0.01'))
        goods_total = taxable_amount
    else:
        tax_amount = (taxable_amount * rate_factor).quantize(Decimal('0.01'))
        goods_total = taxable_amount + tax_amount

    try:
        shipping_option = calculate_shipping(
            region, country=country, state=state, city=city, postcode=postal_code,
            subtotal=taxable_amount, weight_g=total_weight_g, quantity=total_qty,
            rate_id=shipping_rate_id, return_option=True,
        )
    except ValueError as exc:
        raise PricingError(str(exc)) from exc
    shipping_cost = shipping_option['cost']

    return {
        'items': items,
        'subtotal': subtotal,
        'coupon': coupon,
        'discount_amount': discount_amount,
        'tax_rate': tax_rate,
        'tax_mode': tax_mode,
        'rate_factor': rate_factor,
        'tax_amount': tax_amount,
        'goods_total': goods_total,
        'shipping_cost': shipping_cost,
        'shipping_option': shipping_option,
        'total': goods_total + shipping_cost,
        'weight_g': total_weight_g,
    }
