import re
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.core.management import call_command
from django.core.management.base import CommandError
from rest_framework.test import APITestCase

from apps.audit.models import AuditLog

User = get_user_model()
PASSWORD = 'Str0ng-pass-123'
BROWSER = {'HTTP_X_SCLERO_CLIENT': 'storefront'}
CODE_RE = re.compile(r'\b(\d{6})\b')


class StaffLoginCodeCommandTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.staff = User.objects.create_user(email='staff@example.com', password=PASSWORD, is_staff=True)

    def run_command(self, email):
        out = StringIO()
        call_command('staff_login_code', email, stdout=out)
        return out.getvalue()

    def test_code_completes_a_pending_password_sign_in(self):
        challenge_id = self.client.post(
            '/api/auth/login/', {'email': self.staff.email, 'password': PASSWORD}, format='json', **BROWSER,
        ).data['challenge_id']
        code = CODE_RE.search(self.run_command('Staff@Example.com')).group(1)
        response = self.client.post(
            '/api/auth/login/verify/', {'challenge_id': challenge_id, 'code': code}, format='json', **BROWSER,
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            AuditLog.objects.filter(action='auth.recovery_code_issued', target_id=str(self.staff.pk)).exists()
        )

    def test_requires_a_pending_password_sign_in(self):
        with self.assertRaises(CommandError):
            self.run_command(self.staff.email)

    def test_refuses_customers_and_unknown_addresses(self):
        User.objects.create_user(email='buyer@example.com', password=PASSWORD)
        for email in ('buyer@example.com', 'nobody@example.com'):
            with self.subTest(email=email), self.assertRaises(CommandError):
                self.run_command(email)
