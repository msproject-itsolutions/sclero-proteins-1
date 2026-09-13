"""Storefront checkout endpoints: create the order, then confirm its payment."""
from rest_framework import status, views
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.regions.models import Region

from .access import make_order_token, order_from_token
from .cart_identity import find_cart
from .checkout import EXPIRED_MESSAGE, CheckoutError, clean_checkout_details, create_checkout_order
from .order_payments import PAID_STATES, confirm_payment
from .payments import PaymentError, PaymentOutcomeUnknown


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
