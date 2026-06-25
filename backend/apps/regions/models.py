from django.db import models

class Region(models.Model):
    code = models.CharField(max_length=10, unique=True, help_text="e.g. IN, UK")
    name = models.CharField(max_length=100)
    domain = models.CharField(max_length=255, db_index=True, help_text="e.g. scleroproteins.in")
    currency_code = models.CharField(max_length=10, default="INR")
    currency_symbol = models.CharField(max_length=5, default="₹")
    tax_name = models.CharField(max_length=50, default="GST", help_text="e.g. GST or VAT")
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=18.00)
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
        ('FREE', 'Free Shipping'),
    ]
    zone = models.ForeignKey(ShippingZone, on_delete=models.CASCADE, related_name="rates")
    name = models.CharField(max_length=100)
    rate_type = models.CharField(max_length=20, choices=RATE_TYPES, default='FLAT')
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    min_value = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text="Minimum order value / weight")
    max_value = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text="Maximum order value / weight")

    class Meta:
        indexes = [
            models.Index(fields=['zone', 'rate_type']),
        ]

    def __str__(self):
        return f"{self.name} - {self.price} ({self.zone.name})"
