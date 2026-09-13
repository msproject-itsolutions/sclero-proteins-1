from rest_framework import serializers
from apps.products.serializers import ProductListSerializer
from .access import invoice_path
from .models import Cart, CartItem, Order, OrderItem, Invoice, Refund, Coupon

class CartItemSerializer(serializers.ModelSerializer):
    product = ProductListSerializer(read_only=True)
    product_id = serializers.IntegerField(write_only=True)

    class Meta:
        model = CartItem
        fields = [
            'id', 'product', 'product_id', 'variant_sku', 'variant_name',
            'quantity',
        ]


class CartSerializer(serializers.ModelSerializer):
    items = CartItemSerializer(many=True, read_only=True)
    region_code = serializers.CharField(source='region.code', read_only=True)

    class Meta:
        model = Cart
        fields = ['id', 'region_code', 'items', 'created_at']


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    hsn_code = serializers.CharField(source='product.hsn_code', read_only=True, default='')

    class Meta:
        model = OrderItem
        fields = [
            'id', 'product_name', 'product_sku', 'variant_sku', 'variant_name',
            'hsn_code', 'quantity', 'price', 'tax_amount',
        ]


class InvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invoice
        fields = ['invoice_number', 'invoice_type', 'details', 'generated_at']


class RefundSerializer(serializers.ModelSerializer):
    class Meta:
        model = Refund
        fields = [
            'id', 'order', 'amount', 'currency_code', 'gateway', 'reason',
            'status', 'refund_transaction_id', 'is_partial', 'created_at',
        ]
        read_only_fields = fields


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    invoice = InvoiceSerializer(read_only=True)
    refunds = RefundSerializer(many=True, read_only=True)
    invoice_url = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id', 'status', 'email', 'shipping_name', 'shipping_phone',
            'shipping_address_line1', 'shipping_address_line2', 'shipping_city',
            'shipping_state', 'shipping_postal_code', 'shipping_country',
            'currency_code', 'subtotal', 'tax_rate', 'tax_amount',
            'shipping_cost', 'shipping_method', 'shipping_rate_name',
            'shipping_estimated_days', 'shipping_carrier', 'tracking_number', 'tracking_url',
            'total', 'payment_method', 'payment_id',
            'payment_status', 'payment_capture_mode', 'payment_authorized_amount',
            'payment_captured_amount',
            'items', 'invoice', 'invoice_url', 'refunds', 'created_at'
        ]

    def get_invoice_url(self, obj):
        if obj.status == 'AWAITING_PAYMENT' or obj.payment_status in ('EXPIRED', 'FAILED'):
            return None
        return invoice_path(obj)


# --- Admin Serializers for Regional CRUD Operations --- #

class OrderAdminSerializer(serializers.ModelSerializer):
    """Admin serializer for order management with regional filters."""
    items = OrderItemSerializer(many=True, read_only=True)
    invoice = InvoiceSerializer(read_only=True)
    refunds = RefundSerializer(many=True, read_only=True)
    region_code = serializers.CharField(source='region.code', read_only=True)
    region_name = serializers.CharField(source='region.name', read_only=True)
    user_email = serializers.CharField(source='user.email', read_only=True, allow_null=True)
    payment_logs = serializers.SerializerMethodField()
    invoice_url = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            'id', 'user', 'user_email', 'region', 'region_code', 'region_name',
            'status', 'email', 'shipping_name', 'shipping_phone',
            'shipping_address_line1', 'shipping_address_line2', 'shipping_city',
            'shipping_state', 'shipping_postal_code', 'shipping_country',
            'currency_code', 'subtotal', 'tax_rate', 'tax_amount',
            'shipping_cost', 'shipping_method', 'shipping_rate_name',
            'shipping_estimated_days', 'shipping_carrier', 'tracking_number', 'tracking_url',
            'staff_notes', 'total', 'payment_method', 'payment_id',
            'payment_status', 'payment_capture_mode', 'payment_authorized_amount',
            'payment_captured_amount',
            'items', 'invoice', 'invoice_url', 'refunds', 'payment_logs', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_invoice_url(self, obj):
        return f'/api/admin/orders/{obj.pk}/invoice/'

    def get_payment_logs(self, obj):
        logs = sorted(
            obj.payment_logs.all(), key=lambda log: log.created_at, reverse=True,
        )[:5]
        return [
            {
                'transaction_id': log.transaction_id,
                'gateway': log.gateway,
                'amount': str(log.amount),
                'status': log.status,
                'created_at': log.created_at
            }
            for log in logs
        ]


class OrderAdminUpdateSerializer(serializers.ModelSerializer):
    """Admin serializer for updating order status and details."""
    class Meta:
        model = Order
        fields = [
            'status', 'shipping_name', 'shipping_phone',
            'shipping_address_line1', 'shipping_address_line2', 'shipping_city',
            'shipping_state', 'shipping_postal_code', 'shipping_country',
            'shipping_carrier', 'tracking_number', 'tracking_url', 'staff_notes'
        ]

    def validate_status(self, value):
        if value == 'AWAITING_PAYMENT':
            raise serializers.ValidationError('An order returns to awaiting payment only through checkout.')
        return value

    def update(self, instance, validated_data):
        old_status = instance.status
        old_tracking = instance.tracking_url
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Send shipping notification if order becomes SHIPPED or tracking URL is updated
        if (instance.status == 'SHIPPED' and old_status != 'SHIPPED') or (instance.tracking_url and instance.tracking_url != old_tracking):
            try:
                from .email_service import send_order_email
                send_order_email('order_shipped', instance)
            except Exception:
                pass

        return instance


class RefundAdminSerializer(serializers.ModelSerializer):
    """Admin serializer for refund management."""
    order_id = serializers.IntegerField(source='order.id', read_only=True)
    region_code = serializers.CharField(source='region.code', read_only=True)
    admin_email = serializers.CharField(source='created_by.email', read_only=True, allow_null=True)

    class Meta:
        model = Refund
        fields = [
            'id', 'order', 'order_id', 'region_code', 'amount', 'currency_code',
            'gateway', 'reason', 'status', 'refund_transaction_id',
            'is_partial', 'admin_email', 'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'refund_transaction_id']


class InvoiceAdminSerializer(serializers.ModelSerializer):
    """Admin serializer for invoice management."""
    order_id = serializers.IntegerField(source='order.id', read_only=True)
    invoice_url = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = [
            'id', 'order', 'order_id', 'invoice_number', 'invoice_type',
            'invoice_url', 'details', 'generated_at'
        ]
        read_only_fields = ['id', 'generated_at']

    def get_invoice_url(self, obj):
        return f'/api/admin/orders/{obj.order_id}/invoice/'


class CouponAdminSerializer(serializers.ModelSerializer):
    region_code = serializers.CharField(source='region.code', read_only=True, allow_null=True)

    class Meta:
        model = Coupon
        fields = [
            'id', 'code', 'discount_type', 'value', 'region', 'region_code',
            'min_spend', 'start_date', 'end_date', 'is_active',
            'usage_limit', 'usage_count', 'created_at',
        ]
        read_only_fields = ['id', 'usage_count', 'created_at']
