"""Emailed sign-in codes and links (LoginChallenge).

A challenge completes a sign-in: after a correct password for staff and for
customers with two-step sign-in, or on its own for passwordless sign-in. The
secret travels only by email; the database keeps a keyed hash. Each challenge
allows MAX_ATTEMPTS wrong guesses before it is destroyed, on top of IP throttles.
"""
import logging
import math
import secrets
import uuid
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from django.utils.crypto import constant_time_compare, salted_hmac

from apps.audit.recorder import record_audit

from .auth_emails import send_code_email, send_magic_link_email
from .models import LoginChallenge
from .permissions import is_staff_account

logger = logging.getLogger(__name__)

CODE_TTL = timedelta(minutes=10)
MAGIC_LINK_TTL = timedelta(minutes=15)
MAX_ATTEMPTS = 5
RESEND_COOLDOWN = timedelta(seconds=60)
MAX_SENDS = 5
PASSWORDLESS_HOURLY_LIMIT = 5
PURGE_AFTER = timedelta(days=1)
SECOND_FACTOR_PURPOSES = (LoginChallenge.Purpose.STAFF_2FA, LoginChallenge.Purpose.CUSTOMER_2FA)
PASSWORDLESS_PURPOSES = (LoginChallenge.Purpose.EMAIL_LOGIN, LoginChallenge.Purpose.MAGIC_LINK)
SECOND_FACTOR_REQUIRED_MESSAGE = 'This account signs in with password and email code.'

_MESSAGES = {
    'invalid': 'This code is no longer valid. Please sign in again.',
    'expired': 'This code has expired. Please sign in again.',
    'locked': 'Too many incorrect codes. Please sign in again.',
    'mismatch': 'That code is not correct.',
    'cooldown': 'Please wait before requesting another code.',
    'send_limit': 'Too many codes were requested. Please sign in again.',
    'rate_limited': 'Too many sign-in emails were requested for this address. Try again later.',
}


class ChallengeError(Exception):
    def __init__(self, code, *, attempts_remaining=None, retry_after=None):
        super().__init__(_MESSAGES[code])
        self.code = code
        self.message = _MESSAGES[code]
        self.attempts_remaining = attempts_remaining
        self.retry_after = retry_after

    def as_response_data(self):
        data = {'detail': self.message, 'code': self.code}
        if self.attempts_remaining is not None:
            data['attempts_remaining'] = self.attempts_remaining
        if self.retry_after is not None:
            data['retry_after'] = self.retry_after
        return data


class ChallengeDeliveryError(Exception):
    """The email carrying the code or link could not be sent."""


def requires_second_factor(user):
    return is_staff_account(user) or bool(user.two_factor_enabled)


def mask_email(address):
    local, _, domain = (address or '').partition('@')
    if not local or not domain:
        return '***'
    name, dot, tld = domain.rpartition('.')
    masked_domain = f'{name[0]}***{dot}{tld}' if name else f'{tld[0]}***'
    return f'{local[0]}***@{masked_domain}'


def hash_secret(challenge_id, secret):
    return salted_hmac('sclero.login-challenge', f'{challenge_id}:{secret}', algorithm='sha256').hexdigest()


def generate_code():
    return f'{secrets.randbelow(1_000_000):06d}'


def destination_for(user, email):
    """Staff codes go to the administrator-set verification address when there is one."""
    if user is not None:
        return user.verification_email or user.email
    return email


def _minutes(ttl):
    return int(ttl.total_seconds() // 60)


def _create(*, purpose, email, user, ip, ttl, secret):
    now = timezone.now()
    LoginChallenge.objects.filter(expires_at__lt=now - PURGE_AFTER).delete()
    challenge = LoginChallenge(
        user=user, email=email, purpose=purpose, sent_to=destination_for(user, email),
        expires_at=now + ttl, last_sent_at=now, created_ip=ip,
    )
    challenge.code_hash = hash_secret(challenge.id, secret)
    challenge.save()
    return challenge


def enforce_passwordless_limit(email):
    recent = LoginChallenge.objects.filter(
        email__iexact=email, purpose__in=PASSWORDLESS_PURPOSES,
        created_at__gte=timezone.now() - timedelta(hours=1),
    ).count()
    if recent >= PASSWORDLESS_HOURLY_LIMIT:
        raise ChallengeError('rate_limited')


def issue_code_challenge(*, purpose, email, user=None, ip=None):
    code = generate_code()
    challenge = _create(purpose=purpose, email=email, user=user, ip=ip, ttl=CODE_TTL, secret=code)
    try:
        send_code_email(challenge.sent_to, code, purpose, minutes=_minutes(CODE_TTL))
    except Exception as exc:
        logger.exception('Could not email a %s sign-in code.', purpose)
        challenge.delete()
        raise ChallengeDeliveryError(str(exc)) from exc
    return challenge, code


def issue_magic_link(*, email, link_base, user=None, ip=None):
    secret = secrets.token_urlsafe(32)
    challenge = _create(
        purpose=LoginChallenge.Purpose.MAGIC_LINK, email=email, user=user, ip=ip,
        ttl=MAGIC_LINK_TTL, secret=secret,
    )
    link = f'{link_base}/auth/magic?token={challenge.id.hex}.{secret}'
    try:
        send_magic_link_email(challenge.sent_to, link)
    except Exception as exc:
        logger.exception('Could not email a sign-in link.')
        challenge.delete()
        raise ChallengeDeliveryError(str(exc)) from exc
    return challenge, link


def _parse_uuid(value):
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError, AttributeError):
        return None


def _check_secret(challenge_id, secret, *, purposes):
    """Validate `secret` against a challenge; consumes the challenge on success."""
    challenge_uuid = _parse_uuid(challenge_id)
    if challenge_uuid is None:
        raise ChallengeError('invalid')
    now = timezone.now()
    failure = None
    with transaction.atomic():
        challenge = (
            LoginChallenge.objects.select_for_update()
            .filter(pk=challenge_uuid, purpose__in=purposes)
            .first()
        )
        if challenge is None or challenge.consumed_at is not None:
            raise ChallengeError('invalid')
        if challenge.expires_at <= now:
            raise ChallengeError('expired')
        if challenge.attempts >= MAX_ATTEMPTS:
            raise ChallengeError('locked')
        if constant_time_compare(challenge.code_hash, hash_secret(challenge.pk, secret)):
            challenge.consumed_at = now
            challenge.save(update_fields=['consumed_at'])
        else:
            challenge.attempts += 1
            remaining = MAX_ATTEMPTS - challenge.attempts
            if remaining <= 0:
                challenge.consumed_at = now
            challenge.save(update_fields=['attempts', 'consumed_at'])
            # Raised after the block so the attempt count is committed.
            failure = ChallengeError('locked' if remaining <= 0 else 'mismatch', attempts_remaining=max(remaining, 0))
    if failure is not None:
        if failure.code == 'locked':
            record_audit(
                'login.challenge_locked', actor=challenge.user, target_type='User',
                target_id=challenge.user_id or '',
                summary=f'Sign-in code locked after {MAX_ATTEMPTS} wrong attempts for {challenge.email}',
                changes={'purpose': challenge.purpose, 'challenge': str(challenge.pk)},
            )
        raise failure
    return challenge


def verify_code(challenge_id, code, *, purposes):
    return _check_secret(challenge_id, str(code or '').strip(), purposes=purposes)


def verify_magic_token(token):
    challenge_id, _, secret = str(token or '').partition('.')
    return _check_secret(challenge_id, secret, purposes=(LoginChallenge.Purpose.MAGIC_LINK,))


def rotate_code(challenge):
    """Replace a challenge's code and restart its lifetime; returns the new code."""
    code = generate_code()
    now = timezone.now()
    challenge.code_hash = hash_secret(challenge.pk, code)
    challenge.last_sent_at = now
    challenge.expires_at = now + CODE_TTL
    challenge.send_count += 1
    challenge.save(update_fields=['code_hash', 'last_sent_at', 'expires_at', 'send_count'])
    return code


def resend_code(challenge_id, *, purposes):
    challenge_uuid = _parse_uuid(challenge_id)
    if challenge_uuid is None:
        raise ChallengeError('invalid')
    now = timezone.now()
    with transaction.atomic():
        challenge = (
            LoginChallenge.objects.select_for_update()
            .filter(pk=challenge_uuid, purpose__in=purposes)
            .first()
        )
        if challenge is None or challenge.consumed_at is not None:
            raise ChallengeError('invalid')
        if challenge.expires_at <= now:
            raise ChallengeError('expired')
        wait = (RESEND_COOLDOWN - (now - challenge.last_sent_at)).total_seconds()
        if wait > 0:
            raise ChallengeError('cooldown', retry_after=math.ceil(wait))
        if challenge.send_count >= MAX_SENDS:
            raise ChallengeError('send_limit')
        # Attempts are deliberately kept: a new code must not buy new guesses.
        code = rotate_code(challenge)
    try:
        send_code_email(challenge.sent_to, code, challenge.purpose, minutes=_minutes(CODE_TTL))
    except Exception as exc:
        logger.exception('Could not email a replacement %s sign-in code.', challenge.purpose)
        raise ChallengeDeliveryError(str(exc)) from exc
    return challenge, code


def latest_open_challenge(user, purpose):
    return (
        LoginChallenge.objects.filter(
            user=user, purpose=purpose, consumed_at__isnull=True, expires_at__gt=timezone.now(),
        )
        .order_by('-created_at')
        .first()
    )


def challenge_response_data(challenge, secret=None):
    data = {
        'challenge_required': True,
        'challenge_id': str(challenge.pk),
        'sent_to_masked': mask_email(challenge.sent_to),
        'resend_available_in': int(RESEND_COOLDOWN.total_seconds()),
    }
    if settings.DEBUG and secret:
        data['otp_preview_for_sandbox'] = secret
    return data
