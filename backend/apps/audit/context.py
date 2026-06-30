"""Thread-local request context so model signals can attribute changes to the
acting user + IP (signals have no access to the request otherwise).

We stash the *request* and resolve user/IP lazily at record time, because with
DRF + JWT the authenticated user is only populated during view dispatch — after
this middleware runs.
"""

import threading
from django.conf import settings

_state = threading.local()


def set_request(request):
    _state.request = request


def clear_request():
    _state.request = None


def _request():
    return getattr(_state, 'request', None)


def get_current_user():
    req = _request()
    user = getattr(req, 'user', None) if req else None
    return user if (user and getattr(user, 'is_authenticated', False)) else None


def get_current_ip():
    req = _request()
    if not req:
        return None
    return client_ip_from_request(req)


def client_ip_from_request(request):
    """Return the proxy-validated client IP.

    X-Forwarded-For is trusted only when the deployment explicitly trusts its
    reverse proxy. The host nginx configuration replaces untrusted inbound XFF.
    """
    if getattr(settings, 'TRUST_PROXY_HEADERS', False):
        xff = request.META.get('HTTP_X_FORWARDED_FOR', '')
        if xff:
            return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR')


def get_current_user_agent():
    req = _request()
    return req.META.get('HTTP_USER_AGENT', '')[:300] if req else ''


class AuditContextMiddleware:
    """Stashes the request so the audit recorder can attribute model-change
    signals to the acting user + client IP."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        set_request(request)
        try:
            return self.get_response(request)
        finally:
            clear_request()
