from django.db import models
from django.conf import settings


class AuditLog(models.Model):
    """An immutable record of a security- or business-relevant action.

    Written by signals (model changes) and explicit calls (auth events).
    Never edited or deleted through the API — read-only audit trail.
    """
    # Who
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='audit_logs',
    )
    actor_email = models.EmailField(blank=True, default='', db_index=True,
                                    help_text='Denormalized so the trail survives user deletion.')

    # What
    action = models.CharField(max_length=80, db_index=True,
                              help_text="e.g. 'login.success', 'product.updated', 'refund.issued'")
    target_type = models.CharField(max_length=80, blank=True, default='', db_index=True)
    target_id = models.CharField(max_length=64, blank=True, default='')
    summary = models.CharField(max_length=255, blank=True, default='')
    changes = models.JSONField(default=dict, blank=True,
                               help_text='Structured detail / before-after diff.')

    # Where
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=300, blank=True, default='')

    # When
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['action', 'created_at']),
            models.Index(fields=['target_type', 'target_id']),
        ]

    def __str__(self):
        who = self.actor_email or 'system'
        return f'[{self.created_at:%Y-%m-%d %H:%M}] {who} {self.action} {self.target_type}#{self.target_id}'
