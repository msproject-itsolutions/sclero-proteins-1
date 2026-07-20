from django.conf import settings


class AuthCookieMiddleware:
    """Move issued JWTs into Secure HttpOnly cookies and redact JSON tokens."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if not getattr(settings, 'AUTH_COOKIE_MODE', True):
            return response

        if request.path == '/api/auth/logout/' or (
            request.path == '/api/auth/me/' and request.method == 'DELETE' and response.status_code < 400
        ):
            self._clear(response)
            return response

        if not request.path.startswith('/api/auth/') or response.status_code >= 400:
            return response

        data = getattr(response, 'data', None)
        if not isinstance(data, dict):
            return response

        container = data.get('tokens') if isinstance(data.get('tokens'), dict) else data
        access = container.get('access')
        refresh = container.get('refresh')
        if not access:
            return response

        self._set(response, settings.AUTH_COOKIE_ACCESS_NAME, access, settings.AUTH_COOKIE_ACCESS_AGE)
        if refresh:
            self._set(response, settings.AUTH_COOKIE_REFRESH_NAME, refresh, settings.AUTH_COOKIE_REFRESH_AGE)

        # Tokens never enter JavaScript in cookie mode. Keep a stable flag so
        # browser clients can distinguish successful authentication responses.
        container.pop('access', None)
        container.pop('refresh', None)
        if container is not data and not container:
            data.pop('tokens', None)
        data['authenticated'] = True
        return response

    @staticmethod
    def _set(response, name, value, max_age):
        response.set_cookie(
            name,
            value,
            max_age=max_age,
            secure=not settings.DEBUG,
            httponly=True,
            samesite='Lax',
            path='/',
        )

    @staticmethod
    def _clear(response):
        response.delete_cookie(settings.AUTH_COOKIE_ACCESS_NAME, path='/', samesite='Lax')
        response.delete_cookie(settings.AUTH_COOKIE_REFRESH_NAME, path='/', samesite='Lax')
