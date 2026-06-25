from django.conf import settings
from django.db import models


class FraudRule(models.Model):
    """Admin-tunable detection rule. Velocity / value / new-account heuristics.

    Thresholds are stored as plain integers — when a rule applies across regions
    with different currencies, prefer one rule per currency (e.g. "Order over
    £500" + "Order over ₹50000") rather than trying to FX-normalise here.
    """

    KIND_CHOICES = (
        ('ORDER_VELOCITY_PER_EMAIL', 'Order velocity per email'),
        ('ORDER_VELOCITY_PER_IP', 'Order velocity per IP'),
        ('HIGH_VALUE_ORDER', 'High value order'),
        ('NEW_EMAIL_HIGH_VALUE', 'New email high value'),
    )
    SEVERITY_CHOICES = (
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
    )
    ACTION_CHOICES = (
        ('FLAG', 'Flag for review'),
        ('HOLD', 'Hold order'),
    )

    name = models.CharField(max_length=200)
    kind = models.CharField(max_length=40, choices=KIND_CHOICES)
    threshold = models.PositiveIntegerField()
    window_minutes = models.PositiveIntegerField(default=60)
    severity = models.CharField(max_length=10, choices=SEVERITY_CHOICES, default='MEDIUM')
    action = models.CharField(max_length=10, choices=ACTION_CHOICES, default='FLAG')
    is_active = models.BooleanField(default=True, db_index=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.name


class OrderRiskAssessment(models.Model):
    """Outcome of running active FraudRule rows against a single order.

    One assessment per order (idempotent — re-runs `update_or_create`). The
    `signals` JSON is a list of {rule, severity, detail, threshold} dicts so the
    admin UI can render exactly why an order was flagged without re-evaluating.
    """

    LEVEL_CHOICES = (
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
        ('CRITICAL', 'Critical'),
    )
    DECISION_CHOICES = (
        ('', 'Pending'),
        ('APPROVE', 'Approve'),
        ('REJECT', 'Reject'),
    )

    order = models.OneToOneField(
        'orders.Order', related_name='risk', on_delete=models.CASCADE
    )
    score = models.PositiveIntegerField(default=0)
    level = models.CharField(max_length=10, choices=LEVEL_CHOICES, default='LOW', db_index=True)
    signals = models.JSONField(default=list)
    needs_review = models.BooleanField(default=False, db_index=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name='+',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    decision = models.CharField(max_length=10, choices=DECISION_CHOICES, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Risk #{self.order_id} {self.level} ({self.score})"
