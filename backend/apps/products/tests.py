from decimal import Decimal

from django.db import connection
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APITestCase

from apps.inventory.models import StockLevel
from apps.regions.models import Region, Warehouse

from .models import Category, Product, ProductMedia, ProductReview, ProductVariant


class PublicCataloguePerformanceTests(APITestCase):
    def setUp(self):
        self.region = Region.objects.create(
            code='EU', name='Europe', domain='eu.example.test', countries=['DE'],
            currency_code='EUR', currency_symbol='€', tax_name='VAT',
            tax_rate='20.00', auto_price_enabled=True, fx_rate='2.00',
        )
        self.warehouse = Warehouse.objects.create(
            region=self.region, name='EU warehouse', is_active=True,
        )
        self.category, _created = Category.objects.get_or_create(
            slug='protein', defaults={'name': 'Protein'},
        )
        for index in range(6):
            product = Product.objects.create(
                sku=f'AUTO-{index}', name=f'Automatic product {index}',
                description='', benefits='', ingredients='', base_price='10.00',
            )
            product.categories.add(self.category)
            ProductVariant.objects.create(
                product=product, sku=f'AUTO-{index}-SMALL', name='Small 500 g',
                option_value='500 g', price_gbp='3.00', stock_qty=20,
            )
            ProductMedia.objects.create(
                product=product, file_url=f'/media/product-{index}.jpg',
                media_type='IMAGE',
            )
            ProductReview.objects.create(
                product=product, user_name='Buyer', user_email=f'buyer{index}@example.com',
                rating=4, comment='Good product', is_approved=True,
            )
            StockLevel.objects.create(
                warehouse=self.warehouse, product=product, available=10,
            )

    def test_automatic_market_is_consistent_across_list_detail_and_categories(self):
        listing = self.client.get('/api/products/?region=EU')
        self.assertEqual(listing.status_code, 200, listing.data)
        self.assertEqual(len(listing.data), 6)
        self.assertEqual(Decimal(listing.data[0]['price']), Decimal('20.00'))
        self.assertEqual(Decimal(listing.data[0]['variants'][0]['price']), Decimal('6.00'))

        detail = self.client.get('/api/products/AUTO-0/?region=EU')
        self.assertEqual(detail.status_code, 200, detail.data)
        self.assertEqual(Decimal(detail.data['price']), Decimal('20.00'))

        categories = self.client.get('/api/products/categories/?region=EU')
        self.assertEqual(categories.status_code, 200, categories.data)
        protein = next(row for row in categories.data if row['slug'] == 'protein')
        self.assertEqual(protein['product_count'], 6)

    def test_catalogue_query_count_does_not_grow_per_card_relation(self):
        with CaptureQueriesContext(connection) as captured:
            response = self.client.get('/api/products/?region=EU')
            self.assertEqual(response.status_code, 200, response.data)
        self.assertLessEqual(len(captured), 12, [query['sql'] for query in captured])
