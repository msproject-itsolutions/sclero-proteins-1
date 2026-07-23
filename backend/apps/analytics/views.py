"""
Public page-view ingestion endpoint.

Rate-limited per (session_id, path) to 1 record / 5 seconds using the Django
cache (best-effort; never raises).
"""
from django.core.cache import cache
from rest_framework import status
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.regions.geo import detect_country_from_request, map_country_to_region_code
from .models import PageView


@api_view(['POST'])
# Skip authentication entirely: the tracker fires via navigator.sendBeacon,
# which always attaches cookies but can never add the X-Sclero-Client header
# the cookie-auth guard demands on POSTs — so every logged-in (or stale-token)
# visitor's beacon was rejected with a 401 before AllowAny was even consulted.
# The endpoint never uses request.user, so no auth needs to run at all.
@authentication_classes([])
@permission_classes([AllowAny])
def pageview_ingest(request):
    try:
        data = request.data if isinstance(request.data, dict) else {}
        path = (data.get('path') or '')[:500]
        referrer = (data.get('referrer') or '')[:500]
        session_id = (data.get('session_id') or '')[:64]
        if not path:
            return Response({'ok': False}, status=status.HTTP_400_BAD_REQUEST)

        ip = (request.META.get('HTTP_X_FORWARDED_FOR') or request.META.get('REMOTE_ADDR') or '').split(',')[0].strip()
        if ip:
            ip_key = f"pv-ip:{ip}"
            try:
                count = cache.get(ip_key) or 0
                if count >= 120:
                    return Response({'ok': True, 'throttled': True})
                cache.set(ip_key, count + 1, timeout=60)
            except Exception:
                pass

        # Per-session-per-path 5s rate limit
        if session_id:
            cache_key = f"pv:{session_id}:{path}"
            if cache.get(cache_key):
                return Response({'ok': True, 'throttled': True})
            try:
                cache.set(cache_key, 1, timeout=5)
            except Exception:
                pass

        country = ''
        try:
            country = detect_country_from_request(request) or ''
        except Exception:
            country = ''
        region_code = map_country_to_region_code(country) if country else ''
        ua = (request.META.get('HTTP_USER_AGENT') or '')[:255]
        user = request.user if getattr(request, 'user', None) and request.user.is_authenticated else None

        PageView.objects.create(
            path=path,
            referrer=referrer,
            region_code=region_code,
            country=country,
            session_id=session_id,
            user=user,
            user_agent=ua,
        )
        return Response({'ok': True})
    except Exception:
        # best-effort, never raise to client
        return Response({'ok': False})
