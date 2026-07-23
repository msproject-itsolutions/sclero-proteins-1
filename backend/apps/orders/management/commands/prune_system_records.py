"""Age-based cleanup of operational bookkeeping tables.

The job-run history, processed webhook queues and sent-email queue grow on
every scheduler tick and were never pruned. This job deletes rows that are old
enough to have no operational value, in bounded batches. It never touches
business records (orders, refunds, invoices, audit logs) and never deletes
rows still awaiting work (PENDING/FAILED queue rows are kept regardless of
age; DLQ rows are kept for the longer DLQ window so failures stay reviewable).
"""
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.orders.cron import job_run
from apps.orders.models import CronJobRun, EmailDelivery, WebhookEvent
from apps.webhooks.models import WebhookDelivery


def _delete_in_batches(queryset, batch_size=1000):
    """Delete a queryset in primary-key batches; returns rows deleted."""
    deleted = 0
    while True:
        batch = list(queryset.values_list('pk', flat=True)[:batch_size])
        if not batch:
            return deleted
        removed, _ = queryset.model.objects.filter(pk__in=batch).delete()
        deleted += removed
        if len(batch) < batch_size:
            return deleted


class Command(BaseCommand):
    help = 'Prunes old cron-run history and completed webhook/email queue rows.'

    def add_arguments(self, parser):
        parser.add_argument('--cron-days', type=int, default=30,
                            help='Keep CronJobRun history for this many days.')
        parser.add_argument('--queue-days', type=int, default=90,
                            help='Keep processed/sent queue rows for this many days.')
        parser.add_argument('--dlq-days', type=int, default=180,
                            help='Keep dead-lettered queue rows for this many days.')

    def handle(self, *args, **options):
        cron_cutoff = timezone.now() - timedelta(days=max(options['cron_days'], 1))
        queue_cutoff = timezone.now() - timedelta(days=max(options['queue_days'], 1))
        dlq_cutoff = timezone.now() - timedelta(days=max(options['dlq_days'], 1))

        with job_run('prune_system_records') as result:
            counts = {
                'cron_runs': _delete_in_batches(
                    CronJobRun.objects.filter(started_at__lt=cron_cutoff)
                ),
                'webhook_events': _delete_in_batches(
                    WebhookEvent.objects.filter(status='PROCESSED', created_at__lt=queue_cutoff)
                ) + _delete_in_batches(
                    WebhookEvent.objects.filter(status='DLQ', created_at__lt=dlq_cutoff)
                ),
                'email_deliveries': _delete_in_batches(
                    EmailDelivery.objects.filter(status='SENT', created_at__lt=queue_cutoff)
                ) + _delete_in_batches(
                    EmailDelivery.objects.filter(status='DLQ', created_at__lt=dlq_cutoff)
                ),
                'webhook_deliveries': _delete_in_batches(
                    WebhookDelivery.objects.filter(status='SUCCESS', created_at__lt=queue_cutoff)
                ) + _delete_in_batches(
                    WebhookDelivery.objects.filter(status='DLQ', created_at__lt=dlq_cutoff)
                ),
            }
            result.processed = sum(counts.values())
            result.message = ', '.join(f'{name}: {count}' for name, count in counts.items())

        self.stdout.write(self.style.SUCCESS(f'Pruned {result.processed} rows ({result.message}).'))
