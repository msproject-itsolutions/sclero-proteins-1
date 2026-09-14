from django.db import models


class BulkEnquiry(models.Model):
    """A B2B / wholesale / OEM 'Enquire for Bulk' submission from the storefront."""

    STATUS = [
        ('NEW', 'New'),
        ('CONTACTED', 'Contacted'),
        ('QUOTED', 'Quoted'),
        ('CLOSED', 'Closed'),
    ]
    ENQUIRY_TYPES = [
        ('GENERAL', 'General support'),
        ('BULK', 'Bulk ingredient supply'),
        ('OEM', 'OEM / private label'),
        ('DISTRIBUTOR', 'Distributor partnership'),
        ('WHOLESALE', 'Wholesale / retail'),
        ('OTHER', 'Other'),
    ]

    name = models.CharField(max_length=255)
    company = models.CharField(max_length=255, blank=True, default='')
    email = models.EmailField(db_index=True)
    phone = models.CharField(max_length=40, blank=True, default='')
    enquiry_type = models.CharField(max_length=20, choices=ENQUIRY_TYPES, default='BULK')
    product_interest = models.CharField(max_length=255, blank=True, default='',
                                        help_text='e.g. OvoMatrix ESC, Bulk Collagen, SoilPro')
    quantity = models.CharField(max_length=120, blank=True, default='',
                                help_text='Estimated volume / MOQ, free text')
    country = models.CharField(max_length=80, blank=True, default='')
    message = models.TextField(blank=True, default='')
    status = models.CharField(max_length=20, choices=STATUS, default='NEW', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name_plural = 'Bulk enquiries'

    def __str__(self):
        return f'{self.enquiry_type} enquiry from {self.name} ({self.email})'


class NewsletterSubscriber(models.Model):
    """Email captured from the footer newsletter form. Double opt-in not yet wired
    — flag `is_confirmed` so a confirmation flow can be added later without
    breaking existing rows. Soft-unsubscribe via `is_active`."""
    email = models.EmailField(unique=True, db_index=True)
    region_code = models.CharField(max_length=8, blank=True, default='',
                                   help_text='Detected region at signup (IN/UK).')
    phone_number = models.CharField(max_length=32, blank=True, default='',
                                    help_text='Subscriber mobile/phone number.')
    is_active = models.BooleanField(default=True, db_index=True)
    is_confirmed = models.BooleanField(default=False, help_text='Double opt-in confirmation status.')
    source = models.CharField(max_length=40, blank=True, default='footer',
                              help_text='UI surface that captured this subscriber.')
    created_at = models.DateTimeField(auto_now_add=True)
    unsubscribed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.email
