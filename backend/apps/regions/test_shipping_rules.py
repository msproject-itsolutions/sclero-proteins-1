from decimal import Decimal

from django.test import TestCase

from apps.orders.models import Cart, CartItem
from apps.orders.pricing import cart_shipping_metrics
from apps.products.models import Product

from .models import Region, ShippingRate, ShippingZone
from .serializers import ShippingRateAdminSerializer
from .shipping import calculate_shipping, calculate_shipping_options
from django.core.management import call_command


class ShippingRulesTests(TestCase):
    def setUp(self):
        self.region = Region.objects.create(
            code='UK', name='United Kingdom', domain='example.test',
            currency_code='GBP', currency_symbol='£', tax_name='VAT', tax_rate=20,
        )
        self.general = ShippingZone.objects.create(
            region=self.region, name='UK mainland', countries=['GB'],
        )
        ShippingRate.objects.create(
            zone=self.general, name='Standard', method='Standard Delivery',
            rate_type='PRICE', price='5.00', min_value='0', max_value='99.99',
            estimated_days='3–5 business days',
        )
        ShippingRate.objects.create(
            zone=self.general, name='Express', method='Express Delivery',
            rate_type='PRICE', price='12.00', min_value='0', max_value='99.99',
            estimated_days='1–2 business days', priority=1,
        )

    def test_returns_all_applicable_customer_methods(self):
        options = calculate_shipping_options(self.region, country='GB', subtotal='50')
        self.assertEqual([item['method'] for item in options], ['Standard Delivery', 'Express Delivery'])
        self.assertEqual([item['cost'] for item in options], [Decimal('5.00'), Decimal('12.00')])

    def test_city_and_postcode_zone_is_more_specific(self):
        london = ShippingZone.objects.create(
            region=self.region, name='Central London', countries=['GB'], cities=['London'],
            postal_ranges=[{'start': 'SW1A1AA', 'end': 'SW1A1AA'}],
        )
        rate = ShippingRate.objects.create(
            zone=london, name='London courier', method='Same-day courier',
            rate_type='FLAT', price='20.00',
        )
        options = calculate_shipping_options(
            self.region, country='GB', city='london', postcode='SW1A 1AA', subtotal='50',
        )
        self.assertEqual([item['rate_id'] for item in options], [rate.id])

    def test_weight_per_unit_handling_surcharge_and_free_threshold(self):
        self.general.rates.all().delete()
        rate = ShippingRate.objects.create(
            zone=self.general, name='Heavy', method='Tracked freight', rate_type='WEIGHT',
            price='3.00', per_unit_price='1.00', handling_fee='0.50',
            min_value='0', max_value='5', surcharge_postcodes='IV*, SW1A1AA',
            surcharge_amount='2.00', free_above='100.00',
        )
        cost = calculate_shipping(
            self.region, country='GB', postcode='IV2 3AA', subtotal='50', weight_g='2500',
        )
        self.assertEqual(cost, Decimal('8.50'))
        self.assertEqual(
            calculate_shipping(self.region, country='GB', postcode='IV2 3AA', subtotal='100', weight_g='2500'),
            Decimal('0.00'),
        )
        self.assertEqual(
            calculate_shipping(self.region, country='GB', subtotal='50', weight_g='2500', rate_id=rate.id),
            Decimal('6.50'),
        )

    def test_unavailable_selected_rate_is_rejected(self):
        with self.assertRaisesMessage(ValueError, 'not available'):
            calculate_shipping(self.region, country='GB', subtotal='150', rate_id=99999)

    def test_empty_admin_zone_does_not_invent_a_shipping_rate(self):
        region = Region.objects.create(code='IN', name='India', domain='in.example.test')
        ShippingZone.objects.create(region=region, name='Draft zone', countries=['IN'])
        with self.assertRaises(ValueError):
            calculate_shipping(region, country='IN', subtotal='1000')

    def test_admin_validation_rejects_inverted_range(self):
        serializer = ShippingRateAdminSerializer(data={
            'zone': self.general.id, 'name': 'Bad band', 'method': 'Standard',
            'rate_type': 'WEIGHT', 'price': '5.00', 'min_value': '10', 'max_value': '2',
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('max_value', serializer.errors)

    def test_cart_weight_uses_admin_product_shipping_weight(self):
        product = Product.objects.create(
            sku='P-1', name='Configured product', description='', benefits='', ingredients='',
            nutrition_facts={'_shipping': {'weight_g': '750'}},
        )
        cart = Cart.objects.create(session_id='shipping-metrics', region=self.region)
        CartItem.objects.create(cart=cart, product=product, quantity=3)
        weight, quantity = cart_shipping_metrics(cart)
        self.assertEqual(weight, Decimal('2250'))
        self.assertEqual(quantity, 3)

    def test_seed_creates_checkout_safe_baseline_shipping_without_overwriting_rates(self):
        self.region.delete()
        Region.objects.create(
            code='UK', name='United Kingdom', domain='uk.example.test',
            currency_code='GBP', currency_symbol='£', tax_name='VAT', tax_rate=20,
        )
        Region.objects.create(
            code='IN', name='India', domain='india.example.test',
            currency_code='INR', currency_symbol='₹', tax_name='GST', tax_rate=18,
        )
        call_command('seed_shipping_defaults', verbosity=0)

        uk = Region.objects.get(code='UK')
        india = Region.objects.get(code='IN')
        self.assertEqual(
            calculate_shipping(uk, country='GB', subtotal='49.99'),
            Decimal('5.00'),
        )
        self.assertEqual(
            calculate_shipping(uk, country='GB', subtotal='50.00'),
            Decimal('0.00'),
        )
        self.assertEqual(
            calculate_shipping(india, country='IN', subtotal='2999'),
            Decimal('150.00'),
        )
        rate = ShippingRate.objects.get(name='Standard UK delivery')
        rate.price = Decimal('9.00')
        rate.save(update_fields=['price'])
        call_command('seed_shipping_defaults', verbosity=0)
        rate.refresh_from_db()
        self.assertEqual(rate.price, Decimal('9.00'))
