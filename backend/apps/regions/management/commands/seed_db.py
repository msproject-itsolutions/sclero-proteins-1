import os
from django.core.management.base import BaseCommand, CommandError
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model
from apps.regions.models import Region, Warehouse
from apps.admin_dashboard.models import FeatureToggle

User = get_user_model()

class Command(BaseCommand):
    help = 'Seeds Sclero Proteins database with default regions, warehouses, products, and admin.'

    def handle(self, *args, **options):
        self.stdout.write('Seeding Sclero Proteins database...')

        # 1. Create Admin. Password from SEED_SUPERUSER_PASSWORD env var; in DEBUG
        # only, falls back to a published dev default. Refused silently otherwise.
        from django.conf import settings as _s
        if not User.objects.filter(email='admin@scleroproteins.co.uk').exists():
            pw = os.getenv('SEED_SUPERUSER_PASSWORD')
            if not pw:
                if not _s.DEBUG:
                    self.stderr.write(self.style.ERROR(
                        'SEED_SUPERUSER_PASSWORD env var is required when DEBUG=False. '
                        'Refusing to seed a superuser with a published default in production.'
                    ))
                    return
                pw = 'AdminPass123!'
            try:
                validate_password(pw)
            except ValidationError as exc:
                raise CommandError(f"SEED_SUPERUSER_PASSWORD is not strong enough: {'; '.join(exc.messages)}")
            User.objects.create_superuser(
                email='admin@scleroproteins.co.uk',
                password=pw,
                first_name='System',
                last_name='Admin'
            )
            shown = pw if pw == 'AdminPass123!' else '<from SEED_SUPERUSER_PASSWORD>'
            self.stdout.write(self.style.SUCCESS(f'Admin account created (admin@scleroproteins.co.uk / {shown})'))

        # 2. Create Regions
        r_in, _ = Region.objects.get_or_create(
            code='IN',
            defaults={
                'name': 'India',
                'domain': 'scleroproteins.in',
                'currency_code': 'INR',
                'currency_symbol': '₹',
                'tax_name': 'GST',
                'tax_rate': 18.00,
                'is_active': True
            }
        )
        r_uk, _ = Region.objects.get_or_create(
            code='UK',
            defaults={
                'name': 'United Kingdom',
                'domain': 'scleroproteins.co.uk',
                'currency_code': 'GBP',
                'currency_symbol': '£',
                'tax_name': 'VAT',
                'tax_rate': 20.00,
                'is_active': True
            }
        )
        self.stdout.write('Regions created (IN, UK)')

        # 3. Create Warehouses
        w_in, _ = Warehouse.objects.get_or_create(
            name='Anand Central Warehouse',
            region=r_in,
            defaults={'address': 'Plot No 12, Midc Ind Area, Mumbai, Maharashtra, 400001'}
        )
        w_uk, _ = Warehouse.objects.get_or_create(
            name='London Heathrow Warehouse',
            region=r_uk,
            defaults={'address': 'Unit 4, Heathrow Cargo Centre, Hounslow, TW6 3UA'}
        )
        self.stdout.write('Warehouses created (Mumbai, London)')

        # 4. Products — delegated to seed_catalog, the single source of truth
        # for the fixed 5-product OvoMatrix catalog (Combo Collagen, OvoShell
        # Collagen, BJC, SoilPro, LawnCal) + the OvoMatrix technology page.
        # seed_catalog also archives any product outside that list.
        from django.core.management import call_command
        call_command('seed_catalog')
        self.stdout.write('Products seeded via seed_catalog (fixed 5-product catalog)')

        # 5. Create Feature Toggles
        modules = [
            'marketing_discounts',
            'loyalty_program',
            'customer_reviews',
            'notifications_email',
            'notifications_whatsapp',
            'sales_bundles',
            'customer_wishlist'
        ]
        for m in modules:
            FeatureToggle.objects.get_or_create(module_name=m, region=None, defaults={'is_enabled': True})
        
        # Disable bundles for UK only to demonstrate regional override
        FeatureToggle.objects.get_or_create(module_name='sales_bundles', region=r_uk, defaults={'is_enabled': False})

        self.stdout.write(self.style.SUCCESS('Database seeded successfully!'))
