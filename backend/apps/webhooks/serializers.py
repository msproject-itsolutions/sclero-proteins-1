from rest_framework import serializers
from apps.webhooks.models import WebhookSubscription, WebhookDelivery
from apps.orders.models import WebhookEvent

class WebhookSubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebhookSubscription
        fields = ['id', 'name', 'url', 'secret', 'events', 'is_active', 'created_at', 'updated_at']
        extra_kwargs = {
            'secret': {'read_only': True}  # Secret is auto-generated on save
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
