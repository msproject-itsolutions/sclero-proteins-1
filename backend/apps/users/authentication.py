from django.conf import settings
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.authentication import JWTAuthentication


class CookieOrHeaderJWTAuthentication(JWTAuthentication):
    """Authenticate API clients by Bearer header or an HttpOnly access cookie.

    Header authentication remains available for non-browser clients. Cookie
    authentication requires a custom header on unsafe methods, which prevents
    a third-party HTML form from using the ambient browser credential.
    """

    SAFE_METHODS = {'GET', 'HEAD', 'OPTIONS'}

    def authenticate(self, request):
        if self.get_header(request) is not None:
            return super().authenticate(request)

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
        return self.get_user(validated_token), validated_token
