"""Region and variant stock movements for orders."""
import logging

from django.db.models import Sum

from apps.inventory.models import StockLevel
from apps.products.models import ProductVariant
from apps.regions.models import Warehouse

logger = logging.getLogger(__name__)


class StockError(Exception):
    """A line cannot be reserved: the region or the option has too little stock."""


def region_warehouses(region):
    return Warehouse.objects.filter(region=region, is_active=True).order_by('id')


def region_stock_queryset(product, region, *, for_update=False):
    queryset = StockLevel.objects.filter(
        product=product, warehouse__in=region_warehouses(region),
    ).select_related('warehouse')
    if for_update:
        queryset = queryset.select_for_update()
    return queryset.order_by('-available', 'warehouse_id', 'id')


def region_available_stock(product, region):
    return region_stock_queryset(product, region).aggregate(total=Sum('available'))['total'] or 0


def available_for_variant(product, region, variant=None):
    region_stock = region_available_stock(product, region)
    if variant is None:
        return region_stock
    return min(region_stock, variant.stock_qty)


def deduct_region_stock(product, region, quantity):
    remaining = quantity
    stock_rows = list(region_stock_queryset(product, region, for_update=True))
    if sum(stock.available for stock in stock_rows) < quantity:
        raise StockError(f"Product {product.name} is out of stock in this region.")
    for stock in stock_rows:
        if remaining <= 0:
            break
        take = min(stock.available, remaining)
        if take <= 0:
            continue
        stock.available -= take
        stock.save(update_fields=['available', 'updated_at'])
        remaining -= take


def deduct_variant_stock(product, variant_sku, quantity):
    if not variant_sku:
        return
    variant = ProductVariant.objects.select_for_update().filter(
        product=product, sku=variant_sku, is_active=True,
    ).first()
    if variant is None:
        raise StockError(f"The selected option for {product.name} is no longer available.")
    if variant.stock_qty < quantity:
        raise StockError(f"Only {variant.stock_qty} units of {variant.name} are available.")
    variant.stock_qty -= quantity
    variant.save(update_fields=['stock_qty', 'updated_at'])


def restock_region_item(product, region, quantity):
    stock_rows = list(region_stock_queryset(product, region, for_update=True))
    if stock_rows:
        target = stock_rows[0]
    else:
        warehouse = region_warehouses(region).first()
        if not warehouse:
            return
        target, _created = StockLevel.objects.get_or_create(
            warehouse=warehouse,
            product=product,
            defaults={'available': 0, 'reserved': 0, 'low_stock_threshold': 10},
        )
    target.available += quantity
    target.save(update_fields=['available', 'updated_at'])


def restock_variant_item(product, variant_sku, quantity):
    if not variant_sku:
        return
    variant = ProductVariant.objects.select_for_update().filter(product=product, sku=variant_sku).first()
    if variant is None:
        logger.warning('Could not restock removed variant %s for product %s.', variant_sku, product.pk)
        return
    variant.stock_qty += quantity
    variant.save(update_fields=['stock_qty', 'updated_at'])


def reserve_lines(region, lines):
    """Take stock for (product, variant_sku, quantity) lines.

    Run inside a savepoint: a shortage on a later line raises StockError and
    the caller's rollback returns what the earlier lines took.
    """
    for product, variant_sku, quantity in lines:
        deduct_region_stock(product, region, quantity)
        deduct_variant_stock(product, variant_sku, quantity)


def order_lines(order):
    return [
        (item.product, item.variant_sku, item.quantity)
        for item in order.items.select_related('product')
    ]


def reserve_order_stock(order):
    reserve_lines(order.region, order_lines(order))


def release_order_stock(order):
    for product, variant_sku, quantity in order_lines(order):
        restock_region_item(product, order.region, quantity)
        restock_variant_item(product, variant_sku, quantity)
