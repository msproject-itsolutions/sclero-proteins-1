"""Run the store's periodic management commands in one dedicated process."""

import logging
import os
import signal
import threading
import time
import uuid
from datetime import timedelta

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.orders.models import SchedulerLease

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Runs webhook, email retry/sync, cart, review-request, and push jobs.'

    def add_arguments(self, parser):
        parser.add_argument('--once', action='store_true', help='Run each due job once and exit.')

    def handle(self, *args, **options):
        owner = uuid.uuid4().hex
        lease_seconds = max(int(os.getenv('SCHEDULER_LEASE_SECONDS', '300')), 60)
        if not self._renew_lease(owner, lease_seconds):
            raise CommandError('Another scheduler holds the active database lease.')

        intervals = {
            'process_webhooks': int(os.getenv('SCHEDULE_WEBHOOK_SECONDS', '60')),
            'process_outgoing_webhooks': int(os.getenv('SCHEDULE_WEBHOOK_SECONDS', '60')),
            'fetch_support_emails': int(os.getenv('SCHEDULE_EMAIL_SYNC_SECONDS', '900')),
            'process_email_deliveries': int(os.getenv('SCHEDULE_EMAIL_RETRY_SECONDS', '300')),
            'send_abandoned_cart_reminders': int(os.getenv('SCHEDULE_CART_SECONDS', '3600')),
            'send_review_requests': int(os.getenv('SCHEDULE_REVIEW_SECONDS', '86400')),
            'process_push_notifications': int(os.getenv('SCHEDULE_PUSH_SECONDS', '60')),
            'prune_system_records': int(os.getenv('SCHEDULE_PRUNE_SECONDS', '86400')),
        }
        intervals = {name: max(seconds, 30) for name, seconds in intervals.items()}
        due = {name: 0.0 for name in intervals}
        stop = threading.Event()
        heartbeat_path = os.getenv('SCHEDULER_HEARTBEAT_FILE', '/tmp/scheduler-heartbeat')

        def request_stop(*_args):
            stop.set()

        signal.signal(signal.SIGTERM, request_stop)
        signal.signal(signal.SIGINT, request_stop)
        self.stdout.write('Scheduler started.')

        try:
            while not stop.is_set():
                if not self._renew_lease(owner, lease_seconds):
                    raise CommandError('Scheduler database lease was lost.')
                self._touch_heartbeat(heartbeat_path)
                now = time.monotonic()
                for name, interval in intervals.items():
                    if now < due[name]:
                        continue
                    try:
                        call_command(name)
                    except Exception:
                        logger.exception('Scheduled command %s failed', name)
                    finally:
                        due[name] = time.monotonic() + interval
                if options['once']:
                    break
                stop.wait(5)
        finally:
            SchedulerLease.objects.filter(name='primary', owner=owner).delete()

        self.stdout.write('Scheduler stopped.')

    @staticmethod
    def _touch_heartbeat(path):
        """Stamp a liveness file each loop so a container healthcheck can
        detect a hung (alive but stuck) scheduler, not just a crashed one."""
        try:
            with open(path, 'w', encoding='utf-8') as handle:
                handle.write(str(int(time.time())))
        except OSError:
            logger.warning('Could not write scheduler heartbeat file %s', path)

    @staticmethod
    def _renew_lease(owner, lease_seconds):
        now = timezone.now()
        expires_at = now + timedelta(seconds=lease_seconds)
        try:
            with transaction.atomic():
                lease, _ = SchedulerLease.objects.select_for_update().get_or_create(
                    name='primary',
                    defaults={'owner': owner, 'expires_at': expires_at},
                )
                if lease.owner != owner and lease.expires_at > now:
                    return False
                lease.owner = owner
                lease.expires_at = expires_at
                lease.save(update_fields=['owner', 'expires_at', 'updated_at'])
                return True
        except IntegrityError:
            # A concurrent first-start created the singleton lease. Retrying
            # locks and evaluates that row normally.
            with transaction.atomic():
                lease = SchedulerLease.objects.select_for_update().get(name='primary')
                if lease.owner != owner and lease.expires_at > now:
                    return False
                lease.owner = owner
                lease.expires_at = expires_at
                lease.save(update_fields=['owner', 'expires_at', 'updated_at'])
                return True
