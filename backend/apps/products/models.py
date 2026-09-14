from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from apps.regions.models import Region


class Category(models.Model):
    """A browsable product grouping (e.g. Protein, Bone & Joint, Recovery).

    Drives the storefront filter facets and the navbar 'Shop by category' menu.
    """
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=120, unique=True, db_index=True)
    description = models.TextField(blank=True, default='')
    display_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True, db_index=True)
    image_url = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['display_order', 'name']
        verbose_name_plural = 'Categories'

    def __str__(self):
        return self.name


class Product(models.Model):
    sku = models.CharField(max_length=100, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    hsn_code = models.CharField(max_length=50, blank=True, null=True)
    description = models.TextField()
    benefits = models.TextField()
    ingredients = models.TextField()
    nutrition_facts = models.JSONField(default=dict, help_text="e.g. {'Protein': '25g', 'Carbs': '2g'}")
    faq = models.JSONField(default=list, help_text="List of objects: [{'q': '...', 'a': '...'}]")
    dietary_tags = models.JSONField(
        default=list, blank=True,
        help_text="List of dietary attribute slugs: vegan, vegetarian, gluten_free, dairy_free, sugar_free, halal, kosher, gmp_certified, lab_tested, non_gmo, third_party_tested",
    )
    short_benefit = models.CharField(
        max_length=120, blank=True, default='',
        help_text="One-line benefit shown on product cards (e.g. 'Joint care · 750mg per cap').",
    )
    categories = models.ManyToManyField(Category, related_name='products', blank=True)
    base_price = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
        help_text=(
            "Price in GBP (£) — the store's base currency. Markets with automatic "
            "pricing convert this using their exchange rate (the UK market's rate "
            "stays 1.0). A market-specific price always overrides it. Leave empty "
            "to sell only where a price is set explicitly."
        ),
    )
    is_active = models.BooleanField(default=True, db_index=True)
    is_archived = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['is_active', 'is_archived']),
            models.Index(fields=['is_active', 'is_archived', 'created_at']),
            models.Index(fields=['name']),
        ]

    def __str__(self):
        return f"{self.name} ({self.sku})"


class ProductVariant(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="variants")
    sku = models.CharField(max_length=100, unique=True, db_index=True)
    name = models.CharField(max_length=150, help_text="Variant label e.g. 1 kg, 5 kg, 25 kg, 60 Caps")
    option_name = models.CharField(max_length=100, default="Size", help_text="e.g. Weight, Size, Format")
    option_value = models.CharField(max_length=100, default="Standard")
    price_gbp = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    price_inr = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    stock_qty = models.PositiveIntegerField(default=100)
    is_active = models.BooleanField(default=True, db_index=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', 'id']
        indexes = [
            models.Index(fields=['product', 'is_active']),
            models.Index(fields=['sku']),
        ]

    def __str__(self):
        return f"{self.product.name} - {self.name} ({self.sku})"


class ProductRegionConfig(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="regional_configs")
    region = models.ForeignKey(Region, on_delete=models.CASCADE, related_name="product_configs")
    price = models.DecimalField(max_digits=10, decimal_places=2, help_text="Fixed price in regional currency")
    promotional_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_visible = models.BooleanField(default=True, db_index=True)

    class Meta:
        unique_together = ('product', 'region')
        indexes = [
            models.Index(fields=['region', 'is_visible']),
        ]

    def __str__(self):
        return f"{self.product.name} in {self.region.code} - {self.price}"


class ProductMedia(models.Model):
    MEDIA_TYPES = [
        ('IMAGE', 'Image'),
        ('VIDEO', 'Video'),
        ('PDF', 'PDF/Certificate'),
    ]
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="media")
    file_url = models.TextField(help_text="S3 / Cloudflare R2 absolute URL or local path")
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPES, default='IMAGE')
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['display_order']
        indexes = [
            models.Index(fields=['product', 'media_type']),
        ]

    def __str__(self):
        return f"{self.media_type} for {self.product.sku}"


class ProductReview(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="reviews", null=True, blank=True)
    user_email = models.EmailField(db_index=True)
    user_name = models.CharField(max_length=255)
    review_title = models.CharField(max_length=255, blank=True, default='')
    rating = models.PositiveIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField()
    is_verified_purchase = models.BooleanField(default=False)
    is_approved = models.BooleanField(default=False, db_index=True)
    is_featured = models.BooleanField(default=False, db_index=True)
    source = models.CharField(max_length=50, blank=True, default='DIRECT', help_text="e.g. DIRECT, TRUSTPILOT, GOOGLE")
    review_media_urls = models.JSONField(default=list, blank=True, help_text="List of review image/video URLs")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['product', 'is_approved']),
            models.Index(fields=['product', 'is_featured', 'is_approved']),
            models.Index(fields=['is_approved', 'created_at']),
            models.Index(fields=['is_featured', 'is_approved', 'created_at']),
        ]

    def __str__(self):
        target = self.product.name if self.product else "Brand / Store"
        return f"{self.rating} stars on {target} by {self.user_name or self.user_email}"


class Bundle(models.Model):
    """A curated bundle of products sold at a combined (usually discounted) price.

    .. deprecated:: 2026-06-24
        Storefront-facing bundles have been retired in favour of Collections.
        The model + admin CRUD are retained so historical/legacy bundle data
        is not lost, but the public ``/api/bundles/`` endpoint has been
        removed and there is no storefront page. New merchandising should
        use Collections instead.

    Region-specific pricing lives on BundleRegionConfig, mirroring the
    Product / ProductRegionConfig pattern so a bundle can have distinct
    prices and visibility per market.
    """
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True, db_index=True)
    description = models.TextField(blank=True, default='')
    is_active = models.BooleanField(default=True, db_index=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['sort_order', '-created_at']

    def __str__(self):
        return self.name


class BundleItem(models.Model):
    bundle = models.ForeignKey(Bundle, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='bundle_items')
    quantity = models.PositiveIntegerField(default=1)

    class Meta:
        unique_together = ('bundle', 'product')

    def __str__(self):
        return f"{self.quantity} x {self.product.sku} in {self.bundle.name}"


class BundleRegionConfig(models.Model):
    bundle = models.ForeignKey(Bundle, on_delete=models.CASCADE, related_name='regional_configs')
    region = models.ForeignKey(Region, on_delete=models.CASCADE, related_name='bundle_configs')
    price = models.DecimalField(max_digits=10, decimal_places=2)
    promotional_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_visible = models.BooleanField(default=True, db_index=True)

    class Meta:
        unique_together = ('bundle', 'region')
        indexes = [
            models.Index(fields=['region', 'is_visible']),
        ]

    def __str__(self):
        return f"{self.bundle.name} in {self.region.code} - {self.price}"


class ProductLandingPage(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="landing_pages")
    slug = models.SlugField(max_length=150, unique=True, db_index=True)
    template_style = models.CharField(max_length=30, default='bold', help_text="minimal, bold, sporty, clinical")
    custom_branding = models.JSONField(default=dict, blank=True, help_text="Theme settings: primary_color, logo_url, custom_css")
    is_published = models.BooleanField(default=False, db_index=True)
    seo_meta = models.JSONField(default=dict, blank=True, help_text="SEO values: title, description, keywords")
    dynamic_feed_sync = models.BooleanField(default=True)
    visits_count = models.PositiveIntegerField(default=0)
    conversions_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.product.name} Landing Page (/{self.slug})"
