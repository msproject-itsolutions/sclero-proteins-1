from django.contrib.auth.hashers import make_password
from django.test import TestCase

from .serializers import RegisterSerializer
from .views import _new_otp_value, _verify_otp_value


class AuthenticationSafetyTests(TestCase):
    def test_otp_is_hashed_and_verifiable(self):
        code, stored = _new_otp_value()
        self.assertNotIn(code, stored)
        self.assertTrue(_verify_otp_value(stored, code))
        self.assertFalse(_verify_otp_value(stored, '000000'))

    def test_expired_otp_is_rejected(self):
        stored = f'otp:1:{make_password("123456")}'
        self.assertFalse(_verify_otp_value(stored, '123456'))

    def test_registration_uses_django_password_policy(self):
        serializer = RegisterSerializer(data={
            'email': 'customer@example.com',
            'password': 'password',
            'first_name': 'Test',
            'last_name': 'Customer',
        })
        self.assertFalse(serializer.is_valid())
        self.assertIn('password', serializer.errors)
