"""Signed newsletter unsubscribe tokens.

An unsubscribe link must prove it came from the subscriber's inbox; a bare
email address would let anyone unsubscribe anyone.
"""
from django.core import signing

UNSUBSCRIBE_SALT = 'sclero.newsletter-unsubscribe'


def make_unsubscribe_token(email):
    return signing.dumps({'e': (email or '').strip().lower()}, salt=UNSUBSCRIBE_SALT)


def email_from_unsubscribe_token(token):
    # JSON bodies can carry any type; only a non-empty string can be a token.
    if not isinstance(token, str) or not token:
        return None
    try:
        data = signing.loads(token, salt=UNSUBSCRIBE_SALT)
    except signing.BadSignature:
        return None
    email = data.get('e') if isinstance(data, dict) else None
    return email or None
