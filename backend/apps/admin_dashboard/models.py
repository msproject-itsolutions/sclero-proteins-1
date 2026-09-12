from django.core.validators import RegexValidator
from django.db import models
from django.conf import settings
from django.utils import timezone
from apps.regions.models import Region
from apps.common.fields import EncryptedJSONField, EncryptedTextField, SensitiveKeysJSONField

# Colors are rendered as inline styles on the storefront, so only strict hex
# values may be stored — never arbitrary CSS.
HEX_COLOR_VALIDATOR = RegexValidator(
    regex=r'^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$',
    message='Enter a hex color such as #1E083B.',
)


def hex_color_field(help_text):
    """Optional hex color; blank means "use the brand default"."""
    return models.CharField(
        max_length=7, blank=True, default='',
        validators=[HEX_COLOR_VALIDATOR], help_text=help_text,
    )

class FeatureToggle(models.Model):
    module_name = models.CharField(max_length=100, db_index=True)
    is_enabled = models.BooleanField(default=True, db_index=True)
    region = models.ForeignKey(Region, on_delete=models.CASCADE, null=True, blank=True, related_name="feature_toggles")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('module_name', 'region')
        indexes = [
            models.Index(fields=['region', 'is_enabled']),
        ]

    def __str__(self):
        region_str = self.region.code if self.region else "Global"
        status_str = "Enabled" if self.is_enabled else "Disabled"
        return f"{self.module_name} ({region_str}): {status_str}"


class SystemSetting(models.Model):
    key = models.CharField(max_length=100, unique=True, db_index=True, help_text="e.g. SMTP_SETTINGS, GOOGLE_AUTH_CREDENTIALS, WHATSAPP_API")
    value = SensitiveKeysJSONField(default=dict, help_text="Configuration values stored as JSON; secret values are encrypted at rest")
    description = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.key


class InstagramReelsConnection(models.Model):
    """Singleton-style Meta connection used only to retrieve the brand's Reels."""
    instagram_user_id = models.CharField(max_length=64, blank=True, default='')
    access_token = EncryptedTextField(blank=True, default='')
    is_enabled = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Instagram Reels connection'
        verbose_name_plural = 'Instagram Reels connection'


class HeroBannerSlide(models.Model):
    MEDIA_TYPES = [
        ('IMAGE', 'Image'),
        ('VIDEO', 'Video'),
    ]
    TEXT_POSITIONS = [
        ('LEFT', 'Left'),
        ('CENTER', 'Center'),
        ('RIGHT', 'Right'),
    ]

    VERTICAL_POSITIONS = [
        ('TOP', 'Top'),
        ('CENTER', 'Center'),
        ('BOTTOM', 'Bottom'),
    ]
    ARROW_POSITIONS = [
        ('BOTTOM', 'Bottom Bar'),
        ('SIDES', 'Centered on Both Sides'),
        ('HIDDEN', 'Hidden'),
    ]

    title = models.CharField(max_length=120, help_text="Internal admin title for this banner slide")
    eyebrow = models.CharField(max_length=120, blank=True, default='')
    heading = models.CharField(max_length=180)
    subheading = models.TextField(blank=True, default='')
    desktop_media_url = models.URLField(max_length=800, blank=True, default='')
    tablet_media_url = models.URLField(max_length=800, blank=True, default='')
    mobile_media_url = models.URLField(max_length=800, blank=True, default='')
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPES, default='IMAGE')
    alt_text = models.CharField(max_length=255, blank=True, default='')
    primary_cta_label = models.CharField(max_length=80, blank=True, default='')
    primary_cta_url = models.CharField(max_length=500, blank=True, default='')
    secondary_cta_label = models.CharField(max_length=80, blank=True, default='')
    secondary_cta_url = models.CharField(max_length=500, blank=True, default='')
    text_position = models.CharField(max_length=10, choices=TEXT_POSITIONS, default='LEFT')
    vertical_position = models.CharField(max_length=10, choices=VERTICAL_POSITIONS, default='BOTTOM')
    arrow_position = models.CharField(max_length=10, choices=ARROW_POSITIONS, default='BOTTOM')
    overlay_opacity = models.PositiveSmallIntegerField(default=42, help_text="Dark overlay percentage from 0 to 90")
    # --- Per-slide theme colors, managed from the admin panel ---------------
    # Blank = inherit the storefront's brand default, so existing slides keep
    # their current look and admins can always reset a slide to brand styling.
    overlay_color_start = hex_color_field("Left color of the legibility overlay gradient")
    overlay_color_mid = hex_color_field("Middle color of the legibility overlay gradient")
    overlay_color_end = hex_color_field("Right color of the legibility overlay gradient")
    eyebrow_color = hex_color_field("Eyebrow text color")
    heading_color = hex_color_field("Heading text color (replaces the brand gradient when set)")
    subheading_color = hex_color_field("Subheading text color")
    primary_cta_bg_color = hex_color_field("Primary button background color")
    primary_cta_text_color = hex_color_field("Primary button text color")
    secondary_cta_bg_color = hex_color_field("Secondary button background color")
    secondary_cta_text_color = hex_color_field("Secondary button text color")
    accent_color = hex_color_field("Accent color for the active carousel indicator")
    sort_order = models.PositiveIntegerField(default=0, db_index=True)
    is_enabled = models.BooleanField(default=True, db_index=True)
    starts_at = models.DateTimeField(null=True, blank=True)
    ends_at = models.DateTimeField(null=True, blank=True)
    autoplay_enabled = models.BooleanField(default=True)
    show_indicators = models.BooleanField(default=True)
    display_duration_ms = models.PositiveIntegerField(default=6500)
    transition_ms = models.PositiveIntegerField(default=500)
    seo_title = models.CharField(max_length=160, blank=True, default='')
    seo_description = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', '-updated_at']
        indexes = [
            models.Index(fields=['is_enabled', 'starts_at', 'ends_at']),
            models.Index(fields=['sort_order', 'is_enabled']),
        ]

    def __str__(self):
        return self.title


class PaymentGateway(models.Model):
    """
    Admin-configurable payment gateway (Shopify-style).

    Each row enables a gateway for a specific region, so checkout can route
    "smartly": Razorpay/COD for India, Stripe/PayPal for the UK, etc. Staff
    toggle gateways and paste their API keys from the admin panel — no code
    changes or redeploys needed.
    """
    GATEWAY_CHOICES = [
        ('RAZORPAY', 'Razorpay'),
        ('STRIPE', 'Stripe'),
        ('PAYPAL', 'PayPal'),
        ('COD', 'Cash on Delivery'),
    ]
    MODE_CHOICES = [
        ('TEST', 'Test / Sandbox'),
        ('LIVE', 'Live'),
    ]
    VERIFICATION_STATUS_CHOICES = [
        ('PENDING_VERIFICATION', 'Pending verification'),
        ('CONNECTED', 'Connected'),
        ('CONNECTION_FAILED', 'Connection failed'),
        ('CONFIGURATION_ERROR', 'Configuration error'),
    ]

    code = models.CharField(max_length=20, choices=GATEWAY_CHOICES, db_index=True)
    display_name = models.CharField(max_length=100, help_text="Label shown to customers at checkout")
    region = models.ForeignKey(Region, on_delete=models.CASCADE, related_name="payment_gateways")
    is_enabled = models.BooleanField(default=False, db_index=True)
    mode = models.CharField(max_length=10, choices=MODE_CHOICES, default='TEST')

    # Credentials — managed from the admin panel.
    publishable_key = models.CharField(
        max_length=255, blank=True,
        help_text="Client-side / publishable key (e.g. Razorpay key_id, Stripe pk_*). Safe to expose to the browser.",
    )
    secret_key = EncryptedTextField(
        blank=True,
        help_text="Server-side secret. NEVER exposed to the storefront.",
    )
    extra_config = EncryptedJSONField(
        default=dict, blank=True,
        help_text="Additional config: webhook secret, PayPal merchant id, etc. Server-side only.",
    )

    supports_refunds = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0, help_text="Display order at checkout (lower first)")
    verification_status = models.CharField(
        max_length=30, choices=VERIFICATION_STATUS_CHOICES,
        default='PENDING_VERIFICATION', db_index=True,
    )
    verification_message = models.TextField(blank=True, default='')
    last_verified_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('code', 'region')
        ordering = ['sort_order', 'code']
        indexes = [
            models.Index(fields=['region', 'is_enabled']),
        ]

    @property
    def is_configured(self):
        """COD needs no keys; online gateways need at least a secret key."""
        if self.code == 'COD':
            return True
        return bool(self.secret_key)

    def __str__(self):
        state = "ON" if self.is_enabled else "off"
        return f"{self.display_name} [{self.region.code}] ({state}/{self.mode})"

    def mark_verification(self, ok, message='', configuration_error=False):
        self.verification_status = (
            'CONNECTED' if ok else ('CONFIGURATION_ERROR' if configuration_error else 'CONNECTION_FAILED')
        )
        self.verification_message = str(message)[:2000]
        self.last_verified_at = timezone.now()
        if not ok:
            self.is_enabled = False
        self.save(update_fields=[
            'verification_status', 'verification_message', 'last_verified_at',
            'is_enabled', 'updated_at',
        ])


class EmailTemplate(models.Model):
    """Region-specific transactional email template.

    Lets staff edit order-confirmation, payment-failed, shipment-dispatch copy
    per region (e.g. a GST-compliant invoice note for India, a VAT receipt note
    for the UK) without code changes. A null region is the global fallback.
    Bodies support {placeholders} substituted at send time.
    """
    EVENT_CHOICES = [
        ('order_confirmation', 'Order confirmation'),
        ('payment_failed', 'Payment failed'),
        ('shipment_dispatched', 'Shipment dispatched'),
        ('refund_processed', 'Refund processed'),
        ('welcome', 'Welcome / account created'),
        ('order_shipped', 'Order shipped'),
        ('order_delivered', 'Order delivered'),
        ('order_cancelled', 'Order cancelled'),
        ('password_reset', 'Password reset'),
        ('contact_received', 'Contact form received'),
    ]
    event = models.CharField(max_length=40, choices=EVENT_CHOICES, db_index=True)
    region = models.ForeignKey(
        Region, on_delete=models.CASCADE, null=True, blank=True,
        related_name='email_templates', help_text='Leave blank for a global fallback template.',
    )
    subject = models.CharField(max_length=255)
    body = models.TextField(help_text="Supports placeholders like {customer_name}, {order_id}, {total}, {tax_name}.")
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('event', 'region')
        ordering = ['event', 'region__code']

    def __str__(self):
        return f"{self.get_event_display()} [{self.region.code if self.region else 'GLOBAL'}]"


class MarketingIntegration(models.Model):
    INTEGRATION_CHANNELS = [
        ('GOOGLE_MERCHANT', 'Google Merchant Center'),
        ('GOOGLE_ADS', 'Google Ads'),
        ('GOOGLE_ANALYTICS', 'Google Analytics'),
        ('GOOGLE_TAG_MANAGER', 'Google Tag Manager'),
        ('FACEBOOK_BUSINESS', 'Facebook Business Manager'),
        ('FACEBOOK_ADS', 'Facebook & Instagram Ads'),
        ('META_PIXEL', 'Meta Pixels and Conversion APIs'),
        ('YOUTUBE_ADS', 'YouTube Channels & Advertising Accounts'),
        ('PRODUCT_CATALOG', 'Product Catalogs & Feeds'),
        ('CREATIVE_STUDIO', 'Creative Studios and Content Assets'),
        ('THIRD_PARTY', 'Third-party marketing and analytics tools'),
    ]
    name = models.CharField(max_length=100)
    channel = models.CharField(max_length=40, choices=INTEGRATION_CHANNELS, unique=True, db_index=True)
    is_connected = models.BooleanField(default=False, db_index=True)
    credentials = SensitiveKeysJSONField(default=dict, blank=True, help_text="Store client_id, secret, tokens, pixel_id, etc.; secret values are encrypted at rest")
    sync_status = models.CharField(max_length=20, default='DISCONNECTED', help_text="CONNECTED, FAILED, SYNCING, DISCONNECTED")
    last_sync = models.DateTimeField(null=True, blank=True)
    metrics = models.JSONField(default=dict, blank=True, help_text="Campaign metrics: spend, impressions, clicks, conversions")
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} - {'Connected' if self.is_connected else 'Disconnected'}"


class ContentPage(models.Model):
    PAGE_TYPES = [
        ('LANDING', 'Landing Page'),
        ('PROMO', 'Promotional Page'),
        ('STANDARD', 'Standard Page'),
    ]
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=150, unique=True, db_index=True)
    content = models.TextField(help_text="HTML / Markdown or JSON layout content")
    page_type = models.CharField(max_length=15, choices=PAGE_TYPES, default='STANDARD')
    template_layout = models.JSONField(default=dict, blank=True, help_text="Custom styles, sections, design layouts")
    is_published = models.BooleanField(default=False, db_index=True)
    meta_title = models.CharField(max_length=255, blank=True, default='')
    meta_description = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class BlogPost(models.Model):
    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=150, unique=True, db_index=True)
    content = models.TextField()
    author = models.CharField(max_length=100, default='Admin')
    category = models.CharField(max_length=100, blank=True, default='Biotech')
    cover_image_url = models.URLField(max_length=500, blank=True, null=True)
    is_published = models.BooleanField(default=False, db_index=True)
    published_at = models.DateTimeField(null=True, blank=True)
    meta_title = models.CharField(max_length=255, blank=True, default='')
    meta_description = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class ApprovalRequest(models.Model):
    REQUEST_TYPES = [
        ('PRODUCT', 'Product changes'),
        ('CONTENT', 'Content Publishing'),
        ('REFUND', 'Refund Transaction'),
        ('DISCOUNT', 'Discount creation'),
        ('ERASURE', 'Erasure request'),
    ]
    STATUS_CHOICES = [
        ('PENDING', 'Pending Approval'),
        ('APPROVED', 'Approved & Executed'),
        ('REJECTED', 'Rejected'),
    ]

    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='requested_approvals'
    )
    approver = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_requests'
    )
    request_type = models.CharField(max_length=15, choices=REQUEST_TYPES)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='PENDING', db_index=True)
    summary = models.CharField(max_length=255, help_text="Summary of action, e.g. 'Refund of £120.00 for order #4'")
    details = models.JSONField(default=dict, blank=True, help_text="Detailed info on variables (e.g. refund amount, discount percent)")
    payload = models.JSONField(default=dict, blank=True, help_text="Action payload to commit when approved")
    
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_request_type_display()} - {self.status} ({self.summary})"
