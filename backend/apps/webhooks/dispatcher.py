import hmac
import hashlib
import json
import logging
import requests
from django.utils import timezone
from datetime import timedelta

from apps.webhooks.security import validate_webhook_destination

logger = logging.getLogger(__name__)

# Backoff schedule: attempts 1 to 7 correspond to these delays
BACKOFFS = [
    timedelta(minutes=1),   # 1st retry
    timedelta(minutes=5),   # 2nd retry
    timedelta(minutes=15),  # 3rd retry
    timedelta(minutes=30),  # 4th retry
    timedelta(hours=1),     # 5th retry
    timedelta(hours=6),     # 6th retry
    timedelta(hours=24),    # 7th retry
]

def calculate_signature(payload_str, secret):
    """Calculate the HMAC-SHA256 signature of the payload string."""
    return hmac.new(
        secret.encode('utf-8'),
        payload_str.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

def dispatch_outgoing_webhook(event_type, payload):
    """
    Dispatch an outgoing webhook to all active subscriptions registered for this event.
    """
    from apps.webhooks.models import WebhookSubscription, WebhookDelivery

    # Database-agnostic JSON list query: load all active and filter in Python
    subscriptions = WebhookSubscription.objects.filter(is_active=True)
    matched_subs = []
    for sub in subscriptions:
        if isinstance(sub.events, list) and event_type in sub.events:
            matched_subs.append(sub)

    if not matched_subs:
        return

    for sub in matched_subs:
        # Create a delivery log in PENDING state
        delivery = WebhookDelivery.objects.create(
            subscription=sub,
            event_type=event_type,
            payload=payload,
            status='PENDING'
        )

        logger.info('Queued webhook delivery %s for %s', delivery.id, sub.url)

def send_delivery(delivery):
    """
    Synchronously execute HTTP POST request, verify response, and log details.
    Uses exponential backoff for scheduled retries on failure.
    """
    
    sub = delivery.subscription
    if not sub.is_active:
        delivery.status = 'DLQ'
        delivery.next_attempt_at = None
        delivery.error_message = 'Subscription was disabled before delivery.'
        delivery.save(update_fields=['status', 'next_attempt_at', 'error_message'])
        return

    if not sub.secret:
        # An undecryptable secret loads as ''. An HMAC keyed with '' can be
        # forged by anyone and the receiver would reject it, so do not send.
        logger.error('Webhook subscription %s has no usable signing secret; delivery %s not sent.',
                     sub.pk, delivery.id)
        delivery.status = 'DLQ'
        delivery.next_attempt_at = None
        delivery.error_message = 'Signing secret unavailable; delivery not sent.'
        delivery.save(update_fields=['status', 'next_attempt_at', 'error_message'])
        return

    delivery.attempts += 1
    delivery.last_attempt_at = timezone.now()
    
    payload_str = json.dumps(delivery.payload, separators=(',', ':'), sort_keys=True)
    signature = calculate_signature(payload_str, sub.secret)

    headers = {
        'Content-Type': 'application/json',
        'X-Sclero-Event': delivery.event_type,
        'X-Sclero-Delivery': str(delivery.id),
        'X-Sclero-Signature': signature,
        'User-Agent': 'Sclero-Webhook-Dispatcher/1.0'
    }

    try:
        validate_webhook_destination(sub.url, resolve_dns=True)
        response = requests.post(
            sub.url,
            data=payload_str,
            headers=headers,
            timeout=(3.05, 10),
            allow_redirects=False,
        )
        delivery.response_status = response.status_code
        delivery.response_body = response.text[:5000] # Truncate large responses to keep DB clean
        
        if 200 <= response.status_code < 300:
            delivery.status = 'SUCCESS'
            delivery.next_attempt_at = None
            delivery.error_message = ''
        else:
            raise requests.HTTPError(f"HTTP {response.status_code} returned.")
            
    except Exception as exc:
        # Keep the administrator-visible error bounded; full exception details
        # remain in application logs without storing arbitrary remote content.
        delivery.error_message = str(exc)[:2000]
        
        # Exponential backoff schedule
        if delivery.attempts >= 7:
            delivery.status = 'DLQ'
            delivery.next_attempt_at = None
        else:
            delivery.status = 'FAILED'
            delay = BACKOFFS[delivery.attempts - 1]
            delivery.next_attempt_at = timezone.now() + delay
            
    delivery.save(update_fields=[
        'attempts', 'last_attempt_at', 'status', 'response_status',
        'response_body', 'error_message', 'next_attempt_at'
    ])
