import re
import time
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from rest_framework.test import APITestCase

from apps.audit.models import AuditLog
from apps.users.email_tokens import make_email_change_token, make_verify_email_token
from apps.users.sessions import issue_tokens

User = get_user_model()
PASSWORD = 'Str0ng-pass-123'
CHANGE_LINK_RE = re.compile(r'confirm-email-change\?token=(\S+)')
VERIFY_LINK_RE = re.compile(r'verify-email\?token=(\S+)')


def link_token(pattern, recipient):
    message = next(message for message in mail.outbox if message.to == [recipient])
    return pattern.search(message.body).group(1)


class EmailChangeTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(email='old@example.com', password=PASSWORD, email_verified=True)
        self.tokens = issue_tokens(self.user)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.tokens["access"]}')

    def request_change(self, new_email='new@example.com', password=PASSWORD):
        return self.client.post('/api/auth/email-change/', {'new_email': new_email, 'password': password}, format='json')

    def confirm(self, token, as_user=None):
        # The confirming client must be signed in as the token's own account
        # (see EmailChangeConfirmView). Re-fetch auth_version so a token
        # issued after an earlier confirm in the same test still authenticates.
        user = as_user or self.user
        user.refresh_from_db(fields=['auth_version'])
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {issue_tokens(user)["access"]}')
        return self.client.post('/api/auth/email-change/confirm/', {'token': token}, format='json')

    def test_wrong_password_is_refused(self):
        with self.assertLogs('django.request', 'WARNING'):
            response = self.request_change(password='not-my-password')
        self.assertEqual(response.status_code, 400)
        self.assertIn('password', response.data)
        self.assertEqual(len(mail.outbox), 0)

    def test_link_goes_to_the_new_address_and_a_notice_to_the_old(self):
        response = self.request_change()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(sorted(message.to[0] for message in mail.outbox), ['new@example.com', 'old@example.com'])
        self.assertNotIn('token=', next(m for m in mail.outbox if m.to == ['old@example.com']).body)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'old@example.com')

    def test_confirming_changes_the_email_and_signs_out_everywhere(self):
        self.request_change()
        response = self.confirm(link_token(CHANGE_LINK_RE, 'new@example.com'))
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'new@example.com')
        self.assertTrue(self.user.email_verified)
        self.assertEqual(self.user.auth_version, 1)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.tokens["access"]}')
        with self.assertLogs('django.request', 'WARNING'):
            self.assertEqual(self.client.get('/api/auth/profile/').status_code, 401)
        audit = AuditLog.objects.get(action='account.email_changed')
        self.assertEqual(audit.changes['email'], ['old@example.com', 'new@example.com'])

    def test_a_link_works_once(self):
        self.request_change()
        token = link_token(CHANGE_LINK_RE, 'new@example.com')
        self.assertEqual(self.confirm(token).status_code, 200)
        with self.assertLogs('django.request', 'WARNING'):
            self.assertEqual(self.confirm(token).status_code, 400)

    def test_expired_link_is_refused(self):
        with patch('django.core.signing.time.time', return_value=time.time() - 2 * 86400):
            token = make_email_change_token(self.user, 'new@example.com')
        with self.assertLogs('django.request', 'WARNING'):
            response = self.confirm(token)
        self.assertEqual(response.status_code, 400)
        self.assertIn('expired', response.data['detail'])

    def test_an_address_in_use_is_refused(self):
        User.objects.create_user(email='taken@example.com', password=PASSWORD)
        with self.assertLogs('django.request', 'WARNING'):
            response = self.request_change('taken@example.com')
        self.assertEqual(response.status_code, 400)
        self.assertIn('new_email', response.data)

    def test_staff_email_change_is_locked_to_the_console(self):
        staff = User.objects.create_user(email='staffer@example.com', password=PASSWORD, is_staff=True)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {issue_tokens(staff)["access"]}')
        with self.assertLogs('django.request', 'WARNING'):
            response = self.client.post(
                '/api/auth/email-change/', {'new_email': 'attacker@example.com', 'password': PASSWORD}, format='json',
            )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json().get('code'), 'staff_email_locked')
        self.assertEqual(len(mail.outbox), 0)

    def test_passwordless_account_needs_no_password(self):
        passwordless = User.objects.create_user(email='codeonly@example.com', password=None)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {issue_tokens(passwordless)["access"]}')
        response = self.client.post('/api/auth/email-change/', {'new_email': 'fresh@example.com'}, format='json')
        self.assertEqual(response.status_code, 200)

    def test_anonymous_confirm_is_refused(self):
        self.request_change()
        token = link_token(CHANGE_LINK_RE, 'new@example.com')
        self.client.credentials()
        with self.assertLogs('django.request', 'WARNING'):
            response = self.client.post('/api/auth/email-change/confirm/', {'token': token}, format='json')
        self.assertEqual(response.status_code, 401)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'old@example.com')

    def test_a_different_signed_in_account_cannot_confirm(self):
        self.request_change()
        token = link_token(CHANGE_LINK_RE, 'new@example.com')
        stranger = User.objects.create_user(email='stranger@example.com', password=PASSWORD)
        with self.assertLogs('django.request', 'WARNING'):
            response = self.confirm(token, as_user=stranger)
        self.assertEqual(response.status_code, 403)
        self.user.refresh_from_db()
        self.assertEqual(self.user.email, 'old@example.com')


class VerifyEmailTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(email='buyer@example.com', password=PASSWORD)

    def test_link_marks_the_address_verified(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {issue_tokens(self.user)["access"]}')
        self.assertEqual(self.client.post('/api/auth/verify-email/', {}, format='json').status_code, 200)
        token = link_token(VERIFY_LINK_RE, 'buyer@example.com')
        # Confirming requires staying signed in as the account the link was sent for.
        response = self.client.post('/api/auth/verify-email/confirm/', {'token': token}, format='json')
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.email_verified)

    def test_link_for_a_previous_address_is_refused(self):
        token = make_verify_email_token(self.user)
        User.objects.filter(pk=self.user.pk).update(email='changed@example.com')
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {issue_tokens(self.user)["access"]}')
        with self.assertLogs('django.request', 'WARNING'):
            response = self.client.post('/api/auth/verify-email/confirm/', {'token': token}, format='json')
        self.assertEqual(response.status_code, 400)
        self.user.refresh_from_db()
        self.assertFalse(self.user.email_verified)

    def test_anonymous_confirm_is_refused(self):
        token = make_verify_email_token(self.user)
        with self.assertLogs('django.request', 'WARNING'):
            response = self.client.post('/api/auth/verify-email/confirm/', {'token': token}, format='json')
        self.assertEqual(response.status_code, 401)
        self.user.refresh_from_db()
        self.assertFalse(self.user.email_verified)

    def test_a_different_signed_in_account_cannot_confirm(self):
        token = make_verify_email_token(self.user)
        stranger = User.objects.create_user(email='stranger@example.com', password=PASSWORD)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {issue_tokens(stranger)["access"]}')
        with self.assertLogs('django.request', 'WARNING'):
            response = self.client.post('/api/auth/verify-email/confirm/', {'token': token}, format='json')
        self.assertEqual(response.status_code, 403)
        self.user.refresh_from_db()
        self.assertFalse(self.user.email_verified)

    def test_verification_email_warns_about_unrequested_accounts(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {issue_tokens(self.user)["access"]}')
        self.client.post('/api/auth/verify-email/', {}, format='json')
        message = next(m for m in mail.outbox if m.to == ['buyer@example.com'])
        self.assertIn('If you did not create a Sclero Proteins account, ignore this email.', message.body)
