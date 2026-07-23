from django.core.management.base import BaseCommand

from apps.orders.cron import job_run
from apps.push_notifications.services import process_push_batch


class Command(BaseCommand):
    help = 'Sends queued browser push campaigns with retries.'

    def add_arguments(self, parser):
        parser.add_argument('--batch-size', type=int, default=100)

    def handle(self, *args, **options):
        with job_run('process_push_notifications') as result:
            summary = process_push_batch(options['batch_size'])
            # Count only successful sends as processed; a delivery that failed
            # or was DLQ'd must surface in the run history, not hide as SUCCESS.
            result.processed = summary.get('sent', summary['processed'])
            result.failed = summary.get('failed', 0)
            result.message = (
                f"Sent {result.processed} push deliveries ({result.failed} failed)."
                if summary['configured']
                else 'Web Push is disabled because VAPID keys are not configured.'
            )
        self.stdout.write(self.style.SUCCESS(result.message))
