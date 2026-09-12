from django.contrib.auth import get_user_model
from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, override_settings
from rest_framework.test import APITestCase

from apps.users.models import Role
from apps.users.permissions import is_staff_account
from sclero_backend.config_checks import require_rbac_enforced

User = get_user_model()
AUDIT_LOGS_URL = '/api/admin/audit-logs/'


class HasPermissionTests(APITestCase):
    def setUp(self):
        self.customer = User.objects.create_user(email='customer@example.com', password='Str0ng-pass-123')
        self.staff = User.objects.create_user(
            email='staff@example.com', password='Str0ng-pass-123', is_staff=True,
        )
        auditor_role = Role.objects.create(name='Auditor', permissions=['audit.view'])
        self.auditor = User.objects.create_user(email='auditor@example.com', password='Str0ng-pass-123')
        self.auditor.roles.add(auditor_role)

    def test_anonymous_is_rejected_even_when_rbac_is_disabled(self):
        with override_settings(RBAC_ENFORCED=False):
            response = self.client.get(AUDIT_LOGS_URL)
        self.assertIn(response.status_code, (401, 403))

    def test_customer_is_rejected_when_rbac_is_disabled(self):
        self.client.force_authenticate(self.customer)
        with override_settings(RBAC_ENFORCED=False):
            response = self.client.get(AUDIT_LOGS_URL)
        self.assertEqual(response.status_code, 403)

    def test_staff_account_passes_when_rbac_is_disabled(self):
        self.client.force_authenticate(self.staff)
        with override_settings(RBAC_ENFORCED=False):
            response = self.client.get(AUDIT_LOGS_URL)
        self.assertEqual(response.status_code, 200)

    def test_role_permission_is_required_when_rbac_is_enforced(self):
        self.client.force_authenticate(self.staff)
        self.assertEqual(self.client.get(AUDIT_LOGS_URL).status_code, 403)
        self.client.force_authenticate(self.auditor)
        self.assertEqual(self.client.get(AUDIT_LOGS_URL).status_code, 200)

    def test_ip_allow_list_applies_to_permission_checks(self):
        self.auditor.allowed_ip_range = '10.0.0.0/8'
        self.auditor.save(update_fields=['allowed_ip_range'])
        self.client.force_authenticate(self.auditor)
        response = self.client.get(AUDIT_LOGS_URL, REMOTE_ADDR='203.0.113.5')
        self.assertEqual(response.status_code, 403)


class StaffAccountTests(APITestCase):
    def test_staff_flag_superuser_and_role_holders_are_staff(self):
        role = Role.objects.create(name='Packer', permissions=['orders.view'])
        role_holder = User.objects.create_user(email='packer@example.com', password='x')
        role_holder.roles.add(role)
        superuser = User.objects.create_superuser(email='owner@example.com', password='x')
        flagged = User.objects.create_user(email='flag@example.com', password='x', is_staff=True)
        customer = User.objects.create_user(email='buyer@example.com', password='x')

        self.assertTrue(is_staff_account(role_holder))
        self.assertTrue(is_staff_account(superuser))
        self.assertTrue(is_staff_account(flagged))
        self.assertFalse(is_staff_account(customer))
        self.assertFalse(is_staff_account(None))


class RbacConfigGuardTests(SimpleTestCase):
    def test_production_refuses_disabled_rbac(self):
        with self.assertRaises(ImproperlyConfigured):
            require_rbac_enforced(debug=False, building_static=False, rbac_enforced=False)

    def test_debug_and_static_builds_may_disable_rbac(self):
        require_rbac_enforced(debug=True, building_static=False, rbac_enforced=False)
        require_rbac_enforced(debug=False, building_static=True, rbac_enforced=False)
        require_rbac_enforced(debug=False, building_static=False, rbac_enforced=True)
