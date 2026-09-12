"""Audit every admin URL's RBAC posture, per action.

For each route under a sensitive prefix the command builds the view the way
DRF does for that action and inspects the permissions it would really apply,
including per-action permission_classes and get_permissions() overrides that a
class-level inspection misses.

Usage:
    python manage.py audit_rbac
    python manage.py audit_rbac --strict   # exit 1 if any finding
"""
from django.core.management.base import BaseCommand, CommandError
from django.urls import URLPattern, URLResolver, get_resolver
from rest_framework.permissions import AllowAny, IsAdminUser, IsAuthenticated

from apps.users.permissions import ENFORCED_PERMISSION_KEYS, HasPermission

SENSITIVE_PREFIXES = ('api/admin/', 'api/auth/2fa/', 'api/auth/me/')
# Signed-in users acting on their own account; IsAuthenticated is the right gate.
SELF_SERVICE_PREFIXES = ('api/auth/2fa/', 'api/auth/me/')
# Storefront reads that live under /api/admin/ for historical reasons and
# expose no staff data. Anything else public under /api/admin/ is a finding.
PUBLIC_ADMIN_ACTIONS = {
    ('FeatureToggleViewSet', 'active_toggles'),
    ('HeroBannerSlideViewSet', 'active'),
    ('PaymentGatewayViewSet', 'available'),
}


def walk_patterns(patterns, prefix=''):
    for pattern in patterns:
        if isinstance(pattern, URLPattern):
            yield prefix + str(pattern.pattern), pattern
        elif isinstance(pattern, URLResolver):
            yield from walk_patterns(pattern.url_patterns, prefix + str(pattern.pattern))


def clean_route(route):
    return route.replace('^', '').rstrip('$').replace('\\.', '.')


def view_actions(callback):
    """Yield (view_class, action_name, initkwargs) for each action a route serves."""
    view_class = getattr(callback, 'cls', None) or getattr(callback, 'view_class', None)
    if view_class is None:
        return
    initkwargs = getattr(callback, 'initkwargs', None) or getattr(callback, 'view_initkwargs', None) or {}
    actions = getattr(callback, 'actions', None)
    if actions:
        for action_name in sorted(set(actions.values())):
            yield view_class, action_name, initkwargs
    else:
        yield view_class, None, initkwargs


def classify(view_class, action_name=None, initkwargs=None):
    view = view_class(**(initkwargs or {}))
    view.action = action_name
    view.request = None
    view.args, view.kwargs = (), {}
    view.format_kwarg = None
    permissions = view.get_permissions()
    keys = {
        getattr(view, 'required_permission', None) or permission.required
        for permission in permissions
        if isinstance(permission, HasPermission)
    }
    if keys:
        return 'rbac', keys
    if any(isinstance(permission, (IsAuthenticated, IsAdminUser)) for permission in permissions):
        return 'auth', None
    if all(isinstance(permission, AllowAny) for permission in permissions):
        return 'public', None
    return 'none', None


class Command(BaseCommand):
    help = 'Audit admin URL patterns for RBAC enforcement gaps.'

    def add_arguments(self, parser):
        parser.add_argument('--strict', action='store_true', help='Exit non-zero on any finding.')

    def handle(self, *args, **options):
        rows, findings, seen = [], [], set()
        for raw_route, pattern in walk_patterns(get_resolver().url_patterns):
            route = clean_route(raw_route)
            if '(?P<format>' in route or not route.startswith(SENSITIVE_PREFIXES):
                continue
            for view_class, action_name, initkwargs in view_actions(pattern.callback):
                marker = (route, view_class.__name__, action_name)
                if marker in seen:
                    continue
                seen.add(marker)
                label = action_name or '-'
                try:
                    gate, keys = classify(view_class, action_name, initkwargs)
                except Exception as exc:  # an unreadable view is itself a finding
                    rows.append((route, view_class.__name__, label, 'ERROR'))
                    findings.append(f'{route} {view_class.__name__}.{label}: cannot evaluate ({exc})')
                    continue

                if gate == 'rbac':
                    posture = ', '.join(sorted(keys))
                    ungrantable = sorted(key for key in keys if key not in ENFORCED_PERMISSION_KEYS)
                    if ungrantable:
                        findings.append(
                            f'{route} {view_class.__name__}.{label}: key not offered in the role editor '
                            f'{ungrantable}'
                        )
                elif gate == 'auth' and route.startswith(SELF_SERVICE_PREFIXES):
                    posture = 'self-service (authenticated)'
                elif gate == 'public' and (view_class.__name__, action_name) in PUBLIC_ADMIN_ACTIONS:
                    posture = 'public (allow-listed)'
                else:
                    posture = f'UNGATED ({gate})'
                    findings.append(f'{route} {view_class.__name__}.{label}: {posture}')
                rows.append((route, view_class.__name__, label, posture))

        rows.sort()
        width_route = max((len(row[0]) for row in rows), default=40)
        width_view = max((len(row[1]) for row in rows), default=20)
        width_action = max((len(row[2]) for row in rows), default=10)
        for route, view_name, label, posture in rows:
            style = self.style.ERROR if posture.startswith(('UNGATED', 'ERROR')) else self.style.SUCCESS
            self.stdout.write(
                f'{route:<{width_route}}  {view_name:<{width_view}}  {label:<{width_action}}  {style(posture)}'
            )

        self.stdout.write('')
        self.stdout.write(f'Sensitive route actions: {len(rows)}')
        self.stdout.write(f'Findings:                {len(findings)}')
        for finding in findings:
            self.stdout.write(self.style.ERROR(f'  {finding}'))
        if findings and options.get('strict'):
            raise CommandError(f'{len(findings)} RBAC finding(s).')
        if not findings:
            self.stdout.write(self.style.SUCCESS('No ungated admin endpoints.'))
