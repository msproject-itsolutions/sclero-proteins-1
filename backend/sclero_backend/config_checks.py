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
