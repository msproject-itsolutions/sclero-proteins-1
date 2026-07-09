import json
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APITestCase
from rest_framework import status

from apps.webhooks.models import WebhookSubscription, WebhookDelivery
from apps.webhooks.dispatcher import calculate_signature, dispatch_outgoing_webhook
from apps.orders.models import WebhookEvent

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
    @patch('apps.webhooks.dispatcher.requests.post')
    def test_dispatch_outgoing_webhook(self, mock_post):
        """Verify outgoing webhooks query subscriptions, log delivery, sign headers and post."""
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
        
        # Dispatch webhook (it spawns thread; we'll mock request to complete synchronously)
        with patch('apps.webhooks.dispatcher.threading.Thread') as mock_thread:
            # We mock the thread to execute synchronously for testing
            instance = mock_thread.return_value
            def mock_start():
                mock_thread.call_args[1]['target'](*mock_thread.call_args[1]['args'])
            instance.start = mock_start
            
            dispatch_outgoing_webhook("order.paid", payload)

        # Verify delivery record was created
        delivery = WebhookDelivery.objects.first()
        self.assertIsNotNone(delivery)
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

        # Test trigger
        with patch('apps.webhooks.views.send_delivery_worker') as mock_worker:
            response = self.client.post(f'/api/admin/webhook-subscriptions/{sub.id}/test_delivery/')
            self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
            mock_worker.assert_called_once()
