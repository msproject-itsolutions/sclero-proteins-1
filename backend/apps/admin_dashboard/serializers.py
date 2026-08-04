from rest_framework import serializers
from apps.orders.models import CronJobRun
from .models import (
    FeatureToggle, SystemSetting, HeroBannerSlide, PaymentGateway, EmailTemplate,
    MarketingIntegration, ContentPage, BlogPost, ApprovalRequest, InstagramReelsConnection,
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
            'vertical_position', 'arrow_position',
            'overlay_color_start', 'overlay_color_mid', 'overlay_color_end',
            'eyebrow_color', 'heading_color', 'subheading_color',
            'primary_cta_bg_color', 'primary_cta_text_color',
            'secondary_cta_bg_color', 'secondary_cta_text_color',
            'accent_color',
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
    credential_status = serializers.SerializerMethodField()
    extra_config = serializers.JSONField(write_only=True, required=False)

    class Meta:
        model = PaymentGateway
        fields = [
            'id', 'code', 'display_name', 'region', 'region_code', 'is_enabled',
            'mode', 'publishable_key', 'secret_key', 'extra_config',
            'supports_refunds', 'sort_order', 'is_configured',
            'credential_status', 'verification_status', 'verification_message',
            'last_verified_at', 'updated_at',
        ]
        read_only_fields = ['verification_status', 'verification_message', 'last_verified_at']
        extra_kwargs = {
            'secret_key': {'write_only': True, 'required': False},
            'extra_config': {'write_only': True, 'required': False},
        }

    def get_credential_status(self, obj):
        extra = obj.extra_config or {}
        return {
            'publishable_key': bool(obj.publishable_key),
            'secret_key': bool(obj.secret_key),
            'webhook_secret': bool(extra.get('webhook_secret')),
            'webhook_id': bool(extra.get('webhook_id')),
        }

    def update(self, instance, validated_data):
        # Empty secret fields from an edit form mean "leave unchanged", not
        # "erase the configured production credential".
        if not validated_data.get('secret_key'):
            validated_data.pop('secret_key', None)
        if not validated_data.get('extra_config'):
            validated_data.pop('extra_config', None)
        else:
            # Credential forms submit only the secret being rotated. Preserve
            # unrelated provider settings instead of replacing the JSON blob.
            validated_data['extra_config'] = {
                **(instance.extra_config or {}),
                **validated_data['extra_config'],
            }
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


class InstagramReelsConnectionSerializer(serializers.ModelSerializer):
    access_token = serializers.CharField(write_only=True, required=False, allow_blank=True)
    access_token_configured = serializers.SerializerMethodField()

    class Meta:
        model = InstagramReelsConnection
        fields = ['instagram_user_id', 'access_token', 'access_token_configured', 'is_enabled', 'updated_at']
        read_only_fields = ['updated_at']

    def get_access_token_configured(self, obj):
        return bool(obj.access_token)

    def validate_instagram_user_id(self, value):
        value = str(value or '').strip()
        if value and not value.isdigit():
            raise serializers.ValidationError('Enter the numeric Instagram Professional Account ID.')
        return value

    def update(self, instance, validated_data):
        if validated_data.get('access_token', None) == '':
            validated_data.pop('access_token')
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


class CronJobRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = CronJobRun
        fields = [
            'id', 'job_name', 'status', 'started_at', 'finished_at',
            'duration_ms', 'processed', 'failed', 'message', 'error',
        ]
