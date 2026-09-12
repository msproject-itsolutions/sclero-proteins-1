import uuid

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class Role(models.Model):
    """
    A staff role grouping a set of permission keys (see apps.users.permissions).
    Roles are managed from the admin panel; system roles are seeded and protected.
    """
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    permissions = models.JSONField(default=list, help_text="List of permission keys, e.g. ['orders.manage', 'inventory.view']")
    is_system = models.BooleanField(default=False, help_text="Seeded role — protected from deletion")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("The Email field must be set")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True, db_index=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    phone_number = models.CharField(max_length=30, blank=True, null=True, db_index=True)
    loyalty_points = models.PositiveIntegerField(default=0)
    google_id = models.CharField(max_length=255, blank=True, null=True, unique=True, db_index=True)
    # Stores purpose-prefixed, expiring password hashes for email OTP or a
    # signed magic-link nonce. It never stores a live OTP in plaintext.
    otp_secret = models.CharField(max_length=255, blank=True, null=True)

    # Single-identity, multi-region: "home region" is where the user lives / is
    # billed; they may still browse in a different "session region" (handled
    # client-side via the region selector).
    home_region = models.ForeignKey(
        'regions.Region', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='home_users',
    )

    # Email preference centre (GDPR / DPDP). Transactional order emails are always
    # sent; marketing & newsletter require explicit opt-in.
    email_order_updates = models.BooleanField(default=True)
    email_marketing = models.BooleanField(default=False)
    email_newsletter = models.BooleanField(default=False)
    sms_marketing = models.BooleanField(default=False)

    is_active = models.BooleanField(default=True, db_index=True)
    is_staff = models.BooleanField(default=False)
    roles = models.ManyToManyField(Role, blank=True, related_name="users")
    assigned_regions = models.ManyToManyField('regions.Region', blank=True, related_name="restricted_users")
    two_factor_enabled = models.BooleanField(default=False)
    # Bumped to end every session at once; JWTs carry it as the `av` claim.
    auth_version = models.PositiveIntegerField(default=0)
    email_verified = models.BooleanField(default=False)
    # Staff sign-in codes go here instead of `email`. Only administrators set it.
    verification_email = models.EmailField(blank=True, default='')
    # TOTP (RFC 6238) — staff-grade authenticator-app 2FA. Separate from
    # `two_factor_enabled` (legacy email-OTP gate).
    totp_secret = models.CharField(max_length=64, blank=True, default='')
    totp_enabled = models.BooleanField(default=False, db_index=True)
    totp_backup_codes = models.JSONField(default=list, blank=True)
    allowed_ip_range = models.CharField(max_length=255, blank=True, default='')
    current_devices = models.JSONField(default=list, blank=True)
    # Password reset (request → email link → confirm) — token is a uuid4 hex.
    password_reset_token = models.CharField(max_length=64, blank=True, default='', db_index=True)
    password_reset_token_expires = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email


class LoginChallenge(models.Model):
    """A single-use emailed code or link that completes a sign-in.

    Only a keyed hash of the secret is stored. `attempts` bounds guessing per
    challenge on top of per-IP throttling.
    """

    class Purpose(models.TextChoices):
        EMAIL_LOGIN = 'EMAIL_LOGIN', 'Email code sign-in'
        MAGIC_LINK = 'MAGIC_LINK', 'Magic link sign-in'
        STAFF_2FA = 'STAFF_2FA', 'Staff sign-in code'
        CUSTOMER_2FA = 'CUSTOMER_2FA', 'Two-step sign-in code'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, null=True, blank=True, related_name='login_challenges',
    )
    email = models.EmailField(db_index=True)
    purpose = models.CharField(max_length=20, choices=Purpose.choices)
    code_hash = models.CharField(max_length=128)
    sent_to = models.EmailField()
    attempts = models.PositiveSmallIntegerField(default=0)
    send_count = models.PositiveSmallIntegerField(default=1)
    last_sent_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField(db_index=True)
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_ip = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [models.Index(fields=['email', 'purpose', 'created_at'])]

    def __str__(self):
        return f'{self.purpose} for {self.email}'


class UserAddress(models.Model):
    ADDRESS_TYPES = [
        ('SHIPPING', 'Shipping Address'),
        ('BILLING', 'Billing Address'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="addresses")
    address_type = models.CharField(max_length=10, choices=ADDRESS_TYPES, default='SHIPPING')
    full_name = models.CharField(max_length=255)
    phone_number = models.CharField(max_length=30)
    address_line1 = models.CharField(max_length=255)
    address_line2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20)
    country = models.CharField(max_length=10, help_text="ISO Country Code")
    is_default = models.BooleanField(default=False)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'is_default']),
        ]

    def __str__(self):
        return f"{self.full_name} - {self.city}, {self.country}"


class Wishlist(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="wishlists")
    name = models.CharField(max_length=100, default="My Wishlist")
    is_public = models.BooleanField(default=False)
    share_token = models.CharField(max_length=100, blank=True, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self.share_token:
            import uuid
            self.share_token = uuid.uuid4().hex
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.user.email})"


class WishlistItem(models.Model):
    wishlist = models.ForeignKey(Wishlist, on_delete=models.CASCADE, related_name="items", null=True, blank=True)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="wishlist", null=True, blank=True)
    product = models.ForeignKey('products.Product', on_delete=models.CASCADE, related_name="wishlisted_by")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('wishlist', 'product')
        ordering = ['-created_at']

    def __str__(self):
        w_name = self.wishlist.name if self.wishlist else "Default"
        email = self.user.email if self.user else (self.wishlist.user.email if self.wishlist else "Unknown")
        return f"{self.product.sku} in {email}'s {w_name} wishlist"


class CustomerSegment(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    criteria = models.JSONField(default=dict, help_text="e.g. {'min_orders': 5, 'min_spend': 100}")
    customers = models.ManyToManyField('users.User', blank=True, related_name='segments')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class CustomerActivity(models.Model):
    ACTIVITY_TYPES = [
        ('PAGE_VIEW', 'Page View'),
        ('CART_ADD', 'Add to Cart'),
        ('CHECKOUT', 'Checkout Started'),
        ('PURCHASE', 'Purchase'),
        ('SUPPORT_TICKET', 'Support Ticket Created'),
    ]
    email = models.EmailField(db_index=True)
    user = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='activities')
    activity_type = models.CharField(max_length=20, choices=ACTIVITY_TYPES, default='PAGE_VIEW')
    description = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.email} - {self.activity_type} at {self.created_at}"


class SupportTicket(models.Model):
    STATUS_CHOICES = [
        ('OPEN', 'Open'),
        ('PENDING', 'Pending'),
        ('RESOLVED', 'Resolved'),
        ('CLOSED', 'Closed'),
    ]
    PRIORITY_CHOICES = [
        ('LOW', 'Low'),
        ('MEDIUM', 'Medium'),
        ('HIGH', 'High'),
        ('CRITICAL', 'Critical'),
    ]
    email = models.EmailField(db_index=True)
    external_message_id = models.CharField(max_length=255, null=True, blank=True, unique=True)
    user = models.ForeignKey('users.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='support_tickets')
    subject = models.CharField(max_length=255)
    message = models.TextField()
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='OPEN')
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='MEDIUM')
    admin_notes = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Ticket #{self.id} ({self.status}) - {self.subject}"
