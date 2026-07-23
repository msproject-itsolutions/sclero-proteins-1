import uuid
from unittest.mock import Mock, patch

from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.users.models import User

from .models import PushCampaign, PushSubscription
from .services import process_push_batch


class PushSubscriptionApiTests(APITestCase):
    @override_settings(VAPID_PUBLIC_KEY='', VAPID_PRIVATE_KEY='')
    def test_config_reports_disabled_without_keys(self):
        response = self.client.get(reverse('push_config'))
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['enabled'])
        self.assertEqual(response.data['public_key'], '')

    @patch('apps.push_notifications.serializers.validate_webhook_destination')
    def test_new_endpoint_replaces_same_browser_client(self, validate_destination):
        client_id = str(uuid.uuid4())
        base_payload = {
            'client_id': client_id,
            'keys': {'p256dh': 'public-key', 'auth': 'auth-key'},
        }
        first = self.client.post(
            reverse('push_subscriptions'),
            {**base_payload, 'endpoint': 'https://push.example/first'},
            format='json',
        )
        second = self.client.post(
            reverse('push_subscriptions'),
            {**base_payload, 'endpoint': 'https://push.example/second'},
            format='json',
        )
        self.assertEqual(first.status_code, status.HTTP_200_OK)
        self.assertEqual(second.status_code, status.HTTP_200_OK)
        self.assertFalse(PushSubscription.objects.get(endpoint='https://push.example/first').is_active)
        self.assertTrue(PushSubscription.objects.get(endpoint='https://push.example/second').is_active)
        self.assertEqual(validate_destination.call_count, 2)


class PushCampaignTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(email='push-admin@example.com', password='StrongPass!123')
        self.client.force_authenticate(self.admin)

    def test_campaign_rejects_whitespace_message_and_external_link(self):
        response = self.client.post(reverse('admin-push-campaign-list'), {
            'title': 'Update',
            'body': '   ',
            'target_url': 'https://example.com/phishing',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('body', response.data)
        self.assertIn('target_url', response.data)

    @override_settings(
        VAPID_PUBLIC_KEY='public-key',
        VAPID_PRIVATE_KEY='private-key',
        VAPID_SUBJECT='mailto:ops@example.com',
    )
    @patch('apps.push_notifications.services.validate_webhook_destination')
    @patch('apps.push_notifications.services.webpush')
    def test_queued_campaign_is_sent_by_worker(self, send_webpush, validate_destination):
        send_webpush.return_value = Mock(status_code=201)
        PushSubscription.objects.create(
            client_id=uuid.uuid4(),
            endpoint='https://push.example/subscription',
            p256dh='public-key',
            auth='auth-key',
        )
        campaign = PushCampaign.objects.create(title='New products', body='See what is new.', target_url='/products')

        summary = process_push_batch()

        campaign.refresh_from_db()
        self.assertEqual(summary, {'configured': True, 'processed': 1, 'sent': 1, 'failed': 0})
        self.assertEqual(campaign.status, 'SENT')
        self.assertEqual(campaign.sent_count, 1)
        self.assertEqual(campaign.failed_count, 0)
        send_webpush.assert_called_once()
        validate_destination.assert_called_once()


class PushCommandRunRecordingTests(APITestCase):
    @patch('apps.push_notifications.management.commands.process_push_notifications.process_push_batch')
    def test_failed_pushes_surface_as_failed_run(self, batch):
        from django.core.management import call_command
        from apps.orders.models import CronJobRun

        batch.return_value = {'configured': True, 'processed': 3, 'sent': 1, 'failed': 2}
        call_command('process_push_notifications')

        run = CronJobRun.objects.filter(job_name='process_push_notifications').first()
        self.assertIsNotNone(run)
        # A run with failed deliveries must NOT be recorded as a clean success.
        self.assertEqual(run.status, 'FAILED')
        self.assertEqual(run.processed, 1)
        self.assertEqual(run.failed, 2)
