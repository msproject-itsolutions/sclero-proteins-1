from io import StringIO
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase

from apps.admin_dashboard.models import SystemSetting
from apps.orders.models import CronJobRun
from apps.users.email_sync import sync_support_emails


class SupportEmailSyncTests(TestCase):
    def setUp(self):
        SystemSetting.objects.update_or_create(
            key='IMAP_SETTINGS',
            defaults={'value': {'IMAP_ENABLED': False}},
        )

    @patch('apps.users.email_sync.imaplib.IMAP4_SSL')
    def test_disabled_sync_never_connects_to_mailbox(self, imap_connection):
        result = sync_support_emails()
        self.assertEqual(result['status'], 'disabled')
        imap_connection.assert_not_called()

    def test_scheduler_command_records_disabled_run(self):
        output = StringIO()
        call_command('fetch_support_emails', stdout=output)
        run = CronJobRun.objects.get(job_name='fetch_support_emails')
        self.assertEqual(run.status, 'SUCCESS')
        self.assertIn('disabled', run.message.lower())
