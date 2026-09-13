"""Every change to an order's payment state goes through this module.

`mark_order_paid` is the only transition to PAID, shared by the browser
confirmation, provider webhooks and reconciliation. It is idempotent and checks
the amount, the currency and payment reuse itself, so no caller can promote an
order on a gateway's word alone.
"""
import logging

from django.db import transaction
from django.db.models import F

from .email_service import send_order_email, send_owner_order_notification
from .invoices import ensure_invoice
from .models import Cart, Coupon, Order, PaymentLog
from .payments import PaymentError, adapter_for_order, to_minor_units
from .stock import release_order_stock
from .timeline import log_order_event

logger = logging.getLogger(__name__)

PAID_STATES = ('PAID', 'PARTIALLY_REFUNDED', 'REFUNDED')


def _verified_transaction_id(order, verification):
    """Check a provider verification against the order; return the payment id."""
    if verification.get('state') != 'paid':
        raise PaymentError('The payment has not been completed.')
    if verification.get('amount_minor') != to_minor_units(order.total, order.currency_code):
        raise PaymentError('The amount paid does not match the order total.')
    if str(verification.get('currency') or '').upper() != (order.currency_code or '').upper():
        raise PaymentError('The payment currency does not match the order.')
    transaction_id = str(verification.get('transaction_id') or '')
    if not transaction_id:
        raise PaymentError('The payment has no provider reference.')
    reused = Order.objects.filter(
        payment_method=order.payment_method, payment_id=transaction_id,
    ).exclude(pk=order.pk).exists()
    if reused:
        raise PaymentError('This payment has already been applied to another order.')
    return transaction_id


def mark_order_paid(order, verification, *, source):
    """Record a verified payment. Call inside a transaction; safe to repeat."""
    order = Order.objects.select_for_update().select_related('region').get(pk=order.pk)
    if order.payment_status in PAID_STATES:
        return order
    if order.status != 'AWAITING_PAYMENT':
        raise PaymentError(f'Order #{order.pk} is not awaiting payment.')
    transaction_id = _verified_transaction_id(order, verification)
    order.status = 'PROCESSING'
    order.payment_status = 'PAID'
    order.payment_id = transaction_id
    order.payment_authorized_amount = order.total
    order.payment_captured_amount = order.total
    order.payment_expires_at = None
    order.save(update_fields=[
        'status', 'payment_status', 'payment_id', 'payment_authorized_amount',
        'payment_captured_amount', 'payment_expires_at', 'updated_at',
    ])
    PaymentLog.objects.create(
        order=order, transaction_id=transaction_id, gateway=order.payment_method,
        amount=order.total, status='PAID', raw_response=verification.get('raw') or {},
    )
    log_order_event(
        order, 'order.payment_confirmed', 'Payment confirmed',
        changes={'source': source, 'transaction_id': transaction_id},
    )
    ensure_invoice(order)
    transaction.on_commit(lambda order_id=order.pk: run_order_followups(order_id))
    return order


def release_unpaid_order(order_id, *, reason, actor=None):
    """Cancel an unpaid order and give back its stock and coupon use."""
    with transaction.atomic():
        order = Order.objects.select_for_update().select_related('region').get(pk=order_id)
        if order.status != 'AWAITING_PAYMENT' or order.payment_status in PAID_STATES:
            return order
        release_order_stock(order)
        if order.coupon_code and order.discount_amount > 0:
            Coupon.objects.filter(
                code__iexact=order.coupon_code, usage_count__gt=0,
            ).update(usage_count=F('usage_count') - 1)
        order.status = 'CANCELLED'
        order.payment_status = 'EXPIRED'
        order.payment_expires_at = None
        order.save(update_fields=['status', 'payment_status', 'payment_expires_at', 'updated_at'])
        log_order_event(
            order, 'order.payment_released', 'Unpaid order released',
            changes={'reason': reason}, actor=actor,
        )
    return order


def confirm_payment(order_id, client_payload):
    """Verify the shopper's payment with the provider and record it."""
    order = Order.objects.select_related('region').get(pk=order_id)
    if order.payment_status in PAID_STATES:
        return order
    if order.status != 'AWAITING_PAYMENT':
        raise PaymentError('This order is no longer awaiting payment.')
    verification = adapter_for_order(order).verify_payment(order, client_payload or {})
    if verification.get('state') != 'paid':
        return order
    with transaction.atomic():
        return mark_order_paid(order, verification, source='checkout')


def sync_order_payment(order_id, *, source):
    """Ask the provider about an unpaid order and record the payment if made.

    Returns the provider state ('paid', 'pending', 'failed', 'unavailable'),
    or 'settled' when the order no longer awaits payment.
    """
    order = Order.objects.select_related('region').get(pk=order_id)
    if order.status != 'AWAITING_PAYMENT' or order.payment_status in PAID_STATES:
        return 'settled'
    result = adapter_for_order(order).reconcile_order(order)
    if result.get('state') == 'paid':
        with transaction.atomic():
            mark_order_paid(order, result, source=source)
    return result.get('state')


def cart_matches_order(cart, order):
    def lines(items):
        return sorted((item.product_id, item.variant_sku or '', item.quantity) for item in items)
    return lines(cart.items.all()) == lines(order.items.all())


def clear_paid_cart(order):
    """Empty the cart an order came from, unless the shopper changed it since."""
    if not order.source_cart_id:
        return
    with transaction.atomic():
        cart = Cart.objects.select_for_update().filter(pk=order.source_cart_id).first()
        if cart is not None and cart_matches_order(cart, order):
            cart.items.all().delete()


def run_order_followups(order_id):
    """Post-commit work for a placed order. Each step fails on its own."""
    try:
        order = Order.objects.select_related('region').get(pk=order_id)
    except Order.DoesNotExist:
        logger.error('Committed order %s could not be reloaded.', order_id)
        return
    try:
        clear_paid_cart(order)
    except Exception:
        logger.exception('Could not clear the cart for order %s.', order_id)
    try:
        if not send_order_email('order_confirmation', order):
            logger.warning('Order confirmation for order %s was queued for retry.', order_id)
    except Exception:
        logger.exception('Order confirmation scheduling failed for order %s.', order_id)
    try:
        send_owner_order_notification(order)
    except Exception:
        logger.exception('Owner notification failed for order %s.', order_id)
    try:
        from .fraud import assess_order
        assess_order(order)
    except Exception:
        logger.exception('Fraud assessment failed for order %s.', order_id)
