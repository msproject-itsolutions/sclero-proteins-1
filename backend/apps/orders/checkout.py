"""Order-first checkout.

The order, with its stock and coupon use reserved, exists before the shopper
is asked to pay, and the gateway payment is opened for that exact order,
amount and currency. A shopper can never be charged without an order, and a
payment can only ever complete the order it was opened for.
"""
import hashlib
import json
import logging
import re
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.utils import timezone

from apps.admin_dashboard.store_config import get_guest_checkout_enabled

from .access import make_order_token
from .invoices import ensure_invoice
from .models import Cart, Coupon, Order, OrderItem, PaymentLog
from .order_payments import PAID_STATES, release_unpaid_order, run_order_followups, sync_order_payment
from .payments import PaymentError, adapter_for_order, resolve_gateway
from .pricing import PricingError, quote_cart
from .stock import StockError, reserve_lines

logger = logging.getLogger(__name__)

PHONE_PATTERN = re.compile(r'^[+\d][\d\s().-]*$')
REQUIRED_FIELDS = (
    'email', 'shipping_name', 'shipping_phone', 'shipping_address_line1', 'shipping_city',
    'shipping_state', 'shipping_postal_code', 'shipping_country', 'payment_method',
)
IN_PROGRESS_MESSAGE = 'A payment for this cart is already in progress.'
START_FAILED_MESSAGE = 'We could not start the payment. No money has been taken; please try again.'
EXPIRED_MESSAGE = 'This checkout has expired. Please review your cart and try again.'


class CheckoutError(Exception):
    """A checkout problem with a customer-safe message and an HTTP status."""

    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


def _clean(value):
    return str(value or '').strip()


def payment_window():
    return timedelta(minutes=settings.CHECKOUT_PAYMENT_WINDOW_MINUTES)


def clean_checkout_details(data, user):
    """Validate the contact and delivery details. Raises CheckoutError."""
    details = {
        'email': _clean(data.get('email')).lower(),
        'shipping_name': _clean(data.get('shipping_name')),
        'shipping_phone': _clean(data.get('shipping_phone')),
        'shipping_address_line1': _clean(data.get('shipping_address_line1')),
        'shipping_address_line2': _clean(data.get('shipping_address_line2')),
        'shipping_city': _clean(data.get('shipping_city')),
        'shipping_state': _clean(data.get('shipping_state')),
        'shipping_postal_code': _clean(data.get('shipping_postal_code')),
        'shipping_country': _clean(data.get('shipping_country')).upper(),
        'payment_method': _clean(data.get('payment_method')).upper(),
    }
    for field in REQUIRED_FIELDS:
        if not details[field]:
            raise CheckoutError(f"Missing required checkout field: {field.replace('_', ' ')}.")
    try:
        validate_email(details['email'])
    except DjangoValidationError:
        raise CheckoutError('Enter a valid email address.') from None
    digits = re.sub(r'\D', '', details['shipping_phone'])
    if not PHONE_PATTERN.fullmatch(details['shipping_phone']) or not 7 <= len(digits) <= 15:
        raise CheckoutError('Enter a valid phone number with 7 to 15 digits.')
    if len(details['shipping_country']) != 2:
        raise CheckoutError('Enter a valid two-letter country code.')
    if not (user and user.is_authenticated) and not get_guest_checkout_enabled():
        raise CheckoutError('Guest checkout is currently disabled. Please sign in to continue.', status=403)
    return details


def quote_fingerprint(region, quote, details):
    """SHA-256 of everything that was priced, to recognise an unchanged retry."""
    coupon = quote['coupon'] if quote['discount_amount'] > 0 else None
    payload = {
        'region': region.code,
        'currency': region.currency_code,
        'lines': sorted(
            [product.pk, variant.sku if variant else '', quantity, str(price)]
            for product, variant, quantity, price in quote['items']
        ),
        'details': details,
        'shipping_rate': str(quote['shipping_option'].get('rate_id') or ''),
        'shipping_cost': str(quote['shipping_cost']),
        'coupon': coupon.code if coupon else '',
        'discount': str(quote['discount_amount']),
        'total': str(quote['total']),
    }
    encoded = json.dumps(payload, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(encoded.encode()).hexdigest()


def checkout_response(order, payment=None):
    return {
        'order_id': order.pk,
        'order_token': make_order_token(order),
        'status': order.status,
        'payment_status': order.payment_status,
        'payment_method': order.payment_method,
        'amount': str(order.total),
        'currency': order.currency_code,
        'expires_at': order.payment_expires_at.isoformat() if order.payment_expires_at else None,
        'payment': payment,
    }


def create_checkout_order(data, details, cart, user):
    """Create or resume the cart's order and open its payment.

    Returns (response body, created). Raises CheckoutError.
    """
    region = cart.region
    try:
        resolve_gateway(region, details['payment_method'])
    except PaymentError as exc:
        raise CheckoutError(str(exc)) from exc
    coupon_code = _clean(data.get('coupon_code'))

    resumed = None
    with transaction.atomic():
        # One checkout at a time per cart: double clicks and retries queue here.
        cart = Cart.objects.select_for_update().prefetch_related('items__product__variants').get(pk=cart.pk)
        if not cart.items.all():
            raise CheckoutError('Cart is empty or invalid.')
        open_orders = list(
            Order.objects.filter(source_cart=cart, status='AWAITING_PAYMENT').order_by('-created_at')
        )
        held = sum(
            1 for open_order in open_orders
            if coupon_code and open_order.discount_amount > 0
            and (open_order.coupon_code or '').lower() == coupon_code.lower()
        )
        try:
            quote = quote_cart(
                region, cart, country=details['shipping_country'], state=details['shipping_state'],
                city=details['shipping_city'], postal_code=details['shipping_postal_code'],
                coupon_code=coupon_code, shipping_rate_id=data.get('shipping_rate_id'),
                coupon_uses_held=held,
            )
        except PricingError as exc:
            raise CheckoutError(str(exc)) from exc
        fingerprint = quote_fingerprint(region, quote, details)
        now = timezone.now()
        for candidate in open_orders:
            unchanged = (
                candidate.quote_fingerprint == fingerprint
                and candidate.payment_expires_at is not None
                and candidate.payment_expires_at > now
            )
            if resumed is None and unchanged:
                resumed = candidate
            else:
                _supersede(candidate)
        if resumed is None:
            order = _place_order(region, cart, quote, details, fingerprint, user)

    if resumed is not None:
        return _resume(resumed), False
    if order.payment_method == 'COD':
        return checkout_response(order), True
    try:
        payment = ensure_payment_opened(order)
    except PaymentError as exc:
        logger.warning('Could not open the %s payment for order %s: %s', order.payment_method, order.pk, exc)
        release_unpaid_order(order.pk, reason='The payment could not be started.')
        raise CheckoutError(START_FAILED_MESSAGE, status=502) from exc
    return checkout_response(order, payment['client']), True


def _supersede(order):
    """Close an unpaid order the shopper replaced by changing the checkout."""
    if order.payment_reference:
        try:
            state = adapter_for_order(order).cancel_payment(order)
        except PaymentError as exc:
            # Unsure the old payment is closed: never open a second one.
            logger.warning('Could not cancel the payment for order %s: %s', order.pk, exc)
            raise CheckoutError(IN_PROGRESS_MESSAGE, status=409) from exc
        if state in ('processing', 'succeeded'):
            raise CheckoutError(IN_PROGRESS_MESSAGE, status=409)
    release_unpaid_order(order.pk, reason='Replaced by a changed checkout.')


def _line_tax(line_gross, quote):
    rate_factor = quote['rate_factor']
    if quote['tax_mode'] == 'inclusive':
        net = (line_gross / (Decimal('1') + rate_factor)) if rate_factor else line_gross
        return (line_gross - net).quantize(Decimal('0.01'))
    return (line_gross * rate_factor).quantize(Decimal('0.01'))


def _place_order(region, cart, quote, details, fingerprint, user):
    coupon = None
    discount = quote['discount_amount']
    if quote['coupon'] and discount > 0:
        # Lock a limited coupon so two carts cannot both take its last use.
        coupon = Coupon.objects.select_for_update().get(pk=quote['coupon'].pk)
        if coupon.usage_limit and coupon.usage_count >= coupon.usage_limit:
            raise CheckoutError('This coupon has reached its usage limit.')
    try:
        with transaction.atomic():
            reserve_lines(region, [
                (product, variant.sku if variant else '', quantity)
                for product, variant, quantity, _price in quote['items']
            ])
    except StockError as exc:
        raise CheckoutError(str(exc)) from exc
    if coupon is not None:
        coupon.usage_count += 1
        coupon.save(update_fields=['usage_count'])

    is_cod = details['payment_method'] == 'COD'
    option = quote['shipping_option']
    order = Order.objects.create(
        user=user if user and user.is_authenticated else None,
        region=region,
        source_cart=cart,
        quote_fingerprint=fingerprint,
        status='PROCESSING' if is_cod else 'AWAITING_PAYMENT',
        payment_status='PENDING',
        payment_expires_at=None if is_cod else timezone.now() + payment_window(),
        currency_code=region.currency_code,
        subtotal=quote['subtotal'],
        tax_rate=quote['tax_rate'],
        tax_amount=quote['tax_amount'],
        shipping_cost=quote['shipping_cost'],
        shipping_method=option['method'],
        shipping_rate_name=option['name'],
        shipping_estimated_days=option['estimated_days'],
        coupon_code=coupon.code if coupon else None,
        discount_amount=discount,
        total=quote['total'],
        **details,
    )
    for product, variant, quantity, price in quote['items']:
        OrderItem.objects.create(
            order=order, product=product,
            variant_sku=variant.sku if variant else '', variant_name=variant.name if variant else '',
            quantity=quantity, price=price, tax_amount=_line_tax(price * quantity, quote),
        )
    if is_cod:
        order.payment_id = f'cod_{order.pk}'
        order.save(update_fields=['payment_id'])
        PaymentLog.objects.create(
            order=order, transaction_id=order.payment_id, gateway='COD', amount=order.total,
            status='PENDING', raw_response={'gateway': 'COD', 'message': 'Cash to be collected on delivery'},
        )
        ensure_invoice(order)
        cart.items.all().delete()
        transaction.on_commit(lambda order_id=order.pk: run_order_followups(order_id))
    return order


def ensure_payment_opened(order):
    """Open the order's gateway payment once; later calls resume it."""
    adapter = adapter_for_order(order)
    with transaction.atomic():
        locked = Order.objects.select_for_update().select_related('region').get(pk=order.pk)
        if locked.status != 'AWAITING_PAYMENT':
            raise PaymentError('This order is no longer awaiting payment.')
        if not locked.payment_reference:
            opened = adapter.open_payment(locked)
            locked.payment_reference = opened['reference']
            locked.save(update_fields=['payment_reference', 'updated_at'])
            return {'state': 'open', 'client': opened['client']}
    return adapter.resume_payment(locked)


def _resume(order):
    try:
        payment = ensure_payment_opened(order)
    except PaymentError as exc:
        raise CheckoutError(START_FAILED_MESSAGE, status=502) from exc
    state = payment.get('state')
    if state == 'succeeded':
        try:
            sync_order_payment(order.pk, source='checkout')
        except PaymentError:
            logger.exception('Could not record the completed payment for order %s.', order.pk)
        order.refresh_from_db()
        if order.payment_status in PAID_STATES:
            return checkout_response(order)
        raise CheckoutError(IN_PROGRESS_MESSAGE, status=409)
    if state == 'processing':
        raise CheckoutError(IN_PROGRESS_MESSAGE, status=409)
    if state == 'closed':
        release_unpaid_order(order.pk, reason='The payment was closed by the provider.')
        raise CheckoutError(EXPIRED_MESSAGE, status=410)
    return checkout_response(order, payment['client'])
