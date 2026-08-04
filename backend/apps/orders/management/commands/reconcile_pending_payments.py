"""Reconcile pending online payments when a provider webhook was delayed.

Webhooks remain the primary, near-real-time signal. This command is a bounded,
idempotent safety net: it asks the provider for the status of an existing
payment reference and only promotes an order after amount and currency checks.
"""

import logging

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.admin_dashboard.models import PaymentGateway
from apps.orders.cron import job_run
from apps.orders.models import Invoice, Order, PaymentLog
from apps.orders.payments import get_adapter
from apps.orders.utils import generate_invoice_pdf

logger = logging.getLogger(__name__)
ONLINE_GATEWAYS = ('STRIPE', 'RAZORPAY', 'PAYPAL')


class Command(BaseCommand):
    help = 'Reconcile pending online payments with their payment gateways.'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=100)

    def handle(self, *args, **options):
        limit = min(max(options['limit'], 1), 1000)
        candidates = list(
            Order.objects.filter(
                payment_status__in=['PENDING', 'AUTHORIZED'],
                payment_method__in=ONLINE_GATEWAYS,
            ).exclude(payment_id__isnull=True).exclude(payment_id='')
            .order_by('created_at').values_list('id', flat=True)[:limit]
        )
        with job_run('reconcile_pending_payments') as result:
            for order_id in candidates:
                try:
                    if self.reconcile(order_id):
                        result.processed += 1
                except Exception:
                    result.failed += 1
                    logger.exception('Payment reconciliation failed for order %s', order_id)
            result.message = f'Reconciled {result.processed} paid checkout(s); {result.failed} error(s).'

    def reconcile(self, order_id):
        with transaction.atomic():
            order = Order.objects.select_for_update().select_related('region').get(pk=order_id)
            if order.payment_status not in ('PENDING', 'AUTHORIZED'):
                return False
            gateway = PaymentGateway.objects.filter(
                region=order.region, code=order.payment_method, is_enabled=True,
            ).first()
            if not gateway:
                return False
            result = get_adapter(gateway).reconcile_payment(
                order.payment_id, order.total, order.currency_code,
            )
            if result.get('state') != 'paid':
                return False

            order.payment_status = 'PAID'
            order.payment_captured_amount = order.total
            order.status = 'PROCESSING'
            order.save(update_fields=['payment_status', 'payment_captured_amount', 'status', 'updated_at'])
            PaymentLog.objects.get_or_create(
                order=order, transaction_id=order.payment_id, status='PAID',
                defaults={'gateway': order.payment_method, 'amount': order.total, 'raw_response': result.get('raw', {})},
            )
            invoice, _ = Invoice.objects.get_or_create(
                order=order,
                defaults={
                    'invoice_number': f'SP-{timezone.now().year}-{order.id:05d}',
                    'invoice_type': 'GST_INVOICE' if order.region.code == 'IN' else 'VAT_RECEIPT',
                },
            )
            try:
                generate_invoice_pdf(invoice)
            except Exception:
                logger.exception('Invoice generation failed while reconciling order %s', order.id)
            return True
