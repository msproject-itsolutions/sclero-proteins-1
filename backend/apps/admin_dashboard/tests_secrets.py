import importlib
import json

from django.apps import apps as django_apps
from django.core.exceptions import ImproperlyConfigured
from django.db import connection
from django.test import SimpleTestCase, TestCase

from apps.admin_dashboard.models import MarketingIntegration, SystemSetting
from apps.webhooks.dispatcher import calculate_signature
from apps.webhooks.models import WebhookSubscription
from sclero_backend.config_checks import require_integration_key


def raw_column(table, column, pk):
    with connection.cursor() as cursor:
        cursor.execute(f'SELECT {column} FROM {table} WHERE id = %s', [pk])
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

    def test_existing_plaintext_rows_are_encrypted_by_the_migration(self):
        setting = SystemSetting.objects.create(key='IMAP_SETTINGS', value={'IMAP_HOST': 'imap.example.com'})
        with connection.cursor() as cursor:
            cursor.execute(
                'UPDATE admin_dashboard_systemsetting SET value = %s WHERE id = %s',
                [json.dumps({'IMAP_HOST': 'imap.example.com', 'IMAP_PASSWORD': 'legacy-plain'}), setting.pk],
            )
        migration = importlib.import_module('apps.admin_dashboard.migrations.0017_encrypt_setting_secrets')
        migration.encrypt_existing(django_apps, None)
        raw = raw_column('admin_dashboard_systemsetting', 'value', setting.pk)
        self.assertNotIn('legacy-plain', raw)
        setting.refresh_from_db()
        self.assertEqual(setting.value['IMAP_PASSWORD'], 'legacy-plain')

    def test_existing_plaintext_marketing_credentials_are_encrypted_by_the_migration(self):
        integration = MarketingIntegration.objects.create(
            name='Legacy Ads', channel='FACEBOOK_ADS', credentials={'client_id': 'legacy-id'},
        )
        with connection.cursor() as cursor:
            cursor.execute(
                'UPDATE admin_dashboard_marketingintegration SET credentials = %s WHERE id = %s',
                [json.dumps({'client_id': 'legacy-id', 'client_secret': 'legacy-marketing-plain'}), integration.pk],
            )
        migration = importlib.import_module('apps.admin_dashboard.migrations.0017_encrypt_setting_secrets')
        migration.encrypt_existing(django_apps, None)
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

    def test_existing_plaintext_subscription_secret_is_encrypted_by_the_migration(self):
        subscription = WebhookSubscription.objects.create(
            name='Legacy', url='https://legacy.example.com/hook', events=['order.paid'], secret='sign-me-please',
        )
        with connection.cursor() as cursor:
            cursor.execute(
                'UPDATE webhooks_webhooksubscription SET secret = %s WHERE id = %s',
                ['legacy-webhook-plain', subscription.pk],
            )
        migration = importlib.import_module('apps.webhooks.migrations.0002_encrypt_subscription_secret')
        migration.encrypt_existing(django_apps, None)
        raw = raw_column('webhooks_webhooksubscription', 'secret', subscription.pk)
        self.assertNotIn('legacy-webhook-plain', raw)
        subscription.refresh_from_db()
        self.assertEqual(subscription.secret, 'legacy-webhook-plain')


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
