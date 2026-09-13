from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APITestCase

from apps.audit.models import AuditLog
from apps.regions.models import Region
from apps.users.models import Role
from apps.users.serializers import RoleSerializer
from apps.users.sessions import issue_tokens

User = get_user_model()
PASSWORD = 'Str0ng-pass-123'
STAFF_URL = '/api/admin/staff/'
ROLES_URL = '/api/admin/roles/'


class EditorTestCase(APITestCase):
    def setUp(self):
        self.admin_role = Role.objects.get(name='Admin')
        self.staff_role = Role.objects.get(name='Staff')
        self.access_role = Role.objects.create(name='Access manager', permissions=['rbac.manage'])
        self.owner = User.objects.create_superuser(email='owner@example.com', password=PASSWORD)
        self.manager = User.objects.create_user(email='manager@example.com', password=PASSWORD, is_staff=True)
        self.manager.roles.add(self.access_role)
        self.member = User.objects.create_user(email='member@example.com', password=PASSWORD, is_staff=True)
        self.member.roles.add(self.staff_role)
        self.region = Region.objects.create(
            code='UK', name='United Kingdom', domain='staff-admin.example.test',
            currency_code='GBP', currency_symbol='£', tax_name='VAT', tax_rate='20.00',
        )

    def patch(self, actor, target, data):
        self.client.force_authenticate(actor)
        return self.client.patch(f'{STAFF_URL}{target.pk}/', data, format='json')


class StaffEditorTests(EditorTestCase):
    def test_password_is_hashed_and_ends_sessions(self):
        response = self.patch(self.manager, self.member, {'password': 'Brand-new-pass-42'})
        self.assertEqual(response.status_code, 200, response.data)
        self.member.refresh_from_db()
        self.assertNotEqual(self.member.password, 'Brand-new-pass-42')
        self.assertTrue(self.member.check_password('Brand-new-pass-42'))
        self.assertEqual(self.member.auth_version, 1)
        audit = AuditLog.objects.get(action='staff.updated', target_id=str(self.member.pk))
        self.assertIs(audit.changes['credentials_reset'], True)

    def test_actor_cannot_change_their_own_access(self):
        for data in (
            {'roles': [self.access_role.pk, self.staff_role.pk]},
            {'assigned_regions': [self.region.pk]},
            {'verification_email': 'me@elsewhere.example'},
            {'allowed_ip_range': '10.0.0.0/8'},
        ):
            with self.subTest(field=next(iter(data))):
                with self.assertLogs('django.request', 'WARNING'):
                    response = self.patch(self.manager, self.manager, data)
                self.assertEqual(response.status_code, 400)
                self.assertIn(next(iter(data)), response.json())

    def test_resending_unchanged_values_for_yourself_is_allowed(self):
        response = self.patch(self.manager, self.manager, {
            'first_name': 'Mia', 'roles': [self.access_role.pk], 'assigned_regions': [], 'allowed_ip_range': '',
        })
        self.assertEqual(response.status_code, 200, response.data)

    def test_only_superusers_grant_admin_level_roles(self):
        for role in (self.admin_role, self.access_role):
            with self.subTest(role=role.name):
                with self.assertLogs('django.request', 'WARNING'):
                    response = self.patch(self.manager, self.member, {'roles': [role.pk]})
                self.assertEqual(response.status_code, 400)
        self.assertEqual(self.patch(self.manager, self.member, {'roles': [self.staff_role.pk]}).status_code, 200)
        self.assertEqual(self.patch(self.owner, self.member, {'roles': [self.admin_role.pk]}).status_code, 200)

    def test_creating_an_admin_needs_a_superuser(self):
        self.client.force_authenticate(self.manager)
        with self.assertLogs('django.request', 'WARNING'):
            response = self.client.post(STAFF_URL, {
                'email': 'new-admin@example.com', 'password': 'Brand-new-pass-42', 'roles': [self.admin_role.pk],
            }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(email='new-admin@example.com').exists())

    def test_administrator_accounts_are_off_limits_to_other_staff(self):
        other_admin = User.objects.create_user(email='other-admin@example.com', password=PASSWORD, is_staff=True)
        other_admin.roles.add(self.admin_role)
        with self.assertLogs('django.request', 'WARNING'):
            response = self.patch(self.manager, self.owner, {'first_name': 'Nope'})
        self.assertEqual(response.status_code, 403)
        with self.assertLogs('django.request', 'WARNING'):
            response = self.patch(self.manager, other_admin, {'verification_email': 'x@evil.example'})
        self.assertEqual(response.status_code, 403)
        self.client.force_authenticate(self.manager)
        with self.assertLogs('django.request', 'WARNING'):
            response = self.client.delete(f'{STAFF_URL}{self.owner.pk}/')
        self.assertEqual(response.status_code, 403)
        self.assertTrue(User.objects.filter(pk=self.owner.pk).exists())

    def test_role_and_region_changes_end_sessions_and_are_audited(self):
        tokens = issue_tokens(self.member)
        response = self.patch(self.manager, self.member, {'assigned_regions': [self.region.pk]})
        self.assertEqual(response.status_code, 200, response.data)
        self.member.refresh_from_db()
        self.assertEqual(self.member.auth_version, 1)
        audit = AuditLog.objects.filter(action='staff.updated', target_id=str(self.member.pk)).latest('created_at')
        self.assertEqual(audit.changes['assigned_regions'], [[], ['UK']])
        self.client.force_authenticate(None)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {tokens["access"]}')
        with self.assertLogs('django.request', 'WARNING'):
            response = self.client.get('/api/auth/profile/')
        self.assertEqual(response.status_code, 401)

    def test_role_change_ends_the_members_sessions_but_not_the_actors(self):
        packer_role = Role.objects.create(name='Packer', permissions=['orders.view'])
        actor_version = self.manager.auth_version
        response = self.patch(self.manager, self.member, {'roles': [packer_role.pk]})
        self.assertEqual(response.status_code, 200, response.data)
        self.member.refresh_from_db()
        self.manager.refresh_from_db()
        self.assertEqual(list(self.member.roles.values_list('name', flat=True)), ['Packer'])
        self.assertEqual(self.member.auth_version, 1)
        self.assertEqual(self.manager.auth_version, actor_version)
        audit = AuditLog.objects.filter(action='staff.updated', target_id=str(self.member.pk)).latest('created_at')
        self.assertEqual(audit.changes['roles'], [['Staff'], ['Packer']])

    def test_deactivation_ends_sessions(self):
        self.assertEqual(self.patch(self.manager, self.member, {'is_active': False}).status_code, 200)
        self.member.refresh_from_db()
        self.assertEqual(self.member.auth_version, 1)

    def test_a_name_change_keeps_sessions(self):
        self.assertEqual(self.patch(self.manager, self.member, {'first_name': 'Renamed'}).status_code, 200)
        self.member.refresh_from_db()
        self.assertEqual(self.member.auth_version, 0)

    def test_staff_cannot_delete_themselves(self):
        self.client.force_authenticate(self.manager)
        with self.assertLogs('django.request', 'WARNING'):
            response = self.client.delete(f'{STAFF_URL}{self.manager.pk}/')
        self.assertEqual(response.status_code, 400)

    def test_actor_cannot_change_their_own_email(self):
        with self.assertLogs('django.request', 'WARNING'):
            response = self.patch(self.manager, self.manager, {'email': 'attacker@example.com'})
        self.assertEqual(response.status_code, 400)
        self.assertIn('email', response.json())
        self.manager.refresh_from_db()
        self.assertEqual(self.manager.email, 'manager@example.com')

    def test_resending_own_email_in_a_different_case_is_allowed(self):
        self.manager.email = 'Manager@Example.com'
        self.manager.save()
        response = self.patch(self.manager, self.manager, {'email': 'MANAGER@EXAMPLE.COM'})
        self.assertEqual(response.status_code, 200, response.data)

    def test_actor_cannot_change_their_own_password(self):
        with self.assertLogs('django.request', 'WARNING'):
            response = self.patch(self.manager, self.manager, {'password': 'Brand-new-pass-99'})
        self.assertEqual(response.status_code, 400)
        self.assertIn('password', response.json())
        self.assertTrue(self.manager.check_password(PASSWORD))

    def test_another_admin_can_still_change_email_and_password(self):
        response = self.patch(self.manager, self.member, {
            'email': 'member-new@example.com', 'password': 'Brand-new-pass-77',
        })
        self.assertEqual(response.status_code, 200, response.data)
        self.member.refresh_from_db()
        self.assertEqual(self.member.email, 'member-new@example.com')
        self.assertTrue(self.member.check_password('Brand-new-pass-77'))


class RoleEditorTests(EditorTestCase):
    def test_permission_change_is_audited_and_ends_holder_sessions(self):
        packer_role = Role.objects.create(name='Packer', permissions=['orders.view'])
        packer = User.objects.create_user(email='packer@example.com', password=PASSWORD)
        packer.roles.add(packer_role)
        self.client.force_authenticate(self.manager)
        response = self.client.patch(f'{ROLES_URL}{packer_role.pk}/', {
            'permissions': ['orders.view', 'orders.manage'],
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        audit = AuditLog.objects.get(action='role.updated', target_id=str(packer_role.pk))
        self.assertEqual(audit.changes['permissions'], [['orders.view'], ['orders.manage', 'orders.view']])
        packer.refresh_from_db()
        self.assertEqual(packer.auth_version, 1)

    def test_staff_cannot_change_a_role_they_hold(self):
        self.client.force_authenticate(self.manager)
        with self.assertLogs('django.request', 'WARNING'):
            response = self.client.patch(f'{ROLES_URL}{self.access_role.pk}/', {
                'permissions': ['rbac.manage', 'settings.manage'],
            }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_only_superusers_create_access_managing_roles(self):
        payload = {'name': 'Shadow admins', 'permissions': ['rbac.manage']}
        self.client.force_authenticate(self.manager)
        with self.assertLogs('django.request', 'WARNING'):
            response = self.client.post(ROLES_URL, payload, format='json')
        self.assertEqual(response.status_code, 400)
        self.client.force_authenticate(self.owner)
        self.assertEqual(self.client.post(ROLES_URL, payload, format='json').status_code, 201)


class RoleSerializerGuardTests(TestCase):
    def test_validate_permissions_fails_closed_without_a_request(self):
        """A serializer built with no request context (no authenticated actor)
        must not fail open and let rbac.manage through unchecked."""
        serializer = RoleSerializer(data={'name': 'No context', 'permissions': ['rbac.manage']})
        self.assertFalse(serializer.is_valid())
        self.assertIn('permissions', serializer.errors)
