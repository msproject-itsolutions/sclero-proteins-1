from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.inventory.models import StockLevel
from apps.products.models import Product
from apps.regions.models import Region, Warehouse


User = get_user_model()


class StockLevelAdminViewSetTests(APITestCase):
    def setUp(self):
        self.region = Region.objects.create(
            code='IN',
            name='India',
            domain='scleroproteins.in',
            currency_code='INR',
            currency_symbol='₹',
            tax_name='GST',
            tax_rate=18.00,
        )
        self.warehouse = Warehouse.objects.create(
            name='Primary',
            region=self.region,
            address='Ahmedabad',
        )
        self.product = Product.objects.create(
            sku='LOW-STOCK-1',
            name='Low Stock Product',
            hsn_code='35022000',
        )
        self.stock = StockLevel.objects.create(
            warehouse=self.warehouse,
            product=self.product,
            available=2,
            low_stock_threshold=5,
        )

        self.user = User.objects.create_user(
            email='inventory-admin@example.com',
            password='StrongPass123!',
            is_staff=True,
            is_superuser=True,
        )
        self.client.force_authenticate(self.user)

    def test_low_stock_alert_uses_threshold_filter(self):
        response = self.client.get(reverse('admin-stock-level-low-stock-alert'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], self.stock.id)
