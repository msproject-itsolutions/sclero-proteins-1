from django.conf import settings
from django.db import models


class PageView(models.Model):
    """
    Lightweight page-view record used for funnel and traffic analytics.

    Privacy: no IP is persisted. Country is resolved once at write time
    (via apps.regions.geo.detect_country_from_request) and only the
    ISO-2 code is stored.
    """
    path = models.CharField(max_length=500, db_index=True)
    referrer = models.CharField(max_length=500, blank=True, default='')
    region_code = models.CharField(max_length=8, blank=True, default='', db_index=True)
    country = models.CharField(max_length=2, blank=True, default='')
    session_id = models.CharField(max_length=64, blank=True, default='', db_index=True)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='pageviews',
    )
    user_agent = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['path', 'created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"PV {self.path} @ {self.created_at:%Y-%m-%d %H:%M}"
