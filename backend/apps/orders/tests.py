import hashlib
import hmac
import json
import time
from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.db import IntegrityError, transaction
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.admin_dashboard.models import EmailTemplate, PaymentGateway
from apps.admin_dashboard.serializers import PaymentGatewayAdminSerializer
from apps.inventory.models import StockLevel
from apps.regions.models import Region, ShippingRate, ShippingZone, Warehouse
from apps.products.models import Product, ProductRegionConfig, ProductVariant

from .management.commands.run_scheduler import Command as SchedulerCommand
from .email_service import send_templated_email
from .models import (
    Cart, CronJobRun, EmailDelivery, Order, PaymentLog, Refund,
    SchedulerLease, WebhookEvent,
)
from .pricing import quote_cart
from .payments import (
    PaymentError,
    gateway_checkout_allowed,
    resolve_gateway,
    verify_paypal_signature,
    verify_stripe_signature,
)

User = get_user_model()


class WebhookSignatureTests(SimpleTestCase):
    def test_stripe_accepts_any_valid_v1_signature_during_rotation(self):
        body = b'{"id":"evt_123"}'
        timestamp = str(int(time.time()))
        secret = 'whsec_test'
        signed = f"{timestamp}.{body.decode()}".encode()
        valid = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
        header = f't={timestamp},v1=invalid,v1={valid}'
        self.assertTrue(verify_stripe_signature(body, header, secret))

    def test_paypal_fails_closed_without_credentials(self):
        self.assertFalse(verify_paypal_signature({}, b'{}', '', '', '', 'LIVE'))


class PaymentSafetyTests(TestCase):
    def setUp(self):
        self.region = Region.objects.create(
            code='UK',
            name='United Kingdom',
            domain='scleroproteins.co.uk',
            currency_code='GBP',
            currency_symbol='£',
            tax_name='VAT',
            tax_rate='20.00',
        )

    @override_settings(ALLOW_SIMULATED_PAYMENTS=False, ALLOW_TEST_GATEWAYS=False)
    def test_test_gateway_is_hidden_and_rejected_in_production(self):
        gateway = PaymentGateway.objects.create(
            code='STRIPE',
            display_name='Stripe',
            region=self.region,
            is_enabled=True,
            mode='TEST',
        )
        self.assertFalse(gateway_checkout_allowed(gateway))
        with self.assertRaises(PaymentError):
            resolve_gateway(self.region, 'STRIPE')

    @override_settings(DEBUG=False, TESTING=False)
    def test_paypal_is_not_offered_without_a_browser_flow(self):
        gateway = PaymentGateway.objects.create(
            code='PAYPAL',
            display_name='PayPal',
            region=self.region,
            is_enabled=True,
            mode='LIVE',
            publishable_key='paypal-client-id',
            secret_key='not-a-real-key',
        )
        self.assertFalse(gateway_checkout_allowed(gateway))
        with self.assertRaises(PaymentError):
            resolve_gateway(self.region, 'PAYPAL')

    @override_settings(DEBUG=False, TESTING=False)
    def test_live_stripe_is_checkout_ready(self):
        gateway = PaymentGateway.objects.create(
            code='STRIPE',
            display_name='Stripe',
            region=self.region,
            is_enabled=True,
            mode='LIVE',
            secret_key='sk_live_not_a_real_key',
        )
        self.assertTrue(gateway_checkout_allowed(gateway))
        self.assertIsNotNone(resolve_gateway(self.region, 'STRIPE'))

    @override_settings(DEBUG=False, TESTING=False)
    def test_live_razorpay_is_checkout_ready(self):
        gateway = PaymentGateway.objects.create(
            code='RAZORPAY',
            display_name='Razorpay',
            region=self.region,
            is_enabled=True,
            mode='LIVE',
            publishable_key='rzp_key',
            secret_key='rzp_secret',
        )
        self.assertTrue(gateway_checkout_allowed(gateway))

    @override_settings(DEBUG=False, TESTING=False)
    def test_cod_remains_available(self):
        gateway = PaymentGateway.objects.create(
            code='COD',
            display_name='Cash on delivery',
            region=self.region,
            is_enabled=True,
            mode='TEST',
        )
        self.assertTrue(gateway_checkout_allowed(gateway))
        self.assertEqual(resolve_gateway(self.region, 'COD').code, 'COD')

    def test_admin_serializer_never_returns_secret_material(self):
        gateway = PaymentGateway.objects.create(
            code='PAYPAL',
            display_name='PayPal',
            region=self.region,
            secret_key='server-secret',
            extra_config={'webhook_secret': 'webhook-secret'},
        )
        data = PaymentGatewayAdminSerializer(gateway).data
        self.assertNotIn('secret_key', data)
        self.assertNotIn('extra_config', data)

        serializer = PaymentGatewayAdminSerializer(
            gateway,
            data={
                'secret_key': '', 'display_name': 'PayPal updated',
                'extra_config': {'webhook_id': 'new-webhook-id'},
            },
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        gateway.refresh_from_db()
        self.assertEqual(gateway.secret_key, 'server-secret')
        self.assertEqual(gateway.extra_config['webhook_secret'], 'webhook-secret')
        self.assertEqual(gateway.extra_config['webhook_id'], 'new-webhook-id')

    def test_webhook_event_id_is_unique_per_gateway(self):
        WebhookEvent.objects.create(
            gateway='STRIPE',
            event_id='evt_same',
            event_type='payment_intent.succeeded',
            payload={},
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                WebhookEvent.objects.create(
                    gateway='STRIPE',
                    event_id='evt_same',
                    event_type='payment_intent.succeeded',
                    payload={},
                )


class IncomingPaymentWebhookTests(APITestCase):
    def setUp(self):
        self.secret = 'whsec_test_queue'
        region = Region.objects.create(
            code='UK', name='United Kingdom', domain='example.test',
            currency_code='GBP', currency_symbol='£', tax_name='VAT', tax_rate='20.00',
        )
        PaymentGateway.objects.create(
            code='STRIPE', display_name='Stripe', region=region,
            is_enabled=True, mode='TEST', extra_config={'webhook_secret': self.secret},
        )

    def test_signed_event_is_queued_once(self):
        payload = {
            'id': 'evt_queue_once',
            'type': 'payment_intent.succeeded',
            'data': {'object': {'id': 'pi_1', 'amount_received': 1200, 'currency': 'gbp'}},
        }
        body = json.dumps(payload, separators=(',', ':')).encode()
        timestamp = str(int(time.time()))
        signature = hmac.new(
            self.secret.encode(), f'{timestamp}.{body.decode()}'.encode(), hashlib.sha256,
        ).hexdigest()
        header = f't={timestamp},v1={signature}'

        first = self.client.post(
            '/api/webhooks/stripe/', data=body, content_type='application/json',
            HTTP_STRIPE_SIGNATURE=header,
        )
        duplicate = self.client.post(
            '/api/webhooks/stripe/', data=body, content_type='application/json',
            HTTP_STRIPE_SIGNATURE=header,
        )

        self.assertEqual(first.status_code, 202)
        self.assertEqual(duplicate.status_code, 200)
        self.assertEqual(WebhookEvent.objects.filter(event_id='evt_queue_once').count(), 1)


class SchedulerLeaseTests(TestCase):
    def test_active_lease_blocks_second_scheduler_and_expired_lease_can_be_taken(self):
        self.assertTrue(SchedulerCommand._renew_lease('owner-one', 300))
        self.assertFalse(SchedulerCommand._renew_lease('owner-two', 300))

        SchedulerLease.objects.filter(name='primary').update(
            expires_at=timezone.now() - timedelta(seconds=1),
        )
        self.assertTrue(SchedulerCommand._renew_lease('owner-two', 300))
        self.assertEqual(SchedulerLease.objects.get(name='primary').owner, 'owner-two')

    def test_scheduler_stands_by_until_lease_frees(self):
        """A held lease must cause waiting (redeploy handoff), never a crash."""
        import os as _os
        from unittest.mock import patch
        from django.core.management import call_command

        calls = {'n': 0}

        def fake_renew(owner, lease_seconds):
            calls['n'] += 1
            if calls['n'] <= 2:
                return False  # lease held by the previous scheduler — wait
            if calls['n'] == 3:
                return True   # lease freed — acquire and start running
            raise SystemExit  # reached the run loop; end the test

        with patch.dict(_os.environ, {'SCHEDULER_LEASE_WAIT_SECONDS': '1'}), \
             patch.object(SchedulerCommand, '_renew_lease', staticmethod(fake_renew)), \
             patch('apps.orders.management.commands.run_scheduler.call_command'):
            with self.assertRaises(SystemExit):
                call_command('run_scheduler')
        # Two held-lease attempts happened without raising CommandError, then
        # the scheduler acquired the lease and entered its run loop.
        self.assertGreaterEqual(calls['n'], 4)

    def test_once_mode_fails_fast_when_lease_is_held(self):
        # A long-running scheduler stands by until a lingering lease expires
        # (so redeploys don't crash-loop), but --once keeps fail-fast semantics
        # for scripts and manual runs.
        from django.core.management import call_command
        from django.core.management.base import CommandError as DjangoCommandError

        self.assertTrue(SchedulerCommand._renew_lease('other-owner', 300))
        with self.assertRaises(DjangoCommandError):
            call_command('run_scheduler', '--once')


class EmailRetryTests(TestCase):
    def setUp(self):
        self.region = Region.objects.create(
            code='EM', name='Email Test', domain='email.example.test',
            currency_code='GBP', currency_symbol='£', tax_name='VAT', tax_rate='20.00',
        )
        EmailTemplate.objects.create(
            event='order_confirmation', region=self.region, is_active=True,
            subject='Order {order_id}', body='Hello {customer_name}',
        )

    @patch('apps.orders.email_service.EmailMultiAlternatives.send', side_effect=OSError('SMTP unavailable'))
    def test_failed_transactional_email_is_queued_once(self, _send):
        context = {'order_id': 42, 'customer_name': 'Buyer', 'total': Decimal('12.50')}
        first = send_templated_email(
            'order_confirmation', self.region, 'buyer@example.com', context,
            audit_target_type='Order', audit_target_id=42,
        )
        second = send_templated_email(
            'order_confirmation', self.region, 'buyer@example.com', context,
            audit_target_type='Order', audit_target_id=42,
        )

        self.assertFalse(first)
        self.assertFalse(second)
        self.assertEqual(EmailDelivery.objects.count(), 1)
        self.assertEqual(EmailDelivery.objects.get().context['total'], '12.50')

    def test_scheduler_sends_due_email_and_marks_it_sent(self):
        delivery = EmailDelivery.objects.create(
            event='order_confirmation', region=self.region,
            recipient_email='buyer@example.com',
            context={'order_id': 42, 'customer_name': 'Buyer'},
            audit_target_type='Order', audit_target_id='42',
        )
        with patch('apps.orders.email_service.EmailMultiAlternatives.send', return_value=1):
            call_command('process_email_deliveries')

        delivery.refresh_from_db()
        self.assertEqual(delivery.status, 'SENT')
        self.assertEqual(delivery.attempts, 1)


class CheckoutInputValidationTests(APITestCase):
    def payload(self):
        return {
            'session_id': 'session-checkout-validation',
            'region': 'UK',
            'email': 'buyer@example.com',
            'shipping_name': 'Buyer',
            'shipping_phone': '+44 7700 900077',
            'shipping_address_line1': '1 Test Street',
            'shipping_city': 'London',
            'shipping_state': 'London',
            'shipping_postal_code': 'SW1A 1AA',
            'shipping_country': 'GB',
            'payment_method': 'COD',
        }

    def test_whitespace_only_checkout_field_is_rejected(self):
        payload = self.payload()
        payload['shipping_name'] = '   '
        response = self.client.post('/api/checkout/', payload, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('shipping name', response.data['error'])

    def test_missing_phone_is_rejected(self):
        payload = self.payload()
        payload['shipping_phone'] = ''
        response = self.client.post('/api/checkout/', payload, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('shipping phone', response.data['error'])

    def test_invalid_checkout_email_is_rejected(self):
        payload = self.payload()
        payload['email'] = 'not-an-email'
        response = self.client.post('/api/checkout/', payload, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data['error'], 'Enter a valid email address.')


class VariantCartSafetyTests(APITestCase):
    def setUp(self):
        self.region = Region.objects.create(
            code='UK', name='United Kingdom', domain='variants.example.test',
            countries=['GB'], currency_code='GBP', currency_symbol='£',
            tax_name='VAT', tax_rate='20.00',
        )
        warehouse = Warehouse.objects.create(
            region=self.region, name='UK warehouse', is_active=True,
        )
        self.product = Product.objects.create(
            sku='VAR-PRODUCT', name='Variant product', description='',
            benefits='', ingredients='', base_price='8.00',
        )
        ProductRegionConfig.objects.create(
            product=self.product, region=self.region, price='8.00', is_visible=True,
        )
        StockLevel.objects.create(
            warehouse=warehouse, product=self.product, available=25,
        )
        self.small = ProductVariant.objects.create(
            product=self.product, sku='VAR-1KG', name='1 kg',
            option_name='Weight', option_value='1 kg', price_gbp='10.00',
            stock_qty=5,
        )
        self.large = ProductVariant.objects.create(
            product=self.product, sku='VAR-5KG', name='5 kg',
            option_name='Weight', option_value='5 kg', price_gbp='40.00',
            stock_qty=3,
        )
        zone = ShippingZone.objects.create(
            region=self.region, name='United Kingdom', countries=['GB'],
        )
        ShippingRate.objects.create(
            zone=zone, name='Standard', method='Standard delivery',
            rate_type='FLAT', price='5.00',
        )
        PaymentGateway.objects.create(
            code='COD', display_name='Cash on delivery', region=self.region,
            is_enabled=True, mode='TEST',
        )
        self.session_id = 'variant-cart-session'

    def _add(self, variant, quantity=1):
        return self.client.post('/api/cart/add/', {
            'session_id': self.session_id,
            'region': 'UK',
            'product_id': self.product.id,
            'quantity': quantity,
            'metadata': {'variant_sku': variant.sku, 'variant_name': variant.name},
        }, format='json')

    def test_distinct_variants_keep_separate_lines_prices_and_weights(self):
        first = self._add(self.small)
        second = self._add(self.large)
        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(len(second.data['items']), 2)

        cart = Cart.objects.prefetch_related('items__product__variants').get()
        quote = quote_cart(self.region, cart, country='GB')
        self.assertEqual(quote['subtotal'], Decimal('50.00'))
        self.assertEqual(quote['weight_g'], Decimal('6000'))
        self.assertEqual(
            {item.variant_sku for item in cart.items.all()},
            {'VAR-1KG', 'VAR-5KG'},
        )

    def test_variant_stock_limit_applies_to_accumulated_line_quantity(self):
        self.assertEqual(self._add(self.small, quantity=4).status_code, 200)
        response = self._add(self.small, quantity=2)
        self.assertEqual(response.status_code, 400)
        self.assertIn('Only 5 units', response.data['error'])

    def test_cart_item_id_updates_only_the_selected_variant(self):
        self._add(self.small)
        response = self._add(self.large)
        large_line = next(
            item for item in response.data['items'] if item['variant_sku'] == self.large.sku
        )
        updated = self.client.post('/api/cart/update/', {
            'session_id': self.session_id,
            'region': 'UK',
            'cart_item_id': large_line['id'],
            'quantity': 2,
        }, format='json')
        self.assertEqual(updated.status_code, 200, updated.data)
        quantities = {item['variant_sku']: item['quantity'] for item in updated.data['items']}
        self.assertEqual(quantities, {'VAR-1KG': 1, 'VAR-5KG': 2})

    @patch('apps.orders.invoices.generate_invoice_pdf', side_effect=OSError('disk unavailable'))
    def test_checkout_keeps_order_when_invoice_rendering_fails(self, _generate_pdf):
        self._add(self.small, quantity=2)
        response = self.client.post('/api/checkout/', {
            'session_id': self.session_id,
            'region': 'UK',
            'email': 'buyer@example.com',
            'shipping_name': 'Variant Buyer',
            'shipping_phone': '+44 7700 900077',
            'shipping_address_line1': '1 Test Street',
            'shipping_city': 'London',
            'shipping_state': 'London',
            'shipping_postal_code': 'SW1A 1AA',
            'shipping_country': 'GB',
            'payment_method': 'COD',
        }, format='json')
        self.assertEqual(response.status_code, 201, response.data)

        order = Order.objects.prefetch_related('items').get(pk=response.data['order_id'])
        item = order.items.get()
        self.assertEqual(item.variant_sku, self.small.sku)
        self.assertEqual(item.variant_name, self.small.name)
        self.assertEqual(item.price, Decimal('10.00'))
        self.assertFalse(order.invoice.pdf_file)
        self.small.refresh_from_db()
        self.assertEqual(self.small.stock_qty, 3)


def _make_paid_order(region, *, total='20.00', payment_status='PAID', payment_id='pi_test_order'):
    return Order.objects.create(
        region=region,
        status='PROCESSING',
        email='buyer@example.com',
        shipping_name='Buyer',
        shipping_phone='+447700900077',
        shipping_address_line1='1 Test Street',
        shipping_city='London',
        shipping_state='London',
        shipping_postal_code='SW1A 1AA',
        shipping_country='GB',
        currency_code=region.currency_code,
        subtotal=Decimal(total),
        tax_rate=Decimal('0.00'),
        tax_amount=Decimal('0.00'),
        shipping_cost=Decimal('0.00'),
        total=Decimal(total),
        payment_method='STRIPE',
        payment_id=payment_id,
        payment_status=payment_status,
    )


class RefundProcessingSafetyTests(APITestCase):
    def setUp(self):
        self.staff = User.objects.create_superuser(
            email='refunds@example.com', password='StrongOwnerPass123!',
        )
        self.client.force_authenticate(self.staff)
        self.region = Region.objects.create(
            code='UK', name='United Kingdom', domain='refunds.example.test',
            currency_code='GBP', currency_symbol='£', tax_name='VAT', tax_rate='20.00',
        )
        PaymentGateway.objects.create(
            code='STRIPE', display_name='Stripe', region=self.region,
            is_enabled=True, mode='TEST', supports_refunds=True,
        )
        self.order = _make_paid_order(self.region)

    def test_process_marks_refund_processed_and_blocks_reprocessing(self):
        refund = Refund.objects.create(
            order=self.order, amount=Decimal('20.00'), currency_code='GBP',
            gateway='STRIPE', status='PENDING',
        )

        first = self.client.post(f'/api/admin/refunds/{refund.id}/process/')
        self.assertEqual(first.status_code, 200, first.data)

        refund.refresh_from_db()
        self.assertEqual(refund.status, 'PROCESSED')
        self.assertTrue(refund.refund_transaction_id)
        self.assertTrue(
            PaymentLog.objects.filter(order=self.order, status='REFUND_PROCESSED').exists()
        )
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'REFUNDED')

        # A second click must not reach the gateway again.
        second = self.client.post(f'/api/admin/refunds/{refund.id}/process/')
        self.assertEqual(second.status_code, 400)
        self.assertEqual(
            PaymentLog.objects.filter(order=self.order, status='REFUND_PROCESSED').count(), 1,
        )

    def test_approval_refund_rechecks_remaining_balance(self):
        from apps.admin_dashboard.models import ApprovalRequest
        # The order is already fully refunded by the time approval happens.
        Refund.objects.create(
            order=self.order, amount=Decimal('20.00'), currency_code='GBP',
            gateway='STRIPE', status='PROCESSED',
        )
        approval = ApprovalRequest.objects.create(
            requester=self.staff, request_type='REFUND', status='PENDING',
            summary='Refund of GBP 5.00 for order',
            payload={'order_id': self.order.id, 'amount': 5.0, 'reason': '', 'restock': False},
        )

        response = self.client.post(f'/api/admin/approval-requests/{approval.id}/approve/')
        self.assertEqual(response.status_code, 400, response.data)
        approval.refresh_from_db()
        self.assertEqual(approval.status, 'PENDING')
        # No new refund row was created for the rejected execution.
        self.assertEqual(self.order.refunds.count(), 1)

    def test_approval_refund_requires_paid_order(self):
        from apps.admin_dashboard.models import ApprovalRequest
        unpaid = _make_paid_order(
            self.region, payment_status='PENDING', payment_id='pi_unpaid',
        )
        approval = ApprovalRequest.objects.create(
            requester=self.staff, request_type='REFUND', status='PENDING',
            summary='Refund of GBP 5.00 for unpaid order',
            payload={'order_id': unpaid.id, 'amount': 5.0, 'reason': '', 'restock': False},
        )
        response = self.client.post(f'/api/admin/approval-requests/{approval.id}/approve/')
        self.assertEqual(response.status_code, 400, response.data)
        approval.refresh_from_db()
        self.assertEqual(approval.status, 'PENDING')
        self.assertEqual(unpaid.refunds.count(), 0)


class ProcessWebhooksCommandTests(TestCase):
    def setUp(self):
        self.region = Region.objects.create(
            code='UK', name='United Kingdom', domain='webhooks.example.test',
            currency_code='GBP', currency_symbol='£', tax_name='VAT', tax_rate='20.00',
        )
        PaymentGateway.objects.create(
            code='STRIPE', display_name='Stripe', region=self.region,
            is_enabled=True, mode='TEST',
        )

    @staticmethod
    def _stripe_event(event_type, obj, event_id='evt_test'):
        return WebhookEvent.objects.create(
            gateway='STRIPE', event_id=event_id, event_type=event_type,
            payload={'id': event_id, 'type': event_type, 'data': {'object': obj}},
        )

    def test_payment_succeeded_marks_order_paid_and_records_run(self):
        order = _make_paid_order(self.region, payment_status='PENDING', payment_id=None)
        order.status = 'AWAITING_PAYMENT'
        order.payment_reference = 'pi_hook_1'
        order.save(update_fields=['status', 'payment_reference'])
        self._stripe_event('payment_intent.succeeded', {
            'id': 'pi_hook_1', 'amount_received': 2000, 'currency': 'gbp',
            'status': 'succeeded', 'metadata': {},
        })

        call_command('process_webhooks')

        order.refresh_from_db()
        self.assertEqual(order.payment_status, 'PAID')
        self.assertEqual(order.status, 'PROCESSING')
        event = WebhookEvent.objects.get(event_id='evt_test')
        self.assertEqual(event.status, 'PROCESSED')
        run = CronJobRun.objects.filter(job_name='process_webhooks').first()
        self.assertIsNotNone(run)
        self.assertEqual(run.status, 'SUCCESS')
        self.assertEqual(run.processed, 1)

    def test_partial_refund_keeps_order_status(self):
        order = _make_paid_order(self.region, payment_id='pi_hook_2')
        self._stripe_event('charge.refunded', {
            'id': 'ch_1', 'payment_intent': 'pi_hook_2', 'amount': 2000, 'amount_refunded': 500,
            'currency': 'gbp', 'status': 'succeeded', 'metadata': {},
        }, event_id='evt_partial')

        call_command('process_webhooks')

        order.refresh_from_db()
        self.assertEqual(order.payment_status, 'PAID')
        self.assertNotEqual(order.status, 'REFUNDED')
        self.assertTrue(
            PaymentLog.objects.filter(order=order, status='REFUND_PROCESSED').exists()
        )

    def test_full_refund_marks_order_refunded(self):
        order = _make_paid_order(self.region, payment_id='pi_hook_3')
        self._stripe_event('charge.refunded', {
            'id': 'ch_2', 'payment_intent': 'pi_hook_3', 'amount': 2000, 'amount_refunded': 2000,
            'currency': 'gbp', 'status': 'succeeded', 'metadata': {},
        }, event_id='evt_full')

        call_command('process_webhooks')

        order.refresh_from_db()
        self.assertEqual(order.payment_status, 'REFUNDED')
        self.assertEqual(order.status, 'REFUNDED')

    def test_late_payment_failed_never_downgrades_paid_order(self):
        order = _make_paid_order(self.region, payment_id='pi_hook_4')
        self._stripe_event('payment_intent.payment_failed', {
            'id': 'pi_hook_4', 'currency': 'gbp', 'status': 'requires_payment_method',
            'metadata': {},
        }, event_id='evt_late_fail')

        call_command('process_webhooks')

        order.refresh_from_db()
        self.assertEqual(order.payment_status, 'PAID')


class PruneSystemRecordsTests(TestCase):
    def test_old_completed_rows_are_pruned_and_active_rows_kept(self):
        old = timezone.now() - timedelta(days=120)
        CronJobRun.objects.create(job_name='old_job', status='SUCCESS')
        CronJobRun.objects.filter(job_name='old_job').update(started_at=old)
        CronJobRun.objects.create(job_name='recent_job', status='SUCCESS')

        region = Region.objects.create(
            code='PR', name='Prune', domain='prune.example.test',
            currency_code='GBP', currency_symbol='£', tax_name='VAT', tax_rate='20.00',
        )
        sent = EmailDelivery.objects.create(
            event='order_confirmation', region=region,
            recipient_email='old@example.com', status='SENT',
            audit_target_type='Order', audit_target_id='old-1',
        )
        EmailDelivery.objects.filter(pk=sent.pk).update(created_at=old)
        pending = EmailDelivery.objects.create(
            event='order_confirmation', region=region,
            recipient_email='pending@example.com', status='PENDING',
            audit_target_type='Order', audit_target_id='pending-1',
        )
        EmailDelivery.objects.filter(pk=pending.pk).update(created_at=old)

        processed_event = WebhookEvent.objects.create(
            gateway='STRIPE', event_id='evt_old', event_type='x', payload={},
            status='PROCESSED',
        )
        WebhookEvent.objects.filter(pk=processed_event.pk).update(created_at=old)

        call_command('prune_system_records')

        self.assertFalse(CronJobRun.objects.filter(job_name='old_job').exists())
        self.assertTrue(CronJobRun.objects.filter(job_name='recent_job').exists())
        self.assertFalse(EmailDelivery.objects.filter(pk=sent.pk).exists())
        # PENDING work is never pruned, no matter how old.
        self.assertTrue(EmailDelivery.objects.filter(pk=pending.pk).exists())
        self.assertFalse(WebhookEvent.objects.filter(pk=processed_event.pk).exists())
        run = CronJobRun.objects.filter(job_name='prune_system_records').first()
        self.assertIsNotNone(run)
        self.assertEqual(run.status, 'SUCCESS')


class CronRunAdminApiTests(APITestCase):
    def setUp(self):
        staff = User.objects.create_superuser(
            email='cron-admin@example.com', password='StrongOwnerPass123!',
        )
        self.client.force_authenticate(staff)

    def test_summary_lists_expected_jobs_and_scheduler_state(self):
        CronJobRun.objects.create(
            job_name='process_webhooks', status='FAILED', error='boom',
        )
        response = self.client.get('/api/admin/cron-runs/summary/')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertFalse(response.data['scheduler_alive'])
        jobs = {job['job_name']: job for job in response.data['jobs']}
        self.assertIn('process_webhooks', jobs)
        self.assertIn('prune_system_records', jobs)
        self.assertEqual(jobs['process_webhooks']['failures_24h'], 1)
        self.assertTrue(jobs['send_review_requests']['never_ran'])

    def test_run_history_requires_admin(self):
        self.client.force_authenticate(None)
        response = self.client.get('/api/admin/cron-runs/')
        self.assertIn(response.status_code, (401, 403))


class ManualOrderSafetyTests(APITestCase):
    def setUp(self):
        staff = User.objects.create_superuser(
            email='owner@example.com', password='StrongOwnerPass123!',
        )
        self.client.force_authenticate(staff)
        self.region = Region.objects.create(
            code='EU', name='Europe', domain='eu.example.com', countries=['DE'],
            currency_code='EUR', currency_symbol='€', tax_name='VAT', tax_rate='10.00',
        )
        product = Product.objects.create(sku='SAFE-ORDER', name='Safe order product')
        ProductRegionConfig.objects.create(
            product=product, region=self.region, price='12.50', is_visible=True,
        )
        PaymentGateway.objects.create(
            code='COD', display_name='Cash on delivery', region=self.region, is_enabled=True,
        )
        self.payload = {
            'region_code': 'EU', 'email': 'buyer@example.com',
            'shipping_name': 'Buyer', 'shipping_phone': '+49123456789',
            'shipping_address_line1': '1 Test Street', 'shipping_city': 'Berlin',
            'shipping_postal_code': '10115', 'shipping_country': 'DE',
            'payment_method': 'COD', 'tax_rate': '10', 'shipping_cost': '2.00',
            'discount_amount': '1.00', 'subtotal': '0.01', 'tax_amount': '0.01',
            'total': '0.01', 'notes': 'Internal staff note',
            'items': [{'product_sku': 'SAFE-ORDER', 'quantity': 2, 'price': '12.50'}],
        }

    def test_server_recalculates_totals_and_keeps_staff_notes_admin_only(self):
        response = self.client.post('/api/admin/orders/', self.payload, format='json')
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['currency_code'], 'EUR')
        self.assertEqual(Decimal(response.data['subtotal']), Decimal('25.00'))
        self.assertEqual(Decimal(response.data['tax_amount']), Decimal('2.40'))
        self.assertEqual(Decimal(response.data['total']), Decimal('28.40'))
        self.assertEqual(response.data['staff_notes'], 'Internal staff note')

        from .serializers import OrderSerializer
        self.assertNotIn('staff_notes', OrderSerializer(Order.objects.get(pk=response.data['id'])).data)

    def test_invalid_quantity_returns_validation_error(self):
        self.payload['items'][0]['quantity'] = 'not-a-number'
        response = self.client.post('/api/admin/orders/', self.payload, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('items', response.data)
