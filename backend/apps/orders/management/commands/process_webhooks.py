from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from apps.admin_dashboard.models import PaymentGateway
from apps.orders.cron import job_run
from apps.orders.models import Order, PaymentLog, WebhookEvent
from apps.orders.order_payments import mark_order_paid
from apps.orders.payments import adapter_for_order, from_minor_units, get_adapter

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
ACTIONABLE_EVENTS = ('payment.succeeded', 'payment.failed', 'refund.processed')


def find_order_for_event(gateway_code, parsed):
    """The locked order a provider event is about, or None.

    The gateway object opened for the order decides first; the provider payment
    id serves refunds of older orders; our own order id is trusted only for an
    order not yet bound to a different gateway payment.
    """
    orders = Order.objects.select_for_update().select_related('region')
    reference = str(parsed.get('payment_reference') or '')
    if reference:
        order = orders.filter(payment_method=gateway_code, payment_reference=reference).first()
        if order is not None:
            return order
    payment_id = str(parsed.get('payment_id') or '')
    if payment_id:
        order = orders.filter(payment_method=gateway_code, payment_id=payment_id).first()
        if order is not None:
            return order
    order_id = str(parsed.get('order_id') or '')
    if order_id.isdigit():
        order = orders.filter(pk=int(order_id), payment_method=gateway_code).first()
        if order is not None and order.payment_reference in (None, '', reference):
            return order
    return None


class Command(BaseCommand):
    help = 'Processes queued webhook events with exponential backoff.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--limit', type=int, default=100,
            help='Maximum events per run; keeps one run from blocking the scheduler.',
        )

    def handle(self, *args, **options):
        limit = min(max(options['limit'], 1), 1000)
        self.stdout.write(self.style.SUCCESS("Starting Webhook Event Processor..."))

        now = timezone.now()
        # Snapshot ids once and bound the batch, so a backlog cannot hold the
        # single-threaded scheduler past its lease.
        event_ids = list(
            WebhookEvent.objects.filter(status__in=['PENDING', 'FAILED'])
            .filter(Q(next_attempt_at__isnull=True) | Q(next_attempt_at__lte=now))
            .order_by('created_at')
            .values_list('pk', flat=True)[:limit]
        )

        with job_run('process_webhooks') as result:
            if not event_ids:
                result.message = 'No pending webhook events to process.'
                self.stdout.write(result.message)
                return

            self.stdout.write(f"Found {len(event_ids)} events to process.")
            for event_pk in event_ids:
                if self.process_event_by_pk(event_pk):
                    result.processed += 1
                else:
                    result.failed += 1
            result.message = (
                f'Processed {result.processed} webhook event(s); {result.failed} failed.'
            )

    def process_event_by_pk(self, event_pk):
        """Process one queued event. Returns True on success, False on failure."""
        # Claim and process one event under a row lock; the scheduler lease is
        # the normal guard, this lock also covers a manual overlapping run.
        with transaction.atomic():
            event = WebhookEvent.objects.select_for_update().filter(pk=event_pk).first()
            if event is None:
                return True
            now = timezone.now()
            if event.status not in ('PENDING', 'FAILED'):
                return True
            if event.next_attempt_at and event.next_attempt_at > now:
                return True

            event.attempts += 1
            event.last_attempt_at = now
            self.stdout.write(f"Processing event {event.id} ({event.gateway} - {event.event_type}), Attempt #{event.attempts}")

            succeeded = False
            try:
                # A nested savepoint rolls back partial order/log changes while
                # allowing the failure state and retry schedule to be recorded.
                with transaction.atomic():
                    outcome = self.execute_business_logic(event)
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
                succeeded = True
                event.status = 'PROCESSED'
                event.error_log = ''
                event.error_message = 'ignored' if outcome == 'ignored' else ''
                event.next_attempt_at = None
                self.stdout.write(self.style.SUCCESS(f"Event {event.id} processed ({outcome})."))

            event.save(update_fields=[
                'attempts', 'last_attempt_at', 'status', 'error_log',
                'error_message', 'next_attempt_at',
            ])
            return succeeded

    def execute_business_logic(self, event):
        """Apply one provider event; returns 'ignored' for events the store does not act on."""
        gateway = PaymentGateway.objects.filter(code=event.gateway).first() or PaymentGateway(code=event.gateway)
        parsed = get_adapter(gateway).parse_webhook_event(event.payload)
        kind = parsed.get('event_type')
        if kind not in ACTIONABLE_EVENTS:
            return 'ignored'
        order = find_order_for_event(event.gateway, parsed)
        if order is None:
            reference = parsed.get('payment_reference') or parsed.get('payment_id') or '(none)'
            raise ValueError(f'No order matches {event.gateway} payment {reference}; queued for retry.')
        if kind == 'payment.succeeded':
            verification = adapter_for_order(order).webhook_verification(order, parsed)
            mark_order_paid(order, verification, source='webhook')
        elif kind == 'payment.failed':
            # The shopper may retry the same payment, so the order keeps waiting.
            PaymentLog.objects.get_or_create(
                order=order,
                transaction_id=parsed.get('payment_id') or parsed.get('payment_reference') or f'event-{event.pk}',
                status='FAILED',
                defaults={'gateway': event.gateway, 'amount': order.total, 'raw_response': event.payload},
            )
        else:
            self.apply_refund(order, parsed, event)
        return 'applied'

    def apply_refund(self, order, parsed, event):
        amount_minor = parsed.get('amount_minor')
        refunded = from_minor_units(amount_minor, order.currency_code) if amount_minor is not None else None
        PaymentLog.objects.get_or_create(
            order=order,
            transaction_id=parsed.get('payment_id') or f'event-{event.pk}',
            status='REFUND_PROCESSED',
            defaults={'gateway': event.gateway, 'amount': refunded or order.total, 'raw_response': event.payload},
        )
        # Refunds recorded here plus this event's cumulative amount decide
        # whether the WHOLE order is refunded; a partial refund must not flip it.
        recorded = order.refunds.filter(status='PROCESSED').aggregate(total=Sum('amount'))['total'] or Decimal('0')
        covered = max(recorded, refunded or Decimal('0'))
        if refunded is None or covered >= order.total:
            order.payment_status = 'REFUNDED'
            if order.status != 'CANCELLED':
                order.status = 'REFUNDED'
            order.save(update_fields=['payment_status', 'status', 'updated_at'])
        else:
            self.stdout.write(
                f"Partial refund of {refunded} recorded for order #{order.id}; the order keeps its status."
            )
