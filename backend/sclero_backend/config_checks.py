"""Production configuration guards evaluated while settings load.

Plain functions so each rule can be unit tested without re-importing the
settings module under a production environment.
"""
from django.core.exceptions import ImproperlyConfigured


def require_rbac_enforced(*, debug, building_static, rbac_enforced):
    if debug or building_static:
        return
    if not rbac_enforced:
        raise ImproperlyConfigured('RBAC_ENFORCED cannot be disabled when DEBUG=False.')


def require_integration_key(*, debug, building_static, key):
    if debug or building_static:
        return
    from cryptography.fernet import Fernet

    try:
        Fernet((key or '').encode('utf-8'))
    except (TypeError, ValueError) as exc:
        raise ImproperlyConfigured(
            'INTEGRATION_ENCRYPTION_KEY must be a Fernet key (44 url-safe base64 characters) '
            'when DEBUG=False. deploy/vps-install.sh pins it automatically.'
        ) from exc
