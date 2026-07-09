from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from apps.orders.models import Order
from apps.webhooks.dispatcher import dispatch_outgoing_webhook

@receiver(pre_save, sender=Order)
def order_pre_save(sender, instance, **kwargs):
    if instance.pk:
        try:
            old_instance = Order.objects.get(pk=instance.pk)
            instance._old_status = old_instance.status
            instance._old_payment_status = old_instance.payment_status
        except Order.DoesNotExist:
            instance._old_status = None
            instance._old_payment_status = None
    else:
        instance._old_status = None
        instance._old_payment_status = None

@receiver(post_save, sender=Order)
def order_post_save(sender, instance, created, **kwargs):
    if created:
        # Dispatch order.created
        dispatch_outgoing_webhook('order.created', {
            'order_id': instance.id,
            'status': instance.status,
            'payment_status': instance.payment_status,
            'total': str(instance.total),
            'currency': instance.currency_code,
            'email': instance.email,
            'created_at': instance.created_at.isoformat() if instance.created_at else None
        })
        
        # If created as PAID directly (e.g. some sandbox checkout flow)
        if instance.payment_status == 'PAID':
            dispatch_outgoing_webhook('order.paid', {
                'order_id': instance.id,
                'status': instance.status,
                'payment_status': instance.payment_status,
                'total': str(instance.total),
                'currency': instance.currency_code,
                'payment_method': instance.payment_method,
                'transaction_id': instance.payment_id
            })
    else:
        # Check for status transition to CANCELLED
        old_status = getattr(instance, '_old_status', None)
        if instance.status == 'CANCELLED' and old_status != 'CANCELLED':
            dispatch_outgoing_webhook('order.cancelled', {
                'order_id': instance.id,
                'status': instance.status,
                'payment_status': instance.payment_status,
                'total': str(instance.total),
                'currency': instance.currency_code,
                'email': instance.email
            })

        # Check for status transition to REFUNDED
        if instance.status == 'REFUNDED' and old_status != 'REFUNDED':
            dispatch_outgoing_webhook('order.refunded', {
                'order_id': instance.id,
                'status': instance.status,
                'payment_status': instance.payment_status,
                'total': str(instance.total),
                'currency': instance.currency_code,
                'email': instance.email
            })

        # Check for payment_status transition to PAID
        old_payment_status = getattr(instance, '_old_payment_status', None)
        if instance.payment_status == 'PAID' and old_payment_status != 'PAID':
            dispatch_outgoing_webhook('order.paid', {
                'order_id': instance.id,
                'status': instance.status,
                'payment_status': instance.payment_status,
                'total': str(instance.total),
                'currency': instance.currency_code,
                'payment_method': instance.payment_method,
                'transaction_id': instance.payment_id
            })
