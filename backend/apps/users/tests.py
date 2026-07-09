from django.contrib.auth.hashers import make_password
from django.test import TestCase

from .serializers import RegisterSerializer
from .views import _new_otp_value, _verify_otp_value


class AuthenticationSafetyTests(TestCase):
    def test_otp_is_hashed_and_verifiable(self):
        code, stored = _new_otp_value()
        self.assertNotIn(code, stored)
        self.assertTrue(_verify_otp_value(stored, code))
        self.assertFalse(_verify_otp_value(stored, '000000'))

    def test_expired_otp_is_rejected(self):
        stored = f'otp:1:{make_password("123456")}'
        self.assertFalse(_verify_otp_value(stored, '123456'))

    def test_registration_uses_django_password_policy(self):
        serializer = RegisterSerializer(data={
            'email': 'customer@example.com',
            'password': 'password',
            'first_name': 'Test',
            'last_name': 'Customer',
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('password', serializer.errors)


from unittest.mock import MagicMock, patch
from apps.users.email_sync import clean_header, parse_sender_email, sync_support_emails
from apps.users.models import SupportTicket

class EmailSyncTests(TestCase):
    def test_clean_header_decodes_correctly(self):
        self.assertEqual(clean_header("Hello World"), "Hello World")
        self.assertEqual(clean_header("=?utf-8?q?Hello_World?="), "Hello World")

    def test_parse_sender_email(self):
        self.assertEqual(parse_sender_email("Support <support@scleroproteins.co.uk>"), "support@scleroproteins.co.uk")
        self.assertEqual(parse_sender_email("support@scleroproteins.co.uk"), "support@scleroproteins.co.uk")

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
