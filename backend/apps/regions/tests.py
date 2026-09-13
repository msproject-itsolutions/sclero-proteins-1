import os
from django.urls import reverse
from django.contrib.auth import get_user_model
from django.conf import settings
from rest_framework import status
from rest_framework.test import APITestCase
from apps.regions.models import Region, ShippingRate, ShippingZone, Warehouse
from apps.products.models import Product, ProductRegionConfig
from apps.inventory.models import StockLevel
from apps.orders.models import Invoice

User = get_user_model()

class ScleroProteinsTests(APITestCase):

    def setUp(self):
        # 1. Setup Regions
        self.region_in = Region.objects.create(
            code='IN', name='India', domain='scleroproteins.in',
            currency_code='INR', currency_symbol='₹', tax_name='GST', tax_rate=18.00
        )
        self.region_uk = Region.objects.create(
            code='UK', name='United Kingdom', domain='scleroproteins.co.uk',
            currency_code='GBP', currency_symbol='£', tax_name='VAT', tax_rate=20.00
        )

        # 2. Setup Warehouses
        self.wh_in = Warehouse.objects.create(name='IN Warehouse', region=self.region_in)
        self.wh_uk = Warehouse.objects.create(name='UK Warehouse', region=self.region_uk)

        # 3. Setup Products
        # Whey is available in both IN and UK
        self.prod_whey = Product.objects.create(sku='WHEY-TEST', name='Test Whey', hsn_code='35022000')
        ProductRegionConfig.objects.create(product=self.prod_whey, region=self.region_in, price=3000.00)
        ProductRegionConfig.objects.create(product=self.prod_whey, region=self.region_uk, price=40.00)
        StockLevel.objects.create(warehouse=self.wh_in, product=self.prod_whey, available=50)
        StockLevel.objects.create(warehouse=self.wh_uk, product=self.prod_whey, available=30)

        # Glutamine is available ONLY in India
        self.prod_glut = Product.objects.create(sku='GLUT-TEST', name='Test Glutamine', hsn_code='29224990')
        ProductRegionConfig.objects.create(product=self.prod_glut, region=self.region_in, price=1500.00)
        StockLevel.objects.create(warehouse=self.wh_in, product=self.prod_glut, available=20)

        # 4. Setup Payment Gateways
        from apps.admin_dashboard.models import PaymentGateway
        PaymentGateway.objects.create(
            code='RAZORPAY', display_name='Razorpay', region=self.region_in, is_enabled=True, secret_key='test_secret'
        )
        PaymentGateway.objects.create(
            code='COD', display_name='Cash on delivery', region=self.region_in, is_enabled=True,
        )

        # Checkout intentionally has no hardcoded shipping fallback; tests must
        # provide the same explicit zone/rate configuration required in admin.
        zone_in = ShippingZone.objects.create(
            region=self.region_in, name='India test zone', countries=['IN'], is_active=True,
        )
        ShippingRate.objects.create(
            zone=zone_in, name='Standard test delivery', rate_type='FLAT', price='100.00', is_active=True,
        )


    def test_region_detection_override(self):
        """Verify region detection works with parameter override."""
        url = reverse('detect_region')
        response = self.client.get(f"{url}?country=IN")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['region']['code'], 'IN')

        response = self.client.get(f"{url}?country=UK")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['region']['code'], 'UK')

        response = self.client.get(f"{url}?country=US")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['region']['code'], 'UK') # US redirects to UK

    def test_product_catalog_filtering(self):
        """Verify product visibility is constrained by region configs."""
        url = reverse('product-list')
        
        # Query India catalog
        response = self.client.get(f"{url}?region=IN")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2) # Both Whey and Glutamine visible

        # Query UK catalog
        response = self.client.get(f"{url}?region=UK")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1) # Only Whey visible
        self.assertEqual(response.data[0]['sku'], 'WHEY-TEST')

    def test_regional_cart_clearing(self):
        """Verify switching cart region clears items."""
        # 1. Retrieve cart for India
        url_retrieve = reverse('cart_retrieve')
        url_add = reverse('cart_add')
        
        # Add to India cart
        self.client.post(url_add, {
            'session_id': 'test-session-123',
            'region': 'IN',
            'product_id': self.prod_whey.id,
            'quantity': 2
        })

        # Fetch India cart and check item count
        res_in = self.client.get(f"{url_retrieve}?session_id=test-session-123&region=IN")
        self.assertEqual(len(res_in.data['items']), 1)

        # Switch region to UK (retrieve for UK)
        res_uk = self.client.get(f"{url_retrieve}?session_id=test-session-123&region=UK")
        # Cart should clear out items
        self.assertEqual(len(res_uk.data['items']), 0)
        self.assertEqual(res_uk.data['region_code'], 'UK')

    def test_checkout_and_invoice_pdf_generation(self):
        """Verify full checkout flow deducts stock and generates PDF invoice."""
        # Add item to cart
        url_add = reverse('cart_add')
        self.client.post(url_add, {
            'session_id': 'checkout-session-456',
            'region': 'IN',
            'product_id': self.prod_whey.id,
            'quantity': 2
        })

        # Process checkout
        url_checkout = reverse('checkout')
        checkout_data = {
            'session_id': 'checkout-session-456',
            'region': 'IN',
            'email': 'buyer@gmail.com',
            'shipping_name': 'Buyer Name',
            'shipping_phone': '+919999999999',
            'shipping_address_line1': '123 Test St',
            'shipping_city': 'Ahmedabad',
            'shipping_state': 'Gujarat',
            'shipping_postal_code': '380015',
            'shipping_country': 'IN',
            'payment_method': 'COD',
        }

        response = self.client.post(url_checkout, checkout_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Verify inventory was deducted (50 - 2 = 48)
        stock = StockLevel.objects.get(product=self.prod_whey, warehouse=self.wh_in)
        self.assertEqual(stock.available, 48)

        # Verify PDF invoice was generated on disk
        invoice = Invoice.objects.get(order_id=response.data['order_id'])
        pdf_path = os.path.join(settings.MEDIA_ROOT, invoice.pdf_file.name)
        self.assertTrue(os.path.exists(pdf_path))
        self.assertTrue(pdf_path.endswith('.pdf'))

    def test_checkout_consumes_stock_across_multiple_active_warehouses(self):
        """Regional availability should aggregate and deduct across warehouses."""
        overflow_wh = Warehouse.objects.create(
            name='IN Overflow Warehouse',
            region=self.region_in,
            address='Overflow',
        )
        StockLevel.objects.filter(
            warehouse=self.wh_in,
            product=self.prod_glut,
        ).update(available=1)
        StockLevel.objects.create(
            warehouse=overflow_wh,
            product=self.prod_glut,
            available=2,
        )

        url_add = reverse('cart_add')
        add_response = self.client.post(url_add, {
            'session_id': 'multi-warehouse-session',
            'region': 'IN',
            'product_id': self.prod_glut.id,
            'quantity': 3,
        })
        self.assertEqual(add_response.status_code, status.HTTP_200_OK)

        url_checkout = reverse('checkout')
        response = self.client.post(url_checkout, {
            'session_id': 'multi-warehouse-session',
            'region': 'IN',
            'email': 'multi@example.com',
            'shipping_name': 'Multi Warehouse Buyer',
            'shipping_phone': '+919999999998',
            'shipping_address_line1': '456 Test St',
            'shipping_city': 'Ahmedabad',
            'shipping_state': 'Gujarat',
            'shipping_postal_code': '380015',
            'shipping_country': 'IN',
            'payment_method': 'COD',
        }, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(
            StockLevel.objects.get(warehouse=self.wh_in, product=self.prod_glut).available,
            0,
        )
        self.assertEqual(
            StockLevel.objects.get(warehouse=overflow_wh, product=self.prod_glut).available,
            0,
        )


class GeoRoutingTests(APITestCase):
    """Country-based routing policy: India -> IN site, everyone else -> UK."""

    def setUp(self):
        self.region_in = Region.objects.create(
            code='IN', name='India', domain='scleroproteins.in',
            currency_code='INR', currency_symbol='₹', tax_name='GST', tax_rate=18.00,
            countries=['IN'],
        )
        self.region_uk = Region.objects.create(
            code='UK', name='United Kingdom', domain='scleroproteins.co.uk',
            currency_code='GBP', currency_symbol='£', tax_name='VAT', tax_rate=20.00,
            countries=['GB', 'IE'], is_default=True,
        )

    def geo(self, **headers):
        return self.client.get(reverse('geo_detect'), **headers)

    def test_indian_visitor_maps_to_india_region(self):
        response = self.geo(HTTP_CF_IPCOUNTRY='IN')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['region_code'], 'IN')
        self.assertEqual(response.data['source'], 'cloudflare')

    def test_non_indian_visitor_maps_to_uk_region(self):
        for country in ('US', 'GB', 'DE', 'AU', 'AE'):
            response = self.geo(HTTP_CF_IPCOUNTRY=country)
            self.assertEqual(
                response.data['region_code'], 'UK',
                f'{country} should route to the UK site',
            )
            self.assertEqual(response.data['source'], 'cloudflare')

    def test_unknown_country_reports_fallback_source(self):
        # 'XX' is Cloudflare's "unknown"; with no signal at all the source must
        # be 'fallback' so the frontend never auto-redirects on a guess.
        response = self.geo(HTTP_CF_IPCOUNTRY='XX')
        self.assertEqual(response.data['source'], 'fallback')
        response = self.geo()
        self.assertEqual(response.data['source'], 'fallback')

    def test_vercel_header_used_when_cloudflare_absent(self):
        response = self.geo(HTTP_X_VERCEL_IP_COUNTRY='IN')
        self.assertEqual(response.data['region_code'], 'IN')
        self.assertEqual(response.data['source'], 'vercel')
