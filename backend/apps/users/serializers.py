from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
import re
from apps.audit.recorder import record_audit
from .models import UserAddress, Role, Wishlist, WishlistItem, CustomerSegment, CustomerActivity, SupportTicket
from .permissions import PERMISSIONS, get_user_permission_keys, is_staff_account

User = get_user_model()

PHONE_PATTERN = re.compile(r'^[+\d][\d\s().-]*$')


def _validate_phone(value):
    phone = str(value or '').strip()
    digits = re.sub(r'\D', '', phone)
    if not PHONE_PATTERN.fullmatch(phone) or not 7 <= len(digits) <= 15:
        raise serializers.ValidationError('Enter a valid phone number with 7 to 15 digits.')
    return phone

def _request_user(serializer):
    request = serializer.context.get('request')
    user = getattr(request, 'user', None)
    return user if getattr(user, 'is_authenticated', False) else None


def _changed_fields(before, instance):
    """{field: [old, new]} for every field whose value changed (related objects as ids)."""
    changes = {}
    for field, old in before.items():
        new = getattr(instance, field)
        if old != new:
            changes[field] = [getattr(old, 'pk', old), getattr(new, 'pk', new)]
    return changes


class UserSerializer(serializers.ModelSerializer):
    permissions = serializers.SerializerMethodField()
    role_names = serializers.SerializerMethodField()
    home_region_code = serializers.CharField(source='home_region.code', read_only=True)
    assigned_regions_codes = serializers.SerializerMethodField(read_only=True)
    has_password = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'email_verified', 'has_password', 'first_name', 'last_name', 'phone_number',
            'home_region', 'home_region_code',
            'email_order_updates', 'email_marketing', 'email_newsletter', 'sms_marketing',
            'is_staff', 'is_superuser', 'roles', 'role_names', 'permissions',
            'assigned_regions', 'assigned_regions_codes', 'two_factor_enabled',
            'allowed_ip_range', 'current_devices',
        ]
        # Email changes go through the confirmed email-change flow and the IP
        # allow-list is set by an administrator, never by the account itself.
        read_only_fields = [
            'email', 'email_verified', 'is_staff', 'is_superuser', 'roles', 'role_names', 'permissions',
            'assigned_regions', 'assigned_regions_codes', 'allowed_ip_range', 'current_devices',
        ]

    def get_permissions(self, obj):
        return sorted(get_user_permission_keys(obj))

    def get_role_names(self, obj):
        return list(obj.roles.values_list('name', flat=True))

    def get_assigned_regions_codes(self, obj):
        return list(obj.assigned_regions.values_list('code', flat=True))

    def get_has_password(self, obj):
        return obj.has_usable_password()

    def validate_password(self, value):
        if not self.instance and not value:
            raise serializers.ValidationError('A password is required for new staff accounts.')
        if value:
            validate_password(value)
        return value

    def validate_two_factor_enabled(self, value):
        if self.instance is None or value == self.instance.two_factor_enabled:
            return value
        # Staff always receive a sign-in code; the switch exists only for customers.
        if is_staff_account(self.instance):
            raise serializers.ValidationError('Staff accounts always sign in with an emailed code.')
        if value and not self.instance.has_usable_password():
            raise serializers.ValidationError('Set a password before turning on two-step sign-in.')
        return value

    def update(self, instance, validated_data):
        before = {field: getattr(instance, field) for field in validated_data}
        instance = super().update(instance, validated_data)
        changes = _changed_fields(before, instance)
        if changes:
            record_audit(
                'profile.updated', actor=instance, target_type='User', target_id=instance.pk,
                summary=f'Profile updated: {instance.email}', changes=changes,
            )
        return instance


class CustomerAdminSerializer(serializers.ModelSerializer):
    """Staff view of a customer account (users.manage)."""
    home_region_code = serializers.CharField(source='home_region.code', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'email', 'first_name', 'last_name', 'phone_number', 'home_region', 'home_region_code',
            'email_order_updates', 'email_marketing', 'email_newsletter', 'sms_marketing',
            'email_verified', 'two_factor_enabled', 'is_staff', 'created_at',
        ]
        read_only_fields = ['email_verified', 'two_factor_enabled', 'is_staff', 'created_at']

    def validate_email(self, value):
        email = value.strip().lower()
        if self.instance is not None:
            if email != self.instance.email.lower():
                raise serializers.ValidationError(
                    'Customers change their email from their account page; the new address has to be confirmed.'
                )
            return self.instance.email
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError('An account with this email address already exists.')
        return email

    def validate_phone_number(self, value):
        return _validate_phone(value) if value else value

    def create(self, validated_data):
        user = User.objects.create_user(password=None, **validated_data)
        record_audit(
            'customer.created', actor=_request_user(self), target_type='User', target_id=user.pk,
            summary=f'Created customer account {user.email}',
        )
        return user

    def update(self, instance, validated_data):
        before = {field: getattr(instance, field) for field in validated_data}
        instance = super().update(instance, validated_data)
        changes = _changed_fields(before, instance)
        if changes:
            record_audit(
                'customer.updated', actor=_request_user(self), target_type='User', target_id=instance.pk,
                summary=f'Updated customer account {instance.email}', changes=changes,
            )
        return instance


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
    """Admin-facing serializer for managing and creating staff members."""
    permissions = serializers.SerializerMethodField()
    assigned_regions_codes = serializers.SerializerMethodField(read_only=True)
    password = serializers.CharField(write_only=True, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = [
            'id', 'email', 'password', 'first_name', 'last_name', 'is_staff', 'is_active',
            'roles', 'permissions', 'assigned_regions', 'assigned_regions_codes',
            'two_factor_enabled', 'allowed_ip_range', 'current_devices'
        ]
        read_only_fields = ['permissions']

    def get_permissions(self, obj):
        return sorted(get_user_permission_keys(obj))

    def get_assigned_regions_codes(self, obj):
        return list(obj.assigned_regions.values_list('code', flat=True))

    def validate_password(self, value):
        if not self.instance and not value.strip():
            raise serializers.ValidationError('A password is required for new staff accounts.')
        if value:
            validate_password(value, self.instance)
        return value

    def validate(self, attrs):
        if 'email' in attrs:
            attrs['email'] = attrs['email'].strip().lower()
        for field in ('first_name', 'last_name'):
            if field in attrs:
                attrs[field] = attrs[field].strip()
        return attrs

    def create(self, validated_data):
        roles = validated_data.pop('roles', [])
        regions = validated_data.pop('assigned_regions', [])
        password = validated_data.pop('password', None)
        if not password:
            raise serializers.ValidationError({'password': 'A password is required for new staff accounts.'})

        validated_data.setdefault('is_staff', True)
        user = User.objects.create_user(password=password, **validated_data)
        if roles:
            user.roles.set(roles)
        if regions:
            user.assigned_regions.set(regions)
        return user


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    first_name = serializers.CharField(min_length=2, max_length=150, trim_whitespace=True)
    last_name = serializers.CharField(min_length=2, max_length=150, trim_whitespace=True)

    class Meta:
        model = User
        fields = ['email', 'password', 'first_name', 'last_name', 'phone_number']

    def validate_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError('Password must be at least 8 characters long.')
        validate_password(value)
        return value

    def validate(self, attrs):
        attrs['email'] = attrs['email'].strip().lower()
        attrs['first_name'] = attrs.get('first_name', '').strip()
        attrs['last_name'] = attrs.get('last_name', '').strip()
        if attrs.get('phone_number'):
            attrs['phone_number'] = _validate_phone(attrs['phone_number'])
        return attrs

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

    def validate(self, attrs):
        required = ('full_name', 'phone_number', 'address_line1', 'city', 'state', 'postal_code', 'country')
        for field in (*required, 'address_line2'):
            if field in attrs and isinstance(attrs[field], str):
                attrs[field] = attrs[field].strip()
        errors = {field: 'This field may not be blank.' for field in required if not attrs.get(field)}
        if errors:
            raise serializers.ValidationError(errors)
        attrs['phone_number'] = _validate_phone(attrs['phone_number'])
        attrs['country'] = attrs['country'].upper()
        return attrs


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
