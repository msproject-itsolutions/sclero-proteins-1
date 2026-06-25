from rest_framework import viewsets, mixins, status, views
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.utils import timezone

from apps.users.permissions import require_permission
from .models import BulkEnquiry, NewsletterSubscriber
from .serializers import BulkEnquirySerializer, BulkEnquiryAdminSerializer


class BulkEnquiryCreateView(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """Public 'Enquire for Bulk' submission endpoint. POST /api/enquiries/"""
    queryset = BulkEnquiry.objects.all()
    serializer_class = BulkEnquirySerializer
    permission_classes = [AllowAny]

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
            pass
        print(f'--> [Enquiry] New {enquiry.enquiry_type} enquiry #{enquiry.pk} from {enquiry.email}')

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
            pass

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

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        if not email or '@' not in email:
            return Response({'error': 'A valid email is required.'}, status=status.HTTP_400_BAD_REQUEST)
        region = (request.data.get('region') or '').upper()
        source = (request.data.get('source') or 'footer')[:40]
        sub, created = NewsletterSubscriber.objects.get_or_create(
            email=email,
            defaults={'region_code': region, 'source': source, 'is_active': True},
        )
        if not created and not sub.is_active:
            sub.is_active = True
            sub.unsubscribed_at = None
            sub.save(update_fields=['is_active', 'unsubscribed_at'])
        try:
            from apps.audit.recorder import record_audit
            record_audit('newsletter.subscribed', target_type='NewsletterSubscriber',
                         target_id=sub.pk, summary=email,
                         changes={'region': region, 'source': source, 'created': created})
        except Exception:
            pass
        return Response({'message': 'Thanks for subscribing!', 'is_new': created},
                        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    def delete(self, request):
        email = (request.data.get('email') or request.query_params.get('email') or '').strip().lower()
        sub = NewsletterSubscriber.objects.filter(email=email).first()
        if not sub:
            return Response({'message': 'Not subscribed.'}, status=status.HTTP_404_NOT_FOUND)
        sub.is_active = False
        sub.unsubscribed_at = timezone.now()
        sub.save(update_fields=['is_active', 'unsubscribed_at'])
        return Response({'message': 'You have been unsubscribed.'})
