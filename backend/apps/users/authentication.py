from django.conf import settings
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.audit.context import client_ip_from_request

from .permissions import ip_allowed
from .sessions import SESSION_ENDED_MESSAGE, token_auth_version

# Failures that mean "this browser is no longer signed in", as opposed to a
# malformed or forged credential.
SIGNED_OUT_CODES = {'session_revoked', 'ip_not_allowed', 'user_inactive', 'user_not_found'}


class CookieOrHeaderJWTAuthentication(JWTAuthentication):
    """Authenticate API clients by Bearer header or an HttpOnly access cookie.

    Header authentication remains available for non-browser clients. Cookie
    authentication requires a custom header on unsafe methods, which prevents
    a third-party HTML form from using the ambient browser credential.

    Every request also checks the token's auth_version and the account's IP
    allow-list, so revocation and network restrictions apply immediately.
    """

    SAFE_METHODS = {'GET', 'HEAD', 'OPTIONS'}

    def authenticate(self, request):
        if self.get_header(request) is not None:
            result = super().authenticate(request)
            if result is not None:
                self.enforce_network(request, result[0])
            return result

        cookie_name = getattr(settings, 'AUTH_COOKIE_ACCESS_NAME', 'sclero_access')
        raw_token = request.COOKIES.get(cookie_name)
        if not raw_token:
            return None

        if (
            request.method not in self.SAFE_METHODS
            and request.headers.get('X-Sclero-Client') != 'storefront'
        ):
            raise AuthenticationFailed('Missing browser request verification header.')

        validated_token = self.get_validated_token(raw_token)
        try:
            user = self.get_user(validated_token)
            self.enforce_network(request, user)
        except AuthenticationFailed as exc:
            # The browser sends this cookie with every request, public pages
            # included. A revoked session counts as signed out instead of
            # failing the request; protected endpoints still answer 401 and
            # the refresh call then clears the cookies.
            if exc.get_codes() in SIGNED_OUT_CODES:
                return None
            raise
        return user, validated_token

    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        if token_auth_version(validated_token) != user.auth_version:
            raise AuthenticationFailed(SESSION_ENDED_MESSAGE, code='session_revoked')
        return user

    @staticmethod
    def enforce_network(request, user):
        if not ip_allowed(user, request):
            raise AuthenticationFailed(
                f'IP address {client_ip_from_request(request)} is not allowed to access this profile.',
                code='ip_not_allowed',
            )
