import json
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from apps.orders.models import Order
from apps.regions.models import Region

User = get_user_model()


def make_order(region, *, email, user=None):
    return Order.objects.create(
        region=region, user=user, status='PROCESSING', email=email,
        shipping_name='Buyer', shipping_phone='+447700900077', shipping_address_line1='1 Test Street',
        shipping_city='London', shipping_state='London', shipping_postal_code='SW1A 1AA', shipping_country='GB',
        currency_code='GBP', subtotal=Decimal('20.00'), tax_rate=Decimal('0.00'), tax_amount=Decimal('0.00'),
        shipping_cost=Decimal('0.00'), total=Decimal('20.00'), payment_method='STRIPE', payment_status='PAID',
    )


class GuestOrderMatchingTests(APITestCase):
    def setUp(self):
        self.region = Region.objects.create(
            code='UK', name='United Kingdom', domain='guest-data.example.test',
            currency_code='GBP', currency_symbol='£', tax_name='VAT', tax_rate='20.00',
        )
        self.user = User.objects.create_user(email='buyer@example.com', password='Str0ng-pass-123')
        self.guest_order = make_order(self.region, email='buyer@example.com')
        self.own_order = make_order(self.region, email='buyer@example.com', user=self.user)
        self.client.force_authenticate(self.user)

    def verify_email(self):
        User.objects.filter(pk=self.user.pk).update(email_verified=True)
        self.user.refresh_from_db()
        self.client.force_authenticate(self.user)

    def listed_order_ids(self):
        data = self.client.get('/api/orders/mine/').data
        rows = data['results'] if isinstance(data, dict) else data
        return {row['id'] for row in rows}

    def test_unverified_account_sees_only_its_own_orders(self):
        self.assertEqual(self.listed_order_ids(), {self.own_order.id})

    def test_verified_account_also_sees_guest_orders(self):
        self.verify_email()
        self.assertEqual(self.listed_order_ids(), {self.own_order.id, self.guest_order.id})

    def test_export_follows_the_same_rule(self):
        response = self.client.get('/api/auth/me/export/')
        self.assertEqual(response.status_code, 200)
        exported = {order['order_id'] for order in json.loads(response.content)['orders']}
        self.assertEqual(exported, {self.own_order.id})

    def test_deleting_an_unverified_account_leaves_guest_orders_alone(self):
        self.assertEqual(self.client.delete('/api/auth/me/').status_code, 200)
        self.guest_order.refresh_from_db()
        self.own_order.refresh_from_db()
        self.assertEqual(self.guest_order.email, 'buyer@example.com')
        self.assertTrue(self.own_order.email.startswith('deleted-user-'))
