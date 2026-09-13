"""Security emails for sign-in, verification and email changes.

Sent directly through the branded mailer, never through editable templates or
the email retry queue, so a live sign-in code or link is never stored in the
database or rendered by a template an administrator changed.
"""
from urllib.parse import urlsplit

from django.conf import settings

DEV_ORIGINS = ('http://localhost:3000', 'http://localhost:3100', 'http://127.0.0.1:3000')
LOCAL_HOSTS = {'localhost', '127.0.0.1'}
CODE_SUBJECTS = {
    'EMAIL_LOGIN': 'Your Sclero Proteins sign-in code',
    'STAFF_2FA': 'Your Sclero Proteins staff sign-in code',
    'CUSTOMER_2FA': 'Your Sclero Proteins sign-in code',
}


def trusted_origins():
    origins = set(getattr(settings, 'CSRF_TRUSTED_ORIGINS', []) or [])
    origins |= set(getattr(settings, 'CORS_ALLOWED_ORIGINS', []) or [])
    if settings.DEBUG:
        origins |= set(DEV_ORIGINS)
    else:
        origins = {origin for origin in origins if urlsplit(origin).hostname not in LOCAL_HOSTS}
    return {origin.rstrip('/') for origin in origins}


def public_link_base(request=None):
    """Base URL for emailed links: a trusted requested origin, else SITE_URL."""
    requested = ''
    if request is not None:
        requested = str(getattr(request, 'data', {}).get('origin') or '').strip().rstrip('/')
    if requested and requested in trusted_origins():
        return requested
    site = (getattr(settings, 'SITE_URL', '') or '').rstrip('/')
    if site:
        return site
    return DEV_ORIGINS[0] if settings.DEBUG else ''


def _send(subject, body, to):
    from apps.orders.email_service import send_branded_email

    send_branded_email(subject, body, to)


def send_code_email(to, code, purpose, *, minutes):
    _send(
        CODE_SUBJECTS.get(purpose, CODE_SUBJECTS['EMAIL_LOGIN']),
        f'Your verification code is {code}. It expires in {minutes} minutes.\n\n'
        'If you did not try to sign in, ignore this email and consider changing your password.',
        to,
    )


def send_magic_link_email(to, link):
    _send(
        'Your Sclero Proteins sign-in link',
        f'Use this link to sign in. It works once and expires in 15 minutes:\n\n{link}\n\n'
        'If you did not request it, ignore this email.',
        to,
    )
