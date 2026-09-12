from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from apps.users.models import LoginChallenge

User = get_user_model()


class AccountSecurityFieldTests(TestCase):
    def test_new_accounts_start_unverified_at_version_zero(self):
        user = User.objects.create_user(email='new@example.com', password='Str0ng-pass-123')
        self.assertEqual(user.auth_version, 0)
        self.assertFalse(user.email_verified)
        self.assertEqual(user.verification_email, '')

    def test_login_challenge_defaults(self):
        user = User.objects.create_user(email='staff@example.com', password='Str0ng-pass-123', is_staff=True)
        challenge = LoginChallenge.objects.create(
            user=user, email=user.email, purpose=LoginChallenge.Purpose.STAFF_2FA,
            code_hash='x' * 64, sent_to=user.email, expires_at=timezone.now() + timedelta(minutes=10),
        )
        challenge.refresh_from_db()
        self.assertEqual(challenge.attempts, 0)
        self.assertEqual(challenge.send_count, 1)
        self.assertIsNone(challenge.consumed_at)
        self.assertIsNotNone(challenge.last_sent_at)
        self.assertEqual(len(str(challenge.pk)), 36)
        self.assertEqual(list(user.login_challenges.all()), [challenge])
