import base64
import os
import shutil
import tempfile
from io import StringIO

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.test import SimpleTestCase, override_settings
from rest_framework.test import APITestCase

from apps.products.media_validation import MediaUrlError, validate_media_url
from apps.products.models import Product, ProductMedia
from apps.users.models import Role

User = get_user_model()
PNG_BYTES = b'\x89PNG\r\n\x1a\n' + b'\x00' * 32


class MediaUploadUrlTests(APITestCase):
    def setUp(self):
        self.media_root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.media_root, True)
        role = Role.objects.create(name='Catalogue', permissions=['products.manage'])
        self.user = User.objects.create_user(email='catalogue@example.com', password='x', is_staff=True)
        self.user.roles.add(role)
        self.client.force_authenticate(self.user)

    def _upload(self, **extra):
        upload = SimpleUploadedFile('photo.png', PNG_BYTES, content_type='image/png')
        return self.client.post('/api/admin/upload-media/', {'file': upload}, format='multipart', **extra)

    def test_forwarded_host_cannot_choose_the_returned_host(self):
        with override_settings(
            MEDIA_ROOT=self.media_root,
            SITE_URL='https://shop.example',
            ALLOWED_HOSTS=['testserver', 'other.example'],
        ):
            response = self._upload(HTTP_X_FORWARDED_HOST='other.example')
        self.assertEqual(response.status_code, 201, response.content)
        self.assertTrue(response.data['file_url'].startswith('https://shop.example/media/uploads/'))

    def test_relative_url_when_site_url_is_not_configured(self):
        with override_settings(MEDIA_ROOT=self.media_root, SITE_URL=''):
            response = self._upload()
        self.assertEqual(response.status_code, 201, response.content)
        self.assertTrue(response.data['file_url'].startswith('/media/uploads/'))


class MediaUrlValidationTests(SimpleTestCase):
    def test_accepts_https_cdn_urls_without_extension(self):
        url = 'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=600'
        self.assertEqual(validate_media_url(url), url)

    def test_accepts_site_relative_paths(self):
        self.assertEqual(validate_media_url('/media/uploads/abc.webp'), '/media/uploads/abc.webp')

    def test_rejects_script_capable_types_and_schemes(self):
        for bad in (
            'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
            'javascript:alert(1)',
            ' JavaScript:alert(1)',
            '/media/products/logo.svg',
            'https://cdn.example.com/x.SVG?v=1',
            '/media/uploads/page.html',
            '//evil.example/x.png',
            '/media/x%2Esvg',
            '/\\evil.example/x.png',
            'http://cdn.example.com/x.png',
            'ftp://files.example.com/x.png',
            '',
        ):
            with self.subTest(bad=bad), self.assertRaises(MediaUrlError):
                validate_media_url(bad)


class ProductMediaApiValidationTests(APITestCase):
    def setUp(self):
        role = Role.objects.create(name='Catalogue', permissions=['products.manage'])
        self.user = User.objects.create_user(email='editor@example.com', password='x', is_staff=True)
        self.user.roles.add(role)
        self.client.force_authenticate(self.user)
        self.product = Product.objects.create(sku='SKU-MEDIA', name='Media product')

    def test_product_media_endpoint_rejects_svg_data_uri(self):
        response = self.client.post('/api/admin/product-media/', {
            'product': self.product.pk,
            'file_url': 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
            'media_type': 'IMAGE',
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('file_url', response.data)

    def test_nested_media_files_are_validated(self):
        response = self.client.patch(f'/api/admin/products/{self.product.sku}/', {
            'media_files': [{'file_url': 'javascript:alert(1)', 'media_type': 'IMAGE'}],
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertFalse(ProductMedia.objects.filter(product=self.product).exists())

    def test_non_text_media_url_is_a_validation_error(self):
        response = self.client.post('/api/admin/products/', {
            'sku': 'SKU-BAD-MEDIA',
            'name': 'Bad media product',
            'media_files': [{'file_url': ['x']}],
        }, format='json')
        self.assertEqual(response.status_code, 400, response.content)
        self.assertEqual(response.data['media_files'], ['Media item 1: file_url must be text.'])
        self.assertFalse(Product.objects.filter(sku='SKU-BAD-MEDIA').exists())

    def test_legacy_media_url_stays_editable_on_unrelated_change(self):
        svg = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='
        ProductMedia.objects.create(product=self.product, file_url=svg, media_type='IMAGE')
        response = self.client.patch(f'/api/admin/products/{self.product.sku}/', {
            'name': 'Media product renamed',
            'media_files': [{'file_url': svg, 'media_type': 'IMAGE'}],
        }, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(ProductMedia.objects.filter(product=self.product, file_url=svg).exists())

    def test_legacy_media_url_does_not_shield_new_invalid_entries(self):
        svg = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='
        ProductMedia.objects.create(product=self.product, file_url=svg, media_type='IMAGE')
        response = self.client.patch(f'/api/admin/products/{self.product.sku}/', {
            'media_files': [
                {'file_url': svg, 'media_type': 'IMAGE'},
                {'file_url': 'javascript:alert(1)', 'media_type': 'IMAGE'},
            ],
        }, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertTrue(ProductMedia.objects.filter(product=self.product, file_url=svg).exists())

    def test_product_media_endpoint_allows_unchanged_legacy_file_url(self):
        svg = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='
        media = ProductMedia.objects.create(product=self.product, file_url=svg, media_type='IMAGE')
        response = self.client.patch(f'/api/admin/product-media/{media.pk}/', {
            'file_url': svg,
        }, format='json')
        self.assertEqual(response.status_code, 200, response.content)


class DataUriMigrationTests(APITestCase):
    def setUp(self):
        self.media_root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.media_root, True)
        self.product = Product.objects.create(sku='SKU-DATA', name='Data product')

    def test_svg_data_uris_are_not_written_to_disk(self):
        svg = 'data:image/svg+xml;base64,' + base64.b64encode(b'<svg><script>alert(1)</script></svg>').decode()
        png = 'data:image/png;base64,' + base64.b64encode(PNG_BYTES).decode()
        svg_media = ProductMedia.objects.create(product=self.product, file_url=svg)
        png_media = ProductMedia.objects.create(product=self.product, file_url=png)
        with override_settings(MEDIA_ROOT=self.media_root):
            call_command('migrate_datauri_media', base_url='', stdout=StringIO(), stderr=StringIO())
        svg_media.refresh_from_db()
        png_media.refresh_from_db()
        self.assertTrue(svg_media.file_url.startswith('data:image/svg+xml'))
        self.assertTrue(png_media.file_url.startswith('/media/products/'))
        written = os.listdir(os.path.join(self.media_root, 'products'))
        self.assertFalse(any(name.endswith('.svg') for name in written))


class ScanMediaCommandTests(APITestCase):
    def test_reports_script_capable_files_and_rows(self):
        media_root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, media_root, True)
        os.makedirs(os.path.join(media_root, 'products'))
        with open(os.path.join(media_root, 'products', 'evil.svg'), 'w') as handle:
            handle.write('<svg/>')
        with open(os.path.join(media_root, 'products', 'ok.png'), 'wb') as handle:
            handle.write(PNG_BYTES)
        product = Product.objects.create(sku='SKU-SCAN', name='Scan product')
        row = ProductMedia.objects.create(product=product, file_url='/media/products/evil.svg')
        script_row = ProductMedia.objects.create(product=product, file_url='javascript:alert(1)')
        valid_row = ProductMedia.objects.create(product=product, file_url='/media/products/ok.png')
        out = StringIO()
        with override_settings(MEDIA_ROOT=media_root):
            call_command('scan_media_svg', stdout=out)
        text = out.getvalue()
        self.assertIn(os.path.join('products', 'evil.svg'), text)
        self.assertNotIn('ok.png', text)
        self.assertIn(f'media#{row.pk}:', text)
        self.assertIn(f'media#{script_row.pk}:', text)
        self.assertNotIn(f'media#{valid_row.pk}:', text)
        self.assertIn('1 file(s) and 2 media row(s) need review.', text)
