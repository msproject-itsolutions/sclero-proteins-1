from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from .models import UserAddress, Role, Wishlist, WishlistItem, CustomerSegment, CustomerActivity, SupportTicket
from .permissions import get_user_permission_keys, PERMISSIONS

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    permissions = serializers.SerializerMethodField()
    role_names = serializers.SerializerMethodField()
    home_region_code = serializers.CharField(source='home_region.code', read_only=True)
    assigned_regions_codes = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'phone_number',
            'home_region', 'home_region_code',
            'email_order_updates', 'email_marketing', 'email_newsletter', 'sms_marketing',
            'is_staff', 'is_superuser', 'roles', 'role_names', 'permissions',
            'assigned_regions', 'assigned_regions_codes', 'two_factor_enabled', 
            'allowed_ip_range', 'current_devices',
        ]
        read_only_fields = ['is_staff', 'is_superuser', 'roles', 'role_names', 'permissions', 'assigned_regions', 'assigned_regions_codes', 'current_devices']

    def get_permissions(self, obj):
        return sorted(get_user_permission_keys(obj))

    def get_role_names(self, obj):
        return list(obj.roles.values_list('name', flat=True))

    def get_assigned_regions_codes(self, obj):
        return list(obj.assigned_regions.values_list('code', flat=True))


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'name', 'description', 'permissions', 'is_system', 'created_at', 'updated_at']
        read_only_fields = ['is_system', 'created_at', 'updated_at']

    def validate_permissions(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("permissions must be a list of permission keys.")
        invalid = [k for k in value if k not in PERMISSIONS]
        if invalid:
            raise serializers.ValidationError(f"Unknown permission keys: {invalid}")
        return value


class StaffUserSerializer(serializers.ModelSerializer):
    """Admin-facing serializer for assigning roles / staff status."""
    permissions = serializers.SerializerMethodField()
    assigned_regions_codes = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'is_staff', 'is_active', 
            'roles', 'permissions', 'assigned_regions', 'assigned_regions_codes',
            'two_factor_enabled', 'allowed_ip_range', 'current_devices'
        ]
        read_only_fields = ['email', 'permissions']

    def get_permissions(self, obj):
        return sorted(get_user_permission_keys(obj))

    def get_assigned_regions_codes(self, obj):
        return list(obj.assigned_regions.values_list('code', flat=True))


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['email', 'password', 'first_name', 'last_name', 'phone_number']

    def validate_password(self, value):
        validate_password(value)
        return value

    def create(self, validated_data):
        user = User.objects.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            phone_number=validated_data.get('phone_number', '')
        )
        return user


class UserAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserAddress
        fields = '__all__'
        read_only_fields = ['user']


class WishlistItemSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(write_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    price = serializers.SerializerMethodField(read_only=True)
    promotional_price = serializers.SerializerMethodField(read_only=True)
    thumbnail = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = WishlistItem
        fields = ['id', 'product_id', 'product_sku', 'product_name', 'price', 'promotional_price', 'thumbnail', 'created_at']
        read_only_fields = ['created_at']

    def get_region(self):
        request = self.context.get('request')
        if not request:
            return None
        region_code = request.query_params.get('region', '').upper()
        from apps.regions.models import Region
        return Region.objects.filter(code=region_code, is_active=True).first() or Region.objects.filter(is_active=True).first()

    def get_price(self, obj):
        region = self.get_region()
        if not region:
            return None
        config = obj.product.regional_configs.filter(region=region).first()
        return config.price if config else None

    def get_promotional_price(self, obj):
        region = self.get_region()
        if not region:
            return None
        config = obj.product.regional_configs.filter(region=region).first()
        return config.promotional_price if config else None

    def get_thumbnail(self, obj):
        media = obj.product.media.filter(media_type='IMAGE').first()
        return media.file_url if media else None


class WishlistSerializer(serializers.ModelSerializer):
    items = WishlistItemSerializer(many=True, read_only=True)

    class Meta:
        model = Wishlist
        fields = ['id', 'name', 'is_public', 'share_token', 'items', 'created_at']
        read_only_fields = ['id', 'share_token', 'created_at']


class CustomerSegmentSerializer(serializers.ModelSerializer):
    customer_emails = serializers.SerializerMethodField()

    class Meta:
        model = CustomerSegment
        fields = ['id', 'name', 'description', 'criteria', 'customers', 'customer_emails', 'created_at']

    def get_customer_emails(self, obj):
        return list(obj.customers.values_list('email', flat=True))


class CustomerActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomerActivity
        fields = '__all__'


class SupportTicketSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportTicket
        fields = '__all__'
