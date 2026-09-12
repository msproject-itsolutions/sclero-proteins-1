import json
from io import StringIO

from cryptography.fernet import Fernet
from django.core.exceptions import ImproperlyConfigured
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from django.test import SimpleTestCase, TestCase, override_settings

from apps.admin_dashboard.models import MarketingIntegration, SystemSetting
from apps.common.fields import is_sensitive_key
from apps.webhooks.dispatcher import calculate_signature
from apps.webhooks.models import WebhookSubscription
from sclero_backend.config_checks import require_integration_key


def raw_column(table, column, pk):
    with connection.cursor() as cursor:
        cursor.execute(f'SELECT {column} FROM {table} WHERE id = %s', [pk])  # nosec B608 - table/column are test constants, never user input
        value = cursor.fetchone()[0]
    return value if isinstance(value, str) else json.dumps(value)


class SettingSecretEncryptionTests(TestCase):
    def test_secret_values_are_encrypted_at_rest_and_plain_in_the_app(self):
        setting = SystemSetting.objects.create(key='SMTP_SETTINGS', value={
            'EMAIL_HOST': 'smtp.example.com',
            'EMAIL_HOST_PASSWORD': 'hunter2-secret',
            'nested': {'api_key': 'k-123'},
            'webhook_enabled': True,
        })
        raw = raw_column('admin_dashboard_systemsetting', 'value', setting.pk)
        self.assertNotIn('hunter2-secret', raw)
        self.assertNotIn('k-123', raw)
        self.assertIn('smtp.example.com', raw)
        self.assertIn('enc:v1:', raw)

        setting.refresh_from_db()
        self.assertEqual(setting.value['EMAIL_HOST_PASSWORD'], 'hunter2-secret')
        self.assertEqual(setting.value['nested']['api_key'], 'k-123')
        self.assertIs(setting.value['webhook_enabled'], True)

    def test_marketing_credentials_are_encrypted_at_rest(self):
        integration = MarketingIntegration.objects.create(
            name='Ads', channel='GOOGLE_ADS',
            credentials={'client_id': 'public-id', 'client_secret': 'private-secret'},
        )
        raw = raw_column('admin_dashboard_marketingintegration', 'credentials', integration.pk)
        self.assertIn('public-id', raw)
        self.assertNotIn('private-secret', raw)
        integration.refresh_from_db()
        self.assertEqual(integration.credentials['client_secret'], 'private-secret')

    def test_existing_plaintext_rows_are_encrypted_by_the_command(self):
        setting = SystemSetting.objects.create(key='IMAP_SETTINGS', value={'IMAP_HOST': 'imap.example.com'})
        with connection.cursor() as cursor:
            cursor.execute(
                'UPDATE admin_dashboard_systemsetting SET value = %s WHERE id = %s',
                [json.dumps({'IMAP_HOST': 'imap.example.com', 'IMAP_PASSWORD': 'legacy-plain'}), setting.pk],
            )
        call_command('encrypt_stored_secrets', stdout=StringIO())
        raw = raw_column('admin_dashboard_systemsetting', 'value', setting.pk)
        self.assertNotIn('legacy-plain', raw)
        setting.refresh_from_db()
        self.assertEqual(setting.value['IMAP_PASSWORD'], 'legacy-plain')

    def test_existing_plaintext_marketing_credentials_are_encrypted_by_the_command(self):
        integration = MarketingIntegration.objects.create(
            name='Legacy Ads', channel='FACEBOOK_ADS', credentials={'client_id': 'legacy-id'},
        )
        with connection.cursor() as cursor:
            cursor.execute(
                'UPDATE admin_dashboard_marketingintegration SET credentials = %s WHERE id = %s',
                [json.dumps({'client_id': 'legacy-id', 'client_secret': 'legacy-marketing-plain'}), integration.pk],
            )
        call_command('encrypt_stored_secrets', stdout=StringIO())
        raw = raw_column('admin_dashboard_marketingintegration', 'credentials', integration.pk)
        self.assertNotIn('legacy-marketing-plain', raw)
        integration.refresh_from_db()
        self.assertEqual(integration.credentials['client_secret'], 'legacy-marketing-plain')


class WebhookSecretEncryptionTests(TestCase):
    def test_subscription_secret_is_encrypted_and_still_signs(self):
        subscription = WebhookSubscription.objects.create(
            name='ERP', url='https://erp.example.com/hook', events=['order.paid'], secret='sign-me-please',
        )
        raw = raw_column('webhooks_webhooksubscription', 'secret', subscription.pk)
        self.assertTrue(raw.startswith('enc:v1:'))
        subscription.refresh_from_db()
        self.assertEqual(
            calculate_signature('{"a":1}', subscription.secret),
            calculate_signature('{"a":1}', 'sign-me-please'),
        )

    def test_existing_plaintext_subscription_secret_is_encrypted_by_the_command(self):
        subscription = WebhookSubscription.objects.create(
            name='Legacy', url='https://legacy.example.com/hook', events=['order.paid'], secret='sign-me-please',
        )
        with connection.cursor() as cursor:
            cursor.execute(
                'UPDATE webhooks_webhooksubscription SET secret = %s WHERE id = %s',
                ['legacy-webhook-plain', subscription.pk],
            )
        call_command('encrypt_stored_secrets', stdout=StringIO())
        raw = raw_column('webhooks_webhooksubscription', 'secret', subscription.pk)
        self.assertNotIn('legacy-webhook-plain', raw)
        subscription.refresh_from_db()
        self.assertEqual(subscription.secret, 'legacy-webhook-plain')


class EncryptStoredSecretsCommandTests(TestCase):
    def _plant_plaintext(self):
        setting = SystemSetting.objects.create(key='SMTP_SETTINGS', value={})
        integration = MarketingIntegration.objects.create(name='Ads', channel='GOOGLE_ADS', credentials={})
        subscription = WebhookSubscription.objects.create(
            name='ERP', url='https://erp.example.com/hook', events=['order.paid'],
        )
        with connection.cursor() as cursor:
            cursor.execute(
                'UPDATE admin_dashboard_systemsetting SET value = %s WHERE id = %s',
                [json.dumps({'EMAIL_HOST': 'smtp.example.com', 'EMAIL_HOST_PASSWORD': 'twice-smtp'}), setting.pk],
            )
            cursor.execute(
                'UPDATE admin_dashboard_marketingintegration SET credentials = %s WHERE id = %s',
                [json.dumps({'client_id': 'public-id', 'client_secret': 'twice-marketing'}), integration.pk],
            )
            cursor.execute(
                'UPDATE webhooks_webhooksubscription SET secret = %s WHERE id = %s',
                ['twice-webhook', subscription.pk],
            )
        return setting, integration, subscription

    def test_running_twice_leaves_values_decryptable_and_unchanged(self):
        setting, integration, subscription = self._plant_plaintext()
        first, second = StringIO(), StringIO()
        call_command('encrypt_stored_secrets', stdout=first)
        call_command('encrypt_stored_secrets', stdout=second)

        expected_line = 'Encrypted stored secrets: {} setting(s), {} integration(s), {} webhook subscription(s).'.format(
            SystemSetting.objects.count(), MarketingIntegration.objects.count(), WebhookSubscription.objects.count(),
        )
        self.assertEqual(first.getvalue().strip(), expected_line)
        self.assertEqual(second.getvalue().strip(), expected_line)
        for table, column, pk, plaintext in (
            ('admin_dashboard_systemsetting', 'value', setting.pk, 'twice-smtp'),
            ('admin_dashboard_marketingintegration', 'credentials', integration.pk, 'twice-marketing'),
            ('webhooks_webhooksubscription', 'secret', subscription.pk, 'twice-webhook'),
        ):
            raw = raw_column(table, column, pk)
            self.assertNotIn(plaintext, raw)
            self.assertIn('enc:v1:', raw)

        setting.refresh_from_db()
        integration.refresh_from_db()
        subscription.refresh_from_db()
        self.assertEqual(setting.value, {'EMAIL_HOST': 'smtp.example.com', 'EMAIL_HOST_PASSWORD': 'twice-smtp'})
        self.assertEqual(integration.credentials, {'client_id': 'public-id', 'client_secret': 'twice-marketing'})
        self.assertEqual(subscription.secret, 'twice-webhook')

    def test_refuses_to_rewrite_values_the_current_key_cannot_read(self):
        other_key = Fernet.generate_key().decode()
        with override_settings(INTEGRATION_ENCRYPTION_KEY=other_key):
            subscription = WebhookSubscription.objects.create(
                name='Other key', url='https://other.example.com/hook', events=['order.paid'], secret='other-key-secret',
            )
        before = raw_column('webhooks_webhooksubscription', 'secret', subscription.pk)
        with self.assertRaisesMessage(CommandError, 'cannot be decrypted with INTEGRATION_ENCRYPTION_KEY'):
            call_command('encrypt_stored_secrets', stdout=StringIO(), stderr=StringIO())
        self.assertEqual(raw_column('webhooks_webhooksubscription', 'secret', subscription.pk), before)


class SensitiveKeyTests(SimpleTestCase):
    def test_spelling_variants_of_secret_keys_are_sensitive(self):
        for key in ('apiKey', 'privateKey', 'access-key', 'smtp_pwd'):
            with self.subTest(key=key):
                self.assertTrue(is_sensitive_key(key))

    def test_ordinary_configuration_keys_are_not_sensitive(self):
        for key in ('pixel_id', 'EMAIL_HOST'):
            with self.subTest(key=key):
                self.assertFalse(is_sensitive_key(key))


class IntegrationKeyGuardTests(SimpleTestCase):
    VALID_KEY = 'x3q5dA0bJ4t9WZlXhCq2VbE8r1yN6uK7mS0pT3vG5aI='

    def test_production_requires_a_valid_fernet_key(self):
        for bad in ('', 'CHANGE_ME_stable_fernet_key', 'too-short'):
            with self.subTest(key=bad), self.assertRaises(ImproperlyConfigured):
                require_integration_key(debug=False, building_static=False, key=bad)
        require_integration_key(debug=False, building_static=False, key=self.VALID_KEY)

    def test_debug_and_static_builds_do_not_require_a_key(self):
        require_integration_key(debug=True, building_static=False, key='')
        require_integration_key(debug=False, building_static=True, key='')
