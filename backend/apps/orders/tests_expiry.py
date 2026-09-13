from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.admin_dashboard.models import PaymentGateway
from apps.inventory.models import StockLevel

from .models import CronJobRun, Order, OrderItem, Refund
from .testing import TEST_MEDIA_ROOT, add_gateway, make_catalog, make_order, make_region, provider

User = get_user_model()


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class ExpireUnpaidOrdersTests(TestCase):
    def setUp(self):
        self.region = make_region()
        # 25 units before this order reserved 2.
        self.product = make_catalog(self.region, stock=23)
        add_gateway(self.region, 'STRIPE')
        expired_at = timezone.now() - timedelta(minutes=1)
        self.order = make_order(self.region, payment_reference='pi_x', payment_expires_at=expired_at)
        OrderItem.objects.create(order=self.order, product=self.product, quantity=2, price=Decimal('10.00'))
        Order.objects.filter(pk=self.order.pk).update(created_at=expired_at - timedelta(minutes=30))

    def intent(self, status, **overrides):
        body = {
            'id': 'pi_x', 'status': status, 'amount_received': 2000 if status == 'succeeded' else 0,
            'currency': 'gbp', 'metadata': {'order_id': str(self.order.pk)},
        }
        body.update(overrides)
        return body

    def already_extended(self):
        # The window (30 min) plus the extension (15 min) have both passed.
        Order.objects.filter(pk=self.order.pk).update(created_at=timezone.now() - timedelta(minutes=46))

    def test_an_unpaid_order_is_cancelled_with_the_provider_and_released(self):
        with provider((200, self.intent('requires_payment_method')), (200, self.intent('canceled'))) as http:
            call_command('expire_unpaid_orders')
        self.order.refresh_from_db()
        self.assertEqual((self.order.status, self.order.payment_status), ('CANCELLED', 'EXPIRED'))
        self.assertEqual(StockLevel.objects.get(product=self.product).available, 25)
        self.assertEqual(
            http.call_args_list[1].args, ('POST', 'https://api.stripe.com/v1/payment_intents/pi_x/cancel'),
        )
        run = CronJobRun.objects.get(job_name='expire_unpaid_orders')
        self.assertEqual((run.status, run.processed), ('SUCCESS', 1))

    @patch('apps.orders.order_payments.run_order_followups')
    def test_a_paid_order_is_recorded_instead(self, _followups):
        with provider((200, self.intent('succeeded'))):
            call_command('expire_unpaid_orders')
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, 'PAID')

    def test_a_payment_in_progress_gets_one_extension(self):
        old_expiry = Order.objects.get(pk=self.order.pk).payment_expires_at
        with provider((200, self.intent('processing'))):
            call_command('expire_unpaid_orders')
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'AWAITING_PAYMENT')
        self.assertEqual(self.order.payment_expires_at, old_expiry + timedelta(minutes=15))

    def test_after_its_extension_an_abandoned_payment_is_released(self):
        self.already_extended()
        with provider((200, self.intent('requires_action')), (200, self.intent('canceled'))):
            call_command('expire_unpaid_orders')
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, 'EXPIRED')

    def test_a_payment_the_provider_is_still_processing_is_never_released(self):
        self.already_extended()
        refusal = (400, {'error': {'message': 'This PaymentIntent cannot be canceled.'}})
        with provider((200, self.intent('processing')), refusal, (200, self.intent('processing'))):
            call_command('expire_unpaid_orders')
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'AWAITING_PAYMENT')

    def test_unexpired_orders_are_left_alone(self):
        Order.objects.filter(pk=self.order.pk).update(payment_expires_at=timezone.now() + timedelta(minutes=5))
        with provider() as http:
            call_command('expire_unpaid_orders')
        http.assert_not_called()

    def test_a_mismatching_payment_leaves_the_order_and_counts_a_failure(self):
        with provider((200, self.intent('succeeded', amount_received=1))):
            call_command('expire_unpaid_orders')
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'AWAITING_PAYMENT')
        run = CronJobRun.objects.get(job_name='expire_unpaid_orders')
        self.assertEqual((run.status, run.failed), ('FAILED', 1))

    @patch('apps.orders.order_payments.send_staff_alert')
    def test_late_payments_without_a_refund_are_swept(self, _alert):
        gateway = PaymentGateway.objects.get(code='STRIPE')
        gateway.secret_key = ''
        gateway.save()
        late = make_order(
            self.region, status='CANCELLED', payment_status='PAID', payment_id='sim_1',
            payment_reference='sim_1',
        )
        Order.objects.filter(pk=self.order.pk).update(payment_expires_at=timezone.now() + timedelta(minutes=5))
        with self.settings(ALLOW_SIMULATED_PAYMENTS=True):
            call_command('expire_unpaid_orders')
        self.assertEqual(Refund.objects.get(order=late).status, 'PROCESSED')


@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class ReconcilePendingPaymentsTests(TestCase):
    def setUp(self):
        self.region = make_region()
        product = make_catalog(self.region)
        add_gateway(self.region, 'STRIPE')
        self.order = make_order(
            self.region, product=product, payment_reference='pi_r',
            payment_expires_at=timezone.now() + timedelta(minutes=20),
        )

    def intent(self, status):
        return {
            'id': 'pi_r', 'status': status, 'amount_received': 2000 if status == 'succeeded' else 0,
            'currency': 'gbp', 'metadata': {'order_id': str(self.order.pk)},
        }

    @patch('apps.orders.order_payments.run_order_followups')
    def test_a_delayed_webhook_is_covered_by_reconciliation(self, _followups):
        with provider((200, self.intent('succeeded'))):
            call_command('reconcile_pending_payments')
        self.order.refresh_from_db()
        self.assertEqual(self.order.payment_status, 'PAID')
        self.assertEqual(CronJobRun.objects.get(job_name='reconcile_pending_payments').processed, 1)

    def test_payments_still_open_are_left_for_the_shopper(self):
        with provider((200, self.intent('requires_payment_method'))):
            call_command('reconcile_pending_payments')
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'AWAITING_PAYMENT')


class PaymentJobScheduleTests(APITestCase):
    def test_the_scheduler_runs_both_payment_jobs(self):
        with patch('apps.orders.management.commands.run_scheduler.call_command') as run:
            call_command('run_scheduler', '--once')
        names = {job.args[0] for job in run.call_args_list}
        self.assertTrue({'expire_unpaid_orders', 'reconcile_pending_payments'} <= names)

    def test_the_admin_summary_expects_both_payment_jobs(self):
        self.client.force_authenticate(
            User.objects.create_superuser(email='ops@example.com', password='StrongOwnerPass123!'),
        )
        response = self.client.get('/api/admin/cron-runs/summary/')
        jobs = {job['job_name'] for job in response.data['jobs']}
        self.assertTrue({'expire_unpaid_orders', 'reconcile_pending_payments'} <= jobs)
