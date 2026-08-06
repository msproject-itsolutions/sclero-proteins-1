import uuid
from django.db import models
from django.conf import settings
from apps.regions.models import Region
from apps.products.models import Product

class Cart(models.Model):
    RECOVERY_STATUS = [
        ('NOT_CONTACTED', 'Not contacted'),
        ('CONTACTED', 'Contacted'),
        ('RECOVERED', 'Recovered'),
        ('DISMISSED', 'Dismissed'),
    ]
    session_id = models.CharField(max_length=255, unique=True, db_index=True)
    region = models.ForeignKey(Region, on_delete=models.CASCADE, related_name="carts")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="carts")
    recovery_status = models.CharField(max_length=20, choices=RECOVERY_STATUS, default='NOT_CONTACTED', db_index=True)
    recovery_attempts = models.PositiveIntegerField(default=0)
    last_recovery_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'region']),
        ]

    def __str__(self):
        return f"Cart {self.session_id[:8]} ({self.region.code})"


class CartItem(models.Model):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    # Store the SKU rather than a foreign key. Administrators may replace a
    # product's variant rows while editing it; keeping the SKU makes an open
    # cart stable and lets checkout fail clearly if that option was retired.
    variant_sku = models.CharField(max_length=100, blank=True, default='')
    variant_name = models.CharField(max_length=150, blank=True, default='')
    quantity = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['cart', 'product', 'variant_sku'],
                name='unique_cart_product_variant',
            ),
        ]

    def __str__(self):
        return f"{self.quantity} x {self.product.name} in Cart {self.cart.id}"


class Order(models.Model):
    ORDER_STATUS = [
        ('PENDING', 'Pending'),
        ('PROCESSING', 'Processing'),
        ('SHIPPED', 'Shipped'),
        ('DELIVERED', 'Delivered'),
        ('COMPLETED', 'Completed'),
        ('CANCELLED', 'Cancelled'),
        ('REFUNDED', 'Refunded'),
    ]
    PAYMENT_STATUS = [
        ('PENDING', 'Pending'),
        ('AUTHORIZED', 'Authorized'),
        ('PARTIALLY_CAPTURED', 'Partially captured'),
        ('PAID', 'Paid'),
        ('FAILED', 'Failed'),
        ('REFUNDED', 'Refunded'),
    ]
    CAPTURE_MODE = [
        ('AUTO', 'Automatic capture'),
        ('MANUAL', 'Manual capture'),
    ]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="orders")
    region = models.ForeignKey(Region, on_delete=models.PROTECT, related_name="orders")
    status = models.CharField(max_length=20, choices=ORDER_STATUS, default='PENDING', db_index=True)
    # Set when the order first reaches DELIVERED. `updated_at` can't be used to
    # time the review request — any later edit would move the goalposts.
    delivered_at = models.DateTimeField(null=True, blank=True, db_index=True)
    review_request_sent_at = models.DateTimeField(
        null=True, blank=True,
        help_text="Stamped when the review request goes out, so it is only ever sent once.",
    )
    
    # Customer Info at the time of purchase
    email = models.EmailField(db_index=True)
    shipping_name = models.CharField(max_length=255)
    shipping_phone = models.CharField(max_length=30)
    shipping_address_line1 = models.CharField(max_length=255)
    shipping_address_line2 = models.CharField(max_length=255, blank=True)
    shipping_city = models.CharField(max_length=100)
    shipping_state = models.CharField(max_length=100)
    shipping_postal_code = models.CharField(max_length=20)
    shipping_country = models.CharField(max_length=10)

    # Pricing & Totals
    currency_code = models.CharField(max_length=10)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, help_text="Tax rate at checkout")
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2)
    shipping_cost = models.DecimalField(max_digits=12, decimal_places=2)
    shipping_method = models.CharField(max_length=100, blank=True, default='Standard Shipping')
    shipping_rate_name = models.CharField(max_length=100, blank=True, default='')
    shipping_estimated_days = models.CharField(max_length=50, blank=True, default='')
    shipping_carrier = models.CharField(max_length=100, blank=True, default='')
    tracking_number = models.CharField(max_length=255, blank=True, default='')
    tracking_url = models.CharField(max_length=500, blank=True, default='')
    staff_notes = models.TextField(blank=True, default='')
    coupon_code = models.CharField(max_length=50, blank=True, null=True)
    discount_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    total = models.DecimalField(max_digits=12, decimal_places=2)

    # Payment info
    payment_method = models.CharField(max_length=50) # Stripe, Razorpay, PayPal
    payment_id = models.CharField(max_length=255, blank=True, null=True, db_index=True)
    # Defaults to PENDING: an order must never be born "paid". Checkout flips
    # this explicitly only after the gateway confirms the charge — a PAID
    # default made the order.paid webhook fire before payment verification.
    payment_status = models.CharField(max_length=30, choices=PAYMENT_STATUS, default='PENDING', db_index=True)
    payment_capture_mode = models.CharField(max_length=20, choices=CAPTURE_MODE, default='AUTO')
    payment_authorized_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_captured_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['region', 'status']),
            models.Index(fields=['user', 'status']),
        ]

    def __str__(self):
        return f"Order #{self.id} ({self.region.code})"


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT)
    # Immutable variant snapshots keep invoices and order history accurate
    # even if the catalogue option is renamed or removed later.
    variant_sku = models.CharField(max_length=100, blank=True, default='')
    variant_name = models.CharField(max_length=150, blank=True, default='')
    quantity = models.PositiveIntegerField()
    price = models.DecimalField(max_digits=12, decimal_places=2, help_text="Unit price paid")
    tax_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, help_text="Total tax on these items")

    def __str__(self):
        return f"{self.quantity} x {self.product.name} in Order #{self.order.id}"


class Invoice(models.Model):
    INVOICE_TYPES = [
        ('GST_INVOICE', 'GST Tax Invoice'),
        ('VAT_RECEIPT', 'VAT Receipt'),
    ]
    order = models.OneToOneField(Order, on_delete=models.CASCADE, related_name="invoice")
    invoice_number = models.CharField(max_length=100, unique=True, db_index=True)
    invoice_type = models.CharField(max_length=20, choices=INVOICE_TYPES)
    pdf_file = models.FileField(upload_to="invoices/", blank=True, null=True)
    details = models.JSONField(default=dict, help_text="Tax identification numbers, HSN summaries, etc.")
    generated_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.invoice_number


class PaymentLog(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="payment_logs")
    transaction_id = models.CharField(max_length=255, db_index=True)
    gateway = models.CharField(max_length=50)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    status = models.CharField(max_length=50)
    raw_response = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.gateway} {self.status} - Order {self.order.id}"


class Refund(models.Model):
    """
    A refund issued against an order. Integrity is enforced in apps.orders.payments
    .refund_payment(): always routed through the order's ORIGINAL gateway and locked
    to the order's ORIGINAL currency — no cross-gateway or cross-currency refunds.
    """
    REFUND_STATUS = [
        ('PENDING', 'Pending'),
        ('PROCESSED', 'Processed'),
        ('FAILED', 'Failed'),
    ]
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="refunds")
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    currency_code = models.CharField(max_length=10, help_text="Locked to the order's original currency")
    gateway = models.CharField(max_length=50, help_text="Original payment gateway")
    reason = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=REFUND_STATUS, default='PENDING', db_index=True)
    refund_transaction_id = models.CharField(max_length=255, blank=True)
    is_partial = models.BooleanField(default=False)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="refunds_issued",
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Refund {self.amount} {self.currency_code} - Order #{self.order_id} ({self.status})"


class AuditLog(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=255)
    model_name = models.CharField(max_length=100, db_index=True)
    object_id = models.CharField(max_length=100, blank=True, null=True)
    changes = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.action} on {self.model_name} by {self.user}"


class Coupon(models.Model):
    DISCOUNT_TYPES = [
        ('PERCENTAGE', 'Percentage'),
        ('FIXED_AMOUNT', 'Fixed Amount'),
        ('TIERED', 'Tiered Discount'),
    ]
    code = models.CharField(max_length=50, unique=True, db_index=True)
    discount_type = models.CharField(max_length=20, choices=DISCOUNT_TYPES, default='PERCENTAGE')
    value = models.DecimalField(max_digits=10, decimal_places=2, help_text="Percentage off or fixed value discount")
    region = models.ForeignKey(Region, on_delete=models.CASCADE, null=True, blank=True, related_name='coupons', help_text="Regional lock")
    min_spend = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, help_text="Minimum spend required to activate")
    start_date = models.DateTimeField(null=True, blank=True)
    end_date = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    usage_limit = models.PositiveIntegerField(null=True, blank=True)
    usage_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        region_str = self.region.code if self.region else "GLOBAL"
        return f"{self.code} ({self.discount_type} - {region_str})"


class WebhookEvent(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PROCESSED', 'Processed'),
        ('FAILED', 'Failed'),
        ('DLQ', 'Dead Letter Queue'),
    ]
    GATEWAY_CHOICES = [
        ('STRIPE', 'Stripe'),
        ('RAZORPAY', 'Razorpay'),
        ('PAYPAL', 'PayPal'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    gateway = models.CharField(max_length=20, choices=GATEWAY_CHOICES)
    event_id = models.CharField(max_length=255, blank=True, db_index=True,
                                help_text="Provider-supplied unique event id; used for idempotency.")
    event_type = models.CharField(max_length=100)
    payload = models.JSONField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING', db_index=True)
    attempts = models.PositiveIntegerField(default=0)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    next_attempt_at = models.DateTimeField(null=True, blank=True, db_index=True)
    error_log = models.TextField(blank=True, default='')
    error_message = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['gateway', 'event_id'],
                condition=~models.Q(event_id=''),
                name='unique_gateway_webhook_event',
            ),
        ]

    def __str__(self):
        return f"{self.gateway} - {self.event_type} ({self.status})"


class EmailDelivery(models.Model):
    """Durable retry record for a transactional email that could not send."""

    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('SENT', 'Sent'),
        ('FAILED', 'Failed'),
        ('DLQ', 'Dead Letter Queue'),
    ]
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    event = models.CharField(max_length=40, db_index=True)
    region = models.ForeignKey(Region, on_delete=models.SET_NULL, null=True, blank=True)
    recipient_email = models.EmailField()
    context = models.JSONField(default=dict)
    audit_target_type = models.CharField(max_length=100, default='Order')
    audit_target_id = models.CharField(max_length=100, blank=True, default='')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='PENDING', db_index=True)
    attempts = models.PositiveIntegerField(default=0)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    next_attempt_at = models.DateTimeField(null=True, blank=True, db_index=True)
    error_message = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['created_at']
        constraints = [
            models.UniqueConstraint(
                fields=[
                    'event', 'recipient_email', 'audit_target_type',
                    'audit_target_id',
                ],
                condition=models.Q(status__in=['PENDING', 'FAILED']),
                name='unique_outstanding_email_delivery',
            ),
        ]
        indexes = [
            models.Index(
                fields=['status', 'next_attempt_at'],
                name='orders_ema_status_8cf2c5_idx',
            ),
        ]

    def __str__(self):
        return f'{self.event} to {self.recipient_email} ({self.status})'


class CronJobRun(models.Model):
    """One execution of a scheduled job.

    Scheduled work fails quietly by nature — nobody is watching when it runs at
    03:00. Every run is recorded here so the admin can see what ran, what it
    did, and what broke, and retry a failed job rather than discover a week of
    missing emails later.
    """
    STATUS = [
        ('RUNNING', 'Running'),
        ('SUCCESS', 'Success'),
        ('FAILED', 'Failed'),
    ]
    job_name = models.CharField(max_length=100, db_index=True)
    status = models.CharField(max_length=10, choices=STATUS, default='RUNNING', db_index=True)
    started_at = models.DateTimeField(auto_now_add=True, db_index=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    duration_ms = models.PositiveIntegerField(null=True, blank=True)
    processed = models.PositiveIntegerField(default=0, help_text="Items acted on, e.g. emails sent.")
    failed = models.PositiveIntegerField(default=0, help_text="Items that errored but did not stop the run.")
    message = models.TextField(blank=True, default='')
    error = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-started_at']
        indexes = [
            models.Index(fields=['job_name', '-started_at']),
            models.Index(fields=['status', '-started_at']),
        ]

    def __str__(self):
        return f"{self.job_name} {self.status} @ {self.started_at:%Y-%m-%d %H:%M}"


class SchedulerLease(models.Model):
    """Renewable database lease ensuring only one scheduler is active."""

    name = models.CharField(max_length=50, unique=True, default='primary')
    owner = models.CharField(max_length=64)
    expires_at = models.DateTimeField(db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.name}: {self.owner} until {self.expires_at.isoformat()}'
