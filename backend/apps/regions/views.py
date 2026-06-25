from decimal import Decimal
import requests
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, action, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from .geo import detect_country_with_source, map_country_to_region_code
from .shipping import calculate_shipping
from .models import Region, Warehouse, ShippingZone, ShippingRate
from .serializers import (
    RegionSerializer, ShippingZoneSerializer,
    RegionAdminSerializer, WarehouseAdminSerializer,
    ShippingZoneAdminSerializer, ShippingRateAdminSerializer
)
from apps.users.permissions import require_permission

class RegionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Region.objects.filter(is_active=True)
    serializer_name = RegionSerializer
    serializer_class = RegionSerializer

@api_view(['GET'])
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

    def post(self, request):
        region_code = (request.data.get('region') or '').upper().strip()
        region = Region.objects.filter(code=region_code, is_active=True).first()
        if not region:
            return Response({'error': 'Unknown region'}, status=status.HTTP_400_BAD_REQUEST)
        cost = calculate_shipping(
            region,
            country=request.data.get('country', ''),
            state=request.data.get('state', ''),
            postcode=request.data.get('postcode', ''),
            subtotal=request.data.get('subtotal', 0),
        )
        return Response({
            'shipping_cost': str(cost),
            'currency_code': region.currency_code,
            'free': cost == Decimal('0.00'),
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
