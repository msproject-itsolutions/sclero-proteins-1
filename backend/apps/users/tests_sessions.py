from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APIRequestFactory, APITestCase
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from apps.audit.models import AuditLog
from apps.users.sessions import AUTH_VERSION_CLAIM, issue_tokens, revoke_sessions, start_session

User = get_user_model()
PASSWORD = 'Str0ng-pass-123'
BROWSER = {'HTTP_X_SCLERO_CLIENT': 'storefront'}


class SessionTestCase(APITestCase):
    def setUp(self):
        cache.clear()
        self.user = User.objects.create_user(email='shopper@example.com', password=PASSWORD)

    def cookie_login(self, **extra):
        response = self.client.post(
            '/api/auth/login/', {'email': self.user.email, 'password': PASSWORD},
            format='json', **BROWSER, **extra,
        )
        self.assertEqual(response.status_code, 200)
        return response

    def use_bearer(self, access):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')

    def restrict_to_private_network(self):
        self.user.allowed_ip_range = '10.0.0.0/8'
        self.user.save(update_fields=['allowed_ip_range'])


class VersionedTokenTests(SessionTestCase):
    def test_issued_tokens_carry_the_auth_version(self):
        tokens = issue_tokens(self.user)
        self.assertEqual(AccessToken(tokens['access'])[AUTH_VERSION_CLAIM], 0)
        self.assertEqual(RefreshToken(tokens['refresh'])[AUTH_VERSION_CLAIM], 0)

    def test_tokens_without_the_claim_count_as_version_zero(self):
        # The shape of every token issued before this release.
        legacy = RefreshToken.for_user(self.user)
        self.use_bearer(str(legacy.access_token))
        self.assertEqual(self.client.get('/api/auth/profile/').status_code, 200)

    def test_start_session_records_last_login_device_and_audit(self):
        request = APIRequestFactory().post(
            '/api/auth/login/', REMOTE_ADDR='198.51.100.7', HTTP_USER_AGENT='TestBrowser/1.0',
        )
        tokens = start_session(request, self.user, method='password')
        self.assertEqual(set(tokens), {'access', 'refresh'})
        self.user.refresh_from_db()
        self.assertIsNotNone(self.user.last_login)
        self.assertEqual(self.user.current_devices[0]['ip'], '198.51.100.7')
        self.assertTrue(AuditLog.objects.filter(action='login.success', changes__method='password').exists())


class RevocationTests(SessionTestCase):
    def test_revocation_rejects_access_tokens_and_blacklists_refresh_tokens(self):
        tokens = issue_tokens(self.user)
        self.assertEqual(revoke_sessions(self.user, reason='test'), 1)
        self.use_bearer(tokens['access'])
        self.assertEqual(self.client.get('/api/auth/profile/').status_code, 401)
        jti = RefreshToken(tokens['refresh'], verify=False)['jti']
        self.assertTrue(BlacklistedToken.objects.filter(token__jti=jti).exists())
        self.assertTrue(
            AuditLog.objects.filter(action='auth.sessions_revoked', target_id=str(self.user.pk)).exists()
        )

    def test_refresh_token_from_an_older_version_is_rejected(self):
        tokens = issue_tokens(self.user)
        User.objects.filter(pk=self.user.pk).update(auth_version=5)
        response = self.client.post('/api/auth/token/refresh/', {'refresh': tokens['refresh']}, format='json')
        self.assertEqual(response.status_code, 401)

    def test_stale_refresh_cookie_is_rejected_and_cleared(self):
        self.cookie_login()
        revoke_sessions(self.user, reason='test')
        response = self.client.post('/api/auth/token/refresh/', {}, format='json', **BROWSER)
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.cookies['sclero_access']['max-age'], 0)
        self.assertEqual(response.cookies['sclero_refresh']['max-age'], 0)

    def test_revoked_cookie_counts_as_signed_out(self):
        self.cookie_login()
        revoke_sessions(self.user, reason='test')
        self.assertEqual(self.client.get('/api/auth/profile/').status_code, 401)
        # Public pages keep working, and signing in again is possible.
        self.assertEqual(self.client.get('/api/regions/').status_code, 200)
        self.cookie_login()

    def test_cookie_for_an_inactive_user_counts_as_signed_out(self):
        # SimpleJWT's own AuthenticationFailed carries a dict `detail`
        # ({'detail': ..., 'code': 'user_inactive'}); the signed-out check
        # must tolerate that shape instead of crashing with a 500.
        self.cookie_login()
        self.user.is_active = False
        self.user.save(update_fields=['is_active'])
        self.assertEqual(self.client.get('/api/regions/').status_code, 200)
        self.assertEqual(self.client.get('/api/auth/profile/').status_code, 401)

    def test_cookie_for_a_deleted_user_counts_as_signed_out(self):
        self.cookie_login()
        self.user.delete()
        self.assertEqual(self.client.get('/api/regions/').status_code, 200)
        self.assertEqual(self.client.get('/api/auth/profile/').status_code, 401)

    def test_stale_full_save_does_not_roll_back_auth_version(self):
        tokens = issue_tokens(self.user)
        stale = User.objects.get(pk=self.user.pk)
        revoke_sessions(self.user, reason='test')
        stale.save()
        self.assertEqual(User.objects.get(pk=self.user.pk).auth_version, 1)
        self.use_bearer(tokens['access'])
        self.assertEqual(self.client.get('/api/auth/profile/').status_code, 401)


class NetworkRestrictionTests(SessionTestCase):
    def test_ip_allow_list_is_enforced_on_every_bearer_request(self):
        self.restrict_to_private_network()
        self.use_bearer(issue_tokens(self.user)['access'])
        self.assertEqual(self.client.get('/api/auth/profile/', REMOTE_ADDR='10.1.2.3').status_code, 200)
        self.assertEqual(self.client.get('/api/auth/profile/', REMOTE_ADDR='203.0.113.9').status_code, 401)

    def test_cookie_from_a_disallowed_network_is_signed_out(self):
        self.restrict_to_private_network()
        self.cookie_login(REMOTE_ADDR='10.1.2.3')
        self.assertEqual(self.client.get('/api/auth/profile/', REMOTE_ADDR='10.1.2.3').status_code, 200)
        self.assertEqual(self.client.get('/api/auth/profile/', REMOTE_ADDR='203.0.113.9').status_code, 401)
        self.assertEqual(self.client.get('/api/regions/', REMOTE_ADDR='203.0.113.9').status_code, 200)

    def test_refresh_is_refused_from_a_disallowed_network(self):
        self.restrict_to_private_network()
        tokens = issue_tokens(self.user)
        response = self.client.post(
            '/api/auth/token/refresh/', {'refresh': tokens['refresh']}, format='json', REMOTE_ADDR='203.0.113.9',
        )
        self.assertEqual(response.status_code, 401)


class LegacyTokenRefreshTests(SessionTestCase):
    """Refresh tokens issued before the `av` claim existed must still work."""

    def test_legacy_refresh_token_still_refreshes_via_body(self):
        legacy = RefreshToken.for_user(self.user)
        response = self.client.post('/api/auth/token/refresh/', {'refresh': str(legacy)}, format='json')
        self.assertEqual(response.status_code, 200)

    def test_legacy_refresh_token_still_refreshes_via_cookie(self):
        legacy = RefreshToken.for_user(self.user)
        self.client.cookies[settings.AUTH_COOKIE_REFRESH_NAME] = str(legacy)
        response = self.client.post('/api/auth/token/refresh/', {}, format='json', **BROWSER)
        self.assertEqual(response.status_code, 200)
