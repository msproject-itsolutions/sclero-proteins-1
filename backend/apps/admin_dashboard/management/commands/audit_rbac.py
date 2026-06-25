"""Audit every admin URL pattern's RBAC posture.

Lists each URL whose path contains '/admin/' (or matches known sensitive prefixes),
the view class, and the required_permission key it enforces. Flags any view that
is reachable WITHOUT a require_permission gate as a finding.

Usage:
    python manage.py audit_rbac
    python manage.py audit_rbac --strict   # exit 1 if any finding
"""
from django.core.management.base import BaseCommand
from django.urls import get_resolver, URLPattern, URLResolver
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from apps.users.permissions import PERMISSIONS, HasPermission


# Only DRF /api/admin/ paths need require_permission gates. Django's built-in
# /admin/ is gated by @staff_member_required (the framework handles it).
SENSITIVE_PREFIXES = ('api/admin/', 'api/auth/2fa/', 'api/auth/me/')
# Self-service endpoints — authenticated user acting on own resource. IsAuthenticated
# is the correct gate, not an RBAC permission key.
SELF_SERVICE_PREFIXES = ('api/auth/2fa/', 'api/auth/me/')


def walk_patterns(patterns, prefix=''):
    for p in patterns:
        if isinstance(p, URLPattern):
            yield prefix + str(p.pattern), p
        elif isinstance(p, URLResolver):
            yield from walk_patterns(p.url_patterns, prefix + str(p.pattern))


def _view_class(pattern):
    cb = pattern.callback
    cls = getattr(cb, 'view_class', None) or getattr(cb, 'cls', None)
    return cls


def _gate(view_class):
    """Return ('rbac', key), ('auth', None), or (None, None) for missing."""
    if not view_class:
        return None, None
    classes = getattr(view_class, 'permission_classes', []) or []
    for cls in classes:
        if isinstance(cls, type) and issubclass(cls, HasPermission):
            return 'rbac', getattr(cls, 'required', None)
    for cls in classes:
        if isinstance(cls, type) and (cls is IsAuthenticated or cls is IsAdminUser):
            return 'auth', cls.__name__
    return None, None


class Command(BaseCommand):
    help = 'Audit admin URL patterns for RBAC enforcement gaps.'

    def add_arguments(self, parser):
        parser.add_argument('--strict', action='store_true',
                            help='Exit non-zero on any finding.')

    def handle(self, *args, **opts):
        resolver = get_resolver()
        rows = []
        findings = []
        seen_views = set()
        for path, pat in walk_patterns(resolver.url_patterns):
            clean = path.replace('^', '').rstrip('$').replace('\\.', '.')
            if not any(p in clean for p in SENSITIVE_PREFIXES):
                continue
            view_cls = _view_class(pat)
            view_name = view_cls.__name__ if view_cls else '<func>'
            # dedupe — viewset format suffixes produce 4 rows per real route
            key = (view_name, clean.split('/(?P<')[0].split('\\.(?P<')[0])
            if key in seen_views:
                continue
            seen_views.add(key)

            gate, val = _gate(view_cls)
            is_self = any(p in clean for p in SELF_SERVICE_PREFIXES)
            if gate == 'rbac':
                rows.append((clean, view_name, val))
                if val not in PERMISSIONS:
                    findings.append((clean, view_name, f"unknown perm key '{val}'"))
            elif gate == 'auth' and is_self:
                rows.append((clean, view_name, f'auth:{val}'))  # acceptable
            else:
                rows.append((clean, view_name, '— UNGATED'))
                findings.append((clean, view_name))

        rows.sort()
        w_path = max((len(r[0]) for r in rows), default=40)
        w_view = max((len(r[1]) for r in rows), default=20)
        self.stdout.write(self.style.MIGRATE_HEADING(
            f"{'Path':<{w_path}}  {'View':<{w_view}}  Required permission"
        ))
        self.stdout.write('-' * (w_path + w_view + 24))
        for path, view, perm in rows:
            style = self.style.SUCCESS if perm != '—' else self.style.WARNING
            self.stdout.write(f"{path:<{w_path}}  {view:<{w_view}}  {style(perm)}")

        self.stdout.write('')
        self.stdout.write(f"Total sensitive endpoints: {len(rows)}")
        self.stdout.write(f"Ungated endpoints:         {len(findings)}")
        self.stdout.write(f"Registered permission keys: {len(PERMISSIONS)}")

        if findings:
            self.stdout.write('')
            self.stdout.write(self.style.ERROR('Findings:'))
            for f in findings:
                self.stdout.write(self.style.ERROR(f'  {f}'))
            if opts.get('strict'):
                raise SystemExit(1)
        else:
            self.stdout.write(self.style.SUCCESS('No ungated admin endpoints. RBAC posture clean.'))
