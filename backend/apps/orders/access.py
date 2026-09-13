"""Signed order-access tokens.

A token lets its holder view one order and download its invoice for 180 days.
Order numbers are sequential, so they are never enough on their own.
"""
from django.core import signing

from .models import Order

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
