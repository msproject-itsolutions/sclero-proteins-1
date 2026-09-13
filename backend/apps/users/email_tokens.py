"""Signed, expiring links for email verification and email changes."""
from django.core import signing

EMAIL_LINK_MAX_AGE = 24 * 60 * 60
VERIFY_EMAIL_SALT = 'sclero.verify-email'
EMAIL_CHANGE_SALT = 'sclero.email-change'


class EmailLinkError(Exception):
    pass


def _load(token, salt):
    try:
        data = signing.loads(str(token or ''), salt=salt, max_age=EMAIL_LINK_MAX_AGE)
    except signing.SignatureExpired as exc:
        raise EmailLinkError('This link has expired. Request a new one from your account page.') from exc
    except signing.BadSignature as exc:
        raise EmailLinkError('This link is not valid.') from exc
    if not isinstance(data, dict):
        raise EmailLinkError('This link is not valid.')
    return data


def make_verify_email_token(user):
    return signing.dumps({'u': user.pk, 'e': user.email.lower()}, salt=VERIFY_EMAIL_SALT)


def read_verify_email_token(token):
    data = _load(token, VERIFY_EMAIL_SALT)
    return {'user_id': data.get('u'), 'email': data.get('e', '')}


def make_email_change_token(user, new_email):
    # The auth_version pins the link to the account's current state: confirming
    # bumps it, so each link works once, and a password change or
    # sign-out-everywhere cancels links already sent.
    return signing.dumps({'u': user.pk, 'e': new_email, 'v': user.auth_version}, salt=EMAIL_CHANGE_SALT)


def read_email_change_token(token):
    data = _load(token, EMAIL_CHANGE_SALT)
    return {'user_id': data.get('u'), 'email': data.get('e', ''), 'auth_version': data.get('v')}
