from django.db import models
from django.utils import timezone
from apps.common.fields import EncryptedJSONField, EncryptedTextField

class Region(models.Model):
    code = models.CharField(max_length=10, unique=True, help_text="e.g. IN, UK")
    name = models.CharField(max_length=100)
    domain = models.CharField(max_length=255, db_index=True, help_text="e.g. scleroproteins.in")
    countries = models.JSONField(
        default=list,
        blank=True,
        help_text=(
            "ISO-2 country codes served by this region, e.g. [\"GB\", \"IE\"]. "
            "A visitor from one of these countries gets this region's currency, "
            "pricing and tax. Leave empty to serve no country automatically."
        ),
    )
    is_default = models.BooleanField(
        default=False,
        help_text=(
            "Fallback for visitors from countries not listed on any region. "
            "Only one region should be the default."
        ),
    )
    currency_code = models.CharField(max_length=10, default="INR")
    currency_symbol = models.CharField(max_length=5, default="₹")
    tax_name = models.CharField(max_length=50, default="GST", help_text="e.g. GST or VAT")
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=18.00)
    fx_rate = models.DecimalField(
        max_digits=14, decimal_places=6, default=1.0,
        help_text=(
            "How many units of this market's currency equal 1 unit of the base "
            "currency. Used only for products with no market-specific price."
        ),
    )
    auto_price_enabled = models.BooleanField(
        default=True,
        help_text=(
            "Convert base prices into this market's currency automatically. "
            "Turn off to sell only products that have an explicit price here."
        ),
    )
    PRICE_ROUNDING = [
        ('NONE', 'Exact (2 decimals)'),
        ('WHOLE', 'Nearest whole number'),
        ('CHARM_99', 'Round up to .99'),
    ]
    price_rounding = models.CharField(
        max_length=10, choices=PRICE_ROUNDING, default='NONE',
        help_text="How converted prices are tidied up before being shown.",
    )
    # --- Legal entity details, printed on invoices for this market ---------
    # Previously hardcoded in apps/orders/utils.py, which meant a developer had
    # to redeploy to correct a company address on a tax document.
    company_name = models.CharField(max_length=200, blank=True, default='')
    company_address = models.TextField(
        blank=True, default='', help_text="Printed on invoices. Line breaks are preserved.",
    )
    company_phone = models.CharField(
        max_length=200, blank=True, default='',
        help_text="Shown on invoices. Separate multiple numbers with commas.",
    )
    company_email = models.EmailField(blank=True, default='')
    tax_registration_label = models.CharField(
        max_length=50, blank=True, default='',
        help_text="e.g. 'GSTIN' or 'VAT Reg No'.",
    )
    tax_registration_number = models.CharField(max_length=100, blank=True, default='')
    extra_registrations = models.JSONField(
        default=list, blank=True,
        help_text=(
            "Additional legal lines for invoices, e.g. "
            "[{\"label\": \"FSSAI License No.\", \"value\": \"10725997000097\"}]"
        ),
    )

    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['domain', 'is_active']),
        ]

    def __str__(self):
        return f"{self.name} ({self.code})"


class Warehouse(models.Model):
    name = models.CharField(max_length=255)
    region = models.ForeignKey(Region, on_delete=models.CASCADE, related_name="warehouses")
    address = models.TextField()
    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} - {self.region.code}"


class ShippingZone(models.Model):
    region = models.ForeignKey(Region, on_delete=models.CASCADE, related_name="shipping_zones")
    name = models.CharField(max_length=100)
    countries = models.JSONField(default=list, help_text="List of ISO country codes in this zone")
    states = models.JSONField(default=list, blank=True, help_text="Optional state/region names this zone covers. Empty = whole country. Used for state-specific rates (e.g. remote-area surcharge).")
    cities = models.JSONField(default=list, blank=True, help_text="Optional city names covered by this zone")
    postal_ranges = models.JSONField(default=list, blank=True, help_text="Optional postal-code ranges or prefixes covered by this zone")
    description = models.TextField(blank=True, default='', help_text="Internal notes for staff")
    priority = models.PositiveIntegerField(default=0, help_text="Higher-priority zones are evaluated first when locations overlap")
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['region', 'is_active']),
        ]

    def __str__(self):
        return f"{self.name} ({self.region.code})"


class ShippingRate(models.Model):
    RATE_TYPES = [
        ('FLAT', 'Flat Rate'),
        ('WEIGHT', 'Weight Based'),
        ('PRICE', 'Cart Value Based'),
        ('QTY', 'Quantity Based'),
        ('FREE', 'Free Shipping'),
        ('CUSTOM', 'Custom Method'),
    ]
    zone = models.ForeignKey(ShippingZone, on_delete=models.CASCADE, related_name="rates")
    name = models.CharField(max_length=100)
    rate_type = models.CharField(max_length=20, choices=RATE_TYPES, default='FLAT')
    method = models.CharField(max_length=100, default='Standard Shipping', help_text="Shipping method shown to customers")
    description = models.TextField(blank=True, default='', help_text="Internal notes for staff")
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    per_unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Optional charge per kg or item above the minimum")
    handling_fee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Optional fixed handling charge")
    min_value = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True, help_text="Min weight (kg) / order value / quantity")
    max_value = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True, help_text="Max weight (kg) / order value / quantity")
    free_above = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Override: free shipping when cart exceeds this value")
    surcharge_postcodes = models.TextField(blank=True, default='', help_text="Comma-separated postcodes that attract a surcharge")
    surcharge_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Extra charge for matching remote-area postcodes")
    estimated_days = models.CharField(max_length=50, blank=True, default='', help_text="e.g. 3-5 days")
    priority = models.PositiveIntegerField(default=0, help_text="Display order at checkout; lower values appear first")
    is_active = models.BooleanField(default=True)

    class Meta:
        indexes = [
            models.Index(fields=['zone', 'rate_type']),
        ]

    def __str__(self):
        return f"{self.name} - {self.price} ({self.zone.name})"


class ShippingProvider(models.Model):
    """Region-scoped courier integration configured entirely by staff."""
    MODE_CHOICES = [('TEST', 'Test / Sandbox'), ('LIVE', 'Live')]
    STATUS_CHOICES = [
        ('NOT_TESTED', 'Not tested'),
        ('CONNECTED', 'Connected'),
        ('ERROR', 'Connection error'),
    ]

    code = models.CharField(max_length=40, db_index=True)
    display_name = models.CharField(max_length=100)
    region = models.ForeignKey(Region, on_delete=models.CASCADE, related_name='shipping_providers')
    is_enabled = models.BooleanField(default=False, db_index=True)
    mode = models.CharField(max_length=10, choices=MODE_CHOICES, default='TEST')
    credentials = EncryptedJSONField(default=dict, blank=True)
    configuration = models.JSONField(
        default=dict, blank=True,
        help_text='Non-secret provider settings such as account number, pickup location, and service codes.',
    )
    webhook_secret = EncryptedTextField(blank=True, default='')
    sort_order = models.PositiveIntegerField(default=0)
    connection_status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='NOT_TESTED')
    last_tested_at = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('code', 'region')
        ordering = ['region__code', 'sort_order', 'code']
        indexes = [models.Index(fields=['region', 'is_enabled'])]

    @property
    def is_configured(self):
        from .providers import SHIPPING_PROVIDER_CATALOG
        definition = SHIPPING_PROVIDER_CATALOG.get(self.code, {})
        required = definition.get('required_credentials', [])
        credentials = self.credentials or {}
        required_configuration = [
            field['key'] for field in definition.get('configuration_fields', [])
            if field.get('required')
        ]
        configuration = self.configuration or {}
        return (
            all(credentials.get(key) for key in required)
            and all(configuration.get(key) for key in required_configuration)
        )

    def mark_connection(self, ok, message=''):
        self.connection_status = 'CONNECTED' if ok else 'ERROR'
        self.last_tested_at = timezone.now()
        self.last_error = '' if ok else str(message)[:2000]
        self.save(update_fields=['connection_status', 'last_tested_at', 'last_error', 'updated_at'])

    def __str__(self):
        return f'{self.display_name} [{self.region.code}]'
