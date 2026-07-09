from django.core.management.base import BaseCommand
from apps.users.email_sync import sync_support_emails

class Command(BaseCommand):
    help = 'Connects to IMAP mailbox to pull incoming customer support emails and convert them to SupportTickets.'

    def handle(self, *args, **options):
        self.stdout.write("Connecting to support IMAP server...")
        res = sync_support_emails()
        if res.get('status') == 'success':
            created = res.get('tickets_created', 0)
            self.stdout.write(self.style.SUCCESS(f"Successfully synced inbox. Created {created} support tickets."))
        else:
            self.stdout.write(self.style.ERROR(f"Sync failed: {res.get('message')}"))
