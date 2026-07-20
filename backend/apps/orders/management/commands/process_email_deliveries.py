"""Retry due transactional emails from the durable database queue."""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db.models import Q
from django.utils import timezone

from apps.orders.cron import job_run
from apps.orders.email_service import send_templated_email
from apps.orders.models import EmailDelivery


BACKOFFS = [
    timedelta(minutes=1),
    timedelta(minutes=5),
    timedelta(minutes=15),
    timedelta(minutes=30),
    timedelta(hours=1),
    timedelta(hours=6),
    timedelta(hours=24),
]


class Command(BaseCommand):
    help = 'Retries failed transactional email deliveries with bounded backoff.'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=100)

    def handle(self, *args, **options):
        limit = min(max(options['limit'], 1), 1000)
        now = timezone.now()
        due = EmailDelivery.objects.select_related('region').filter(
            status__in=['PENDING', 'FAILED'],
        ).filter(
            Q(next_attempt_at__isnull=True) | Q(next_attempt_at__lte=now),
        ).order_by('created_at')[:limit]

        with job_run('process_email_deliveries') as result:
            for delivery in due:
                delivery.attempts += 1
                delivery.last_attempt_at = now
                sent = send_templated_email(
                    delivery.event,
                    delivery.region,
                    delivery.recipient_email,
                    delivery.context,
                    audit_target_type=delivery.audit_target_type,
                    audit_target_id=delivery.audit_target_id,
                    queue_on_failure=False,
                )
                if sent:
                    delivery.status = 'SENT'
                    delivery.next_attempt_at = None
                    delivery.error_message = ''
                    result.processed += 1
                else:
                    result.failed += 1
                    if delivery.attempts >= len(BACKOFFS):
                        delivery.status = 'DLQ'
                        delivery.next_attempt_at = None
                    else:
                        delivery.status = 'FAILED'
                        delivery.next_attempt_at = now + BACKOFFS[delivery.attempts - 1]
                delivery.save(update_fields=[
                    'status', 'attempts', 'last_attempt_at', 'next_attempt_at',
                    'error_message', 'updated_at',
                ])
            result.message = f'Processed {result.processed + result.failed} queued email(s).'

        self.stdout.write(self.style.SUCCESS(result.message))
