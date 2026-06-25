import random
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.utils import timezone
from apps.users.models import UserAddress, CustomerSegment, CustomerActivity, SupportTicket
from apps.admin_dashboard.models import MarketingIntegration, ContentPage, BlogPost
from apps.products.models import Product, ProductLandingPage
from apps.orders.models import Order
from apps.regions.models import Region

User = get_user_model()

class Command(BaseCommand):
    help = 'Seeds mock marketing, customer segments, support tickets, pages, and landing page data.'

    def handle(self, *args, **options):
        self.stdout.write("Seeding marketing integrations, customers, CRM, pages, and landing pages...")
        
        # Ensure we have a region
        region = Region.objects.filter(is_active=True).first()
        if not region:
            region = Region.objects.create(code='GB', name='United Kingdom', currency_code='GBP', symbol='£')
            self.stdout.write(f"Created default region: {region.code}")

        # 1. Seed Marketing Integrations
        integrations_data = [
            {
                'name': 'Google Merchant Center',
                'channel': 'GOOGLE_MERCHANT',
                'is_connected': True,
                'sync_status': 'CONNECTED',
                'credentials': {'merchant_id': '84729104', 'feed_url': 'https://api.scleroproteins.com/feeds/google.xml'},
                'metrics': {'spend': 0.0, 'impressions': 120000, 'clicks': 8500, 'conversions': 420}
            },
            {
                'name': 'Google Ads',
                'channel': 'GOOGLE_ADS',
                'is_connected': True,
                'sync_status': 'CONNECTED',
                'credentials': {'client_customer_id': '382-942-8819'},
                'metrics': {'spend': 1250.00, 'impressions': 45000, 'clicks': 2250, 'conversions': 180}
            },
            {
                'name': 'Google Analytics',
                'channel': 'GOOGLE_ANALYTICS',
                'is_connected': True,
                'sync_status': 'CONNECTED',
                'credentials': {'measurement_id': 'G-PLK84920SF'},
                'metrics': {'spend': 0.0, 'impressions': 85000, 'clicks': 14200, 'conversions': 680}
            },
            {
                'name': 'Facebook Business Manager',
                'channel': 'FACEBOOK_BUSINESS',
                'is_connected': True,
                'sync_status': 'CONNECTED',
                'credentials': {'business_id': '8492048102947'},
                'metrics': {'spend': 0.0, 'impressions': 0, 'clicks': 0, 'conversions': 0}
            },
            {
                'name': 'Facebook & Instagram Ads',
                'channel': 'FACEBOOK_ADS',
                'is_connected': True,
                'sync_status': 'CONNECTED',
                'credentials': {'ad_account_id': 'act_2948104810'},
                'metrics': {'spend': 1850.00, 'impressions': 92000, 'clicks': 4800, 'conversions': 310}
            },
            {
                'name': 'Meta Pixels & Conversion API',
                'channel': 'META_PIXEL',
                'is_connected': True,
                'sync_status': 'CONNECTED',
                'credentials': {'pixel_id': '9472910481029', 'access_token': 'EAAG...'},
                'metrics': {'spend': 0.0, 'impressions': 92000, 'clicks': 4800, 'conversions': 310}
            },
            {
                'name': 'YouTube Channels & Ads',
                'channel': 'YOUTUBE_ADS',
                'is_connected': True,
                'sync_status': 'CONNECTED',
                'credentials': {'channel_id': 'UC-sclero-proteins-official'},
                'metrics': {'spend': 750.00, 'impressions': 38000, 'clicks': 1150, 'conversions': 82}
            },
            {
                'name': 'Omnisend Marketing',
                'channel': 'THIRD_PARTY',
                'is_connected': True,
                'sync_status': 'CONNECTED',
                'credentials': {'api_key': 'omnisend_secret_api_key'},
                'metrics': {'spend': 150.00, 'impressions': 12000, 'clicks': 3200, 'conversions': 140}
            }
        ]

        for integ in integrations_data:
            MarketingIntegration.objects.update_or_create(
                channel=integ['channel'],
                defaults={
                    'name': integ['name'],
                    'is_connected': integ['is_connected'],
                    'sync_status': integ['sync_status'],
                    'credentials': integ['credentials'],
                    'metrics': integ['metrics'],
                    'last_sync': timezone.now()
                }
            )
        self.stdout.write("Seeded marketing integrations.")

        # 2. Seed Customer Accounts & Orders
        customer_names = [
            ('alice@example.com', 'Alice', 'Smith', '07700900077'),
            ('bob@example.com', 'Bob', 'Jones', '07700900088'),
            ('charlie@example.com', 'Charlie', 'Brown', '07700900099'),
            ('david@example.com', 'David', 'Miller', '07700900100'),
            ('emma@example.com', 'Emma', 'Wilson', '07700900111'),
            ('fiona@example.com', 'Fiona', 'Clark', '07700900122'),
            ('george@example.com', 'George', 'Wright', '07700900133'),
            ('hannah@example.com', 'Hannah', 'Taylor', '07700900144')
        ]

        created_users = []
        for email, fn, ln, phone in customer_names:
            u, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'first_name': fn,
                    'last_name': ln,
                    'phone_number': phone,
                    'home_region': region,
                    'email_order_updates': True,
                    'email_marketing': True,
                    'email_newsletter': True,
                }
            )
            created_users.append(u)

            # Create default address
            UserAddress.objects.update_or_create(
                user=u,
                address_type='SHIPPING',
                defaults={
                    'full_name': f"{fn} {ln}",
                    'phone_number': phone,
                    'address_line1': f"{random.randint(1, 150)} Protein Way",
                    'city': 'London',
                    'state': 'Greater London',
                    'postal_code': 'W1A 1AA',
                    'country': 'GB',
                    'is_default': True
                }
            )

        self.stdout.write("Seeded customer accounts and addresses.")

        # Let's seed some orders if none exist
        if Order.objects.count() == 0:
            for idx, user in enumerate(created_users):
                # Create a couple of orders
                for ord_idx in range(random.randint(1, 3)):
                    total = random.uniform(25.00, 150.00)
                    Order.objects.create(
                        email=user.email,
                        shipping_name=f"{user.first_name} {user.last_name}",
                        shipping_phone=user.phone_number,
                        shipping_address_line1=f"{ord_idx + 1} Sclero Road",
                        shipping_city="London",
                        shipping_state="London",
                        shipping_postal_code="NW1 1AA",
                        shipping_country="GB",
                        currency_code="GBP",
                        subtotal=total * 0.8,
                        tax_rate=20.0,
                        tax_amount=total * 0.15,
                        shipping_cost=5.0,
                        total=total + 5.0,
                        status=random.choice(['DELIVERED', 'SHIPPED', 'PROCESSING']),
                        payment_status='PAID',
                        payment_method='STRIPE',
                        created_at=timezone.now() - timezone.timedelta(days=random.randint(1, 60))
                    )
            self.stdout.write("Seeded mock orders for reports.")

        # 3. Seed Customer Segments
        vip_segment, _ = CustomerSegment.objects.update_or_create(
            name="VIP Customers",
            defaults={
                'description': 'Customers with lifetime purchases above threshold',
                'criteria': {'min_spend': 200}
            }
        )
        vip_segment.customers.set([u for u in created_users if u.email in ('charlie@example.com', 'fiona@example.com', 'hannah@example.com')])

        new_segment, _ = CustomerSegment.objects.update_or_create(
            name="Newsletter Subscribers",
            defaults={
                'description': 'Subscribed to general marketing campaigns',
                'criteria': {'newsletter': True}
            }
        )
        new_segment.customers.set(created_users)
        self.stdout.write("Seeded customer segments.")

        # 4. Seed Customer Activity Logs
        activity_types = ['PAGE_VIEW', 'CART_ADD', 'CHECKOUT', 'PURCHASE']
        for u in created_users:
            for _ in range(random.randint(3, 10)):
                act_type = random.choice(activity_types)
                CustomerActivity.objects.create(
                    email=u.email,
                    user=u,
                    activity_type=act_type,
                    description=f"User {act_type.lower().replace('_', ' ')} on storefront",
                    metadata={'path': f"/products/{random.randint(1, 5)}/", 'ip_address': '127.0.0.1'},
                    created_at=timezone.now() - timezone.timedelta(days=random.randint(0, 14))
                )
        self.stdout.write("Seeded customer activity logs.")

        # 5. Seed Support Tickets
        subjects = [
            "Delivery delay on shipment",
            "Question regarding amino acid content in OvoMatrix",
            "Refund request for damaged canister",
            "Wholesale distributor discount inquiries",
            "Payment method issue at checkout"
        ]
        for idx, u in enumerate(created_users[:5]):
            SupportTicket.objects.create(
                email=u.email,
                user=u,
                subject=subjects[idx],
                message="Hi team, I would like to inquire about my order. Please get back to me as soon as possible. Thanks!",
                status=random.choice(['OPEN', 'PENDING', 'RESOLVED']),
                priority=random.choice(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
                admin_notes='Followed up via email. Waiting for courier update.' if idx == 0 else ''
            )
        self.stdout.write("Seeded support tickets.")

        # 6. Seed Content Pages & Blogs
        ContentPage.objects.update_or_create(
            slug='about-us',
            defaults={
                'title': 'About Sclero Proteins',
                'content': '<h1>Our Mission</h1><p>Sclero Proteins Ltd provides the highest grade bioactive matrix ingredients...</p>',
                'page_type': 'STANDARD',
                'is_published': True,
                'meta_title': 'About Sclero Proteins - Leader in Bioactive Matrix',
                'meta_description': 'Discover our clean sourcing, science-backed formulas, and GMP-certified manufacturing processes.'
            }
        )

        ContentPage.objects.update_or_create(
            slug='summer-sale-promo',
            defaults={
                'title': 'Summer Matrix Promo',
                'content': '<h1>Summer Protein Boost</h1><p>Get up to 25% off all collagen and Matrix canisters...</p>',
                'page_type': 'PROMO',
                'is_published': True,
                'meta_title': 'Summer Protein Specials - Sclero Proteins',
                'meta_description': 'Limited time 25% discount on all bioactive protein products. Shop now!'
            }
        )

        BlogPost.objects.update_or_create(
            slug='bioactive-collagen-benefits',
            defaults={
                'title': 'The Science of Bioactive Eggshell Membrane (OvoMatrix)',
                'content': 'Eggshell membrane is rich in glycosaminoglycans, Type I collagen, and hyaluronic acid. Clinical studies show rapid improvements in joint flexibility...',
                'author': 'Dr. Marcus Vance',
                'is_published': True,
                'published_at': timezone.now() - timezone.timedelta(days=5),
                'meta_title': 'OvoMatrix ESC Joint Benefits Explained - Scientific Insights',
                'meta_description': 'Read the clinical trials behind eggshell membrane collagen and joint health.'
            }
        )
        self.stdout.write("Seeded content pages and blog posts.")

        # 7. Seed Automated Landing Pages
        db_products = Product.objects.all()
        if db_products.exists():
            for prod in db_products:
                ProductLandingPage.objects.update_or_create(
                    product=prod,
                    defaults={
                        'slug': f"landing-{prod.sku.lower()}",
                        'template_style': random.choice(['minimal', 'bold', 'sporty']),
                        'custom_branding': {
                            'primary_color': '#4F46E5',
                            'logo_url': '/images/logo-dark.png',
                            'custom_css': 'body { font-family: Outfit, sans-serif; }'
                        },
                        'is_published': True,
                        'seo_meta': {
                            'title': f"Buy {prod.name} | Special Offer",
                            'description': f"Purchase {prod.name} directly. Autopopulated from our verified catalog. Quality guaranteed.",
                            'keywords': 'collagen, protein, health, matrix, joints'
                        },
                        'dynamic_feed_sync': True,
                        'visits_count': random.randint(100, 1500),
                        'conversions_count': random.randint(5, 80)
                    }
                )
            self.stdout.write("Seeded automated product landing pages.")
        else:
            self.stdout.write("No products found in DB. Skipping product landing page seeding.")

        self.stdout.write(self.style.SUCCESS("Database seeded successfully!"))
