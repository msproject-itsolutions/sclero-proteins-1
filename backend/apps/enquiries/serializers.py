import re
from rest_framework import serializers

from .models import BulkEnquiry, NewsletterSubscriber


class NewsletterSubscriberSerializer(serializers.ModelSerializer):
    class Meta:
        model = NewsletterSubscriber
        fields = [
            'id', 'email', 'phone_number', 'region_code', 'is_active',
            'is_confirmed', 'source', 'created_at', 'unsubscribed_at',
        ]
        read_only_fields = ['id', 'created_at', 'unsubscribed_at']



PHONE_PATTERN = re.compile(r'^[+\d][\d\s().-]*$')
TRIMMED_FIELDS = (
    'name', 'company', 'email', 'phone', 'product_interest',
    'quantity', 'country', 'message',
)


class BulkEnquirySerializer(serializers.ModelSerializer):
    name = serializers.CharField(max_length=255, allow_blank=True, trim_whitespace=False)
    message = serializers.CharField(allow_blank=True, required=False, trim_whitespace=False)

    class Meta:
        model = BulkEnquiry
        fields = [
            'id', 'name', 'company', 'email', 'phone', 'enquiry_type',
            'product_interest', 'quantity', 'country', 'message',
            'status', 'created_at',
        ]
        # status/created_at are server-controlled; the public form can't set status.
        read_only_fields = ['status', 'created_at']

    def validate(self, attrs):
        for field in TRIMMED_FIELDS:
            if field in attrs and isinstance(attrs[field], str):
                attrs[field] = attrs[field].strip()

        enquiry_type = attrs.get('enquiry_type', 'BULK')
        errors = {}
        if not attrs.get('name'):
            errors['name'] = 'Please enter your name.'
        elif len(attrs['name']) < 2:
            errors['name'] = 'Please enter at least 2 characters for your name.'
        if not attrs.get('email'):
            errors['email'] = 'Please enter your email address.'
        if not attrs.get('message'):
            errors['message'] = 'Please enter a message.'
        elif len(attrs['message']) < 10:
            errors['message'] = 'Please enter at least 10 characters in your message.'

        phone = attrs.get('phone', '')
        if phone:
            digits = re.sub(r'\D', '', phone)
            if not PHONE_PATTERN.fullmatch(phone) or not 7 <= len(digits) <= 15:
                errors['phone'] = 'Enter a valid phone number with 7 to 15 digits.'

        if errors:
            raise serializers.ValidationError(errors)

        attrs['email'] = attrs['email'].lower()
        attrs['country'] = attrs.get('country', '').upper() if len(attrs.get('country', '')) == 2 else attrs.get('country', '')
        attrs['enquiry_type'] = enquiry_type
        return attrs


class BulkEnquiryAdminSerializer(serializers.ModelSerializer):
    """Full representation for the admin list, allows status updates."""
    class Meta:
        model = BulkEnquiry
        fields = [
            'id', 'name', 'company', 'email', 'phone', 'enquiry_type',
            'product_interest', 'quantity', 'country', 'message',
            'status', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'name', 'company', 'email', 'phone', 'enquiry_type',
            'product_interest', 'quantity', 'country', 'message',
            'created_at', 'updated_at',
        ]
