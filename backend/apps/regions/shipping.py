"""Admin-configurable shipping zones, methods, and price calculation."""
import re
import unicodedata
from decimal import Decimal, InvalidOperation, ROUND_CEILING

from .models import ShippingZone


MONEY = Decimal('0.01')


def _fold(value):
    text = unicodedata.normalize('NFKD', str(value or ''))
    return ''.join(ch for ch in text if not unicodedata.combining(ch)).strip().lower()


def _postcode(value):
    return re.sub(r'[^A-Z0-9]', '', str(value or '').upper())


def _dec(value, default='0'):
    try:
        return Decimal(str(value if value not in (None, '') else default))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(default)


def _postcode_matches(postcode, rules):
    """Match exact codes, prefixes (``AB12*``), or inclusive ranges."""
    code = _postcode(postcode)
    if not code:
        return False
    for rule in rules or []:
        if isinstance(rule, dict):
            start = _postcode(rule.get('start'))
            end = _postcode(rule.get('end') or rule.get('start'))
            if not start:
                continue
            if start == end and code.startswith(start):
                return True
            if len(start) == len(end) and start <= code[:len(start)] <= end:
                return True
        else:
            raw = str(rule or '').strip().upper()
            prefix = raw.endswith('*')
            token = _postcode(raw[:-1] if prefix else raw)
            if token and (code.startswith(token) if prefix else code == token):
                return True
    return False


def _zone_matches(zone, country, state, city, postcode):
    countries = {str(c).strip().upper() for c in (zone.countries or []) if str(c).strip()}
    if countries and country not in countries:
        return None

    score = 0
    states = {_fold(s) for s in (zone.states or []) if _fold(s)}
    if states:
        if not state or state not in states:
            return None
        score += 1

    cities = {_fold(c) for c in (getattr(zone, 'cities', None) or []) if _fold(c)}
    if cities:
        if not city or city not in cities:
            return None
        score += 1

    postal_ranges = getattr(zone, 'postal_ranges', None) or []
    if postal_ranges:
        if not _postcode_matches(postcode, postal_ranges):
            return None
        score += 1

    if countries:
        score += 1
    return score


def _metric_for(rate, subtotal, weight_kg, quantity):
    if rate.rate_type == 'WEIGHT':
        return weight_kg
    if rate.rate_type == 'QTY':
        return quantity
    return subtotal


def _rate_option(rate, subtotal, weight_kg, quantity, postcode):
    metric = _metric_for(rate, subtotal, weight_kg, quantity)
    lo = _dec(rate.min_value)
    hi = _dec(rate.max_value) if rate.max_value is not None else None
    if metric < lo or (hi is not None and metric > hi):
        return None

    if rate.rate_type == 'FREE':
        cost = Decimal('0')
    elif rate.free_above is not None and subtotal >= _dec(rate.free_above):
        cost = Decimal('0')
    else:
        cost = _dec(rate.price) + _dec(getattr(rate, 'handling_fee', 0))
        per_unit = _dec(getattr(rate, 'per_unit_price', 0))
        if per_unit and rate.rate_type in ('WEIGHT', 'QTY'):
            units = max(metric - lo, Decimal('0')).to_integral_value(rounding=ROUND_CEILING)
            cost += units * per_unit

        surcharge_rules = [x.strip() for x in str(rate.surcharge_postcodes or '').split(',') if x.strip()]
        if surcharge_rules and _postcode_matches(postcode, surcharge_rules):
            cost += _dec(getattr(rate, 'surcharge_amount', 0))

    cost = max(cost, Decimal('0')).quantize(MONEY)
    return {
        'rate_id': rate.id,
        'name': rate.name,
        'method': rate.method or rate.name,
        'description': rate.description or '',
        'estimated_days': rate.estimated_days or '',
        'cost': cost,
        'free': cost == Decimal('0.00'),
        'rate_type': rate.rate_type,
        'priority': rate.priority,
    }


def calculate_shipping_options(region, country='', state='', city='', postcode='', subtotal=0,
                               weight_g=0, quantity=0):
    """Return all applicable delivery methods for the best matching zone."""
    subtotal = _dec(subtotal)
    weight_kg = _dec(weight_g) / Decimal('1000')
    quantity = _dec(quantity)
    country = str(country or '').strip().upper()
    state, city = _fold(state), _fold(city)

    zones = list(ShippingZone.objects.filter(region=region, is_active=True).prefetch_related('rates'))
    matched = []
    for zone in zones:
        specificity = _zone_matches(zone, country, state, city, postcode)
        if specificity is not None:
            matched.append((getattr(zone, 'priority', 0), specificity, zone))

    if not matched:
        # Shipping fails closed until an administrator configures a matching
        # zone and rate; checkout must never invent a delivery charge.
        return []

    # Prefer the most-specific matching zone, but only when it produces at
    # least one usable rate. A narrow zone with a weight/value band that does
    # not fit the cart must not prevent a valid nationwide fallback rate.
    # Tied zones are combined so a location can still offer several methods.
    tiers = sorted({(priority, specificity) for priority, specificity, _zone in matched}, reverse=True)
    for tier in tiers:
        options = []
        for priority, specificity, zone in matched:
            if (priority, specificity) != tier:
                continue
            for rate in zone.rates.all():
                if not rate.is_active:
                    continue
                option = _rate_option(rate, subtotal, weight_kg, quantity, postcode)
                if option:
                    options.append(option)
        if options:
            return sorted(options, key=lambda item: (item['priority'], item['cost'], item['method'].lower()))
    return []


def calculate_shipping(region, country='', state='', city='', postcode='', subtotal=0,
                       weight_g=0, quantity=0, rate_id=None, return_option=False):
    """Return the selected/cheapest shipping cost, or its full option payload."""
    options = calculate_shipping_options(
        region, country=country, state=state, city=city, postcode=postcode,
        subtotal=subtotal, weight_g=weight_g, quantity=quantity,
    )
    if not options:
        raise ValueError('Shipping is not available for this destination and order.')
    if rate_id not in (None, ''):
        try:
            wanted = int(rate_id)
        except (TypeError, ValueError):
            raise ValueError('Invalid shipping method.')
        option = next((item for item in options if item['rate_id'] == wanted), None)
        if option is None:
            raise ValueError('The selected shipping method is no longer available for this order.')
    else:
        option = min(options, key=lambda item: item['cost'])
    return option if return_option else option['cost']
