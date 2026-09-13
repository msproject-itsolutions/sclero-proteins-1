"""Races only PostgreSQL row locks can settle; skipped on SQLite."""
import threading
from unittest import skipUnless
from unittest.mock import patch

from django.db import connection, transaction
from django.test import TransactionTestCase, override_settings
from rest_framework.test import APIClient

from apps.inventory.models import StockLevel

from .models import Invoice, Order, PaymentLog
from .order_payments import mark_order_paid
from .testing import TEST_MEDIA_ROOT, add_gateway, make_catalog, make_order, make_region

DETAILS = {
    'region': 'UK', 'email': 'buyer@example.com', 'shipping_name': 'Buyer',
    'shipping_phone': '+44 7700 900077', 'shipping_address_line1': '1 Test Street',
    'shipping_city': 'London', 'shipping_state': 'London', 'shipping_postal_code': 'SW1A 1AA',
    'shipping_country': 'GB', 'payment_method': 'COD',
}


def run_together(*targets):
    """Start every target at the same moment in its own thread (own DB connection)."""
    barrier = threading.Barrier(len(targets))
    results = [None] * len(targets)

    def runner(index, target):
        try:
            barrier.wait(timeout=10)
            results[index] = target()
        except Exception as exc:  # the assertion reports it
            results[index] = exc
        finally:
            connection.close()

    threads = [threading.Thread(target=runner, args=(index, target)) for index, target in enumerate(targets)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=60)
    return results


@skipUnless(connection.vendor == 'postgresql', 'Needs PostgreSQL row locks.')
@override_settings(MEDIA_ROOT=TEST_MEDIA_ROOT)
class CheckoutRaceTests(TransactionTestCase):
    def test_two_shoppers_cannot_both_buy_the_last_unit(self):
        region = make_region()
        product = make_catalog(region, stock=1)
        add_gateway(region, 'COD', mode='TEST', secret_key='', publishable_key='')
        shoppers = [APIClient(), APIClient()]
        for shopper in shoppers:
            added = shopper.post('/api/cart/add/', {'region': 'UK', 'product_id': product.pk}, format='json')
            self.assertEqual(added.status_code, 200)
        with patch('apps.orders.checkout.run_order_followups'):
            results = run_together(
                *[lambda shopper=shopper: shopper.post('/api/checkout/', DETAILS, format='json').status_code
                  for shopper in shoppers]
            )
        self.assertEqual(sorted(results), [201, 400])
        self.assertEqual(StockLevel.objects.get(product=product).available, 0)
        self.assertEqual(Order.objects.count(), 1)

    def test_confirmation_and_webhook_record_one_payment(self):
        region = make_region()
        product = make_catalog(region)
        order = make_order(region, product=product, payment_reference='pi_race')
        verification = {'state': 'paid', 'transaction_id': 'pi_race', 'amount_minor': 2000, 'currency': 'GBP', 'raw': {}}

        def pay(source):
            with transaction.atomic():
                mark_order_paid(Order.objects.get(pk=order.pk), verification, source=source)
            return 'ok'

        with patch('apps.orders.order_payments.run_order_followups'):
            results = run_together(lambda: pay('checkout'), lambda: pay('webhook'))
        self.assertEqual(results, ['ok', 'ok'])
        self.assertEqual(PaymentLog.objects.filter(order=order, status='PAID').count(), 1)
        self.assertEqual(Invoice.objects.filter(order=order).count(), 1)
        order.refresh_from_db()
        self.assertEqual(order.payment_status, 'PAID')
