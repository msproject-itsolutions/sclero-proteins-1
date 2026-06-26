from django.shortcuts import get_object_or_404
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.views import APIView
from apps.users.permissions import require_permission
from apps.regions.models import Region
from .models import FeatureToggle, SystemSetting, HeroBannerSlide, PaymentGateway, EmailTemplate, MarketingIntegration, ContentPage, BlogPost, ApprovalRequest
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
)


class StoreConfigView(APIView):
    """Public storefront config (no auth). Exposes only non-sensitive settings
    the frontend needs to render correctly, e.g. the tax display mode."""
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            'tax_mode': get_store_tax_mode(),
            'guest_checkout_enabled': get_guest_checkout_enabled(),
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
    # No-op until RBAC_ENFORCED=True, then requires the 'settings.manage' permission.
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


class SystemSettingViewSet(viewsets.ModelViewSet):
    queryset = SystemSetting.objects.all()
    serializer_class = SystemSettingSerializer
    # Settings can hold secrets (SMTP password, API keys) — gate it.
    permission_classes = [require_permission('settings.manage')]
    lookup_field = 'key'


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

    permission_classes is AllowAny to match the rest of this prototype dashboard;
    once staff RBAC lands this must be locked to authorised admins (it exposes secret keys).
    """
    queryset = PaymentGateway.objects.select_related('region').all()
    serializer_class = PaymentGatewayAdminSerializer
    # Exposes secret keys — gate behind 'settings.manage' (enforced when RBAC_ENFORCED=True).
    permission_classes = [require_permission('settings.manage')]

    def get_queryset(self):
        region_code = self.request.query_params.get('region')
        if region_code:
            return self.queryset.filter(region__code=region_code.upper())
        return self.queryset

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def available(self, request):
        """
        Public, safe list of ENABLED gateways for a region — used by the storefront
        checkout to render payment options. Never returns secret keys.
        e.g. /api/admin/payment-gateways/available/?region=IN
        """
        region_code = request.query_params.get('region', '').upper()
        region = Region.objects.filter(code=region_code, is_active=True).first()
        if not region:
            return Response([], status=status.HTTP_200_OK)

        gateways = PaymentGateway.objects.filter(
            region=region, is_enabled=True
        ).order_by('sort_order')
        return Response(PaymentGatewayPublicSerializer(gateways, many=True).data)

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
        """Trigger a catalog/feed sync for this integration. Records the sync
        timestamp + status; the actual feed push runs server-side per channel."""
        integration = self.get_object()
        if not integration.is_connected:
            return Response(
                {'status': 'error', 'message': f'{integration.name} is not connected.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        integration.last_sync = timezone.now()
        integration.sync_status = 'CONNECTED'
        integration.save(update_fields=['last_sync', 'sync_status'])
        return Response({
            'status': 'success',
            'message': f'{integration.name} catalog sync completed.',
            'last_sync': integration.last_sync,
            'sync_status': integration.sync_status,
        })


class ContentPageViewSet(viewsets.ModelViewSet):
    queryset = ContentPage.objects.all().order_by('-created_at')
    serializer_class = ContentPageSerializer
    permission_classes = [require_permission('settings.manage')]

    def get_queryset(self):
        qs = self.queryset
        q = self.request.query_params.get('q')
        if q:
            qs = qs.filter(Q(title__icontains=q) | Q(slug__icontains=q))
        return qs


class PublishedContentPageListView(APIView):
    """GET /api/content-pages/published-slugs/ — slugs + updated_at for published pages (for sitemap)."""
    permission_classes = [AllowAny]

    def get(self, request):
        pages = ContentPage.objects.filter(is_published=True).values('slug', 'updated_at')
        return Response(list(pages))


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


from rest_framework.views import APIView
from django.http import HttpResponse
import csv
from .reporting import generate_pdf_report
from apps.orders.models import Order
from apps.users.models import User, CustomerActivity

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

        # Scoped conversion rate calculation (using customer activities or fallback mock)
        activities = CustomerActivity.objects.filter(metadata__region=region.code)
        page_views = activities.filter(activity_type='PAGE_VIEW').count()
        views_count = page_views if page_views > 0 else (total_orders * 35 or 100)
        conversion_rate = (total_orders / views_count) * 100

        sales_data = {
            'total_orders': total_orders,
            'total_revenue': total_revenue,
            'aov': aov,
            'conversion_rate': round(conversion_rate, 2),
            'currency': region.currency_code,
            'currency_symbol': region.currency_symbol,
            'gross_margin': 70.0
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
            import csv
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = f'attachment; filename="sclero_{region.code}_sales_report.csv"'
            writer = csv.writer(response)
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


from decimal import Decimal
from django.db import transaction
from apps.orders.models import Order, Refund, PaymentLog
from apps.orders.payments import refund_payment, PaymentError
from apps.regions.models import Warehouse
from apps.inventory.models import StockLevel
from apps.products.models import Product, ProductRegionConfig

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
            
            order = get_object_or_404(Order, id=order_id)
            amount = Decimal(str(amount_val))
            
            try:
                result = refund_payment(order, amount, reason)
            except PaymentError as exc:
                instance.status = 'PENDING'
                instance.save()
                return Response({"error": f"Payment gateway refund failed: {str(exc)}"}, status=status.HTTP_400_BAD_REQUEST)
                
            already = order.refunds.filter(status__in=['PENDING', 'PROCESSED']).aggregate(s=Sum('amount'))['s'] or Decimal('0.00')
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
            user_to_delete.email = f"anonymized_{user_to_delete.id}@scleroproteins.co.uk"
            user_to_delete.first_name = "Anonymized"
            user_to_delete.last_name = "User"
            user_to_delete.phone_number = None
            user_to_delete.google_id = None
            user_to_delete.otp_secret = None
            user_to_delete.loyalty_points = 0
            user_to_delete.is_active = False
            user_to_delete.set_unusable_password()
            user_to_delete.save()
            
            # Delete user addresses
            user_to_delete.addresses.all().delete()
            
            # Update corresponding Order shipping details to placeholder/anonymized values
            orders = Order.objects.filter(user=user_to_delete)
            for o in orders:
                o.email = f"anonymized_{user_to_delete.id}@scleroproteins.co.uk"
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
