import hmac
import hashlib
import json
import logging
import threading
import requests
from django.utils import timezone
from datetime import timedelta

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

        # Trigger delivery asynchronously in a background thread to avoid blocking request thread
        thread = threading.Thread(
            target=send_delivery_worker,
            args=(delivery.id,)
        )
        thread.daemon = True
        thread.start()

def send_delivery_worker(delivery_id):
    """Thread wrapper to fetch delivery and invoke send_delivery."""
    from apps.webhooks.models import WebhookDelivery
    try:
        delivery = WebhookDelivery.objects.get(pk=delivery_id)
        send_delivery(delivery)
    except WebhookDelivery.DoesNotExist:
        logger.error(f"WebhookDelivery {delivery_id} not found in background thread.")
    except Exception as e:
        logger.exception(f"Unhandled exception in webhook delivery worker: {e}")

def send_delivery(delivery):
    """
    Synchronously execute HTTP POST request, verify response, and log details.
    Uses exponential backoff for scheduled retries on failure.
    """
    from apps.webhooks.models import WebhookDelivery
    
    delivery.attempts += 1
    delivery.last_attempt_at = timezone.now()
    sub = delivery.subscription
    
    payload_str = json.dumps(delivery.payload)
    signature = calculate_signature(payload_str, sub.secret)

    headers = {
        'Content-Type': 'application/json',
        'X-Sclero-Event': delivery.event_type,
        'X-Sclero-Delivery': str(delivery.id),
        'X-Sclero-Signature': signature,
        'User-Agent': 'Sclero-Webhook-Dispatcher/1.0'
    }

    try:
        response = requests.post(
            sub.url,
            data=payload_str,
            headers=headers,
            timeout=10
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
        delivery.error_message = str(exc)
        
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
