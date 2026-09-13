"""Print a one-time staff sign-in code when email delivery is down.

The staff member first enters their email and password, which creates a
pending STAFF_2FA challenge; an operator with shell access on the server then
runs this command and reads them the code. The password step is never skipped.
Before reading the code out, the operator checks with the staff member that the
pending sign-in's time and IP address are theirs.
"""
from datetime import timezone as dt_timezone

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from apps.audit.recorder import record_audit
from apps.users.challenges import CODE_TTL, latest_open_challenge, rotate_code
from apps.users.models import LoginChallenge
from apps.users.permissions import is_staff_account


class Command(BaseCommand):
    help = "Print a fresh code for a staff member's pending password sign-in."

    def add_arguments(self, parser):
        parser.add_argument('email')

    def handle(self, *args, **options):
        email = options['email'].strip()
        user = get_user_model().objects.filter(email__iexact=email).first()
        if user is None or not user.is_active or not is_staff_account(user):
            raise CommandError(f'No active staff account for {email}.')
        challenge = latest_open_challenge(user, LoginChallenge.Purpose.STAFF_2FA)
        if challenge is None:
            raise CommandError(
                'No pending sign-in. Ask them to enter their email and password first, then run this again.'
            )
        code = rotate_code(challenge)
        record_audit(
            'auth.recovery_code_issued', target_type='User', target_id=user.pk,
            summary=f'Recovery sign-in code issued on the server for {user.email}',
            changes={'challenge': str(challenge.pk)},
        )
        started = challenge.created_at.astimezone(dt_timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
        minutes = int(CODE_TTL.total_seconds() // 60)
        self.stdout.write(
            f'Pending sign-in for {user.email} started {started} from IP {challenge.created_ip or "unknown"}.\n'
            'Confirm with the staff member that this sign-in is theirs before reading them the code.'
        )
        self.stdout.write(f'Sign-in code for {user.email}: {code} (valid {minutes} minutes, single use)')
