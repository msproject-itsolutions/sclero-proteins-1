from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.products.models import Product
from apps.webhooks.dispatcher import dispatch_outgoing_webhook

@receiver(post_save, sender=Product)
def product_post_save(sender, instance, created, **kwargs):
    event_type = 'product.created' if created else 'product.updated'
    dispatch_outgoing_webhook(event_type, {
        'product_id': instance.id,
        'name': instance.name,
        'sku': instance.sku,
        'slug': getattr(instance, 'slug', None),
        'is_active': getattr(instance, 'is_active', True),
        'updated_at': instance.updated_at.isoformat() if hasattr(instance, 'updated_at') and instance.updated_at else None
    })
