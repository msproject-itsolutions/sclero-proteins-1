from django.utils import timezone
from rest_framework import viewsets, serializers, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.users.permissions import require_permission
from apps.audit.recorder import record_audit
from .models import OrderRiskAssessment


class OrderRiskAssessmentSerializer(serializers.ModelSerializer):
    order_id = serializers.IntegerField(source='order.id', read_only=True)
    order_email = serializers.SerializerMethodField()
    order_total = serializers.SerializerMethodField()
    currency = serializers.SerializerMethodField()
    reviewed_by_email = serializers.SerializerMethodField()

    class Meta:
        model = OrderRiskAssessment
        fields = (
            'id', 'order_id', 'order_email', 'order_total', 'currency',
            'score', 'level', 'signals', 'needs_review', 'decision',
            'reviewed_by_email', 'reviewed_at', 'created_at',
        )
        read_only_fields = fields

    def get_order_email(self, obj):
        return getattr(obj.order, 'email', '') if obj.order_id else ''

    def get_order_total(self, obj):
        return str(getattr(obj.order, 'total', '')) if obj.order_id else ''

    def get_currency(self, obj):
        return getattr(obj.order, 'currency_code', '') if obj.order_id else ''

    def get_reviewed_by_email(self, obj):
        return getattr(obj.reviewed_by, 'email', '') if obj.reviewed_by_id else ''


class RiskAssessmentAdminViewSet(viewsets.ModelViewSet):
    """Admin queue of fraud assessments.

    Filters: ?needs_review=true, ?level=HIGH, ?decision=APPROVE|REJECT
    POST /<pk>/mark_reviewed/  body: {"decision": "APPROVE"|"REJECT"}
    """

    serializer_class = OrderRiskAssessmentSerializer
    permission_classes = [require_permission('orders.manage')]
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        qs = OrderRiskAssessment.objects.select_related('order', 'reviewed_by')
        params = self.request.query_params
        if params.get('needs_review') in ('true', '1'):
            qs = qs.filter(needs_review=True)
        elif params.get('needs_review') in ('false', '0'):
            qs = qs.filter(needs_review=False)
        level = params.get('level')
        if level:
            qs = qs.filter(level=level.upper())
        decision = params.get('decision')
        if decision:
            qs = qs.filter(decision=decision.upper())
        return qs

    @action(detail=True, methods=['post'])
    def mark_reviewed(self, request, pk=None):
        assessment = self.get_object()
        decision = (request.data.get('decision') or '').upper()
        if decision not in ('APPROVE', 'REJECT'):
            return Response(
                {"error": "decision must be APPROVE or REJECT."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        assessment.decision = decision
        assessment.needs_review = False
        assessment.reviewed_by = request.user if request.user.is_authenticated else None
        assessment.reviewed_at = timezone.now()
        assessment.save(update_fields=['decision', 'needs_review', 'reviewed_by', 'reviewed_at'])

        order = assessment.order
        if decision == 'REJECT' and order:
            order.status = 'CANCELLED'
            order.save(update_fields=['status', 'updated_at'])
            record_audit(
                'order.cancelled_by_review',
                target_type='Order', target_id=order.id,
                summary=f"Order #{order.id} cancelled by fraud review",
                changes={'level': assessment.level, 'score': assessment.score},
            )
        else:
            record_audit(
                'order.risk_reviewed',
                target_type='Order', target_id=order.id if order else '',
                summary=f"Order #{getattr(order, 'id', '?')} approved by fraud review",
                changes={'level': assessment.level, 'decision': decision},
            )

        return Response(self.get_serializer(assessment).data)
