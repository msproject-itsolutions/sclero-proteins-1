import os
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.regions.models import Region, Warehouse
from apps.products.models import Product, ProductRegionConfig, ProductMedia, ProductReview
from apps.inventory.models import StockLevel
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

        # 4. Create Products
        # Product 0: BJC® Bone & Joint Care (flagship)
        p0, _ = Product.objects.get_or_create(
            sku='BJC-BONE-JOINT',
            defaults={
                'name': 'BJC® Bone & Joint Care',
                'hsn_code': '21069099',
                'description': (
                    'Advanced bone and joint support formula with collagen peptides, '
                    'vitamin D3, calcium, and targeted minerals. Developed for daily '
                    'mobility and long-term skeletal wellness.'
                ),
                'benefits': (
                    'Supports bone density, joint comfort, and connective tissue health. '
                    'Ideal for active adults and anyone seeking structured bone & joint nutrition.'
                ),
                'ingredients': (
                    'Hydrolysed collagen peptides, Calcium carbonate, Vitamin D3, '
                    'Magnesium, Zinc, Boswellia serrata extract. No artificial colours.'
                ),
                'nutrition_facts': {
                    'Serving Size': '10g (1 scoop)',
                    'Collagen Peptides': '5g',
                    'Calcium': '200mg',
                    'Vitamin D3': '10mcg',
                    'Magnesium': '50mg',
                    'Calories': '38 kcal',
                },
                'faq': [
                    {
                        'q': 'How long should I take BJC®?',
                        'a': 'Consistent daily use for at least 8–12 weeks is recommended for best results.',
                    },
                    {
                        'q': 'Can I take it with other supplements?',
                        'a': 'Yes. BJC® is designed to complement a balanced diet and standard protein intake.',
                    },
                ],
            },
        )
        ProductRegionConfig.objects.get_or_create(
            product=p0, region=r_in,
            defaults={'price': 2499.00, 'promotional_price': 2199.00, 'is_visible': True},
        )
        ProductRegionConfig.objects.get_or_create(
            product=p0, region=r_uk,
            defaults={'price': 34.99, 'promotional_price': 29.99, 'is_visible': True},
        )
        StockLevel.objects.get_or_create(
            warehouse=w_in, product=p0,
            defaults={'available': 350, 'low_stock_threshold': 25},
        )
        StockLevel.objects.get_or_create(
            warehouse=w_uk, product=p0,
            defaults={'available': 280, 'low_stock_threshold': 20},
        )
        ProductMedia.objects.get_or_create(
            product=p0,
            file_url='https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600',
            media_type='IMAGE',
            display_order=1,
        )
        ProductReview.objects.get_or_create(
            product=p0,
            user_email='bjc.customer@gmail.com',
            defaults={
                'user_name': 'Sarah Thompson',
                'rating': 5,
                'comment': 'Noticeably better joint comfort after a month. Clean label and easy to mix.',
                'is_verified_purchase': True,
                'is_approved': True,
                'is_featured': True,
            },
        )

        # Product 1: Whey Protein
        p1, _ = Product.objects.get_or_create(
            sku='WHEY-RAW-80',
            defaults={
                'name': 'Sclero Whey Protein Concentrate 80%',
                'hsn_code': '35022000',
                'description': 'Premium, cold-filtered whey protein concentrate sourcing only from grass-fed cows. High bioavailability, rapid absorption.',
                'benefits': 'Accelerates muscle recovery, promotes protein synthesis, fuels strength and lean mass gains.',
                'ingredients': 'Grass-fed Whey Protein Concentrate, Sunflower Lecithin (0.5% for mixability). No artificial sweeteners or fillers.',
                'nutrition_facts': {
                    'Serving Size': '30g',
                    'Protein': '24g',
                    'BCAAs': '5.5g',
                    'Carbohydrates': '1.5g',
                    'Fat': '1.8g',
                    'Calories': '120 kcal'
                },
                'faq': [
                    {'q': 'When should I consume it?', 'a': 'Ideally within 45 minutes post-workout or first thing in the morning.'},
                    {'q': 'Does it contain soy?', 'a': 'No, it is soy-free. We use sunflower lecithin for instant mixability.'}
                ]
            }
        )
        # Regional config for Whey Protein
        ProductRegionConfig.objects.get_or_create(product=p1, region=r_in, defaults={'price': 3499.00, 'promotional_price': 3199.00, 'is_visible': True})
        ProductRegionConfig.objects.get_or_create(product=p1, region=r_uk, defaults={'price': 39.99, 'promotional_price': 36.99, 'is_visible': True})
        
        # Stock levels
        StockLevel.objects.get_or_create(warehouse=w_in, product=p1, defaults={'available': 500, 'low_stock_threshold': 20})
        StockLevel.objects.get_or_create(warehouse=w_uk, product=p1, defaults={'available': 300, 'low_stock_threshold': 15})
        
        # Media
        ProductMedia.objects.get_or_create(product=p1, file_url='https://images.unsplash.com/photo-1579758629938-03607ccdbaba?w=600', media_type='IMAGE', display_order=1)

        # Reviews
        ProductReview.objects.get_or_create(
            product=p1,
            user_email='customer1@gmail.com',
            defaults={
                'user_name': 'Amit Patel',
                'rating': 5,
                'comment': 'Amazing mixability and absolutely zero bloating. Best protein I have used so far.',
                'is_verified_purchase': True,
                'is_approved': True,
                'is_featured': True
            }
        )
        ProductReview.objects.get_or_create(
            product=p1,
            user_email='customer2@gmail.com',
            defaults={
                'user_name': 'John Miller',
                'rating': 4,
                'comment': 'Good clean profile, tastes very neutral. Will buy again!',
                'is_verified_purchase': True,
                'is_approved': True,
                'is_featured': False
            }
        )

        # Product 2: Creatine Monohydrate
        p2, _ = Product.objects.get_or_create(
            sku='CREATINE-200MESH',
            defaults={
                'name': 'Sclero Pure Micronized Creatine',
                'hsn_code': '29252990',
                'description': '100% pure micronized creatine monohydrate. 200 mesh particle size for instant dissolving and optimal absorption.',
                'benefits': 'Increases high-intensity exercise capacity, boosts cellular hydration, maximizes strength output.',
                'ingredients': '100% Pure Micronized Creatine Monohydrate.',
                'nutrition_facts': {
                    'Serving Size': '3g',
                    'Creatine Monohydrate': '3g',
                    'Protein': '0g',
                    'Carbohydrates': '0g',
                    'Fat': '0g',
                    'Calories': '0 kcal'
                },
                'faq': [
                    {'q': 'Do I need a loading phase?', 'a': 'A loading phase is optional. 3g to 5g daily is highly effective for building strength and endurance.'}
                ]
            }
        )
        ProductRegionConfig.objects.get_or_create(product=p2, region=r_in, defaults={'price': 1499.00, 'promotional_price': 1299.00, 'is_visible': True})
        ProductRegionConfig.objects.get_or_create(product=p2, region=r_uk, defaults={'price': 19.99, 'is_visible': True})
        StockLevel.objects.get_or_create(warehouse=w_in, product=p2, defaults={'available': 400, 'low_stock_threshold': 30})
        StockLevel.objects.get_or_create(warehouse=w_uk, product=p2, defaults={'available': 250, 'low_stock_threshold': 20})
        ProductMedia.objects.get_or_create(product=p2, file_url='https://images.unsplash.com/photo-1593095948071-474c5cc2989d?w=600', media_type='IMAGE', display_order=1)

        # Product 3: L-Glutamine (INDIA REGION LOCK TEST)
        p3, _ = Product.objects.get_or_create(
            sku='GLUTAMINE-PURE',
            defaults={
                'name': 'Sclero L-Glutamine Recovery Powder',
                'hsn_code': '29224990',
                'description': 'Pure L-Glutamine powder to support gut health and preserve lean muscle mass during intense training phases.',
                'benefits': 'Speeds recovery, reduces soreness, enhances immune system functions.',
                'ingredients': '100% Pure Pharmaceutical Grade L-Glutamine.',
                'nutrition_facts': {
                    'Serving Size': '5g',
                    'L-Glutamine': '5g',
                    'Protein': '0g',
                    'Carbs': '0g',
                    'Fat': '0g'
                },
                'faq': [
                    {'q': 'Can I mix it with protein?', 'a': 'Yes, it is unflavored and mixes easily with whey protein or juice.'}
                ]
            }
        )
        # AVAILABLE ONLY IN INDIA - DO NOT CREATE CONFIG FOR UK
        ProductRegionConfig.objects.get_or_create(product=p3, region=r_in, defaults={'price': 1899.00, 'is_visible': True})
        StockLevel.objects.get_or_create(warehouse=w_in, product=p3, defaults={'available': 200, 'low_stock_threshold': 10})
        ProductMedia.objects.get_or_create(product=p3, file_url='https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600', media_type='IMAGE', display_order=1)

        self.stdout.write('Products created (BJC, Whey, Creatine, L-Glutamine [IN-only])')

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
