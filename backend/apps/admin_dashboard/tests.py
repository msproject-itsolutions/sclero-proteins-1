from django.test import TestCase

from .models import HeroBannerSlide, MarketingIntegration, SystemSetting
from .serializers import HeroBannerSlideSerializer, MarketingIntegrationSerializer, SystemSettingSerializer


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
