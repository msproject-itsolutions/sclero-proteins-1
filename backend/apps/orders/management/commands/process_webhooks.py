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
        gateway_code = event.gateway

        # Resolve gateway row
        from apps.admin_dashboard.models import PaymentGateway
        gateway_row = PaymentGateway.objects.filter(code=gateway_code).first()
        if not gateway_row:
            # Fallback to an unconfigured gateway instance just to load the adapter
            gateway_row = PaymentGateway(code=gateway_code)

        from apps.orders.payments import get_adapter
        adapter = get_adapter(gateway_row)
        
        parsed_event = adapter.parse_webhook_event(payload)
        payment_id = parsed_event.get('payment_id')
        event_type = parsed_event.get('event_type')

        if not payment_id:
            raise Exception("Could not extract payment_id/transaction reference from webhook payload.")

        # Find matching order by payment_id
        order = None
        if payment_id:
            order = Order.objects.filter(payment_id=payment_id).first()
        if not order and parsed_event.get('order_id'):
            order = Order.objects.filter(id=parsed_event.get('order_id')).first()
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

        # Mark order as Paid and status to Processing if the webhook event is a payment success
        if event_type == 'payment.succeeded':
            order.payment_status = 'PAID'
            order.status = 'PROCESSING'
            order.save(update_fields=['payment_status', 'status', 'updated_at'])

            # Create Payment Log
            PaymentLog.objects.create(
                order=order,
                transaction_id=payment_id,
                gateway=gateway_code,
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
        elif event_type == 'payment.failed':
            order.payment_status = 'FAILED'
            order.save(update_fields=['payment_status', 'updated_at'])

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
