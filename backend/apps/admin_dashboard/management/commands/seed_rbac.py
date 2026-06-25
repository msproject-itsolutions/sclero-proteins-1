import os
import random
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from decimal import Decimal
from apps.users.models import Role
from apps.regions.models import Region
from apps.orders.models import Order
from apps.admin_dashboard.models import ApprovalRequest
from apps.audit.models import AuditLog
from apps.users.permissions import DEFAULT_ROLES

User = get_user_model()

class Command(BaseCommand):
    help = 'Seeds hierarchical roles, mock staff users, pending approval requests, and audit logs.'

    def handle(self, *args, **options):
        self.stdout.write("Starting Sclero Proteins RBAC & Workflows Seeding...")

        # 1. Seed Roles
        role_objs = {}
        for role_name, perms in DEFAULT_ROLES.items():
            role, created = Role.objects.update_or_create(
                name=role_name,
                defaults={
                    'description': f"Hierarchical access level role for {role_name}",
                    'permissions': perms,
                    'is_system': True
                }
            )
            role_objs[role_name] = role
            action_word = "Created" if created else "Updated"
            self.stdout.write(f"  {action_word} Role: {role_name} ({len(perms)} permissions)")

        # Ensure we have regions populated
        gb_region, _ = Region.objects.get_or_create(code='GB', defaults={'name': 'United Kingdom', 'currency_code': 'GBP', 'currency_symbol': '£', 'is_active': True})
        in_region, _ = Region.objects.get_or_create(code='IN', defaults={'name': 'India', 'currency_code': 'INR', 'currency_symbol': '₹', 'is_active': True})

        # 2. Seed Mock Staff Users
        staff_data = [
            ('owner@scleroproteins.co.uk', 'Owner', 'Super', 'Super Admin', True, []),
            ('admin@scleroproteins.co.uk', 'Admin', 'User', 'Admin', False, []),
            ('opsmanager@scleroproteins.co.uk', 'Operations', 'Manager', 'Operations Manager', False, []),
            ('supportagent@scleroproteins.co.uk', 'Support', 'Agent', 'Customer Support Agent', False, []),
            ('ukmanager@scleroproteins.co.uk', 'UK Country', 'Manager', 'Admin', False, ['GB']),
            ('indiamanager@scleroproteins.co.uk', 'India Country', 'Manager', 'Admin', False, ['IN']),
            ('finance@scleroproteins.co.uk', 'Finance', 'Manager', 'Finance Manager', False, []),
            ('quality@scleroproteins.co.uk', 'Quality', 'Compliance', 'Compliance Manager', False, []),
        ]

        user_objs = {}
        for email, fn, ln, role_name, is_super, regions_list in staff_data:
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'first_name': fn,
                    'last_name': ln,
                    'is_staff': True,
                    'is_superuser': is_super,
                }
            )
            # Set a password only on first creation. Password source order:
            #   1. SEED_STAFF_PASSWORD env var (recommended for non-dev seeds)
            #   2. settings.DEBUG=True only — fallback dev default
            # Re-runs never overwrite an existing usable password.
            if created or not user.has_usable_password():
                pw = os.getenv('SEED_STAFF_PASSWORD')
                if not pw:
                    from django.conf import settings as _s
                    if not _s.DEBUG:
                        raise RuntimeError(
                            'SEED_STAFF_PASSWORD env var is required when DEBUG=False. '
                            'Refusing to seed staff accounts with a publicly-known default in production.'
                        )
                    pw = 'ScleroStaff2026!'  # dev-only fallback
                user.set_password(pw)
            user.save()
            
            # Link roles
            user.roles.clear()
            if role_name in role_objs:
                user.roles.add(role_objs[role_name])

            # Link assigned regions
            user.assigned_regions.clear()
            for r_code in regions_list:
                r_obj = Region.objects.filter(code=r_code).first()
                if r_obj:
                    user.assigned_regions.add(r_obj)
            
            user_objs[email] = user
            action_word = "Created" if created else "Updated"
            self.stdout.write(f"  {action_word} Staff User: {email} with role {role_name}")

        # 3. Seed Mock Approval Requests
        # Let's see if we have some orders in DB to reference, otherwise mock them
        mock_order = Order.objects.first()
        order_id = mock_order.id if mock_order else 1
        currency = mock_order.currency_code if mock_order else 'GBP'
        region_code = mock_order.region.code if (mock_order and mock_order.region) else 'GB'

        requests = [
            {
                'requester': user_objs['supportagent@scleroproteins.co.uk'],
                'request_type': 'REFUND',
                'summary': f"Refund of {currency} 150.00 for Order #{order_id} (exceeds Support Agent limit)",
                'details': {
                    'order_id': order_id,
                    'amount': 150.00,
                    'currency_code': currency,
                    'region_code': region_code,
                    'reason': 'Customer package damaged during transit',
                    'requester_role': 'Customer Support Agent'
                },
                'payload': {
                    'order_id': order_id,
                    'amount': 150.00,
                    'reason': 'Customer package damaged during transit',
                    'restock': True
                }
            },
            {
                'requester': user_objs['opsmanager@scleroproteins.co.uk'],
                'request_type': 'DISCOUNT',
                'summary': "Special 35% discount campaign coupon matrix-bulk (exceeds Manager limit of 15%)",
                'details': {
                    'discount_code': 'MATRIXBULK35',
                    'discount_percentage': 35.0,
                    'region_code': 'GB',
                    'requester_role': 'Operations Manager'
                },
                'payload': {
                    'discount_code': 'MATRIXBULK35',
                    'discount_percentage': 35.0,
                    'is_active': True
                }
            },
            {
                'requester': user_objs['admin@scleroproteins.co.uk'],
                'request_type': 'PRODUCT',
                'summary': "Bulk price increase of BJC joint care on regional warehouses by 25%",
                'details': {
                    'product_sku': 'BJC-BONE-JOINT',
                    'prices': {'GB': 54.99, 'IN': 4499.00},
                    'region_code': 'GB',
                    'requester_role': 'Admin'
                },
                'payload': {
                    'product_sku': 'BJC-BONE-JOINT',
                    'prices': {'GB': 54.99, 'IN': 4499.00}
                }
            }
        ]

        for req in requests:
            ApprovalRequest.objects.create(
                requester=req['requester'],
                request_type=req['request_type'],
                status='PENDING',
                summary=req['summary'],
                details=req['details'],
                payload=req['payload']
            )
        self.stdout.write("  Seeded 3 pending approval requests.")

        # 4. Seed Audit Logs
        logs = [
            ('login.success', 'superadmin@scleroproteins.co.uk', 'User', '1', "Super Admin login successful", {'ip': '192.168.1.1'}),
            ('role.modified', 'superadmin@scleroproteins.co.uk', 'Role', '2', "Role permissions catalog updated", {'modified_by': 'Owner'}),
            ('product.price_updated', 'admin@scleroproteins.co.uk', 'Product', 'BJC-BONE-JOINT', "Adjusted BJC regional price config", {'old_price': 44.99, 'new_price': 49.99}),
            ('refund.issued', 'opsmanager@scleroproteins.co.uk', 'Order', str(order_id), f"Refund of {currency} 45.00 executed directly", {'amount': 45.00}),
        ]

        for act, email, target_type, target_id, sum_val, changes in logs:
            user = user_objs.get(email)
            AuditLog.objects.create(
                actor=user,
                actor_email=email,
                action=act,
                target_type=target_type,
                target_id=target_id,
                summary=sum_val,
                changes=changes,
                ip_address='192.168.1.' + str(random.randint(10, 200)),
                user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/125.0.0.0'
            )
        self.stdout.write("  Seeded initial audit logs history.")

        self.stdout.write(self.style.SUCCESS("Sclero Proteins RBAC & Workflows seeded successfully!"))
