from io import StringIO

from django.core.management import call_command
from django.core.management.base import CommandError
from django.http import HttpResponse
from django.test import SimpleTestCase, override_settings
from django.urls import path
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.admin_dashboard.management.commands.audit_rbac import classify
from apps.users.permissions import HasPermission, require_permission


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


def _plain_function_view(request):
    return HttpResponse('')


class _KeylessView(APIView):
    permission_classes = [HasPermission]


# URLconf used by AuditFindingTests to feed the audit routes it must flag.
urlpatterns = [
    path('api/admin/plain-function/', _plain_function_view),
    path('api/admin/keyless/', _KeylessView.as_view()),
]


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


@override_settings(ROOT_URLCONF='apps.admin_dashboard.tests_audit_rbac')
class AuditFindingTests(SimpleTestCase):
    def test_unevaluable_routes_are_findings_not_skips_or_crashes(self):
        out = StringIO()
        call_command('audit_rbac', stdout=out)
        text = out.getvalue()
        self.assertIn('api/admin/plain-function/: no view class to evaluate', text)
        self.assertIn('api/admin/keyless/ _KeylessView.-: permission class without a key', text)
        self.assertTrue(
            any(line.startswith('api/admin/keyless/') for line in text.splitlines()),
            'keyless route missing from the report table',
        )
        self.assertIn('Findings:                2', text)

    def test_strict_mode_fails_on_these_findings(self):
        with self.assertRaises(CommandError):
            call_command('audit_rbac', '--strict', stdout=StringIO())
