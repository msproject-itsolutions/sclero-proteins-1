from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from apps.audit.models import AuditLog
from apps.users.models import Role

User = get_user_model()
PASSWORD = 'Str0ng-pass-123'


class ProfileRestrictionTests(APITestCase):
    def setUp(self):
        self.customer = User.objects.create_user(email='buyer@example.com', password=PASSWORD)

    def test_email_and_ip_allow_list_cannot_be_self_edited(self):
        self.client.force_authenticate(self.customer)
        response = self.client.patch('/api/auth/profile/', {
            'email': 'someone-else@example.com', 'allowed_ip_range': '0.0.0.0/0', 'first_name': 'Changed',
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.customer.refresh_from_db()
        self.assertEqual(self.customer.email, 'buyer@example.com')
        self.assertEqual(self.customer.allowed_ip_range, '')
        self.assertEqual(self.customer.first_name, 'Changed')

    def test_staff_cannot_switch_their_sign_in_code_setting(self):
        staff = User.objects.create_user(email='staff@example.com', password=PASSWORD, is_staff=True)
        self.client.force_authenticate(staff)
        with self.assertLogs('django.request', 'WARNING'):
            response = self.client.patch('/api/auth/profile/', {'two_factor_enabled': True}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('two_factor_enabled', response.data)

    def test_customer_can_turn_on_two_step_and_it_is_audited(self):
        self.client.force_authenticate(self.customer)
        response = self.client.patch('/api/auth/profile/', {'two_factor_enabled': True}, format='json')
        self.assertEqual(response.status_code, 200)
        audit = AuditLog.objects.get(action='profile.updated', target_id=str(self.customer.pk))
        self.assertEqual(audit.changes['two_factor_enabled'], [False, True])

    def test_two_step_needs_a_password(self):
        passwordless = User.objects.create_user(email='codeonly@example.com', password=None)
        self.client.force_authenticate(passwordless)
        with self.assertLogs('django.request', 'WARNING'):
            response = self.client.patch('/api/auth/profile/', {'two_factor_enabled': True}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_profile_reports_verification_and_password_state(self):
        self.client.force_authenticate(self.customer)
        data = self.client.get('/api/auth/profile/').data
        self.assertIs(data['email_verified'], False)
        self.assertIs(data['has_password'], True)


class CustomerDirectoryTests(APITestCase):
    def setUp(self):
        support = Role.objects.create(name='Support desk', permissions=['users.manage'])
        self.agent = User.objects.create_user(email='agent@example.com', password=PASSWORD, is_staff=True)
        self.agent.roles.add(support)
        self.customer = User.objects.create_user(email='buyer@example.com', password=PASSWORD)
        self.staff = User.objects.create_user(email='staff@example.com', password=PASSWORD, is_staff=True)
        self.role_holder = User.objects.create_user(email='packer@example.com', password=PASSWORD)
        self.role_holder.roles.add(Role.objects.get(name='Staff'))
        self.client.force_authenticate(self.agent)

    def test_staff_accounts_are_not_listed_or_reachable(self):
        listed = {row['email'] for row in self.client.get('/api/admin/customers/').data['results']}
        self.assertEqual(listed, {'buyer@example.com'})
        for account in (self.staff, self.role_holder, self.agent):
            with self.subTest(account=account.email):
                with self.assertLogs('django.request', 'WARNING'):
                    get_response = self.client.get(f'/api/admin/customers/{account.pk}/')
                self.assertEqual(get_response.status_code, 404)
                with self.assertLogs('django.request', 'WARNING'):
                    response = self.client.patch(f'/api/admin/customers/{account.pk}/', {'first_name': 'X'}, format='json')
                self.assertEqual(response.status_code, 404)

    def test_customers_cannot_be_deleted_here(self):
        with self.assertLogs('django.request', 'WARNING'):
            response = self.client.delete(f'/api/admin/customers/{self.customer.pk}/')
        self.assertEqual(response.status_code, 405)
        self.assertTrue(User.objects.filter(pk=self.customer.pk).exists())

    def test_email_changes_are_refused_but_other_edits_work(self):
        url = f'/api/admin/customers/{self.customer.pk}/'
        with self.assertLogs('django.request', 'WARNING'):
            refused = self.client.put(url, {'email': 'other@example.com', 'first_name': 'Bea', 'last_name': 'Buyer'}, format='json')
        self.assertEqual(refused.status_code, 400)
        self.assertIn('email', refused.data)
        accepted = self.client.put(url, {'email': 'buyer@example.com', 'first_name': 'Bea', 'last_name': 'Buyer'}, format='json')
        self.assertEqual(accepted.status_code, 200, accepted.data)
        audit = AuditLog.objects.get(action='customer.updated', target_id=str(self.customer.pk))
        self.assertEqual(audit.changes['first_name'], ['', 'Bea'])

    def test_customers_created_here_have_no_password(self):
        response = self.client.post('/api/admin/customers/', {
            'email': 'Walk-In@Example.com', 'first_name': 'Walk', 'last_name': 'In',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        created = User.objects.get(email='walk-in@example.com')
        self.assertFalse(created.has_usable_password())
        self.assertFalse(created.is_staff)
