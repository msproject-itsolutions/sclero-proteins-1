from datetime import timedelta
from types import SimpleNamespace
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.audit.models import AuditLog
from apps.users import challenges
from apps.users.auth_emails import public_link_base
from apps.users.challenges import (
    MAX_ATTEMPTS, ChallengeDeliveryError, ChallengeError, enforce_passwordless_limit,
    issue_code_challenge, issue_magic_link, mask_email, resend_code, verify_code, verify_magic_token,
)
from apps.users.models import LoginChallenge

User = get_user_model()
STAFF = LoginChallenge.Purpose.STAFF_2FA


def wrong_code_for(code):
    return '000000' if code != '000000' else '111111'


class MaskEmailTests(TestCase):
    def test_masks_local_part_and_domain_name(self):
        self.assertEqual(mask_email('jane.doe@example.com'), 'j***@e***.com')
        self.assertEqual(mask_email('a@b.co.uk'), 'a***@b***.uk')
        self.assertEqual(mask_email('not-an-email'), '***')


class CodeChallengeTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='staff@example.com', password='Str0ng-pass-123', is_staff=True,
            verification_email='security@example.com',
        )

    def issue(self):
        return issue_code_challenge(purpose=STAFF, email=self.user.email, user=self.user)

    def test_code_goes_to_the_verification_address_and_is_stored_hashed(self):
        challenge, code = self.issue()
        self.assertRegex(code, r'^\d{6}$')
        self.assertEqual(mail.outbox[-1].to, ['security@example.com'])
        self.assertIn(code, mail.outbox[-1].body)
        self.assertNotIn(code, challenge.code_hash)
        self.assertEqual(challenge.expires_at - challenge.last_sent_at, timedelta(minutes=10))

    def test_correct_code_works_once(self):
        challenge, code = self.issue()
        self.assertEqual(verify_code(challenge.pk, code, purposes=[STAFF]).pk, challenge.pk)
        with self.assertRaises(ChallengeError) as ctx:
            verify_code(challenge.pk, code, purposes=[STAFF])
        self.assertEqual(ctx.exception.code, 'invalid')

    def test_wrong_codes_are_counted_and_lock_the_challenge(self):
        challenge, code = self.issue()
        wrong = wrong_code_for(code)
        for remaining in range(MAX_ATTEMPTS - 1, 0, -1):
            with self.assertRaises(ChallengeError) as ctx:
                verify_code(challenge.pk, wrong, purposes=[STAFF])
            self.assertEqual(ctx.exception.code, 'mismatch')
            self.assertEqual(ctx.exception.attempts_remaining, remaining)
        with self.assertRaises(ChallengeError) as ctx:
            verify_code(challenge.pk, wrong, purposes=[STAFF])
        self.assertEqual(ctx.exception.code, 'locked')
        with self.assertRaises(ChallengeError) as ctx:
            verify_code(challenge.pk, code, purposes=[STAFF])
        self.assertEqual(ctx.exception.code, 'invalid')
        self.assertTrue(AuditLog.objects.filter(action='login.challenge_locked').exists())

    def test_expired_code_is_refused(self):
        challenge, code = self.issue()
        LoginChallenge.objects.filter(pk=challenge.pk).update(expires_at=timezone.now() - timedelta(seconds=1))
        with self.assertRaises(ChallengeError) as ctx:
            verify_code(challenge.pk, code, purposes=[STAFF])
        self.assertEqual(ctx.exception.code, 'expired')

    def test_code_for_another_purpose_is_refused(self):
        challenge, code = issue_code_challenge(purpose=LoginChallenge.Purpose.EMAIL_LOGIN, email='buyer@example.com')
        with self.assertRaises(ChallengeError) as ctx:
            verify_code(challenge.pk, code, purposes=[STAFF])
        self.assertEqual(ctx.exception.code, 'invalid')

    def test_resend_waits_for_the_cooldown_and_replaces_the_code(self):
        challenge, first = self.issue()
        with self.assertRaises(ChallengeError) as ctx:
            resend_code(challenge.pk, purposes=[STAFF])
        self.assertEqual(ctx.exception.code, 'cooldown')
        self.assertGreater(ctx.exception.retry_after, 0)
        LoginChallenge.objects.filter(pk=challenge.pk).update(last_sent_at=timezone.now() - timedelta(seconds=61))
        _, second = resend_code(challenge.pk, purposes=[STAFF])
        self.assertEqual(len(mail.outbox), 2)
        if second != first:
            with self.assertRaises(ChallengeError):
                verify_code(challenge.pk, first, purposes=[STAFF])
        self.assertEqual(verify_code(challenge.pk, second, purposes=[STAFF]).pk, challenge.pk)

    def test_resend_limit(self):
        challenge, _ = self.issue()
        LoginChallenge.objects.filter(pk=challenge.pk).update(
            send_count=challenges.MAX_SENDS, last_sent_at=timezone.now() - timedelta(minutes=2),
        )
        with self.assertRaises(ChallengeError) as ctx:
            resend_code(challenge.pk, purposes=[STAFF])
        self.assertEqual(ctx.exception.code, 'send_limit')

    def test_failed_delivery_leaves_no_challenge(self):
        with patch('apps.orders.email_service.send_branded_email', side_effect=OSError('smtp down')):
            with self.assertRaises(ChallengeDeliveryError):
                self.issue()
        self.assertFalse(LoginChallenge.objects.exists())


class MagicLinkChallengeTests(TestCase):
    def test_link_token_verifies_once(self):
        challenge, link = issue_magic_link(email='reader@example.com', link_base='https://shop.example')
        self.assertTrue(link.startswith('https://shop.example/auth/magic?token='))
        token = link.split('token=', 1)[1]
        self.assertIn(token, mail.outbox[-1].body)
        self.assertEqual(verify_magic_token(token).pk, challenge.pk)
        with self.assertRaises(ChallengeError):
            verify_magic_token(token)

    def test_tampered_token_is_refused(self):
        challenge, _ = issue_magic_link(email='reader@example.com', link_base='')
        with self.assertRaises(ChallengeError) as ctx:
            verify_magic_token(f'{challenge.pk.hex}.not-the-secret')
        self.assertEqual(ctx.exception.code, 'mismatch')
        with self.assertRaises(ChallengeError) as ctx:
            verify_magic_token('garbage')
        self.assertEqual(ctx.exception.code, 'invalid')


class PasswordlessLimitTests(TestCase):
    def test_hourly_limit_per_address(self):
        for _ in range(challenges.PASSWORDLESS_HOURLY_LIMIT):
            issue_code_challenge(purpose=LoginChallenge.Purpose.EMAIL_LOGIN, email='busy@example.com')
        with self.assertRaises(ChallengeError) as ctx:
            enforce_passwordless_limit('Busy@Example.com')
        self.assertEqual(ctx.exception.code, 'rate_limited')


class LinkBaseTests(TestCase):
    @override_settings(
        DEBUG=False, SITE_URL='https://shop.example',
        CSRF_TRUSTED_ORIGINS=['https://shop.example', 'https://shop.in'],
        CORS_ALLOWED_ORIGINS=['http://localhost:3000'],
    )
    def test_only_trusted_origins_are_used(self):
        self.assertEqual(public_link_base(SimpleNamespace(data={'origin': 'https://shop.in'})), 'https://shop.in')
        self.assertEqual(public_link_base(SimpleNamespace(data={'origin': 'https://evil.example'})), 'https://shop.example')
        self.assertEqual(public_link_base(SimpleNamespace(data={'origin': 'http://localhost:3000'})), 'https://shop.example')
        self.assertEqual(public_link_base(), 'https://shop.example')

    @override_settings(DEBUG=True, SITE_URL='', CSRF_TRUSTED_ORIGINS=[], CORS_ALLOWED_ORIGINS=[])
    def test_localhost_is_allowed_in_development(self):
        self.assertEqual(public_link_base(SimpleNamespace(data={'origin': 'http://localhost:3100'})), 'http://localhost:3100')
        self.assertEqual(public_link_base(), 'http://localhost:3000')
