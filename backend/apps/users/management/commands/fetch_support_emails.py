from django.core.management.base import BaseCommand, CommandError
from apps.orders.cron import job_run
from apps.users.email_sync import sync_support_emails

class Command(BaseCommand):
    help = 'Connects to IMAP mailbox to pull incoming customer support emails and convert them to SupportTickets.'

    def handle(self, *args, **options):
        self.stdout.write("Connecting to support IMAP server...")
        with job_run('fetch_support_emails') as result:
            res = sync_support_emails()
            if res.get('status') == 'disabled':
                result.message = res.get('message', 'IMAP sync disabled.')
            elif res.get('status') == 'success':
                result.processed = res.get('tickets_created', 0)
                result.message = f"Created {result.processed} support tickets."
            else:
                raise CommandError(res.get('message', 'IMAP sync failed.'))
        self.stdout.write(self.style.SUCCESS(result.message))
