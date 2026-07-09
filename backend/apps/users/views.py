import hashlib
import secrets
import requests
from django.conf import settings
from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import viewsets, status, generics
from rest_framework.pagination import PageNumberPagination
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.password_validation import validate_password
from .models import UserAddress, Role, Wishlist, WishlistItem, CustomerSegment, CustomerActivity, SupportTicket
from .serializers import (
    UserSerializer, RegisterSerializer, UserAddressSerializer,
    RoleSerializer, StaffUserSerializer, WishlistItemSerializer, WishlistSerializer,
    CustomerSegmentSerializer, CustomerActivitySerializer, SupportTicketSerializer,
)
from .permissions import require_permission, PERMISSIONS, client_ip_is_allowed
from apps.audit.context import client_ip_from_request

User = get_user_model()

OTP_MAX_AGE_SECONDS = 10 * 60


def _new_otp_value():
    from django.utils import timezone
    code = f'{secrets.randbelow(900000) + 100000:06d}'
    expires = int(timezone.now().timestamp()) + OTP_MAX_AGE_SECONDS
    return code, f'otp:{expires}:{make_password(code)}'


def _verify_otp_value(stored, candidate):
    from django.utils import timezone
    try:
        purpose, expires, encoded = (stored or '').split(':', 2)
        if purpose != 'otp' or int(expires) < int(timezone.now().timestamp()):
            return False
        return check_password(str(candidate), encoded)
    except (TypeError, ValueError):
        return False


def _send_email_otp(email, code, subject='Your Sclero Proteins sign-in code'):
    from django.core.mail import send_mail
    send_mail(
        subject,
        f'Your verification code is {code}. It expires in 10 minutes. '
        'If you did not request this code, ignore this email.',
        settings.DEFAULT_FROM_EMAIL,
        [email],
        fail_silently=False,
    )

def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }

from rest_framework_simplejwt.views import TokenObtainPairView


class AuditedLoginView(TokenObtainPairView):
    """Password login with audit trail, IP restrictions, and 2FA gating.

    Two flavors of 2FA are supported:

    - **TOTP (authenticator-app, RFC 6238):** Enforced for staff/superuser
      accounts that have `totp_enabled=True`. If the caller supplies the
      right password but no `totp_code` we return HTTP 200 with
      `{otp_required: true}` and DO NOT issue tokens — the frontend then
      re-posts with the code. Non-staff customers may also enable TOTP, but
      they are NOT forced through it on login (to avoid locking out
      non-technical customers).
    - **Legacy email-OTP (`two_factor_enabled`):** Email-based code, retained
      as-is for backward compatibility. Only fires if TOTP is not enabled.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'auth'

    def post(self, request, *args, **kwargs):
        from apps.audit.recorder import record_audit
        import uuid
        from django.utils import timezone
        
        email = (request.data.get('email') or request.data.get('username') or '').strip()
        password = request.data.get('password') or ''
        actor = User.objects.filter(email__iexact=email).first() if email else None

        if not actor or not actor.is_active:
            record_audit(
                'login.failed',
                actor=actor if actor and actor.is_active else None,
                summary=f'Failed login attempt: {email}',
                changes={'attempted_email': email, 'reason': 'inactive_or_missing_account' if actor and not actor.is_active else 'missing_account'},
            )
            if actor and not actor.is_active:
                return Response(
                    {"detail": "This account is inactive. Please contact an administrator to reactivate it."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            return Response(
                {"detail": "Invalid email or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not check_password(password, actor.password):
            record_audit(
                'login.failed',
                actor=actor,
                summary=f'Failed login for {email}: invalid password',
                changes={'attempted_email': email},
            )
            return Response(
                {"detail": "Invalid email or password."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        # Enforce IP restrict logic on login
        client_ip = client_ip_from_request(request)
        if actor.allowed_ip_range:
            allowed_ips = [ip.strip() for ip in actor.allowed_ip_range.split(',') if ip.strip()]
            if allowed_ips and not client_ip_is_allowed(client_ip, allowed_ips):
                record_audit(
                    'login.failed',
                    actor=actor,
                    summary=f'Failed login for {email}: IP {client_ip} not allowed',
                    changes={'ip': client_ip},
                )
                return Response(
                    {"detail": f"IP address {client_ip} is not allowed to access this profile."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        # --- TOTP gate (staff/superuser only) --------------------------------
        if actor.totp_enabled and (actor.is_staff or actor.is_superuser):
            from .totp import verify_totp_or_backup
            totp_code = (request.data.get('totp_code') or '').strip()
            if not totp_code:
                # First leg: creds OK, but we need the authenticator code.
                return Response(
                    {
                        "otp_required": True,
                        "message": "Enter your authenticator code",
                    },
                    status=status.HTTP_200_OK,
                )
            if not verify_totp_or_backup(actor, totp_code):
                record_audit(
                    'login.totp_failed',
                    actor=actor,
                    summary=f'TOTP verification failed for {email}',
                )
                return Response(
                    {"detail": "Invalid authenticator code."},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
            # On backup-code consumption verify_totp_or_backup mutates
            # totp_backup_codes — persist.
            actor.save(update_fields=['totp_backup_codes'])

        tokens = get_tokens_for_user(actor)
        user_agent = request.META.get('HTTP_USER_AGENT', 'Unknown')
        session_id = str(uuid.uuid4())

        devices = actor.current_devices or []
        new_device = {
            "id": session_id,
            "ip": client_ip,
            "user_agent": user_agent,
            "last_active": timezone.now().isoformat()
        }
        # Keep last 5 devices
        devices = [new_device] + [d for d in devices if d.get('ip') != client_ip or d.get('user_agent') != user_agent][:4]
        actor.current_devices = devices
        actor.save(update_fields=['current_devices'])

        if actor.two_factor_enabled:
            otp_code, stored_otp = _new_otp_value()
            actor.otp_secret = stored_otp
            actor.save(update_fields=['otp_secret'])
            if settings.DEBUG:
                print(f"--> [2FA OTP SANDBOX] Sent OTP {otp_code} to {email}")
            try:
                _send_email_otp(email, otp_code, subject='Your Sclero Proteins two-factor code')
            except Exception:
                actor.otp_secret = ''
                actor.save(update_fields=['otp_secret'])
                return Response(
                    {"detail": "Unable to send the verification code. Try again later."},
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            record_audit('login.2fa_required', actor=actor, summary=f'2FA challenge issued for {email}')
            payload = {
                "two_factor_required": True,
                "email": email,
                "message": "Two-factor authentication is required. An OTP has been sent."
            }
            if settings.DEBUG:
                payload["otp_preview_for_sandbox"] = otp_code
            return Response(payload, status=status.HTTP_200_OK)

        record_audit('login.success', actor=actor, summary=f'Successful login: {email}')
        return Response({
            "access": tokens['access'],
            "refresh": tokens['refresh'],
            "session_id": session_id,
            "user": UserSerializer(actor).data,
        })


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer
    throttle_scope = 'auth'

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            tokens = get_tokens_for_user(user)
            from apps.audit.recorder import record_audit
            record_audit('account.registered', actor=user, target_type='User',
                         target_id=user.pk, summary=f'New account registered: {user.email}')
            try:
                from apps.orders.email_service import send_account_email
                send_account_email('welcome', user)
            except Exception:
                pass
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
        from django.forms.models import model_to_dict
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
        from django.utils.crypto import get_random_string
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


class SendOTPView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'otp'

    def post(self, request):
        identifier = (request.data.get('identifier') or '').strip().lower()
        try:
            validate_email(identifier)
        except DjangoValidationError:
            return Response(
                {"error": "Email OTP is supported. Phone OTP requires a configured SMS provider."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user, _ = User.objects.get_or_create(email=identifier)
        otp_code, stored_otp = _new_otp_value()
        user.otp_secret = stored_otp
        user.save(update_fields=['otp_secret'])

        try:
            _send_email_otp(identifier, otp_code)
        except Exception:
            user.otp_secret = ''
            user.save(update_fields=['otp_secret'])
            return Response(
                {"error": "Unable to send the verification code. Try again later."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # In Sandbox mode, we print to terminal console & return it in the response for dev ease
        if settings.DEBUG:
            print(f"--> [OTP SANDBOX] Sent OTP {otp_code} to {identifier}")

        payload = {"message": "OTP sent successfully."}
        if settings.DEBUG:
            payload["otp_preview_for_sandbox"] = otp_code
        return Response(payload)


class VerifyOTPView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'otp'

    def post(self, request):
        identifier = (request.data.get('identifier') or '').strip().lower()
        otp_code = str(request.data.get('otp') or '').strip()
        
        if not identifier or not otp_code:
            return Response({"error": "identifier and otp are required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email__iexact=identifier)
        except User.DoesNotExist:
            return Response({"error": "Invalid identifier or OTP code"}, status=status.HTTP_400_BAD_REQUEST)

        if _verify_otp_value(user.otp_secret, otp_code):
            user.otp_secret = "" # Reset OTP
            user.save()
            
            import uuid
            from django.utils import timezone
            from apps.audit.recorder import record_audit
            
            client_ip = client_ip_from_request(request)
            user_agent = request.META.get('HTTP_USER_AGENT', 'Unknown')
            session_id = str(uuid.uuid4())
            
            devices = user.current_devices or []
            new_device = {
                "id": session_id,
                "ip": client_ip,
                "user_agent": user_agent,
                "last_active": timezone.now().isoformat()
            }
            # Keep last 5 devices
            devices = [new_device] + [d for d in devices if d.get('ip') != client_ip or d.get('user_agent') != user_agent][:4]
            user.current_devices = devices
            user.save(update_fields=['current_devices'])
            
            record_audit('login.success', actor=user, summary=f'OTP login verified successfully: {user.email}')
            
            tokens = get_tokens_for_user(user)
            tokens['session_id'] = session_id
            
            return Response({
                "user": UserSerializer(user).data,
                "tokens": tokens,
                "message": "OTP verified successfully!"
            })
            
        return Response({"error": "Invalid OTP code"}, status=status.HTTP_400_BAD_REQUEST)


# --- Magic-link (passwordless click-a-link) login -------------------------- #

MAGIC_LINK_SALT = 'sclero-magic-link'
MAGIC_LINK_MAX_AGE = 15 * 60  # 15 minutes


def _safe_redirect_base(request):
    """Pick a trusted base URL for the magic link. Only allow origins we own —
    never echo an attacker-supplied origin (that would leak the token)."""
    from django.conf import settings
    origin = (request.data.get('origin') or '').rstrip('/')
    allowed = set(getattr(settings, 'CSRF_TRUSTED_ORIGINS', []) or [])
    allowed |= set(getattr(settings, 'CORS_ALLOWED_ORIGINS', []) or [])
    allowed |= {'http://localhost:3000', 'http://localhost:3100', 'http://127.0.0.1:3000'}
    if origin and origin in allowed:
        return origin
    site = (getattr(settings, 'SITE_URL', '') or '').rstrip('/')
    return site or 'http://localhost:3000'


class MagicLinkRequestView(APIView):
    """Email a one-time, time-limited sign-in link. Sandbox returns the link too."""
    permission_classes = [AllowAny]
    throttle_scope = 'auth'

    def post(self, request):
        from django.core import signing
        email = (request.data.get('email') or '').strip().lower()
        try:
            validate_email(email)
        except DjangoValidationError:
            return Response({"error": "A valid email is required."}, status=status.HTTP_400_BAD_REQUEST)

        user, _ = User.objects.get_or_create(email=email)
        # Single-use nonce stored on the user; the link is invalid once consumed.
        nonce = secrets.token_urlsafe(16)
        user.otp_secret = f"magic:{nonce}"
        user.save(update_fields=['otp_secret'])

        token = signing.dumps({'email': email, 'nonce': nonce}, salt=MAGIC_LINK_SALT)
        link = f"{_safe_redirect_base(request)}/auth/magic?token={token}"

        try:
            from apps.orders.email_service import send_templated_email
            sent = send_templated_email(
                'magic_link', user.home_region if hasattr(user, 'home_region') else None,
                email, {'magic_link': link, 'customer_name': user.first_name or 'there'},
                audit_target_type='User', audit_target_id=str(user.id),
            )
        except Exception:
            sent = False
        if not sent:
            # No template configured / send failed — fall back to a plain email.
            try:
                from django.core.mail import send_mail
                from django.conf import settings
                send_mail(
                    'Your Sclero Proteins sign-in link',
                    f'Click to sign in (valid 15 minutes):\n\n{link}\n\nIf you didn\'t request this, ignore this email.',
                    getattr(settings, 'DEFAULT_FROM_EMAIL', 'support@scleroproteins.co.uk'),
                    [email], fail_silently=True,
                )
            except Exception:
                pass
        if settings.DEBUG:
            print(f"--> [MAGIC LINK SANDBOX] {email}: {link}")

        payload = {
            "message": "Check your email for a sign-in link.",
        }
        if settings.DEBUG:
            payload["magic_link_for_sandbox"] = link
        return Response(payload)


class MagicLinkVerifyView(APIView):
    """Exchange a magic-link token for JWT tokens."""
    permission_classes = [AllowAny]
    throttle_scope = 'auth'

    def post(self, request):
        from django.core import signing
        token = request.data.get('token') or ''
        try:
            data = signing.loads(token, salt=MAGIC_LINK_SALT, max_age=MAGIC_LINK_MAX_AGE)
        except signing.SignatureExpired:
            return Response({"error": "This sign-in link has expired. Please request a new one."}, status=status.HTTP_400_BAD_REQUEST)
        except signing.BadSignature:
            return Response({"error": "Invalid sign-in link."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=data.get('email'))
        except User.DoesNotExist:
            return Response({"error": "Invalid sign-in link."}, status=status.HTTP_400_BAD_REQUEST)

        if user.otp_secret != f"magic:{data.get('nonce')}":
            return Response({"error": "This link has already been used. Please request a new one."}, status=status.HTTP_400_BAD_REQUEST)

        user.otp_secret = ""  # single use
        user.save(update_fields=['otp_secret'])

        try:
            from apps.audit.recorder import record_audit
            record_audit('login.success', actor=user, summary=f'Magic-link login: {user.email}')
        except Exception:
            pass

        return Response({
            "user": UserSerializer(user).data,
            "tokens": get_tokens_for_user(user),
            "message": "Signed in successfully.",
        })


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
        """All assignable permission keys + labels — for building the role editor UI."""
        return Response([{'key': k, 'label': v} for k, v in PERMISSIONS.items()])


class StaffUserViewSet(viewsets.ModelViewSet):
    """List staff/role-holding users and assign their roles. Gated by 'rbac.manage'."""
    serializer_class = StaffUserSerializer
    permission_classes = [require_permission('rbac.manage')]
    http_method_names = ['get', 'patch', 'head', 'options']

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

        if claims.get('aud') != client_id or claims.get('email_verified') not in (True, 'true', 'True'):
            return Response({"error": "Invalid Google credential."}, status=status.HTTP_401_UNAUTHORIZED)

        email = (claims.get('email') or '').strip().lower()
        google_id = claims.get('sub') or ''
        first_name = claims.get('given_name') or ''
        last_name = claims.get('family_name') or ''

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'google_id': google_id,
                'first_name': first_name,
                'last_name': last_name,
            }
        )

        if not created and not user.google_id:
            # User existed with standard register, link their Google ID now
            user.google_id = google_id
            user.save()

        tokens = get_tokens_for_user(user)
        return Response({
            "user": UserSerializer(user).data,
            "tokens": tokens,
            "message": "Google authentication successful!"
        })


from django.db.models import Sum
from apps.orders.models import Order

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
        import uuid
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
                send_templated_email(
                    'password_reset', None, user.email,
                    {
                        'customer_name': user.first_name or user.email,
                        'email': user.email,
                        'reset_url': reset_url,
                    },
                    audit_target_type='User', audit_target_id=user.id,
                )
            except Exception:
                pass

            try:
                from apps.audit.recorder import record_audit
                record_audit('auth.password_reset_requested', actor=user,
                             target_type='User', target_id=user.id,
                             summary=f'Password reset requested for {user.email}')
            except Exception:
                pass

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
            pass

        return Response({"message": "Your password has been reset. You can now sign in."})
