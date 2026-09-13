"""Order history: the timeline shown in the staff console plus the main audit log."""
from apps.audit.recorder import record_audit

from .models import AuditLog as OrderTimelineEntry


def log_order_event(order, event, label, *, changes=None, actor=None):
    changes = changes or {}
    OrderTimelineEntry.objects.create(
        user=actor if getattr(actor, 'is_authenticated', False) else None,
        action=label, model_name='Order', object_id=str(order.pk), changes=changes,
    )
    record_audit(
        event, target_type='Order', target_id=order.pk,
        summary=f'{label}: order #{order.pk}', changes=changes, actor=actor,
    )
