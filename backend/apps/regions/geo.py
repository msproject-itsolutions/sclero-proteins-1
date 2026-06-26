"""
Geo-IP country detection for region routing.

Precedence (highest first):
  1. Cloudflare's CF-IPCountry header  (source='cloudflare')
  2. Vercel's x-vercel-ip-country header  (source='vercel')
  3. MaxMind GeoLite2 lookup, only if MAXMIND_DB_PATH env var is set
     and the file exists. The geoip2 package is imported lazily so it
     remains an OPTIONAL dependency.  (source='maxmind')
  4. Empty string — caller decides fallback.  (source='fallback')
"""

from __future__ import annotations

import os


def _client_ip(request) -> str:
    xff = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '') or ''


def _is_public_ip(ip: str) -> bool:
    """True for routable public IPs (skip loopback / private ranges that a geo
    service can't resolve)."""
    if not ip or ip in ('::1', 'localhost'):
        return False
    if ip.startswith(('10.', '127.', '192.168.', '0.', '169.254.', 'fc', 'fd')):
        return False
    if ip.startswith('172.'):
        try:
            if 16 <= int(ip.split('.')[1]) <= 31:
                return False
        except Exception:
            pass
    return True


def _ipapi_country(ip: str) -> str:
    """Zero-setup IP-geolocation fallback (default ip-api.com). Disable by setting
    GEOIP_API_URL=''. Never raises. Prefer MaxMind (MAXMIND_DB_PATH) or Cloudflare
    to avoid a per-request third-party call."""
    base = os.environ.get('GEOIP_API_URL', 'http://ip-api.com/json/').strip()
    if not base or not _is_public_ip(ip):
        return ''
    try:
        import requests
        resp = requests.get(f'{base}{ip}?fields=countryCode', timeout=2)
        return (resp.json().get('countryCode') or '').upper()
    except Exception:
        return ''


def detect_country_from_request(request) -> str:
    """Return an ISO-2 country code or empty string."""
    cf = (request.META.get('HTTP_CF_IPCOUNTRY') or '').upper().strip()
    if cf and cf not in ('XX', 'T1'):
        return cf

    vercel = (request.META.get('HTTP_X_VERCEL_IP_COUNTRY') or '').upper().strip()
    if vercel:
        return vercel

    db_path = os.environ.get('MAXMIND_DB_PATH', '').strip()
    if db_path and os.path.exists(db_path):
        try:
            from geoip2.database import Reader  # type: ignore
        except ImportError:
            return ''
        try:
            ip = _client_ip(request)
            if ip:
                with Reader(db_path) as reader:
                    response = reader.country(ip)
                    iso = (response.country.iso_code or '').upper()
                    if iso:
                        return iso
        except Exception:
            pass

    api = _ipapi_country(_client_ip(request))
    if api:
        return api

    return ''


def detect_country_with_source(request) -> tuple[str, str]:
    """Return (country, source) — useful for the /api/geo/ endpoint."""
    cf = (request.META.get('HTTP_CF_IPCOUNTRY') or '').upper().strip()
    if cf and cf not in ('XX', 'T1'):
        return cf, 'cloudflare'

    vercel = (request.META.get('HTTP_X_VERCEL_IP_COUNTRY') or '').upper().strip()
    if vercel:
        return vercel, 'vercel'

    db_path = os.environ.get('MAXMIND_DB_PATH', '').strip()
    if db_path and os.path.exists(db_path):
        try:
            from geoip2.database import Reader  # type: ignore
            ip = _client_ip(request)
            if ip:
                with Reader(db_path) as reader:
                    response = reader.country(ip)
                    iso = (response.country.iso_code or '').upper()
                    if iso:
                        return iso, 'maxmind'
        except Exception:
            pass

    api = _ipapi_country(_client_ip(request))
    if api:
        return api, 'ipapi'

    return '', 'fallback'


def map_country_to_region_code(country: str) -> str:
    """
    Map an ISO-2 country code to one of our supported region codes.

    Intentionally narrow: only India (IN) routes to the IN region.
    Cloudflare returns 'GB' for the UK; we map it to our 'UK' code.
    Everything else (including unknown / empty) falls back to 'UK'.
    """
    if not country:
        return 'UK'
    c = country.upper().strip()
    if c == 'IN':
        return 'IN'
    if c in ('GB', 'UK'):
        return 'UK'
    return 'UK'
