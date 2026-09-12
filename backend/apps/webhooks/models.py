import uuid
import secrets
from django.db import models
from apps.common.fields import EncryptedTextField

class WebhookSubscription(models.Model):
    name = models.CharField(max_length=100)
    url = models.URLField(max_length=500, help_text="Destination URL for webhook events.")
    secret = EncryptedTextField(
        blank=True,
        help_text="Signing secret used to generate X-Sclero-Signature. Auto-generated if left blank."
    )
    events = models.JSONField(
        default=list,
        help_text="List of events to subscribe to, e.g. ['order.created', 'order.paid']"
    )
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.secret:
            self.secret = secrets.token_hex(24)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} - {self.url} ({'Active' if self.is_active else 'Inactive'})"


class WebhookDelivery(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
        ('DLQ', 'Dead Letter Queue'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subscription = models.ForeignKey(
        WebhookSubscription,
        on_delete=models.CASCADE,
        related_name='deliveries'
    )
    event_type = models.CharField(max_length=100, db_index=True)
    payload = models.JSONField(help_text="JSON payload sent in the webhook.")
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='PENDING',
        db_index=True
    )
    attempts = models.PositiveIntegerField(default=0)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    next_attempt_at = models.DateTimeField(null=True, blank=True, db_index=True)
    response_status = models.IntegerField(null=True, blank=True)
    response_body = models.TextField(blank=True, default='')
    error_message = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.event_type} to {self.subscription.name} ({self.status})"
