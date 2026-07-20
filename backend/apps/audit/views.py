from rest_framework import viewsets
from rest_framework.pagination import PageNumberPagination
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.users.permissions import require_permission
from .models import AuditLog
from .serializers import AuditLogSerializer


class AdminDashboardPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only audit trail. Gated by 'audit.view'.

    Filters: ?action=, ?actor_email=, ?target_type=, ?target_id=, ?search=
    """
    serializer_class = AuditLogSerializer
    permission_classes = [require_permission('audit.view')]
    pagination_class = AdminDashboardPagination

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
        return qs

    @action(detail=False, methods=['get'])
    def actions(self, request):
        """Distinct action keys present in the log — for building a filter UI."""
        # order_by('action') overrides the model's -created_at default ordering,
        # which would otherwise break DISTINCT (created_at leaks into the SELECT).
        keys = list(
            AuditLog.objects.order_by('action').values_list('action', flat=True).distinct()
        )
        return Response(keys)
