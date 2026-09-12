"""Issuing and revoking sign-in sessions.

Every JWT carries the account's `auth_version` in the `av` claim. Bumping the
version (password change, sign-out-everywhere, role or email change,
deactivation) invalidates every token issued before it, including access
tokens, which cannot be blacklisted.
"""
import uuid

from django.contrib.auth import get_user_model
from django.contrib.auth.models import update_last_login
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken
from rest_framework_simplejwt.tokens import RefreshToken

from apps.audit.context import client_ip_from_request
from apps.audit.recorder import record_audit

from .permissions import ip_allowed

AUTH_VERSION_CLAIM = 'av'
SESSION_ENDED_MESSAGE = 'Your session has ended. Please sign in again.'
NETWORK_REFUSED_MESSAGE = 'This network is not allowed for this account.'
MAX_DEVICES = 5


def token_auth_version(token):
    # Tokens issued before auth_version existed have no claim. They count as
    # version 0, so sessions that were open at deploy keep working until expiry.
    try:
        return int(token.get(AUTH_VERSION_CLAIM, 0))
    except (TypeError, ValueError):
        return -1


def issue_tokens(user):
    refresh = RefreshToken.for_user(user)
    refresh[AUTH_VERSION_CLAIM] = user.auth_version
    return {'refresh': str(refresh), 'access': str(refresh.access_token)}


def record_device(request, user, *, only_current=False):
    ip = client_ip_from_request(request)
    agent = (request.META.get('HTTP_USER_AGENT') or 'Unknown')[:300]
    entry = {
        'id': uuid.uuid4().hex,
        'ip': ip,
        'user_agent': agent,
        'last_active': timezone.now().isoformat(),
    }
    others = [] if only_current else [
        device for device in (user.current_devices or [])
        if device.get('ip') != ip or device.get('user_agent') != agent
    ]
    user.current_devices = [entry] + others[:MAX_DEVICES - 1]
    user.save(update_fields=['current_devices'])


def start_session(request, user, *, method):
    """Issue tokens for a completed sign-in and record it."""
    tokens = issue_tokens(user)
    update_last_login(None, user)
    record_device(request, user)
    record_audit(
        'login.success', actor=user, target_type='User', target_id=user.pk,
        summary=f'Signed in ({method}): {user.email}', changes={'method': method},
    )
    return tokens


def revoke_sessions(user, *, reason, actor=None):
    """End every session of `user`: bump auth_version and blacklist refresh tokens."""
    with transaction.atomic():
        get_user_model().objects.filter(pk=user.pk).update(auth_version=F('auth_version') + 1)
        user.refresh_from_db(fields=['auth_version'])
        outstanding = OutstandingToken.objects.filter(
            user_id=user.pk, expires_at__gt=timezone.now(), blacklistedtoken__isnull=True,
        )
        BlacklistedToken.objects.bulk_create(
            [BlacklistedToken(token=token) for token in outstanding], ignore_conflicts=True,
        )
        record_audit(
            'auth.sessions_revoked', actor=actor or user, target_type='User', target_id=user.pk,
            summary=f'Ended every session of {user.email}',
            changes={'reason': reason, 'auth_version': user.auth_version},
        )
    return user.auth_version


class VersionedTokenRefreshSerializer(TokenRefreshSerializer):
    """Refresh only while the account is active, on the auth_version the token
    was issued for, and reachable from this network."""

    def validate(self, attrs):
        refresh = self.token_class(attrs['refresh'])
        user_id = refresh.payload.get(api_settings.USER_ID_CLAIM)
        user = get_user_model().objects.filter(**{api_settings.USER_ID_FIELD: user_id}).first()
        if user is None or not user.is_active or token_auth_version(refresh) != user.auth_version:
            raise AuthenticationFailed(SESSION_ENDED_MESSAGE, code='session_revoked')
        request = self.context.get('request')
        if request is not None and not ip_allowed(user, request):
            raise AuthenticationFailed(NETWORK_REFUSED_MESSAGE, code='ip_not_allowed')
        return super().validate(attrs)
