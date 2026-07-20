from django.conf import settings
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.permissions import require_permission

from .models import PushCampaign, PushSubscription
from .serializers import PushCampaignSerializer, PushSubscriptionSerializer
from .services import push_is_configured


class PushConfigurationView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({
            'enabled': push_is_configured(),
            'public_key': settings.VAPID_PUBLIC_KEY if push_is_configured() else '',
        })


class PushSubscriptionView(APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'push'

    def post(self, request):
        serializer = PushSubscriptionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        client_id = data['client_id']
        endpoint = data['endpoint']
        previous_endpoint = data.get('previous_endpoint')
        if previous_endpoint and previous_endpoint != endpoint:
            PushSubscription.objects.filter(endpoint=previous_endpoint).update(is_active=False)
        PushSubscription.objects.filter(client_id=client_id).exclude(endpoint=endpoint).update(is_active=False)
        subscription, _ = PushSubscription.objects.update_or_create(
            endpoint=endpoint,
            defaults={
                'client_id': client_id,
                'p256dh': data['keys']['p256dh'],
                'auth': data['keys']['auth'],
                'user': request.user if request.user.is_authenticated else None,
                'user_agent': request.headers.get('User-Agent', '')[:500],
                'is_active': True,
                'failure_count': 0,
                'last_seen_at': timezone.now(),
            },
        )
        return Response({'subscribed': True, 'id': subscription.id}, status=status.HTTP_200_OK)

    def delete(self, request):
        endpoint = str(request.data.get('endpoint', '')).strip()
        client_id = str(request.data.get('client_id', '')).strip()
        if not endpoint and not client_id:
            return Response({'detail': 'Provide the browser subscription to disable.'}, status=status.HTTP_400_BAD_REQUEST)
        query = PushSubscription.objects.all()
        query = query.filter(endpoint=endpoint) if endpoint else query.filter(client_id=client_id)
        updated = query.update(is_active=False, last_seen_at=timezone.now())
        return Response({'subscribed': False, 'updated': updated})


class PushCampaignViewSet(viewsets.ModelViewSet):
    queryset = PushCampaign.objects.select_related('created_by').all()
    serializer_class = PushCampaignSerializer
    permission_classes = [require_permission('marketing.edit')]
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, status='QUEUED')

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        campaign = self.get_object()
        if campaign.status not in {'QUEUED', 'PROCESSING'}:
            return Response({'detail': 'Only queued or processing campaigns can be cancelled.'}, status=400)
        campaign.status = 'CANCELLED'
        campaign.completed_at = timezone.now()
        campaign.save(update_fields=['status', 'completed_at'])
        return Response(self.get_serializer(campaign).data)
