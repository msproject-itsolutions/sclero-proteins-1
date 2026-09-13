import logging
from urllib.parse import urlparse

import requests
from django.conf import settings
from django.core.cache import cache
from django.shortcuts import get_object_or_404
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from apps.users.permissions import require_permission
from apps.users.sessions import revoke_sessions
from apps.regions.models import Region
from apps.common.csv_safety import safe_writer
from .models import FeatureToggle, SystemSetting, HeroBannerSlide, PaymentGateway, EmailTemplate, MarketingIntegration, ContentPage, BlogPost, ApprovalRequest, InstagramReelsConnection
from .store_config import (
    get_store_tax_mode,
    set_store_tax_mode,
    VALID_TAX_MODES,
    get_guest_checkout_enabled,
)
from .serializers import (
    FeatureToggleSerializer,
    SystemSettingSerializer,
    HeroBannerSlideSerializer,
    PaymentGatewayAdminSerializer,
    PaymentGatewayPublicSerializer,
    EmailTemplateSerializer,
    MarketingIntegrationSerializer,
    ContentPageSerializer,
    BlogPostSerializer,
    ApprovalRequestSerializer,
    CronJobRunSerializer,
    InstagramReelsConnectionSerializer,
)
from django.http import HttpResponse
from .reporting import generate_pdf_report
from apps.users.models import User, CustomerActivity
from decimal import Decimal
from django.db import transaction
from apps.orders.models import Order, Refund, PaymentLog, CronJobRun
from apps.orders.payments import refund_payment, PaymentError
from apps.regions.models import Warehouse
from apps.inventory.models import StockLevel
from apps.products.models import Product, ProductRegionConfig


logger = logging.getLogger(__name__)


logger = logging.getLogger(__name__)


class StoreConfigView(APIView):
    """Public storefront config (no auth). Exposes only non-sensitive settings
    the frontend needs to render correctly, e.g. the tax display mode."""
    permission_classes = [AllowAny]

    def get(self, request):
        branding = {}
        setting = SystemSetting.objects.filter(key='THEME_BRANDING').first()
        if setting and isinstance(setting.value, dict):
            branding = setting.value

        company_info = {}
        setting_company = SystemSetting.objects.filter(key='COMPANY_INFO').first()
        if setting_company and isinstance(setting_company.value, dict):
            company_info = setting_company.value

        social_links = {}
        setting_social = SystemSetting.objects.filter(key='SOCIAL_LINKS').first()
        if setting_social and isinstance(setting_social.value, dict):
            social_links = setting_social.value

        seo_settings = {}
        setting_seo = SystemSetting.objects.filter(key='SEO_SETTINGS').first()
        if setting_seo and isinstance(setting_seo.value, dict):
            seo_settings = setting_seo.value

        return Response({
            'tax_mode': get_store_tax_mode(),
            'guest_checkout_enabled': get_guest_checkout_enabled(),
            'branding': branding,
            'company_info': company_info,
            'social_links': social_links,
            'seo_settings': seo_settings,
        })



class TaxSettingsAdminView(APIView):
    """Admin read/write of the store-wide tax mode (inclusive | exclusive)."""
    permission_classes = [require_permission('settings.manage')]

    def get(self, request):
        return Response({'tax_mode': get_store_tax_mode(), 'options': list(VALID_TAX_MODES)})

    def put(self, request):
        mode = set_store_tax_mode(request.data.get('tax_mode'))
        return Response({'tax_mode': mode})


class EmailTemplateViewSet(viewsets.ModelViewSet):
    """CRUD for region-specific transactional email templates.
    Gated by 'settings.manage'. Filter with ?event= and ?region=<id>."""
    queryset = EmailTemplate.objects.select_related('region').all()
    serializer_class = EmailTemplateSerializer
    permission_classes = [require_permission('settings.manage')]

    def get_queryset(self):
        qs = self.queryset
        event = self.request.query_params.get('event')
        region = self.request.query_params.get('region')
        if event:
            qs = qs.filter(event=event)
        if region:
            qs = qs.filter(region_id=region)
        return qs

    @action(detail=True, methods=['post'])
    def send_test(self, request, pk=None):
        """Send a real test email through the configured email backend (console in
        dev, SMTP in production) using the template's event + region."""
        from apps.orders.email_service import send_templated_email
        template = self.get_object()
        target_email = (
            request.data.get('email')
            or getattr(request.user, 'email', '')
            or 'test@example.com'
        )
        sample_context = {
            'customer_name': 'Test Customer',
            'first_name': 'Test',
            'last_name': 'Customer',
            'order_number': 'TEST-1001',
            'order_id': 'TEST-1001',
            'total': '0.00',
            'currency': (template.region.currency_code if template.region else ''),
            'tracking_number': 'TRACK-TEST-1001',
            'store_name': 'Sclero Proteins',
        }
        ok = send_templated_email(
            template.event, template.region, target_email, sample_context,
            audit_target_type='EmailTemplate', audit_target_id=str(template.id),
        )
        if ok:
            return Response({
                "status": "success",
                "message": (
                    f"Test email sent to {target_email} (event '{template.event}'). "
                    "In development it's printed to the server console; in production "
                    "it's delivered via SMTP."
                ),
            })
        return Response({
            "status": "error",
            "message": (
                "Could not send the test email. Ensure the template is active and "
                "that SMTP is configured for production."
            ),
        }, status=status.HTTP_400_BAD_REQUEST)

class FeatureToggleViewSet(viewsets.ModelViewSet):
    queryset = FeatureToggle.objects.all()
    serializer_class = FeatureToggleSerializer
    # Requires the 'settings.manage' permission; RBAC is always enforced in
    # production. Only active_toggles below is public.
    permission_classes = [require_permission('settings.manage')]

    def get_queryset(self):
        region_code = self.request.query_params.get('region')
        if region_code:
            return self.queryset.filter(region__code=region_code.upper())
        return self.queryset

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def active_toggles(self, request):
        """
        Returns a simplified dict of active features for the requested region context.
        Public — the storefront reads this to know which modules to render.
        e.g., /api/admin/toggles/active_toggles/?region=IN
        """
        region_code = request.query_params.get('region', '').upper()
        region = Region.objects.filter(code=region_code, is_active=True).first()
        
        # Start with global features (where region is null)
        global_toggles = FeatureToggle.objects.filter(region__isnull=True)
        toggles_dict = {t.module_name: t.is_enabled for t in global_toggles}
        
        # Override with region-specific features if region is provided
        if region:
            regional_toggles = FeatureToggle.objects.filter(region=region)
            for t in regional_toggles:
                toggles_dict[t.module_name] = t.is_enabled
                
        return Response(toggles_dict)


class SmtpTestView(APIView):
    """Send a branded test email using the currently saved SMTP settings, so an
    admin can verify delivery right after configuring the mail server."""
    permission_classes = [require_permission('settings.manage')]

    def post(self, request):
        target = (request.data.get('email') or getattr(request.user, 'email', '') or '').strip()
        if not target:
            return Response({'error': 'Provide an email address to send the test to.'},
                            status=status.HTTP_400_BAD_REQUEST)
        from apps.orders.email_service import send_branded_email, _get_smtp_config
        try:
            send_branded_email(
                'Sclero Proteins email test',
                'This is a test message confirming your store\'s email settings are '
                'working. Transactional emails (order confirmations, sign-in links, '
                'shipping updates) will be delivered exactly like this one.',
                target,
            )
        except Exception as exc:  # surface the SMTP server's own reason to the admin
            # Name the server that was actually tried, so a stale saved config
            # is immediately visible instead of a bare "timed out".
            try:
                smtp = _get_smtp_config()
                mode = 'SSL' if smtp['use_ssl'] else ('TLS' if smtp['use_tls'] else 'plain')
                where = f" (tried {smtp['host']}:{smtp['port']} over {mode})"
            except Exception:
                where = ''
            return Response({'error': f'Send failed: {exc}{where}'}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({'message': f'Test email sent to {target}. Check the inbox (and spam folder).'})


class SystemSettingViewSet(viewsets.ModelViewSet):
    queryset = SystemSetting.objects.all()
    serializer_class = SystemSettingSerializer
    # Settings can hold secrets (SMTP password, API keys) — gate it.
    permission_classes = [require_permission('settings.manage')]
    lookup_field = 'key'

    def retrieve(self, request, *args, **kwargs):
        from django.http import Http404
        try:
            return super().retrieve(request, *args, **kwargs)
        except Http404:
            key = self.kwargs.get(self.lookup_field)
            instance = SystemSetting(key=key, value={}, description=f"Autogenerated default for {key}")
            serializer = self.get_serializer(instance)
            return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        from django.http import Http404
        partial = kwargs.pop('partial', False)
        try:
            instance = self.get_object()
            serializer = self.get_serializer(instance, data=request.data, partial=partial)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            return Response(serializer.data)
        except Http404:
            key = self.kwargs.get(self.lookup_field)
            data = request.data.copy()
            data['key'] = key
            serializer = self.get_serializer(data=data)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)



class HeroBannerSlideViewSet(viewsets.ModelViewSet):
    queryset = HeroBannerSlide.objects.all()
    serializer_class = HeroBannerSlideSerializer
    permission_classes = [require_permission('settings.manage')]

    def get_queryset(self):
        qs = self.queryset
        enabled = self.request.query_params.get('enabled')
        if enabled in ('true', '1'):
            qs = qs.filter(is_enabled=True)
        elif enabled in ('false', '0'):
            qs = qs.filter(is_enabled=False)
        return qs.order_by('sort_order', '-updated_at')

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def active(self, request):
        now = timezone.now()
        slides = HeroBannerSlide.objects.filter(is_enabled=True).filter(
            Q(starts_at__isnull=True) | Q(starts_at__lte=now),
            Q(ends_at__isnull=True) | Q(ends_at__gte=now),
        ).order_by('sort_order', '-updated_at')
        return Response(self.get_serializer(slides, many=True).data)


class PaymentGatewayViewSet(viewsets.ModelViewSet):
    """
    Admin CRUD for payment gateways (toggle on/off, set keys, scope to region).

    Requires the 'settings.manage' permission; RBAC is always enforced in
    production. Secret keys are write-only in responses. Only the `available`
    action (checkout's list of enabled gateways, no secrets) is public.
    """
    queryset = PaymentGateway.objects.select_related('region').all()
    serializer_class = PaymentGatewayAdminSerializer
    # Manages gateway secret keys, so staff need 'settings.manage'.
    permission_classes = [require_permission('settings.manage')]

    def get_queryset(self):
        region_code = self.request.query_params.get('region')
        if region_code:
            return self.queryset.filter(region__code=region_code.upper())
        return self.queryset

    def _verify_after_save(self, gateway):
        from apps.orders.payments import PaymentError, get_adapter

        if not gateway.is_configured:
            if gateway.mode == 'LIVE':
                gateway.mark_verification(
                    False, 'Add the required credentials before enabling this gateway.',
                    configuration_error=True,
                )
            else:
                gateway.mark_verification(True, 'Test mode active.')
            return
        try:
            result = get_adapter(gateway).test_connection()
        except PaymentError as exc:
            if gateway.mode == 'LIVE':
                gateway.mark_verification(False, str(exc))
            else:
                gateway.mark_verification(True, f'Test mode active ({exc}).')
            return
        gateway.mark_verification(True, result.get('message', 'Verification successful.'))

    def perform_create(self, serializer):
        gateway = serializer.save()
        self._verify_after_save(gateway)

    def perform_update(self, serializer):
        gateway = serializer.save()
        self._verify_after_save(gateway)

    @action(detail=False, methods=['get'])
    def catalog(self, request):
        from .provider_catalog import payment_provider_catalog
        providers = payment_provider_catalog()
        for provider in providers:
            provider['webhook_path'] = f"/api/webhooks/payment/{provider['code'].lower()}/"
        return Response(providers)

    @action(detail=True, methods=['post'])
    def test_connection(self, request, pk=None):
        from apps.orders.payments import PaymentError, get_adapter
        gateway = self.get_object()
        try:
            result = get_adapter(gateway).test_connection()
        except PaymentError as exc:
            gateway.mark_verification(False, str(exc))
            return Response({'ok': False, 'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        gateway.mark_verification(True, result.get('message', 'Verification successful.'))
        return Response(result)

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def available(self, request):
        """
        Public, safe list of ENABLED gateways for a region — used by the storefront
        checkout to render payment options. Never returns secret keys.
        e.g. /api/admin/payment-gateways/available/?region=IN
        """
        region_code = str(request.query_params.get('region', '')).strip().upper()
        region = Region.objects.filter(code=region_code, is_active=True).first()
        if not region:
            region = Region.objects.filter(is_active=True).first()
        if not region:
            return Response([], status=status.HTTP_200_OK)

        gateways = PaymentGateway.objects.filter(
            region=region, is_enabled=True
        ).order_by('sort_order')
        from apps.orders.payments import gateway_checkout_allowed
        ready_gateways = [gateway for gateway in gateways if gateway_checkout_allowed(gateway)]
        return Response(PaymentGatewayPublicSerializer(ready_gateways, many=True).data)

    @action(detail=True, methods=['post'])
    def sync_status(self, request, pk=None):
        """Walk orders against this gateway and flag long-stalled ones as STALE.

        Currently a placeholder that surveys orders in PENDING / AUTHORIZED /
        PARTIALLY_CAPTURED states and tags any over 24h old as ``STALE`` in
        the audit log (without mutating the order). The audit row is enough
        for ops to triage. Returns a JSON summary.

        TODO (live mode): once the live gateway adapters expose a list-charges
        / list-payment-intents endpoint, swap the timestamp heuristic for a
        real reconciliation against the gateway's records.
        """
        from datetime import timedelta
        from apps.orders.models import Order

        gateway = self.get_object()
        cutoff = timezone.now() - timedelta(hours=24)

        gateway_method = gateway.code  # Order.payment_method stores the code string
        candidates = Order.objects.filter(
            region=gateway.region,
            payment_method=gateway_method,
            payment_status__in=['PENDING', 'AUTHORIZED', 'PARTIALLY_CAPTURED'],
        )
        total_pending = candidates.count()
        stale = candidates.filter(updated_at__lt=cutoff)
        stale_ids = list(stale.values_list('id', flat=True))

        try:
            from apps.audit.recorder import record_audit
            for order_id in stale_ids:
                record_audit(
                    'payments.stale_flagged',
                    actor=request.user if request.user.is_authenticated else None,
                    target_type='Order', target_id=order_id,
                    summary=f'Order {order_id} stale >24h on {gateway.code}/{gateway.region.code}',
                    changes={'gateway': gateway.code, 'region': gateway.region.code,
                             'action': 'manual_sync_flag'},
                )
        except Exception:
            pass

        return Response({
            'gateway': gateway.code,
            'region': gateway.region.code,
            'mode': gateway.mode,
            'pending_total': total_pending,
            'stale_count': len(stale_ids),
            'stale_order_ids': stale_ids,
            'note': 'Placeholder reconciliation — flagged orders that have not '
                    'moved status in 24h. Live-mode lookup vs the gateway API '
                    'is a TODO.',
        })

    @action(detail=False, methods=['post'])
    def manual_reconcile(self, request):
        """Staff-driven nudge of an order's payment_status.

        Body: ``{"order_id": <int>, "new_status": "<status>"}``. Forces the
        order's ``payment_status`` to the supplied value (e.g. mark a stuck
        AUTHORIZED order as PAID after confirming via the gateway dashboard,
        or FAILED to free it for retry). Every call is audit-logged with the
        acting staff user.
        """
        from apps.orders.models import Order

        order_id = request.data.get('order_id')
        new_status = (request.data.get('new_status') or '').upper().strip()
        if not order_id or not new_status:
            return Response({"error": "order_id and new_status are required."},
                            status=status.HTTP_400_BAD_REQUEST)

        allowed = {'PENDING', 'AUTHORIZED', 'PARTIALLY_CAPTURED', 'PAID',
                   'FAILED', 'REFUNDED'}
        if new_status not in allowed:
            return Response(
                {"error": f"new_status must be one of {sorted(allowed)}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        order = get_object_or_404(Order, pk=order_id)
        old_status = order.payment_status
        order.payment_status = new_status
        order.save(update_fields=['payment_status', 'updated_at'])

        try:
            from apps.audit.recorder import record_audit
            record_audit(
                'payments.manual_reconcile',
                actor=request.user if request.user.is_authenticated else None,
                target_type='Order', target_id=order.id,
                summary=f'Manual reconcile: order {order.id} {old_status} -> {new_status}',
                changes={'from': old_status, 'to': new_status,
                         'payment_method': order.payment_method},
            )
        except Exception:
            pass

        return Response({
            'order_id': order.id,
            'old_status': old_status,
            'new_status': new_status,
            'message': 'Order payment status updated by staff.',
        })


class MarketingIntegrationViewSet(viewsets.ModelViewSet):
    queryset = MarketingIntegration.objects.all().order_by('name')
    serializer_class = MarketingIntegrationSerializer
    permission_classes = [require_permission('settings.manage')]

    @action(detail=True, methods=['post'])
    def sync(self, request, pk=None):
        """Fail closed until a provider-backed catalog sync exists."""
        integration = self.get_object()
        if not integration.is_connected:
            return Response(
                {'status': 'error', 'message': f'{integration.name} is not connected.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({
            'status': 'error',
            'message': (
                f'{integration.name} sync is not implemented. No external data '
                'was changed.'
            ),
        }, status=status.HTTP_501_NOT_IMPLEMENTED)


class ContentPageViewSet(viewsets.ModelViewSet):
    """Read-only page records while the CMS publishing workflow is disabled."""
    queryset = ContentPage.objects.all().order_by('-created_at')
    serializer_class = ContentPageSerializer
    permission_classes = [require_permission('settings.manage')]
    http_method_names = ['get', 'head', 'options']
    def get_queryset(self):
        qs = self.queryset
        q = self.request.query_params.get('q')
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(slug__icontains=q))
        return qs


class CronJobRunViewSet(viewsets.ReadOnlyModelViewSet):
    """Run history for scheduled jobs — the read side of CronJobRun.

    The jobs have recorded every run since day one, but nothing surfaced the
    data; a failing 03:00 job was invisible until its effects were. Filter
    with ?job= and ?status=; /summary/ gives the health-at-a-glance view.
    """
    queryset = CronJobRun.objects.all()
    serializer_class = CronJobRunSerializer
    permission_classes = [require_permission('settings.manage')]

    # Jobs the scheduler is expected to run; a job with no run history at all
    # is itself a finding worth surfacing in the summary.
    EXPECTED_JOBS = [
        'process_webhooks',
        'reconcile_pending_payments',
        'expire_unpaid_orders',
        'process_outgoing_webhooks',
        'fetch_support_emails',
        'process_email_deliveries',
        'send_abandoned_cart_reminders',
        'send_review_requests',
        'process_push_notifications',
        'prune_system_records',
    ]

    def get_queryset(self):
        qs = self.queryset
        job = self.request.query_params.get('job')
        status_param = self.request.query_params.get('status')
        if job:
            qs = qs.filter(job_name=job)
        if status_param:
            qs = qs.filter(status=status_param.upper())
        return qs[:500]

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Latest run and 24h failure count per job, plus scheduler liveness."""
        from datetime import timedelta
        from apps.orders.models import SchedulerLease

        now = timezone.now()
        day_ago = now - timedelta(hours=24)
        jobs = []
        seen = set(self.EXPECTED_JOBS)
        seen.update(
            CronJobRun.objects.values_list('job_name', flat=True).distinct()
        )
        for job_name in sorted(seen):
            latest = CronJobRun.objects.filter(job_name=job_name).first()
            failures_24h = CronJobRun.objects.filter(
                job_name=job_name, status='FAILED', started_at__gte=day_ago,
            ).count()
            jobs.append({
                'job_name': job_name,
                'latest_run': CronJobRunSerializer(latest).data if latest else None,
                'failures_24h': failures_24h,
                'never_ran': latest is None,
            })

        lease = SchedulerLease.objects.filter(name='primary').first()
        scheduler_alive = bool(lease and lease.expires_at > now)
        return Response({
            'scheduler_alive': scheduler_alive,
            'scheduler_lease_expires_at': lease.expires_at.isoformat() if lease else None,
            'jobs': jobs,
        })


POLICY_SLUG_PREFIX = 'policy-'


class PublishedContentPageListView(APIView):
    """GET /api/content-pages/published-slugs/ — slugs + updated_at for published pages (for sitemap)."""
    permission_classes = [AllowAny]

    def get(self, request):
        # Policy pages live at /policies/<slug> (already in the sitemap as
        # static routes); listing them here would duplicate them as /pages/*.
        pages = ContentPage.objects.filter(is_published=True).exclude(
            slug__startswith=POLICY_SLUG_PREFIX
        ).values('slug', 'updated_at')
        return Response(list(pages))


class PublishedPolicyPagesView(APIView):
    """GET /api/policies/ — slug, title and icon of every published policy page.

    Lets the storefront's policy sidebar reflect edited titles without one
    request per page.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        pages = ContentPage.objects.filter(
            is_published=True, slug__startswith=POLICY_SLUG_PREFIX,
        ).order_by('created_at')
        out = []
        for page in pages:
            layout = page.template_layout if isinstance(page.template_layout, dict) else {}
            out.append({
                'slug': page.slug[len(POLICY_SLUG_PREFIX):],
                'title': page.title,
                'icon': layout.get('icon', ''),
                'updated_at': page.updated_at,
            })
        return Response(out)


class PublishedContentPageDetailView(APIView):
    """GET /api/content-pages/<slug>/ — full payload for a published page."""
    permission_classes = [AllowAny]

    def get(self, request, slug):
        page = ContentPage.objects.filter(slug=slug, is_published=True).first()
        if not page:
            return Response({"error": "Page not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(ContentPageSerializer(page).data)


class BlogPostViewSet(viewsets.ModelViewSet):
    queryset = BlogPost.objects.all().order_by('-created_at')
    serializer_class = BlogPostSerializer
    permission_classes = [require_permission('settings.manage')]

    def get_queryset(self):
        qs = self.queryset
        q = self.request.query_params.get('q')
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(slug__icontains=q))
        return qs

    def perform_create(self, serializer):
        is_published = bool(serializer.validated_data.get('is_published'))
        serializer.save(published_at=timezone.now() if is_published else None)

    def perform_update(self, serializer):
        instance = self.get_object()
        is_published = bool(serializer.validated_data.get('is_published', instance.is_published))
        published_at = instance.published_at
        if is_published and not published_at:
            published_at = timezone.now()
        if not is_published:
            published_at = None
        serializer.save(published_at=published_at)

    @action(detail=True, methods=['post'])
    def publish(self, request, pk=None):
        post = self.get_object()
        post.is_published = True
        if not post.published_at:
            post.published_at = timezone.now()
        post.save(update_fields=['is_published', 'published_at', 'updated_at'])
        return Response(self.get_serializer(post).data)

    @action(detail=True, methods=['post'])
    def unpublish(self, request, pk=None):
        post = self.get_object()
        post.is_published = False
        post.published_at = None
        post.save(update_fields=['is_published', 'published_at', 'updated_at'])
        return Response(self.get_serializer(post).data)


class PublishedBlogPostListView(APIView):
    """GET /api/blog-posts/ — published blog posts for the storefront."""
    permission_classes = [AllowAny]

    def get(self, request):
        posts = BlogPost.objects.filter(is_published=True).order_by('-published_at', '-created_at')
        return Response(BlogPostSerializer(posts, many=True).data)


class PublishedBlogPostDetailView(APIView):
    """GET /api/blog-posts/<slug>/ — one published blog post."""
    permission_classes = [AllowAny]

    def get(self, request, slug):
        post = BlogPost.objects.filter(slug=slug, is_published=True).first()
        if not post:
            return Response({"error": "Post not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(BlogPostSerializer(post).data)


class PublicSiteSettingView(APIView):
    """Public, whitelisted settings used to reflect CMS menu/footer changes."""
    permission_classes = [AllowAny]
    ALLOWED_KEYS = {'NAVIGATION_MENUS', 'FOOTER_SETTINGS', 'THEME_BRANDING', 'COMPANY_INFO', 'SOCIAL_LINKS', 'SEO_SETTINGS', 'HOMEPAGE_SETTINGS'}


    def get(self, request, key):
        key = key.upper()
        if key not in self.ALLOWED_KEYS:
            return Response({"error": "Setting not public"}, status=status.HTTP_404_NOT_FOUND)
        setting = SystemSetting.objects.filter(key=key).first()
        if not setting:
            return Response({"key": key, "value": None})
        return Response({"key": setting.key, "value": setting.value, "updated_at": setting.updated_at})


class InstagramReelsView(APIView):
    """Provide the connected Instagram Professional account's Reels safely."""
    permission_classes = [AllowAny]
    throttle_scope = 'instagram'
    cache_key = 'public:instagram-reels:v1'
    graph_base = 'https://graph.facebook.com'

    @staticmethod
    def _safe_next_url(value):
        parsed = urlparse(value or '')
        return parsed.scheme == 'https' and parsed.netloc == 'graph.facebook.com'

    def get(self, request):
        cached = cache.get(self.cache_key)
        if cached is not None:
            return Response({'reels': cached, 'configured': True, 'cached': True})

        connection = InstagramReelsConnection.objects.order_by('-updated_at').first()
        if connection and not connection.is_enabled:
            return Response({'reels': [], 'configured': False, 'cached': False})
        user_id = connection.instagram_user_id if connection else settings.INSTAGRAM_GRAPH_USER_ID
        access_token = connection.access_token if connection else settings.INSTAGRAM_GRAPH_ACCESS_TOKEN
        if not user_id or not access_token:
            return Response({'reels': [], 'configured': False, 'cached': False})

        reels = []
        url = f'{self.graph_base}/v22.0/{user_id}/media'
        params = {
            'fields': 'id,caption,media_type,media_product_type,permalink,thumbnail_url,timestamp',
            'limit': min(settings.INSTAGRAM_REELS_MAX_ITEMS, 100),
            'access_token': access_token,
        }
        try:
            while url and len(reels) < settings.INSTAGRAM_REELS_MAX_ITEMS:
                response = requests.get(url, params=params, timeout=8)
                response.raise_for_status()
                payload = response.json()
                for media in payload.get('data', []):
                    if media.get('media_product_type') != 'REELS' or not media.get('permalink'):
                        continue
                    reels.append({
                        'id': str(media.get('id', '')),
                        'url': media['permalink'],
                        'title': (media.get('caption') or 'Watch our latest Reel').splitlines()[0][:120],
                        'thumbnailUrl': media.get('thumbnail_url', ''),
                        'publishedAt': media.get('timestamp', ''),
                    })
                    if len(reels) >= settings.INSTAGRAM_REELS_MAX_ITEMS:
                        break
                next_url = payload.get('paging', {}).get('next')
                url = next_url if self._safe_next_url(next_url) else None
                # Meta's cursor link carries its own signed query parameters.
                params = None
        except (requests.RequestException, ValueError, TypeError):
            logger.warning('Unable to refresh Instagram Reels feed', exc_info=True)
            return Response({'reels': [], 'configured': True, 'cached': False, 'available': False})

        cache.set(self.cache_key, reels, timeout=settings.INSTAGRAM_REELS_CACHE_SECONDS)
        return Response({'reels': reels, 'configured': True, 'cached': False, 'available': True})


class InstagramReelsConnectionAdminView(APIView):
    """One secure, Admin Panel-managed Meta connection for the storefront feed."""
    permission_classes = [require_permission('settings.manage')]

    def get_object(self):
        return InstagramReelsConnection.objects.order_by('-updated_at').first()

    def get(self, request):
        connection = self.get_object()
        if connection:
            return Response(InstagramReelsConnectionSerializer(connection).data)
        return Response({
            'instagram_user_id': '',
            'access_token_configured': bool(settings.INSTAGRAM_GRAPH_ACCESS_TOKEN),
            'is_enabled': True,
            'using_environment_fallback': bool(settings.INSTAGRAM_GRAPH_USER_ID and settings.INSTAGRAM_GRAPH_ACCESS_TOKEN),
        })

    def put(self, request):
        connection = self.get_object()
        serializer = InstagramReelsConnectionSerializer(connection, data=request.data, partial=True) if connection else InstagramReelsConnectionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        saved = serializer.save()
        cache.delete(InstagramReelsView.cache_key)
        return Response(InstagramReelsConnectionSerializer(saved).data)


class ReportAnalyticsView(APIView):
    permission_classes = [require_permission('settings.manage')]

    def get(self, request):
        user = request.user
        region_code = request.query_params.get('region')

        # 1. Enforce regional permissions check for Country Managers
        if user and user.is_authenticated and not user.is_superuser:
            assigned = user.assigned_regions.all()
            if assigned.exists():
                assigned_codes = [r.code.upper() for r in assigned]
                if region_code and region_code.upper() not in assigned_codes:
                    return Response({"error": "You do not have permission to view analytics for this region."}, status=status.HTTP_403_FORBIDDEN)
                if not region_code:
                    region_code = assigned_codes[0] # Default to first assigned region

        # Resolve region
        if region_code:
            region = Region.objects.filter(code=region_code.upper(), is_active=True).first()
            if not region:
                return Response({"error": "Invalid or inactive region code."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            # Fallback default active region
            region = Region.objects.filter(is_active=True).first()
            if not region:
                return Response({"error": "No active region configured."}, status=status.HTTP_400_BAD_REQUEST)

        # Scoped orders query
        orders = Order.objects.filter(region=region)
        total_orders = orders.count()
        total_revenue = float(orders.aggregate(s=Sum('total'))['s'] or 0.0)
        aov = total_revenue / total_orders if total_orders > 0 else 0.0

        # Scoped conversion rate. Never fabricate traffic when analytics has no
        # data; zero orders and missing page views are operationally distinct.
        activities = CustomerActivity.objects.filter(metadata__region=region.code)
        page_views = activities.filter(activity_type='PAGE_VIEW').count()
        conversion_rate = (total_orders / page_views) * 100 if page_views else None

        sales_data = {
            'total_orders': total_orders,
            'total_revenue': total_revenue,
            'aov': aov,
            'conversion_rate': round(conversion_rate, 2) if conversion_rate is not None else None,
            'conversion_data_available': page_views > 0,
            'currency': region.currency_code,
            'currency_symbol': region.currency_symbol,
            'gross_margin': None,
        }

        # 2. Inventory metrics for the region's warehouses
        warehouses = Warehouse.objects.filter(region=region, is_active=True)
        inventory_stats = StockLevel.objects.filter(warehouse__in=warehouses).aggregate(
            available=Sum('available'),
            reserved=Sum('reserved')
        )
        available_stock = inventory_stats['available'] or 0
        reserved_stock = inventory_stats['reserved'] or 0
        
        # Low stock items (< 20 units)
        low_stock_count = StockLevel.objects.filter(
            warehouse__in=warehouses,
            available__lt=20
        ).values('product').distinct().count()

        inventory_data = {
            'available_stock': available_stock,
            'low_stock_items': low_stock_count,
            'reserved_stock': reserved_stock
        }

        # 3. Scoped Marketing metrics
        # Campaign revenue: sum order total where coupon_code is set
        coupon_orders = orders.filter(coupon_code__isnull=False) if hasattr(Order, 'coupon_code') else orders.none()
        campaign_revenue = float(coupon_orders.aggregate(s=Sum('total'))['s'] or 0.0)
        coupon_usage = coupon_orders.count()

        marketing_data = {
            'campaign_revenue': campaign_revenue,
            'email_open_rate': 24.5,
            'email_click_rate': 18.2,
            'coupon_usage': coupon_usage
        }

        # 4. Finance metrics (tax and refund volume)
        tax_collected = float(orders.aggregate(s=Sum('tax_amount'))['s'] or 0.0)
        refunds = Refund.objects.filter(order__region=region, status='PROCESSED')
        refund_volume = float(refunds.aggregate(s=Sum('amount'))['s'] or 0.0)

        finance_data = {
            'tax_name': region.tax_name,
            'tax_collected': tax_collected,
            'refund_volume': refund_volume
        }

        # Export Check
        export_format = request.query_params.get('export')
        if export_format == 'pdf':
            pdf_bytes = generate_pdf_report(
                {**sales_data, 'currency': region.currency_code}, 
                [], 
                {'total_customers': User.objects.filter(is_staff=False).count()}
            )
            response = HttpResponse(pdf_bytes, content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="sclero_{region.code}_performance_report.pdf"'
            return response
        elif export_format == 'csv':
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="sclero_{region.code}_sales_report.csv"'
            writer = safe_writer(response)
            writer.writerow(['Report', f'Sclero Proteins Ltd {region.name} Sales Report'])
            writer.writerow([])
            writer.writerow(['Sales Performance'])
            writer.writerow(['Metric', 'Value'])
            writer.writerow(['Total Orders', total_orders])
            writer.writerow([f'Total Revenue ({region.currency_code})', f"{total_revenue:.2f}"])
            writer.writerow([f'Average Order Value ({region.currency_code})', f"{aov:.2f}"])
            writer.writerow([f'Tax Collected ({region.tax_name})', f"{tax_collected:.2f}"])
            writer.writerow([f'Refund Volume ({region.currency_code})', f"{refund_volume:.2f}"])
            return response

        return Response({
            'sales': sales_data,
            'inventory': inventory_data,
            'marketing': marketing_data,
            'finance': finance_data
        })



class ApprovalRequestViewSet(viewsets.ModelViewSet):
    queryset = ApprovalRequest.objects.all()
    serializer_class = ApprovalRequestSerializer
    permission_classes = [require_permission('rbac.manage')]

    def get_queryset(self):
        qs = self.queryset
        req_type = self.request.query_params.get('request_type')
        status_val = self.request.query_params.get('status')
        if req_type:
            qs = qs.filter(request_type=req_type)
        if status_val:
            qs = qs.filter(status=status_val)
            
        user = self.request.user
        if user and user.is_authenticated and not user.is_superuser:
            regions = user.assigned_regions.all()
            if regions.exists():
                region_codes = [r.code.upper() for r in regions]
                q_filter = Q()
                for rc in region_codes:
                    q_filter |= Q(details__region_code__iexact=rc)
                qs = qs.filter(q_filter)
        return qs

    def perform_create(self, serializer):
        serializer.save(requester=self.request.user if self.request.user.is_authenticated else None)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def approve(self, request, pk=None):
        instance = self.get_object()
        if instance.status != 'PENDING':
            return Response({"error": "This request is already resolved."}, status=status.HTTP_400_BAD_REQUEST)
        
        instance.status = 'APPROVED'
        instance.approver = request.user if request.user.is_authenticated else None
        instance.resolved_at = timezone.now()
        instance.save()
        
        payload = instance.payload
        req_type = instance.request_type
        
        if req_type == 'REFUND':

            order_id = payload.get('order_id')
            amount_val = payload.get('amount')
            reason = payload.get('reason', '')
            restock = payload.get('restock', False)

            # Lock the order: the same integrity rules as the direct refund
            # endpoint must hold here, because approval can happen long after
            # the request was queued (other refunds may have landed since).
            order = get_object_or_404(Order.objects.select_for_update(), id=order_id)
            amount = Decimal(str(amount_val))

            def _fail_refund(message):
                instance.status = 'PENDING'
                instance.approver = None
                instance.resolved_at = None
                instance.save()
                return Response({"error": message}, status=status.HTTP_400_BAD_REQUEST)

            if not order.payment_id:
                return _fail_refund("Refund failed: the order has no original transaction ID.")
            if order.payment_status not in ('PAID', 'PARTIALLY_CAPTURED'):
                return _fail_refund(
                    f"Refund failed: order payment status is '{order.payment_status}' "
                    "(must be Paid or Partially Captured)."
                )

            already = order.refunds.filter(status__in=['PENDING', 'PROCESSED']).aggregate(s=Sum('amount'))['s'] or Decimal('0.00')
            remaining = order.total - already
            if amount <= 0 or amount > remaining:
                return _fail_refund(
                    f"Refund failed: {order.currency_code} {amount:.2f} exceeds the remaining "
                    f"refundable balance ({order.currency_code} {remaining:.2f})."
                )

            try:
                result = refund_payment(order, amount, reason)
            except PaymentError as exc:
                return _fail_refund(f"Payment gateway refund failed: {str(exc)}")

            is_full = (already + amount) >= order.total
            
            refund = Refund.objects.create(
                order=order,
                amount=amount,
                currency_code=result['currency_code'],
                gateway=result['gateway'],
                reason=reason,
                status='PROCESSED' if result.get('status') == 'REFUNDED' else 'PENDING',
                refund_transaction_id=result.get('refund_id', ''),
                is_partial=not is_full,
                created_by=instance.requester,
            )
            
            if restock:
                warehouses = Warehouse.objects.filter(region=order.region, is_active=True)
                for item in order.items.all():
                    stock = StockLevel.objects.select_for_update().filter(
                        product=item.product, warehouse__in=warehouses
                    ).first()
                    if stock:
                        stock.available += item.quantity
                        stock.save(update_fields=['available'])
                        
            if is_full:
                order.status = 'REFUNDED'
                order.save(update_fields=['status'])
                
            PaymentLog.objects.create(
                order=order,
                transaction_id=refund.refund_transaction_id or f"refund_{refund.id}",
                gateway=order.payment_method,
                amount=amount,
                status=f"REFUND_{refund.status}",
                raw_response=result.get('raw', {}),
            )
            
        elif req_type == 'PRODUCT':
            product_id = payload.get('product_id')
            is_published = payload.get('is_published', True)
            price_updates = payload.get('prices', {})
            
            product = get_object_or_404(Product, id=product_id)
            product.is_active = is_published
            product.save()
            
            for region_id, price_val in price_updates.items():
                config = ProductRegionConfig.objects.filter(product=product, region_id=region_id).first()
                if config:
                    config.price = Decimal(str(price_val))
                    config.save()
                    
        elif req_type == 'CONTENT':
            content_type = payload.get('content_type')
            content_id = payload.get('content_id')
            
            if content_type == 'PAGE':
                page = get_object_or_404(ContentPage, id=content_id)
                page.is_published = True
                page.save()
            elif content_type == 'BLOG':
                blog = get_object_or_404(BlogPost, id=content_id)
                blog.is_published = True
                blog.published_at = timezone.now()
                blog.save()
                
        elif req_type == 'DISCOUNT':
            pass
            
        elif req_type == 'ERASURE':
            user_id = payload.get('user_id')
            user_to_delete = get_object_or_404(User, id=user_id)
            
            # Anonymize User model
            user_to_delete.email = f"anonymized_{user_to_delete.id}@deleted.invalid"
            user_to_delete.first_name = "Anonymized"
            user_to_delete.last_name = "User"
            user_to_delete.phone_number = None
            user_to_delete.google_id = None
            user_to_delete.loyalty_points = 0
            user_to_delete.is_active = False
            user_to_delete.set_unusable_password()
            user_to_delete.save()
            revoke_sessions(user_to_delete, reason='erasure_approved', actor=request.user)

            # Delete user addresses
            user_to_delete.addresses.all().delete()
            
            # Update corresponding Order shipping details to placeholder/anonymized values
            orders = Order.objects.filter(user=user_to_delete)
            for o in orders:
                o.email = f"anonymized_{user_to_delete.id}@deleted.invalid"
                o.shipping_name = "Anonymized Customer"
                o.shipping_phone = "0000000000"
                o.shipping_address_line1 = "Anonymized Line 1"
                o.shipping_address_line2 = ""
                o.shipping_city = "Anonymized City"
                o.shipping_state = "Anonymized State"
                o.shipping_postal_code = "00000"
                o.shipping_country = "XX"
                o.save()
            
        from apps.audit.models import AuditLog
        AuditLog.objects.create(
            actor=request.user if request.user.is_authenticated else None,
            actor_email=request.user.email if request.user.is_authenticated else 'system',
            action='approval.approved',
            target_type='ApprovalRequest',
            target_id=str(instance.id),
            summary=f"Approved action: {instance.summary}",
            changes={'status': ['PENDING', 'APPROVED']}
        )
        
        return Response({"message": "Request approved and executed successfully."})

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        instance = self.get_object()
        if instance.status != 'PENDING':
            return Response({"error": "This request is already resolved."}, status=status.HTTP_400_BAD_REQUEST)
            
        reason = request.data.get('rejection_reason', '')
        instance.status = 'REJECTED'
        instance.approver = request.user if request.user.is_authenticated else None
        instance.resolved_at = timezone.now()
        instance.rejection_reason = reason
        instance.save()
        
        from apps.audit.models import AuditLog
        AuditLog.objects.create(
            actor=request.user if request.user.is_authenticated else None,
            actor_email=request.user.email if request.user.is_authenticated else 'system',
            action='approval.rejected',
            target_type='ApprovalRequest',
            target_id=str(instance.id),
            summary=f"Rejected action: {instance.summary}. Reason: {reason}",
            changes={'status': ['PENDING', 'REJECTED']}
        )
        
        return Response({"message": "Request rejected successfully."})
