from decimal import Decimal

import requests
from django.test import TestCase, override_settings

from .payments import (
    PaymentError, PaymentOutcomeUnknown, gateway_checkout_allowed, get_adapter, resolve_gateway,
)
from .testing import add_gateway, make_order, make_region, provider, razorpay_signature


@override_settings(ALLOW_SIMULATED_PAYMENTS=False, ALLOW_TEST_GATEWAYS=False)
class GatewayAvailabilityTests(TestCase):
    def setUp(self):
        self.region = make_region('UK')

    def test_cash_on_delivery_is_always_offered(self):
        gateway = add_gateway(self.region, 'COD', mode='TEST', secret_key='', publishable_key='')
        self.assertTrue(gateway_checkout_allowed(gateway))
        self.assertEqual(resolve_gateway(self.region, 'cod').code, 'COD')

    def test_live_card_gateways_are_offered(self):
        stripe = add_gateway(self.region, 'STRIPE')
        razorpay = add_gateway(
            make_region('IN'), 'RAZORPAY', secret_key='rzp_secret', publishable_key='rzp_live_key',
        )
        self.assertTrue(gateway_checkout_allowed(stripe))
        self.assertTrue(gateway_checkout_allowed(razorpay))
        self.assertEqual(resolve_gateway(self.region, 'stripe').code, 'STRIPE')

    def test_gateway_without_keys_is_simulated_only_where_allowed(self):
        gateway = add_gateway(self.region, 'STRIPE', mode='TEST', secret_key='', publishable_key='')
        self.assertFalse(gateway_checkout_allowed(gateway))
        with self.assertRaises(PaymentError):
            resolve_gateway(self.region, 'STRIPE')
        with self.settings(ALLOW_SIMULATED_PAYMENTS=True):
            self.assertTrue(gateway_checkout_allowed(gateway))

    def test_test_mode_keys_need_the_test_gateway_switch(self):
        gateway = add_gateway(self.region, 'STRIPE', mode='TEST', secret_key='sk_test_key')
        self.assertFalse(gateway_checkout_allowed(gateway))
        with self.settings(ALLOW_TEST_GATEWAYS=True):
            self.assertTrue(gateway_checkout_allowed(gateway))

    def test_gateway_without_a_browser_flow_is_never_offered(self):
        gateway = add_gateway(self.region, 'PAYPAL', publishable_key='client-id', secret_key='secret')
        self.assertFalse(gateway_checkout_allowed(gateway))

    def test_disabled_gateway_is_not_offered(self):
        gateway = add_gateway(self.region, 'STRIPE')
        gateway.is_enabled = False
        gateway.save(update_fields=['is_enabled'])
        self.assertFalse(gateway_checkout_allowed(gateway))

    def test_storefront_list_uses_the_same_rule(self):
        add_gateway(self.region, 'COD', mode='TEST', secret_key='', publishable_key='')
        add_gateway(self.region, 'STRIPE', mode='TEST', secret_key='sk_test_key')
        response = self.client.get('/api/admin/payment-gateways/available/?region=UK')
        self.assertEqual(response.status_code, 200)
        self.assertEqual([gateway['code'] for gateway in response.json()], ['COD'])


@override_settings(ALLOW_SIMULATED_PAYMENTS=False)
class SimulatedPaymentTests(TestCase):
    def setUp(self):
        self.region = make_region('UK')
        self.order = make_order(self.region)

    def test_simulated_payment_needs_the_development_switch(self):
        adapter = get_adapter(
            add_gateway(self.region, 'STRIPE', mode='TEST', secret_key='', publishable_key=''),
        )
        self.assertTrue(adapter.simulated)
        with self.assertRaises(PaymentError):
            adapter.open_payment(self.order)
        with self.assertRaises(PaymentError):
            adapter.verify_payment(self.order, {})
        with self.settings(ALLOW_SIMULATED_PAYMENTS=True):
            opened = adapter.open_payment(self.order)
            self.assertEqual(opened['client'], {'simulated': True})
            self.order.payment_reference = opened['reference']
            result = adapter.verify_payment(self.order, {})
        self.assertEqual((result['state'], result['amount_minor']), ('paid', 2000))

    def test_test_mode_keys_never_fall_back_to_simulation(self):
        adapter = get_adapter(add_gateway(self.region, 'STRIPE', mode='TEST', secret_key='sk_test_key'))
        self.assertFalse(adapter.simulated)
        self.order.payment_reference = 'pi_1'
        with self.settings(ALLOW_SIMULATED_PAYMENTS=True), provider(requests.ConnectionError('down')):
            with self.assertRaises(PaymentOutcomeUnknown):
                adapter.verify_payment(self.order, {})


class StripeAdapterTests(TestCase):
    def setUp(self):
        self.region = make_region('UK')
        self.adapter = get_adapter(add_gateway(self.region, 'STRIPE'))
        self.order = make_order(self.region, total=Decimal('22.99'))

    def intent(self, **overrides):
        body = {
            'id': 'pi_123', 'status': 'succeeded', 'amount_received': 2299, 'currency': 'gbp',
            'client_secret': 'pi_123_secret', 'metadata': {'order_id': str(self.order.pk)},
        }
        body.update(overrides)
        return body

    def test_open_payment_binds_the_intent_to_the_order(self):
        with provider((200, self.intent(status='requires_payment_method'))) as http:
            opened = self.adapter.open_payment(self.order)
        self.assertEqual(opened['reference'], 'pi_123')
        self.assertEqual(
            opened['client'], {'client_secret': 'pi_123_secret', 'publishable_key': 'pk_live_test'},
        )
        self.assertEqual(http.call_args.args, ('POST', 'https://api.stripe.com/v1/payment_intents'))
        data = http.call_args.kwargs['data']
        self.assertEqual(data['amount'], 2299)
        self.assertEqual(data['currency'], 'gbp')
        self.assertEqual(data['metadata[order_id]'], str(self.order.pk))
        self.assertEqual(
            http.call_args.kwargs['headers'], {'Idempotency-Key': f'order-{self.order.pk}-intent'},
        )

    def test_verify_accepts_only_this_order_amount_and_currency(self):
        self.order.payment_reference = 'pi_123'
        with provider((200, self.intent())):
            result = self.adapter.verify_payment(self.order, {})
        self.assertEqual(
            (result['state'], result['transaction_id'], result['amount_minor'], result['currency']),
            ('paid', 'pi_123', 2299, 'GBP'),
        )
        refused = [
            self.intent(amount_received=100),
            self.intent(currency='eur'),
            self.intent(metadata={'order_id': '999999'}),
            self.intent(status='requires_payment_method'),
        ]
        for body in refused:
            with self.subTest(body=body), provider((200, body)):
                with self.assertRaises(PaymentError):
                    self.adapter.verify_payment(self.order, {})

    def test_processing_payment_is_not_yet_paid(self):
        self.order.payment_reference = 'pi_123'
        with provider((200, self.intent(status='processing', amount_received=0))):
            self.assertEqual(self.adapter.verify_payment(self.order, {})['state'], 'processing')

    def test_cancel_reports_a_payment_that_already_succeeded(self):
        self.order.payment_reference = 'pi_123'
        refusal = (400, {'error': {'message': 'This PaymentIntent cannot be canceled.'}})
        with provider(refusal, (200, self.intent())):
            self.assertEqual(self.adapter.cancel_payment(self.order), 'succeeded')
        with provider((200, self.intent(status='canceled'))) as http:
            self.assertEqual(self.adapter.cancel_payment(self.order), 'canceled')
        self.assertEqual(
            http.call_args.args, ('POST', 'https://api.stripe.com/v1/payment_intents/pi_123/cancel'),
        )

    def test_reconcile_maps_provider_states(self):
        self.order.payment_reference = 'pi_123'
        cases = [
            (self.intent(), 'paid'),
            (self.intent(status='processing'), 'pending'),
            (self.intent(status='requires_action'), 'pending'),
            (self.intent(status='requires_payment_method'), 'failed'),
            (self.intent(status='canceled'), 'failed'),
        ]
        for body, expected in cases:
            with self.subTest(status=body['status']), provider((200, body)):
                self.assertEqual(self.adapter.reconcile_order(self.order)['state'], expected)

    def test_unreachable_provider_is_an_unknown_outcome(self):
        with provider(requests.Timeout('slow')):
            with self.assertRaises(PaymentOutcomeUnknown):
                self.adapter.open_payment(self.order)

    def test_refund_sends_the_idempotency_key(self):
        self.order.payment_id = 'pi_123'
        with provider((200, {'id': 're_1', 'status': 'succeeded'})) as http:
            result = self.adapter.refund(
                self.order, Decimal('5.00'), 'Damaged', idempotency_key='refund-7',
            )
        self.assertEqual((result['status'], result['refund_id']), ('REFUNDED', 're_1'))
        self.assertEqual(http.call_args.kwargs['headers'], {'Idempotency-Key': 'refund-7'})
        self.assertEqual(http.call_args.kwargs['data']['amount'], 500)


class RazorpayAdapterTests(TestCase):
    SECRET = 'rzp_secret'

    def setUp(self):
        self.region = make_region('IN')
        self.adapter = get_adapter(add_gateway(
            self.region, 'RAZORPAY', secret_key=self.SECRET, publishable_key='rzp_live_key',
        ))
        self.order = make_order(
            self.region, total=Decimal('2299.00'), currency_code='INR', payment_method='RAZORPAY',
            shipping_country='IN',
        )

    def payment(self, **overrides):
        body = {
            'id': 'pay_1', 'order_id': 'order_1', 'status': 'captured', 'amount': 229900,
            'currency': 'INR', 'method': 'upi',
        }
        body.update(overrides)
        return body

    def signed(self, payment_id='pay_1', order_reference='order_1'):
        return {
            'razorpay_order_id': order_reference,
            'razorpay_payment_id': payment_id,
            'razorpay_signature': razorpay_signature(self.SECRET, order_reference, payment_id),
        }

    def test_open_payment_creates_a_razorpay_order_for_this_order(self):
        with provider((200, {'id': 'order_1', 'status': 'created'})) as http:
            opened = self.adapter.open_payment(self.order)
        self.assertEqual(opened['reference'], 'order_1')
        self.assertEqual(opened['client'], {
            'razorpay_order_id': 'order_1', 'key_id': 'rzp_live_key', 'amount': 229900,
            'currency': 'INR',
        })
        data = http.call_args.kwargs['data']
        self.assertEqual(data['receipt'], f'order-{self.order.pk}')
        self.assertEqual(data['notes[order_id]'], str(self.order.pk))
        self.assertEqual(data['amount'], 229900)

    def test_signature_is_mandatory_and_checked_before_any_network_call(self):
        self.order.payment_reference = 'order_1'
        forged = {**self.signed(), 'razorpay_signature': 'forged'}
        for payload in ({}, forged, self.signed(order_reference='order_other')):
            with self.subTest(payload=payload), provider() as http:
                with self.assertRaises(PaymentError):
                    self.adapter.verify_payment(self.order, payload)
                http.assert_not_called()

    def test_authorized_payment_is_captured(self):
        self.order.payment_reference = 'order_1'
        with provider((200, self.payment(status='authorized')), (200, self.payment())) as http:
            result = self.adapter.verify_payment(self.order, self.signed())
        self.assertEqual((result['state'], result['transaction_id']), ('paid', 'pay_1'))
        self.assertEqual(
            http.call_args_list[1].args,
            ('POST', 'https://api.razorpay.com/v1/payments/pay_1/capture'),
        )

    def test_payment_for_another_razorpay_order_is_refused(self):
        self.order.payment_reference = 'order_1'
        with provider((200, self.payment(order_id='order_2'))):
            with self.assertRaises(PaymentError):
                self.adapter.verify_payment(self.order, self.signed())

    def test_reconcile_finds_the_captured_payment_on_the_order(self):
        self.order.payment_reference = 'order_1'
        with provider((200, {'items': [self.payment(id='pay_0', status='failed'), self.payment()]})):
            result = self.adapter.reconcile_order(self.order)
        self.assertEqual((result['state'], result['transaction_id']), ('paid', 'pay_1'))
        with provider((200, {'items': [self.payment(status='failed')]})):
            self.assertEqual(self.adapter.reconcile_order(self.order)['state'], 'failed')
        with provider((200, {'items': [self.payment(status='created')]})):
            self.assertEqual(self.adapter.reconcile_order(self.order)['state'], 'pending')

    def test_refund_notes_carry_the_refund_key(self):
        self.order.payment_id = 'pay_1'
        with provider((200, {'id': 'rfnd_1', 'status': 'processed'})) as http:
            result = self.adapter.refund(
                self.order, Decimal('100.00'), 'Damaged', idempotency_key='refund-9',
            )
        self.assertEqual(result['status'], 'REFUNDED')
        self.assertEqual(http.call_args.kwargs['data']['notes[refund_id]'], 'refund-9')
        self.assertEqual(http.call_args.kwargs['data']['amount'], 10000)
