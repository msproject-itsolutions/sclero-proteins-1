from rest_framework.test import APITestCase


class PageViewIngestTests(APITestCase):
    def test_anonymous_pageview_is_accepted(self):
        response = self.client.post(
            '/api/analytics/pageview/',
            {'path': '/', 'referrer': '', 'session_id': 'sess-anonymous'},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data['ok'])

    def test_beacon_with_stale_auth_cookie_is_still_accepted(self):
        """navigator.sendBeacon attaches cookies but cannot send the
        X-Sclero-Client header — a signed-in or stale-session visitor's beacon
        must not be rejected by the cookie-auth POST guard (regression: 401)."""
        self.client.cookies['sclero_access'] = 'not-a-valid-jwt'
        response = self.client.post(
            '/api/analytics/pageview/',
            {'path': '/products', 'referrer': '', 'session_id': 'sess-stale-cookie'},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertTrue(response.data['ok'])

    def test_pageview_requires_path(self):
        response = self.client.post(
            '/api/analytics/pageview/', {'path': ''}, format='json',
        )
        self.assertEqual(response.status_code, 400)
