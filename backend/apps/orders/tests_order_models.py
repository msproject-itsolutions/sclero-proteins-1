from datetime import timedelta
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.test import TestCase
from django.utils import timezone

from .models import Cart, Order, Refund
from .testing import make_order, make_region


class OrderPaymentFieldTests(TestCase):
    def setUp(self):
        self.region = make_region()

    def test_order_first_statuses_and_fields(self):
        expires = timezone.now() + timedelta(minutes=30)
        order = make_order(
            self.region, payment_reference='pi_1', payment_expires_at=expires,
            quote_fingerprint='a' * 64,
        )
        order.refresh_from_db()
        self.assertEqual(order.status, 'AWAITING_PAYMENT')
        self.assertEqual(order.payment_reference, 'pi_1')
        self.assertEqual(order.payment_expires_at, expires)
        self.assertEqual(order.quote_fingerprint, 'a' * 64)
        self.assertIsNone(order.source_cart)
        self.assertIn('AWAITING_PAYMENT', dict(Order.ORDER_STATUS))
        self.assertIn('EXPIRED', dict(Order.PAYMENT_STATUS))
        self.assertIn('PARTIALLY_REFUNDED', dict(Order.PAYMENT_STATUS))

    def test_a_gateway_reference_belongs_to_one_order(self):
        make_order(self.region, payment_reference='pi_same')
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                make_order(self.region, payment_reference='pi_same')

    def test_references_may_repeat_across_gateways_and_be_empty(self):
        make_order(self.region, payment_reference='ref_1', payment_method='STRIPE')
        make_order(self.region, payment_reference='ref_1', payment_method='RAZORPAY')
        make_order(self.region)
        make_order(self.region)
        self.assertEqual(Order.objects.count(), 4)

    def test_deleting_the_cart_keeps_the_order(self):
        cart = Cart.objects.create(session_id='t' * 43, region=self.region)
        order = make_order(self.region, source_cart=cart)
        cart.delete()
        order.refresh_from_db()
        self.assertIsNone(order.source_cart)

    def test_refund_failure_reason_defaults_to_blank(self):
        order = make_order(self.region, status='PROCESSING', payment_status='PAID')
        refund = Refund.objects.create(
            order=order, amount=Decimal('5.00'), currency_code='GBP', gateway='STRIPE',
        )
        self.assertEqual(refund.failure_reason, '')


class PlacedOrderTests(TestCase):
    def test_placed_orders_exclude_unpaid_online_attempts(self):
        region = make_region()
        make_order(region)  # still awaiting payment
        make_order(region, status='CANCELLED', payment_status='EXPIRED')
        make_order(region, status='PENDING', payment_status='FAILED')
        paid = make_order(region, status='PROCESSING', payment_status='PAID')
        cod = make_order(region, status='PROCESSING', payment_status='PENDING', payment_method='COD')
        staff_created = make_order(region, status='PENDING', payment_status='PENDING', payment_method='COD')
        refunded = make_order(region, status='REFUNDED', payment_status='REFUNDED')
        partly = make_order(region, status='SHIPPED', payment_status='PARTIALLY_REFUNDED')
        self.assertEqual(
            set(Order.objects.placed()), {paid, cod, staff_created, refunded, partly},
        )
