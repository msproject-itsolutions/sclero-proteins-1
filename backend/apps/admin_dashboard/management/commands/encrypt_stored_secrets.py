"""Encrypt credentials that were stored in plaintext before encryption at rest.

deploy/vps-install.sh runs this only after the new release has passed every
health and HTTPS check, so an automatic rollback to the previous images (which
read `enc:v1:` values literally) never meets ciphertext. Safe to run again.

Usage:
    python manage.py encrypt_stored_secrets
"""
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.admin_dashboard.management.commands.verify_encryption_key import check_field
from apps.admin_dashboard.models import MarketingIntegration, SystemSetting
from apps.webhooks.models import WebhookSubscription

TARGETS = (
    (SystemSetting, 'value'),
    (MarketingIntegration, 'credentials'),
    (WebhookSubscription, 'secret'),
)


class Command(BaseCommand):
    help = 'Encrypt plaintext secrets in system settings, marketing credentials and webhook subscriptions.'

    def handle(self, *args, **options):
        counts = []
        with transaction.atomic():
            # A value the configured key cannot decrypt loads as '' (fail
            # closed); writing that back would destroy the stored credential.
            unreadable = sum(
                len(check_field(model, model._meta.get_field(name))[1]) for model, name in TARGETS
            )
            if unreadable:
                raise CommandError(
                    f'{unreadable} stored credential(s) cannot be decrypted with INTEGRATION_ENCRYPTION_KEY; '
                    'nothing was changed. Run verify_encryption_key for details.'
                )
            for model, name in TARGETS:
                rows = list(model.objects.all())
                for obj in rows:
                    # Loading decrypts; the field encrypts again on write, so
                    # plaintext becomes ciphertext and ciphertext stays readable.
                    model.objects.filter(pk=obj.pk).update(**{name: getattr(obj, name)})
                counts.append(len(rows))
        self.stdout.write(
            'Encrypted stored secrets: {} setting(s), {} integration(s), {} webhook subscription(s).'.format(*counts)
        )
