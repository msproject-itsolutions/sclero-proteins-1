import json
from importlib import import_module

from django.apps import apps as django_apps
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient, APITestCase

from apps.products.models import ProductRegionConfig, ProductVariant

from .cart_identity import CART_COOKIE_NAME
from .models import Cart, CartItem, Coupon
from .pricing import PricingError, price_cart_lines
from .testing import make_catalog, make_region

User = get_user_model()


class CartCookieTests(APITestCase):
    def setUp(self):
        self.region = make_region('UK')
        self.product = make_catalog(self.region)

    def add(self, client=None, **extra):
        client = client or self.client
        payload = {'region': 'UK', 'product_id': self.product.pk, 'quantity': 1, **extra}
        return client.post('/api/cart/add/', payload, format='json')

    def test_first_add_issues_an_http_only_cart_cookie(self):
        response = self.add()
        self.assertEqual(response.status_code, 200, response.data)
        cookie = response.cookies[CART_COOKIE_NAME]
        self.assertTrue(cookie['httponly'])
        self.assertEqual(cookie['path'], '/api/')
        self.assertEqual(cookie['samesite'], 'Lax')
        self.assertEqual(int(cookie['max-age']), 30 * 24 * 60 * 60)
        self.assertGreaterEqual(len(cookie.value), 43)
        self.assertEqual(Cart.objects.get().session_id, cookie.value)
        self.assertNotIn('session_id', response.data)

    def test_browser_supplied_session_id_is_ignored(self):
        self.add(session_id='shared-guessable-id')
        response = self.add(client=APIClient(), session_id='shared-guessable-id')
        self.assertEqual(Cart.objects.count(), 2)
        self.assertEqual([item['quantity'] for item in response.data['items']], [1])

    def test_cart_is_only_reachable_with_its_cookie(self):
        self.add()
        stranger = APIClient()
        self.assertEqual(stranger.get('/api/cart/?region=UK&session_id=anything').data['items'], [])
        stranger.cookies[CART_COOKIE_NAME] = self.client.cookies[CART_COOKIE_NAME].value
        self.assertEqual(len(stranger.get('/api/cart/?region=UK').data['items']), 1)

    def test_reading_an_empty_cart_creates_nothing(self):
        response = self.client.get('/api/cart/?region=UK')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data, {'id': None, 'region_code': 'UK', 'items': [], 'created_at': None},
        )
        self.assertFalse(Cart.objects.exists())
        self.assertNotIn(CART_COOKIE_NAME, response.cookies)

    def test_signed_in_cart_is_keyed_by_account_and_adopts_the_guest_cart(self):
        self.add()
        user = User.objects.create_user(email='shopper@example.com', password='Str0ng-pass-123')
        self.client.force_authenticate(user)
        self.add()
        cart = Cart.objects.get()
        self.assertEqual(cart.user, user)
        self.assertEqual(cart.items.get().quantity, 2)
        other_device = APIClient()
        other_device.force_authenticate(user)
        self.assertEqual(other_device.get('/api/cart/?region=UK').data['items'][0]['quantity'], 2)

    def test_guest_cookie_cannot_read_an_account_cart(self):
        self.add()
        token = self.client.cookies[CART_COOKIE_NAME].value
        user = User.objects.create_user(email='shopper@example.com', password='Str0ng-pass-123')
        self.client.force_authenticate(user)
        self.add()
        anonymous = APIClient()
        anonymous.cookies[CART_COOKIE_NAME] = token
        self.assertEqual(anonymous.get('/api/cart/?region=UK').data['items'], [])

    def test_adding_in_another_region_empties_the_guest_cart(self):
        india = make_region('IN')
        indian_product = make_catalog(india, sku='IN-PRODUCT', price='900.00')
        self.add()
        response = self.client.post(
            '/api/cart/add/', {'region': 'IN', 'product_id': indian_product.pk}, format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        cart = Cart.objects.get()
        self.assertEqual(cart.region, india)
        self.assertEqual(list(cart.items.values_list('product_id', flat=True)), [indian_product.pk])

    def test_rejected_add_leaves_no_empty_line(self):
        response = self.add(quantity=26)
        self.assertEqual(response.status_code, 400)
        self.assertFalse(CartItem.objects.exists())

    def test_coupon_minimum_spend_uses_the_cart_not_the_request(self):
        Coupon.objects.create(code='BIGSPEND', discount_type='PERCENTAGE', value='10.00', min_spend='50.00')
        self.add()
        response = self.client.post(
            '/api/checkout/apply-coupon/', {'code': 'BIGSPEND', 'region': 'UK', 'subtotal': 1000},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('Minimum spend', response.data['error'])

    def test_coupon_discount_is_computed_from_the_cart(self):
        Coupon.objects.create(code='TENOFF', discount_type='PERCENTAGE', value='10.00')
        self.add(quantity=2)
        response = self.client.post(
            '/api/checkout/apply-coupon/', {'code': 'TENOFF', 'region': 'UK', 'subtotal': 1000},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['discount_amount'], 2.0)

    def test_coupon_needs_a_cart(self):
        Coupon.objects.create(code='TENOFF', discount_type='PERCENTAGE', value='10.00')
        response = self.client.post(
            '/api/checkout/apply-coupon/', {'code': 'TENOFF', 'region': 'UK', 'subtotal': 1000},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['error'], 'Your cart is empty.')

    def test_shipping_quote_reads_the_cookie_cart(self):
        self.add(quantity=3)
        body = {'region': 'UK', 'country': 'GB', 'postcode': 'SW1A 1AA', 'subtotal': 30,
                'session_id': 'ignored'}
        response = self.client.post('/api/shipping/calculate/', body, format='json')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['quantity'], 3)
        stranger = APIClient().post('/api/shipping/calculate/', body, format='json')
        self.assertEqual(stranger.data['quantity'], 0)


class CartPricingTests(TestCase):
    def setUp(self):
        self.region = make_region('UK')
        self.product = make_catalog(self.region)
        self.cart = Cart.objects.create(session_id='c' * 43, region=self.region)

    def test_inactive_product_cannot_be_priced(self):
        CartItem.objects.create(cart=self.cart, product=self.product, quantity=1)
        self.product.is_active = False
        self.product.save(update_fields=['is_active'])
        with self.assertRaisesMessage(PricingError, 'no longer available'):
            price_cart_lines(self.region, self.cart)

    def test_a_variant_cannot_make_a_hidden_product_purchasable(self):
        ProductVariant.objects.create(
            product=self.product, sku='VAR-1KG', name='1 kg', option_name='Weight',
            option_value='1 kg', price_gbp='12.00', stock_qty=5,
        )
        CartItem.objects.create(cart=self.cart, product=self.product, variant_sku='VAR-1KG', quantity=1)
        ProductRegionConfig.objects.filter(product=self.product).update(is_visible=False)
        with self.assertRaisesMessage(PricingError, 'not available in your region'):
            price_cart_lines(self.region, self.cart)


class GuestCartResetMigrationTests(TestCase):
    def test_guest_carts_are_removed_and_account_carts_get_fresh_tokens(self):
        migration = import_module('apps.orders.migrations.0019_reset_guest_carts')
        region = make_region()
        user = User.objects.create_user(email='keeper@example.com', password='Str0ng-pass-123')
        Cart.objects.create(session_id='session_guessable1', region=region)
        kept = Cart.objects.create(session_id='session_guessable2', region=region, user=user)
        migration.reset_guest_carts(django_apps, None)
        self.assertEqual(list(Cart.objects.values_list('pk', flat=True)), [kept.pk])
        kept.refresh_from_db()
        self.assertNotEqual(kept.session_id, 'session_guessable2')
        self.assertGreaterEqual(len(kept.session_id), 43)


class AbandonedCartExposureTests(APITestCase):
    def test_staff_list_never_shows_cart_tokens(self):
        staff = User.objects.create_superuser(email='owner@example.com', password='StrongOwnerPass123!')
        self.client.force_authenticate(staff)
        region = make_region()
        product = make_catalog(region)
        cart = Cart.objects.create(session_id='secret-token-' + 'x' * 40, region=region)
        CartItem.objects.create(cart=cart, product=product, quantity=1)
        response = self.client.get('/api/admin/abandoned-checkouts/')
        self.assertEqual(response.status_code, 200)
        self.assertNotIn(cart.session_id, json.dumps(response.data, default=str))
