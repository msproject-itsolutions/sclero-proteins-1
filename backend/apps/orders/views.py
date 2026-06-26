from decimal import Decimal, InvalidOperation
from rest_framework import viewsets, status, views, generics
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.shortcuts import get_object_or_404
from django.db import transaction
from django.db.models import Sum, Q
from django.conf import settings
from django.utils import timezone
from apps.regions.models import Region, Warehouse, ShippingZone, ShippingRate
from apps.products.models import Product, ProductRegionConfig
from apps.inventory.models import StockLevel
from apps.users.permissions import require_permission
from .models import Cart, CartItem, Order, OrderItem, Invoice, PaymentLog, Refund, AuditLog, Coupon, WebhookEvent
from .serializers import (
    CartSerializer, CartItemSerializer, OrderSerializer, RefundSerializer,
    OrderAdminSerializer, OrderAdminUpdateSerializer, RefundAdminSerializer, InvoiceAdminSerializer,
    CouponAdminSerializer,
)
from .utils import generate_invoice_pdf
from .payments import resolve_gateway, refund_payment, PaymentError
from .email_service import send_order_email

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
            Order.objects.filter(Q(user=user) | Q(email__iexact=user.email))
            .prefetch_related('items', 'refunds')
            .select_related('invoice')
            .order_by('-created_at')
            .distinct()
        )


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
        serializer = CartSerializer(cart)
        return Response(serializer.data)

    def add_item(self, request):
        session_id = request.data.get('session_id')
        region_code = request.data.get('region', 'UK').upper()
        product_id = request.data.get('product_id')
        quantity = int(request.data.get('quantity', 1))

        if not session_id or not product_id:
            return Response({"error": "session_id and product_id are required"}, status=status.HTTP_400_BAD_REQUEST)

        cart = self.get_cart(session_id, region_code)
        product = get_object_or_404(Product, id=product_id, is_active=True, is_archived=False)
        
        # Verify if product is visible/available in this region
        region_config = ProductRegionConfig.objects.filter(product=product, region=cart.region, is_visible=True).first()
        if not region_config:
            return Response({"error": "Product is not available in your region."}, status=status.HTTP_400_BAD_REQUEST)

        # Check stock level in this region's warehouses
        warehouses = Warehouse.objects.filter(region=cart.region, is_active=True)
        stock_level = StockLevel.objects.filter(product=product, warehouse__in=warehouses).first() # Simplify for single/primary warehouse
        
        total_available = 0
        if stock_level:
            total_available = stock_level.available
            
        if total_available < quantity:
            return Response({"error": f"Only {total_available} units are available in your region's stock."}, status=status.HTTP_400_BAD_REQUEST)

        # Add or update quantity
        cart_item, created = CartItem.objects.get_or_create(cart=cart, product=product)
        if not created:
            cart_item.quantity += quantity
        else:
            cart_item.quantity = quantity
        cart_item.save()

        return Response(CartSerializer(cart).data)

    def update_item(self, request):
        session_id = request.data.get('session_id')
        region_code = request.data.get('region', 'UK').upper()
        product_id = request.data.get('product_id')
        quantity = int(request.data.get('quantity', 1))

        if not session_id or not product_id:
            return Response({"error": "session_id and product_id are required"}, status=status.HTTP_400_BAD_REQUEST)

        cart = self.get_cart(session_id, region_code)
        cart_item = get_object_or_404(CartItem, cart=cart, product_id=product_id)

        if quantity <= 0:
            cart_item.delete()
        else:
            # Verify stock
            warehouses = Warehouse.objects.filter(region=cart.region, is_active=True)
            stock_level = StockLevel.objects.filter(product=cart_item.product, warehouse__in=warehouses).first()
            total_available = stock_level.available if stock_level else 0
            
            if total_available < quantity:
                return Response({"error": f"Only {total_available} units available in stock."}, status=status.HTTP_400_BAD_REQUEST)
                
            cart_item.quantity = quantity
            cart_item.save()

        return Response(CartSerializer(cart).data)

    def remove_item(self, request):
        session_id = request.data.get('session_id')
        region_code = request.data.get('region', 'UK').upper()
        product_id = request.data.get('product_id')

        if not session_id or not product_id:
            return Response({"error": "session_id and product_id are required"}, status=status.HTTP_400_BAD_REQUEST)

        cart = self.get_cart(session_id, region_code)
        cart_item = CartItem.objects.filter(cart=cart, product_id=product_id).first()
        if cart_item:
            cart_item.delete()

        return Response(CartSerializer(cart).data)


class ApplyCouponView(views.APIView):
    """
    Validate a coupon code and calculate discount.
    POST /api/checkout/apply-coupon/
    Body: { "code": "SAVE10", "region": "IN", "subtotal": 5000 }
    """
    permission_classes = [AllowAny]

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

    @transaction.atomic
    def post(self, request):
        from decimal import Decimal
        session_id = request.data.get('session_id')
        region_code = request.data.get('region', 'UK').upper()
        
        # Contact and Address info
        email = request.data.get('email')
        shipping_name = request.data.get('shipping_name')
        shipping_phone = request.data.get('shipping_phone')
        address_line1 = request.data.get('shipping_address_line1')
        address_line2 = request.data.get('shipping_address_line2', '')
        city = request.data.get('shipping_city')
        state = request.data.get('shipping_state')
        postal_code = request.data.get('shipping_postal_code')
        country = request.data.get('shipping_country')
        
        payment_method = request.data.get('payment_method') # Razorpay, Stripe, PayPal
        payment_id = request.data.get('payment_id', 'sandbox_mock_id')

        if not all([session_id, email, shipping_name, address_line1, city, state, postal_code, country, payment_method]):
            return Response({"error": "Missing required checkout parameters."}, status=status.HTTP_400_BAD_REQUEST)

        from apps.admin_dashboard.store_config import get_store_tax_mode, get_guest_checkout_enabled

        if not request.user.is_authenticated and not get_guest_checkout_enabled():
            return Response(
                {"error": "Guest checkout is currently disabled. Please sign in to continue."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # 1. Fetch Region & Cart
        region = get_object_or_404(Region, code=region_code, is_active=True)
        cart = Cart.objects.filter(session_id=session_id, region=region).first()
        if not cart or not cart.items.exists():
            return Response({"error": "Cart is empty or invalid."}, status=status.HTTP_400_BAD_REQUEST)

        # 1b. Smart gateway routing
        try:
            gateway_adapter = resolve_gateway(region, payment_method)
        except PaymentError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Verify Stock & Deduct
        order_items_to_create = []
        subtotal = Decimal('0.00')
        
        for item in cart.items.all():
            product = item.product
            qty = item.quantity
            
            # Fetch fixed regional price config
            region_config = ProductRegionConfig.objects.filter(product=product, region=region, is_visible=True).first()
            if not region_config:
                return Response({"error": f"{product.name} is not available in your region."}, status=status.HTTP_400_BAD_REQUEST)
                
            item_price = Decimal(str(region_config.promotional_price if region_config.promotional_price else region_config.price))
            subtotal += item_price * qty

            # Inventory deduction
            warehouses = Warehouse.objects.filter(region=region, is_active=True)
            stock = StockLevel.objects.select_for_update().filter(product=product, warehouse__in=warehouses).first()
            if not stock or stock.available < qty:
                return Response({"error": f"Product {product.name} is out of stock in this region."}, status=status.HTTP_400_BAD_REQUEST)
            
            stock.available -= qty
            stock.save()
            
            order_items_to_create.append((product, qty, item_price))

        # Apply Coupon Discount if supplied
        coupon_code = request.data.get('coupon_code')
        discount_amount = Decimal('0.00')
        if coupon_code:
            coupon = Coupon.objects.filter(code__iexact=coupon_code, is_active=True).first()
            if coupon:
                now = timezone.now()
                valid_date = (not coupon.start_date or coupon.start_date <= now) and (not coupon.end_date or coupon.end_date >= now)
                valid_region = not coupon.region or coupon.region == region
                valid_spend = subtotal >= coupon.min_spend
                valid_limit = not coupon.usage_limit or coupon.usage_count < coupon.usage_limit

                if valid_date and valid_region and valid_spend and valid_limit:
                    if coupon.discount_type == 'PERCENTAGE':
                        discount_val = Decimal(str(coupon.value))
                        discount_amount = subtotal * (discount_val / Decimal('100.00'))
                    elif coupon.discount_type in ['FIXED_AMOUNT', 'TIERED']:
                        discount_amount = Decimal(str(coupon.value))
                    discount_amount = min(discount_amount, subtotal)
                    
                    coupon.usage_count += 1
                    coupon.save(update_fields=['usage_count'])

        # 3. Calculate Tax & Shipping (honouring the store-wide tax mode)
        tax_mode = get_store_tax_mode()
        tax_rate = Decimal(str(region.tax_rate))
        taxable_amount = max(subtotal - discount_amount, Decimal('0.00'))
        rate_factor = tax_rate / Decimal('100.00')

        if tax_mode == 'inclusive':
            # Displayed prices already include tax: extract the embedded portion,
            # don't add it on top of the goods total.
            net = (taxable_amount / (Decimal('1') + rate_factor)) if rate_factor else taxable_amount
            tax_amount = (taxable_amount - net).quantize(Decimal('0.01'))
            goods_total = taxable_amount
        else:
            tax_amount = (taxable_amount * rate_factor).quantize(Decimal('0.01'))
            goods_total = taxable_amount + tax_amount

        from apps.regions.shipping import calculate_shipping
        shipping_cost = calculate_shipping(
            region, country=country, state=state, postcode=postal_code, subtotal=taxable_amount,
        )

        total = goods_total + shipping_cost

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
            coupon_code=coupon_code if discount_amount > 0 else None,
            discount_amount=discount_amount,
            total=total,
            payment_method=payment_method,
            payment_id=payment_id
        )

        # 5. Create Order Items
        for product, qty, price in order_items_to_create:
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
                quantity=qty,
                price=price,
                tax_amount=item_tax
            )

        # 6. Charge via the routed gateway adapter (sandbox until live keys are set).
        try:
            charge = gateway_adapter.charge(order, {"payment_id": payment_id})
        except PaymentError as exc:
            # Atomic transaction rolls back the order + stock deduction.
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

        # 7. Generate reportlab Invoice PDF
        pdf_relative_path, invoice_number = generate_invoice_pdf(order)
        
        # Save invoice record
        invoice_details = {
            "tax_reg_number": "GSTIN: 24AFXFS9162D1ZG" if region_code == 'IN' else "VAT: GB987654321",
            "invoice_type": "GST Tax Invoice" if region_code == 'IN' else "VAT Receipt",
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
        
        # Transactional order-confirmation email (region-aware template, audited).
        # Email failures must never break checkout — the order is already saved.
        try:
            send_order_email('order_confirmation', order)
        except Exception:
            pass

        # Phase E3 — fraud scoring. Wrapped in try/except inside `assess_order`
        # as well; doubled here so an import-time error during a deploy window
        # cannot bubble up and break checkout.
        try:
            from .fraud import assess_order
            assess_order(order)
        except Exception:
            pass

        return Response({
            "message": "Checkout completed successfully!",
            "order": OrderSerializer(order).data
        }, status=status.HTTP_201_CREATED)


def get_user_refund_limit(user, currency_code):
    if not user or not user.is_authenticated:
        return Decimal('0.00')
    if user.is_superuser:
        return Decimal('Infinity')
        
    roles = [r.name for r in user.roles.all()]
    if 'Admin' in roles or 'Super Admin' in roles:
        return Decimal('Infinity')
        
    limit = Decimal('0.00')
    is_uk = currency_code.upper() == 'GBP'
    
    for r in roles:
        if r == 'Customer Support Agent':
            cur_limit = Decimal('50.00') if is_uk else Decimal('4000.00')
        elif r == 'Customer Support Manager':
            cur_limit = Decimal('200.00') if is_uk else Decimal('16000.00')
        elif r == 'Operations Manager':
            cur_limit = Decimal('1000.00') if is_uk else Decimal('80000.00')
        else:
            cur_limit = Decimal('0.00')
        if cur_limit > limit:
            limit = cur_limit
            
    if not roles and user.is_staff:
        limit = Decimal('50.00') if is_uk else Decimal('4000.00')
        
    return limit


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
        order = get_object_or_404(Order, id=order_id)

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
        limit = get_user_refund_limit(request.user, order.currency_code)
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
            warehouses = Warehouse.objects.filter(region=order.region, is_active=True)
            for item in order.items.all():
                stock = StockLevel.objects.select_for_update().filter(
                    product=item.product, warehouse__in=warehouses
                ).first()
                if stock:
                    stock.available += item.quantity
                    stock.save(update_fields=['available'])

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

        try:
            send_order_email(
                'refund_processed', order,
                extra_context={'refund_amount': str(amount)},
            )
        except Exception:
            pass

        return Response(
            {"message": "Refund processed.", "refund": RefundSerializer(refund).data},
            status=status.HTTP_201_CREATED,
        )


# --- Admin ViewSets for Regional CRUD Operations --- #

class OrderAdminViewSet(viewsets.ModelViewSet):
    """
    Admin CRUD operations for orders with regional filters.
    Requires 'orders.manage' permission when RBAC is enforced.
    Supports regional filtering via ?region=IN,UK,US and status filtering via ?status=PENDING,PROCESSING
    """
    permission_classes = [require_permission('orders.manage')]

    def get_queryset(self):
        queryset = Order.objects.select_related('user', 'region').prefetch_related('items', 'refunds', 'invoice', 'payment_logs')
        
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
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())
        if email_filter:
            queryset = queryset.filter(email__icontains=email_filter)

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

        def dec(value, default='0'):
            try:
                return Decimal(str(value if value not in (None, '') else default))
            except (InvalidOperation, TypeError, ValueError):
                return Decimal(default)

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
        for it in items:
            sku = it.get('product_sku') or it.get('sku')
            product = Product.objects.filter(sku=sku).first()
            if not product:
                return Response({'items': [f'Unknown product SKU "{sku}".']}, status=status.HTTP_400_BAD_REQUEST)
            resolved.append((product, max(1, int(it.get('quantity') or 1)), dec(it.get('price'))))

        # Optional linked customer.
        user = None
        customer_id = data.get('customer') or data.get('user')
        if customer_id:
            user = get_user_model().objects.filter(pk=customer_id).first()

        email = (data.get('email') or (user.email if user else '') or '').strip()
        # Phone is mandatory on the model; fall back to the customer's phone.
        phone = (data.get('shipping_phone') or (getattr(user, 'phone_number', '') if user else '') or '').strip()

        with transaction.atomic():
            order = Order.objects.create(
                user=user,
                region=region,
                status=(data.get('status') or 'PENDING').upper(),
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
                subtotal=dec(data.get('subtotal')),
                tax_rate=dec(data.get('tax_rate')),
                tax_amount=dec(data.get('tax_amount')),
                shipping_cost=dec(data.get('shipping_cost')),
                coupon_code=(data.get('discount_code') or None),
                discount_amount=dec(data.get('discount_amount')),
                total=dec(data.get('total')),
                payment_method=(data.get('payment_method') or 'COD'),
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
                try:
                    send_order_email('shipment_dispatched', order)
                except Exception:
                    pass
                try:
                    send_order_email('order_shipped', order)
                except Exception:
                    pass
            elif new_status == 'DELIVERED':
                try:
                    send_order_email('order_delivered', order)
                except Exception:
                    pass
            elif new_status == 'CANCELLED':
                try:
                    send_order_email('order_cancelled', order)
                except Exception:
                    pass

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
        return Response({"message": "Timeline updated."}, status=status.HTTP_201_CREATED)

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

        return Response({
            'total_orders': total_orders,
            'total_revenue': str(total_revenue),
            'pending_orders': pending_orders,
            'processing_orders': processing_orders,
            'shipped_orders': shipped_orders,
            'delivered_orders': delivered_orders,
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
    """Carts that hold items but never converted to an order — abandoned checkouts.
    Gated by 'orders.view'."""
    permission_classes = [require_permission('orders.view')]

    def list(self, request):
        # A cart that still holds items is an in-progress / abandoned checkout
        # (the checkout flow clears the cart on a successful order).
        carts = (Cart.objects.filter(items__isnull=False).distinct()
                 .select_related('region', 'user').prefetch_related('items__product'))
        out = []
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
    def process(self, request, pk=None):
        """Process a refund through the original payment gateway."""
        refund = self.get_object()
        if refund.status != 'PENDING':
            return Response({"error": "Only pending refunds can be processed"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            result = refund_payment(refund.order, refund.amount, refund.reason)
            try:
                send_order_email(
                    'refund_processed', refund.order,
                    extra_context={'refund_amount': str(refund.amount)},
                )
            except Exception:
                pass
            return Response({
                "message": "Refund processed successfully",
                "result": result
            })
        except PaymentError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)


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


import json as _json
import os as _os

from apps.admin_dashboard.models import PaymentGateway
from apps.audit.recorder import record_audit
from .payments import (
    verify_stripe_signature, verify_razorpay_signature, verify_paypal_signature,
)


def _resolve_gateway_row(code):
    """Find any enabled PaymentGateway row for `code` (any region) to source
    webhook_secret + flag the integration as active. Returns None if not configured."""
    return PaymentGateway.objects.filter(code=code, is_enabled=True).first()


def _apply_order_payment_state(order, payment_status, status_field=None):
    """Helper to safely mutate order.payment_status from a webhook event."""
    if not order:
        return
    order.payment_status = payment_status
    fields = ['payment_status', 'updated_at']
    if status_field:
        order.status = status_field
        fields.append('status')
    order.save(update_fields=fields)


class StripeWebhookView(views.APIView):
    permission_classes = [AllowAny]
    parser_classes = []  # we need raw bytes for signature verification

    def post(self, request):
        raw = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE', '')

        gateway = _resolve_gateway_row('STRIPE')
        if not gateway:
            return Response({"error": "Stripe gateway is not configured."},
                            status=status.HTTP_400_BAD_REQUEST)

        secret = (gateway.extra_config or {}).get('webhook_secret') \
            or _os.getenv('STRIPE_WEBHOOK_SECRET', '')
        if not verify_stripe_signature(raw, sig_header, secret):
            return Response({"error": "Invalid signature."},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            payload = _json.loads(raw.decode('utf-8'))
        except Exception:
            return Response({"error": "Malformed payload."},
                            status=status.HTTP_400_BAD_REQUEST)

        event_id = payload.get('id') or ''
        event_type = payload.get('type') or ''

        if event_id and WebhookEvent.objects.filter(
            gateway='STRIPE', event_id=event_id
        ).exists():
            return Response({"status": "duplicate"}, status=status.HTTP_200_OK)

        we = WebhookEvent.objects.create(
            gateway='STRIPE',
            event_id=event_id,
            event_type=event_type,
            payload=payload,
            status='PENDING',
        )
        record_audit(
            'webhook.received', target_type='WebhookEvent', target_id=we.id,
            summary=f'Stripe {event_type}',
            changes={'gateway': 'STRIPE', 'event_type': event_type, 'event_id': event_id},
        )

        try:
            data_obj = (payload.get('data') or {}).get('object') or {}
            payment_id = data_obj.get('id') or data_obj.get('payment_intent')
            order = Order.objects.filter(payment_id=payment_id).first() if payment_id else None
            if event_type == 'payment_intent.succeeded' or event_type == 'charge.succeeded':
                _apply_order_payment_state(order, 'PAID', status_field='PROCESSING' if order and order.status == 'PENDING' else None)
            elif event_type in ('payment_intent.payment_failed', 'charge.failed'):
                _apply_order_payment_state(order, 'FAILED')
            elif event_type in ('charge.refunded',):
                _apply_order_payment_state(order, 'REFUNDED')
            we.status = 'PROCESSED'
            we.save(update_fields=['status'])
        except Exception as exc:
            we.status = 'FAILED'
            we.error_message = str(exc)
            we.error_log = str(exc)
            we.save(update_fields=['status', 'error_message', 'error_log'])

        return Response({"status": "ok"}, status=status.HTTP_200_OK)


class RazorpayWebhookView(views.APIView):
    permission_classes = [AllowAny]
    parser_classes = []

    def post(self, request):
        raw = request.body
        sig_header = request.META.get('HTTP_X_RAZORPAY_SIGNATURE', '')

        gateway = _resolve_gateway_row('RAZORPAY')
        if not gateway:
            return Response({"error": "Razorpay gateway is not configured."},
                            status=status.HTTP_400_BAD_REQUEST)

        secret = (gateway.extra_config or {}).get('webhook_secret') \
            or _os.getenv('RAZORPAY_WEBHOOK_SECRET', '')
        if not verify_razorpay_signature(raw, sig_header, secret):
            return Response({"error": "Invalid signature."},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            payload = _json.loads(raw.decode('utf-8'))
        except Exception:
            return Response({"error": "Malformed payload."},
                            status=status.HTTP_400_BAD_REQUEST)

        payment_entity = ((payload.get('payload') or {}).get('payment') or {}).get('entity') or {}
        event_id = payment_entity.get('id') or ''
        event_type = payload.get('event') or ''

        if event_id and WebhookEvent.objects.filter(
            gateway='RAZORPAY', event_id=event_id
        ).exists():
            return Response({"status": "duplicate"}, status=status.HTTP_200_OK)

        we = WebhookEvent.objects.create(
            gateway='RAZORPAY',
            event_id=event_id,
            event_type=event_type,
            payload=payload,
            status='PENDING',
        )
        record_audit(
            'webhook.received', target_type='WebhookEvent', target_id=we.id,
            summary=f'Razorpay {event_type}',
            changes={'gateway': 'RAZORPAY', 'event_type': event_type, 'event_id': event_id},
        )

        try:
            payment_id = payment_entity.get('order_id') or payment_entity.get('id')
            order = Order.objects.filter(payment_id=payment_id).first() if payment_id else None
            if event_type in ('payment.captured', 'order.paid'):
                _apply_order_payment_state(order, 'PAID', status_field='PROCESSING' if order and order.status == 'PENDING' else None)
            elif event_type == 'payment.failed':
                _apply_order_payment_state(order, 'FAILED')
            elif event_type == 'refund.processed':
                _apply_order_payment_state(order, 'REFUNDED')
            we.status = 'PROCESSED'
            we.save(update_fields=['status'])
        except Exception as exc:
            we.status = 'FAILED'
            we.error_message = str(exc)
            we.error_log = str(exc)
            we.save(update_fields=['status', 'error_message', 'error_log'])

        return Response({"status": "ok"}, status=status.HTTP_200_OK)


class PaypalWebhookView(views.APIView):
    permission_classes = [AllowAny]
    parser_classes = []

    def post(self, request):
        raw = request.body

        gateway = _resolve_gateway_row('PAYPAL')
        if not gateway:
            return Response({"error": "PayPal gateway is not configured."},
                            status=status.HTTP_400_BAD_REQUEST)

        webhook_id = (gateway.extra_config or {}).get('webhook_id') \
            or _os.getenv('PAYPAL_WEBHOOK_ID', '')
        if not verify_paypal_signature(request.META, raw, webhook_id):
            return Response({"error": "Invalid signature."},
                            status=status.HTTP_400_BAD_REQUEST)

        try:
            payload = _json.loads(raw.decode('utf-8'))
        except Exception:
            return Response({"error": "Malformed payload."},
                            status=status.HTTP_400_BAD_REQUEST)

        event_id = payload.get('id') or ''
        event_type = payload.get('event_type') or ''

        if event_id and WebhookEvent.objects.filter(
            gateway='PAYPAL', event_id=event_id
        ).exists():
            return Response({"status": "duplicate"}, status=status.HTTP_200_OK)

        we = WebhookEvent.objects.create(
            gateway='PAYPAL',
            event_id=event_id,
            event_type=event_type,
            payload=payload,
            status='PENDING',
        )
        record_audit(
            'webhook.received', target_type='WebhookEvent', target_id=we.id,
            summary=f'PayPal {event_type}',
            changes={'gateway': 'PAYPAL', 'event_type': event_type, 'event_id': event_id},
        )

        try:
            resource = payload.get('resource') or {}
            payment_id = resource.get('id') or resource.get('parent_payment')
            order = Order.objects.filter(payment_id=payment_id).first() if payment_id else None
            if event_type in ('PAYMENT.CAPTURE.COMPLETED', 'CHECKOUT.ORDER.APPROVED'):
                _apply_order_payment_state(order, 'PAID', status_field='PROCESSING' if order and order.status == 'PENDING' else None)
            elif event_type in ('PAYMENT.CAPTURE.DENIED', 'PAYMENT.CAPTURE.DECLINED'):
                _apply_order_payment_state(order, 'FAILED')
            elif event_type in ('PAYMENT.CAPTURE.REFUNDED',):
                _apply_order_payment_state(order, 'REFUNDED')
            we.status = 'PROCESSED'
            we.save(update_fields=['status'])
        except Exception as exc:
            we.status = 'FAILED'
            we.error_message = str(exc)
            we.error_log = str(exc)
            we.save(update_fields=['status', 'error_message', 'error_log'])

        return Response({"status": "ok"}, status=status.HTTP_200_OK)


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
