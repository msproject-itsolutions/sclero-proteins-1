from django.db import connection
from django.test import TestCase

from .models import Region, ShippingProvider
from .serializers import ShippingProviderAdminSerializer


class ShippingProviderConfigurationTests(TestCase):
    def setUp(self):
        self.region = Region.objects.create(
            code='IN', name='India', domain='example.in',
            currency_code='INR', currency_symbol='₹',
        )

    def test_credentials_are_encrypted_and_write_only(self):
        provider = ShippingProvider.objects.create(
            code='SHIPROCKET', display_name='Shiprocket', region=self.region,
            credentials={'email': 'ops@example.com', 'password': 'private-password'},
            configuration={'pickup_location': 'Main warehouse'},
        )
        with connection.cursor() as cursor:
            cursor.execute(
                'SELECT credentials FROM regions_shippingprovider WHERE id = %s',
                [provider.id],
            )
            raw_credentials = cursor.fetchone()[0]
        self.assertTrue(raw_credentials.startswith('enc:v1:'))
        self.assertNotIn('private-password', raw_credentials)

        data = ShippingProviderAdminSerializer(provider).data
        self.assertNotIn('credentials', data)
        self.assertTrue(data['credential_status']['email'])
        self.assertTrue(data['credential_status']['password'])

    def test_provider_cannot_be_enabled_until_required_settings_exist(self):
        serializer = ShippingProviderAdminSerializer(data={
            'code': 'DHL_EXPRESS',
            'display_name': 'DHL Express',
            'region': self.region.id,
            'is_enabled': True,
            'mode': 'LIVE',
            'credentials': {},
            'configuration': {},
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('is_enabled', serializer.errors)

    def test_manual_provider_can_be_enabled_without_credentials(self):
        serializer = ShippingProviderAdminSerializer(data={
            'code': 'MANUAL',
            'display_name': 'Manual fulfilment',
            'region': self.region.id,
            'is_enabled': True,
            'mode': 'LIVE',
        })
        self.assertTrue(serializer.is_valid(), serializer.errors)
