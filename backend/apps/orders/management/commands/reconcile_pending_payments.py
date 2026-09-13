"""Safety net for delayed webhooks: ask the provider about unpaid orders.

Webhooks remain the primary signal. Every order still awaiting payment is
checked against its gateway payment and recorded as paid only through
mark_order_paid, which verifies the exact amount and currency.
"""
import logging

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.orders.cron import job_run
from apps.orders.models import Order
from apps.orders.order_payments import sync_order_payment

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Reconcile unpaid online orders with their payment gateways.'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=100)

    def handle(self, *args, **options):
        limit = min(max(options['limit'], 1), 1000)
        candidates = list(
            Order.objects.filter(
                status='AWAITING_PAYMENT', payment_reference__isnull=False,
                payment_expires_at__gt=timezone.now(),
            ).order_by('created_at').values_list('pk', flat=True)[:limit]
        )
        with job_run('reconcile_pending_payments') as result:
            for order_id in candidates:
                try:
                    if sync_order_payment(order_id, source='reconciliation') == 'paid':
                        result.processed += 1
                except Exception:
                    result.failed += 1
                    logger.exception('Payment reconciliation failed for order %s', order_id)
            result.message = (
                f'Checked {len(candidates)} unpaid order(s); {result.processed} paid; '
                f'{result.failed} error(s).'
            )
