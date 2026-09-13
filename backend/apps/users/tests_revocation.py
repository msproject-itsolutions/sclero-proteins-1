import hashlib
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from apps.admin_dashboard.models import ApprovalRequest
from apps.users.challenges import issue_code_challenge
from apps.users.models import LoginChallenge
from apps.users.sessions import issue_tokens

User = get_user_model()
PASSWORD = 'Str0ng-pass-123'
NEW_PASSWORD = 'N3w-strong-pass!'
BROWSER = {'HTTP_X_SCLERO_CLIENT': 'storefront'}


def bearer_client(access):
    client = APIClient()
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
    return client


def refresh_status(refresh):
    return APIClient().post('/api/auth/token/refresh/', {'refresh': refresh}, format='json').status_code


class RevocationTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(email='buyer@example.com', password=PASSWORD)

    def cookie_login(self):
        response = self.client.post(
            '/api/auth/login/', {'email': self.user.email, 'password': PASSWORD}, format='json', **BROWSER,
        )
        self.assertEqual(response.status_code, 200)


class PasswordChangeTests(RevocationTestCase):
    def test_wrong_current_password_is_refused(self):
        self.cookie_login()
        with self.assertLogs('django.request', 'WARNING'):
            response = self.client.post('/api/auth/password/change/', {
                'current_password': 'not-my-password', 'new_password': NEW_PASSWORD,
            }, format='json', **BROWSER)
        self.assertEqual(response.status_code, 400)
        self.assertIn('current_password', response.data)

    def test_change_signs_out_other_devices_and_keeps_this_one(self):
        self.cookie_login()
        other_device = issue_tokens(self.user)
        response = self.client.post('/api/auth/password/change/', {
            'current_password': PASSWORD, 'new_password': NEW_PASSWORD,
        }, format='json', **BROWSER)
        self.assertEqual(response.status_code, 200)
        self.assertIn('sclero_access', response.cookies)
        self.assertNotIn('access', response.data)
        self.assertEqual(self.client.get('/api/auth/profile/').status_code, 200)
        with self.assertLogs('django.request', 'WARNING'):
            self.assertEqual(bearer_client(other_device['access']).get('/api/auth/profile/').status_code, 401)
        with self.assertLogs('django.request', 'WARNING'):
            self.assertEqual(refresh_status(other_device['refresh']), 401)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(NEW_PASSWORD))

    def test_passwordless_account_can_set_a_password(self):
        passwordless = User.objects.create_user(email='codeonly@example.com', password=None)
        client = bearer_client(issue_tokens(passwordless)['access'])
        response = client.post('/api/auth/password/change/', {'new_password': NEW_PASSWORD}, format='json')
        self.assertEqual(response.status_code, 200)
        passwordless.refresh_from_db()
        self.assertTrue(passwordless.check_password(NEW_PASSWORD))


class PasswordResetTests(RevocationTestCase):
    def test_completing_a_reset_signs_out_everywhere(self):
        tokens = issue_tokens(self.user)
        raw = 'reset-token-value'
        self.user.password_reset_token = hashlib.sha256(raw.encode()).hexdigest()
        self.user.password_reset_token_expires = timezone.now() + timedelta(hours=1)
        self.user.save(update_fields=['password_reset_token', 'password_reset_token_expires'])
        response = self.client.post('/api/auth/password/reset/confirm/', {
            'token': raw, 'new_password': NEW_PASSWORD,
        }, format='json')
        self.assertEqual(response.status_code, 200)
        with self.assertLogs('django.request', 'WARNING'):
            self.assertEqual(bearer_client(tokens['access']).get('/api/auth/profile/').status_code, 401)

    @override_settings(DEBUG=True, SITE_URL='')
    def test_reset_link_uses_a_trusted_base(self):
        self.client.post('/api/auth/password/reset/request/', {
            'email': self.user.email, 'origin': 'https://evil.example',
        }, format='json')
        body = mail.outbox[-1].body
        self.assertIn('http://localhost:3000/account/reset?token=', body)
        self.assertNotIn('evil.example', body)


class SignOutEverywhereTests(RevocationTestCase):
    def test_other_devices_are_signed_out_and_this_one_continues(self):
        self.cookie_login()
        other_device = issue_tokens(self.user)
        response = self.client.post('/api/auth/profile/terminate-devices/', {}, format='json', **BROWSER)
        self.assertEqual(response.status_code, 200)
        self.assertIn('sclero_access', response.cookies)
        self.assertEqual(len(response.data['current_devices']), 1)
        self.assertEqual(self.client.get('/api/auth/profile/').status_code, 200)
        with self.assertLogs('django.request', 'WARNING'):
            self.assertEqual(bearer_client(other_device['access']).get('/api/auth/profile/').status_code, 401)
        with self.assertLogs('django.request', 'WARNING'):
            self.assertEqual(refresh_status(other_device['refresh']), 401)


class DeactivationTests(RevocationTestCase):
    def test_account_deletion_ends_sessions_and_forgets_challenges(self):
        issue_code_challenge(purpose=LoginChallenge.Purpose.EMAIL_LOGIN, email=self.user.email, user=self.user)
        tokens = issue_tokens(self.user)
        self.assertEqual(bearer_client(tokens['access']).delete('/api/auth/me/').status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.auth_version, 1)
        with self.assertLogs('django.request', 'WARNING'):
            self.assertEqual(refresh_status(tokens['refresh']), 401)
        self.assertFalse(LoginChallenge.objects.filter(email='buyer@example.com').exists())

    def test_approved_erasure_ends_the_customers_sessions(self):
        owner = User.objects.create_superuser(email='owner@example.com', password=PASSWORD)
        approval = ApprovalRequest.objects.create(
            requester=self.user, request_type='ERASURE', summary='Erase me',
            payload={'user_id': self.user.pk},
        )
        self.client.force_authenticate(owner)
        response = self.client.post(f'/api/admin/approval-requests/{approval.pk}/approve/')
        self.assertEqual(response.status_code, 200, response.data)
        self.user.refresh_from_db()
        self.assertEqual(self.user.auth_version, 1)
