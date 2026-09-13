from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

import requests
from django.test import override_settings
from rest_framework.test import APITestCase

from apps.admin_dashboard.models import PaymentGateway, SystemSetting
from apps.inventory.models import StockLevel
from apps.products.models import ProductRegionConfig

from .access import read_order_token
from .checkout import START_FAILED_MESSAGE
from .models import CartItem, Coupon, Invoice, Order
from .testing import (
    TEST_MEDIA_ROOT, add_gateway, make_catalog, make_region, provider, razorpay_signature,
)


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT, ALLOW_SIMULATED_PAYMENTS=False, ALLOW_TEST_GATEWAYS=False)
class CheckoutTestCase(APITestCase):
    region_code = 'UK'
    address = {
        'shipping_phone': '+44 7700 900077', 'shipping_address_line1': '1 Test Street',
        'shipping_city': 'London', 'shipping_state': 'London', 'shipping_postal_code': 'SW1A 1AA',
        'shipping_country': 'GB',
    }

    def setUp(self):
        self.region = make_region(self.region_code)
        self.product = make_catalog(self.region, stock=5)
        self.stock = StockLevel.objects.get(product=self.product)
        add_gateway(self.region, 'COD', mode='TEST', secret_key='', publishable_key='')

    def add_to_cart(self, quantity=2):
        response = self.client.post('/api/cart/add/', {
            'region': self.region_code, 'product_id': self.product.pk, 'quantity': quantity,
        }, format='json')
        self.assertEqual(response.status_code, 200, response.data)

    def checkout(self, **overrides):
        data = {
            'region': self.region_code, 'email': 'buyer@example.com', 'shipping_name': 'Buyer',
            'payment_method': 'COD', **self.address,
        }
        data.update(overrides)
        return self.client.post('/api/checkout/', data, format='json')

    def stock_left(self):
        self.stock.refresh_from_db()
        return self.stock.available


class CashOnDeliveryCheckoutTests(CheckoutTestCase):
    @patch('apps.orders.checkout.run_order_followups')
    def test_cod_order_is_placed_straight_away(self, followups):
        self.add_to_cart(2)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.checkout()
        self.assertEqual(response.status_code, 201, response.data)
        order = Order.objects.get(pk=response.data['order_id'])
        self.assertEqual((order.status, order.payment_status), ('PROCESSING', 'PENDING'))
        self.assertIsNone(order.payment_expires_at)
        self.assertEqual(order.total, Decimal('25.00'))
        self.assertIsNone(response.data['payment'])
        self.assertEqual(read_order_token(response.data['order_token']), order.pk)
        self.assertEqual(self.stock_left(), 3)
        self.assertFalse(CartItem.objects.exists())
        self.assertTrue(Invoice.objects.filter(order=order).exists())
        followups.assert_called_once_with(order.pk)

    def test_prices_sent_by_the_browser_are_ignored(self):
        self.add_to_cart(1)
        response = self.checkout(total='0.01', subtotal='0.01', discount_amount='99', shipping_cost='0')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(Order.objects.get().total, Decimal('15.00'))

    def test_an_empty_cart_is_refused(self):
        response = self.checkout()
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['error'], 'Cart is empty or invalid.')

    def test_guest_checkout_can_be_switched_off(self):
        SystemSetting.objects.create(key='CHECKOUT_SETTINGS', value={'allow_guest_checkout': False})
        self.add_to_cart(1)
        self.assertEqual(self.checkout().status_code, 403)

    def test_a_hidden_product_cannot_be_bought(self):
        self.add_to_cart(1)
        ProductRegionConfig.objects.filter(product=self.product).update(is_visible=False)
        self.assertEqual(self.checkout().status_code, 400)
        self.assertFalse(Order.objects.exists())
        self.assertEqual(self.stock_left(), 5)

    def test_running_out_of_stock_leaves_no_trace(self):
        Coupon.objects.create(code='TENOFF', discount_type='PERCENTAGE', value='10.00')
        self.add_to_cart(2)
        StockLevel.objects.filter(pk=self.stock.pk).update(available=1)
        response = self.checkout(coupon_code='TENOFF')
        self.assertEqual(response.status_code, 400)
        self.assertIn('out of stock', response.data['error'])
        self.assertFalse(Order.objects.exists())
        self.assertEqual(Coupon.objects.get().usage_count, 0)

    def test_the_coupon_use_is_reserved_with_the_order(self):
        Coupon.objects.create(code='TENOFF', discount_type='PERCENTAGE', value='10.00', usage_limit=1)
        self.add_to_cart(2)
        response = self.checkout(coupon_code='tenoff')
        self.assertEqual(response.status_code, 201, response.data)
        order = Order.objects.get()
        self.assertEqual((order.coupon_code, order.discount_amount), ('TENOFF', Decimal('2.00')))
        self.assertEqual(Coupon.objects.get().usage_count, 1)

    def test_the_old_payment_intent_endpoint_is_gone(self):
        response = self.client.post('/api/checkout/payment-intent/', {}, format='json')
        self.assertEqual(response.status_code, 404)


class CardCheckoutTests(CheckoutTestCase):
    def setUp(self):
        super().setUp()
        add_gateway(self.region, 'STRIPE')
        self.add_to_cart(2)

    @staticmethod
    def opened(intent_id='pi_100', secret='pi_100_secret', status='requires_payment_method'):
        return (200, {'id': intent_id, 'status': status, 'client_secret': secret})

    def create(self):
        with provider(self.opened()):
            response = self.checkout(payment_method='STRIPE')
        self.assertEqual(response.status_code, 201, response.data)
        return response.data

    def test_the_order_exists_before_payment_and_the_cart_is_kept(self):
        with provider(self.opened()) as http:
            response = self.checkout(payment_method='STRIPE')
        self.assertEqual(response.status_code, 201, response.data)
        order = Order.objects.get(pk=response.data['order_id'])
        self.assertEqual((order.status, order.payment_status), ('AWAITING_PAYMENT', 'PENDING'))
        self.assertEqual(order.payment_reference, 'pi_100')
        self.assertAlmostEqual(
            order.payment_expires_at, order.created_at + timedelta(minutes=30),
            delta=timedelta(seconds=5),
        )
        self.assertEqual(response.data['payment']['client_secret'], 'pi_100_secret')
        self.assertEqual(http.call_args.kwargs['data']['amount'], 2500)
        self.assertEqual(http.call_args.kwargs['data']['metadata[order_id]'], str(order.pk))
        self.assertEqual(CartItem.objects.get().quantity, 2)
        self.assertEqual(self.stock_left(), 3)

    def test_an_unchanged_retry_resumes_the_same_order(self):
        first = self.create()
        with provider(self.opened()) as http:
            second = self.checkout(payment_method='STRIPE')
        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(second.data['order_id'], first['order_id'])
        self.assertEqual(http.call_args.args[0], 'GET')
        self.assertEqual(Order.objects.count(), 1)
        self.assertEqual(self.stock_left(), 3)

    def test_a_retry_keeps_the_coupon_its_own_order_reserved(self):
        Coupon.objects.create(code='ONCE', discount_type='FIXED_AMOUNT', value='1.00', usage_limit=1)
        with provider(self.opened()):
            first = self.checkout(payment_method='STRIPE', coupon_code='ONCE')
        with provider(self.opened()):
            second = self.checkout(payment_method='STRIPE', coupon_code='ONCE')
        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(second.data['order_id'], first.data['order_id'])
        self.assertEqual(Coupon.objects.get().usage_count, 1)

    def test_a_changed_checkout_replaces_the_unpaid_order(self):
        first = self.create()
        self.add_to_cart(1)
        cancelled = (200, {'id': 'pi_100', 'status': 'canceled'})
        with provider(cancelled, self.opened('pi_200', 'pi_200_secret')) as http:
            second = self.checkout(payment_method='STRIPE')
        self.assertEqual(second.status_code, 201, second.data)
        old = Order.objects.get(pk=first['order_id'])
        self.assertEqual((old.status, old.payment_status), ('CANCELLED', 'EXPIRED'))
        self.assertEqual(
            http.call_args_list[0].args,
            ('POST', 'https://api.stripe.com/v1/payment_intents/pi_100/cancel'),
        )
        self.assertEqual(Order.objects.get(pk=second.data['order_id']).payment_reference, 'pi_200')
        self.assertEqual(self.stock_left(), 2)

    def test_changing_the_checkout_while_a_payment_is_processing_is_refused(self):
        first = self.create()
        self.add_to_cart(1)
        refusal = (400, {'error': {'message': 'This PaymentIntent cannot be canceled.'}})
        with provider(refusal, (200, {'id': 'pi_100', 'status': 'processing'})):
            second = self.checkout(payment_method='STRIPE')
        self.assertEqual(second.status_code, 409)
        self.assertEqual(second.data['error'], 'A payment for this cart is already in progress.')
        order = Order.objects.get()
        self.assertEqual((order.pk, order.status), (first['order_id'], 'AWAITING_PAYMENT'))

    def test_a_gateway_failure_releases_the_order(self):
        with provider(requests.ConnectionError('down')):
            response = self.checkout(payment_method='STRIPE')
        self.assertEqual(response.status_code, 502)
        self.assertEqual(response.data['error'], START_FAILED_MESSAGE)
        order = Order.objects.get()
        self.assertEqual((order.status, order.payment_status), ('CANCELLED', 'EXPIRED'))
        self.assertEqual(self.stock_left(), 5)
        self.assertEqual(CartItem.objects.get().quantity, 2)

    def test_a_test_mode_gateway_is_refused_in_production(self):
        PaymentGateway.objects.filter(code='STRIPE').update(mode='TEST')
        self.assertEqual(self.checkout(payment_method='STRIPE').status_code, 400)
        self.assertFalse(Order.objects.exists())

    def test_a_gateway_without_keys_is_refused_in_production(self):
        gateway = PaymentGateway.objects.get(code='STRIPE')
        gateway.secret_key = ''
        gateway.save()
        self.assertEqual(self.checkout(payment_method='STRIPE').status_code, 400)


class PaymentConfirmationTests(CheckoutTestCase):
    def setUp(self):
        super().setUp()
        add_gateway(self.region, 'STRIPE')
        self.add_to_cart(2)
        with provider((200, {'id': 'pi_100', 'status': 'requires_payment_method', 'client_secret': 's'})):
            self.created = self.checkout(payment_method='STRIPE').data

    def intent(self, **overrides):
        body = {
            'id': 'pi_100', 'status': 'succeeded', 'amount_received': 2500, 'currency': 'gbp',
            'metadata': {'order_id': str(self.created['order_id'])},
        }
        body.update(overrides)
        return body

    def confirm(self, **extra):
        payload = {'order_id': self.created['order_id'], 'order_token': self.created['order_token'], **extra}
        return self.client.post('/api/checkout/confirm/', payload, format='json')

    @patch('apps.orders.order_payments.run_order_followups')
    def test_confirmation_records_a_verified_payment(self, followups):
        with provider((200, self.intent())), self.captureOnCommitCallbacks(execute=True):
            response = self.confirm()
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['state'], 'paid')
        order = Order.objects.get(pk=self.created['order_id'])
        self.assertEqual((order.status, order.payment_status, order.payment_id), ('PROCESSING', 'PAID', 'pi_100'))
        followups.assert_called_once_with(order.pk)

    def test_confirmation_needs_the_order_token(self):
        self.assertEqual(self.confirm(order_token='forged').status_code, 404)
        response = self.client.post('/api/checkout/confirm/', {
            'order_id': self.created['order_id'] + 1, 'order_token': self.created['order_token'],
        }, format='json')
        self.assertEqual(response.status_code, 404)

    def test_an_underpaid_intent_is_refused_and_the_cart_kept(self):
        with provider((200, self.intent(amount_received=100))):
            response = self.confirm()
        self.assertEqual(response.status_code, 402)
        self.assertEqual(Order.objects.get().status, 'AWAITING_PAYMENT')
        self.assertEqual(CartItem.objects.get().quantity, 2)

    def test_a_processing_payment_is_accepted_for_later(self):
        with provider((200, self.intent(status='processing', amount_received=0))):
            response = self.confirm()
        self.assertEqual((response.status_code, response.data['state']), (202, 'processing'))

    def test_an_unreachable_provider_is_reported_as_processing(self):
        with provider(requests.Timeout('slow')):
            self.assertEqual(self.confirm().status_code, 202)


class UpiCheckoutTests(CheckoutTestCase):
    region_code = 'IN'
    address = {
        'shipping_phone': '+91 99999 99999', 'shipping_address_line1': '12 MG Road',
        'shipping_city': 'Ahmedabad', 'shipping_state': 'Gujarat', 'shipping_postal_code': '380015',
        'shipping_country': 'IN',
    }

    def setUp(self):
        super().setUp()
        add_gateway(self.region, 'RAZORPAY', secret_key='rzp_secret', publishable_key='rzp_live_key')
        self.add_to_cart(2)
        with provider((200, {'id': 'order_rzp1', 'status': 'created'})) as http:
            response = self.checkout(payment_method='RAZORPAY')
        self.assertEqual(response.status_code, 201, response.data)
        self.created = response.data
        self.open_call = http.call_args

    def signed(self, payment_id='pay_9'):
        return {
            'order_id': self.created['order_id'], 'order_token': self.created['order_token'],
            'razorpay_order_id': 'order_rzp1', 'razorpay_payment_id': payment_id,
            'razorpay_signature': razorpay_signature('rzp_secret', 'order_rzp1', payment_id),
        }

    def test_the_razorpay_order_is_opened_for_this_order(self):
        self.assertEqual(self.created['payment'], {
            'razorpay_order_id': 'order_rzp1', 'key_id': 'rzp_live_key', 'amount': 2500, 'currency': 'INR',
        })
        self.assertEqual(self.open_call.kwargs['data']['receipt'], f"order-{self.created['order_id']}")

    @patch('apps.orders.order_payments.run_order_followups')
    def test_a_signed_payment_completes_the_order(self, _followups):
        payment = {'id': 'pay_9', 'order_id': 'order_rzp1', 'status': 'captured', 'amount': 2500, 'currency': 'INR'}
        with provider((200, payment)), self.captureOnCommitCallbacks(execute=True):
            response = self.client.post('/api/checkout/confirm/', self.signed(), format='json')
        self.assertEqual(response.status_code, 200, response.data)
        order = Order.objects.get(pk=self.created['order_id'])
        self.assertEqual((order.payment_status, order.payment_id), ('PAID', 'pay_9'))

    def test_a_forged_signature_is_refused_without_a_provider_call(self):
        payload = {**self.signed(), 'razorpay_signature': 'forged'}
        with provider() as http:
            response = self.client.post('/api/checkout/confirm/', payload, format='json')
        self.assertEqual(response.status_code, 402)
        http.assert_not_called()
