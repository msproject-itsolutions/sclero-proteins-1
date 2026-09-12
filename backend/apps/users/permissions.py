"""
Role-based access control (RBAC) for staff.

A registry of permission KEYS. Roles (apps.users.models.Role) each hold a
list of these keys; a user's effective permissions are the union of their roles'
keys (superusers implicitly have all).

Enforcement defaults on in every environment. An explicit local-only override
may disable it for isolated fixture work.
"""
import ipaddress

from django.conf import settings
from rest_framework.permissions import BasePermission
from apps.audit.context import client_ip_from_request

# --- Granular Permission Catalogue (Category-based) ------------------------- #
PERMISSIONS = {
    # Dashboard
    'dashboard.view': 'View sales dashboard',
    'dashboard.export': 'Export dashboard analytics',

    # Products
    'products.view': 'View catalog products',
    'products.create': 'Create new catalog products',
    'products.edit': 'Edit product fields and pricing',
    'products.delete': 'Delete or archive products',
    'products.publish': 'Publish products to active store',

    # Inventory
    'inventory.view': 'View warehouses and stock',
    'inventory.edit': 'Update stock levels and transfers',
    'inventory.import': 'Bulk import inventory sheets',
    'inventory.export': 'Export inventory sheets',

    # Orders
    'orders.view': 'View orders listing',
    'orders.create': 'Create manual/draft orders',
    'orders.edit': 'Update order details or address',
    'orders.cancel': 'Cancel or delete orders',
    'orders.refund': 'Issue refunds on orders',

    # Customers
    'customers.view': 'View customer profiles',
    'customers.edit': 'Edit customer files',
    'customers.export': 'Export customer spreadsheets',

    # Content
    'content.view': 'View blog, pages and landing configurations',
    'content.create': 'Create blog or page drafts',
    'content.edit': 'Edit content drafts and SEO meta tags',
    'content.publish': 'Publish pages, blogs and FAQs live',

    # Marketing
    'marketing.view': 'View campaigns and connections',
    'marketing.create': 'Create discount codes and campaigns',
    'marketing.edit': 'Edit discount configs and pixels',
    'marketing.launch': 'Launch active campaigns and ads',

    # Reports
    'reports.view': 'View PDF/CSV report analytics',
    'reports.export': 'Generate and download reports',

    # Finance
    'finance.view': 'View invoices, VAT, GST and payments',
    'finance.edit': 'Edit payout channels and tax rates',
    'finance.export': 'Export accounting ledgers',

    # Staff
    'staff.view': 'View staff directory',
    'staff.create': 'Invite or create staff members',
    'staff.edit': 'Update staff roles and restrictions',
    'staff.delete': 'Deactivate or delete staff members',

    # Security
    'security.view': 'View active devices, logs and 2FA statuses',
    'security.edit': 'Modify IP restrictions, 2FA settings and terminate sessions',

    # Coarse admin scopes used by viewsets that combine create/edit/delete
    'products.manage': 'Full product catalog management (create/edit/delete/publish)',
    'orders.manage': 'Full order management (view/edit/cancel/fulfill)',
    'inventory.manage': 'Full inventory management (stock levels, warehouses, transfers)',
    'users.manage': 'Manage customer and staff accounts (read/edit/deactivate)',
    'rbac.manage': 'Manage roles, permissions, and assignments',
    'settings.manage': 'Edit platform settings, integrations, gateways, templates',
    'audit.view': 'View audit logs',
    'reviews.moderate': 'Approve, reject, or feature product reviews',
    'enquiries.manage': 'Triage B2B enquiries (status transitions, notes)',
}

ALL_PERMISSION_KEYS = set(PERMISSIONS.keys())

# --- What the admin panel should actually offer ------------------------------ #
# Only these keys are checked by require_permission() anywhere in the codebase.
# The rest of PERMISSIONS are declarative leftovers: granting or revoking them
# changes nothing, which is worse than useless on a permissions screen — an
# owner un-ticking "products.delete" would believe they had restricted someone
# who can still delete. The admin UI shows only these, grouped and in plain
# English. If you add a new require_permission('x.y') check, add 'x.y' here.
#
# Keep in step with:  grep -rho "require_permission('[a-z.]*')" apps/
ENFORCED_PERMISSION_GROUPS = [
    ('Orders', [
        ('orders.view', 'See orders and customer details'),
        ('orders.manage', 'Edit orders and update their status'),
        ('orders.refund', 'Issue refunds'),
    ]),
    ('Catalogue', [
        ('products.manage', 'Add, edit and archive products and categories'),
        ('inventory.manage', 'Adjust stock levels, warehouses and transfers'),
        ('reviews.moderate', 'Approve, reject or feature product reviews'),
    ]),
    ('Customers', [
        ('enquiries.manage', 'Handle B2B and wholesale enquiries'),
    ]),
    ('Money & reporting', [
        ('finance.view', 'See financial reports and payouts'),
        ('reports.view', 'See sales reports and analytics'),
    ]),
    ('Marketing & content', [
        ('marketing.edit', 'Edit marketing integrations and campaigns'),
    ]),
    ('Administration', [
        ('settings.manage', 'Change store settings, payments, shipping and templates'),
        ('users.manage', 'Add and edit staff accounts'),
        ('rbac.manage', 'Create roles and change what staff can do'),
        ('audit.view', 'Read the audit log'),
    ]),
]

ENFORCED_PERMISSION_KEYS = [key for _group, items in ENFORCED_PERMISSION_GROUPS for key, _label in items]

# --- Seeded Staff Hierarchy Roles -------------------------------------------- #
DEFAULT_ROLES = {
    'Admin': sorted(ALL_PERMISSION_KEYS),
    
    'Staff': [
        'dashboard.view', 'dashboard.export',
        'products.view', 'products.create', 'products.edit', 'products.delete', 'products.publish', 'products.manage',
        'inventory.view', 'inventory.edit', 'inventory.import', 'inventory.export', 'inventory.manage',
        'orders.view', 'orders.create', 'orders.edit', 'orders.cancel', 'orders.refund', 'orders.manage',
        'customers.view', 'customers.edit', 'customers.export',
        'reviews.moderate', 'enquiries.manage',
        'reports.view', 'reports.export',
    ],
}

# --- Resolution helpers ------------------------------------------------------ #
def get_user_permission_keys(user):
    if not user or not getattr(user, 'is_authenticated', False):
        return set()
    if user.is_superuser:
        return set(ALL_PERMISSION_KEYS)
    keys = set()
    for role in user.roles.all():
        keys.update(role.permissions or [])
    return keys

def user_has_permission(user, key):
    if user and getattr(user, 'is_superuser', False):
        return True
    return key in get_user_permission_keys(user)


def is_staff_account(user):
    """Anyone who can reach the admin: staff flag, superuser, or any role."""
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    if user.is_staff or user.is_superuser:
        return True
    return user.roles.exists()


def client_ip_is_allowed(client_ip, allowed_rules):
    if not client_ip:
        return False
    try:
        address = ipaddress.ip_address(client_ip)
    except ValueError:
        return False
    for rule in allowed_rules:
        try:
            network = ipaddress.ip_network(rule, strict=False)
        except ValueError:
            continue
        if address in network:
            return True
    return False


def allowed_ip_rules(user):
    return [rule.strip() for rule in (getattr(user, 'allowed_ip_range', '') or '').split(',') if rule.strip()]


def ip_allowed(user, request):
    """True unless the account has an IP allow-list and the request comes from outside it."""
    rules = allowed_ip_rules(user)
    return not rules or client_ip_is_allowed(client_ip_from_request(request), rules)

# --- DRF permission classes -------------------------------------------------- #
class HasPermission(BasePermission):
    """
    Enforces that the authenticated user holds the required permission key.

    Never grants anonymous access. With RBAC_ENFORCED disabled (local fixture
    work only; production refuses to start that way) any staff account passes.
    """
    required = None
    message = "You do not have permission to perform this action."

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False

        if not ip_allowed(user, request):
            self.message = f"IP address {client_ip_from_request(request)} is not allowed to access this profile."
            return False

        if not getattr(settings, 'RBAC_ENFORCED', True):
            return is_staff_account(user)
        key = getattr(view, 'required_permission', None) or self.required
        if key is None:
            return is_staff_account(user)
        return user_has_permission(user, key)

def require_permission(key):
    """Factory returning a HasPermission subclass bound to `key`."""
    safe = key.replace('.', '_')
    return type(f'HasPermission_{safe}', (HasPermission,), {'required': key})
