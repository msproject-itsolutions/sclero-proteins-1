"""Self-service account security: email verification and email change."""
import logging

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.audit.recorder import record_audit

from .auth_emails import public_link_base, send_email_change_link, send_email_change_notice, send_verify_email_link
from .email_tokens import (
    EmailLinkError, make_email_change_token, make_verify_email_token, read_email_change_token,
    read_verify_email_token,
)
from .sessions import revoke_sessions

User = get_user_model()
logger = logging.getLogger(__name__)
SEND_FAILED = 'We could not send the email. Try again in a few minutes.'
EMAIL_IN_USE = 'An account with this email address already exists.'


class VerifyEmailRequestView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = 'password_reset'

    def post(self, request):
        user = request.user
        if user.email_verified:
            return Response({'message': 'Your email address is already verified.'})
        link = f'{public_link_base(request)}/auth/verify-email?token={make_verify_email_token(user)}'
        try:
            send_verify_email_link(user.email, link)
        except Exception:
            logger.exception('Verification email failed for user %s.', user.pk)
            return Response({'detail': SEND_FAILED}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        payload = {'message': f'We sent a verification link to {user.email}.'}
        if settings.DEBUG:
            payload['verify_link_for_sandbox'] = link
        return Response(payload)


class VerifyEmailConfirmView(APIView):
    """Confirm a signed, time-limited verify-email link.

    Requires the caller to already be signed in as the token's own account.
    Without this, an attacker could register a victim's address with a
    password they control, request this link (emailed to the victim's inbox
    with no "ignore if you didn't sign up" line) and have the victim's click
    mark the attacker-controlled account verified. A victim who legitimately
    wants that address instead proves it through a code, magic link or Google
    sign-in, which purges any pre-registered password first (Task 5,
    apps.users.challenges) — so this link can never matter for a real takeover.
    """
    permission_classes = [IsAuthenticated]
    throttle_scope = 'auth'

    def post(self, request):
        try:
            data = read_verify_email_token(request.data.get('token'))
        except EmailLinkError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        if request.user.pk != data['user_id']:
            return Response(
                {
                    'detail': (
                        'This link belongs to a different account. Sign in to the account it was '
                        'sent for, then open the link again.'
                    ),
                    'code': 'verify_email_wrong_account',
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        user = User.objects.filter(pk=data['user_id'], is_active=True).first()
        if user is None or user.email.lower() != data['email']:
            return Response({'detail': 'This link is no longer valid.'}, status=status.HTTP_400_BAD_REQUEST)
        if not user.email_verified:
            user.email_verified = True
            user.save(update_fields=['email_verified', 'updated_at'])
            record_audit(
                'account.email_verified', actor=user, target_type='User', target_id=user.pk,
                summary=f'Email address verified: {user.email}',
            )
        return Response({'message': 'Your email address is verified.'})


class EmailChangeRequestView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = 'password_reset'

    def post(self, request):
        user = request.user
        new_email = str(request.data.get('new_email') or '').strip().lower()
        try:
            validate_email(new_email)
        except DjangoValidationError:
            return Response({'new_email': ['Enter a valid email address.']}, status=status.HTTP_400_BAD_REQUEST)
        if new_email == user.email.lower():
            return Response({'new_email': ['This is already your email address.']}, status=status.HTTP_400_BAD_REQUEST)
        # Accounts created by email code, magic link or Google have no password to
        # confirm; for them the confirmation link and the notice below are the guard.
        if user.has_usable_password() and not user.check_password(str(request.data.get('password') or '')):
            return Response({'password': ['Your password is not correct.']}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(email__iexact=new_email).exists():
            return Response({'new_email': [EMAIL_IN_USE]}, status=status.HTTP_400_BAD_REQUEST)
        link = f'{public_link_base(request)}/auth/confirm-email-change?token={make_email_change_token(user, new_email)}'
        try:
            send_email_change_link(new_email, link)
        except Exception:
            logger.exception('Email change link failed for user %s.', user.pk)
            return Response({'detail': SEND_FAILED}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        try:
            send_email_change_notice(user.email, new_email)
        except Exception:
            logger.exception('Email change notice to the old address failed for user %s.', user.pk)
        record_audit(
            'account.email_change_requested', actor=user, target_type='User', target_id=user.pk,
            summary=f'Email change requested for {user.email}', changes={'new_email': new_email},
        )
        payload = {'message': f'We sent a confirmation link to {new_email}. Your email changes when you open it.'}
        if settings.DEBUG:
            payload['confirm_link_for_sandbox'] = link
        return Response(payload)


class EmailChangeConfirmView(APIView):
    """Apply a confirmed email change.

    Requires the caller to already be signed in as the token's own account.
    Without this, an attacker could change their own account's address to a
    victim's and have the victim's click (on a "confirm your new address"
    email with no warning it wasn't their doing) apply the change to the
    attacker's account. Never signs in on success either: that would let an
    emailed link skip the staff second factor. A victim who legitimately wants
    that address instead proves it through a code, magic link or Google
    sign-in, which purges any pre-registered password first (Task 5,
    apps.users.challenges) — so this link can never matter for a real takeover.
    """
    permission_classes = [IsAuthenticated]
    throttle_scope = 'auth'

    def post(self, request):
        try:
            data = read_email_change_token(request.data.get('token'))
        except EmailLinkError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        if request.user.pk != data['user_id']:
            return Response(
                {
                    'detail': (
                        'This link belongs to a different account. Sign in to the account it was '
                        'sent for, then open the link again.'
                    ),
                    'code': 'email_change_wrong_account',
                },
                status=status.HTTP_403_FORBIDDEN,
            )
        try:
            with transaction.atomic():
                user = User.objects.select_for_update().filter(pk=data['user_id'], is_active=True).first()
                if user is None or user.auth_version != data['auth_version']:
                    return Response(
                        {'detail': 'This link is no longer valid. Request a new one from your account page.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if User.objects.filter(email__iexact=data['email']).exclude(pk=user.pk).exists():
                    return Response({'detail': EMAIL_IN_USE}, status=status.HTTP_400_BAD_REQUEST)
                old_email = user.email
                user.email = data['email']
                user.email_verified = True
                user.save(update_fields=['email', 'email_verified', 'updated_at'])
        except IntegrityError:
            return Response({'detail': EMAIL_IN_USE}, status=status.HTTP_400_BAD_REQUEST)
        revoke_sessions(user, reason='email_changed', actor=user)
        record_audit(
            'account.email_changed', actor=user, target_type='User', target_id=user.pk,
            summary=f'Email changed from {old_email} to {user.email}',
            changes={'email': [old_email, user.email]},
        )
        return Response({'message': 'Your email address has been changed. Please sign in again.', 'email': user.email})
