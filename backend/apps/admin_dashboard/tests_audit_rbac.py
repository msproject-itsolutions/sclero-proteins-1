from io import StringIO

from django.core.management import call_command
from django.test import SimpleTestCase
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.admin_dashboard.management.commands.audit_rbac import classify
from apps.users.permissions import require_permission


class _GatedViewSet(viewsets.ViewSet):
    permission_classes = [require_permission('orders.view')]

    def list(self, request):
        return Response([])

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def public_summary(self, request):
        return Response({})


class _OverrideViewSet(viewsets.ViewSet):
    permission_classes = [require_permission('orders.manage')]

    def get_permissions(self):
        if self.action == 'list':
            return [AllowAny()]
        return super().get_permissions()

    def list(self, request):
        return Response([])

    def create(self, request):
        return Response({})


class _AuthOnlyView(APIView):
    permission_classes = [IsAuthenticated]


class ClassifyTests(SimpleTestCase):
    def test_class_level_permission_is_reported(self):
        self.assertEqual(classify(_GatedViewSet, 'list'), ('rbac', {'orders.view'}))

    def test_per_action_permission_classes_are_seen(self):
        posture = classify(_GatedViewSet, 'public_summary', {'permission_classes': [AllowAny]})
        self.assertEqual(posture, ('public', None))

    def test_get_permissions_override_is_seen(self):
        self.assertEqual(classify(_OverrideViewSet, 'list'), ('public', None))
        self.assertEqual(classify(_OverrideViewSet, 'create'), ('rbac', {'orders.manage'}))

    def test_authenticated_only_view(self):
        self.assertEqual(classify(_AuthOnlyView), ('auth', None))


class AuditCommandTests(SimpleTestCase):
    def test_strict_audit_passes_and_reports_public_admin_actions(self):
        out = StringIO()
        call_command('audit_rbac', '--strict', stdout=out)
        lines = out.getvalue().splitlines()
        toggles = [line for line in lines if line.startswith('api/admin/toggles/active_toggles/')]
        self.assertTrue(toggles, 'active_toggles route missing from the report')
        self.assertIn('public (allow-listed)', toggles[0])
