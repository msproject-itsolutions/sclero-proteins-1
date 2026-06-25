from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.users.permissions import require_permission
from .models import AuditLog
from .serializers import AuditLogSerializer


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only audit trail. Gated by 'audit.view'.

    Filters: ?action=, ?actor_email=, ?target_type=, ?target_id=, ?search=
    """
    serializer_class = AuditLogSerializer
    permission_classes = [require_permission('audit.view')]

    def get_queryset(self):
        qs = AuditLog.objects.select_related('actor').all()
        p = self.request.query_params
        if p.get('action'):
            qs = qs.filter(action=p['action'])
        if p.get('actor_email'):
            qs = qs.filter(actor_email__iexact=p['actor_email'])
        if p.get('target_type'):
            qs = qs.filter(target_type=p['target_type'])
        if p.get('target_id'):
            qs = qs.filter(target_id=str(p['target_id']))
        if p.get('search'):
            qs = qs.filter(summary__icontains=p['search'])
        return qs[:500]

    @action(detail=False, methods=['get'])
    def actions(self, request):
        """Distinct action keys present in the log — for building a filter UI."""
        # order_by('action') overrides the model's -created_at default ordering,
        # which would otherwise break DISTINCT (created_at leaks into the SELECT).
        keys = list(
            AuditLog.objects.order_by('action').values_list('action', flat=True).distinct()
        )
        return Response(keys)

    @action(detail=True, methods=['post'])
    def rollback(self, request, pk=None):
        log = self.get_object()
        if not log.changes:
            return Response({"error": "No changes recorded for this log entry."}, status=status.HTTP_400_BAD_REQUEST)
        
        from django.apps import apps
        try:
            model_class = None
            if '.' in log.target_type:
                model_class = apps.get_model(log.target_type)
            else:
                for app_config in apps.get_app_configs():
                    try:
                        model_class = app_config.get_model(log.target_type)
                        break
                    except LookupError:
                        continue
            
            if not model_class:
                return Response({"error": f"Target model '{log.target_type}' not found."}, status=status.HTTP_400_BAD_REQUEST)
            
            instance = model_class.objects.get(id=log.target_id)
            
            # Revert changes: log.changes is a dict like {"field_name": [old_val, new_val]}
            for field, vals in log.changes.items():
                if isinstance(vals, list) and len(vals) == 2:
                    old_val = vals[0]
                    setattr(instance, field, old_val)
            instance.save()
            
            # Create audit log record for the rollback itself
            AuditLog.objects.create(
                actor=request.user if request.user.is_authenticated else None,
                actor_email=request.user.email if request.user.is_authenticated else 'system',
                action='audit.rollback',
                target_type=log.target_type,
                target_id=str(log.target_id),
                summary=f"Rolled back changes from log #{log.id} on {log.target_type} #{log.target_id}",
                changes={"reverted_fields": list(log.changes.keys())}
            )
            return Response({"message": f"Successfully rolled back changes to {log.target_type} #{log.target_id}."})
            
        except Exception as e:
            return Response({"error": f"Failed to perform rollback: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
