import os
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APITestCase

from apps.users.email_sync import clean_header, parse_sender_email, sync_support_emails
from apps.users.models import SupportTicket
from .serializers import RegisterSerializer, StaffUserSerializer, UserAddressSerializer

User = get_user_model()


class AuthenticationSafetyTests(TestCase):
    def test_registration_uses_django_password_policy(self):
        serializer = RegisterSerializer(data={
            'email': 'customer@example.com',
            'password': 'password',
            'first_name': 'Test',
            'last_name': 'Customer',
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('password', serializer.errors)

    def test_registration_rejects_whitespace_only_names(self):
        serializer = RegisterSerializer(data={
            'email': 'customer@example.com',
            'password': 'StrongCustomerPass123!',
            'first_name': '   ',
            'last_name': 'Customer',
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('first_name', serializer.errors)

    def test_staff_creation_uses_django_password_policy(self):
        serializer = StaffUserSerializer(data={
            'email': 'staff@example.com',
            'password': 'password',
            'first_name': 'Test',
            'last_name': 'Staff',
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('password', serializer.errors)

    def test_address_rejects_whitespace_and_invalid_phone(self):
        serializer = UserAddressSerializer(data={
            'full_name': '   ',
            'phone_number': 'call-me',
            'address_line1': '1 Test Street',
            'city': 'London',
            'state': 'London',
            'postal_code': 'SW1A 1AA',
            'country': 'GB',
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('full_name', serializer.errors)


class AuthCookieTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email='cookie-user@example.com', password='StrongCookiePass123!',
            first_name='Cookie', last_name='User',
        )

    def test_tokens_are_httponly_and_cookie_session_authenticates(self):
        response = self.client.post('/api/auth/login/', {
            'email': self.user.email, 'password': 'StrongCookiePass123!',
        }, format='json', HTTP_X_SCLERO_CLIENT='storefront')

        self.assertEqual(response.status_code, 200)
        self.assertNotIn('access', response.data)
        self.assertNotIn('refresh', response.data)
        self.assertTrue(response.data['authenticated'])
        self.assertTrue(response.cookies['sclero_access']['httponly'])
        self.assertTrue(response.cookies['sclero_refresh']['httponly'])

        profile = self.client.get('/api/auth/profile/')
        self.assertEqual(profile.status_code, 200)
        self.assertEqual(profile.data['email'], self.user.email)

    def test_cookie_refresh_requires_browser_header_and_rotates(self):
        self.client.post('/api/auth/login/', {
            'email': self.user.email, 'password': 'StrongCookiePass123!',
        }, format='json', HTTP_X_SCLERO_CLIENT='storefront')

        rejected = self.client.post('/api/auth/token/refresh/', {}, format='json')
        accepted = self.client.post(
            '/api/auth/token/refresh/', {}, format='json', HTTP_X_SCLERO_CLIENT='storefront',
        )

        self.assertEqual(rejected.status_code, 400)
        self.assertEqual(accepted.status_code, 200)
        self.assertNotIn('access', accepted.data)
        self.assertTrue(accepted.data['authenticated'])

    def test_logout_blacklists_refresh_and_clears_cookies(self):
        self.client.post('/api/auth/login/', {
            'email': self.user.email, 'password': 'StrongCookiePass123!',
        }, format='json', HTTP_X_SCLERO_CLIENT='storefront')
        response = self.client.post('/api/auth/logout/', {}, format='json', HTTP_X_SCLERO_CLIENT='storefront')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.cookies['sclero_access']['max-age'], 0)
        self.assertEqual(response.cookies['sclero_refresh']['max-age'], 0)


class EmailSyncTests(TestCase):
    def test_clean_header_decodes_correctly(self):
        self.assertEqual(clean_header("Hello World"), "Hello World")
        self.assertEqual(clean_header("=?utf-8?q?Hello_World?="), "Hello World")

    def test_parse_sender_email(self):
        self.assertEqual(parse_sender_email("Support <support@scleroproteins.co.uk>"), "support@scleroproteins.co.uk")
        self.assertEqual(parse_sender_email("support@scleroproteins.co.uk"), "support@scleroproteins.co.uk")

    @patch.dict(os.environ, {'IMAP_USER': 'support@example.com', 'IMAP_PASSWORD': 'test-only'})
    @patch('imaplib.IMAP4_SSL')
    def test_sync_support_emails_success(self, mock_imap_cls):
        mock_imap = MagicMock()
        mock_imap_cls.return_value = mock_imap
        mock_imap.search.return_value = ('OK', [b'1 2'])
        
        msg_1 = (
            b'From: Customer A <custA@example.com>\r\n'
            b'Subject: Issue with order\r\n'
            b'Content-Type: text/plain\r\n\r\n'
            b'My package was damaged.'
        )
        msg_2 = (
            b'From: custB@example.com\r\n'
            b'Subject: Wholesale query\r\n'
            b'Content-Type: text/html\r\n\r\n'
            b'<p>Hello wholesale</p>'
        )

        mock_imap.fetch.side_effect = lambda msg_id, query: (
            ('OK', [(None, msg_1)]) if msg_id == b'1' else (('OK', [(None, msg_2)]) if msg_id == b'2' else ('ERROR', []))
        )

        res = sync_support_emails()
        self.assertEqual(res['status'], 'success')
        self.assertEqual(res['tickets_created'], 2)

        ticket_1 = SupportTicket.objects.get(email='custA@example.com')
        self.assertEqual(ticket_1.subject, 'Issue with order')
        self.assertEqual(ticket_1.message, 'My package was damaged.')

        ticket_2 = SupportTicket.objects.get(email='custB@example.com')
        self.assertEqual(ticket_2.subject, 'Wholesale query')
        self.assertEqual(ticket_2.message, '<p>Hello wholesale</p>')
