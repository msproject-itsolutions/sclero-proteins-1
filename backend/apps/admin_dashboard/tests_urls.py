from importlib import reload

from django.test import SimpleTestCase, override_settings
from django.urls import Resolver404, clear_url_caches, resolve

import sclero_backend.urls as project_urls


class DjangoAdminExposureTests(SimpleTestCase):
    """The admin mount is decided when the URLconf loads, so each case reloads it."""

    def _reload_urlconf(self):
        clear_url_caches()
        reload(project_urls)

    def tearDown(self):
        # Rebuild the URLconf for the test run's own settings.
        self._reload_urlconf()

    @override_settings(DEBUG=False)
    def test_django_admin_is_not_mounted_when_debug_is_off(self):
        self._reload_urlconf()
        with self.assertRaises(Resolver404):
            resolve('/admin/login/')

    @override_settings(DEBUG=True)
    def test_django_admin_is_mounted_for_local_development(self):
        self._reload_urlconf()
        self.assertEqual(resolve('/admin/login/').app_name, 'admin')
