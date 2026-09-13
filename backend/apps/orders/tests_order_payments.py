from decimal import Decimal
from unittest.mock import patch

from django.db import transaction
from django.test import TestCase, override_settings

from apps.inventory.models import StockLevel
from apps.products.models import ProductVariant

from .invoices import ensure_invoice
from .models import AuditLog, Cart, CartItem, Coupon, Invoice, Order, OrderItem, PaymentLog
from .order_payments import (
    confirm_payment, mark_order_paid, release_unpaid_order, run_order_followups, sync_order_payment,
)
from .payments import PaymentError
from .stock import StockError, deduct_region_stock
from .testing import TEST_MEDIA_ROOT, add_gateway, make_catalog, make_order, make_region, provider


def paid_verification(**overrides):
    data = {
        'state': 'paid', 'transaction_id': 'pi_1', 'amount_minor': 2000, 'currency': 'GBP',
        'raw': {'test': True},
    }
    data.update(overrides)
    return data


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class MarkOrderPaidTests(TestCase):
    def setUp(self):
        self.region = make_region()
        self.product = make_catalog(self.region)
        self.order = make_order(self.region, product=self.product, payment_reference='pi_1')

    def pay(self, verification=None, source='test'):
        with transaction.atomic():
            return mark_order_paid(self.order, verification or paid_verification(), source=source)

    @patch('apps.orders.order_payments.run_order_followups')
    def test_verified_payment_moves_the_order_to_processing_once(self, followups):
        with self.captureOnCommitCallbacks(execute=True):
            self.pay()
        with self.captureOnCommitCallbacks(execute=True):
            self.pay(source='webhook')
        self.order.refresh_from_db()
        self.assertEqual((self.order.status, self.order.payment_status), ('PROCESSING', 'PAID'))
        self.assertEqual(self.order.payment_id, 'pi_1')
        self.assertEqual(self.order.payment_captured_amount, Decimal('20.00'))
        self.assertIsNone(self.order.payment_expires_at)
        self.assertEqual(PaymentLog.objects.filter(order=self.order, status='PAID').count(), 1)
        self.assertTrue(Invoice.objects.filter(order=self.order).exists())
        followups.assert_called_once_with(self.order.pk)
        self.assertTrue(AuditLog.objects.filter(
            model_name='Order', object_id=str(self.order.pk), action='Payment confirmed',
        ).exists())

    def test_wrong_amount_currency_or_state_is_refused(self):
        refused = (paid_verification(amount_minor=1999), paid_verification(currency='EUR'), {'state': 'processing'})
        for verification in refused:
            with self.subTest(verification=verification), self.assertRaises(PaymentError):
                self.pay(verification)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'AWAITING_PAYMENT')
        self.assertFalse(PaymentLog.objects.exists())

    def test_a_payment_cannot_complete_two_orders(self):
        make_order(
            self.region, status='PROCESSING', payment_status='PAID', payment_id='pi_1',
            payment_reference='pi_other',
        )
        with self.assertRaisesMessage(PaymentError, 'already been applied'):
            self.pay()

    def test_only_awaiting_orders_can_be_paid(self):
        Order.objects.filter(pk=self.order.pk).update(status='CANCELLED')
        with self.assertRaises(PaymentError):
            self.pay()

    @patch('apps.orders.invoices.generate_invoice_pdf', side_effect=OSError('disk full'))
    def test_invoice_failure_never_blocks_the_payment(self, _pdf):
        self.pay()
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, 'PAID')
        self.assertFalse(Invoice.objects.get(order=self.order).pdf_file)


@patch('apps.orders.fraud.assess_order')
@patch('apps.orders.order_payments.send_owner_order_notification')
class OrderFollowupTests(TestCase):
    def setUp(self):
        self.region = make_region()
        self.product = make_catalog(self.region)
        self.cart = Cart.objects.create(session_id='f' * 43, region=self.region)
        CartItem.objects.create(cart=self.cart, product=self.product, quantity=1)
        self.order = make_order(
            self.region, product=self.product, source_cart=self.cart, status='PROCESSING',
            payment_status='PAID',
        )

    @patch('apps.orders.order_payments.send_order_email', return_value=True)
    def test_followups_empty_the_matching_cart_and_notify(self, send_email, notify, assess):
        run_order_followups(self.order.pk)
        self.assertFalse(self.cart.items.exists())
        self.assertEqual(send_email.call_args.args[0], 'order_confirmation')
        notify.assert_called_once()
        assess.assert_called_once()

    @patch('apps.orders.order_payments.send_order_email', return_value=True)
    def test_a_cart_changed_in_another_tab_is_kept(self, _email, _notify, _assess):
        CartItem.objects.filter(cart=self.cart).update(quantity=2)
        run_order_followups(self.order.pk)
        self.assertEqual(self.cart.items.get().quantity, 2)

    @patch('apps.orders.order_payments.send_order_email', side_effect=RuntimeError('smtp down'))
    def test_one_failing_step_does_not_stop_the_others(self, _email, notify, _assess):
        run_order_followups(self.order.pk)
        notify.assert_called_once()


class ReleaseUnpaidOrderTests(TestCase):
    def setUp(self):
        self.region = make_region()
        # 25 units before this order reserved 2.
        self.product = make_catalog(self.region, stock=23)
        self.variant = ProductVariant.objects.create(
            product=self.product, sku='VAR-1KG', name='1 kg', option_name='Weight',
            option_value='1 kg', price_gbp='10.00', stock_qty=3,
        )
        self.coupon = Coupon.objects.create(
            code='TENOFF', discount_type='PERCENTAGE', value='10.00', usage_count=1,
        )
        self.order = make_order(self.region, coupon_code='TENOFF', discount_amount=Decimal('2.00'))
        OrderItem.objects.create(
            order=self.order, product=self.product, variant_sku='VAR-1KG', quantity=2,
            price=Decimal('10.00'),
        )

    def test_release_returns_stock_and_coupon_use(self):
        release_unpaid_order(self.order.pk, reason='test')
        self.order.refresh_from_db()
        self.assertEqual((self.order.status, self.order.payment_status), ('CANCELLED', 'EXPIRED'))
        self.assertIsNone(self.order.payment_expires_at)
        self.assertEqual(StockLevel.objects.get(product=self.product).available, 25)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock_qty, 5)
        self.coupon.refresh_from_db()
        self.assertEqual(self.coupon.usage_count, 0)
        self.assertTrue(AuditLog.objects.filter(
            object_id=str(self.order.pk), action='Unpaid order released',
        ).exists())

    def test_paid_orders_are_never_released(self):
        Order.objects.filter(pk=self.order.pk).update(status='PROCESSING', payment_status='PAID')
        release_unpaid_order(self.order.pk, reason='test')
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'PROCESSING')
        self.assertEqual(StockLevel.objects.get(product=self.product).available, 23)


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class ConfirmPaymentTests(TestCase):
    def setUp(self):
        self.region = make_region()
        self.product = make_catalog(self.region)

    @patch('apps.orders.order_payments.run_order_followups')
    def test_simulated_payment_confirms_in_development(self, _followups):
        add_gateway(self.region, 'STRIPE', mode='TEST', secret_key='', publishable_key='')
        order = make_order(self.region, product=self.product, payment_reference='sim_stripe_test')
        with self.settings(ALLOW_SIMULATED_PAYMENTS=True):
            order = confirm_payment(order.pk, {'simulated': True})
        self.assertEqual((order.payment_status, order.payment_id), ('PAID', 'sim_stripe_test'))

    def stripe_order(self):
        add_gateway(self.region, 'STRIPE')
        return make_order(self.region, product=self.product, payment_reference='pi_9')

    @staticmethod
    def intent(order, **overrides):
        body = {
            'id': 'pi_9', 'status': 'succeeded', 'amount_received': 2000, 'currency': 'gbp',
            'metadata': {'order_id': str(order.pk)},
        }
        body.update(overrides)
        return body

    def test_failed_verification_leaves_the_order_awaiting_payment(self):
        order = self.stripe_order()
        with provider((200, self.intent(order, status='requires_payment_method'))):
            with self.assertRaises(PaymentError):
                confirm_payment(order.pk, {})
        order.refresh_from_db()
        self.assertEqual(order.status, 'AWAITING_PAYMENT')

    def test_processing_payment_is_left_for_the_webhook(self):
        order = self.stripe_order()
        with provider((200, self.intent(order, status='processing', amount_received=0))):
            result = confirm_payment(order.pk, {})
        self.assertEqual(result.status, 'AWAITING_PAYMENT')

    @patch('apps.orders.order_payments.run_order_followups')
    def test_sync_records_a_payment_the_provider_reports(self, _followups):
        order = self.stripe_order()
        with provider((200, self.intent(order))):
            self.assertEqual(sync_order_payment(order.pk, source='reconciliation'), 'paid')
        order.refresh_from_db()
        self.assertEqual(order.payment_status, 'PAID')
        with provider():
            self.assertEqual(sync_order_payment(order.pk, source='reconciliation'), 'settled')


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class StockAndInvoiceTests(TestCase):
    def setUp(self):
        self.region = make_region()
        self.product = make_catalog(self.region, stock=1)

    def test_taking_more_than_is_available_raises_stock_error(self):
        with self.assertRaises(StockError):
            deduct_region_stock(self.product, self.region, 2)

    def test_invoice_files_get_an_unguessable_name_that_is_kept(self):
        order = make_order(self.region, product=self.product, status='PROCESSING', payment_status='PAID')
        invoice = ensure_invoice(order)
        self.assertRegex(invoice.pdf_file.name, rf'^invoices/invoice_{order.pk}_[0-9a-f]{{16}}\.pdf$')
        again = ensure_invoice(order, refresh_pdf=True)
        self.assertEqual(again.pdf_file.name, invoice.pdf_file.name)
