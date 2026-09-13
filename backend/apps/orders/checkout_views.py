"""Storefront checkout endpoints: create the order, then confirm its payment."""
import os

from django.db.models import Prefetch
from django.http import FileResponse
from rest_framework import status, views
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.regions.models import Region

from .access import make_order_token, order_from_token, send_order_access_email
from .cart_identity import find_cart
from .checkout import EXPIRED_MESSAGE, CheckoutError, clean_checkout_details, create_checkout_order
from .invoices import ensure_invoice
from .models import Order, OrderItem
from .order_payments import PAID_STATES, confirm_payment
from .payments import PaymentError, PaymentOutcomeUnknown
from .serializers import OrderSerializer


class CheckoutView(views.APIView):
    """POST /api/checkout/ — create (or resume) the order for the shopper's cart.

    Prices, tax, shipping and discounts are computed on the server; the body
    carries only contact details, the address, the payment method, an optional
    coupon code and the chosen shipping rate.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'checkout'

    def post(self, request):
        try:
            # Field validation runs first, as before, so a bad form is reported
            # the same way whatever the region or cart.
            details = clean_checkout_details(request.data, request.user)
            code = str(request.data.get('region') or 'UK').strip().upper()
            region = Region.objects.filter(code=code, is_active=True).first()
            if region is None:
                raise CheckoutError('Unknown store region.')
            cart = find_cart(request, region)
            if cart is None:
                raise CheckoutError('Cart is empty or invalid.')
            body, created = create_checkout_order(request.data, details, cart, request.user)
        except CheckoutError as exc:
            return Response({'error': exc.message}, status=exc.status)
        return Response(body, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class CheckoutConfirmView(views.APIView):
    """POST /api/checkout/confirm/ — verify the order's payment with the provider.

    Body: {order_id, order_token}; for Razorpay also the handler's
    razorpay_payment_id, razorpay_order_id and razorpay_signature.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'checkout'

    def post(self, request):
        order = order_from_token(request.data.get('order_token'))
        if order is None or str(order.pk) != str(request.data.get('order_id')):
            return Response({'error': 'Order not found.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            confirmed = confirm_payment(order.pk, request.data)
        except PaymentOutcomeUnknown:
            return Response(self._body(order, 'processing'), status=status.HTTP_202_ACCEPTED)
        except PaymentError as exc:
            if order.payment_status == 'EXPIRED':
                return Response({'error': EXPIRED_MESSAGE}, status=status.HTTP_410_GONE)
            return Response({'error': str(exc)}, status=status.HTTP_402_PAYMENT_REQUIRED)
        if confirmed.payment_status in PAID_STATES:
            return Response(self._body(confirmed, 'paid'))
        return Response(self._body(confirmed, 'processing'), status=status.HTTP_202_ACCEPTED)

    @staticmethod
    def _body(order, state):
        return {
            'state': state, 'order_id': order.pk, 'order_token': make_order_token(order),
            'status': order.status, 'payment_status': order.payment_status,
        }


class PublicOrderDetailView(views.APIView):
    """GET /api/orders/lookup/?token= — the order an emailed or checkout link grants."""
    permission_classes = [AllowAny]

    def get(self, request):
        token = request.query_params.get('token')
        if not token:
            return Response({'error': 'A valid order link is required.'}, status=status.HTTP_400_BAD_REQUEST)
        queryset = Order.objects.select_related('invoice', 'region').prefetch_related(
            Prefetch('items', queryset=OrderItem.objects.select_related('product')), 'refunds',
        )
        order = order_from_token(token, queryset)
        if order is None:
            return Response({'error': 'This order link is invalid or has expired.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(OrderSerializer(order).data)


class OrderAccessLinkView(views.APIView):
    """POST /api/orders/access-link/ {order_id, email} — email a fresh order link.

    Always answers the same way, so it reveals nothing about which orders exist.
    """
    permission_classes = [AllowAny]
    throttle_scope = 'contact'
    MESSAGE = 'If those details match an order, we have emailed a link to view it.'

    def post(self, request):
        order_id = str(request.data.get('order_id') or '').strip().lstrip('#')
        email = str(request.data.get('email') or '').strip()
        if order_id.isdigit() and email:
            order = Order.objects.placed().select_related('region').filter(
                pk=int(order_id), email__iexact=email,
            ).first()
            if order is not None:
                send_order_access_email(order)
        return Response({'detail': self.MESSAGE})


class CustomerInvoiceView(views.APIView):
    """GET /api/orders/invoice/?token= — the invoice PDF of a placed order."""
    permission_classes = [AllowAny]

    def get(self, request):
        order = order_from_token(
            request.query_params.get('token'), Order.objects.placed().select_related('region'),
        )
        if order is None:
            return Response({'error': 'This invoice link is invalid or has expired.'}, status=status.HTTP_404_NOT_FOUND)
        invoice = ensure_invoice(order)
        if not (invoice.pdf_file and os.path.exists(invoice.pdf_file.path)):
            invoice = ensure_invoice(order, refresh_pdf=True)
        if not (invoice.pdf_file and os.path.exists(invoice.pdf_file.path)):
            return Response(
                {'error': 'The invoice is not available yet. Please try again shortly.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        response = FileResponse(
            open(invoice.pdf_file.path, 'rb'), content_type='application/pdf',
            filename=f'Invoice_{invoice.invoice_number}.pdf',
        )
        response['Cache-Control'] = 'private, no-store'
        response['X-Content-Type-Options'] = 'nosniff'
        return response
