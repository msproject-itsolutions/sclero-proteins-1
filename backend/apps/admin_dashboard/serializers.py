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


SENSITIVE_SETTING_PARTS = (
    'password', 'secret', 'token', 'api_key', 'private_key', 'webhook',
)


def _is_sensitive_setting_key(key):
    normalized = str(key or '').lower()
    return any(part in normalized for part in SENSITIVE_SETTING_PARTS)


def _redact_sensitive_values(value):
    if isinstance(value, dict):
        return {
            key: ('' if _is_sensitive_setting_key(key) else _redact_sensitive_values(item))
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_redact_sensitive_values(item) for item in value]
    return value


def _merge_sensitive_values(existing, incoming):
    if not isinstance(existing, dict) or not isinstance(incoming, dict):
        return incoming
    merged = dict(existing)
    for key, value in incoming.items():
        if _is_sensitive_setting_key(key) and value in ('', None):
            # Empty means "leave unchanged"; explicit deletion should happen by
            # deleting/recreating the setting under controlled admin workflow.
            continue
        if isinstance(value, dict) and isinstance(existing.get(key), dict):
            merged[key] = _merge_sensitive_values(existing[key], value)
        else:
            merged[key] = value
    return merged


class SystemSettingSerializer(serializers.ModelSerializer):
    sensitive_fields_configured = serializers.SerializerMethodField()

    class Meta:
        model = SystemSetting
        fields = [
            'id', 'key', 'value', 'description', 'updated_at',
            'sensitive_fields_configured',
        ]

    def get_sensitive_fields_configured(self, obj):
        if not isinstance(obj.value, dict):
            return []
        return sorted(
            str(key) for key, value in obj.value.items()
            if _is_sensitive_setting_key(key) and value not in ('', None)
        )

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['value'] = _redact_sensitive_values(data.get('value'))
        return data

    def update(self, instance, validated_data):
        if 'value' in validated_data:
            validated_data['value'] = _merge_sensitive_values(
                instance.value,
                validated_data['value'],
            )
        return super().update(instance, validated_data)


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
    """Admin representation that accepts credentials but never returns them."""
    region_code = serializers.CharField(source='region.code', read_only=True)
    is_configured = serializers.BooleanField(read_only=True)

    class Meta:
        model = PaymentGateway
        fields = [
            'id', 'code', 'display_name', 'region', 'region_code', 'is_enabled',
            'mode', 'publishable_key', 'secret_key', 'extra_config',
            'supports_refunds', 'sort_order', 'is_configured', 'updated_at',
        ]
        extra_kwargs = {
            'secret_key': {'write_only': True, 'required': False},
            'extra_config': {'write_only': True, 'required': False},
        }

    def update(self, instance, validated_data):
        # Empty secret fields from an edit form mean "leave unchanged", not
        # "erase the configured production credential".
        if not validated_data.get('secret_key'):
            validated_data.pop('secret_key', None)
        if not validated_data.get('extra_config'):
            validated_data.pop('extra_config', None)
        return super().update(instance, validated_data)


class PaymentGatewayPublicSerializer(serializers.ModelSerializer):
    """Safe representation for the storefront checkout — NO secret key, NO server-side config."""
    class Meta:
        model = PaymentGateway
        fields = ['code', 'display_name', 'mode', 'publishable_key']


class MarketingIntegrationSerializer(serializers.ModelSerializer):
    is_configured = serializers.SerializerMethodField()

    class Meta:
        model = MarketingIntegration
        fields = [
            'id', 'name', 'channel', 'is_connected', 'credentials',
            'is_configured', 'sync_status', 'last_sync', 'metrics', 'updated_at',
        ]
        extra_kwargs = {
            'credentials': {'write_only': True, 'required': False},
        }

    def get_is_configured(self, obj):
        return bool(obj.credentials)

    def update(self, instance, validated_data):
        credentials = validated_data.get('credentials')
        if isinstance(credentials, dict):
            validated_data['credentials'] = _merge_sensitive_values(
                instance.credentials,
                credentials,
            )
        return super().update(instance, validated_data)


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
