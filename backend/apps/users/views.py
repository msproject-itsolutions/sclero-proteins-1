import hashlib
import logging
import secrets
import uuid
import requests
from django.conf import settings
from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import viewsets, status, generics
from rest_framework.pagination import PageNumberPagination
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.views import TokenRefreshView
from django.db.models import Q, Sum
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import make_password
from django.contrib.auth.password_validation import validate_password
from .models import UserAddress, Role, Wishlist, WishlistItem, CustomerSegment, CustomerActivity, SupportTicket, LoginChallenge
from .serializers import (
    UserSerializer, RegisterSerializer, UserAddressSerializer,
    RoleSerializer, StaffUserSerializer, WishlistItemSerializer, WishlistSerializer,
    CustomerSegmentSerializer, CustomerActivitySerializer, SupportTicketSerializer,
)
from .permissions import (
    require_permission, ENFORCED_PERMISSION_GROUPS, ip_allowed, is_staff_account,
)
from .middleware import clear_auth_cookies
from .auth_emails import public_link_base
from .challenges import (
    SECOND_FACTOR_PURPOSES, SECOND_FACTOR_REQUIRED_MESSAGE, ChallengeDeliveryError, ChallengeError,
    challenge_response_data, enforce_passwordless_limit, issue_code_challenge, issue_magic_link, mask_email,
    requires_second_factor, resend_code, verify_code, verify_magic_token,
)
from .sessions import SESSION_ENDED_MESSAGE, VersionedTokenRefreshSerializer, start_session
from apps.audit.context import client_ip_from_request
from apps.audit.recorder import record_audit
from apps.orders.models import Order

User = get_user_model()
logger = logging.getLogger(__name__)

GENERIC_LOGIN_ERROR = 'Invalid email or password.'
CODE_SEND_FAILED = 'We could not send your sign-in code. Try again in a few minutes.'


def _network_refusal(request):
    return Response(
        {'detail': f'IP address {client_ip_from_request(request)} is not allowed to access this profile.'},
        status=status.HTTP_403_FORBIDDEN,
    )


class AuditedLoginView(APIView):
    """Password sign-in.

    Staff accounts, and customers who turned on two-step sign-in, receive an
    emailed code instead of tokens; LoginVerifyView exchanges it. Every
    failure returns the same 401 so the response never reveals whether an
    address is registered or active.
    """
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = 'auth'

    def post(self, request, *args, **kwargs):
        email = str(request.data.get('email') or request.data.get('username') or '').strip()
        password = str(request.data.get('password') or '')
        user = User.objects.filter(email__iexact=email).first() if email else None
        if user is None:
            # Hash anyway so an unknown address takes as long as a wrong password.
            make_password(password)
            password_ok = False
        else:
            password_ok = user.check_password(password)

        if not password_ok or not user.is_active:
            if user is None:
                reason = 'unknown_account'
            elif not password_ok:
                reason = 'wrong_password'
            else:
                reason = 'inactive_account'
            record_audit(
                'login.failed', actor=user if user is not None and user.is_active else None,
                summary=f'Failed login attempt: {email}', changes={'attempted_email': email, 'reason': reason},
            )
            return Response({'detail': GENERIC_LOGIN_ERROR}, status=status.HTTP_401_UNAUTHORIZED)

        client_ip = client_ip_from_request(request)
        if not ip_allowed(user, request):
            record_audit(
                'login.failed', actor=user, summary=f'Failed login for {email}: IP {client_ip} not allowed',
                changes={'ip': client_ip, 'reason': 'ip_not_allowed'},
            )
            return _network_refusal(request)

        if requires_second_factor(user):
            purpose = (
                LoginChallenge.Purpose.STAFF_2FA if is_staff_account(user) else LoginChallenge.Purpose.CUSTOMER_2FA
            )
            try:
                challenge, code = issue_code_challenge(purpose=purpose, email=user.email, user=user, ip=client_ip)
            except ChallengeDeliveryError:
                return Response({'detail': CODE_SEND_FAILED}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            record_audit(
                'login.challenge_sent', actor=user, target_type='User', target_id=user.pk,
                summary=f'Sign-in code sent for {user.email}',
                changes={'purpose': purpose, 'sent_to': mask_email(challenge.sent_to)},
            )
            return Response(challenge_response_data(challenge, code))

        tokens = start_session(request, user, method='password')
        return Response({**tokens, 'user': UserSerializer(user).data})


class LoginVerifyView(APIView):
    """Second step of password sign-in: exchange the emailed code for a session."""
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = 'otp'

    def post(self, request):
        try:
            challenge = verify_code(
                request.data.get('challenge_id'), request.data.get('code'), purposes=SECOND_FACTOR_PURPOSES,
            )
        except ChallengeError as exc:
            return Response(exc.as_response_data(), status=status.HTTP_400_BAD_REQUEST)
        user = challenge.user
        if user is None or not user.is_active:
            return Response(ChallengeError('invalid').as_response_data(), status=status.HTTP_400_BAD_REQUEST)
        if not ip_allowed(user, request):
            return _network_refusal(request)
        tokens = start_session(request, user, method=challenge.purpose.lower())
        return Response({**tokens, 'user': UserSerializer(user).data})


class LoginResendView(APIView):
    """Send a new code for a pending password sign-in (60 s cooldown)."""
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_scope = 'otp'

    def post(self, request):
        try:
            challenge, code = resend_code(request.data.get('challenge_id'), purposes=SECOND_FACTOR_PURPOSES)
        except ChallengeError as exc:
            status_code = (
                status.HTTP_429_TOO_MANY_REQUESTS if exc.code == 'cooldown' else status.HTTP_400_BAD_REQUEST
            )
            return Response(exc.as_response_data(), status=status_code)
        except ChallengeDeliveryError:
            return Response({'detail': CODE_SEND_FAILED}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(challenge_response_data(challenge, code))


class CookieTokenRefreshView(TokenRefreshView):
    """Rotate the refresh token from an HttpOnly cookie for browser clients."""

    permission_classes = [AllowAny]
    throttle_scope = 'auth'
    serializer_class = VersionedTokenRefreshSerializer

    def post(self, request, *args, **kwargs):
        if request.headers.get('X-Sclero-Client') != 'storefront' and not request.data.get('refresh'):
            return Response({'detail': 'Invalid browser request.'}, status=status.HTTP_400_BAD_REQUEST)
        payload = request.data.copy()
        from_cookie = not payload.get('refresh')
        if from_cookie:
            payload['refresh'] = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH_NAME, '')
        if not payload.get('refresh'):
            return Response({'detail': 'Authentication credentials were not provided.'}, status=status.HTTP_401_UNAUTHORIZED)
        serializer = self.get_serializer(data=payload)
        try:
            serializer.is_valid(raise_exception=True)
        except (TokenError, AuthenticationFailed) as exc:
            detail = exc.detail if isinstance(exc, AuthenticationFailed) else SESSION_ENDED_MESSAGE
            response = Response({'detail': detail}, status=status.HTTP_401_UNAUTHORIZED)
            if from_cookie:
                # A dead refresh cookie would otherwise be retried on every page.
                clear_auth_cookies(response)
            return response
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """Blacklist the browser refresh token and clear both auth cookies."""

    permission_classes = [AllowAny]
    throttle_scope = 'auth'

    def post(self, request):
        if request.headers.get('X-Sclero-Client') != 'storefront':
            return Response({'detail': 'Invalid browser request.'}, status=status.HTTP_400_BAD_REQUEST)
        raw_refresh = request.COOKIES.get(settings.AUTH_COOKIE_REFRESH_NAME, '')
        if raw_refresh:
            try:
                RefreshToken(raw_refresh).blacklist()
            except TokenError:
                pass
        return Response({'detail': 'Signed out.'}, status=status.HTTP_200_OK)


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer
    throttle_scope = 'auth'

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            tokens = start_session(request, user, method='register')
            from apps.audit.recorder import record_audit
            record_audit('account.registered', actor=user, target_type='User',
                         target_id=user.pk, summary=f'New account registered: {user.email}')
            try:
                from apps.orders.email_service import send_account_email
                if not send_account_email('welcome', user):
                    logger.warning('Welcome email for user %s was queued for retry.', user.pk)
            except Exception:
                logger.exception('Welcome email scheduling failed for user %s.', user.pk)
            return Response({
                "user": UserSerializer(user).data,
                "tokens": tokens
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserProfileView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class UserErasureRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.admin_dashboard.models import ApprovalRequest
        
        # Check if there is already a pending erasure request for this user
        existing = ApprovalRequest.objects.filter(
            requester=request.user,
            request_type='ERASURE',
            status='PENDING'
        ).exists()
        
        if existing:
            return Response(
                {"error": "You already have a pending erasure request."},
                status=status.HTTP_400_BAD_REQUEST
            )
            
        ApprovalRequest.objects.create(
            requester=request.user,
            request_type='ERASURE',
            summary=f"GDPR Right to Erasure request for {request.user.email}",
            payload={"user_id": request.user.id},
            details={"email": request.user.email, "request_type": "GDPR_ERASURE"}
        )
        
        from apps.audit.recorder import record_audit
        record_audit(
            'privacy.erasure_requested',
            actor=request.user,
            summary=f"GDPR Right to Erasure requested by {request.user.email}"
        )
        
        return Response(
            {"message": "Your erasure request has been submitted and is pending administrator review."},
            status=status.HTTP_201_CREATED
        )


class DataExportView(APIView):
    """GET /api/auth/me/export/ — GDPR/DPDP data export.

    Returns a JSON dump of all PII associated with the authenticated user, sent
    as an attachment for download.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        import json
        from django.http import HttpResponse
        from django.utils import timezone
        from apps.orders.models import Order
        from apps.products.models import ProductReview
        from apps.enquiries.models import BulkEnquiry
        from apps.audit.recorder import record_audit

        user = request.user

        # User PII (exclude password)
        user_dict = {
            'id': user.id,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'phone_number': user.phone_number,
            'loyalty_points': user.loyalty_points,
            'google_id': user.google_id,
            'home_region_code': user.home_region.code if user.home_region_id else None,
            'email_order_updates': user.email_order_updates,
            'email_marketing': user.email_marketing,
            'email_newsletter': user.email_newsletter,
            'sms_marketing': getattr(user, 'sms_marketing', False),
            'is_active': user.is_active,
            'is_staff': user.is_staff,
            'is_superuser': user.is_superuser,
            'roles': list(user.roles.values_list('name', flat=True)),
            'two_factor_enabled': user.two_factor_enabled,
            'date_joined': user.created_at.isoformat() if user.created_at else None,
            'last_login': user.last_login.isoformat() if user.last_login else None,
            'updated_at': user.updated_at.isoformat() if user.updated_at else None,
        }

        addresses = list(user.addresses.values(
            'id', 'address_type', 'full_name', 'phone_number',
            'address_line1', 'address_line2', 'city', 'state',
            'postal_code', 'country', 'is_default',
        ))

        orders_qs = Order.objects.filter(
            Q(user=user) | Q(email__iexact=user.email)
        ).prefetch_related('items__product').order_by('-created_at')
        orders = []
        for o in orders_qs:
            orders.append({
                'order_id': o.id,
                'status': o.status,
                'payment_status': o.payment_status,
                'payment_method': o.payment_method,
                'currency': o.currency_code,
                'subtotal': str(o.subtotal),
                'tax_amount': str(o.tax_amount),
                'shipping_cost': str(o.shipping_cost),
                'discount_amount': str(o.discount_amount),
                'total': str(o.total),
                'coupon_code': o.coupon_code,
                'shipping_address': {
                    'name': o.shipping_name,
                    'phone': o.shipping_phone,
                    'line1': o.shipping_address_line1,
                    'line2': o.shipping_address_line2,
                    'city': o.shipping_city,
                    'state': o.shipping_state,
                    'postal_code': o.shipping_postal_code,
                    'country': o.shipping_country,
                },
                'items': [
                    {
                        'name': it.product.name if it.product_id else None,
                        'sku': it.product.sku if it.product_id else None,
                        'qty': it.quantity,
                        'price': str(it.price),
                    }
                    for it in o.items.all()
                ],
                'created_at': o.created_at.isoformat() if o.created_at else None,
            })

        reviews = list(
            ProductReview.objects.filter(user_email__iexact=user.email).values(
                'id', 'product_id', 'user_email', 'user_name', 'rating',
                'comment', 'is_verified_purchase', 'is_approved', 'created_at',
            )
        )
        for r in reviews:
            if r.get('created_at'):
                r['created_at'] = r['created_at'].isoformat()

        wishlist = list(
            WishlistItem.objects.filter(user=user).values(
                'id', 'product_id', 'product__name', 'product__sku', 'created_at',
            )
        )
        for w in wishlist:
            if w.get('created_at'):
                w['created_at'] = w['created_at'].isoformat()

        enquiries = list(
            BulkEnquiry.objects.filter(email__iexact=user.email).values(
                'id', 'name', 'company', 'email', 'phone', 'enquiry_type',
                'product_interest', 'quantity', 'country', 'message',
                'status', 'created_at',
            )
        )
        for e in enquiries:
            if e.get('created_at'):
                e['created_at'] = e['created_at'].isoformat()

        payload = {
            'exported_at': timezone.now().isoformat(),
            'user': user_dict,
            'addresses': addresses,
            'orders': orders,
            'reviews': reviews,
            'wishlist': wishlist,
            'enquiries': enquiries,
        }

        body = json.dumps(payload, indent=2, default=str)

        record_audit(
            'data.exported',
            actor=user,
            target_type='User',
            target_id=user.id,
            summary=f"GDPR data export for {user.email}",
            changes={'size_bytes': len(body)},
        )

        filename = f"sclero-data-export-{user.id}-{timezone.now().strftime('%Y%m%d')}.json"
        resp = HttpResponse(body, content_type='application/json')
        resp['Content-Disposition'] = f'attachment; filename="{filename}"'
        return resp


class AccountDeleteView(APIView):
    """DELETE /api/auth/me/ — GDPR/DPDP account deletion (anonymization).

    Soft-deletes the user by anonymizing PII. Order/invoice rows are retained
    (with PII stripped) for tax-record retention (UK 6yr, IN 8yr).
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        from django.db import transaction
        from apps.orders.models import Order
        from apps.products.models import ProductReview
        from apps.enquiries.models import BulkEnquiry
        from apps.audit.recorder import record_audit

        user = request.user
        original_email = user.email
        anon_email = f"deleted-user-{user.id}@anon.invalid"

        with transaction.atomic():
            # Anonymize orders (retain for tax). Match by user FK OR email.
            orders_qs = Order.objects.filter(
                Q(user=user) | Q(email__iexact=original_email)
            )
            orders_count = orders_qs.update(
                shipping_name="Deleted user",
                shipping_phone="",
                shipping_address_line1="[redacted]",
                shipping_address_line2="",
                shipping_city="[redacted]",
                shipping_state="[redacted]",
                shipping_postal_code="[redacted]",
                email=anon_email,
            )

            # Anonymize reviews (keep for verified-purchase audit trail).
            reviews_count = ProductReview.objects.filter(
                user_email__iexact=original_email
            ).update(
                user_email=anon_email,
                user_name="Deleted user",
            )

            # Anonymize bulk enquiries (keep enquiry text + business context).
            enquiries_count = BulkEnquiry.objects.filter(
                email__iexact=original_email
            ).update(
                name="[redacted]",
                email=anon_email,
                phone="",
            )

            # Hard-delete wishlist items and addresses.
            wishlist_count = WishlistItem.objects.filter(user=user).count()
            WishlistItem.objects.filter(user=user).delete()
            # Also delete wishlists owned by this user (cascades any remaining items).
            Wishlist.objects.filter(user=user).delete()

            addresses_count = UserAddress.objects.filter(user=user).count()
            UserAddress.objects.filter(user=user).delete()

            # Anonymize the user record itself.
            user.email = anon_email
            user.first_name = "Deleted"
            user.last_name = "User"
            user.phone_number = ""
            user.google_id = None
            user.otp_secret = ""
            user.totp_secret = ""
            user.totp_backup_codes = []
            user.totp_enabled = False
            user.password_reset_token = ""
            user.password_reset_token_expires = None
            user.allowed_ip_range = ""
            user.current_devices = []
            user.is_active = False
            user.two_factor_enabled = False
            user.set_unusable_password()
            user.save()

            # Clear M2M relationships (roles, assigned_regions, segments).
            user.roles.clear()
            user.assigned_regions.clear()

            from rest_framework_simplejwt.token_blacklist.models import (
                BlacklistedToken,
                OutstandingToken,
            )
            for token in OutstandingToken.objects.filter(user=user):
                BlacklistedToken.objects.get_or_create(token=token)

            record_audit(
                'account.deleted',
                actor=user,
                target_type='User',
                target_id=user.id,
                summary=f"Account deletion (GDPR/DPDP) for {original_email}",
                changes={
                    'orders_anonymized': orders_count,
                    'addresses_deleted': addresses_count,
                    'reviews_handled': reviews_count,
                    'enquiries_anonymized': enquiries_count,
                    'wishlist_items_deleted': wishlist_count,
                },
            )

        return Response(
            {
                "message": "Account deleted. Tax records retained per UK/IN law.",
                "token_blacklist_available": True,
            },
            status=status.HTTP_200_OK,
        )


class UserAddressViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = UserAddressSerializer

    def get_queryset(self):
        return UserAddress.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        # If this is set as default, remove default flag from other addresses of the user
        is_default = serializer.validated_data.get('is_default', False)
        if is_default:
            UserAddress.objects.filter(user=self.request.user).update(is_default=False)
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        is_default = serializer.validated_data.get('is_default', False)
        if is_default:
            UserAddress.objects.filter(user=self.request.user).update(is_default=False)
        serializer.save()


def _second_factor_refusal():
    return Response(
        {'error': SECOND_FACTOR_REQUIRED_MESSAGE, 'code': 'second_factor_required'},
        status=status.HTTP_403_FORBIDDEN,
    )


def _passwordless_user(challenge):
    """Return (user, None) for the account a verified passwordless challenge
    proves, creating it on first use, or (None, error response)."""
    user = challenge.user or User.objects.filter(email__iexact=challenge.email).first()
    created = False
    if user is None:
        try:
            with transaction.atomic():
                user = User.objects.create_user(email=challenge.email, password=None, email_verified=True)
            created = True
        except IntegrityError:
            user = User.objects.get(email__iexact=challenge.email)
    # Checked again at use: the account may have become staff after the email was sent.
    if requires_second_factor(user):
        return None, _second_factor_refusal()
    if not user.is_active:
        return None, Response(
            {'error': 'This sign-in code is no longer valid.', 'code': 'invalid'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if created:
        record_audit(
            'account.registered', actor=user, target_type='User', target_id=user.pk,
            summary=f'New account registered by email sign-in: {user.email}',
        )
    elif not user.email_verified:
        user.email_verified = True
        user.save(update_fields=['email_verified'])
    return user, None


class SendOTPView(APIView):
    """Email a one-time sign-in code. Never creates an account."""
    permission_classes = [AllowAny]
    throttle_scope = 'otp'

    def post(self, request):
        identifier = str(request.data.get('identifier') or '').strip().lower()
        try:
            validate_email(identifier)
        except DjangoValidationError:
            return Response(
                {"error": "Email OTP is supported. Phone OTP requires a configured SMS provider."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user = User.objects.filter(email__iexact=identifier).first()
        if user is not None and requires_second_factor(user):
            return _second_factor_refusal()
        try:
            enforce_passwordless_limit(identifier)
        except ChallengeError as exc:
            return Response({'error': exc.message, 'code': exc.code}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        if user is not None and not user.is_active:
            # Same shape as a real send so the response never reveals the account state.
            return Response({
                'message': 'OTP sent successfully.',
                'challenge_id': str(uuid.uuid4()),
                'sent_to_masked': mask_email(identifier),
            })
        try:
            challenge, code = issue_code_challenge(
                purpose=LoginChallenge.Purpose.EMAIL_LOGIN, email=identifier, user=user,
                ip=client_ip_from_request(request),
            )
        except ChallengeDeliveryError:
            return Response(
                {"error": "Unable to send the verification code. Try again later."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        payload = {
            'message': 'OTP sent successfully.',
            'challenge_id': str(challenge.pk),
            'sent_to_masked': mask_email(challenge.sent_to),
        }
        if settings.DEBUG:
            payload['otp_preview_for_sandbox'] = code
        return Response(payload)


class VerifyOTPView(APIView):
    """Exchange an emailed sign-in code for a session, creating the account on first use."""
    permission_classes = [AllowAny]
    throttle_scope = 'otp'

    def post(self, request):
        try:
            challenge = verify_code(
                request.data.get('challenge_id'), request.data.get('otp'),
                purposes=(LoginChallenge.Purpose.EMAIL_LOGIN,),
            )
        except ChallengeError as exc:
            return Response({'error': exc.message, 'code': exc.code}, status=status.HTTP_400_BAD_REQUEST)
        user, refusal = _passwordless_user(challenge)
        if refusal is not None:
            return refusal
        tokens = start_session(request, user, method='email_code')
        return Response({"user": UserSerializer(user).data, "tokens": tokens, "message": "OTP verified successfully!"})


class MagicLinkRequestView(APIView):
    """Email a single-use sign-in link. Never creates an account."""
    permission_classes = [AllowAny]
    throttle_scope = 'auth'

    def post(self, request):
        email = str(request.data.get('email') or '').strip().lower()
        try:
            validate_email(email)
        except DjangoValidationError:
            return Response({"error": "A valid email is required."}, status=status.HTTP_400_BAD_REQUEST)
        user = User.objects.filter(email__iexact=email).first()
        if user is not None and requires_second_factor(user):
            return _second_factor_refusal()
        try:
            enforce_passwordless_limit(email)
        except ChallengeError as exc:
            return Response({'error': exc.message, 'code': exc.code}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        payload = {"message": "Check your email for a sign-in link."}
        if user is not None and not user.is_active:
            return Response(payload)
        try:
            _challenge, link = issue_magic_link(
                email=email, user=user, link_base=public_link_base(request), ip=client_ip_from_request(request),
            )
        except ChallengeDeliveryError:
            return Response(
                {"error": "Unable to send the sign-in link. Try again later."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        if settings.DEBUG:
            payload["magic_link_for_sandbox"] = link
        return Response(payload)


class MagicLinkVerifyView(APIView):
    """Exchange a magic-link token for a session, creating the account on first use."""
    permission_classes = [AllowAny]
    throttle_scope = 'auth'

    def post(self, request):
        try:
            challenge = verify_magic_token(request.data.get('token'))
        except ChallengeError as exc:
            message = (
                'This sign-in link has expired. Please request a new one.' if exc.code == 'expired'
                else 'This sign-in link is invalid or has already been used.'
            )
            return Response({'error': message, 'code': exc.code}, status=status.HTTP_400_BAD_REQUEST)
        user, refusal = _passwordless_user(challenge)
        if refusal is not None:
            return refusal
        tokens = start_session(request, user, method='magic_link')
        return Response({"user": UserSerializer(user).data, "tokens": tokens, "message": "Signed in successfully."})


class RoleViewSet(viewsets.ModelViewSet):
    """Manage staff roles (RBAC). Gated by 'rbac.manage' when RBAC is enforced."""
    queryset = Role.objects.all().order_by('name')
    serializer_class = RoleSerializer
    permission_classes = [require_permission('rbac.manage')]

    def perform_destroy(self, instance):
        if instance.is_system:
            raise ValidationError("System roles cannot be deleted.")
        instance.delete()

    @action(detail=False, methods=['get'])
    def permission_catalog(self, request):
        """Permissions the role editor should offer, grouped and in plain English.

        Only permissions the code actually enforces are returned. The wider
        PERMISSIONS dict still holds legacy keys that nothing checks; offering
        those would let an owner "revoke" an ability the person still has.
        """
        return Response([
            {
                'group': group,
                'permissions': [{'key': key, 'label': label} for key, label in items],
            }
            for group, items in ENFORCED_PERMISSION_GROUPS
        ])


class StaffUserViewSet(viewsets.ModelViewSet):
    """List, create, update, and manage staff users. Gated by 'rbac.manage'."""
    serializer_class = StaffUserSerializer
    permission_classes = [require_permission('rbac.manage')]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def get_queryset(self):
        return (
            User.objects.filter(Q(is_staff=True) | Q(roles__isnull=False))
            .distinct()
            .prefetch_related('roles')
            .order_by('email')
        )


class WishlistViewSet(viewsets.ModelViewSet):
    """Legacy individual wishlist items. Maps to the user's default wishlist."""
    serializer_class = WishlistItemSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def _get_default_wishlist(self):
        wishlist, created = Wishlist.objects.get_or_create(
            user=self.request.user,
            name="My Wishlist"
        )
        return wishlist

    def get_queryset(self):
        wishlist = self._get_default_wishlist()
        return WishlistItem.objects.filter(wishlist=wishlist).select_related('product')

    def create(self, request, *args, **kwargs):
        from apps.products.models import Product
        product_id = request.data.get('product_id')
        if not product_id:
            return Response({"error": "product_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        product = get_object_or_404(Product, id=product_id)
        wishlist = self._get_default_wishlist()
        
        item, created = WishlistItem.objects.get_or_create(
            wishlist=wishlist,
            product=product,
            defaults={'user': request.user}
        )
        return Response(
            self.get_serializer(item).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class WishlistGroupViewSet(viewsets.ModelViewSet):
    """
    CRUD for multiple custom user wishlists.
    GET /api/wishlists/ — lists user wishlists
    POST /api/wishlists/ — creates a custom wishlist (e.g. {"name": "My Fitness list"})
    DELETE /api/wishlists/<id>/ — deletes a custom wishlist
    """
    serializer_class = WishlistSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Wishlist.objects.filter(user=self.request.user).prefetch_related('items__product')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'])
    def add_product(self, request, pk=None):
        wishlist = self.get_object()
        from apps.products.models import Product
        product_id = request.data.get('product_id')
        if not product_id:
            return Response({"error": "product_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        product = get_object_or_404(Product, id=product_id)
        item, created = WishlistItem.objects.get_or_create(wishlist=wishlist, product=product)
        item.user = request.user
        item.save()
        return Response(WishlistSerializer(wishlist, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def remove_product(self, request, pk=None):
        wishlist = self.get_object()
        product_id = request.data.get('product_id')
        if not product_id:
            return Response({"error": "product_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        WishlistItem.objects.filter(wishlist=wishlist, product_id=product_id).delete()
        return Response(WishlistSerializer(wishlist, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def toggle_sharing(self, request, pk=None):
        wishlist = self.get_object()
        wishlist.is_public = not wishlist.is_public
        wishlist.save(update_fields=['is_public'])
        return Response(WishlistSerializer(wishlist, context={'request': request}).data)


class PublicWishlistView(APIView):
    """Public unauthenticated access to a shared wishlist."""
    permission_classes = [AllowAny]

    def get(self, request, share_token):
        wishlist = get_object_or_404(Wishlist.objects.filter(is_public=True), share_token=share_token)
        return Response(WishlistSerializer(wishlist, context={'request': request}).data)


class GoogleLoginView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'auth'

    def post(self, request):
        credential = request.data.get('credential') or ''
        client_id = getattr(settings, 'GOOGLE_CLIENT_ID', '') or ''

        if not client_id:
            return Response({"error": "Google sign-in is not configured."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        if not credential:
            return Response({"error": "Google credential is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            google_res = requests.get(
                'https://oauth2.googleapis.com/tokeninfo',
                params={'id_token': credential},
                timeout=5,
            )
            if google_res.status_code != 200:
                return Response({"error": "Invalid Google credential."}, status=status.HTTP_401_UNAUTHORIZED)
            claims = google_res.json()
        except requests.RequestException:
            return Response({"error": "Could not verify Google credential."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        email = (claims.get('email') or '').strip().lower()
        google_id = claims.get('sub') or ''
        if (
            claims.get('aud') != client_id
            or claims.get('email_verified') not in (True, 'true', 'True')
            or not email
            or not google_id
        ):
            return Response({"error": "Invalid Google credential."}, status=status.HTTP_401_UNAUTHORIZED)

        user = User.objects.filter(google_id=google_id).first() or User.objects.filter(email__iexact=email).first()
        created = False
        if user is None:
            try:
                with transaction.atomic():
                    user = User.objects.create_user(
                        email=email, password=None, google_id=google_id, email_verified=True,
                        first_name=claims.get('given_name') or '', last_name=claims.get('family_name') or '',
                    )
                created = True
            except IntegrityError:
                user = User.objects.filter(Q(google_id=google_id) | Q(email__iexact=email)).first()
        if user is None or not user.is_active:
            record_audit(
                'login.failed', summary=f'Google sign-in refused: {email}',
                changes={'attempted_email': email, 'method': 'google', 'reason': 'inactive_account'},
            )
            return Response({"error": "This account is not active."}, status=status.HTTP_403_FORBIDDEN)
        if requires_second_factor(user):
            record_audit(
                'login.failed', actor=user, summary=f'Google sign-in refused for {user.email}: code required',
                changes={'method': 'google', 'reason': 'second_factor_required'},
            )
            return _second_factor_refusal()

        updates = []
        if not user.google_id:
            user.google_id = google_id
            updates.append('google_id')
        # Google vouches only for the address it returned.
        if not user.email_verified and user.email.lower() == email:
            user.email_verified = True
            updates.append('email_verified')
        if updates:
            user.save(update_fields=updates)
        if created:
            record_audit(
                'account.registered', actor=user, target_type='User', target_id=user.pk,
                summary=f'New account registered with Google: {user.email}',
            )
        tokens = start_session(request, user, method='google')
        return Response({"user": UserSerializer(user).data, "tokens": tokens, "message": "Google authentication successful!"})


class AdminDashboardPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


class CustomerProfileViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('-created_at')
    serializer_class = UserSerializer
    permission_classes = [require_permission('users.manage')]
    pagination_class = AdminDashboardPagination

    def get_queryset(self):
        qs = super().get_queryset()
        q = self.request.query_params.get('q')
        if q:
            qs = qs.filter(Q(email__icontains=q) | Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(phone_number__icontains=q))

        # Sort ordering parameter
        ordering = self.request.query_params.get('ordering')
        if ordering == 'oldest':
            qs = qs.order_by('created_at')
        elif ordering == 'email':
            qs = qs.order_by('email')
        elif ordering == '-email':
            qs = qs.order_by('-email')
        else:
            qs = qs.order_by('-created_at')

        return qs

    @action(detail=True, methods=['get'])
    def details(self, request, pk=None):
        customer = self.get_object()
        addresses = UserAddressSerializer(customer.addresses.all(), many=True).data

        orders_qs = Order.objects.filter(email__iexact=customer.email).order_by('-created_at')
        orders_count = orders_qs.count()
        total_spent = orders_qs.aggregate(total=Sum('total'))['total'] or 0
        orders_data = [{
            'id': o.id,
            'total': o.total,
            'currency': o.currency_code,
            'status': o.status,
            'created_at': o.created_at
        } for o in orders_qs[:10]]

        activities = CustomerActivitySerializer(customer.activities.all()[:20], many=True).data
        tickets = SupportTicketSerializer(customer.support_tickets.all(), many=True).data

        return Response({
            'profile': UserSerializer(customer).data,
            'addresses': addresses,
            'orders_count': orders_count,
            'total_spent': total_spent,
            'recent_orders': orders_data,
            'activities': activities,
            'tickets': tickets
        })


class CustomerSegmentViewSet(viewsets.ModelViewSet):
    queryset = CustomerSegment.objects.all().order_by('name')
    serializer_class = CustomerSegmentSerializer
    permission_classes = [require_permission('users.manage')]


class CustomerActivityViewSet(viewsets.ModelViewSet):
    queryset = CustomerActivity.objects.all().order_by('-created_at')
    serializer_class = CustomerActivitySerializer
    permission_classes = [require_permission('users.manage')]

    def get_queryset(self):
        qs = super().get_queryset()
        email = self.request.query_params.get('email')
        if email:
            qs = qs.filter(email__iexact=email)
        return qs


class SupportTicketViewSet(viewsets.ModelViewSet):
    queryset = SupportTicket.objects.all().order_by('-created_at')
    serializer_class = SupportTicketSerializer
    permission_classes = [require_permission('users.manage')]

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get('status')
        email = self.request.query_params.get('email')
        if status_filter:
            qs = qs.filter(status=status_filter)
        if email:
            qs = qs.filter(email__iexact=email)
        return qs

    @action(detail=False, methods=['POST'], url_path='sync')
    def sync_emails(self, request):
        from .email_sync import sync_support_emails
        res = sync_support_emails()
        if res.get('status') == 'success':
            return Response({
                "message": f"Sync successful. Created {res.get('tickets_created', 0)} new tickets.",
                "tickets_created": res.get('tickets_created', 0)
            })
        else:
            return Response({"error": res.get('message')}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class TerminateDevicesView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        current_session_id = request.data.get('session_id')
        
        devices = user.current_devices or []
        if current_session_id:
            user.current_devices = [d for d in devices if d.get('id') == current_session_id]
        else:
            user.current_devices = []
            
        user.save(update_fields=['current_devices'])
        
        from apps.audit.recorder import record_audit
        record_audit('security.session_terminated', actor=user, summary=f'Terminated other active login sessions for {user.email}')
        
        return Response({
            "message": "Other active sessions terminated successfully.",
            "current_devices": user.current_devices
        })


class PasswordResetRequestView(APIView):
    """POST /api/auth/password/reset/request/ — kick off a password reset.

    Body: ``{"email": "..."}``. Always returns 200 to avoid leaking which
    addresses are registered. If the address matches an active user, a
    short-lived reset token is generated and the ``password_reset`` email
    template is dispatched with ``{reset_url}`` populated.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'password_reset'

    def post(self, request):
        from datetime import timedelta
        from django.utils import timezone as dj_tz
        from django.conf import settings

        email = (request.data.get('email') or '').strip().lower()
        if not email:
            return Response({"message": "If that email exists, a reset link has been sent."})

        user = User.objects.filter(email__iexact=email, is_active=True).first()
        if user:
            token = secrets.token_urlsafe(32)
            user.password_reset_token = hashlib.sha256(token.encode()).hexdigest()
            user.password_reset_token_expires = dj_tz.now() + timedelta(hours=1)
            user.save(update_fields=['password_reset_token', 'password_reset_token_expires'])

            try:
                from apps.orders.email_service import send_templated_email
                site_url = (getattr(settings, 'SITE_URL', '') or '').rstrip('/')
                reset_url = f"{site_url}/account/reset?token={token}"
                sent = send_templated_email(
                    'password_reset', None, user.email,
                    {
                        'customer_name': user.first_name or user.email,
                        'email': user.email,
                        'reset_url': reset_url,
                    },
                    audit_target_type='User', audit_target_id=user.id,
                )
                if not sent:
                    logger.warning('Password reset email for user %s was queued for retry.', user.pk)
            except Exception:
                logger.exception('Password reset email scheduling failed for user %s.', user.pk)

            try:
                from apps.audit.recorder import record_audit
                record_audit('auth.password_reset_requested', actor=user,
                             target_type='User', target_id=user.id,
                             summary=f'Password reset requested for {user.email}')
            except Exception:
                logger.exception('Could not record password reset request for user %s.', user.pk)

        # Always 200 — don't leak account existence.
        return Response({"message": "If that email exists, a reset link has been sent."})


class PasswordResetConfirmView(APIView):
    """POST /api/auth/password/reset/confirm/ — complete a password reset.

    Body: ``{"token": "...", "new_password": "..."}``. Rejects expired or
    unknown tokens. On success, the token is cleared and the new password
    saved.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'password_reset'

    def post(self, request):
        from django.utils import timezone as dj_tz

        token = (request.data.get('token') or '').strip()
        new_password = request.data.get('new_password') or ''
        if not token or not new_password:
            return Response({"error": "Token and new_password are required."},
                            status=status.HTTP_400_BAD_REQUEST)
        try:
            validate_password(new_password)
        except DjangoValidationError as exc:
            return Response({"error": list(exc.messages)}, status=status.HTTP_400_BAD_REQUEST)

        token_hash = hashlib.sha256(token.encode()).hexdigest()
        user = User.objects.filter(password_reset_token=token_hash).first()
        if not user or not user.password_reset_token_expires or \
                user.password_reset_token_expires < dj_tz.now():
            return Response({"error": "Invalid or expired reset token."},
                            status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.password_reset_token = ''
        user.password_reset_token_expires = None
        user.save(update_fields=['password', 'password_reset_token',
                                  'password_reset_token_expires'])

        try:
            from apps.audit.recorder import record_audit
            record_audit('auth.password_reset_completed', actor=user,
                         target_type='User', target_id=user.id,
                         summary=f'Password reset completed for {user.email}')
        except Exception:
            logger.exception('Could not record password reset completion for user %s.', user.pk)

        return Response({"message": "Your password has been reset. You can now sign in."})
