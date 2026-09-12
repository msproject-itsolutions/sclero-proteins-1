from django.test import TestCase


class DjangoAdminExposureTests(TestCase):
    def test_django_admin_is_not_mounted_when_debug_is_off(self):
        # The test runner runs with DEBUG=False, exactly like production.
        response = self.client.get('/admin/login/')
        self.assertEqual(response.status_code, 404)
