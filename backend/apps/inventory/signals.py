from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.inventory.models import StockLevel
from apps.webhooks.dispatcher import dispatch_outgoing_webhook

@receiver(post_save, sender=StockLevel)
def stock_post_save(sender, instance, created, **kwargs):
    dispatch_outgoing_webhook('inventory.updated', {
        'product_id': instance.product_id,
        'product_sku': instance.product.sku if instance.product else '',
        'warehouse_id': instance.warehouse_id,
        'warehouse_name': instance.warehouse.name if instance.warehouse else '',
        'available': instance.available,
        'reserved': instance.reserved,
        'updated_at': instance.updated_at.isoformat() if instance.updated_at else None
    })
