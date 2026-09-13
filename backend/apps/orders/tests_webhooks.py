from decimal import Decimal
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase, override_settings

from apps.admin_dashboard.models import PaymentGateway

from .models import Order, PaymentLog, WebhookEvent
from .payments import PayPalAdapter, RazorpayAdapter, from_minor_units
from .testing import TEST_MEDIA_ROOT, add_gateway, make_catalog, make_order, make_region, provider


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class PaymentWebhookTests(TestCase):
    def setUp(self):
        self.region = make_region()
        self.product = make_catalog(self.region)
        add_gateway(self.region, 'STRIPE')
        self.order = make_order(self.region, product=self.product, payment_reference='pi_w1')

    def stripe_event(self, event_type, obj, event_id='evt_1'):
        return WebhookEvent.objects.create(
            gateway='STRIPE', event_id=event_id, event_type=event_type,
            payload={'id': event_id, 'type': event_type, 'data': {'object': obj}},
        )

    def paid_intent(self, **overrides):
        obj = {
            'id': 'pi_w1', 'object': 'payment_intent', 'status': 'succeeded', 'amount_received': 2000,
            'currency': 'gbp', 'metadata': {'order_id': str(self.order.pk)},
        }
        obj.update(overrides)
        return obj

    @patch('apps.orders.order_payments.run_order_followups')
    def test_a_signed_success_event_marks_the_order_paid_once(self, followups):
        self.stripe_event('payment_intent.succeeded', self.paid_intent())
        self.stripe_event('charge.succeeded', {
            'id': 'ch_1', 'payment_intent': 'pi_w1', 'amount': 2000, 'amount_captured': 2000,
            'currency': 'gbp', 'status': 'succeeded',
        }, event_id='evt_2')
        with self.captureOnCommitCallbacks(execute=True):
            call_command('process_webhooks')
        self.order.refresh_from_db()
        self.assertEqual((self.order.status, self.order.payment_status, self.order.payment_id), ('PROCESSING', 'PAID', 'pi_w1'))
        self.assertEqual(PaymentLog.objects.filter(order=self.order, status='PAID').count(), 1)
        followups.assert_called_once_with(self.order.pk)
        self.assertEqual(set(WebhookEvent.objects.values_list('status', flat=True)), {'PROCESSED'})

    def test_a_wrong_amount_is_never_applied(self):
        event = self.stripe_event('payment_intent.succeeded', self.paid_intent(amount_received=1000))
        call_command('process_webhooks')
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'AWAITING_PAYMENT')
        event.refresh_from_db()
        self.assertEqual(event.status, 'FAILED')
        self.assertIn('amount', event.error_message)

    @patch('apps.orders.order_payments.run_order_followups')
    def test_an_event_without_an_amount_is_checked_with_the_provider(self, _followups):
        self.stripe_event('payment_intent.succeeded', {'id': 'pi_w1', 'metadata': {}})
        with provider((200, self.paid_intent())):
            call_command('process_webhooks')
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, 'PAID')

    def test_an_event_for_another_payment_does_not_complete_the_order(self):
        event = self.stripe_event('payment_intent.succeeded', self.paid_intent(id='pi_other'))
        call_command('process_webhooks')
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'AWAITING_PAYMENT')
        event.refresh_from_db()
        self.assertEqual(event.status, 'FAILED')

    def test_unknown_event_types_are_ignored_not_retried(self):
        event = self.stripe_event('customer.created', {'id': 'cus_1'})
        call_command('process_webhooks')
        event.refresh_from_db()
        self.assertEqual((event.status, event.error_message, event.attempts), ('PROCESSED', 'ignored', 1))

    def test_charge_refunds_use_the_refunded_amount(self):
        Order.objects.filter(pk=self.order.pk).update(status='PROCESSING', payment_status='PAID', payment_id='pi_w1')
        charge = {'id': 'ch_1', 'payment_intent': 'pi_w1', 'amount': 2000, 'amount_refunded': 500, 'currency': 'gbp'}
        self.stripe_event('charge.refunded', charge)
        call_command('process_webhooks')
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, 'PAID')
        self.assertEqual(PaymentLog.objects.get(order=self.order, status='REFUND_PROCESSED').amount, Decimal('5.00'))
        self.stripe_event('charge.refunded', {**charge, 'amount_refunded': 2000}, event_id='evt_full')
        call_command('process_webhooks')
        self.order.refresh_from_db()
        self.assertEqual((self.order.status, self.order.payment_status), ('REFUNDED', 'REFUNDED'))

    def test_minor_units_follow_the_currency(self):
        self.assertEqual(from_minor_units(1500, 'GBP'), Decimal('15.00'))
        self.assertEqual(from_minor_units(1500, 'JPY'), Decimal('1500'))
        self.assertEqual(from_minor_units(1500, 'KWD'), Decimal('1.5'))

    @patch('apps.orders.order_payments.run_order_followups')
    def test_a_razorpay_capture_matches_the_razorpay_order(self, _followups):
        india = make_region('IN')
        add_gateway(india, 'RAZORPAY', secret_key='rzp_secret', publishable_key='rzp_live_key')
        order = make_order(
            india, total=Decimal('2299.00'), currency_code='INR', payment_method='RAZORPAY',
            payment_reference='order_r1',
        )
        WebhookEvent.objects.create(gateway='RAZORPAY', event_id='sha256_x', event_type='payment.captured', payload={
            'event': 'payment.captured',
            'payload': {'payment': {'entity': {
                'id': 'pay_r1', 'order_id': 'order_r1', 'amount': 229900, 'currency': 'INR',
                'status': 'captured', 'notes': {},
            }}},
        })
        with self.captureOnCommitCallbacks(execute=True):
            call_command('process_webhooks')
        order.refresh_from_db()
        self.assertEqual((order.payment_status, order.payment_id), ('PAID', 'pay_r1'))

    def test_a_paypal_order_approval_is_not_a_payment(self):
        parsed = PayPalAdapter(PaymentGateway(code='PAYPAL')).parse_webhook_event({
            'event_type': 'CHECKOUT.ORDER.APPROVED',
            'resource': {'id': 'ORDER-1', 'amount': {'value': '10.00', 'currency_code': 'GBP'}},
        })
        self.assertEqual(parsed['event_type'], 'unknown')

    def test_a_razorpay_refund_uses_the_refund_amount(self):
        parsed = RazorpayAdapter(PaymentGateway(code='RAZORPAY')).parse_webhook_event({
            'event': 'refund.processed',
            'payload': {
                'payment': {'entity': {'id': 'pay_1', 'order_id': 'order_1', 'amount': 229900, 'currency': 'INR'}},
                'refund': {'entity': {'id': 'rfnd_1', 'payment_id': 'pay_1', 'amount': 50000, 'currency': 'INR'}},
            },
        })
        self.assertEqual((parsed['event_type'], parsed['amount_minor'], parsed['amount']), ('refund.processed', 50000, Decimal('500.00')))
