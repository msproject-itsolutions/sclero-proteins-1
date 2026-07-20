from datetime import timedelta
from decimal import Decimal, InvalidOperation
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
        # Claim and process one event under a row lock. The scheduler lease is
        # the normal single-worker guard; this lock also protects against a
        # manual command overlapping a scheduled run.
        with transaction.atomic():
            event = WebhookEvent.objects.select_for_update().get(pk=event.pk)
            now = timezone.now()
            if event.status not in ('PENDING', 'FAILED'):
                return
            if event.next_attempt_at and event.next_attempt_at > now:
                return

            event.attempts += 1
            event.last_attempt_at = now
            self.stdout.write(f"Processing event {event.id} ({event.gateway} - {event.event_type}), Attempt #{event.attempts}")

            try:
                # A nested savepoint rolls back partial order/log changes while
                # allowing the failure state and retry schedule to be recorded.
                with transaction.atomic():
                    self.execute_business_logic(event)
            except Exception as e:
                import traceback
                error_msg = str(e)[:2000]
                event.error_message = error_msg
                event.error_log = f"{error_msg}\n\n{traceback.format_exc()}"[:10000]

                if event.attempts >= 7:
                    event.status = 'DLQ'
                    event.next_attempt_at = None
                    self.stdout.write(self.style.ERROR(f"Event {event.id} failed persistently. Routed to Dead Letter Queue (DLQ)."))
                else:
                    event.status = 'FAILED'
                    delay = BACKOFFS[event.attempts - 1]
                    event.next_attempt_at = timezone.now() + delay
                    self.stdout.write(self.style.WARNING(f"Event {event.id} failed. Scheduled next attempt in {delay} (at {event.next_attempt_at})"))
            else:
                event.status = 'PROCESSED'
                event.error_log = ''
                event.error_message = ''
                event.next_attempt_at = None
                self.stdout.write(self.style.SUCCESS(f"Event {event.id} processed successfully."))

            event.save(update_fields=[
                'attempts', 'last_attempt_at', 'status', 'error_log',
                'error_message', 'next_attempt_at',
            ])

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
            order = Order.objects.select_for_update().filter(payment_id=payment_id).first()
        if not order and parsed_event.get('order_id'):
            order = Order.objects.select_for_update().filter(id=parsed_event.get('order_id')).first()
        if not order:
            # Maybe look by order ID stored in metadata (Stripe client_reference_id or Razorpay notes)
            order_id = self.extract_order_id_from_metadata(event, payload)
            if order_id:
                order = Order.objects.select_for_update().filter(id=order_id).first()
        
        if not order:
            raise Exception(f"No matching order found for transaction ID '{payment_id}'. Queued for retry.")

        if event_type == 'payment.succeeded':
            try:
                paid_amount = Decimal(str(parsed_event.get('amount') or '0'))
            except InvalidOperation as exc:
                raise ValueError('Webhook contained an invalid payment amount.') from exc
            paid_currency = str(parsed_event.get('currency') or '').upper()
            if paid_amount and paid_amount != order.total:
                raise ValueError(
                    f'Webhook amount {paid_amount} does not match order total {order.total}.'
                )
            if paid_currency and paid_currency != order.currency_code.upper():
                raise ValueError(
                    f'Webhook currency {paid_currency} does not match order currency {order.currency_code}.'
                )

        # A duplicate success is a no-op; other event types (notably refunds)
        # must still be applied to an already-paid order.
        if event_type == 'payment.succeeded' and order.payment_status == 'PAID':
            self.stdout.write(f"Order #{order.id} is already marked as PAID.")
            return

        # Mark order as Paid and status to Processing if the webhook event is a payment success
        if event_type == 'payment.succeeded':
            order.payment_status = 'PAID'
            order.status = 'PROCESSING'
            order.save(update_fields=['payment_status', 'status', 'updated_at'])

            # Create Payment Log
            PaymentLog.objects.get_or_create(
                order=order,
                transaction_id=payment_id,
                defaults={
                    'gateway': gateway_code,
                    'amount': order.total,
                    'status': 'PAID',
                    'raw_response': payload,
                },
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
        elif event_type == 'refund.processed':
            order.payment_status = 'REFUNDED'
            order.status = 'REFUNDED'
            order.save(update_fields=['payment_status', 'status', 'updated_at'])

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
