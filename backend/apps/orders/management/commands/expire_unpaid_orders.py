"""Release unpaid orders whose payment window has closed.

Before releasing, the provider is asked about the payment. A paid order is
recorded, and a payment still in progress gets one 15-minute extension. Only
then is the gateway payment cancelled and the stock and coupon use returned.
The same run also retries the refund for any order paid after it expired.
"""
import logging
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.orders.cron import job_run
from apps.orders.models import Order
from apps.orders.order_payments import refund_expired_payment, release_unpaid_order, sync_order_payment
from apps.orders.payments import PaymentError, adapter_for_order

logger = logging.getLogger(__name__)
EXTENSION = timedelta(minutes=15)


def expiry_was_extended(order):
    window = timedelta(minutes=settings.CHECKOUT_PAYMENT_WINDOW_MINUTES)
    return order.payment_expires_at - order.created_at > window + timedelta(minutes=1)


class Command(BaseCommand):
    help = 'Release unpaid orders whose payment window has closed.'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=100)

    def handle(self, *args, **options):
        limit = min(max(options['limit'], 1), 1000)
        due = list(
            Order.objects.filter(status='AWAITING_PAYMENT', payment_expires_at__lte=timezone.now())
            .order_by('payment_expires_at').values_list('pk', flat=True)[:limit]
        )
        late_paid = list(
            Order.objects.filter(status='CANCELLED', payment_status='PAID', refunds__isnull=True)
            .order_by('pk').values_list('pk', flat=True)[:limit]
        )
        with job_run('expire_unpaid_orders') as result:
            for order_id in due:
                try:
                    self.expire(order_id)
                    result.processed += 1
                except Exception:
                    result.failed += 1
                    logger.exception('Could not expire order %s', order_id)
            for order_id in late_paid:
                try:
                    refund_expired_payment(order_id)
                    result.processed += 1
                except Exception:
                    result.failed += 1
                    logger.exception('Could not refund the late payment for order %s', order_id)
            result.message = (
                f'Checked {len(due)} expired order(s) and {len(late_paid)} late payment(s); '
                f'{result.failed} error(s).'
            )

    def expire(self, order_id):
        state = sync_order_payment(order_id, source='expiry')
        if state in ('settled', 'paid'):
            return state
        order = Order.objects.select_related('region').get(pk=order_id)
        if state == 'pending' and not expiry_was_extended(order):
            Order.objects.filter(pk=order.pk, status='AWAITING_PAYMENT').update(
                payment_expires_at=order.payment_expires_at + EXTENSION,
            )
            return 'extended'
        if order.payment_reference:
            try:
                closed = adapter_for_order(order).cancel_payment(order)
            except PaymentError as exc:
                # Never release while the provider state is unknown.
                logger.warning('Could not cancel the payment for expired order %s: %s', order.pk, exc)
                return 'kept'
            if closed == 'succeeded':
                return sync_order_payment(order.pk, source='expiry')
            if closed == 'processing':
                return 'kept'
        release_unpaid_order(order.pk, reason='The payment window closed.')
        return 'released'
