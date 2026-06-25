"""Connect model-change signals to the audit trail.

Covers the spec's: product modifications, price changes, inventory changes,
order updates, refund actions, and customer address updates.
"""

from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from .recorder import record_audit


def connect():
    from apps.products.models import Product, ProductRegionConfig
    from apps.inventory.models import StockLevel
    from apps.orders.models import Order, Refund
    from apps.users.models import UserAddress

    @receiver(post_save, sender=Product, dispatch_uid='audit_product_save')
    def _product_saved(sender, instance, created, **kwargs):
        record_audit(
            'product.created' if created else 'product.updated',
            target_type='Product', target_id=instance.pk,
            summary=f"{'Created' if created else 'Updated'} product {instance.sku} — {instance.name}",
        )

    @receiver(post_delete, sender=Product, dispatch_uid='audit_product_delete')
    def _product_deleted(sender, instance, **kwargs):
        record_audit('product.deleted', target_type='Product', target_id=instance.pk,
                     summary=f"Deleted product {instance.sku}")

    @receiver(post_save, sender=ProductRegionConfig, dispatch_uid='audit_price_save')
    def _price_saved(sender, instance, created, **kwargs):
        region = getattr(instance.region, 'code', '')
        promo = f", promo {instance.promotional_price}" if instance.promotional_price else ''
        record_audit(
            'price.updated',
            target_type='Product', target_id=instance.product_id,
            summary=f"Price for {region}: {instance.price}{promo}",
            changes={'region': region, 'price': str(instance.price),
                     'promotional_price': str(instance.promotional_price or '')},
        )

    @receiver(post_save, sender=StockLevel, dispatch_uid='audit_stock_save')
    def _stock_saved(sender, instance, created, **kwargs):
        record_audit(
            'inventory.updated',
            target_type='StockLevel', target_id=instance.pk,
            summary=f"Stock for product #{instance.product_id}: {instance.available} available",
            changes={'available': instance.available},
        )

    @receiver(post_save, sender=Order, dispatch_uid='audit_order_save')
    def _order_saved(sender, instance, created, **kwargs):
        record_audit(
            'order.created' if created else 'order.updated',
            target_type='Order', target_id=instance.pk,
            summary=f"Order #{instance.pk} — status {instance.status}, total {instance.currency_code} {instance.total}",
            changes={'status': instance.status},
        )

    @receiver(post_save, sender=Refund, dispatch_uid='audit_refund_save')
    def _refund_saved(sender, instance, created, **kwargs):
        if not created:
            return
        record_audit(
            'refund.issued',
            target_type='Order', target_id=instance.order_id,
            summary=f"Refund {instance.currency_code} {instance.amount} on order #{instance.order_id}",
            changes={'amount': str(instance.amount), 'is_partial': instance.is_partial},
        )

    @receiver(post_save, sender=UserAddress, dispatch_uid='audit_address_save')
    def _address_saved(sender, instance, created, **kwargs):
        record_audit(
            'address.created' if created else 'address.updated',
            target_type='UserAddress', target_id=instance.pk,
            summary=f"{'Added' if created else 'Updated'} address for user #{instance.user_id}",
        )

    @receiver(post_delete, sender=UserAddress, dispatch_uid='audit_address_delete')
    def _address_deleted(sender, instance, **kwargs):
        record_audit('address.deleted', target_type='UserAddress', target_id=instance.pk,
                     summary=f"Deleted address for user #{instance.user_id}")
