from rest_framework import serializers
from apps.webhooks.models import WebhookSubscription, WebhookDelivery
from apps.orders.models import WebhookEvent
from apps.webhooks.security import validate_webhook_destination

class WebhookSubscriptionSerializer(serializers.ModelSerializer):
    signing_secret = serializers.SerializerMethodField()

    def get_signing_secret(self, obj):
        # The full secret is returned only once, immediately after creation.
        # List/retrieve responses expose a short fingerprint instead.
        view = self.context.get('view')
        if getattr(view, 'action', None) == 'create':
            return obj.secret
        return f'{obj.secret[:6]}…{obj.secret[-4:]}' if obj.secret else ''

    def validate_url(self, value):
        """Reject unsafe destinations before a subscription is stored."""
        validate_webhook_destination(value, resolve_dns=False)
        return value

    def validate_events(self, value):
        if not isinstance(value, list) or not value:
            raise serializers.ValidationError('Select at least one webhook event.')
        if len(value) > 50:
            raise serializers.ValidationError('A subscription may contain at most 50 events.')
        cleaned = []
        for event in value:
            if not isinstance(event, str) or not event.strip():
                raise serializers.ValidationError('Every event must be a non-empty string.')
            event = event.strip().lower()
            if len(event) > 100 or not all(c.isalnum() or c in '._-' for c in event):
                raise serializers.ValidationError(f'Invalid event name: {event!r}.')
            if event not in cleaned:
                cleaned.append(event)
        return cleaned

    class Meta:
        model = WebhookSubscription
        fields = [
            'id', 'name', 'url', 'secret', 'signing_secret', 'events',
            'is_active', 'created_at', 'updated_at',
        ]
        extra_kwargs = {
            'secret': {'write_only': True, 'required': False},
        }


class WebhookDeliverySerializer(serializers.ModelSerializer):
    subscription_name = serializers.CharField(source='subscription.name', read_only=True)

    class Meta:
        model = WebhookDelivery
        fields = [
            'id', 'subscription', 'subscription_name', 'event_type', 'payload',
            'status', 'attempts', 'last_attempt_at', 'next_attempt_at',
            'response_status', 'response_body', 'error_message', 'created_at'
        ]


class IncomingWebhookEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebhookEvent
        fields = [
            'id', 'gateway', 'event_id', 'event_type', 'payload',
            'status', 'attempts', 'last_attempt_at', 'next_attempt_at',
            'error_log', 'error_message', 'created_at'
        ]
