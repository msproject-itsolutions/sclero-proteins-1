"""Deliver due outbound webhooks from the durable database queue."""

import logging

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from apps.orders.cron import job_run
from apps.webhooks.dispatcher import send_delivery
from apps.webhooks.models import WebhookDelivery

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Processes queued outbound webhook deliveries with retry backoff.'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=100)

    def handle(self, *args, **options):
        limit = min(max(options['limit'], 1), 1000)
        now = timezone.now()
        delivery_ids = list(
            WebhookDelivery.objects.filter(status__in=['PENDING', 'FAILED'])
            .filter(Q(next_attempt_at__isnull=True) | Q(next_attempt_at__lte=now))
            .order_by('created_at')
            .values_list('id', flat=True)[:limit]
        )

        with job_run('process_outgoing_webhooks') as result:
            for delivery_id in delivery_ids:
                delivery = WebhookDelivery.objects.select_related('subscription').filter(
                    pk=delivery_id,
                    status__in=['PENDING', 'FAILED'],
                ).first()
                if not delivery:
                    continue
                # One broken delivery (bad URL, serialization error) must not
                # abandon the rest of the batch.
                try:
                    send_delivery(delivery)
                    result.processed += 1
                except Exception:
                    logger.exception('Outbound webhook delivery %s crashed', delivery_id)
                    result.failed += 1
            result.message = (
                f'Processed {result.processed} outbound webhook delivery(s); '
                f'{result.failed} crashed.'
            )

        self.stdout.write(result.message)
