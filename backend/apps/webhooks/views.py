import threading
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone

from apps.users.permissions import require_permission
from apps.webhooks.models import WebhookSubscription, WebhookDelivery
from apps.orders.models import WebhookEvent
from apps.webhooks.serializers import (
    WebhookSubscriptionSerializer,
    WebhookDeliverySerializer,
    IncomingWebhookEventSerializer
)
from apps.webhooks.dispatcher import send_delivery_worker, send_delivery

class WebhookSubscriptionViewSet(viewsets.ModelViewSet):
    queryset = WebhookSubscription.objects.all().order_by('-created_at')
    serializer_class = WebhookSubscriptionSerializer
    permission_classes = [require_permission('settings.manage')]

    @action(detail=True, methods=['post'])
    def test_delivery(self, request, pk=None):
        """Sends a dummy 'ping' event to verify URL connection."""
        subscription = self.get_object()
        
        # Create a test delivery log
        delivery = WebhookDelivery.objects.create(
            subscription=subscription,
            event_type='ping',
            payload={
                'event': 'ping',
                'timestamp': timezone.now().isoformat(),
                'message': 'Sclero Proteins Webhook Verification Ping'
            },
            status='PENDING'
        )

        # Trigger it asynchronously
        thread = threading.Thread(
            target=send_delivery_worker,
            args=(delivery.id,)
        )
        thread.daemon = True
        thread.start()

        return Response({
            'status': 'queued',
            'delivery_id': delivery.id,
            'message': 'Test ping webhook event triggered successfully.'
        }, status=status.HTTP_202_ACCEPTED)


class WebhookDeliveryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = WebhookDelivery.objects.all().order_by('-created_at')
    serializer_class = WebhookDeliverySerializer
    permission_classes = [require_permission('settings.manage')]

    def get_queryset(self):
        qs = self.queryset
        subscription_id = self.request.query_params.get('subscription')
        if subscription_id:
            qs = qs.filter(subscription_id=subscription_id)
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param.upper())
        return qs

    @action(detail=True, methods=['post'])
    def retry(self, request, pk=None):
        """Manually trigger immediate retry of a failed delivery."""
        delivery = self.get_object()
        
        # Reset retry parameters
        delivery.status = 'PENDING'
        delivery.attempts = 0
        delivery.save()

        # Run immediately in background thread
        thread = threading.Thread(
            target=send_delivery_worker,
            args=(delivery.id,)
        )
        thread.daemon = True
        thread.start()

        return Response({
            'status': 'queued',
            'message': 'Webhook delivery queued for retry.'
        }, status=status.HTTP_202_ACCEPTED)


class IncomingWebhookEventViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = WebhookEvent.objects.all().order_by('-created_at')
    serializer_class = IncomingWebhookEventSerializer
    permission_classes = [require_permission('settings.manage')]

    def get_queryset(self):
        qs = self.queryset
        gateway = self.request.query_params.get('gateway')
        if gateway:
            qs = qs.filter(gateway=gateway.upper())
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param.upper())
        return qs

    @action(detail=True, methods=['post'])
    def retry(self, request, pk=None):
        """Manually trigger reprocessing of an incoming webhook event."""
        event = self.get_object()
        event.status = 'PENDING'
        event.attempts = 0
        event.next_attempt_at = None
        event.save()

        # Trigger processing using the process_webhooks command logic asynchronously
        from apps.orders.management.commands.process_webhooks import Command as WebhookProcessorCommand
        
        def run_reprocessing():
            cmd = WebhookProcessorCommand()
            cmd.process_event(event)

        thread = threading.Thread(target=run_reprocessing)
        thread.daemon = True
        thread.start()

        return Response({
            'status': 'processing',
            'message': 'Incoming webhook event is being reprocessed.'
        }, status=status.HTTP_202_ACCEPTED)
