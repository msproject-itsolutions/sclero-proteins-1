import re
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.audit.models import AuditLog
from apps.users.models import LoginChallenge

User = get_user_model()
PASSWORD = 'Str0ng-pass-123'
BROWSER = {'HTTP_X_SCLERO_CLIENT': 'storefront'}
REFUSAL = 'This account signs in with password and email code.'
CODE_RE = re.compile(r'\b(\d{6})\b')
LINK_RE = re.compile(r'/auth/magic\?token=([0-9a-f]{32}\.[\w-]+)')


def last_code():
    return CODE_RE.search(mail.outbox[-1].body).group(1)


class EmailCodeSignInTests(APITestCase):
    def setUp(self):
        cache.clear()

    def send(self, email):
        return self.client.post('/api/auth/otp/send/', {'identifier': email}, format='json')

    def verify(self, challenge_id, code):
        return self.client.post(
            '/api/auth/otp/verify/', {'challenge_id': challenge_id, 'otp': code}, format='json', **BROWSER,
        )

    def test_requesting_a_code_creates_no_account(self):
        response = self.send('newcomer@example.com')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(User.objects.filter(email='newcomer@example.com').exists())
        self.assertTrue(LoginChallenge.objects.filter(email='newcomer@example.com', user__isnull=True).exists())

    def test_verified_code_creates_a_verified_passwordless_account(self):
        challenge_id = self.send('newcomer@example.com').data['challenge_id']
        response = self.verify(challenge_id, last_code())
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['authenticated'])
        user = User.objects.get(email='newcomer@example.com')
        self.assertTrue(user.email_verified)
        self.assertFalse(user.has_usable_password())

    def test_existing_customer_becomes_verified(self):
        customer = User.objects.create_user(email='buyer@example.com', password=PASSWORD)
        challenge_id = self.send(customer.email).data['challenge_id']
        self.assertEqual(self.verify(challenge_id, last_code()).status_code, 200)
        customer.refresh_from_db()
        self.assertTrue(customer.email_verified)
        self.assertTrue(AuditLog.objects.filter(action='login.success', changes__method='email_code').exists())

    def test_staff_accounts_are_refused(self):
        User.objects.create_user(email='staff@example.com', password=PASSWORD, is_staff=True)
        with self.assertLogs('django.request', 'WARNING'):
            response = self.send('staff@example.com')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['error'], REFUSAL)
        self.assertEqual(len(mail.outbox), 0)

    def test_customers_with_two_step_are_refused(self):
        User.objects.create_user(email='careful@example.com', password=PASSWORD, two_factor_enabled=True)
        with self.assertLogs('django.request', 'WARNING'):
            self.assertEqual(self.send('careful@example.com').status_code, 403)

    def test_account_that_became_staff_after_the_email_is_refused(self):
        customer = User.objects.create_user(email='buyer@example.com', password=PASSWORD)
        challenge_id = self.send(customer.email).data['challenge_id']
        customer.is_staff = True
        customer.save(update_fields=['is_staff'])
        with self.assertLogs('django.request', 'WARNING'):
            response = self.verify(challenge_id, last_code())
        self.assertEqual(response.status_code, 403)
        self.assertNotIn('sclero_access', response.cookies)

    def test_attempts_are_limited_per_challenge(self):
        challenge_id = self.send('guess@example.com').data['challenge_id']
        code = last_code()
        wrong = '000000' if code != '000000' else '111111'
        with self.assertLogs('django.request', 'WARNING'):
            for _ in range(5):
                self.assertEqual(self.verify(challenge_id, wrong).status_code, 400)
            self.assertEqual(self.verify(challenge_id, code).status_code, 400)
        self.assertFalse(User.objects.filter(email='guess@example.com').exists())

    def test_hourly_limit_per_address(self):
        for _ in range(5):
            self.assertEqual(self.send('busy@example.com').status_code, 200)
        with self.assertLogs('django.request', 'WARNING'):
            self.assertEqual(self.send('busy@example.com').status_code, 429)


class MagicLinkSignInTests(APITestCase):
    def setUp(self):
        cache.clear()

    def request_link(self, email):
        return self.client.post('/api/auth/magic-link/request/', {'email': email}, format='json')

    def test_link_creates_the_account_only_when_used_and_works_once(self):
        self.assertEqual(self.request_link('reader@example.com').status_code, 200)
        self.assertFalse(User.objects.filter(email='reader@example.com').exists())
        token = LINK_RE.search(mail.outbox[-1].body).group(1)
        response = self.client.post('/api/auth/magic-link/verify/', {'token': token}, format='json', **BROWSER)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(User.objects.get(email='reader@example.com').email_verified)
        with self.assertLogs('django.request', 'WARNING'):
            again = self.client.post('/api/auth/magic-link/verify/', {'token': token}, format='json', **BROWSER)
        self.assertEqual(again.status_code, 400)

    def test_staff_cannot_use_magic_links(self):
        User.objects.create_user(email='staff@example.com', password=PASSWORD, is_staff=True)
        with self.assertLogs('django.request', 'WARNING'):
            response = self.request_link('staff@example.com')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['error'], REFUSAL)
        self.assertEqual(len(mail.outbox), 0)


@override_settings(GOOGLE_CLIENT_ID='client-123')
class GoogleSignInTests(APITestCase):
    def setUp(self):
        cache.clear()

    def google(self, email='g@example.com', sub='sub-1'):
        reply = MagicMock(status_code=200)
        reply.json.return_value = {
            'aud': 'client-123', 'email_verified': 'true', 'email': email, 'sub': sub,
            'given_name': 'Gia', 'family_name': 'User',
        }
        with patch('apps.users.views.requests.get', return_value=reply):
            return self.client.post('/api/auth/google/', {'credential': 'id-token'}, format='json', **BROWSER)

    def test_new_google_user_is_created_verified_and_audited(self):
        response = self.google()
        self.assertEqual(response.status_code, 200)
        user = User.objects.get(email='g@example.com')
        self.assertTrue(user.email_verified)
        self.assertEqual(user.google_id, 'sub-1')
        self.assertTrue(AuditLog.objects.filter(action='login.success', changes__method='google', actor=user).exists())

    def test_staff_accounts_are_refused(self):
        User.objects.create_user(email='g@example.com', password=PASSWORD, is_staff=True)
        with self.assertLogs('django.request', 'WARNING'):
            response = self.google()
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.data['error'], REFUSAL)
        self.assertNotIn('sclero_access', response.cookies)

    def test_inactive_accounts_are_refused(self):
        User.objects.create_user(email='g@example.com', password=PASSWORD, is_active=False)
        with self.assertLogs('django.request', 'WARNING'):
            self.assertEqual(self.google().status_code, 403)

    def test_returning_user_is_found_by_google_id_after_an_email_change(self):
        User.objects.create_user(email='new-address@example.com', password=None, google_id='sub-1')
        response = self.google(email='old-address@example.com')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(User.objects.filter(google_id='sub-1').count(), 1)
        self.assertEqual(response.data['user']['email'], 'new-address@example.com')
        self.assertFalse(User.objects.get(google_id='sub-1').email_verified)
