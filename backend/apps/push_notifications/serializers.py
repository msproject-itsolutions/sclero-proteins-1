from urllib.parse import urlsplit

from rest_framework import serializers

from apps.webhooks.security import validate_webhook_destination

from .models import PushCampaign


class PushSubscriptionSerializer(serializers.Serializer):
    endpoint = serializers.URLField(max_length=2000)
    previous_endpoint = serializers.URLField(max_length=2000, required=False, allow_blank=True)
    client_id = serializers.UUIDField()
    keys = serializers.DictField()

    def validate_endpoint(self, value):
        validate_webhook_destination(value)
        return value

    def validate_keys(self, value):
        auth = value.get('auth') if isinstance(value, dict) else None
        p256dh = value.get('p256dh') if isinstance(value, dict) else None
        if not isinstance(auth, str) or not auth.strip() or len(auth) > 500:
            raise serializers.ValidationError('The browser push auth key is invalid.')
        if not isinstance(p256dh, str) or not p256dh.strip() or len(p256dh) > 1000:
            raise serializers.ValidationError('The browser push public key is invalid.')
        return {'auth': auth.strip(), 'p256dh': p256dh.strip()}


class PushCampaignSerializer(serializers.ModelSerializer):
    created_by_email = serializers.EmailField(source='created_by.email', read_only=True)

    class Meta:
        model = PushCampaign
        fields = [
            'id', 'title', 'body', 'target_url', 'status', 'scheduled_for',
            'total_recipients', 'sent_count', 'failed_count',
            'created_by_email', 'created_at', 'started_at', 'completed_at',
        ]
        read_only_fields = [
            'status', 'total_recipients', 'sent_count', 'failed_count',
            'created_by_email', 'created_at', 'started_at', 'completed_at',
        ]

    def validate_title(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Enter a notification title.')
        return value

    def validate_body(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError('Enter a notification message.')
        return value

    def validate_target_url(self, value):
        value = value.strip() or '/'
        parsed = urlsplit(value)
        if not value.startswith('/') or value.startswith('//') or parsed.scheme or parsed.netloc:
            raise serializers.ValidationError('Notification links must be same-site paths such as /products.')
        return value
