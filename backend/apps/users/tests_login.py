import json
import re
from datetime import timedelta
from unittest.mock import patch
from urllib.parse import urlencode

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.core import mail
from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.audit.models import AuditLog
from apps.users.challenges import issue_code_challenge
from apps.users.models import LoginChallenge, Role
from apps.users.sessions import issue_tokens

User = get_user_model()
PASSWORD = 'Str0ng-pass-123'
BROWSER = {'HTTP_X_SCLERO_CLIENT': 'storefront'}
LOGIN_URL = '/api/auth/login/'
VERIFY_URL = '/api/auth/login/verify/'
RESEND_URL = '/api/auth/login/resend/'
CODE_RE = re.compile(r'\b(\d{6})\b')
DELIVERY_FAILED_DETAIL = (
    "We couldn't email your sign-in code. Ask an administrator for a one-time code, then enter it here."
)


def last_code():
    return CODE_RE.search(mail.outbox[-1].body).group(1)


class PasswordLoginTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.customer = User.objects.create_user(email='buyer@example.com', password=PASSWORD)
        self.staff = User.objects.create_user(
            email='staff@example.com', password=PASSWORD, is_staff=True, verification_email='codes@example.com',
        )

    def login(self, email, password=PASSWORD, **extra):
        return self.client.post(LOGIN_URL, {'email': email, 'password': password}, format='json', **BROWSER, **extra)

    def verify(self, challenge_id, code):
        return self.client.post(VERIFY_URL, {'challenge_id': challenge_id, 'code': code}, format='json', **BROWSER)

    def test_customer_without_two_step_gets_a_session(self):
        response = self.login(self.customer.email)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['authenticated'])
        self.assertIn('sclero_access', response.cookies)
        self.customer.refresh_from_db()
        self.assertIsNotNone(self.customer.last_login)

    def test_staff_password_alone_never_issues_tokens(self):
        response = self.login(self.staff.email)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['challenge_required'])
        self.assertNotIn('access', response.data)
        self.assertNotIn('sclero_access', response.cookies)
        self.assertEqual(response.data['sent_to_masked'], 'c***@e***.com')
        self.assertEqual(mail.outbox[-1].to, ['codes@example.com'])
        challenge = LoginChallenge.objects.get(pk=response.data['challenge_id'])
        self.assertEqual(challenge.purpose, LoginChallenge.Purpose.STAFF_2FA)

    def test_role_holder_without_the_staff_flag_is_challenged(self):
        packer = User.objects.create_user(email='packer@example.com', password=PASSWORD)
        packer.roles.add(Role.objects.get(name='Staff'))
        self.assertTrue(self.login(packer.email).data['challenge_required'])

    def test_customer_with_two_step_gets_a_code_at_their_email(self):
        self.customer.two_factor_enabled = True
        self.customer.save(update_fields=['two_factor_enabled'])
        response = self.login(self.customer.email)
        self.assertTrue(response.data['challenge_required'])
        self.assertEqual(mail.outbox[-1].to, [self.customer.email])
        challenge = LoginChallenge.objects.get(pk=response.data['challenge_id'])
        self.assertEqual(challenge.purpose, LoginChallenge.Purpose.CUSTOMER_2FA)

    def test_code_completes_the_staff_sign_in(self):
        challenge_id = self.login(self.staff.email).data['challenge_id']
        response = self.verify(challenge_id, last_code())
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['authenticated'])
        self.assertTrue(response.data['user']['is_staff'])
        self.assertIn('sclero_access', response.cookies)
        self.assertEqual(self.client.get('/api/auth/profile/').data['email'], self.staff.email)
        self.assertTrue(AuditLog.objects.filter(action='login.success', changes__method='staff_2fa').exists())

    def test_five_wrong_codes_end_the_challenge(self):
        challenge_id = self.login(self.staff.email).data['challenge_id']
        code = last_code()
        wrong = '000000' if code != '000000' else '111111'
        for _ in range(5):
            response = self.verify(challenge_id, wrong)
            self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['code'], 'locked')
        self.assertEqual(self.verify(challenge_id, code).status_code, 400)
        self.assertTrue(AuditLog.objects.filter(action='login.challenge_locked').exists())

    def test_every_failure_looks_the_same(self):
        inactive = User.objects.create_user(email='gone@example.com', password=PASSWORD, is_active=False)
        for response in (
            self.login('nobody@example.com'),
            self.login(self.customer.email, 'wrong-password'),
            self.login(inactive.email),
        ):
            self.assertEqual(response.status_code, 401)
            self.assertEqual(response.data, {'detail': 'Invalid email or password.'})

    def test_unknown_address_still_hashes_the_password(self):
        with patch('apps.users.views.make_password', wraps=make_password) as hasher:
            self.login('nobody@example.com')
        hasher.assert_called_once()

    def test_ip_allow_list_is_checked_before_any_code_is_sent(self):
        self.staff.allowed_ip_range = '10.0.0.0/8'
        self.staff.save(update_fields=['allowed_ip_range'])
        response = self.login(self.staff.email, REMOTE_ADDR='203.0.113.9')
        self.assertEqual(response.status_code, 403)
        self.assertEqual(len(mail.outbox), 0)

    def test_resend_has_a_cooldown(self):
        challenge_id = self.login(self.staff.email).data['challenge_id']
        response = self.client.post(RESEND_URL, {'challenge_id': challenge_id}, format='json', **BROWSER)
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.data['code'], 'cooldown')

    def test_resend_after_the_cooldown_sends_a_new_code(self):
        challenge_id = self.login(self.staff.email).data['challenge_id']
        LoginChallenge.objects.filter(pk=challenge_id).update(last_sent_at=timezone.now() - timedelta(seconds=61))
        response = self.client.post(RESEND_URL, {'challenge_id': challenge_id}, format='json', **BROWSER)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 2)
        self.assertEqual(self.verify(challenge_id, last_code()).status_code, 200)

    def test_email_sign_in_codes_cannot_complete_a_password_sign_in(self):
        challenge, code = issue_code_challenge(
            purpose=LoginChallenge.Purpose.EMAIL_LOGIN, email=self.staff.email, user=self.staff,
        )
        self.assertEqual(self.verify(str(challenge.pk), code).status_code, 400)

    def test_registration_records_last_login(self):
        response = self.client.post('/api/auth/register/', {
            'email': 'new@example.com', 'password': 'Another-str0ng-pass',
            'first_name': 'New', 'last_name': 'Buyer',
        }, format='json', **BROWSER)
        self.assertEqual(response.status_code, 201)
        self.assertIsNotNone(User.objects.get(email='new@example.com').last_login)


class EmailOutageTests(APITestCase):
    """Staff must still be able to sign in, with an administrator's help, when SMTP is down."""

    def setUp(self):
        cache.clear()
        self.staff = User.objects.create_user(email='staff@example.com', password=PASSWORD, is_staff=True)

    def login(self, email):
        return self.client.post(LOGIN_URL, {'email': email, 'password': PASSWORD}, format='json', **BROWSER)

    def test_staff_login_keeps_the_challenge_when_the_email_fails(self):
        with patch('apps.orders.email_service.send_branded_email', side_effect=OSError('smtp down')), \
                self.assertLogs('apps.users.challenges', 'ERROR'):
            response = self.login(self.staff.email)
        self.assertEqual(response.status_code, 200)
        self.assertIs(response.data['delivery_failed'], True)
        self.assertIs(response.data['challenge_required'], True)
        self.assertEqual(response.data['detail'], DELIVERY_FAILED_DETAIL)
        self.assertNotIn('sclero_access', response.cookies)
        challenge = LoginChallenge.objects.get(pk=response.data['challenge_id'])
        self.assertEqual(challenge.user, self.staff)
        self.assertIsNone(challenge.consumed_at)
        self.assertTrue(AuditLog.objects.filter(action='login.challenge_delivery_failed').exists())

    def test_failed_resend_keeps_the_challenge(self):
        challenge_id = self.login(self.staff.email).data['challenge_id']
        LoginChallenge.objects.filter(pk=challenge_id).update(last_sent_at=timezone.now() - timedelta(seconds=61))
        with patch('apps.orders.email_service.send_branded_email', side_effect=OSError('smtp down')), \
                self.assertLogs('apps.users.challenges', 'ERROR'), self.assertLogs('django.request', 'ERROR'):
            response = self.client.post(RESEND_URL, {'challenge_id': challenge_id}, format='json', **BROWSER)
        self.assertEqual(response.status_code, 503)
        self.assertTrue(LoginChallenge.objects.filter(pk=challenge_id, consumed_at__isnull=True).exists())


class SecondFactorCapTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.staff = User.objects.create_user(email='staff@example.com', password=PASSWORD, is_staff=True)

    def login(self):
        return self.client.post(
            LOGIN_URL, {'email': self.staff.email, 'password': PASSWORD}, format='json', **BROWSER,
        )

    def test_sixth_code_in_fifteen_minutes_is_refused(self):
        for _ in range(5):
            self.assertEqual(self.login().status_code, 200)
        with self.assertLogs('django.request', 'WARNING'):
            response = self.login()
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.data, {
            'detail': 'Too many sign-in codes were requested for this account. Try again in a few minutes.',
            'code': 'too_many_codes',
        })
        self.assertEqual(LoginChallenge.objects.filter(user=self.staff).count(), 5)
        self.assertEqual(len(mail.outbox), 5)
        self.assertTrue(
            AuditLog.objects.filter(action='login.challenge_rate_limited', target_id=str(self.staff.pk)).exists()
        )

        LoginChallenge.objects.filter(user=self.staff).update(created_at=timezone.now() - timedelta(minutes=16))
        response = self.login()
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data['challenge_required'])
        self.assertEqual(LoginChallenge.objects.filter(user=self.staff).count(), 6)


class JsonOnlyAuthTests(APITestCase):
    """A cross-site HTML form cannot send application/json without a CORS
    preflight, so the unauthenticated auth endpoints accept nothing else."""

    def setUp(self):
        cache.clear()
        self.customer = User.objects.create_user(email='buyer@example.com', password=PASSWORD)

    def assert_refused(self, response):
        self.assertEqual(response.status_code, 415)
        self.assertNotIn('sclero_access', response.cookies)
        self.assertNotIn('sclero_refresh', response.cookies)

    def test_form_login_is_refused_and_sets_no_cookies(self):
        data = {'email': self.customer.email, 'password': PASSWORD}
        for name, body in (
            ('urlencoded', {'data': urlencode(data), 'content_type': 'application/x-www-form-urlencoded'}),
            ('multipart', {'data': data, 'format': 'multipart'}),
            ('text/plain', {'data': json.dumps(data), 'content_type': 'text/plain'}),
        ):
            with self.subTest(body=name):
                with self.assertLogs('django.request', 'WARNING'):
                    response = self.client.post(LOGIN_URL, **body)
                self.assert_refused(response)

    def test_form_registration_is_refused_and_creates_nothing(self):
        data = {
            'email': 'new@example.com', 'password': 'Another-str0ng-pass', 'first_name': 'New', 'last_name': 'Buyer',
        }
        with self.assertLogs('django.request', 'WARNING'):
            response = self.client.post(
                '/api/auth/register/', urlencode(data), content_type='application/x-www-form-urlencoded',
            )
        self.assert_refused(response)
        self.assertFalse(User.objects.filter(email='new@example.com').exists())

    def test_form_refresh_with_a_foreign_token_is_refused(self):
        refresh = issue_tokens(self.customer)['refresh']
        with self.assertLogs('django.request', 'WARNING'):
            response = self.client.post(
                '/api/auth/token/refresh/', urlencode({'refresh': refresh}),
                content_type='application/x-www-form-urlencoded',
            )
        self.assert_refused(response)
