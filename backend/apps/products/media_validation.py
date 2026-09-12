"""Validation for admin-supplied media URLs.

Product media is shown in <img>/<video> tags and linked for download. The
real danger is a script-capable document (SVG, HTML, XML) served from this
site's own origin, or a non-HTTP scheme. External HTTPS images cannot run in
this origin and CDN URLs often have no file extension, so they are allowed.
"""
from urllib.parse import unquote, urlsplit

from django.conf import settings

MAX_MEDIA_URL_LENGTH = 2048
BLOCKED_EXTENSIONS = ('.svg', '.svgz', '.html', '.htm', '.xhtml', '.xml', '.js', '.mjs')
DEV_HTTP_HOSTS = {'localhost', '127.0.0.1'}


class MediaUrlError(ValueError):
    pass


def validate_media_url(value):
    url = str(value or '').strip()
    if not url:
        raise MediaUrlError('A media URL is required.')
    if len(url) > MAX_MEDIA_URL_LENGTH:
        raise MediaUrlError('Media URLs must be 2048 characters or fewer.')
    if '\\' in url:
        # Browsers read "/\host" as the protocol-relative "//host".
        raise MediaUrlError('Media URLs cannot contain backslashes.')
    parts = urlsplit(url)
    # The web server decodes %2E to ".", so check the decoded path.
    if unquote(parts.path).lower().endswith(BLOCKED_EXTENSIONS):
        raise MediaUrlError('SVG, HTML, XML and script files cannot be used as product media.')
    if not parts.scheme:
        if not url.startswith('/') or url.startswith('//'):
            raise MediaUrlError('Use an uploaded file or a full https:// URL.')
        return url
    scheme = parts.scheme.lower()
    if scheme == 'https' and parts.hostname:
        return url
    if scheme == 'http' and settings.DEBUG and parts.hostname in DEV_HTTP_HOSTS:
        return url
    raise MediaUrlError('Media URLs must use https://.')
