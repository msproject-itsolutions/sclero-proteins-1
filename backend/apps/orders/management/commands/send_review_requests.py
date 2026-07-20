"""Ask customers to review a product ~30 days after delivery.

Run daily:  python manage.py send_review_requests
"""
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.orders.cron import job_run
from apps.orders.email_service import send_order_email
from apps.orders.models import Order

JOB_NAME = 'review_requests'
DEFAULT_DAYS = 30


class Command(BaseCommand):
    help = 'Send a review request 30 days after an order was delivered.'

    def add_arguments(self, parser):
        parser.add_argument('--days', type=int, default=DEFAULT_DAYS,
                            help=f'Days after delivery before asking (default {DEFAULT_DAYS}).')
        parser.add_argument('--dry-run', action='store_true',
                            help='Report what would be sent without sending.')

    def handle(self, *args, **options):
        days = options['days']
        dry_run = options['dry_run']
        now = timezone.now()
        cutoff = now - timedelta(days=days)

        with job_run(JOB_NAME) as result:
            orders = (
                Order.objects
                .filter(
                    status='DELIVERED',
                    delivered_at__isnull=False,
                    delivered_at__lte=cutoff,
                    review_request_sent_at__isnull=True,  # never ask twice
                )
                .select_related('region')
                .prefetch_related('items__product')
            )

            for order in orders:
                items = list(order.items.all())
                if not items:
                    continue

                if dry_run:
                    result.processed += 1
                    self.stdout.write(f'[dry-run] would ask {order.email} about order #{order.id}')
                    continue

                first = items[0].product
                site_url = settings.SITE_URL.rstrip('/')
                ok = send_order_email('review_request', order, {
                    'product_name': first.name,
                    'product_sku': first.sku,
                    'review_url': f'{site_url}/products/{first.sku}',
                })
                if ok:
                    # Stamped even on a retry, so a customer is asked only once.
                    order.review_request_sent_at = now
                    order.save(update_fields=['review_request_sent_at'])
                    result.processed += 1
                else:
                    result.failed += 1

            result.message = f'{result.processed} review requests sent, {result.failed} failed (delivered >{days}d ago)'
            self.stdout.write(self.style.SUCCESS(result.message))
