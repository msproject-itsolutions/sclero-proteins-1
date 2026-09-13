"""Server-issued cart identity.

A guest's cart is reachable only through the random token in the HttpOnly
``sclero_cart`` cookie, and a signed-in shopper's cart is keyed by account and
region. Cart ids sent by the browser are ignored: the old localStorage ids were
guessable, so anyone could read or check out another shopper's cart.
"""
import secrets

from django.conf import settings

from .models import Cart

CART_COOKIE_NAME = 'sclero_cart'
CART_COOKIE_MAX_AGE = 30 * 24 * 60 * 60
CART_COOKIE_PATH = '/api/'


def new_cart_token():
    return secrets.token_urlsafe(32)


def cart_token(request):
    """The cart token the browser presented, or '' when absent or malformed."""
    token = str(request.COOKIES.get(CART_COOKIE_NAME) or '')
    return token if 32 <= len(token) <= 128 else ''


def _user(request):
    user = getattr(request, 'user', None)
    return user if user is not None and user.is_authenticated else None


def _guest_cart(request, queryset=None):
    token = cart_token(request)
    if not token:
        return None
    queryset = Cart.objects.all() if queryset is None else queryset
    return queryset.filter(session_id=token, user__isnull=True).first()


def _move_to_region(cart, region):
    """A cart belongs to one market; moving it empties it."""
    if cart.region_id != region.pk:
        cart.items.all().delete()
        cart.region = region


def find_cart(request, region, *, for_update=False):
    """Return the shopper's cart in ``region`` without creating one."""
    queryset = Cart.objects.select_for_update() if for_update else Cart.objects.all()
    user = _user(request)
    if user is not None:
        return queryset.filter(user=user, region=region).order_by('-updated_at').first()
    cart = _guest_cart(request, queryset)
    if cart is None or cart.region_id != region.pk:
        return None
    return cart


def get_or_create_cart(request, region):
    """Return the shopper's cart in ``region``, adopting or creating one."""
    user = _user(request)
    if user is not None:
        carts = list(Cart.objects.filter(user=user, region=region).order_by('-updated_at'))
        for duplicate in carts[1:]:
            duplicate.delete()
        if carts:
            return carts[0]
        cart = _guest_cart(request)
        if cart is None:
            return Cart.objects.create(session_id=new_cart_token(), region=region, user=user)
        # The shopper filled this cart before signing in, so it becomes theirs.
        # A guest cookie can never reach it again: guest lookups need user=None.
        cart.user = user
        _move_to_region(cart, region)
        cart.save(update_fields=['user', 'region', 'updated_at'])
        return cart
    cart = _guest_cart(request)
    if cart is None:
        return Cart.objects.create(session_id=new_cart_token(), region=region)
    if cart.region_id != region.pk:
        _move_to_region(cart, region)
        cart.save(update_fields=['region', 'updated_at'])
    return cart


def shopper_carts(request):
    """Every cart the shopper owns, in any region."""
    user = _user(request)
    if user is not None:
        return Cart.objects.filter(user=user)
    token = cart_token(request)
    return Cart.objects.filter(session_id=token, user__isnull=True) if token else Cart.objects.none()


def attach_cart_cookie(response, request, cart):
    """Hand the browser its guest-cart token when it does not hold it yet."""
    if cart is None or cart.user_id is not None or cart_token(request) == cart.session_id:
        return response
    response.set_cookie(
        CART_COOKIE_NAME, cart.session_id, max_age=CART_COOKIE_MAX_AGE, path=CART_COOKIE_PATH,
        secure=not settings.DEBUG, httponly=True, samesite='Lax',
    )
    return response
