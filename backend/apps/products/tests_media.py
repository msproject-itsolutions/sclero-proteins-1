import shutil
import tempfile

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

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
