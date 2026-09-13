"""Refund primitives: record first, then move money, then settle.

A refund row exists (PENDING) before any gateway call; the call carries an
idempotency key derived from that row; a gateway error is recorded as FAILED,
never as a completed refund; and an unknown outcome (a timeout) leaves the row
PENDING for the provider webhook or a retry.
"""
import logging
from decimal import Decimal

from django.db import transaction
from django.db.models import Sum

from .models import Order, PaymentLog, Refund
from .payments import PaymentError, PaymentOutcomeUnknown, adapter_for_order

logger = logging.getLogger(__name__)

GATEWAY_DECLINED = 'The payment provider declined the refund.'


def refund_key(refund):
    return f'refund-{refund.pk}'


def start_refund(order, amount, reason, *, actor=None):
    """Record a PENDING refund. Call inside a transaction holding the order lock."""
    amount = Decimal(str(amount))
    already = order.refunds.filter(status__in=['PENDING', 'PROCESSED']).aggregate(
        total=Sum('amount'),
    )['total'] or Decimal('0.00')
    if amount <= 0 or amount > order.total - already:
        raise PaymentError('Refund amount must be positive and within the refundable balance.')
    return Refund.objects.create(
        order=order, amount=amount, currency_code=order.currency_code,
        gateway=order.payment_method or 'MANUAL', reason=reason, status='PENDING',
        is_partial=(already + amount) < order.total,
        created_by=actor if getattr(actor, 'is_authenticated', False) else None,
    )


def execute_refund(refund_id):
    """Send one PENDING refund to its gateway. Call outside a transaction."""
    refund = Refund.objects.select_related('order__region').get(pk=refund_id)
    if refund.status != 'PENDING':
        return refund
    order = refund.order
    try:
        result = adapter_for_order(order).refund(
            order, refund.amount, refund.reason, idempotency_key=refund_key(refund),
        )
    except PaymentOutcomeUnknown as exc:
        logger.warning('Refund %s has an unknown outcome: %s', refund.pk, exc)
        _log(order, refund, 'REFUND_UNKNOWN', {'error': str(exc)})
        return refund
    except PaymentError as exc:
        return _settle(refund.pk, 'FAILED', failure_reason=str(exc), raw={'error': str(exc)})
    status = {'REFUNDED': 'PROCESSED', 'FAILED': 'FAILED'}.get(result.get('status'), 'PENDING')
    return _settle(
        refund.pk, status, transaction_id=result.get('refund_id') or '', raw=result.get('raw') or {},
        failure_reason=GATEWAY_DECLINED if status == 'FAILED' else '',
    )


def _settle(refund_id, status, *, transaction_id='', failure_reason='', raw=None):
    with transaction.atomic():
        refund = Refund.objects.select_for_update().select_related('order').get(pk=refund_id)
        if refund.status != 'PENDING':
            return refund
        refund.status = status
        if transaction_id:
            refund.refund_transaction_id = transaction_id
        refund.failure_reason = failure_reason[:2000]
        refund.save(update_fields=['status', 'refund_transaction_id', 'failure_reason'])
        _log(refund.order, refund, f'REFUND_{status}', raw or {})
        if status == 'PROCESSED':
            sync_refund_status(refund.order)
    return refund


def _log(order, refund, status, raw):
    PaymentLog.objects.create(
        order=order, transaction_id=refund.refund_transaction_id or refund_key(refund),
        gateway=order.payment_method or 'MANUAL', amount=refund.amount, status=status,
        raw_response=raw,
    )


def sync_refund_status(order):
    """Derive the order's payment status from its processed refunds."""
    order = Order.objects.select_for_update().get(pk=order.pk)
    refunded = order.refunds.filter(status='PROCESSED').aggregate(
        total=Sum('amount'),
    )['total'] or Decimal('0.00')
    if refunded <= 0:
        return order
    if refunded >= order.total:
        order.payment_status = 'REFUNDED'
        if order.status != 'CANCELLED':
            order.status = 'REFUNDED'
    else:
        order.payment_status = 'PARTIALLY_REFUNDED'
    order.save(update_fields=['payment_status', 'status', 'updated_at'])
    return order
