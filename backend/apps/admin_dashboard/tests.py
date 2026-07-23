from django.test import TestCase
from django.db import connection

from apps.regions.models import Region
from .models import HeroBannerSlide, MarketingIntegration, PaymentGateway, SystemSetting
from .serializers import (
    HeroBannerSlideSerializer, MarketingIntegrationSerializer,
    PaymentGatewayAdminSerializer, SystemSettingSerializer,
)


class SecretSerializationTests(TestCase):
    def test_system_setting_redacts_and_preserves_blank_secret_updates(self):
        setting = SystemSetting.objects.create(
            key='SYSTEM_CONNECTORS',
            value={
                'cloudflare_zone_id': 'zone-public-id',
                'klaviyo_private_key': 'private-secret',
            },
        )
        data = SystemSettingSerializer(setting).data
        self.assertEqual(data['value']['cloudflare_zone_id'], 'zone-public-id')
        self.assertEqual(data['value']['klaviyo_private_key'], '')
        self.assertIn('klaviyo_private_key', data['sensitive_fields_configured'])

        serializer = SystemSettingSerializer(
            setting,
            data={'value': {'klaviyo_private_key': ''}},
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        setting.refresh_from_db()
        self.assertEqual(setting.value['klaviyo_private_key'], 'private-secret')

    def test_marketing_credentials_are_write_only(self):
        integration = MarketingIntegration.objects.create(
            name='Example',
            channel='THIRD_PARTY',
            credentials={'token': 'private-token'},
        )
        data = MarketingIntegrationSerializer(integration).data
        self.assertNotIn('credentials', data)
        self.assertTrue(data['is_configured'])

    def test_payment_credentials_are_encrypted_and_never_returned(self):
        region = Region.objects.create(
            code='UK', name='United Kingdom', domain='example.test',
            currency_code='GBP', currency_symbol='£',
        )
        gateway = PaymentGateway.objects.create(
            code='STRIPE', display_name='Stripe', region=region,
            publishable_key='pk_test_public', secret_key='sk_test_private',
            extra_config={'webhook_secret': 'whsec_private'},
        )
        with connection.cursor() as cursor:
            cursor.execute(
                'SELECT secret_key, extra_config FROM admin_dashboard_paymentgateway WHERE id = %s',
                [gateway.id],
            )
            raw_secret, raw_config = cursor.fetchone()
        self.assertTrue(raw_secret.startswith('enc:v1:'))
        self.assertNotIn('sk_test_private', raw_secret)
        self.assertTrue(raw_config.startswith('enc:v1:'))
        self.assertNotIn('whsec_private', raw_config)

        data = PaymentGatewayAdminSerializer(gateway).data
        self.assertNotIn('secret_key', data)
        self.assertNotIn('extra_config', data)
        self.assertTrue(data['credential_status']['secret_key'])
        self.assertTrue(data['credential_status']['webhook_secret'])


class HeroBannerSettingsTests(TestCase):
    def test_vertical_and_arrow_positions_round_trip_through_api_serializer(self):
        slide = HeroBannerSlide.objects.create(title='Test', heading='Test heading')
        serializer = HeroBannerSlideSerializer(
            slide,
            data={'vertical_position': 'TOP', 'arrow_position': 'SIDES'},
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        slide.refresh_from_db()
        self.assertEqual(slide.vertical_position, 'TOP')
        self.assertEqual(slide.arrow_position, 'SIDES')
        self.assertEqual(HeroBannerSlideSerializer(slide).data['vertical_position'], 'TOP')
        self.assertEqual(HeroBannerSlideSerializer(slide).data['arrow_position'], 'SIDES')

    def test_theme_colors_round_trip_through_api_serializer(self):
        slide = HeroBannerSlide.objects.create(title='Test', heading='Test heading')
        serializer = HeroBannerSlideSerializer(
            slide,
            data={
                'overlay_color_start': '#112233',
                'overlay_color_mid': '#445566',
                'overlay_color_end': '#778899',
                'heading_color': '#FFFFFF',
                'accent_color': '#F5A227',
                'primary_cta_bg_color': '#0B0F4D',
                'primary_cta_text_color': '#fff',
            },
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        slide.refresh_from_db()
        data = HeroBannerSlideSerializer(slide).data
        self.assertEqual(data['overlay_color_mid'], '#445566')
        self.assertEqual(data['primary_cta_text_color'], '#fff')
        # Untouched colors stay blank, meaning "brand default".
        self.assertEqual(data['subheading_color'], '')

    def test_theme_colors_reject_non_hex_values(self):
        slide = HeroBannerSlide.objects.create(title='Test', heading='Test heading')
        for bad in ('red', 'url(javascript:1)', '#12345', '#GGGGGG', 'expression(1)'):
            serializer = HeroBannerSlideSerializer(
                slide, data={'heading_color': bad}, partial=True,
            )
            self.assertFalse(serializer.is_valid(), f'{bad!r} should be rejected')
            self.assertIn('heading_color', serializer.errors)

    def test_theme_colors_can_be_cleared_back_to_brand_default(self):
        slide = HeroBannerSlide.objects.create(
            title='Test', heading='Test heading', accent_color='#F5A227',
        )
        serializer = HeroBannerSlideSerializer(
            slide, data={'accent_color': ''}, partial=True,
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        serializer.save()
        slide.refresh_from_db()
        self.assertEqual(slide.accent_color, '')


class PolicyPageSeedAndApiTests(TestCase):
    """The storefront policy pages are CMS-backed and editable from the admin."""

    def _seed(self, *args):
        from django.core.management import call_command
        call_command('seed_policy_pages', *args)

    def test_seed_creates_all_published_policy_pages(self):
        from .models import ContentPage
        self._seed()
        slugs = set(
            ContentPage.objects.filter(slug__startswith='policy-')
            .values_list('slug', flat=True)
        )
        self.assertEqual(slugs, {
            'policy-privacy', 'policy-terms', 'policy-shipping', 'policy-refund',
            'policy-cookie', 'policy-accessibility', 'policy-about', 'policy-contact',
        })
        privacy = ContentPage.objects.get(slug='policy-privacy')
        self.assertTrue(privacy.is_published)
        self.assertEqual(privacy.template_layout['kind'], 'policy')
        self.assertTrue(len(privacy.template_layout['sections']) >= 3)

    def test_seed_never_overwrites_admin_edits_unless_reset(self):
        from .models import ContentPage
        self._seed()
        page = ContentPage.objects.get(slug='policy-privacy')
        page.title = 'Custom privacy title'
        page.save(update_fields=['title'])

        self._seed()
        page.refresh_from_db()
        self.assertEqual(page.title, 'Custom privacy title')

        self._seed('--reset')
        page.refresh_from_db()
        self.assertEqual(page.title, 'Privacy Policy')


class PolicyPublicApiTests(TestCase):
    def setUp(self):
        from django.core.management import call_command
        call_command('seed_policy_pages')

    def test_policy_detail_serves_sections(self):
        response = self.client.get('/api/content-pages/policy-refund/')
        self.assertEqual(response.status_code, 200)
        layout = response.json()['template_layout']
        self.assertEqual(layout['kind'], 'policy')
        self.assertTrue(layout['sections'])

    def test_policy_index_lists_short_slugs(self):
        response = self.client.get('/api/policies/')
        self.assertEqual(response.status_code, 200)
        entries = {row['slug']: row for row in response.json()}
        self.assertIn('privacy', entries)
        self.assertIn('terms', entries)
        self.assertEqual(entries['refund']['title'], 'Refund & Return Policy')

    def test_unpublished_policy_disappears_from_index_and_detail(self):
        from .models import ContentPage
        ContentPage.objects.filter(slug='policy-cookie').update(is_published=False)
        index = {row['slug'] for row in self.client.get('/api/policies/').json()}
        self.assertNotIn('cookie', index)
        self.assertEqual(self.client.get('/api/content-pages/policy-cookie/').status_code, 404)

    def test_sitemap_slug_feed_excludes_policy_namespace(self):
        from .models import ContentPage
        ContentPage.objects.create(
            slug='ovomatrix', title='Ovomatrix', content='x', is_published=True,
        )
        response = self.client.get('/api/content-pages/published-slugs/')
        slugs = [row['slug'] for row in response.json()]
        self.assertIn('ovomatrix', slugs)
        self.assertFalse(any(slug.startswith('policy-') for slug in slugs))
