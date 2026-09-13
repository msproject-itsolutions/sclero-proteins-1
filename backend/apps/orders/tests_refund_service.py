from decimal import Decimal
from unittest.mock import patch

import requests
from django.db import transaction
from django.test import TestCase, override_settings

from apps.audit.models import AuditLog as AuditEntry
from apps.inventory.models import StockLevel

from .models import Coupon, Order, OrderItem, PaymentLog, Refund
from .order_payments import (
    EXPIRED_REFUND_REASON, confirm_payment, mark_order_paid, refund_expired_payment,
)
from .payments import PaymentError
from .refunds import execute_refund, start_refund
from .testing import TEST_MEDIA_ROOT, add_gateway, make_catalog, make_order, make_region, provider


class ExecuteRefundTests(TestCase):
    def setUp(self):
        self.region = make_region()
        add_gateway(self.region, 'STRIPE')
        self.order = make_order(
            self.region, status='PROCESSING', payment_status='PAID', payment_id='pi_1',
            payment_reference='pi_1',
        )

    def start(self, amount):
        with transaction.atomic():
            return start_refund(self.order, Decimal(amount), 'Damaged')

    def test_processed_refunds_update_the_payment_status(self):
        first = self.start('5.00')
        with provider((200, {'id': 're_1', 'status': 'succeeded'})) as http:
            first = execute_refund(first.pk)
        self.assertEqual((first.status, first.refund_transaction_id), ('PROCESSED', 're_1'))
        self.assertEqual(http.call_args.kwargs['headers'], {'Idempotency-Key': f'refund-{first.pk}'})
        self.order.refresh_from_db()
        self.assertEqual((self.order.status, self.order.payment_status), ('PROCESSING', 'PARTIALLY_REFUNDED'))
        rest = self.start('15.00')
        with provider((200, {'id': 're_2', 'status': 'succeeded'})):
            execute_refund(rest.pk)
        self.order.refresh_from_db()
        self.assertEqual((self.order.status, self.order.payment_status), ('REFUNDED', 'REFUNDED'))

    def test_gateway_error_is_recorded_as_failed_not_refunded(self):
        refund = self.start('5.00')
        with provider((400, {'error': {'message': 'Charge already refunded.'}})):
            refund = execute_refund(refund.pk)
        self.assertEqual((refund.status, refund.failure_reason), ('FAILED', 'Charge already refunded.'))
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, 'PAID')
        self.assertTrue(PaymentLog.objects.filter(order=self.order, status='REFUND_FAILED').exists())

    def test_unknown_outcome_stays_pending(self):
        refund = self.start('5.00')
        with provider(requests.Timeout('slow')):
            refund = execute_refund(refund.pk)
        self.assertEqual(refund.status, 'PENDING')
        self.assertTrue(PaymentLog.objects.filter(order=self.order, status='REFUND_UNKNOWN').exists())

    def test_only_pending_refunds_are_sent(self):
        refund = self.start('5.00')
        Refund.objects.filter(pk=refund.pk).update(status='PROCESSED')
        with provider() as http:
            execute_refund(refund.pk)
        http.assert_not_called()

    def test_a_refund_cannot_exceed_the_balance(self):
        self.start('15.00')
        with self.assertRaises(PaymentError):
            self.start('10.00')


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT, ALLOW_SIMULATED_PAYMENTS=True)
class PaidAfterExpiryTests(TestCase):
    def setUp(self):
        self.region = make_region()
        self.product = make_catalog(self.region, stock=5)
        self.gateway = add_gateway(self.region, 'STRIPE', mode='TEST', secret_key='', publishable_key='')
        self.coupon = Coupon.objects.create(code='TENOFF', discount_type='PERCENTAGE', value='10.00')
        self.order = make_order(
            self.region, status='CANCELLED', payment_status='EXPIRED',
            payment_reference='sim_stripe_late', coupon_code='TENOFF', discount_amount=Decimal('2.00'),
        )
        OrderItem.objects.create(order=self.order, product=self.product, quantity=2, price=Decimal('10.00'))

    def pay_late(self):
        verification = {
            'state': 'paid', 'transaction_id': 'sim_stripe_late', 'amount_minor': 2000,
            'currency': 'GBP', 'raw': {},
        }
        with self.captureOnCommitCallbacks(execute=True):
            with transaction.atomic():
                mark_order_paid(self.order, verification, source='webhook')
        self.order.refresh_from_db()

    @patch('apps.orders.order_payments.run_order_followups')
    def test_late_payment_revives_the_order_when_stock_remains(self, followups):
        self.pay_late()
        self.assertEqual((self.order.status, self.order.payment_status), ('PROCESSING', 'PAID'))
        self.assertEqual(StockLevel.objects.get(product=self.product).available, 3)
        self.coupon.refresh_from_db()
        self.assertEqual(self.coupon.usage_count, 1)
        followups.assert_called_once_with(self.order.pk)

    @patch('apps.orders.order_payments.send_order_email', return_value=True)
    @patch('apps.orders.order_payments.send_staff_alert')
    def test_late_payment_without_stock_is_refunded_and_staff_alerted(self, alert, customer_email):
        StockLevel.objects.filter(product=self.product).update(available=1)
        self.pay_late()
        self.assertEqual((self.order.status, self.order.payment_status), ('CANCELLED', 'REFUNDED'))
        refund = Refund.objects.get(order=self.order)
        self.assertEqual((refund.status, refund.amount, refund.reason), ('PROCESSED', Decimal('20.00'), EXPIRED_REFUND_REASON))
        self.assertIn('A full refund has been issued.', alert.call_args.args[2])
        self.assertEqual(customer_email.call_args.args[0], 'refund_processed')
        self.assertTrue(AuditEntry.objects.filter(
            action='order.expired_payment_refund', target_id=str(self.order.pk),
        ).exists())
        self.assertEqual(StockLevel.objects.get(product=self.product).available, 1)

    @patch('apps.orders.order_payments.send_staff_alert')
    def test_failed_automatic_refund_asks_staff_to_refund_by_hand(self, alert):
        StockLevel.objects.filter(product=self.product).update(available=0)
        self.gateway.supports_refunds = False
        self.gateway.save(update_fields=['supports_refunds'])
        self.pay_late()
        self.assertEqual(Refund.objects.get(order=self.order).status, 'FAILED')
        self.assertEqual(self.order.payment_status, 'PAID')
        self.assertIn('Refund this payment manually', alert.call_args.args[2])

    @patch('apps.orders.order_payments.send_staff_alert')
    def test_the_automatic_refund_runs_once(self, _alert):
        StockLevel.objects.filter(product=self.product).update(available=0)
        self.pay_late()
        refund_expired_payment(self.order.pk)
        self.assertEqual(Refund.objects.filter(order=self.order).count(), 1)

    @patch('apps.orders.order_payments.run_order_followups')
    def test_confirming_an_expired_order_takes_the_late_payment_path(self, _followups):
        with self.captureOnCommitCallbacks(execute=True):
            order = confirm_payment(self.order.pk, {'simulated': True})
        self.assertEqual((order.status, order.payment_status), ('PROCESSING', 'PAID'))
        self.assertEqual(Order.objects.get(pk=self.order.pk).payment_id, 'sim_stripe_late')
