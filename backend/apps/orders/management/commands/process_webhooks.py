import time
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db import transaction
from django.db.models import Q
from apps.orders.models import Order, WebhookEvent, PaymentLog, Invoice
from apps.orders.utils import generate_invoice_pdf

# Backoff schedule: attempts 1 to 7 correspond to these delays
BACKOFFS = [
    timedelta(minutes=1),   # 1st retry
    timedelta(minutes=5),   # 2nd retry
    timedelta(minutes=15),  # 3rd retry
    timedelta(minutes=30),  # 4th retry
    timedelta(hours=1),     # 5th retry
    timedelta(hours=6),     # 6th retry
    timedelta(hours=24),    # 7th retry
]

class Command(BaseCommand):
    help = 'Processes queued webhook events with exponential backoff.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Starting Webhook Event Processor..."))
        
        now = timezone.now()
        events = WebhookEvent.objects.filter(
            status__in=['PENDING', 'FAILED']
        ).filter(
            Q(next_attempt_at__isnull=True) | Q(next_attempt_at__lte=now)
        )
        
        count = events.count()
        if count == 0:
            self.stdout.write("No pending webhook events to process.")
            return

        self.stdout.write(f"Found {count} events to process.")

        for event in events:
            self.process_event(event)

    def process_event(self, event):
        event.attempts += 1
        event.last_attempt_at = timezone.now()
        self.stdout.write(f"Processing event {event.id} ({event.gateway} - {event.event_type}), Attempt #{event.attempts}")

        try:
            with transaction.atomic():
                self.execute_business_logic(event)
            event.status = 'PROCESSED'
            event.error_log = ''
            event.next_attempt_at = None
            event.save()
            self.stdout.write(self.style.SUCCESS(f"Event {event.id} processed successfully."))
        except Exception as e:
            import traceback
            error_msg = f"{str(e)}\n\n{traceback.format_exc()}"
            event.error_log = error_msg
            
            if event.attempts >= 7:
                event.status = 'DLQ'
                event.next_attempt_at = None
                self.stdout.write(self.style.ERROR(f"Event {event.id} failed persistently. Routed to Dead Letter Queue (DLQ)."))
            else:
                event.status = 'FAILED'
                delay = BACKOFFS[event.attempts - 1]
                event.next_attempt_at = timezone.now() + delay
                self.stdout.write(self.style.WARNING(f"Event {event.id} failed. Scheduled next attempt in {delay} (at {event.next_attempt_at})"))
            
            event.save()

    def execute_business_logic(self, event):
        payload = event.payload
        payment_id = None
        gateway = event.gateway

        # Extract transaction reference from payloads
        if gateway == 'STRIPE':
            # Stripe Checkout Session or PaymentIntent succeeded
            data_obj = payload.get('data', {}).get('object', {})
            payment_id = data_obj.get('id') or data_obj.get('payment_intent')
        elif gateway == 'RAZORPAY':
            # Razorpay payment captured
            payment_id = payload.get('payload', {}).get('payment', {}).get('entity', {}).get('id')
            if not payment_id:
                payment_id = payload.get('razorpay_payment_id')
        elif gateway == 'PAYPAL':
            # PayPal capture completed
            payment_id = payload.get('resource', {}).get('id')

        if not payment_id:
            raise Exception("Could not extract payment_id/transaction reference from webhook payload.")

        # Find matching order by payment_id
        order = Order.objects.filter(payment_id=payment_id).first()
        if not order:
            # Maybe look by order ID stored in metadata (Stripe client_reference_id or Razorpay notes)
            order_id = self.extract_order_id_from_metadata(event, payload)
            if order_id:
                order = Order.objects.filter(id=order_id).first()
        
        if not order:
            raise Exception(f"No matching order found for transaction ID '{payment_id}'. Queued for retry.")

        # If order is already paid, we're done
        if order.payment_status == 'PAID':
            self.stdout.write(f"Order #{order.id} is already marked as PAID.")
            return

        # Mark order as Paid and status to Processing
        order.payment_status = 'PAID'
        order.status = 'PROCESSING'
        order.save(update_fields=['payment_status', 'status', 'updated_at'])

        # Create Payment Log
        PaymentLog.objects.create(
            order=order,
            transaction_id=payment_id,
            gateway=gateway,
            amount=order.total,
            status='PAID',
            raw_response=payload
        )

        # Generate Invoice PDF
        invoice, created = Invoice.objects.get_or_create(
            order=order,
            defaults={
                'invoice_number': f"SP-{timezone.now().year}-{order.id}",
                'invoice_type': 'GST_INVOICE' if order.region.code == 'IN' else 'VAT_RECEIPT'
            }
        )
        try:
            generate_invoice_pdf(invoice)
        except Exception as inv_err:
            # Don't fail the whole transaction if PDF generation has a minor glitch
            self.stdout.write(self.style.WARNING(f"Invoice generation failed for Order #{order.id}: {str(inv_err)}"))

    def extract_order_id_from_metadata(self, event, payload):
        gateway = event.gateway
        if gateway == 'STRIPE':
            data_obj = payload.get('data', {}).get('object', {})
            metadata = data_obj.get('metadata', {})
            return metadata.get('order_id') or data_obj.get('client_reference_id')
        elif gateway == 'RAZORPAY':
            notes = payload.get('payload', {}).get('payment', {}).get('entity', {}).get('notes', {})
            return notes.get('order_id')
        elif gateway == 'PAYPAL':
            # Custom metadata field in PayPal
            return payload.get('resource', {}).get('custom_id') or payload.get('resource', {}).get('invoice_number')
        return None
