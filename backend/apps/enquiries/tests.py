from rest_framework.test import APITestCase

from .models import BulkEnquiry, NewsletterSubscriber


class EnquiryValidationTests(APITestCase):
    def test_general_contact_submission_is_trimmed_and_accepted(self):
        response = self.client.post('/api/enquiries/', {
            'name': '  Jane Customer  ',
            'email': '  JANE@EXAMPLE.COM ',
            'message': '  I need help with an order.  ',
            'enquiry_type': 'GENERAL',
            'product_interest': 'Customer support',
        }, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        enquiry = BulkEnquiry.objects.get()
        self.assertEqual(enquiry.name, 'Jane Customer')
        self.assertEqual(enquiry.email, 'jane@example.com')
        self.assertEqual(enquiry.message, 'I need help with an order.')

    def test_whitespace_only_required_values_are_rejected(self):
        response = self.client.post('/api/enquiries/', {
            'name': '   ',
            'email': 'person@example.com',
            'message': '\t  ',
            'enquiry_type': 'BULK',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('name', response.data)
        self.assertIn('message', response.data)
        self.assertFalse(BulkEnquiry.objects.exists())

    def test_meaningless_short_values_are_rejected_after_trimming(self):
        response = self.client.post('/api/enquiries/', {
            'name': ' x ',
            'email': 'person@example.com',
            'message': ' too short ',
            'enquiry_type': 'GENERAL',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('name', response.data)
        self.assertIn('message', response.data)
        self.assertFalse(BulkEnquiry.objects.exists())

    def test_invalid_phone_is_rejected(self):
        response = self.client.post('/api/enquiries/', {
            'name': 'Buyer',
            'email': 'buyer@example.com',
            'phone': 'call-me',
            'message': 'Please quote this requirement.',
            'enquiry_type': 'BULK',
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('phone', response.data)

    def test_complete_bulk_enquiry_is_accepted(self):
        response = self.client.post('/api/enquiries/', {
            'name': 'Procurement Lead',
            'company': 'Example Nutrition',
            'email': 'procurement@example.com',
            'phone': '+44 7700 900077',
            'country': 'United Kingdom',
            'message': 'Please provide pricing for our monthly requirement.',
            'product_interest': 'OvoMatrix ESC (25 kg)',
            'quantity': '500 kg per month',
            'enquiry_type': 'BULK',
        }, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(BulkEnquiry.objects.get().phone, '+44 7700 900077')

    def test_newsletter_email_is_normalized_and_idempotent(self):
        first = self.client.post('/api/newsletter/subscribe/', {
            'email': '  NEWS@EXAMPLE.COM ', 'source': 'header',
        }, format='json')
        second = self.client.post('/api/newsletter/subscribe/', {
            'email': 'news@example.com', 'source': 'footer',
        }, format='json')

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(NewsletterSubscriber.objects.count(), 1)

    def test_newsletter_source_is_trimmed_and_blank_source_uses_default(self):
        response = self.client.post('/api/newsletter/subscribe/', {
            'email': 'news-source@example.com', 'source': '   ',
        }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertEqual(NewsletterSubscriber.objects.get().source, 'footer')
