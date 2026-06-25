"""
Role-based access control (RBAC) for staff.

A registry of permission KEYS. Roles (apps.users.models.Role) each hold a
list of these keys; a user's effective permissions are the union of their roles'
keys (superusers implicitly have all).

Enforcement is OPT-IN via settings.RBAC_ENFORCED so the existing open prototype
keeps working until the admin UI sends JWTs. When the flag is off, the permission
classes allow everything; when on, they require an authenticated staff user whose
roles grant the required key.
"""
from django.conf import settings
from rest_framework.permissions import BasePermission

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

# --- Seeded Staff Hierarchy Roles -------------------------------------------- #
DEFAULT_ROLES = {
    'Super Admin': sorted(ALL_PERMISSION_KEYS),
    
    'Admin': [
        'dashboard.view', 'dashboard.export',
        'products.view', 'products.create', 'products.edit', 'products.delete', 'products.publish', 'products.manage',
        'inventory.view', 'inventory.edit', 'inventory.import', 'inventory.export', 'inventory.manage',
        'orders.view', 'orders.create', 'orders.edit', 'orders.cancel', 'orders.refund', 'orders.manage',
        'customers.view', 'customers.edit', 'customers.export', 'users.manage',
        'content.view', 'content.create', 'content.edit', 'content.publish',
        'marketing.view', 'marketing.create', 'marketing.edit', 'marketing.launch',
        'reports.view', 'reports.export',
        'finance.view', 'finance.export',
        'settings.manage', 'audit.view', 'reviews.moderate', 'enquiries.manage',
    ],
    
    'Operations Manager': [
        'dashboard.view',
        'inventory.view', 'inventory.edit', 'inventory.import', 'inventory.export',
        'orders.view', 'orders.create', 'orders.edit', 'orders.cancel', 'orders.refund',
        'customers.view',
    ],
    
    'Inventory Manager': [
        'dashboard.view',
        'products.view',
        'inventory.view', 'inventory.edit', 'inventory.import', 'inventory.export',
    ],
    
    'Product Manager': [
        'dashboard.view',
        'products.view', 'products.create', 'products.edit', 'products.delete', 'products.publish',
    ],
    
    'Content Manager': [
        'dashboard.view',
        'content.view', 'content.create', 'content.edit', 'content.publish',
    ],
    
    'SEO Manager': [
        'dashboard.view',
        'content.view', 'content.edit',
    ],
    
    'Marketing Manager': [
        'dashboard.view',
        'marketing.view', 'marketing.create', 'marketing.edit', 'marketing.launch',
    ],
    
    'Customer Support Manager': [
        'dashboard.view',
        'orders.view', 'orders.edit', 'orders.cancel', 'orders.refund',
        'customers.view', 'customers.edit',
    ],
    
    'Customer Support Agent': [
        'orders.view',
        'customers.view',
    ],
    
    'Finance Manager': [
        'dashboard.view', 'dashboard.export',
        'finance.view', 'finance.edit', 'finance.export',
        'reports.view', 'reports.export',
    ],
    
    'Accountant': [
        'dashboard.view',
        'finance.view', 'finance.export',
        'reports.view',
    ],
    
    'Warehouse Manager': [
        'dashboard.view',
        'inventory.view', 'inventory.edit',
        'orders.view', 'orders.edit',
    ],
    
    'Warehouse Staff': [
        'inventory.view',
        'orders.view',
    ],
    
    'Affiliate Manager': [
        'dashboard.view',
        'marketing.view', 'marketing.edit',
    ],
    
    'Compliance Manager': [
        'dashboard.view',
        'products.view', 'products.edit',
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

# --- DRF permission classes -------------------------------------------------- #
class HasPermission(BasePermission):
    """
    Enforces that the user has the required action permission key.
    No-op when settings.RBAC_ENFORCED is falsy.
    """
    required = None
    message = "You do not have permission to perform this action."

    def has_permission(self, request, view):
        if not getattr(settings, 'RBAC_ENFORCED', False):
            return True
        key = getattr(view, 'required_permission', None) or self.required
        if key is None:
            return True
        user = request.user
        
        # Enforce IP restrict logic if present
        if user and user.is_authenticated and user.allowed_ip_range:
            client_ip = request.META.get('REMOTE_ADDR')
            allowed_ips = [ip.strip() for ip in user.allowed_ip_range.split(',') if ip.strip()]
            if allowed_ips and client_ip not in allowed_ips:
                self.message = f"IP address {client_ip} is not allowed to access this profile."
                return False
                
        return bool(user and user.is_authenticated and user_has_permission(user, key))

def require_permission(key):
    """Factory returning a HasPermission subclass bound to `key`."""
    safe = key.replace('.', '_')
    return type(f'HasPermission_{safe}', (HasPermission,), {'required': key})
