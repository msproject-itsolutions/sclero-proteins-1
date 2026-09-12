from rest_framework.test import APITestCase

from apps.enquiries.models import NewsletterSubscriber
from apps.enquiries.tokens import email_from_unsubscribe_token, make_unsubscribe_token

URL = '/api/newsletter/subscribe/'


class UnsubscribeTokenTests(APITestCase):
    def setUp(self):
        self.subscriber = NewsletterSubscriber.objects.create(email='reader@example.com', is_active=True)

    def test_token_round_trip(self):
        token = make_unsubscribe_token(' Reader@Example.com ')
        self.assertEqual(email_from_unsubscribe_token(token), 'reader@example.com')
        self.assertIsNone(email_from_unsubscribe_token('tampered'))

    def test_bare_email_cannot_unsubscribe(self):
        response = self.client.delete(URL, {'email': 'reader@example.com'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.subscriber.refresh_from_db()
        self.assertTrue(self.subscriber.is_active)

    def test_signed_token_unsubscribes(self):
        token = make_unsubscribe_token('reader@example.com')
        response = self.client.delete(f'{URL}?token={token}')
        self.assertEqual(response.status_code, 200)
        self.subscriber.refresh_from_db()
        self.assertFalse(self.subscriber.is_active)
        self.assertIsNotNone(self.subscriber.unsubscribed_at)

    def test_unknown_address_gets_the_same_answer(self):
        token = make_unsubscribe_token('nobody@example.com')
        response = self.client.delete(URL, {'token': token}, format='json')
        self.assertEqual(response.status_code, 200)
