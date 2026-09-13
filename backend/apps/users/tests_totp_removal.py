import importlib.util
import re
from io import StringIO
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APITestCase

User = get_user_model()
# Columns P1-B added to the user table. Code from the release before it does
# not know them.
NEW_IN_P1B = ('auth_version', 'email_verified', 'verification_email')


class TotpRemovalTests(APITestCase):
    def test_authenticator_endpoints_are_gone(self):
        self.client.force_authenticate(User.objects.create_user(email='buyer@example.com', password='Str0ng-pass-123'))
        for path in ('/api/auth/2fa/status/', '/api/auth/2fa/setup/', '/api/auth/2fa/verify/', '/api/auth/2fa/disable/'):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 404)


class TotpCodeRemovalTests(SimpleTestCase):
    def test_totp_module_is_gone(self):
        self.assertIsNone(importlib.util.find_spec('apps.users.totp'))

    def test_authenticator_libraries_are_not_required(self):
        requirements = (Path(settings.BASE_DIR) / 'requirements.txt').read_text(encoding='utf-8')
        names = {re.split(r'[<>=!~\[;\s]', line.strip(), maxsplit=1)[0].lower() for line in requirements.splitlines()}
        self.assertNotIn('pyotp', names)
        self.assertNotIn('qrcode', names)


class RollbackSafetyTests(TestCase):
    def test_code_from_the_previous_release_can_still_create_users(self):
        """The installer's image rollback runs the previous release against
        the migrated schema. That code inserts users with exactly its own
        columns (the unused TOTP ones included), so the columns P1-B added
        need database defaults."""
        old_columns = [
            field for field in User._meta.concrete_fields
            if not field.primary_key and field.name not in NEW_IN_P1B
        ]
        # The same INSERT Model.save() builds, restricted to the old columns.
        User._base_manager._insert([User(email='rolled-back@example.com', password='!')], fields=old_columns)
        row = User.objects.values(*NEW_IN_P1B).get(email='rolled-back@example.com')
        self.assertEqual(row, {'auth_version': 0, 'email_verified': False, 'verification_email': ''})
        self.assertTrue(
            {'otp_secret', 'totp_secret', 'totp_enabled', 'totp_backup_codes'} <= {f.name for f in old_columns}
        )


class SelfServiceAuditTests(APITestCase):
    def test_rbac_audit_covers_self_service_account_routes(self):
        out = StringIO()
        call_command('audit_rbac', '--strict', stdout=out)
        report = out.getvalue()
        self.assertIn('api/auth/password/change/', report)
        self.assertIn('api/auth/profile/terminate-devices/', report)
        self.assertNotIn('api/auth/2fa/', report)
