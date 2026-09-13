import re
import time
from importlib import reload
from pathlib import Path
from unittest.mock import patch
from urllib.parse import quote

from django.conf import settings
from django.test import SimpleTestCase, override_settings
from django.urls import Resolver404, clear_url_caches, resolve
from rest_framework.test import APITestCase

import sclero_backend.urls as project_urls

from .access import make_order_token, read_order_token
from .email_service import _build_order_context
from .invoices import ensure_invoice
from .serializers import OrderAdminSerializer, OrderSerializer
from .testing import TEST_MEDIA_ROOT, make_catalog, make_order, make_region


@override_settings(
    MEDIA_ROOT=TEST_MEDIA_ROOT, SITE_URL='https://site.example',
    CSRF_TRUSTED_ORIGINS=['https://scleroproteins.co.uk'],
)
class OrderLinkTests(APITestCase):
    def setUp(self):
        self.region = make_region()
        product = make_catalog(self.region)
        self.order = make_order(self.region, product=product, status='PROCESSING', payment_status='PAID')
        ensure_invoice(self.order)
        self.token = quote(make_order_token(self.order))

    def test_the_token_opens_the_order(self):
        response = self.client.get(f'/api/orders/lookup/?token={self.token}')
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['id'], self.order.pk)
        self.assertTrue(response.data['invoice_url'].startswith('/api/orders/invoice/?token='))
        self.assertNotIn('pdf_url', response.data['invoice'])

    def test_an_order_number_and_email_alone_reveal_nothing(self):
        response = self.client.get(f'/api/orders/lookup/?id={self.order.pk}&email=buyer@example.com')
        self.assertEqual(response.status_code, 400)
        self.assertNotIn('email', response.data)
        self.assertEqual(self.client.get('/api/orders/lookup/?token=forged').status_code, 404)

    def test_links_expire_after_180_days(self):
        token = make_order_token(self.order)
        with patch('django.core.signing.time.time', return_value=time.time() + 179 * 86400):
            self.assertEqual(read_order_token(token), self.order.pk)
        with patch('django.core.signing.time.time', return_value=time.time() + 181 * 86400):
            self.assertIsNone(read_order_token(token))

    def test_the_invoice_downloads_with_the_token_only(self):
        response = self.client.get(f'/api/orders/invoice/?token={self.token}')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertIn('no-store', response['Cache-Control'])
        self.assertTrue(b''.join(response.streaming_content).startswith(b'%PDF'))
        self.assertEqual(self.client.get('/api/orders/invoice/?token=forged').status_code, 404)

    def test_unpaid_attempts_have_no_invoice(self):
        attempt = make_order(self.region)
        self.assertIsNone(OrderSerializer(attempt).data['invoice_url'])
        token = quote(make_order_token(attempt))
        self.assertEqual(self.client.get(f'/api/orders/invoice/?token={token}').status_code, 404)

    @patch('apps.orders.email_service.send_branded_email')
    def test_the_access_link_is_emailed_only_on_a_match(self, send):
        match = self.client.post('/api/orders/access-link/', {'order_id': self.order.pk, 'email': 'BUYER@example.com'}, format='json')
        wrong_email = self.client.post('/api/orders/access-link/', {'order_id': self.order.pk, 'email': 'other@example.com'}, format='json')
        unknown = self.client.post('/api/orders/access-link/', {'order_id': 999999, 'email': 'buyer@example.com'}, format='json')
        self.assertEqual({match.status_code, wrong_email.status_code, unknown.status_code}, {200})
        self.assertEqual(match.data, wrong_email.data)
        self.assertEqual(match.data, unknown.data)
        send.assert_called_once()
        body = send.call_args.args[1]
        link = re.search(r'https://\S+', body).group(0)
        self.assertTrue(link.startswith(f'https://scleroproteins.co.uk/checkout/success?order={self.order.pk}&token='))
        self.assertNotIn('example.com', link)

    def test_confirmation_email_links_carry_the_token_not_the_email(self):
        context = _build_order_context(self.order)
        self.assertTrue(context['order_url'].startswith(f'https://scleroproteins.co.uk/checkout/success?order={self.order.pk}&token='))
        self.assertTrue(context['invoice_url'].startswith('https://scleroproteins.co.uk/api/orders/invoice/?token='))
        self.assertNotIn('buyer', context['order_url'] + context['invoice_url'])

    def test_staff_serializers_point_at_the_staff_download(self):
        data = OrderAdminSerializer(self.order).data
        self.assertEqual(data['invoice_url'], f'/api/admin/orders/{self.order.pk}/invoice/')
        self.assertNotIn('pdf_url', data['invoice'])


class InvoiceExposureTests(SimpleTestCase):
    def tearDown(self):
        clear_url_caches()
        reload(project_urls)

    def test_nginx_refuses_direct_invoice_urls(self):
        conf = (Path(settings.BASE_DIR).parent / 'nginx' / 'conf.d' / 'scleroproteins.conf').read_text()
        block = re.search(r'location \^~ /media/invoices/ \{\s*return 404;\s*\}', conf)
        self.assertIsNotNone(block)
        self.assertLess(block.start(), conf.index('location /media/ {'))

    @override_settings(DEBUG=True)
    def test_development_media_serving_skips_invoices(self):
        clear_url_caches()
        reload(project_urls)
        with self.assertRaises(Resolver404):
            resolve('/media/invoices/invoice_1_abc.pdf')
        self.assertEqual(resolve('/media/products/a.png').kwargs['path'], 'products/a.png')
