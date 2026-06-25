from rest_framework import serializers
from .models import StockLevel, StockTransfer


class StockLevelSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    region_code = serializers.CharField(source='warehouse.region.code', read_only=True)
    region_name = serializers.CharField(source='warehouse.region.name', read_only=True)
    total_stock = serializers.SerializerMethodField()
    low_stock = serializers.SerializerMethodField()

    class Meta:
        model = StockLevel
        fields = [
            'id', 'product', 'product_sku', 'product_name',
            'warehouse', 'warehouse_name', 'region_code', 'region_name',
            'available', 'reserved', 'total_stock', 'low_stock_threshold',
            'low_stock', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_total_stock(self, obj):
        return obj.available + obj.reserved

    def get_low_stock(self, obj):
        return obj.available <= obj.low_stock_threshold


class StockLevelAdminUpdateSerializer(serializers.ModelSerializer):
    """Admin serializer for updating stock levels."""
    class Meta:
        model = StockLevel
        fields = ['available', 'reserved', 'low_stock_threshold']


class StockTransferSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    from_warehouse_name = serializers.CharField(source='from_warehouse.name', read_only=True)
    to_warehouse_name = serializers.CharField(source='to_warehouse.name', read_only=True)
    from_region_code = serializers.CharField(source='from_warehouse.region.code', read_only=True)
    to_region_code = serializers.CharField(source='to_warehouse.region.code', read_only=True)

    class Meta:
        model = StockTransfer
        fields = [
            'id', 'product', 'product_sku', 'product_name',
            'from_warehouse', 'from_warehouse_name', 'from_region_code',
            'to_warehouse', 'to_warehouse_name', 'to_region_code',
            'quantity', 'status', 'created_at', 'completed_at'
        ]
        read_only_fields = ['id', 'created_at', 'completed_at']


class StockTransferCreateSerializer(serializers.ModelSerializer):
    """Admin serializer for creating stock transfers."""
    class Meta:
        model = StockTransfer
        fields = ['product', 'from_warehouse', 'to_warehouse', 'quantity']

    def validate(self, data):
        # Validate sufficient stock at source warehouse
        from_warehouse = data['from_warehouse']
        product = data['product']
        quantity = data['quantity']

        try:
            stock = StockLevel.objects.get(warehouse=from_warehouse, product=product)
            if stock.available < quantity:
                raise serializers.ValidationError(
                    f"Insufficient stock at {from_warehouse.name}. Available: {stock.available}, Requested: {quantity}"
                )
        except StockLevel.DoesNotExist:
            raise serializers.ValidationError(
                f"No stock record found for product {product.sku} at warehouse {from_warehouse.name}"
            )

        return data