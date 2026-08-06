from decimal import Decimal, InvalidOperation
import hashlib
import json
import logging
import os
import re

from rest_framework import viewsets, status, views, generics
from rest_framework.pagination import PageNumberPagination
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db import IntegrityError, transaction
from django.db.models import Sum, Q, Prefetch
from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.utils import timezone
from apps.regions.models import Region, Warehouse
from apps.products.models import Product, ProductRegionConfig, ProductVariant
from apps.products.pricing import resolve_price, resolve_variant_price
from apps.inventory.models import StockLevel
from apps.users.permissions import require_permission
from .models import Cart, CartItem, Order, OrderItem, Invoice, PaymentLog, Refund, AuditLog, Coupon, WebhookEvent
from .serializers import (
    CartSerializer, OrderSerializer, RefundSerializer,
    OrderAdminSerializer, OrderAdminUpdateSerializer, RefundAdminSerializer, InvoiceAdminSerializer,
    CouponAdminSerializer,
)
from .utils import generate_invoice_pdf
from .payments import resolve_gateway, refund_payment, PaymentError
from .pricing import quote_cart, PricingError
from .email_service import send_order_email, send_owner_order_notification
from apps.admin_dashboard.models import PaymentGateway, SystemSetting
from apps.audit.recorder import record_audit
from .payments import get_adapter


logger = logging.getLogger(__name__)
PHONE_PATTERN = re.compile(r'^[+\d][\d\s().-]*$')


def _clean_text(value):
    return str(value or '').strip()


def _valid_phone(value):
    digits = re.sub(r'\D', '', value)
    return bool(PHONE_PATTERN.fullmatch(value)) and 7 <= len(digits) <= 15


def _requested_variant(product, data):
    """Return the requested active variant, defaulting to the first option.

    Older clients nested variant details under ``metadata`` while newer clients
    send ``variant_sku`` directly. Supporting both keeps carts compatible during
    a rolling frontend/backend deployment.
    """
    metadata = data.get('metadata') if isinstance(data.get('metadata'), dict) else {}
    requested_sku = _clean_text(data.get('variant_sku') or metadata.get('variant_sku'))
    active = product.variants.filter(is_active=True).order_by('sort_order', 'id')
    if requested_sku:
        return active.filter(sku=requested_sku).first(), requested_sku
    return active.first(), ''


def _available_for_variant(product, region, variant=None):
    region_stock = _region_total_available_stock(product, region)
    if variant is None:
        return region_stock
    return min(region_stock, variant.stock_qty)


def _select_cart_item(cart, data):
    cart_item_id = data.get('cart_item_id')
    if cart_item_id:
        return cart.items.filter(id=cart_item_id).first(), None

    product_id = data.get('product_id')
    if not product_id:
        return None, 'cart_item_id or product_id is required'
    queryset = cart.items.filter(product_id=product_id)
    metadata = data.get('metadata') if isinstance(data.get('metadata'), dict) else {}
    variant_sku = _clean_text(data.get('variant_sku') or metadata.get('variant_sku'))
    if variant_sku:
        queryset = queryset.filter(variant_sku=variant_sku)
    if queryset.count() > 1:
        return None, 'This product has multiple options in the cart; cart_item_id is required.'
    return queryset.first(), None


def _region_warehouse_queryset(region):
    return Warehouse.objects.filter(region=region, is_active=True).order_by('id')


def _region_stock_queryset(product, region, *, for_update=False):
    queryset = StockLevel.objects.filter(
        product=product,
        warehouse__in=_region_warehouse_queryset(region),
    ).select_related('warehouse')
    if for_update:
        queryset = queryset.select_for_update()
    return queryset.order_by('-available', 'warehouse_id', 'id')


def _region_total_available_stock(product, region):
    return _region_stock_queryset(product, region).aggregate(
        total=Sum('available')
    )['total'] or 0


def _deduct_region_stock(product, region, quantity):
    remaining = quantity
    stock_rows = list(_region_stock_queryset(product, region, for_update=True))
    total_available = sum(stock.available for stock in stock_rows)
    if total_available < quantity:
        raise PaymentError(
            f"Product {product.name} is out of stock in this region."
        )

    for stock in stock_rows:
        if remaining <= 0:
            break
        take = min(stock.available, remaining)
        if take <= 0:
            continue
        stock.available -= take
        stock.save(update_fields=['available', 'updated_at'])
        remaining -= take


def _deduct_variant_stock(product, variant_sku, quantity):
    if not variant_sku:
        return
    variant = ProductVariant.objects.select_for_update().filter(
        product=product, sku=variant_sku, is_active=True,
    ).first()
    if variant is None:
        raise PaymentError(f"The selected option for {product.name} is no longer available.")
    if variant.stock_qty < quantity:
        raise PaymentError(f"Only {variant.stock_qty} units of {variant.name} are available.")
    variant.stock_qty -= quantity
    variant.save(update_fields=['stock_qty', 'updated_at'])


def _restock_region_item(product, region, quantity):
    stock_rows = list(_region_stock_queryset(product, region, for_update=True))
    if stock_rows:
        target = stock_rows[0]
    else:
        warehouse = _region_warehouse_queryset(region).first()
        if not warehouse:
            return
        target, _created = StockLevel.objects.get_or_create(
            warehouse=warehouse,
            product=product,
            defaults={'available': 0, 'reserved': 0, 'low_stock_threshold': 10},
        )
    target.available += quantity
    target.save(update_fields=['available', 'updated_at'])


def _restock_variant_item(product, variant_sku, quantity):
    if not variant_sku:
        return
    variant = ProductVariant.objects.select_for_update().filter(
        product=product, sku=variant_sku,
    ).first()
    if variant is None:
        logger.warning(
            'Could not restock removed variant %s for product %s.',
            variant_sku,
            product.pk,
        )
        return
    variant.stock_qty += quantity
    variant.save(update_fields=['stock_qty', 'updated_at'])


def _run_checkout_followups(order_id):
    """Run non-critical work only after the sale transaction has committed."""
    try:
        order = Order.objects.select_related('region').get(pk=order_id)
    except Order.DoesNotExist:
        logger.error('Committed checkout order %s could not be reloaded.', order_id)
        return

    try:
        if not send_order_email('order_confirmation', order):
            logger.warning('Order confirmation for order %s was queued for retry.', order_id)
    except Exception:
        logger.exception('Order confirmation scheduling failed for order %s.', order_id)

    try:
        send_owner_order_notification(order)
    except Exception:
        logger.exception('Owner notification failed for order %s.', order_id)

    try:
        from .fraud import assess_order
        assess_order(order)
    except Exception:
        logger.exception('Fraud assessment failed for order %s.', order_id)


def _send_order_event_with_logging(event, order_id, *, extra_context=None):
    try:
        order = Order.objects.select_related('region').get(pk=order_id)
        if not send_order_email(event, order, extra_context=extra_context):
            logger.warning('%s email for order %s was queued for retry.', event, order_id)
    except Exception:
        logger.exception('%s email scheduling failed for order %s.', event, order_id)


class MyOrdersView(generics.ListAPIView):
    """Order history for the authenticated customer.

    Matches by linked user OR by the account email (guest checkouts placed with
    the same email before linking), newest first.
    """
    serializer_class = OrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        return (
            # A shopper should only see a completed sale in order history.
            # Unpaid attempts are retained for recovery/reconciliation but are
            # deliberately not presented as an order.
            Order.objects.filter(
                Q(user=user) | Q(email__iexact=user.email),
                payment_status__in=['PAID', 'PARTIALLY_CAPTURED', 'REFUNDED'],
            )
            .prefetch_related(
                Prefetch('items', queryset=OrderItem.objects.select_related('product')),
                'refunds',
            )
            .select_related('invoice')
            .order_by('-created_at')
            .distinct()
        )


class PublicOrderDetailView(views.APIView):
    """Public lookup endpoint for order confirmation screen.

    Allows fetching order details by ID and matching email for guest or registered shoppers.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        order_id = request.query_params.get('id')
        email = (request.query_params.get('email') or '').strip()

        if not order_id:
            return Response({'error': 'Order ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        qs = Order.objects.filter(pk=order_id).prefetch_related(
            Prefetch('items', queryset=OrderItem.objects.select_related('product')),
            'refunds'
        ).select_related('invoice', 'region')

        if email:
            qs = qs.filter(email__iexact=email)

        order = qs.first()
        if not order:
            return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response(OrderSerializer(order).data, status=status.HTTP_200_OK)


class CartViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]

    def get_cart(self, session_id, region_code):

        region = get_object_or_404(Region, code=region_code, is_active=True)
        cart, created = Cart.objects.get_or_create(
            session_id=session_id,
            defaults={'region': region}
        )
        
        # Regional protection: if the region of the active session changes,
        # we automatically clear the cart items and update the region to avoid conflicts.
        if cart.region != region:
            cart.items.all().delete()
            cart.region = region
            cart.save()
            
        return cart

    def retrieve(self, request):
        session_id = request.query_params.get('session_id')
        region_code = request.query_params.get('region', 'UK').upper()
        
        if not session_id:
            return Response({"error": "session_id query param is required"}, status=status.HTTP_400_BAD_REQUEST)
            
        cart = self.get_cart(session_id, region_code)
        serializer = CartSerializer(cart, context={'region': cart.region})
        return Response(serializer.data)

    @transaction.atomic
    def add_item(self, request):
        session_id = _clean_text(request.data.get('session_id'))
        region_code = _clean_text(request.data.get('region', 'UK')).upper()
        product_id = request.data.get('product_id')
        try:
            quantity = int(request.data.get('quantity', 1))
        except (TypeError, ValueError):
            return Response({"error": "quantity must be a positive integer"}, status=status.HTTP_400_BAD_REQUEST)
        if quantity <= 0:
            return Response({"error": "quantity must be a positive integer"}, status=status.HTTP_400_BAD_REQUEST)

        if not session_id or not product_id:
            return Response({"error": "session_id and product_id are required"}, status=status.HTTP_400_BAD_REQUEST)

        cart = self.get_cart(session_id, region_code)
        cart = Cart.objects.select_for_update().get(pk=cart.pk)
        product = get_object_or_404(Product, id=product_id, is_active=True, is_archived=False)
        variant, requested_sku = _requested_variant(product, request.data)
        if requested_sku and variant is None:
            return Response(
                {"error": "The selected product option is unavailable."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Verify the product is sellable here — same resolver as the catalogue
        # and checkout, so a shopper can add exactly what they can see and buy.
        if resolve_price(product, cart.region)[0] is None:
            return Response({"error": "Product is not available in your region."}, status=status.HTTP_400_BAD_REQUEST)
        if variant is not None and resolve_variant_price(variant, cart.region) is None:
            return Response(
                {"error": "The selected product option has no price in this region."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check stock level in this region's warehouses
        total_available = _available_for_variant(product, cart.region, variant)

        # A variant is part of a cart line's identity. Two sizes of the same
        # product must never collapse into one line and silently change price.
        variant_sku = variant.sku if variant else ''
        cart_item, created = CartItem.objects.get_or_create(
            cart=cart,
            product=product,
            variant_sku=variant_sku,
            defaults={'variant_name': variant.name if variant else ''},
        )
        requested_quantity = quantity if created else cart_item.quantity + quantity
        if total_available < requested_quantity:
            return Response(
                {"error": f"Only {total_available} units are available in your region's stock."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not created:
            cart_item.quantity += quantity
        else:
            cart_item.quantity = quantity
        cart_item.variant_name = variant.name if variant else ''
        cart_item.save(update_fields=['quantity', 'variant_name', 'updated_at'])

        return Response(CartSerializer(cart, context={'region': cart.region}).data)

    @transaction.atomic
    def update_item(self, request):
        session_id = _clean_text(request.data.get('session_id'))
        region_code = _clean_text(request.data.get('region', 'UK')).upper()
        try:
            quantity = int(request.data.get('quantity', 1))
        except (TypeError, ValueError):
            return Response({"error": "quantity must be an integer"}, status=status.HTTP_400_BAD_REQUEST)

        if not session_id:
            return Response({"error": "session_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        cart = self.get_cart(session_id, region_code)
        cart = Cart.objects.select_for_update().get(pk=cart.pk)
        cart_item, selection_error = _select_cart_item(cart, request.data)
        if selection_error:
            return Response({"error": selection_error}, status=status.HTTP_400_BAD_REQUEST)
        if cart_item is None:
            return Response({"error": "Cart item was not found."}, status=status.HTTP_404_NOT_FOUND)

        if quantity <= 0:
            cart_item.delete()
        else:
            # Verify stock
            variant = None
            if cart_item.variant_sku:
                variant = cart_item.product.variants.filter(
                    sku=cart_item.variant_sku, is_active=True,
                ).first()
                if variant is None:
                    return Response(
                        {"error": "The selected product option is no longer available."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            total_available = _available_for_variant(cart_item.product, cart.region, variant)
            if total_available < quantity:
                return Response({"error": f"Only {total_available} units available in stock."}, status=status.HTTP_400_BAD_REQUEST)
                
            cart_item.quantity = quantity
            cart_item.save()

        return Response(CartSerializer(cart, context={'region': cart.region}).data)

    @transaction.atomic
    def remove_item(self, request):
        session_id = _clean_text(request.data.get('session_id'))
        region_code = _clean_text(request.data.get('region', 'UK')).upper()

        if not session_id:
            return Response({"error": "session_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        cart = self.get_cart(session_id, region_code)
        cart = Cart.objects.select_for_update().get(pk=cart.pk)
        cart_item, selection_error = _select_cart_item(cart, request.data)
        if selection_error:
            return Response({"error": selection_error}, status=status.HTTP_400_BAD_REQUEST)
        if cart_item:
            cart_item.delete()

        return Response(CartSerializer(cart, context={'region': cart.region}).data)


class CreatePaymentIntentView(views.APIView):
    """Open a gateway payment for the current cart.

    POST /api/checkout/payment-intent/
    Body: { session_id, region, country?, state?, postal_code?, coupon_code? }

    The amount is always derived server-side from the cart via quote_cart(); a
    client-supplied amount is never trusted. Returns the data the browser SDK
    needs to collect payment, after which /api/checkout/ verifies the result.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'checkout'

    def post(self, request):
        session_id = _clean_text(request.data.get('session_id'))
        region_code = _clean_text(request.data.get('region')).upper()
        if not session_id or not region_code:
            return Response({"error": "session_id and region are required."},
                            status=status.HTTP_400_BAD_REQUEST)

        region = get_object_or_404(Region, code=region_code, is_active=True)
        cart = (
            Cart.objects.filter(session_id=session_id, region=region)
            .prefetch_related('items__product__variants')
            .first()
        )
        if not cart or not cart.items.exists():
            return Response({"error": "Cart is empty or invalid."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            quote = quote_cart(
                region, cart,
                country=_clean_text(request.data.get('country')).upper(),
                state=_clean_text(request.data.get('state')),
                city=_clean_text(request.data.get('city')),
                postal_code=_clean_text(request.data.get('postal_code')),
                coupon_code=_clean_text(request.data.get('coupon_code')),
                shipping_rate_id=request.data.get('shipping_rate_id'),
            )
        except PricingError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        method = (request.data.get('payment_method') or '').upper()
        try:
            adapter = resolve_gateway(region, method)
        except PaymentError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        try:
            intent = adapter.create_intent(quote['total'], region.currency_code, {
                'session_id': session_id,
                'region': region.code,
            })
        except NotImplementedError:
            return Response(
                {"error": f"{method} does not support browser payment collection."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except PaymentError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_402_PAYMENT_REQUIRED)

        # Echo the amount so the UI can show exactly what will be charged.
        intent['amount'] = str(quote['total'])
        intent['currency'] = region.currency_code
        return Response(intent, status=status.HTTP_200_OK)


class ApplyCouponView(views.APIView):
    """
    Validate a coupon code and calculate discount.
    POST /api/checkout/apply-coupon/
    Body: { "code": "SAVE10", "region": "IN", "subtotal": 5000 }
    """
    permission_classes = [AllowAny]
    throttle_scope = 'checkout'

    def post(self, request):
        from decimal import Decimal, InvalidOperation
        code = request.data.get('code')
        region_code = request.data.get('region', 'UK').upper()
        try:
            subtotal = Decimal(str(request.data.get('subtotal', 0)))
        except (InvalidOperation, ValueError, TypeError):
            return Response({"error": "Invalid subtotal amount"}, status=status.HTTP_400_BAD_REQUEST)

        if not code:
            return Response({"error": "Coupon code is required"}, status=status.HTTP_400_BAD_REQUEST)

        region = Region.objects.filter(code=region_code, is_active=True).first()
        if not region:
            return Response({"error": "Invalid region"}, status=status.HTTP_400_BAD_REQUEST)

        coupon = Coupon.objects.filter(code__iexact=code, is_active=True).first()
        if not coupon:
            return Response({"error": "Invalid or expired coupon code."}, status=status.HTTP_404_NOT_FOUND)

        now = timezone.now()
        if coupon.start_date and coupon.start_date > now:
            return Response({"error": "This coupon is not active yet."}, status=status.HTTP_400_BAD_REQUEST)
        if coupon.end_date and coupon.end_date < now:
            return Response({"error": "This coupon has expired."}, status=status.HTTP_400_BAD_REQUEST)

        if coupon.region and coupon.region != region:
            return Response({"error": f"This coupon is only valid for the {coupon.region.code} region."}, status=status.HTTP_400_BAD_REQUEST)

        if subtotal < coupon.min_spend:
            currency = region.currency_symbol
            return Response({"error": f"Minimum spend of {currency}{coupon.min_spend} is required for this coupon."}, status=status.HTTP_400_BAD_REQUEST)

        if coupon.usage_limit and coupon.usage_count >= coupon.usage_limit:
            return Response({"error": "This coupon usage limit has been reached."}, status=status.HTTP_400_BAD_REQUEST)

        if coupon.discount_type == 'PERCENTAGE':
            discount_val = Decimal(str(coupon.value))
            discount_amount = subtotal * (discount_val / Decimal('100.00'))
        elif coupon.discount_type in ['FIXED_AMOUNT', 'TIERED']:
            discount_amount = Decimal(str(coupon.value))
            
        discount_amount = min(discount_amount, subtotal)

        return Response({
            "code": coupon.code,
            "discount_type": coupon.discount_type,
            "value": float(coupon.value),
            "discount_amount": float(discount_amount)
        })


class CheckoutView(views.APIView):
    permission_classes = [AllowAny]
    throttle_scope = 'checkout'

    @transaction.atomic
    def post(self, request):
        from decimal import Decimal
        session_id = _clean_text(request.data.get('session_id'))
        region_code = _clean_text(request.data.get('region', 'UK')).upper()
        
        # Contact and Address info
        email = _clean_text(request.data.get('email')).lower()
        shipping_name = _clean_text(request.data.get('shipping_name'))
        shipping_phone = _clean_text(request.data.get('shipping_phone'))
        address_line1 = _clean_text(request.data.get('shipping_address_line1'))
        address_line2 = _clean_text(request.data.get('shipping_address_line2', ''))
        city = _clean_text(request.data.get('shipping_city'))
        state = _clean_text(request.data.get('shipping_state'))
        postal_code = _clean_text(request.data.get('shipping_postal_code'))
        country = _clean_text(request.data.get('shipping_country')).upper()
        
        payment_method = _clean_text(request.data.get('payment_method')).upper()
        payment_id = _clean_text(request.data.get('payment_id', 'sandbox_mock_id'))
        # Razorpay's browser handshake returns an order id + signature alongside
        # the payment id; the adapter needs both to verify the callback is genuine.
        gateway_payload = {
            "payment_id": payment_id,
            "razorpay_order_id": request.data.get('razorpay_order_id'),
            "razorpay_signature": request.data.get('razorpay_signature'),
        }

        required = {
            'session_id': session_id,
            'email': email,
            'shipping_name': shipping_name,
            'shipping_phone': shipping_phone,
            'shipping_address_line1': address_line1,
            'shipping_city': city,
            'shipping_state': state,
            'shipping_postal_code': postal_code,
            'shipping_country': country,
            'payment_method': payment_method,
        }
        missing = [field for field, value in required.items() if not value]
        if missing:
            return Response(
                {"error": f"Missing required checkout field: {missing[0].replace('_', ' ')}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            validate_email(email)
        except DjangoValidationError:
            return Response({"error": "Enter a valid email address."}, status=status.HTTP_400_BAD_REQUEST)
        if not _valid_phone(shipping_phone):
            return Response(
                {"error": "Enter a valid phone number with 7 to 15 digits."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(country) != 2:
            return Response({"error": "Enter a valid two-letter country code."}, status=status.HTTP_400_BAD_REQUEST)

        from apps.admin_dashboard.store_config import get_guest_checkout_enabled

        if not request.user.is_authenticated and not get_guest_checkout_enabled():
            return Response(
                {"error": "Guest checkout is currently disabled. Please sign in to continue."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # 1. Fetch Region & Cart
        region = get_object_or_404(Region, code=region_code, is_active=True)
        # Serialize checkout completion for one cart. This prevents double-clicks
        # or client retries from deducting stock and creating two orders while
        # the first payment completion is still committing.
        cart = (
            Cart.objects.select_for_update().filter(session_id=session_id, region=region)
            .prefetch_related('items__product__variants')
            .first()
        )
        if not cart or not cart.items.exists():
            return Response({"error": "Cart is empty or invalid."}, status=status.HTTP_400_BAD_REQUEST)

        # 1b. Smart gateway routing
        try:
            gateway_adapter = resolve_gateway(region, payment_method)
        except PaymentError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Price the cart. Shared with the payment-intent endpoint so the amount
        #    authorised by the gateway always equals the amount charged here.
        coupon_code = request.data.get('coupon_code')
        try:
            quote = quote_cart(
                region, cart,
                country=country, state=state, city=city, postal_code=postal_code,
                coupon_code=coupon_code,
                shipping_rate_id=request.data.get('shipping_rate_id'),
            )
        except PricingError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        subtotal = quote['subtotal']
        discount_amount = quote['discount_amount']
        tax_rate = quote['tax_rate']
        tax_mode = quote['tax_mode']
        rate_factor = quote['rate_factor']
        tax_amount = quote['tax_amount']
        shipping_cost = quote['shipping_cost']
        shipping_option = quote['shipping_option']
        total = quote['total']
        order_items_to_create = quote['items']

        # Lock a limited coupon before stock changes. Without this, two carts
        # can both observe the final use and exceed its configured usage limit.
        coupon = None
        if quote['coupon'] and discount_amount > 0:
            coupon = Coupon.objects.select_for_update().get(pk=quote['coupon'].pk)
            if coupon.usage_limit and coupon.usage_count >= coupon.usage_limit:
                return Response(
                    {"error": "This coupon has reached its usage limit."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        # 2b. Verify stock & deduct (side effects kept out of the pricing math).
        # The nested savepoint guarantees a concurrency failure on a later cart
        # line cannot commit deductions already made for earlier lines.
        try:
            with transaction.atomic():
                for product, variant, qty, _price in order_items_to_create:
                    _deduct_region_stock(product, region, qty)
                    _deduct_variant_stock(
                        product,
                        variant.sku if variant else '',
                        qty,
                    )
        except PaymentError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        # 2c. Consume the coupon only once the sale is actually going through.
        if coupon is not None:
            coupon.usage_count += 1
            coupon.save(update_fields=['usage_count'])

        # 4. Create Order
        user = request.user if request.user.is_authenticated else None
        order = Order.objects.create(
            user=user,
            region=region,
            status='PROCESSING', # Auto-completed payment in sandbox
            email=email,
            shipping_name=shipping_name,
            shipping_phone=shipping_phone,
            shipping_address_line1=address_line1,
            shipping_address_line2=address_line2,
            shipping_city=city,
            shipping_state=state,
            shipping_postal_code=postal_code,
            shipping_country=country,
            currency_code=region.currency_code,
            subtotal=subtotal,
            tax_rate=tax_rate,
            tax_amount=tax_amount,
            shipping_cost=shipping_cost,
            shipping_method=shipping_option['method'],
            shipping_rate_name=shipping_option['name'],
            shipping_estimated_days=shipping_option['estimated_days'],
            coupon_code=coupon_code if discount_amount > 0 else None,
            discount_amount=discount_amount,
            total=total,
            payment_method=payment_method,
            payment_id=payment_id
        )

        # 5. Create Order Items
        for product, variant, qty, price in order_items_to_create:
            # Per-line tax portion, consistent with the store tax mode.
            line_gross = price * qty
            if tax_mode == 'inclusive':
                line_net = (line_gross / (Decimal('1') + rate_factor)) if rate_factor else line_gross
                item_tax = (line_gross - line_net).quantize(Decimal('0.01'))
            else:
                item_tax = (line_gross * rate_factor).quantize(Decimal('0.01'))
            OrderItem.objects.create(
                order=order,
                product=product,
                variant_sku=variant.sku if variant else '',
                variant_name=variant.name if variant else '',
                quantity=qty,
                price=price,
                tax_amount=item_tax
            )

        # 6. Charge via the routed gateway adapter (sandbox until live keys are set).
        try:
            charge = gateway_adapter.charge(order, gateway_payload)
        except PaymentError as exc:
            # Catching the error would normally let the surrounding atomic
            # block COMMIT the order, stock deduction and coupon use for a
            # payment that never happened. Explicitly mark the transaction for
            # rollback so a failed charge leaves no trace.
            transaction.set_rollback(True)
            return Response({"error": str(exc)}, status=status.HTTP_402_PAYMENT_REQUIRED)

        order.payment_id = charge.get("transaction_id", payment_id)
        # COD has no captured payment yet -> keep PENDING; online success -> PROCESSING.
        order.status = 'PENDING' if charge.get("status") == 'PENDING' else 'PROCESSING'
        if charge.get("status") == 'PENDING':
            order.payment_status = 'PENDING'
            order.payment_captured_amount = Decimal('0.00')
        else:
            order.payment_status = 'PAID'
            order.payment_captured_amount = total
        order.payment_authorized_amount = total
        order.payment_capture_mode = 'AUTO'
        order.save(update_fields=[
            'payment_id', 'status', 'payment_status', 'payment_captured_amount',
            'payment_authorized_amount', 'payment_capture_mode',
        ])

        PaymentLog.objects.create(
            order=order,
            transaction_id=charge.get("transaction_id", payment_id),
            gateway=payment_method,
            amount=total,
            status=charge.get("status", "SUCCESS"),
            raw_response=charge.get("raw", {}),
        )

        # 7. Generate the invoice. A rendering/font/filesystem problem must not
        # roll back a payment-confirmed sale; the admin download endpoint can
        # regenerate a missing PDF later.
        invoice_number = f"SP-{order.created_at.year}-{order.id:05d}"
        pdf_relative_path = ''
        try:
            pdf_relative_path, invoice_number = generate_invoice_pdf(order)
        except Exception:
            logger.exception('Invoice PDF generation failed for order %s.', order.id)
        
        # Save invoice record
        invoice_details = {
            "tax_reg_number": (
                f"GSTIN: {settings.IN_GSTIN}"
                if region_code == 'IN'
                else f"VAT: {settings.UK_VAT_NUMBER}"
            ),
            "invoice_type": "GST Tax Invoice" if region_code == 'IN' else "VAT Receipt",
            "hsn_summary": [
                {
                    "hsn_code": item.product.hsn_code or '',
                    "quantity": item.quantity,
                    "tax_amount": str(item.tax_amount),
                }
                for item in order.items.select_related('product')
            ] if region_code == 'IN' else [],
        }
        
        Invoice.objects.create(
            order=order,
            invoice_number=invoice_number,
            invoice_type='GST_INVOICE' if region_code == 'IN' else 'VAT_RECEIPT',
            pdf_file=pdf_relative_path,
            details=invoice_details
        )

        # 8. Clear Cart
        cart.items.all().delete()
        
        # Email and fraud checks must never run against an order that later
        # rolls back. The callback catches and logs its own failures so a
        # committed checkout always returns its successful response.
        transaction.on_commit(
            lambda order_id=order.id: _run_checkout_followups(order_id)
        )

        return Response({
            "message": "Checkout completed successfully!",
            "order": OrderSerializer(order).data
        }, status=status.HTTP_201_CREATED)


def get_user_refund_limit(user, region_code):
    if not user or not user.is_authenticated:
        return Decimal('0.00')
    if user.is_superuser:
        return Decimal('Infinity')
        
    roles = [r.name for r in user.roles.all()]
    if 'Admin' in roles or 'Super Admin' in roles:
        return Decimal('Infinity')
        
    setting = SystemSetting.objects.filter(key='REFUND_LIMITS').first()
    values = setting.value if setting and isinstance(setting.value, dict) else {}
    role_limits = values.get('role_limits', {})
    fallback = values.get('staff_fallback', {})

    limit = Decimal('0.00')
    for role in roles:
        try:
            candidate = Decimal(str((role_limits.get(role) or {}).get(region_code, '0')))
        except (InvalidOperation, TypeError, ValueError):
            candidate = Decimal('0.00')
        limit = max(limit, candidate)

    if not roles and user.is_staff:
        try:
            limit = max(limit, Decimal(str(fallback.get(region_code, '0'))))
        except (InvalidOperation, TypeError, ValueError):
            pass

    return max(limit, Decimal('0.00'))


class RefundView(views.APIView):
    """
    Issue a refund against an order.
    POST /api/orders/<order_id>/refund/
    Body: { "amount": <optional, defaults to remaining>, "reason": "", "restock": false }

    Integrity guarantees (enforced by refund_payment):
      * routed through the order's ORIGINAL gateway,
      * locked to the order's ORIGINAL currency,
      * cannot exceed the order total across all refunds.
    """
    permission_classes = [require_permission('orders.refund')]

    @transaction.atomic
    def post(self, request, order_id):
        # Lock the order while calculating its remaining refundable balance so
        # concurrent admin requests cannot both refund the same funds.
        order = get_object_or_404(Order.objects.select_for_update(), id=order_id)

        if not order.payment_id:
            return Response({"error": "Refund failed: Original transaction ID is missing."}, status=status.HTTP_400_BAD_REQUEST)
        if order.payment_status not in ['PAID', 'PARTIALLY_CAPTURED']:
            return Response({"error": f"Refund failed: Order payment status is '{order.payment_status}' (must be Paid or Partially Captured)."}, status=status.HTTP_400_BAD_REQUEST)

        if order.status == 'REFUNDED':
            return Response({"error": "Order is already fully refunded."}, status=status.HTTP_400_BAD_REQUEST)

        # How much has already been refunded (pending or processed)?
        already = order.refunds.filter(
            status__in=['PENDING', 'PROCESSED']
        ).aggregate(s=Sum('amount'))['s'] or Decimal('0.00')
        remaining = order.total - already

        raw_amount = request.data.get('amount')
        if raw_amount in (None, ''):
            amount = remaining
        else:
            try:
                amount = Decimal(str(raw_amount))
            except (InvalidOperation, TypeError):
                return Response({"error": "Invalid refund amount."}, status=status.HTTP_400_BAD_REQUEST)

        if amount <= 0:
            return Response({"error": "Refund amount must be positive."}, status=status.HTTP_400_BAD_REQUEST)
        if amount > remaining:
            return Response(
                {"error": f"Refund exceeds the refundable balance ({remaining} {order.currency_code})."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Gating Check: check if amount exceeds user refund limits
        limit = get_user_refund_limit(request.user, order.region.code)
        if amount > limit:
            from apps.admin_dashboard.models import ApprovalRequest
            payload = {
                'order_id': order.id,
                'amount': float(amount),
                'reason': request.data.get('reason', ''),
                'restock': str(request.data.get('restock', '')).lower() in ('1', 'true', 'yes')
            }
            details = {
                'order_id': order.id,
                'amount': float(amount),
                'currency_code': order.currency_code,
                'region_code': order.region.code if order.region else 'UK',
                'reason': request.data.get('reason', ''),
                'requester_role': ', '.join([r.name for r in request.user.roles.all()]) or 'Staff'
            }
            summary = f"Refund of {order.currency_code} {amount:.2f} for Order #{order.id} (exceeds {request.user.email} limit)"
            
            ApprovalRequest.objects.create(
                requester=request.user,
                request_type='REFUND',
                status='PENDING',
                summary=summary,
                details=details,
                payload=payload
            )
            
            return Response(
                {
                    "message": f"Refund of {order.currency_code} {amount:.2f} exceeds your role limit. An approval request has been queued for authorization.",
                    "approval_queued": True
                },
                status=status.HTTP_202_ACCEPTED
            )

        reason = request.data.get('reason', '')

        # Route through the original gateway + currency.
        try:
            result = refund_payment(order, amount, reason)
        except PaymentError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        is_full = (already + amount) >= order.total
        refund = Refund.objects.create(
            order=order,
            amount=amount,
            currency_code=result['currency_code'],
            gateway=result['gateway'],
            reason=reason,
            status='PROCESSED' if result.get('status') == 'REFUNDED' else 'PENDING',
            refund_transaction_id=result.get('refund_id', ''),
            is_partial=not is_full,
            created_by=request.user if request.user.is_authenticated else None,
        )

        # Optionally return stock to the region's warehouse.
        if str(request.data.get('restock', '')).lower() in ('1', 'true', 'yes'):
            for item in order.items.all():
                _restock_region_item(item.product, order.region, item.quantity)
                _restock_variant_item(
                    item.product, item.variant_sku, item.quantity,
                )

        if is_full:
            order.status = 'REFUNDED'
            order.save(update_fields=['status'])

        PaymentLog.objects.create(
            order=order,
            transaction_id=refund.refund_transaction_id or f"refund_{refund.id}",
            gateway=order.payment_method,
            amount=amount,
            status=f"REFUND_{refund.status}",
            raw_response=result.get('raw', {}),
        )

        transaction.on_commit(lambda order_id=order.id, refund_amount=str(amount): (
            _send_order_event_with_logging(
                'refund_processed', order_id,
                extra_context={'refund_amount': refund_amount},
            )
        ))

        return Response(
            {"message": "Refund processed.", "refund": RefundSerializer(refund).data},
            status=status.HTTP_201_CREATED,
        )


# --- Admin ViewSets for Regional CRUD Operations --- #

class AdminDashboardPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


class OrderAdminViewSet(viewsets.ModelViewSet):
    """
    Admin CRUD operations for orders with regional filters.
    Requires 'orders.manage' permission when RBAC is enforced.
    Supports regional filtering via ?region=IN,UK,US and status filtering via ?status=PENDING,PROCESSING
    """
    permission_classes = [require_permission('orders.manage')]
    pagination_class = AdminDashboardPagination

    def get_permissions(self):
        if self.action in ('list', 'retrieve', 'invoice', 'by_region', 'timeline'):
            return [require_permission('orders.view')()]
        return [require_permission('orders.manage')()]

    def get_queryset(self):
        queryset = Order.objects.select_related('user', 'region', 'invoice').prefetch_related(
            Prefetch('items', queryset=OrderItem.objects.select_related('product')),
            'refunds', 'payment_logs',
        )
        # The Orders workspace is for money-received sales only. Pending or
        # failed attempts remain available to the recovery/reconciliation
        # workflow, never mixed into fulfilment work.
        queryset = queryset.filter(
            payment_status__in=['PAID', 'PARTIALLY_CAPTURED', 'REFUNDED']
        )
        
        # Enforce Regional Restrictions for Country Managers
        user = self.request.user
        if user and user.is_authenticated and not user.is_superuser:
            assigned_regions = user.assigned_regions.all()
            if assigned_regions.exists():
                queryset = queryset.filter(region__in=assigned_regions)

        region_code = self.request.query_params.get('region')
        status_filter = self.request.query_params.get('status')
        email_filter = self.request.query_params.get('email')

        if region_code:
            queryset = queryset.filter(region__code=region_code.upper())
        if status_filter and status_filter.upper() != 'ALL':
            queryset = queryset.filter(status=status_filter.upper())
        if email_filter:
            queryset = queryset.filter(email__icontains=email_filter)

        # Advanced Search parameters
        search_query = self.request.query_params.get('search')
        if search_query:
            search_query = search_query.strip()
            id_filter = Q()
            if search_query.isdigit():
                id_filter = Q(id=int(search_query))
            queryset = queryset.filter(
                id_filter |
                Q(email__icontains=search_query) |
                Q(shipping_name__icontains=search_query) |
                Q(payment_id__icontains=search_query)
            )

        # Payment Status parameter
        payment_status_filter = self.request.query_params.get('payment_status')
        if payment_status_filter and payment_status_filter.upper() != 'ALL':
            queryset = queryset.filter(payment_status=payment_status_filter.upper())

        # Sort Ordering parameter
        ordering = self.request.query_params.get('ordering')
        if ordering == 'oldest':
            queryset = queryset.order_by('created_at')
        elif ordering == 'total':
            queryset = queryset.order_by('-total')
        else:
            queryset = queryset.order_by('-created_at')

        return queryset

    def get_serializer_class(self):
        if self.action in ['update', 'partial_update']:
            return OrderAdminUpdateSerializer
        return OrderAdminSerializer

    # ISO country / legacy aliases -> our Region.code values (UK, IN, ...).
    REGION_ALIASES = {'GB': 'UK', 'UK': 'UK', 'IN': 'IN'}

    def create(self, request, *args, **kwargs):
        """
        Create an order from the admin "Create Order" wizard.

        The wizard posts a flat payload (region_code, items[{product_sku,
        quantity, price}], shipping_* fields, totals). The default ModelSerializer
        can't accept that (region is a FK PK, items is read-only), so we build the
        order explicitly here.
        """
        from django.contrib.auth import get_user_model
        data = request.data

        def dec(value, field, default='0'):
            try:
                return Decimal(str(value if value not in (None, '') else default))
            except (InvalidOperation, TypeError, ValueError):
                raise ValueError(f'{field} must be a valid number.')

        # Resolve region from region_code (accepts legacy 'GB' for the UK store).
        raw_region = str(data.get('region_code') or data.get('region') or '').upper().strip()
        region_code = self.REGION_ALIASES.get(raw_region, raw_region)
        region = Region.objects.filter(code=region_code, is_active=True).first()
        if not region:
            return Response(
                {'region': [f'No active region for code "{raw_region or "(empty)"}".']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        items = data.get('items') or []
        if not items:
            return Response({'items': ['At least one item is required.']}, status=status.HTTP_400_BAD_REQUEST)

        resolved = []
        try:
            for it in items:
                if not isinstance(it, dict):
                    raise ValueError('Each item must be an object.')
                sku = it.get('product_sku') or it.get('sku')
                product = Product.objects.filter(sku=sku).first()
                if not product:
                    raise ValueError(f'Unknown product SKU "{sku}".')
                if not ProductRegionConfig.objects.filter(
                    product=product, region=region, is_visible=True,
                ).exists():
                    raise ValueError(f'Product "{sku}" is not available in region {region.code}.')
                quantity = int(it.get('quantity') or 1)
                if quantity < 1 or quantity > 10000:
                    raise ValueError(f'Quantity for "{sku}" must be between 1 and 10,000.')
                price = dec(it.get('price'), f'Price for "{sku}"')
                if price < 0:
                    raise ValueError(f'Price for "{sku}" cannot be negative.')
                resolved.append((product, quantity, price))
        except (TypeError, ValueError) as exc:
            return Response({'items': [str(exc)]}, status=status.HTTP_400_BAD_REQUEST)

        # Optional linked customer.
        user = None
        customer_id = data.get('customer') or data.get('user')
        if customer_id:
            user = get_user_model().objects.filter(pk=customer_id).first()

        email = (data.get('email') or (user.email if user else '') or '').strip()
        try:
            validate_email(email)
        except DjangoValidationError:
            return Response({'email': ['Enter a valid email address.']}, status=status.HTTP_400_BAD_REQUEST)

        # Phone is mandatory on the model; fall back to the customer's phone.
        phone = (data.get('shipping_phone') or (getattr(user, 'phone_number', '') if user else '') or '').strip()

        required_shipping = {
            'shipping_name': data.get('shipping_name'),
            'shipping_phone': phone,
            'shipping_address_line1': data.get('shipping_address_line1'),
            'shipping_city': data.get('shipping_city'),
            'shipping_postal_code': data.get('shipping_postal_code'),
            'shipping_country': data.get('shipping_country'),
        }
        missing = [field for field, value in required_shipping.items() if not str(value or '').strip()]
        if missing:
            return Response(
                {field: ['This field is required.'] for field in missing},
                status=status.HTTP_400_BAD_REQUEST,
            )

        order_status = (data.get('status') or 'PENDING').upper()
        if order_status not in dict(Order.ORDER_STATUS):
            return Response({'status': ['Invalid order status.']}, status=status.HTTP_400_BAD_REQUEST)

        payment_method = str(data.get('payment_method') or '').upper().strip()
        if not PaymentGateway.objects.filter(
            region=region, code=payment_method, is_enabled=True,
        ).exists():
            return Response(
                {'payment_method': ['Select an enabled payment method for this region.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            subtotal = sum((price * qty for _, qty, price in resolved), Decimal('0'))
            discount_amount = dec(data.get('discount_amount'), 'Discount amount')
            shipping_cost = dec(data.get('shipping_cost'), 'Shipping cost')
            tax_rate = dec(data.get('tax_rate'), 'Tax rate', str(region.tax_rate))
        except ValueError as exc:
            return Response({'pricing': [str(exc)]}, status=status.HTTP_400_BAD_REQUEST)
        if discount_amount < 0 or shipping_cost < 0 or not Decimal('0') <= tax_rate <= Decimal('100'):
            return Response(
                {'pricing': ['Discount and shipping must be non-negative; tax must be from 0 to 100.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        discount_amount = min(discount_amount, subtotal)
        taxable_amount = subtotal - discount_amount
        tax_amount = (taxable_amount * tax_rate / Decimal('100')).quantize(Decimal('0.01'))
        total = taxable_amount + tax_amount + shipping_cost

        with transaction.atomic():
            order = Order.objects.create(
                user=user,
                region=region,
                status=order_status,
                email=email,
                shipping_name=(data.get('shipping_name') or '').strip(),
                shipping_phone=phone,
                shipping_address_line1=(data.get('shipping_address_line1') or '').strip(),
                shipping_address_line2=(data.get('shipping_address_line2') or '').strip(),
                shipping_city=(data.get('shipping_city') or '').strip(),
                shipping_state=(data.get('shipping_state') or '').strip(),
                shipping_postal_code=(data.get('shipping_postal_code') or '').strip(),
                shipping_country=(data.get('shipping_country') or '').strip(),
                # Currency is authoritative from the region, not the client.
                currency_code=region.currency_code,
                subtotal=subtotal,
                tax_rate=tax_rate,
                tax_amount=tax_amount,
                shipping_cost=shipping_cost,
                staff_notes=(data.get('notes') or '').strip(),
                coupon_code=(data.get('discount_code') or None),
                discount_amount=discount_amount,
                total=total,
                payment_method=payment_method,
                payment_status='PENDING',
            )
            for product, qty, price in resolved:
                OrderItem.objects.create(
                    order=order, product=product, quantity=qty, price=price, tax_amount=Decimal('0'),
                )

        return Response(
            OrderAdminSerializer(order, context={'request': request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def update_status(self, request, pk=None):
        """Update order status."""
        order = self.get_object()
        new_status = request.data.get('status')
        if not new_status:
            return Response({"error": "Status is required"}, status=status.HTTP_400_BAD_REQUEST)

        valid_statuses = [choice[0] for choice in Order.ORDER_STATUS]
        if new_status not in valid_statuses:
            return Response({"error": f"Invalid status. Must be one of {valid_statuses}"}, status=status.HTTP_400_BAD_REQUEST)

        old_status = order.status
        order.status = new_status
        order.save(update_fields=['status', 'updated_at'])
        if old_status != new_status:
            AuditLog.objects.create(
                user=request.user if request.user.is_authenticated else None,
                action='Status changed',
                model_name='Order',
                object_id=str(order.id),
                changes={'from': old_status, 'to': new_status},
            )
            if new_status == 'SHIPPED':
                # Keep legacy shipment_dispatched send for backward compat AND
                # fire the new order_shipped template (best-effort each).
                _send_order_event_with_logging('shipment_dispatched', order.id)
                _send_order_event_with_logging('order_shipped', order.id)
            elif new_status in ('DELIVERED', 'COMPLETED'):
                # Stamp the delivery time once — the review-request job counts
                # 30 days from here, and re-saving the order must not reset it.
                if not order.delivered_at:
                    order.delivered_at = timezone.now()
                    order.save(update_fields=['delivered_at'])
                _send_order_event_with_logging('order_delivered', order.id)
            elif new_status == 'CANCELLED':
                _send_order_event_with_logging('order_cancelled', order.id)

        return Response({"message": "Status updated successfully", "status": order.status})

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def authorize_payment(self, request, pk=None):
        """Mark an order payment as authorized without capture."""
        order = self.get_object()
        raw_amount = request.data.get('amount') or order.total
        try:
            amount = Decimal(str(raw_amount))
        except (InvalidOperation, TypeError):
            return Response({"error": "Invalid authorization amount."}, status=status.HTTP_400_BAD_REQUEST)
        if amount <= 0 or amount > order.total:
            return Response({"error": "Authorization amount must be positive and cannot exceed the order total."}, status=status.HTTP_400_BAD_REQUEST)

        order.payment_capture_mode = 'MANUAL'
        order.payment_status = 'AUTHORIZED'
        order.payment_authorized_amount = amount
        order.payment_captured_amount = Decimal('0.00')
        order.status = 'PENDING'
        order.save(update_fields=[
            'payment_capture_mode', 'payment_status', 'payment_authorized_amount',
            'payment_captured_amount', 'status', 'updated_at',
        ])

        tx_id = request.data.get('transaction_id') or f"auth_{order.id}_{int(timezone.now().timestamp())}"
        PaymentLog.objects.create(
            order=order,
            transaction_id=tx_id,
            gateway=order.payment_method,
            amount=amount,
            status='AUTHORIZED',
            raw_response={'manual': True, 'created_by': getattr(request.user, 'email', '')},
        )
        AuditLog.objects.create(
            user=request.user if request.user.is_authenticated else None,
            action='Payment authorized',
            model_name='Order',
            object_id=str(order.id),
            changes={'amount': str(amount), 'currency': order.currency_code, 'transaction_id': tx_id},
        )
        return Response(OrderAdminSerializer(order, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def capture_payment(self, request, pk=None):
        """Capture a full or partial amount from an existing authorization."""
        order = self.get_object()
        authorized = order.payment_authorized_amount or order.total
        captured = order.payment_captured_amount or Decimal('0.00')
        remaining = authorized - captured
        if remaining <= 0:
            return Response({"error": "No authorized balance remains to capture."}, status=status.HTTP_400_BAD_REQUEST)

        raw_amount = request.data.get('amount') or remaining
        try:
            amount = Decimal(str(raw_amount))
        except (InvalidOperation, TypeError):
            return Response({"error": "Invalid capture amount."}, status=status.HTTP_400_BAD_REQUEST)
        if amount <= 0 or amount > remaining:
            return Response({"error": f"Capture amount must be between 0 and {remaining} {order.currency_code}."}, status=status.HTTP_400_BAD_REQUEST)

        new_captured = captured + amount
        order.payment_capture_mode = 'MANUAL'
        order.payment_authorized_amount = authorized
        order.payment_captured_amount = new_captured
        order.payment_status = 'PAID' if new_captured >= authorized else 'PARTIALLY_CAPTURED'
        if order.payment_status == 'PAID' and order.status == 'PENDING':
            order.status = 'PROCESSING'
        order.save(update_fields=[
            'payment_capture_mode', 'payment_authorized_amount', 'payment_captured_amount',
            'payment_status', 'status', 'updated_at',
        ])

        tx_id = request.data.get('transaction_id') or f"cap_{order.id}_{int(timezone.now().timestamp())}"
        PaymentLog.objects.create(
            order=order,
            transaction_id=tx_id,
            gateway=order.payment_method,
            amount=amount,
            status='CAPTURED' if order.payment_status == 'PAID' else 'PARTIALLY_CAPTURED',
            raw_response={'manual': True, 'created_by': getattr(request.user, 'email', '')},
        )
        AuditLog.objects.create(
            user=request.user if request.user.is_authenticated else None,
            action='Payment captured',
            model_name='Order',
            object_id=str(order.id),
            changes={
                'amount': str(amount), 'currency': order.currency_code,
                'captured_total': str(new_captured), 'authorized_total': str(authorized),
                'transaction_id': tx_id,
            },
        )
        return Response(OrderAdminSerializer(order, context={'request': request}).data)

    @action(detail=True, methods=['post'])
    def add_timeline_event(self, request, pk=None):
        """Add an internal note or customer communication to the order timeline."""
        order = self.get_object()
        note = (request.data.get('note') or '').strip()
        kind = (request.data.get('kind') or 'NOTE').upper()
        if not note:
            return Response({"error": "Note is required."}, status=status.HTTP_400_BAD_REQUEST)
        if kind not in ('NOTE', 'CUSTOMER_COMMUNICATION'):
            kind = 'NOTE'
        AuditLog.objects.create(
            user=request.user if request.user.is_authenticated else None,
            action='Customer communication' if kind == 'CUSTOMER_COMMUNICATION' else 'Note added',
            model_name='Order',
            object_id=str(order.id),
            changes={'note': note, 'kind': kind},
        )
        return Response({"message": "Timeline note added.", "note": note})

    @action(detail=True, methods=['get', 'post'])
    def invoice(self, request, pk=None):
        """Generate and download PDF invoice for the order."""
        import os
        from django.http import HttpResponse
        from .models import Invoice
        order = self.get_object()

        # Check or create Invoice record
        reg_code = order.region.code if order.region else (getattr(order, 'region_code', 'GLOBAL') or 'GLOBAL')
        invoice_obj, _ = Invoice.objects.get_or_create(
            order=order,
            defaults={
                'invoice_number': f"INV-{reg_code}-{order.id:06d}",
                'invoice_type': 'VAT_RECEIPT' if reg_code == 'UK' else 'GST_INVOICE',
                'details': {
                    'currency': order.currency_code,
                    'region': reg_code,
                }
            }
        )

        pdf_rel_path, inv_num = generate_invoice_pdf(order)
        if pdf_rel_path:
            invoice_obj.pdf_file = pdf_rel_path
            invoice_obj.invoice_number = inv_num
            invoice_obj.save(update_fields=['pdf_file', 'invoice_number'])
        full_path = os.path.join(settings.MEDIA_ROOT, pdf_rel_path)

        if os.path.exists(full_path):
            with open(full_path, 'rb') as f:
                pdf_bytes = f.read()
            resp = HttpResponse(pdf_bytes, content_type='application/pdf')
            resp['Content-Disposition'] = f'attachment; filename="Invoice_Order_{order.id}_{inv_num}.pdf"'
            return resp
        else:
            return Response({"error": "Failed to generate invoice PDF file."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=False, methods=['get'])
    def by_region(self, request):
        """Get orders for a specific region."""
        region_code = request.query_params.get('region')
        if not region_code:
            return Response({"error": "Region parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

        orders = self.get_queryset().filter(region__code=region_code.upper())
        serializer = self.get_serializer(orders, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """Get order statistics filtered by region."""
        queryset = self.get_queryset()
        region_code = request.query_params.get('region')

        if region_code:
            queryset = queryset.filter(region__code=region_code.upper())

        total_orders = queryset.count()
        total_revenue = queryset.aggregate(total=Sum('total'))['total'] or Decimal('0')
        pending_orders = queryset.filter(status='PENDING').count()
        processing_orders = queryset.filter(status='PROCESSING').count()
        shipped_orders = queryset.filter(status='SHIPPED').count()
        delivered_orders = queryset.filter(status='DELIVERED').count()
        completed_orders = queryset.filter(status='COMPLETED').count()

        return Response({
            'total_orders': total_orders,
            'total_revenue': str(total_revenue),
            'pending_orders': pending_orders,
            'processing_orders': processing_orders,
            'shipped_orders': shipped_orders,
            'delivered_orders': delivered_orders,
            'completed_orders': completed_orders,
        })


    @action(detail=True, methods=['get'])
    def timeline(self, request, pk=None):
        """Chronological event log for one order — placed, payment, status
        changes (from the audit trail), invoice, refunds."""
        order = self.get_object()
        events = [{
            'ts': order.created_at.isoformat(), 'type': 'placed',
            'label': 'Order placed', 'detail': f'{order.email} · {order.shipping_name}',
        }]
        if order.payment_id:
            events.append({
                'ts': order.created_at.isoformat(), 'type': 'payment',
                'label': 'Payment recorded', 'detail': f'{order.payment_method} · {order.payment_id}',
            })
        for log in order.payment_logs.all().order_by('created_at'):
            events.append({
                'ts': log.created_at.isoformat(), 'type': 'payment',
                'label': f'Payment {log.status.lower().replace("_", " ")}',
                'detail': f'{log.gateway} · {order.currency_code} {log.amount} · {log.transaction_id}',
            })
        invoice = getattr(order, 'invoice', None)
        if invoice:
            events.append({
                'ts': invoice.generated_at.isoformat(), 'type': 'invoice',
                'label': f'Invoice {invoice.invoice_number}', 'detail': invoice.get_invoice_type_display(),
            })
        for r in order.refunds.all():
            events.append({
                'ts': r.created_at.isoformat(), 'type': 'refund',
                'label': f'Refund {order.currency_code} {r.amount}', 'detail': r.status,
            })
        for a in AuditLog.objects.filter(model_name='Order', object_id=str(order.id)).select_related('user'):
            detail = ''
            if isinstance(a.changes, dict):
                if a.changes.get('note'):
                    detail = a.changes.get('note')
                elif 'from' in a.changes and 'to' in a.changes:
                    detail = f"{a.changes.get('from')} -> {a.changes.get('to')}"
                elif a.changes:
                    detail = ' · '.join(f"{k}: {v}" for k, v in a.changes.items())
            actor = getattr(a.user, 'email', None) or 'System'
            events.append({
                'ts': a.created_at.isoformat(), 'type': 'log',
                'label': a.action, 'detail': f'{detail} · {actor}' if detail else actor,
            })
        events.sort(key=lambda e: e['ts'])
        return Response(events)


class AbandonedCheckoutsView(generics.ListAPIView):
    """Unpaid attempts and carts that hold items — abandoned checkouts.
    Gated by 'orders.view'."""
    permission_classes = [require_permission('orders.view')]

    def list(self, request):
        # A checkout attempt which reached a gateway but has not received a
        # confirmed payment is intentionally shown here, not in Orders. The
        # reconciliation worker and signed webhooks move it to Orders only
        # after the gateway confirms the full payment.
        pending_orders = (
            Order.objects.filter(payment_status__in=['PENDING', 'AUTHORIZED', 'FAILED'])
            .select_related('region').prefetch_related('items__product')
        )
        out = [
            {
                'id': f'payment-{order.id}', 'order_id': order.id,
                'entity_type': 'PAYMENT_ATTEMPT', 'session_id': f'payment-{order.payment_id or order.id}',
                'region': order.region.code, 'currency': order.currency_code,
                'email': order.email, 'item_count': sum(item.quantity for item in order.items.all()),
                'items': [{'name': item.product.name, 'qty': item.quantity} for item in order.items.all()],
                'value': str(order.total), 'recovery_status': 'AWAITING_PAYMENT',
                'recovery_attempts': 0, 'last_recovery_at': None,
                'created_at': order.created_at.isoformat(), 'updated_at': order.updated_at.isoformat(),
                'payment_method': order.payment_method, 'payment_status': order.payment_status,
            }
            for order in pending_orders
        ]
        # A cart that still holds items is an in-progress / abandoned checkout
        # (the checkout flow clears the cart on a successful order).
        carts = (Cart.objects.filter(items__isnull=False).distinct()
                 .select_related('region', 'user').prefetch_related('items__product'))
        for c in carts:
            items = list(c.items.all())
            if not items:
                continue
            total = Decimal('0')
            for it in items:
                cfg = ProductRegionConfig.objects.filter(product=it.product, region=c.region).first()
                price = (cfg.promotional_price or cfg.price) if cfg else Decimal('0')
                total += price * it.quantity
            out.append({
                'id': c.id, 'session_id': c.session_id, 'region': c.region.code,
                'entity_type': 'CART',
                'currency': c.region.currency_code,
                'email': c.user.email if c.user else None,
                'item_count': sum(i.quantity for i in items),
                'items': [{'name': i.product.name, 'qty': i.quantity} for i in items],
                'value': str(round(total, 2)),
                'recovery_status': c.recovery_status,
                'recovery_attempts': c.recovery_attempts,
                'last_recovery_at': c.last_recovery_at.isoformat() if c.last_recovery_at else None,
                'created_at': c.created_at.isoformat(),
                'updated_at': c.updated_at.isoformat(),
            })
        out.sort(key=lambda x: x['updated_at'], reverse=True)
        return Response(out)

    def post(self, request):
        cart = get_object_or_404(Cart, id=request.data.get('cart_id'))
        recovery_status = (request.data.get('recovery_status') or 'CONTACTED').upper()
        valid_statuses = [choice[0] for choice in Cart.RECOVERY_STATUS]
        if recovery_status not in valid_statuses:
            return Response({"error": f"Invalid recovery status. Must be one of {valid_statuses}"}, status=status.HTTP_400_BAD_REQUEST)
        cart.recovery_status = recovery_status
        if recovery_status == 'CONTACTED':
            cart.recovery_attempts += 1
            cart.last_recovery_at = timezone.now()
        cart.save(update_fields=['recovery_status', 'recovery_attempts', 'last_recovery_at', 'updated_at'])
        return Response({"message": "Recovery status updated."})


class RefundAdminViewSet(viewsets.ModelViewSet):
    """
    Admin CRUD operations for refunds.
    Requires 'orders.refund' permission when RBAC is enforced.
    Supports regional filtering via ?region=IN,UK,US
    """
    permission_classes = [require_permission('orders.refund')]

    def get_queryset(self):
        queryset = Refund.objects.select_related('order__region', 'created_by')
        region_code = self.request.query_params.get('region')
        status_filter = self.request.query_params.get('status')

        if region_code:
            queryset = queryset.filter(order__region__code=region_code.upper())
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())

        return queryset

    def get_serializer_class(self):
        return RefundAdminSerializer

    @action(detail=True, methods=['post'])
    @transaction.atomic
    def process(self, request, pk=None):
        """Process a PENDING refund through the original payment gateway.

        Locks the refund row so two admins clicking "process" concurrently
        cannot both reach the gateway, and records the outcome on the refund
        itself — without that, a processed refund stayed PENDING forever and
        could be re-processed into a double payout.
        """
        refund = get_object_or_404(
            Refund.objects.select_for_update().select_related('order'), pk=pk,
        )
        if refund.status != 'PENDING':
            return Response({"error": "Only pending refunds can be processed"}, status=status.HTTP_400_BAD_REQUEST)

        order = Order.objects.select_for_update().get(pk=refund.order_id)

        try:
            result = refund_payment(order, refund.amount, refund.reason)
        except PaymentError as exc:
            # Keep the refund PENDING so it can be retried once the gateway
            # problem is resolved, but leave an audit trail of the attempt.
            PaymentLog.objects.create(
                order=order,
                transaction_id=refund.refund_transaction_id or f"refund_{refund.id}",
                gateway=order.payment_method,
                amount=refund.amount,
                status='REFUND_ATTEMPT_FAILED',
                raw_response={'error': str(exc)},
            )
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        gateway_status = result.get('status')
        if gateway_status == 'REFUNDED':
            refund.status = 'PROCESSED'
        elif gateway_status == 'FAILED':
            refund.status = 'FAILED'
        # REFUND_PENDING (e.g. COD manual payout) stays PENDING for follow-up.
        refund.refund_transaction_id = result.get('refund_id', '') or refund.refund_transaction_id
        refund.save(update_fields=['status', 'refund_transaction_id'])

        PaymentLog.objects.create(
            order=order,
            transaction_id=refund.refund_transaction_id or f"refund_{refund.id}",
            gateway=order.payment_method,
            amount=refund.amount,
            status=f"REFUND_{refund.status}",
            raw_response=result.get('raw', {}),
        )

        if refund.status == 'PROCESSED':
            processed_total = order.refunds.filter(status='PROCESSED').aggregate(
                s=Sum('amount')
            )['s'] or Decimal('0.00')
            if processed_total >= order.total and order.status != 'REFUNDED':
                order.status = 'REFUNDED'
                order.save(update_fields=['status'])
            transaction.on_commit(lambda order_id=order.id, amount=str(refund.amount): (
                _send_order_event_with_logging(
                    'refund_processed', order_id,
                    extra_context={'refund_amount': amount},
                )
            ))

        return Response({
            "message": f"Refund {refund.status.lower()}.",
            "refund": RefundAdminSerializer(refund).data,
            "result": result,
        })


class InvoiceAdminViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Admin view-only operations for invoices.
    Requires 'finance.view' permission when RBAC is enforced.
    """
    permission_classes = [require_permission('finance.view')]
    serializer_class = InvoiceAdminSerializer

    def get_queryset(self):
        queryset = Invoice.objects.select_related('order__region')
        region_code = self.request.query_params.get('region')
        order_id = self.request.query_params.get('order')

        if region_code:
            queryset = queryset.filter(order__region__code=region_code.upper())
        if order_id:
            queryset = queryset.filter(order_id=order_id)

        return queryset

    @action(detail=True, methods=['post'])
    def regenerate(self, request, pk=None):
        """Regenerate invoice PDF."""
        invoice = self.get_object()
        try:
            generate_invoice_pdf(invoice)
            return Response({"message": "Invoice regenerated successfully"})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


def _resolve_gateway_rows(code):
    """Return enabled regional configurations that may own this provider event."""
    return PaymentGateway.objects.filter(code=code, is_enabled=True).order_by('id')


SUPPORTED_WEBHOOK_GATEWAYS = frozenset({'STRIPE', 'RAZORPAY', 'PAYPAL'})


def _receive_payment_webhook(request, gateway_code):
    """Authenticate and durably enqueue one payment-provider webhook.

    Business processing happens in the scheduler so a web-worker restart cannot
    lose an acknowledged event. The provider event id (or a SHA-256 content
    fingerprint when the provider has none) supplies idempotency.
    """
    gateway_code = gateway_code.upper()
    if gateway_code not in SUPPORTED_WEBHOOK_GATEWAYS:
        return Response({'error': 'Unsupported webhook gateway.'}, status=status.HTTP_404_NOT_FOUND)

    raw = request.body
    if not raw or len(raw) > 1024 * 1024:
        return Response({'error': 'Webhook payload is empty or too large.'}, status=status.HTTP_400_BAD_REQUEST)

    gateways = list(_resolve_gateway_rows(gateway_code))
    if not gateways:
        return Response(
            {'error': f'{gateway_code.title()} gateway is not configured.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    adapter = None
    for gateway in gateways:
        candidate = get_adapter(gateway)
        extra = gateway.extra_config or {}
        secret = (
            extra.get('webhook_id') if gateway_code == 'PAYPAL'
            else extra.get('webhook_secret') or os.getenv(f'{gateway_code}_WEBHOOK_SECRET', '')
        )
        if candidate.verify_webhook_signature(raw, request.META, secret or ''):
            adapter = candidate
            break
    if adapter is None:
        return Response({'error': 'Invalid signature.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        payload = json.loads(raw.decode('utf-8'))
        if not isinstance(payload, dict):
            raise ValueError('Webhook JSON must be an object.')
        parsed_event = adapter.parse_webhook_event(payload)
    except (UnicodeDecodeError, ValueError, TypeError, PaymentError):
        return Response({'error': 'Malformed payload.'}, status=status.HTTP_400_BAD_REQUEST)

    event_type = str(
        parsed_event.get('event_type')
        or payload.get('type')
        or payload.get('event')
        or payload.get('event_type')
        or ''
    )[:100]
    if not event_type:
        return Response({'error': 'Webhook event type is required.'}, status=status.HTTP_400_BAD_REQUEST)

    # Stripe and PayPal expose a true provider event id. Razorpay payloads do
    # not always do so, therefore the exact signed body is the idempotency key.
    provider_event_id = payload.get('id') if gateway_code in {'STRIPE', 'PAYPAL'} else None
    event_id = str(provider_event_id or f"sha256_{hashlib.sha256(raw).hexdigest()}")[:255]

    try:
        event, created = WebhookEvent.objects.get_or_create(
            gateway=gateway_code,
            event_id=event_id,
            defaults={
                'event_type': event_type,
                'payload': payload,
                'status': 'PENDING',
            },
        )
    except IntegrityError:
        # A concurrent duplicate may win the unique constraint race.
        event = WebhookEvent.objects.get(gateway=gateway_code, event_id=event_id)
        created = False

    if not created:
        return Response({'status': 'duplicate'}, status=status.HTTP_200_OK)

    record_audit(
        'webhook.received',
        target_type='WebhookEvent',
        target_id=event.id,
        summary=f'{gateway_code.title()} {event_type}',
        changes={'gateway': gateway_code, 'event_type': event_type, 'event_id': event_id},
    )
    return Response({'status': 'queued'}, status=status.HTTP_202_ACCEPTED)


class StripeWebhookView(views.APIView):
    permission_classes = [AllowAny]
    parser_classes = []  # we need raw bytes for signature verification

    def post(self, request):
        return _receive_payment_webhook(request, 'STRIPE')


class RazorpayWebhookView(views.APIView):
    permission_classes = [AllowAny]
    parser_classes = []

    def post(self, request):
        return _receive_payment_webhook(request, 'RAZORPAY')


class PaypalWebhookView(views.APIView):
    permission_classes = [AllowAny]
    parser_classes = []

    def post(self, request):
        return _receive_payment_webhook(request, 'PAYPAL')


class UnifiedPaymentWebhookView(views.APIView):
    """
    Standardized API endpoint for dynamically receiving and verifying payment webhooks.
    Enables plug-and-play gateway integrations without needing new routes.
    """
    permission_classes = [AllowAny]
    parser_classes = []

    def post(self, request, gateway_code):
        return _receive_payment_webhook(request, gateway_code)



class CouponAdminViewSet(viewsets.ModelViewSet):
    """Admin CRUD for marketing coupons. Requires 'marketing.edit'."""
    queryset = Coupon.objects.select_related('region').all().order_by('-created_at')
    serializer_class = CouponAdminSerializer
    permission_classes = [require_permission('marketing.edit')]

    def get_queryset(self):
        qs = self.queryset
        region = self.request.query_params.get('region')
        active = self.request.query_params.get('active')
        if region:
            qs = qs.filter(region__code=region.upper())
        if active in ('true', '1'):
            qs = qs.filter(is_active=True)
        elif active in ('false', '0'):
            qs = qs.filter(is_active=False)
        return qs
