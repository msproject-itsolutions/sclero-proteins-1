"""Email shoppers who left items in their cart.

Run hourly:  python manage.py send_abandoned_cart_reminders
"""
from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.orders.cron import job_run
from apps.orders.email_service import send_templated_email
from apps.orders.models import Cart

JOB_NAME = 'abandoned_cart_reminders'
DEFAULT_AGE_HOURS = 24
# Don't chase a cart forever, and don't email carts abandoned months ago.
MAX_AGE_HOURS = 24 * 14


class Command(BaseCommand):
    help = 'Send a reminder for carts left untouched for 24 hours.'

    def add_arguments(self, parser):
        parser.add_argument('--hours', type=int, default=DEFAULT_AGE_HOURS,
                            help=f'Cart idle time before reminding (default {DEFAULT_AGE_HOURS}).')
        parser.add_argument('--dry-run', action='store_true',
                            help='Report what would be sent without sending.')

    def handle(self, *args, **options):
        hours = options['hours']
        dry_run = options['dry_run']
        now = timezone.now()
        cutoff = now - timedelta(hours=hours)
        floor = now - timedelta(hours=MAX_AGE_HOURS)

        with job_run(JOB_NAME) as result:
            carts = (
                Cart.objects
                .filter(
                    updated_at__lte=cutoff,      # untouched long enough
                    updated_at__gte=floor,       # but not ancient
                    recovery_status='NOT_CONTACTED',  # only ever chased once
                )
                .exclude(items__isnull=True)     # must still hold something
                .select_related('region', 'user')
                .prefetch_related('items__product')
                .distinct()
            )

            for cart in carts:
                email = (cart.user.email if cart.user else '') or ''
                if not email:
                    # Guest carts have no address until checkout — nothing to send to.
                    continue

                items = list(cart.items.all())
                if not items:
                    continue

                if dry_run:
                    result.processed += 1
                    self.stdout.write(f'[dry-run] would remind {email} ({len(items)} items)')
                    continue

                ok = send_templated_email(
                    'abandoned_cart',
                    cart.region,
                    email,
                    {
                        'customer_name': (cart.user.first_name or email.split('@')[0]) if cart.user else '',
                        'item_count': str(len(items)),
                        'items': ', '.join(f'{i.quantity} x {i.product.name}' for i in items),
                        'cart_url': f"{settings.SITE_URL.rstrip('/')}/products",
                    },
                    audit_target_type='Cart',
                    audit_target_id=cart.id,
                )
                if ok:
                    # Stamped so a cart is never chased twice, even if this job
                    # is re-run or retried after a failure.
                    cart.recovery_status = 'CONTACTED'
                    cart.recovery_attempts += 1
                    cart.last_recovery_at = now
                    cart.save(update_fields=['recovery_status', 'recovery_attempts', 'last_recovery_at'])
                    result.processed += 1
                else:
                    result.failed += 1

            result.message = f'{result.processed} reminders sent, {result.failed} failed (idle >{hours}h)'
            self.stdout.write(self.style.SUCCESS(result.message))
