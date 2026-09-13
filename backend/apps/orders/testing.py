"""Shared fixtures for the orders test modules (not a test module itself)."""
import atexit
import hashlib
import hmac
import shutil
import tempfile
from contextlib import contextmanager
from decimal import Decimal
from unittest.mock import MagicMock, patch

from apps.admin_dashboard.models import PaymentGateway
from apps.inventory.models import StockLevel
from apps.products.models import Product, ProductRegionConfig
from apps.regions.models import Region, ShippingRate, ShippingZone, Warehouse

from .models import Order, OrderItem

# Invoice PDFs rendered by tests go here instead of the repository's media/.
TEST_MEDIA_ROOT = tempfile.mkdtemp(prefix='sclero-test-media-')
atexit.register(shutil.rmtree, TEST_MEDIA_ROOT, ignore_errors=True)

REGION_DEFAULTS = {
    'UK': dict(
        name='United Kingdom', domain='scleroproteins.co.uk', countries=['GB'],
        currency_code='GBP', currency_symbol='£', tax_name='VAT', tax_rate='20.00',
    ),
    'IN': dict(
        name='India', domain='scleroproteins.in', countries=['IN'],
        currency_code='INR', currency_symbol='₹', tax_name='GST', tax_rate='18.00',
    ),
}


def make_region(code='UK'):
    region, _created = Region.objects.get_or_create(code=code, defaults=REGION_DEFAULTS[code])
    return region


def make_catalog(region, *, sku='TEST-PRODUCT', price='10.00', stock=25):
    """A sellable product with stock and a flat 5.00 shipping rate in `region`."""
    warehouse, _ = Warehouse.objects.get_or_create(
        region=region, name=f'{region.code} warehouse', defaults={'is_active': True},
    )
    product = Product.objects.create(
        sku=sku, name=f'Product {sku}', description='', benefits='', ingredients='',
        base_price=price,
    )
    ProductRegionConfig.objects.create(product=product, region=region, price=price, is_visible=True)
    StockLevel.objects.create(warehouse=warehouse, product=product, available=stock)
    zone, _ = ShippingZone.objects.get_or_create(
        region=region, name=f'{region.code} zone', defaults={'countries': list(region.countries or [])},
    )
    ShippingRate.objects.get_or_create(
        zone=zone, name='Standard',
        defaults={'method': 'Standard delivery', 'rate_type': 'FLAT', 'price': '5.00'},
    )
    return product


def add_gateway(region, code='STRIPE', *, mode='LIVE', secret_key='sk_live_test',
                publishable_key='pk_live_test', **extra):
    return PaymentGateway.objects.create(
        code=code, display_name=code.title(), region=region, is_enabled=True, mode=mode,
        secret_key=secret_key, publishable_key=publishable_key, **extra,
    )


def make_order(region, *, product=None, quantity=1, **fields):
    """An order with an optional single line; defaults to an unpaid Stripe order."""
    values = dict(
        region=region, status='AWAITING_PAYMENT', payment_status='PENDING',
        email='buyer@example.com', shipping_name='Buyer', shipping_phone='+447700900077',
        shipping_address_line1='1 Test Street', shipping_city='London', shipping_state='London',
        shipping_postal_code='SW1A 1AA', shipping_country='GB',
        currency_code=region.currency_code, subtotal=Decimal('20.00'), tax_rate=Decimal('0.00'),
        tax_amount=Decimal('0.00'), shipping_cost=Decimal('0.00'), total=Decimal('20.00'),
        payment_method='STRIPE',
    )
    values.update(fields)
    order = Order.objects.create(**values)
    if product is not None:
        OrderItem.objects.create(
            order=order, product=product, quantity=quantity,
            price=Decimal(values['total']) / quantity,
        )
    return order


def provider_response(status_code, body):
    response = MagicMock(status_code=status_code, content=b'{}')
    response.json.return_value = body
    return response


@contextmanager
def provider(*responses):
    """Patch every provider HTTP call; each call returns or raises the next item."""
    effects = [
        item if isinstance(item, BaseException) else provider_response(*item)
        for item in responses
    ]
    with patch('apps.orders.payments.requests.request', side_effect=effects) as http:
        yield http


def razorpay_signature(secret, order_reference, payment_id):
    return hmac.new(
        secret.encode(), f'{order_reference}|{payment_id}'.encode(), hashlib.sha256,
    ).hexdigest()
