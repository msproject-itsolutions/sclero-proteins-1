from rest_framework import serializers
from .models import BulkEnquiry


class BulkEnquirySerializer(serializers.ModelSerializer):
    class Meta:
        model = BulkEnquiry
        fields = [
            'id', 'name', 'company', 'email', 'phone', 'enquiry_type',
            'product_interest', 'quantity', 'country', 'message',
            'status', 'created_at',
        ]
        # status/created_at are server-controlled; the public form can't set status.
        read_only_fields = ['status', 'created_at']


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
