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
        fields = '__all__'

class ShippingZoneSerializer(serializers.ModelSerializer):
    rates = ShippingRateSerializer(many=True, read_only=True)

    class Meta:
        model = ShippingZone
        fields = ['id', 'name', 'countries', 'is_active', 'rates']


# --- Admin Serializers for Regional CRUD Operations --- #

class RegionAdminSerializer(serializers.ModelSerializer):
    """Admin serializer with full region management capabilities."""
    warehouse_count = serializers.SerializerMethodField()
    shipping_zone_count = serializers.SerializerMethodField()

    class Meta:
        model = Region
        fields = [
            'id', 'code', 'name', 'domain', 'currency_code', 'currency_symbol',
            'tax_name', 'tax_rate', 'is_active', 'warehouse_count',
            'shipping_zone_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

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
            'countries', 'is_active', 'rate_count', 'rates'
        ]
        read_only_fields = ['id']

    def get_rate_count(self, obj):
        return obj.rates.count()


class ShippingRateAdminSerializer(serializers.ModelSerializer):
    zone_name = serializers.CharField(source='zone.name', read_only=True)
    region_code = serializers.CharField(source='zone.region.code', read_only=True)

    class Meta:
        model = ShippingRate
        fields = [
            'id', 'zone', 'zone_name', 'region_code', 'name', 'rate_type',
            'price', 'min_value', 'max_value'
        ]
        read_only_fields = ['id']
