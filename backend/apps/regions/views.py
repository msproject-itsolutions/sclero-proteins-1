import requests
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, action, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from .geo import detect_country_with_source, map_country_to_region_code
from .shipping import calculate_shipping
from .models import Region, Warehouse, ShippingZone, ShippingRate, ShippingProvider
from .serializers import (
    RegionSerializer,
    RegionAdminSerializer, WarehouseAdminSerializer,
    ShippingZoneAdminSerializer, ShippingRateAdminSerializer,
    ShippingProviderAdminSerializer,
)
from apps.users.permissions import require_permission

class RegionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Region.objects.filter(is_active=True)
    serializer_name = RegionSerializer
    serializer_class = RegionSerializer
    permission_classes = [AllowAny]

@api_view(['GET'])
@permission_classes([AllowAny])
def detect_region(request):
    """
    Detects user country from query parameters (timezone, locale, language),
    Cloudflare header CF-IPCountry, or client IP.
    Maps India (IN) -> IN region, and all other locations -> UK region.
    """
    # 1. Check if manually overridden by query parameter
    country_code = request.query_params.get('country', '').upper()
    
    # 2. Extract timezone, locale, and language from query params
    timezone_param = request.query_params.get('timezone', '')
    locale_param = request.query_params.get('locale', '').lower()
    language_param = request.query_params.get('language', '').lower()
    
    if not country_code:
        # Check if timezone is India
        if any(tz in timezone_param for tz in ['Kolkata', 'Calcutta', 'Asia/Kolkata']):
            country_code = 'IN'
        # Check if locale or language suggests India
        elif any(loc in locale_param or loc in language_param for loc in ['en-in', 'hi-in', 'hi']):
            country_code = 'IN'
        # Check if timezone or locale suggests UK
        elif any(tz in timezone_param for tz in ['Europe/London', 'London', 'GMT', 'BST']):
            country_code = 'UK'
        elif any(loc in locale_param or loc in language_param for loc in ['en-gb', 'en-uk']):
            country_code = 'UK'

    if not country_code:
        # 3. Check Cloudflare GeoIP header (available in free tier)
        country_code = request.META.get('HTTP_CF_IPCOUNTRY', '').upper()
        
    if not country_code:
        # 4. Simple mock lookup based on client IP (just for local dev testing)
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0].strip()
        else:
            ip = request.META.get('REMOTE_ADDR')
            
        # Hardcoded mock mapping for typical test IPs
        if ip in ['127.0.0.1', 'localhost', '::1']:
            # Fallback default for development
            country_code = 'IN'
        else:
            # Default to UK for rest of the world
            country_code = 'UK'
            
    # Determine region based on user location
    if country_code == 'IN':
        region_code = 'IN'
    else:
        region_code = 'UK'

    try:
        region = Region.objects.get(code=region_code, is_active=True)
    except Region.DoesNotExist:
        # Fallback to first active region if configured incorrectly
        region = Region.objects.filter(is_active=True).first()
        
    if not region:
        return Response({"error": "No active regions configured"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({
        "detected_country": country_code,
        "region": RegionSerializer(region).data
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def geo_detect(request):
    """
    Lightweight geo-IP detector. Returns the detected ISO-2 country code,
    the mapped region code (IN or UK), and which precedence rule fired.
    """
    country, source = detect_country_with_source(request)
    region_code = map_country_to_region_code(country)
    return Response({
        "country": country,
        "region_code": region_code,
        "source": source,
    })


class PostcodeLookupView(APIView):
    """
    Resolve a postcode/PIN to city/district/state so the checkout can auto-fill
    the address. India -> postalpincode.in, UK/other -> postcodes.io. Both are
    free. Returns {} on any miss so the UI simply falls back to manual entry.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'checkout'

    def get(self, request):
        country = (request.query_params.get('country') or '').upper().strip()
        code = (request.query_params.get('code') or '').strip()
        if not code:
            return Response({})
        # Some postal APIs reject the default python-requests UA, so send a browser-like one.
        headers = {'User-Agent': 'Mozilla/5.0 (compatible; ScleroProteins/1.0)', 'Accept': 'application/json'}
        try:
            if country == 'IN':
                resp = requests.get(f'https://api.postalpincode.in/pincode/{code}', timeout=8, headers=headers)
                data = resp.json()
                if isinstance(data, list) and data and data[0].get('Status') == 'Success':
                    offices = data[0].get('PostOffice') or []
                    if offices:
                        first = offices[0]
                        return Response({
                            'postcode': code,
                            'city': first.get('District') or first.get('Block') or '',
                            'district': first.get('District') or '',
                            'state': first.get('State') or '',
                            'localities': [o.get('Name') for o in offices if o.get('Name')][:25],
                        })
            else:
                resp = requests.get(f'https://api.postcodes.io/postcodes/{code}', timeout=8, headers=headers)
                data = resp.json()
                if data.get('status') == 200 and data.get('result'):
                    res = data['result']
                    return Response({
                        'postcode': res.get('postcode') or code,
                        'city': res.get('admin_district') or res.get('parish') or '',
                        'district': res.get('admin_district') or '',
                        'state': res.get('region') or res.get('country') or '',
                    })
        except Exception:
            pass
        return Response({})


class ShippingCalculateView(APIView):
    """Return the shipping fee for a destination + order value (admin zones, else
    the regional default)."""
    permission_classes = [AllowAny]
    throttle_scope = 'checkout'

    def post(self, request):
        region_code = (request.data.get('region') or '').upper().strip()
        region = Region.objects.filter(code=region_code, is_active=True).first()
        if not region:
            return Response({'error': 'Unknown region'}, status=status.HTTP_400_BAD_REQUEST)
        weight_g = request.data.get('weight_g', 0)
        quantity = request.data.get('quantity', 0)
        session_id = request.data.get('session_id')
        if session_id:
            from apps.orders.models import Cart
            from apps.orders.pricing import cart_shipping_metrics
            cart = Cart.objects.filter(session_id=session_id, region=region).prefetch_related('items__product').first()
            if cart:
                weight_g, quantity = cart_shipping_metrics(cart)

        from .shipping import calculate_shipping_options
        options = calculate_shipping_options(
            region, country=request.data.get('country', ''), state=request.data.get('state', ''),
            city=request.data.get('city', ''), postcode=request.data.get('postcode', ''),
            subtotal=request.data.get('subtotal', 0), weight_g=weight_g, quantity=quantity,
        )
        if not options:
            return Response({
                'error': 'Shipping is not available for this destination and order.',
                'options': [], 'currency_code': region.currency_code,
            }, status=status.HTTP_400_BAD_REQUEST)
        try:
            option = calculate_shipping(
                region, country=request.data.get('country', ''), state=request.data.get('state', ''),
                city=request.data.get('city', ''), postcode=request.data.get('postcode', ''),
                subtotal=request.data.get('subtotal', 0), weight_g=weight_g, quantity=quantity,
                rate_id=request.data.get('shipping_rate_id'), return_option=True,
            )
        except ValueError as exc:
            return Response({'error': str(exc), 'options': []}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            'shipping_cost': str(option['cost']),
            'selected_rate_id': option['rate_id'],
            'method': option['method'],
            'estimated_days': option['estimated_days'],
            'options': [{**item, 'cost': str(item['cost'])} for item in options],
            'weight_g': str(weight_g),
            'quantity': quantity,
            'currency_code': region.currency_code,
            'free': option['free'],
        })


# --- Admin ViewSets for Regional CRUD Operations --- #

class RegionAdminViewSet(viewsets.ModelViewSet):
    """
    Admin CRUD operations for regions.
    Requires 'settings.manage' permission when RBAC is enforced.
    """
    queryset = Region.objects.all()
    permission_classes = [require_permission('settings.manage')]
    serializer_class = RegionAdminSerializer


class WarehouseAdminViewSet(viewsets.ModelViewSet):
    """
    Admin CRUD operations for warehouses.
    Requires 'inventory.manage' permission when RBAC is enforced.
    Supports regional filtering via ?region=IN,UK,US
    """
    queryset = Warehouse.objects.all()
    permission_classes = [require_permission('inventory.manage')]
    serializer_class = WarehouseAdminSerializer

    def get_queryset(self):
        queryset = self.queryset
        region_code = self.request.query_params.get('region')
        if region_code:
            queryset = queryset.filter(region__code=region_code.upper())
        return queryset.select_related('region')


class ShippingZoneAdminViewSet(viewsets.ModelViewSet):
    """
    Admin CRUD operations for shipping zones.
    Requires 'settings.manage' permission when RBAC is enforced.
    Supports regional filtering via ?region=IN,UK,US
    """
    queryset = ShippingZone.objects.all()
    permission_classes = [require_permission('settings.manage')]
    serializer_class = ShippingZoneAdminSerializer

    def get_queryset(self):
        queryset = self.queryset
        region_code = self.request.query_params.get('region')
        if region_code:
            queryset = queryset.filter(region__code=region_code.upper())
        return queryset.select_related('region').prefetch_related('rates')


class ShippingRateAdminViewSet(viewsets.ModelViewSet):
    """
    Admin CRUD operations for shipping rates.
    Requires 'settings.manage' permission when RBAC is enforced.
    Supports zone filtering via ?zone=<zone_id>
    """
    queryset = ShippingRate.objects.all()
    permission_classes = [require_permission('settings.manage')]
    serializer_class = ShippingRateAdminSerializer

    def get_queryset(self):
        queryset = self.queryset
        zone_id = self.request.query_params.get('zone')
        if zone_id:
            queryset = queryset.filter(zone_id=zone_id)
        return queryset.select_related('zone__region')

    @action(detail=False, methods=['get'])
    def by_zone(self, request):
        """Get all rates for a specific zone."""
        zone_id = request.query_params.get('zone')
        if not zone_id:
            return Response({"error": "Zone parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

        rates = self.get_queryset().filter(zone_id=zone_id)
        serializer = self.get_serializer(rates, many=True)
        return Response(serializer.data)


class ShippingProviderAdminViewSet(viewsets.ModelViewSet):
    queryset = ShippingProvider.objects.select_related('region').all()
    serializer_class = ShippingProviderAdminSerializer
    permission_classes = [require_permission('settings.manage')]

    def get_queryset(self):
        queryset = self.queryset
        region_code = self.request.query_params.get('region')
        if region_code:
            queryset = queryset.filter(region__code=region_code.upper())
        return queryset

    def _verify_after_save(self, provider):
        from .providers import ShippingProviderError, get_shipping_adapter

        if not provider.is_configured:
            provider.mark_connection(False, 'Complete all required credentials and pickup settings before enabling this provider.')
            provider.is_enabled = False
            provider.save(update_fields=['is_enabled', 'updated_at'])
            return
        try:
            get_shipping_adapter(provider).test_connection()
        except ShippingProviderError as exc:
            provider.mark_connection(False, str(exc))
            provider.is_enabled = False
            provider.save(update_fields=['is_enabled', 'updated_at'])
            return
        provider.mark_connection(True)

    def perform_create(self, serializer):
        provider = serializer.save()
        self._verify_after_save(provider)

    def perform_update(self, serializer):
        provider = serializer.save()
        self._verify_after_save(provider)

    @action(detail=False, methods=['get'])
    def catalog(self, request):
        from .providers import shipping_provider_catalog
        providers = shipping_provider_catalog()
        for provider in providers:
            provider['webhook_path'] = f"/api/webhooks/shipping/{provider['code'].lower()}/"
        return Response(providers)

    @action(detail=True, methods=['post'])
    def test_connection(self, request, pk=None):
        from .providers import ShippingProviderError, get_shipping_adapter
        provider = self.get_object()
        try:
            result = get_shipping_adapter(provider).test_connection()
        except ShippingProviderError as exc:
            provider.mark_connection(False, str(exc))
            return Response({'ok': False, 'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        provider.mark_connection(True)
        return Response(result)
