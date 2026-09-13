from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework.test import APITestCase

from apps.fraud.models import FraudRule
from apps.users.models import Role

from .fraud import assess_order
from .models import AuditLog, PaymentLog
from .testing import make_order, make_region

User = get_user_model()


class CashOnDeliveryAdminTests(APITestCase):
    def setUp(self):
        self.staff = User.objects.create_superuser(email='owner@example.com', password='StrongOwnerPass123!')
        self.client.force_authenticate(self.staff)
        self.region = make_region()
        self.customer = User.objects.create_user(email='buyer@example.com', password='Str0ng-pass-123')
        self.cod = make_order(
            self.region, user=self.customer, status='PROCESSING', payment_status='PENDING',
            payment_method='COD', payment_id='cod_1',
        )
        self.paid = make_order(self.region, status='PROCESSING', payment_status='PAID', payment_id='pi_paid')
        self.awaiting = make_order(self.region, user=self.customer, payment_reference='pi_wait')
        self.expired = make_order(self.region, status='CANCELLED', payment_status='EXPIRED')

    def test_the_orders_workspace_lists_placed_orders_only(self):
        response = self.client.get('/api/admin/orders/?page_size=100')
        self.assertEqual({row['id'] for row in response.data['results']}, {self.cod.pk, self.paid.pk})

    def test_customer_history_includes_cash_on_delivery_orders(self):
        self.client.force_authenticate(self.customer)
        response = self.client.get('/api/orders/mine/')
        ids = [row['id'] for row in (response.data['results'] if isinstance(response.data, dict) else response.data)]
        self.assertEqual(ids, [self.cod.pk])

    def test_unpaid_attempts_are_listed_for_recovery(self):
        rows = self.client.get('/api/admin/abandoned-checkouts/').data
        attempts = {row['order_id'] for row in rows if row['entity_type'] == 'PAYMENT_ATTEMPT'}
        self.assertEqual(attempts, {self.awaiting.pk})

    def test_recording_the_cash_payment(self):
        response = self.client.post(f'/api/admin/orders/{self.cod.pk}/record_cod_payment/')
        self.assertEqual(response.status_code, 200, response.data)
        self.cod.refresh_from_db()
        self.assertEqual((self.cod.payment_status, self.cod.payment_captured_amount), ('PAID', Decimal('20.00')))
        self.assertTrue(PaymentLog.objects.filter(order=self.cod, status='PAID', gateway='COD').exists())
        self.assertTrue(AuditLog.objects.filter(object_id=str(self.cod.pk), action='Cash on delivery payment recorded').exists())
        again = self.client.post(f'/api/admin/orders/{self.cod.pk}/record_cod_payment/')
        self.assertEqual(again.status_code, 400)

    def test_only_cash_on_delivery_orders_take_a_cash_payment(self):
        response = self.client.post(f'/api/admin/orders/{self.paid.pk}/record_cod_payment/')
        self.assertEqual(response.status_code, 400)

    def test_recording_a_payment_needs_orders_manage(self):
        viewer = User.objects.create_user(email='viewer@example.com', password='Str0ng-pass-123', is_staff=True)
        viewer.roles.add(Role.objects.create(name='Order viewer', permissions=['orders.view']))
        self.client.force_authenticate(viewer)
        response = self.client.post(f'/api/admin/orders/{self.cod.pk}/record_cod_payment/')
        self.assertEqual(response.status_code, 403)

    def test_the_fake_authorize_and_capture_actions_are_gone(self):
        for action in ('authorize_payment', 'capture_payment'):
            response = self.client.post(f'/api/admin/orders/{self.cod.pk}/{action}/', {'amount': '20.00'}, format='json')
            self.assertEqual(response.status_code, 404, action)
        self.cod.refresh_from_db()
        self.assertEqual(self.cod.payment_status, 'PENDING')

    def test_staff_cannot_put_an_order_back_to_awaiting_payment(self):
        response = self.client.post(f'/api/admin/orders/{self.paid.pk}/update_status/', {'status': 'AWAITING_PAYMENT'}, format='json')
        self.assertEqual(response.status_code, 400)
        response = self.client.patch(f'/api/admin/orders/{self.paid.pk}/', {'status': 'AWAITING_PAYMENT'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.paid.refresh_from_db()
        self.assertEqual(self.paid.status, 'PROCESSING')

    def test_revenue_ignores_unpaid_attempts(self):
        response = self.client.get('/api/admin/reports/analytics/?region=UK')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['sales']['total_orders'], 2)
        self.assertEqual(response.data['sales']['total_revenue'], 40.0)

    def test_fraud_velocity_counts_placed_orders_only(self):
        FraudRule.objects.create(
            name='Velocity', kind='ORDER_VELOCITY_PER_EMAIL', threshold=1, window_minutes=60,
            severity='LOW', action='FLAG',
        )
        for _ in range(3):
            make_order(self.region)  # unpaid attempts from the same shopper
        assessment = assess_order(self.paid)
        self.assertEqual(assessment.signals, [])
