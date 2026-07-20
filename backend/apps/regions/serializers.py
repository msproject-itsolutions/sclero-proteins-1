from rest_framework import serializers
from .models import Region, Warehouse, ShippingZone, ShippingRate

class RegionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Region
        fields = '__all__'

class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = '__all__'

class ShippingRateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShippingRate
        fields = [
            'id', 'zone', 'name', 'method', 'rate_type', 'price',
            'per_unit_price', 'handling_fee', 'min_value', 'max_value',
            'free_above', 'surcharge_amount', 'estimated_days', 'priority', 'is_active',
        ]

class ShippingZoneSerializer(serializers.ModelSerializer):
    rates = ShippingRateSerializer(many=True, read_only=True)

    class Meta:
        model = ShippingZone
        fields = ['id', 'name', 'countries', 'states', 'cities', 'postal_ranges', 'is_active', 'rates']


# --- Admin Serializers for Regional CRUD Operations --- #

class RegionAdminSerializer(serializers.ModelSerializer):
    """Admin serializer with full region management capabilities."""
    warehouse_count = serializers.SerializerMethodField()
    shipping_zone_count = serializers.SerializerMethodField()

    class Meta:
        model = Region
        fields = [
            'id', 'code', 'name', 'domain', 'currency_code', 'currency_symbol',
            'tax_name', 'tax_rate', 'is_active', 'countries', 'is_default',
            'warehouse_count', 'shipping_zone_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_countries(self, value):
        """Normalise to unique upper-case ISO-2 codes."""
        if value in (None, ''):
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError('Countries must be a list of ISO-2 codes.')
        cleaned = []
        for raw in value:
            code = str(raw).strip().upper()
            if not code:
                continue
            if len(code) != 2 or not code.isalpha():
                raise serializers.ValidationError(f'"{raw}" is not a 2-letter country code.')
            if code not in cleaned:
                cleaned.append(code)
        return cleaned

    def validate(self, attrs):
        """Stop two regions claiming the same country — it makes routing ambiguous."""
        countries = attrs.get('countries')
        if countries:
            clashes = []
            others = Region.objects.filter(is_active=True)
            if self.instance:
                others = others.exclude(pk=self.instance.pk)
            for other in others:
                overlap = {str(c).upper() for c in (other.countries or [])} & set(countries)
                if overlap:
                    clashes.append(f'{", ".join(sorted(overlap))} already served by {other.code}')
            if clashes:
                raise serializers.ValidationError({'countries': clashes})
        return attrs

    def _demote_other_defaults(self, instance):
        """Only one region can be the fallback, or routing becomes arbitrary."""
        Region.objects.filter(is_default=True).exclude(pk=instance.pk).update(is_default=False)

    def create(self, validated_data):
        instance = super().create(validated_data)
        if instance.is_default:
            self._demote_other_defaults(instance)
        return instance

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        if instance.is_default:
            self._demote_other_defaults(instance)
        return instance

    def get_warehouse_count(self, obj):
        return obj.warehouses.count()

    def get_shipping_zone_count(self, obj):
        return obj.shipping_zones.count()


class WarehouseAdminSerializer(serializers.ModelSerializer):
    region_code = serializers.CharField(source='region.code', read_only=True)
    region_name = serializers.CharField(source='region.name', read_only=True)
    stock_count = serializers.SerializerMethodField()

    class Meta:
        model = Warehouse
        fields = [
            'id', 'name', 'region', 'region_code', 'region_name',
            'address', 'is_active', 'stock_count', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']

    def get_stock_count(self, obj):
        return obj.stocks.count()


class ShippingZoneAdminSerializer(serializers.ModelSerializer):
    region_code = serializers.CharField(source='region.code', read_only=True)
    region_name = serializers.CharField(source='region.name', read_only=True)
    rates = ShippingRateSerializer(many=True, read_only=True)
    rate_count = serializers.SerializerMethodField()

    class Meta:
        model = ShippingZone
        fields = [
            'id', 'region', 'region_code', 'region_name', 'name',
            'description', 'countries', 'states', 'cities', 'postal_ranges',
            'priority', 'is_active', 'rate_count', 'rates'
        ]
        read_only_fields = ['id']

    def validate_countries(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('Countries must be a list.')
        cleaned = []
        for raw in value:
            code = str(raw).strip().upper()
            if len(code) != 2 or not code.isalpha():
                raise serializers.ValidationError(f'"{raw}" is not a valid 2-letter country code.')
            if code not in cleaned:
                cleaned.append(code)
        return cleaned

    def _clean_names(self, value, label):
        if not isinstance(value, list):
            raise serializers.ValidationError(f'{label} must be a list.')
        return list(dict.fromkeys(str(item).strip() for item in value if str(item).strip()))

    def validate_states(self, value):
        return self._clean_names(value, 'States')

    def validate_cities(self, value):
        return self._clean_names(value, 'Cities')

    def validate_postal_ranges(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('Postal ranges must be a list.')
        cleaned = []
        for item in value:
            if not isinstance(item, dict) or not str(item.get('start', '')).strip():
                raise serializers.ValidationError('Each postal range needs a start value.')
            start = str(item['start']).strip().upper()
            end = str(item.get('end') or start).strip().upper()
            cleaned.append({'start': start, 'end': end})
        return cleaned

    def get_rate_count(self, obj):
        return obj.rates.count()


class ShippingRateAdminSerializer(serializers.ModelSerializer):
    zone_name = serializers.CharField(source='zone.name', read_only=True)
    region_code = serializers.CharField(source='zone.region.code', read_only=True)
    region_currency = serializers.CharField(source='zone.region.currency_code', read_only=True)
    region_symbol = serializers.CharField(source='zone.region.currency_symbol', read_only=True)

    class Meta:
        model = ShippingRate
        fields = [
            'id', 'zone', 'zone_name', 'region_code', 'region_currency', 'region_symbol',
            'name', 'method', 'rate_type', 'price', 'per_unit_price', 'handling_fee',
            'min_value', 'max_value', 'free_above', 'surcharge_postcodes',
            'surcharge_amount', 'estimated_days', 'description', 'priority', 'is_active',
        ]
        read_only_fields = ['id']

    def validate(self, attrs):
        instance = self.instance
        rate_type = attrs.get('rate_type', getattr(instance, 'rate_type', 'FLAT'))
        minimum = attrs.get('min_value', getattr(instance, 'min_value', None))
        maximum = attrs.get('max_value', getattr(instance, 'max_value', None))
        if minimum is not None and minimum < 0:
            raise serializers.ValidationError({'min_value': 'Minimum cannot be negative.'})
        if maximum is not None and maximum < 0:
            raise serializers.ValidationError({'max_value': 'Maximum cannot be negative.'})
        if minimum is not None and maximum is not None and maximum < minimum:
            raise serializers.ValidationError({'max_value': 'Maximum must be greater than or equal to minimum.'})
        if rate_type == 'QTY':
            for key, value in (('min_value', minimum), ('max_value', maximum)):
                if value is not None and value != value.to_integral_value():
                    raise serializers.ValidationError({key: 'Quantity limits must be whole numbers.'})
        for key in ('price', 'per_unit_price', 'handling_fee', 'surcharge_amount', 'free_above'):
            value = attrs.get(key, getattr(instance, key, None))
            if value is not None and value < 0:
                raise serializers.ValidationError({key: 'Amount cannot be negative.'})
        if rate_type == 'FREE':
            attrs['price'] = 0
            attrs['per_unit_price'] = 0
            attrs['handling_fee'] = 0
        return attrs
