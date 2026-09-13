from io import StringIO

from django.contrib.auth import get_user_model
from django.core.exceptions import FieldDoesNotExist
from django.core.management import call_command
from django.test import SimpleTestCase
from rest_framework.test import APITestCase

User = get_user_model()


class TotpRemovalTests(APITestCase):
    def test_authenticator_endpoints_are_gone(self):
        self.client.force_authenticate(User.objects.create_user(email='buyer@example.com', password='Str0ng-pass-123'))
        for path in ('/api/auth/2fa/status/', '/api/auth/2fa/setup/', '/api/auth/2fa/verify/', '/api/auth/2fa/disable/'):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 404)


class UserFieldTests(SimpleTestCase):
    def test_user_has_no_totp_or_overloaded_otp_fields(self):
        for name in ('totp_secret', 'totp_enabled', 'totp_backup_codes', 'otp_secret'):
            with self.subTest(field=name), self.assertRaises(FieldDoesNotExist):
                User._meta.get_field(name)


class SelfServiceAuditTests(APITestCase):
    def test_rbac_audit_covers_self_service_account_routes(self):
        out = StringIO()
        call_command('audit_rbac', '--strict', stdout=out)
        report = out.getvalue()
        self.assertIn('api/auth/password/change/', report)
        self.assertIn('api/auth/profile/terminate-devices/', report)
        self.assertNotIn('api/auth/2fa/', report)
