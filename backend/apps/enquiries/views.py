import logging

from rest_framework import viewsets, mixins, status, views
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.utils import timezone
from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError

from apps.users.permissions import require_permission
from .models import BulkEnquiry, NewsletterSubscriber
from .serializers import (
    BulkEnquirySerializer,
    BulkEnquiryAdminSerializer,
    NewsletterSubscriberSerializer,
)
from .tokens import email_from_unsubscribe_token


logger = logging.getLogger(__name__)


class BulkEnquiryCreateView(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """Public 'Enquire for Bulk' submission endpoint. POST /api/enquiries/"""
    queryset = BulkEnquiry.objects.all()
    serializer_class = BulkEnquirySerializer
    permission_classes = [AllowAny]
    throttle_scope = 'contact'

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        enquiry = serializer.save()
        # Surface in the audit trail (best-effort).
        try:
            from apps.audit.recorder import record_audit
            record_audit('enquiry.created', target_type='BulkEnquiry', target_id=enquiry.pk,
                         summary=f'{enquiry.get_enquiry_type_display()} enquiry from {enquiry.name} ({enquiry.email})')
        except Exception:
            logger.exception('Could not audit enquiry %s.', enquiry.pk)

        # Best-effort: notify the configured ops mailbox via the
        # contact_received EmailTemplate. Failures must not break submission.
        try:
            from django.conf import settings as dj_settings
            from apps.admin_dashboard.models import SystemSetting
            from apps.orders.email_service import send_templated_email

            notify_email = ''
            row = SystemSetting.objects.filter(key='CONTACT_NOTIFY_EMAIL').first()
            if row and isinstance(row.value, dict):
                notify_email = row.value.get('email') or row.value.get('value') or ''
            elif row and isinstance(row.value, str):
                notify_email = row.value
            if not notify_email:
                company = SystemSetting.objects.filter(key='COMPANY_INFO').first()
                if company and isinstance(company.value, dict):
                    notify_email = company.value.get('support') or company.value.get('email') or ''
            if not notify_email:
                notify_email = getattr(dj_settings, 'DEFAULT_FROM_EMAIL', '')

            if notify_email:
                send_templated_email(
                    'contact_received', None, notify_email,
                    {
                        'customer_name': enquiry.name,
                        'email': enquiry.email,
                        'enquiry_subject': f'{enquiry.get_enquiry_type_display()} enquiry'
                                            + (f' — {enquiry.product_interest}' if enquiry.product_interest else ''),
                        'enquiry_message': enquiry.message or '(no message provided)',
                    },
                    audit_target_type='BulkEnquiry', audit_target_id=enquiry.pk,
                )
        except Exception:
            logger.exception('Could not schedule the notification for enquiry %s.', enquiry.pk)

        return Response(
            {'message': "Thank you — your enquiry has been received. Our team will be in touch shortly.",
             'enquiry': serializer.data},
            status=status.HTTP_201_CREATED,
        )


class BulkEnquiryAdminViewSet(viewsets.ModelViewSet):
    """Admin management of bulk enquiries. Gated by 'enquiries.manage'.
    Filter with ?status=NEW|CONTACTED|QUOTED|CLOSED.
    """
    queryset = BulkEnquiry.objects.all()
    serializer_class = BulkEnquiryAdminSerializer
    permission_classes = [require_permission('enquiries.manage')]
    http_method_names = ['get', 'patch', 'head', 'options']

    def get_queryset(self):
        qs = self.queryset
        s = self.request.query_params.get('status')
        if s:
            qs = qs.filter(status=s)
        return qs


class NewsletterSubscribeView(views.APIView):
    """Public newsletter signup. Idempotent: re-subscribing a previously
    unsubscribed email reactivates them. Double opt-in is not wired here yet
    (is_confirmed stays False until a future confirmation flow lands)."""
    permission_classes = [AllowAny]
    throttle_scope = 'contact'

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        try:
            validate_email(email)
        except DjangoValidationError:
            return Response({'error': 'A valid email is required.'}, status=status.HTTP_400_BAD_REQUEST)
        phone = (request.data.get('phone_number') or request.data.get('mobile') or request.data.get('phone') or '').strip()
        if phone:
            digits = ''.join(c for c in phone if c.isdigit())
            if not 7 <= len(digits) <= 16:
                return Response({'error': 'Please enter a valid mobile/phone number.'}, status=status.HTTP_400_BAD_REQUEST)

        region = (request.data.get('region') or '').upper()
        source = (request.data.get('source') or 'footer').strip()[:40] or 'footer'
        sub, created = NewsletterSubscriber.objects.get_or_create(
            email=email,
            defaults={'region_code': region, 'phone_number': phone, 'source': source, 'is_active': True},
        )
        updated_fields = []
        if not created and not sub.is_active:
            sub.is_active = True
            sub.unsubscribed_at = None
            updated_fields.extend(['is_active', 'unsubscribed_at'])
        if phone and sub.phone_number != phone:
            sub.phone_number = phone
            updated_fields.append('phone_number')
        if region and not sub.region_code:
            sub.region_code = region
            updated_fields.append('region_code')
        if updated_fields:
            sub.save(update_fields=updated_fields)

        try:
            from apps.audit.recorder import record_audit
            record_audit('newsletter.subscribed', target_type='NewsletterSubscriber',
                         target_id=sub.pk, summary=email,
                         changes={'region': region, 'phone': phone, 'source': source, 'created': created})
        except Exception:
            logger.exception('Could not audit newsletter subscription %s.', sub.pk)
        return Response({'message': 'Thanks for subscribing!', 'is_new': created},
                        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def delete(self, request):
        token = request.data.get('token') or request.query_params.get('token') or ''
        email = email_from_unsubscribe_token(token)
        if not email:
            return Response({'error': 'This unsubscribe link is invalid.'}, status=status.HTTP_400_BAD_REQUEST)
        NewsletterSubscriber.objects.filter(email=email, is_active=True).update(
            is_active=False, unsubscribed_at=timezone.now(),
        )
        # Same answer whether or not the address was subscribed.
        return Response({'message': 'You have been unsubscribed.'})


class AdminNewsletterSubscriberViewSet(viewsets.ModelViewSet):
    """Admin CRUD for newsletter subscribers."""
    queryset = NewsletterSubscriber.objects.all().order_by('-created_at')
    serializer_class = NewsletterSubscriberSerializer
    permission_classes = [require_permission('enquiries.manage')]

    def get_queryset(self):
        qs = self.queryset
        q = (self.request.query_params.get('q') or '').strip().lower()
        if q:
            from django.db.models import Q
            qs = qs.filter(Q(email__icontains=q) | Q(phone_number__icontains=q))
        region = self.request.query_params.get('region')
        if region:
            qs = qs.filter(region_code=region.upper())
        active = self.request.query_params.get('is_active')
        if active is not None and active != '':
            qs = qs.filter(is_active=active.lower() in ('1', 'true', 'yes'))
        return qs

