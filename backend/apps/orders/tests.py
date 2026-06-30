import hashlib
import hmac
import os
import time
from unittest.mock import patch

from django.db import IntegrityError, transaction
from django.test import SimpleTestCase, TestCase, override_settings

from apps.admin_dashboard.models import PaymentGateway
from apps.admin_dashboard.serializers import PaymentGatewayAdminSerializer
from apps.regions.models import Region

from .models import WebhookEvent
from .payments import (
    PaymentError,
    gateway_is_checkout_ready,
    resolve_gateway,
    verify_paypal_signature,
    verify_stripe_signature,
)


class WebhookSignatureTests(SimpleTestCase):
    def test_stripe_accepts_any_valid_v1_signature_during_rotation(self):
        body = b'{"id":"evt_123"}'
        timestamp = str(int(time.time()))
        secret = 'whsec_test'
        signed = f"{timestamp}.{body.decode()}".encode()
        valid = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
        header = f't={timestamp},v1=invalid,v1={valid}'
        self.assertTrue(verify_stripe_signature(body, header, secret))

    def test_paypal_fails_closed_without_credentials(self):
        self.assertFalse(verify_paypal_signature({}, b'{}', '', '', '', 'LIVE'))


class PaymentSafetyTests(TestCase):
    def setUp(self):
        self.region = Region.objects.create(
            code='UK',
            name='United Kingdom',
            domain='scleroproteins.co.uk',
            currency_code='GBP',
            currency_symbol='£',
            tax_name='VAT',
            tax_rate='20.00',
        )

    @override_settings(DEBUG=False, TESTING=False)
    @patch.dict(os.environ, {'ALLOW_SANDBOX_PAYMENTS': 'False'})
    def test_test_gateway_is_hidden_and_rejected_in_production(self):
        gateway = PaymentGateway.objects.create(
            code='STRIPE',
            display_name='Stripe',
            region=self.region,
            is_enabled=True,
            mode='TEST',
        )
        self.assertFalse(gateway_is_checkout_ready(gateway))
        with self.assertRaises(PaymentError):
            resolve_gateway(self.region, 'STRIPE')

    @override_settings(DEBUG=False, TESTING=False)
    def test_unimplemented_live_gateway_is_hidden_and_rejected(self):
        gateway = PaymentGateway.objects.create(
            code='STRIPE',
            display_name='Stripe',
            region=self.region,
            is_enabled=True,
            mode='LIVE',
            secret_key='not-a-real-key',
        )
        self.assertFalse(gateway_is_checkout_ready(gateway))
        with self.assertRaises(PaymentError):
            resolve_gateway(self.region, 'STRIPE')

    @override_settings(DEBUG=False, TESTING=False)
    def test_cod_remains_available(self):
        gateway = PaymentGateway.objects.create(
            code='COD',
            display_name='Cash on delivery',
            region=self.region,
            is_enabled=True,
            mode='TEST',
        )
        self.assertTrue(gateway_is_checkout_ready(gateway))
        self.assertEqual(resolve_gateway(self.region, 'COD').code, 'COD')

    def test_admin_serializer_never_returns_secret_material(self):
        gateway = PaymentGateway.objects.create(
            code='PAYPAL',
            display_name='PayPal',
            region=self.region,
            secret_key='server-secret',
            extra_config={'webhook_secret': 'webhook-secret'},
        )
        data = PaymentGatewayAdminSerializer(gateway).data
        self.assertNotIn('secret_key', data)
        self.assertNotIn('extra_config', data)

        serializer = PaymentGatewayAdminSerializer(
            gateway,
            data={'secret_key': '', 'display_name': 'PayPal updated'},
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        gateway.refresh_from_db()
        self.assertEqual(gateway.secret_key, 'server-secret')

    def test_webhook_event_id_is_unique_per_gateway(self):
        WebhookEvent.objects.create(
            gateway='STRIPE',
            event_id='evt_same',
            event_type='payment_intent.succeeded',
            payload={},
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                WebhookEvent.objects.create(
                    gateway='STRIPE',
                    event_id='evt_same',
                    event_type='payment_intent.succeeded',
                    payload={},
                )
