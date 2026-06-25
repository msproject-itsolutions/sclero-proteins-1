"""
Shipping-fee calculation.

Uses admin-defined ShippingZones/ShippingRates when configured for the
destination, and falls back to a sensible regional default otherwise (so the
store keeps working before any zones are set up).

A zone matches a destination when its country list contains the destination
country (or the list is empty = all countries) AND, if the zone declares
`states`, the destination state is in that list. State-specific zones take
precedence over generic country zones, so owners can add e.g. a remote-area
surcharge without affecting the rest of the country.
"""
from decimal import Decimal, InvalidOperation

from .models import ShippingZone


def _dec(value, default='0'):
    try:
        return Decimal(str(value if value not in (None, '') else default))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(default)


def _default_cost(region, subtotal):
    if region and getattr(region, 'code', '') == 'IN':
        return Decimal('0.00') if subtotal >= Decimal('3000') else Decimal('150.00')
    return Decimal('0.00') if subtotal >= Decimal('50') else Decimal('5.00')


def _applicable_rate(zones, subtotal):
    """Lowest applicable rate price across the given zones, or None."""
    best = None
    for z in zones:
        for r in z.rates.all():
            lo = r.min_value or Decimal('0')
            hi = r.max_value
            if subtotal < lo:
                continue
            if hi is not None and subtotal > hi:
                continue
            price = Decimal('0.00') if r.rate_type == 'FREE' else _dec(r.price)
            if best is None or price < best:
                best = price
    return best


def calculate_shipping(region, country='', state='', postcode='', subtotal=0):
    """Return a Decimal shipping cost for the destination."""
    subtotal = _dec(subtotal)
    country = (country or '').upper().strip()
    state = (state or '').strip().lower()

    zones = list(
        ShippingZone.objects.filter(region=region, is_active=True).prefetch_related('rates')
    )

    generic, state_specific = [], []
    for z in zones:
        countries = [c.upper() for c in (z.countries or [])]
        if countries and country and country not in countries:
            continue
        states = [s.strip().lower() for s in (z.states or [])]
        if states:
            if state and state in states:
                state_specific.append(z)
            # zone declares states but none match -> not applicable
            continue
        generic.append(z)

    # State-specific zones win; otherwise fall back to generic country zones.
    for bucket in (state_specific, generic):
        price = _applicable_rate(bucket, subtotal)
        if price is not None:
            return price

    return _default_cost(region, subtotal)
