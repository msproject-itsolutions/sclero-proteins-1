import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class PushSubscription(models.Model):
    """One browser/device Web Push destination."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='push_subscriptions',
    )
    client_id = models.UUIDField(default=uuid.uuid4, db_index=True)
    endpoint = models.URLField(max_length=2000, unique=True)
    p256dh = models.TextField()
    auth = models.TextField()
    user_agent = models.CharField(max_length=500, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    failure_count = models.PositiveSmallIntegerField(default=0)
    last_seen_at = models.DateTimeField(default=timezone.now)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        indexes = [models.Index(fields=['is_active', 'updated_at'])]

    def __str__(self):
        return f'{self.client_id} ({"active" if self.is_active else "inactive"})'


class PushCampaign(models.Model):
    STATUS_CHOICES = [
        ('QUEUED', 'Queued'),
        ('PROCESSING', 'Processing'),
        ('SENT', 'Sent'),
        ('PARTIAL', 'Partially sent'),
        ('FAILED', 'Failed'),
        ('CANCELLED', 'Cancelled'),
    ]

    title = models.CharField(max_length=80)
    body = models.CharField(max_length=240)
    target_url = models.CharField(max_length=500, default='/')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='QUEUED', db_index=True)
    scheduled_for = models.DateTimeField(null=True, blank=True, db_index=True)
    total_recipients = models.PositiveIntegerField(default=0)
    sent_count = models.PositiveIntegerField(default=0)
    failed_count = models.PositiveIntegerField(default=0)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='push_campaigns',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['status', 'scheduled_for'])]

    def __str__(self):
        return f'{self.title} ({self.status})'


class PushDelivery(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('SENT', 'Sent'),
        ('FAILED', 'Retrying'),
        ('DLQ', 'Dead letter queue'),
    ]

    campaign = models.ForeignKey(PushCampaign, on_delete=models.CASCADE, related_name='deliveries')
    subscription = models.ForeignKey(PushSubscription, on_delete=models.CASCADE, related_name='deliveries')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING', db_index=True)
    attempts = models.PositiveSmallIntegerField(default=0)
    next_attempt_at = models.DateTimeField(null=True, blank=True, db_index=True)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    response_status = models.PositiveSmallIntegerField(null=True, blank=True)
    error_message = models.CharField(max_length=1000, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['campaign', 'subscription'],
                name='unique_push_campaign_subscription',
            ),
        ]
        indexes = [models.Index(fields=['status', 'next_attempt_at'])]

    def __str__(self):
        return f'{self.campaign_id} → {self.subscription_id} ({self.status})'
