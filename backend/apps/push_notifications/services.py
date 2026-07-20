import json
import logging
from datetime import timedelta

from django.conf import settings
from django.db.models import Q
from django.utils import timezone
from pywebpush import WebPushException, webpush

from apps.webhooks.security import validate_webhook_destination

from .models import PushCampaign, PushDelivery, PushSubscription

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 5
PERMANENT_GONE_STATUSES = {404, 410}


def push_is_configured():
    return bool(settings.VAPID_PUBLIC_KEY and settings.VAPID_PRIVATE_KEY and settings.VAPID_SUBJECT)


def _start_due_campaigns(now):
    due_campaigns = PushCampaign.objects.filter(status='QUEUED').filter(
        Q(scheduled_for__isnull=True) | Q(scheduled_for__lte=now)
    )
    subscription_ids = list(
        PushSubscription.objects.filter(is_active=True).values_list('id', flat=True)
    )
    for campaign in due_campaigns:
        PushDelivery.objects.bulk_create(
            [PushDelivery(campaign=campaign, subscription_id=subscription_id) for subscription_id in subscription_ids],
            ignore_conflicts=True,
        )
        campaign.status = 'PROCESSING'
        campaign.started_at = campaign.started_at or now
        campaign.total_recipients = len(subscription_ids)
        campaign.save(update_fields=['status', 'started_at', 'total_recipients'])


def _deliver(delivery, now):
    subscription = delivery.subscription
    status_code = None
    try:
        validate_webhook_destination(subscription.endpoint)
        response = webpush(
            subscription_info={
                'endpoint': subscription.endpoint,
                'keys': {'p256dh': subscription.p256dh, 'auth': subscription.auth},
            },
            data=json.dumps({
                'title': delivery.campaign.title,
                'body': delivery.campaign.body,
                'targetUrl': delivery.campaign.target_url,
                'campaignId': delivery.campaign_id,
            }),
            vapid_private_key=settings.VAPID_PRIVATE_KEY,
            vapid_claims={'sub': settings.VAPID_SUBJECT},
            ttl=60 * 60 * 24,
            timeout=10,
        )
        status_code = getattr(response, 'status_code', 201)
        if status_code >= 400:
            raise WebPushException(f'Push service returned HTTP {status_code}', response=response)
        delivery.status = 'SENT'
        delivery.error_message = ''
        delivery.next_attempt_at = None
        subscription.failure_count = 0
        subscription.save(update_fields=['failure_count', 'updated_at'])
    except Exception as exc:
        if isinstance(exc, WebPushException) and getattr(exc, 'response', None) is not None:
            status_code = exc.response.status_code
        subscription.failure_count += 1
        delivery.error_message = f'{type(exc).__name__}: {exc}'[:1000]
        if status_code in PERMANENT_GONE_STATUSES:
            subscription.is_active = False
            delivery.status = 'DLQ'
            delivery.next_attempt_at = None
        elif delivery.attempts >= MAX_ATTEMPTS:
            delivery.status = 'DLQ'
            delivery.next_attempt_at = None
        else:
            delivery.status = 'FAILED'
            delivery.next_attempt_at = now + timedelta(minutes=min(60, 2 ** delivery.attempts))
        subscription.save(update_fields=['is_active', 'failure_count', 'updated_at'])
        logger.warning('Push delivery %s failed: %s', delivery.id, delivery.error_message)

    delivery.response_status = status_code
    delivery.last_attempt_at = now
    delivery.save(update_fields=[
        'status', 'attempts', 'next_attempt_at', 'last_attempt_at',
        'response_status', 'error_message',
    ])


def _finalize_campaigns(now):
    for campaign in PushCampaign.objects.filter(status='PROCESSING'):
        deliveries = campaign.deliveries
        sent = deliveries.filter(status='SENT').count()
        failed = deliveries.filter(status='DLQ').count()
        pending = deliveries.filter(status__in=['PENDING', 'FAILED']).exists()
        total = deliveries.count()
        campaign.total_recipients = total
        campaign.sent_count = sent
        campaign.failed_count = failed
        update_fields = ['total_recipients', 'sent_count', 'failed_count']
        if not pending:
            campaign.status = 'SENT' if failed == 0 else ('FAILED' if sent == 0 else 'PARTIAL')
            campaign.completed_at = now
            update_fields.extend(['status', 'completed_at'])
        campaign.save(update_fields=update_fields)


def process_push_batch(batch_size=100):
    """Start due campaigns and send a bounded batch with durable retries."""
    if not push_is_configured():
        return {'configured': False, 'processed': 0}

    now = timezone.now()
    _start_due_campaigns(now)
    due = PushDelivery.objects.select_related('campaign', 'subscription').filter(
        campaign__status='PROCESSING',
        subscription__is_active=True,
    ).filter(
        Q(status='PENDING') | Q(status='FAILED', next_attempt_at__lte=now)
    ).order_by('created_at')[:max(1, min(int(batch_size), 500))]

    processed = 0
    for delivery in due:
        delivery.attempts += 1
        _deliver(delivery, now)
        processed += 1
    _finalize_campaigns(now)
    return {'configured': True, 'processed': processed}
