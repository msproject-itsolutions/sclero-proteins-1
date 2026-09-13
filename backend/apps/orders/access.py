"""Signed order-access tokens.

A token lets its holder view one order and download its invoice for 180 days.
Order numbers are sequential, so they are never enough on their own.
"""
import logging
from urllib.parse import urlencode

from django.core import signing

from .models import Order

logger = logging.getLogger(__name__)

ORDER_ACCESS_SALT = 'sclero.order-access'
ORDER_ACCESS_MAX_AGE = 180 * 24 * 60 * 60


def make_order_token(order):
    return signing.dumps({'o': order.pk}, salt=ORDER_ACCESS_SALT)


def read_order_token(token):
    """The order id a token grants, or None when it is invalid or expired."""
    try:
        data = signing.loads(str(token or ''), salt=ORDER_ACCESS_SALT, max_age=ORDER_ACCESS_MAX_AGE)
    except signing.BadSignature:
        return None
    order_id = data.get('o') if isinstance(data, dict) else None
    return order_id if isinstance(order_id, int) else None


def order_from_token(token, queryset=None):
    order_id = read_order_token(token)
    if order_id is None:
        return None
    queryset = Order.objects.all() if queryset is None else queryset
    return queryset.filter(pk=order_id).first()


def order_link_base(order):
    """The storefront origin for links about this order: its market's own domain."""
    from apps.users.auth_emails import public_link_base, trusted_origins

    domain = (getattr(order.region, 'domain', '') or '').strip().lower()
    candidate = f'https://{domain}' if domain else ''
    if candidate and candidate in trusted_origins():
        return candidate
    return public_link_base()


def order_url(order):
    query = urlencode({'order': order.pk, 'token': make_order_token(order)})
    return f'{order_link_base(order)}/checkout/success?{query}'


def invoice_path(order):
    return f"/api/orders/invoice/?{urlencode({'token': make_order_token(order)})}"


def invoice_url(order):
    return f'{order_link_base(order)}{invoice_path(order)}'


def send_order_access_email(order):
    """Email a fresh order link. Sent directly, so the link is never stored."""
    from .email_service import send_branded_email

    try:
        send_branded_email(
            f'Your Sclero Proteins order #{order.pk}',
            f'Here is a new link to view order #{order.pk} and download its invoice:\n\n'
            f'{order_url(order)}\n\nThe link works for 180 days. If you did not ask for it, '
            'you can ignore this email.',
            order.email,
        )
    except Exception:
        logger.exception('Could not send the order link for order %s.', order.pk)
