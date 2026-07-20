from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.core.management import call_command
from rest_framework.test import APITestCase
from rest_framework import status

from apps.webhooks.models import WebhookSubscription, WebhookDelivery
from apps.webhooks.dispatcher import calculate_signature, dispatch_outgoing_webhook, send_delivery

User = get_user_model()

class WebhooksModelTest(TestCase):
    def test_subscription_auto_generates_secret(self):
        """Verify that a webhook subscription automatically generates a secret if left blank."""
        sub = WebhookSubscription.objects.create(
            name="ERP Integration",
            url="https://api.my-erp.com/webhook",
            events=["order.paid"]
        )
        self.assertTrue(len(sub.secret) > 0)
        self.assertEqual(sub.name, "ERP Integration")

    def test_signature_calculation(self):
        """Verify HMAC-SHA256 signature is calculated correctly."""
        secret = "test_signing_secret_key"
        payload = '{"event": "ping"}'
        sig = calculate_signature(payload, secret)
        
        # Verify signature length is 64 characters (hex representation of sha256)
        self.assertEqual(len(sig), 64)


class WebhooksDispatcherTest(TestCase):
    def test_disabled_subscription_is_not_called(self):
        sub = WebhookSubscription.objects.create(
            name='Disabled', url='https://hooks.example.com/receive',
            events=['order.paid'], is_active=False,
        )
        delivery = WebhookDelivery.objects.create(
            subscription=sub, event_type='order.paid', payload={'order_id': 1},
        )
        with patch('apps.webhooks.dispatcher.requests.post') as post:
            send_delivery(delivery)
        delivery.refresh_from_db()
        post.assert_not_called()
        self.assertEqual(delivery.status, 'DLQ')

    @patch('apps.webhooks.dispatcher.validate_webhook_destination')
    @patch('apps.webhooks.dispatcher.requests.post')
    def test_dispatch_outgoing_webhook(self, mock_post, _mock_validate):
        """The dispatcher queues durably and the worker signs and delivers it."""
        # Setup mock response
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = "OK"
        mock_post.return_value = mock_response

        # Create active subscription
        sub = WebhookSubscription.objects.create(
            name="Billing Webhook",
            url="https://api.my-billing.com/webhook",
            events=["order.paid"],
            secret="super-secret-key"
        )

        payload = {"order_id": 42, "total": "120.00"}
        
        dispatch_outgoing_webhook("order.paid", payload)

        # Request lifecycle only queues; the scheduler performs network I/O.
        delivery = WebhookDelivery.objects.first()
        self.assertIsNotNone(delivery)
        self.assertEqual(delivery.status, 'PENDING')
        call_command('process_outgoing_webhooks')
        delivery.refresh_from_db()
        self.assertEqual(delivery.subscription, sub)
        self.assertEqual(delivery.status, 'SUCCESS')
        self.assertEqual(delivery.attempts, 1)
        self.assertEqual(delivery.response_status, 200)

        # Verify request headers and URL
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        self.assertEqual(args[0], "https://api.my-billing.com/webhook")
        
        headers = kwargs['headers']
        self.assertEqual(headers['X-Sclero-Event'], "order.paid")
        self.assertEqual(headers['X-Sclero-Delivery'], str(delivery.id))
        self.assertTrue('X-Sclero-Signature' in headers)
        self.assertFalse(kwargs['allow_redirects'])

class WebhooksAPITest(APITestCase):
    def setUp(self):
        # Create staff user with manage settings permission
        self.staff_user = User.objects.create_user(
            email="staff@scleroproteins.co.uk",
            password="securepassword123",
            is_staff=True
        )
        # Setup permissions (if RBAC is enforced)
        from apps.users.models import Role
        role = Role.objects.create(name="Administrator", permissions=["settings.manage"])
        self.staff_user.roles.add(role)

        self.client.force_authenticate(user=self.staff_user)

    def test_subscription_crud(self):
        """Verify endpoints support creating, listing, and testing subscriptions."""
        # Create
        response = self.client.post('/api/admin/webhook-subscriptions/', {
            "name": "CRM Sync",
            "url": "https://crm.mycorp.com/hooks",
            "events": ["order.created", "order.paid"],
            "is_active": True
        }, format='json')
        
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(WebhookSubscription.objects.count(), 1)
        sub = WebhookSubscription.objects.first()
        self.assertEqual(sub.name, "CRM Sync")

        # List
        response = self.client.get('/api/admin/webhook-subscriptions/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Test trigger creates a durable pending delivery for the scheduler.
        response = self.client.post(f'/api/admin/webhook-subscriptions/{sub.id}/test_delivery/')
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertTrue(WebhookDelivery.objects.filter(subscription=sub, status='PENDING').exists())

    def test_subscription_rejects_private_destination(self):
        response = self.client.post('/api/admin/webhook-subscriptions/', {
            'name': 'Unsafe',
            'url': 'http://127.0.0.1:8000/internal',
            'events': ['order.paid'],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
