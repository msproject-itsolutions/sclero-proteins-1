from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db.models import Q
from apps.webhooks.models import WebhookDelivery
from apps.webhooks.dispatcher import send_delivery

class Command(BaseCommand):
    help = 'Processes queued outbound webhooks with exponential backoff.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Starting Outbound Webhook Processor..."))
        
        now = timezone.now()
        deliveries = WebhookDelivery.objects.filter(
            status__in=['PENDING', 'FAILED']
        ).filter(
            Q(next_attempt_at__isnull=True) | Q(next_attempt_at__lte=now)
        )
        
        count = deliveries.count()
        if count == 0:
            self.stdout.write("No pending outbound webhooks to process.")
            return

        self.stdout.write(f"Found {count} outgoing deliveries to process.")

        for delivery in deliveries:
            self.stdout.write(f"Processing delivery {delivery.id} ({delivery.event_type} to {delivery.subscription.name}), Attempt #{delivery.attempts + 1}")
            try:
                send_delivery(delivery)
                if delivery.status == 'SUCCESS':
                    self.stdout.write(self.style.SUCCESS(f"Delivery {delivery.id} sent successfully."))
                else:
                    self.stdout.write(self.style.WARNING(f"Delivery {delivery.id} failed. Status: {delivery.status}. Next attempt: {delivery.next_attempt_at}"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Error processing delivery {delivery.id}: {str(e)}"))
