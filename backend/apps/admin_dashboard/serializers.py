from rest_framework import serializers
from .models import (
    FeatureToggle, SystemSetting, HeroBannerSlide, PaymentGateway, EmailTemplate,
    MarketingIntegration, ContentPage, BlogPost, ApprovalRequest,
)


class EmailTemplateSerializer(serializers.ModelSerializer):
    region_code = serializers.CharField(source='region.code', read_only=True, default=None)
    event_display = serializers.CharField(source='get_event_display', read_only=True)

    class Meta:
        model = EmailTemplate
        fields = ['id', 'event', 'event_display', 'region', 'region_code',
                  'subject', 'body', 'is_active', 'updated_at']
        read_only_fields = ['updated_at']

class FeatureToggleSerializer(serializers.ModelSerializer):
    region_code = serializers.CharField(source='region.code', read_only=True, allow_null=True)

    class Meta:
        model = FeatureToggle
        fields = ['id', 'module_name', 'is_enabled', 'region', 'region_code', 'updated_at']


class SystemSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSetting
        fields = ['id', 'key', 'value', 'description', 'updated_at']


class HeroBannerSlideSerializer(serializers.ModelSerializer):
    class Meta:
        model = HeroBannerSlide
        fields = [
            'id', 'title', 'eyebrow', 'heading', 'subheading',
            'desktop_media_url', 'tablet_media_url', 'mobile_media_url',
            'media_type', 'alt_text', 'primary_cta_label', 'primary_cta_url',
            'secondary_cta_label', 'secondary_cta_url', 'text_position',
            'overlay_opacity', 'sort_order', 'is_enabled', 'starts_at',
            'ends_at', 'autoplay_enabled', 'show_indicators',
            'display_duration_ms', 'transition_ms', 'seo_title',
            'seo_description', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class PaymentGatewayAdminSerializer(serializers.ModelSerializer):
    """Full representation for the admin panel — includes credentials so staff can configure keys."""
    region_code = serializers.CharField(source='region.code', read_only=True)
    is_configured = serializers.BooleanField(read_only=True)

    class Meta:
        model = PaymentGateway
        fields = [
            'id', 'code', 'display_name', 'region', 'region_code', 'is_enabled',
            'mode', 'publishable_key', 'secret_key', 'extra_config',
            'supports_refunds', 'sort_order', 'is_configured', 'updated_at',
        ]


class PaymentGatewayPublicSerializer(serializers.ModelSerializer):
    """Safe representation for the storefront checkout — NO secret key, NO server-side config."""
    class Meta:
        model = PaymentGateway
        fields = ['code', 'display_name', 'mode', 'publishable_key']


class MarketingIntegrationSerializer(serializers.ModelSerializer):
    class Meta:
        model = MarketingIntegration
        fields = '__all__'


class ContentPageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentPage
        fields = '__all__'


class BlogPostSerializer(serializers.ModelSerializer):
    class Meta:
        model = BlogPost
        fields = '__all__'


class ApprovalRequestSerializer(serializers.ModelSerializer):
    requester_email = serializers.CharField(source='requester.email', read_only=True)
    approver_email = serializers.CharField(source='approver.email', read_only=True, default=None)

    class Meta:
        model = ApprovalRequest
        fields = '__all__'
