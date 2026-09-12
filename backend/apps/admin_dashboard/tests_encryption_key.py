import re
from io import StringIO

from cryptography.fernet import Fernet
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.test import TestCase, override_settings

from apps.admin_dashboard.models import PaymentGateway, SystemSetting
from apps.regions.models import Region
from apps.webhooks.models import WebhookSubscription

KEY_A = Fernet.generate_key().decode()
KEY_B = Fernet.generate_key().decode()


def run_verify():
    out, err = StringIO(), StringIO()
    try:
        call_command('verify_encryption_key', stdout=out, stderr=err)
    except CommandError as exc:
        return exc, out.getvalue() + err.getvalue()
    return None, out.getvalue() + err.getvalue()


def verified_count(output):
    match = re.search(r'Encryption key verified for (\d+) stored value\(s\)\.', output)
    return int(match.group(1)) if match else None


class VerifyEncryptionKeyTests(TestCase):
    def setUp(self):
        self.region = Region.objects.create(
            code='UK', name='United Kingdom', domain='example.test',
            currency_code='GBP', currency_symbol='£',
        )

    def test_values_written_with_the_configured_key_are_verified(self):
        error, output = run_verify()
        self.assertIsNone(error, output)
        before = verified_count(output)
        self.assertIsNotNone(before, output)

        PaymentGateway.objects.create(
            code='STRIPE', display_name='Stripe', region=self.region,
            secret_key='sk_test_verify', extra_config={'webhook_secret': 'whsec_verify'},
        )
        SystemSetting.objects.create(key='SMTP_SETTINGS', value={
            'EMAIL_HOST': 'smtp.example.com', 'EMAIL_HOST_PASSWORD': 'smtp-verify',
        })
        WebhookSubscription.objects.create(
            name='ERP', url='https://erp.example.com/hook', events=['order.paid'], secret='hook-verify',
        )

        error, output = run_verify()
        self.assertIsNone(error, output)
        # secret_key + extra_config + the SMTP password + the webhook secret
        self.assertEqual(verified_count(output), before + 4, output)

    def test_payment_secret_from_another_key_is_reported_without_the_secret(self):
        with override_settings(INTEGRATION_ENCRYPTION_KEY=KEY_A):
            gateway = PaymentGateway.objects.create(
                code='STRIPE', display_name='Stripe', region=self.region, secret_key='sk_live_plaintext',
            )
        with connection.cursor() as cursor:
            cursor.execute('SELECT secret_key FROM admin_dashboard_paymentgateway WHERE id = %s', [gateway.pk])
            ciphertext = cursor.fetchone()[0]

        with override_settings(INTEGRATION_ENCRYPTION_KEY=KEY_B):
            error, output = run_verify()

        self.assertIsInstance(error, CommandError)
        self.assertIn('cannot be decrypted with INTEGRATION_ENCRYPTION_KEY; aborting before any live change.', str(error))
        self.assertIn(f'admin_dashboard.PaymentGateway pk={gateway.pk} field=secret_key', output)
        self.assertNotIn('sk_live_plaintext', output + str(error))
        self.assertNotIn(ciphertext, output + str(error))

    def test_setting_secret_from_another_key_is_reported(self):
        with override_settings(INTEGRATION_ENCRYPTION_KEY=KEY_A):
            setting = SystemSetting.objects.create(key='IMAP_SETTINGS', value={
                'IMAP_HOST': 'imap.example.com', 'IMAP_PASSWORD': 'imap-plaintext',
            })

        with override_settings(INTEGRATION_ENCRYPTION_KEY=KEY_B):
            error, output = run_verify()

        self.assertIsInstance(error, CommandError)
        self.assertIn(f'admin_dashboard.SystemSetting pk={setting.pk} field=value', output)
        self.assertNotIn('imap-plaintext', output + str(error))
