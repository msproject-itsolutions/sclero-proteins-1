"""
Payment gateway routing + adapters.

Goals:
  * Smart, region-locked routing — a gateway can only be charged if it is
    enabled for the order's region (Razorpay/COD for India, Stripe/PayPal for UK).
  * One uniform interface (`charge` / `verify_transaction` / `refund` / `verify_webhook_signature` / `parse_webhook_event`) regardless of provider.
  * Refund integrity — refunds are always issued through the SAME gateway and
    currency the order was paid with.

Live SDK calls are made only when a gateway is configured with real credentials
AND the provider SDK is installed. Otherwise a deterministic sandbox result is
returned, preserving the project's existing sandbox checkout behaviour.
"""
import hashlib
import hmac
import json
import os
import time
import logging
from decimal import Decimal

import requests
from django.conf import settings

from apps.admin_dashboard.models import PaymentGateway

logger = logging.getLogger(__name__)

class PaymentError(Exception):
    """Raised for routing/validation/charge failures. Carries an HTTP-friendly message."""


def _sandbox_payments_allowed() -> bool:
    return (
        settings.DEBUG
        or getattr(settings, 'TESTING', False)
        or os.getenv('ALLOW_SANDBOX_PAYMENTS', 'False') == 'True'
    )


# --------------------------------------------------------------------------- #
# Adapters
# --------------------------------------------------------------------------- #
class BaseGatewayAdapter:
    code = None
    supports_live = False

    def __init__(self, gateway):
        self.gateway = gateway  # PaymentGateway instance

    # --- sandbox helpers (used until live credentials + SDK are present) ----
    def _sandbox_charge(self, order, payload):
        if not _sandbox_payments_allowed():
            raise PaymentError('Sandbox payments are disabled outside development.')
        return {
            "status": "SUCCESS",
            "transaction_id": payload.get("payment_id")
            or f"sandbox_{self.code.lower()}_{order.id}",
            "raw": {
                "sandbox_mode": True,
                "gateway": self.code,
                "message": "Simulated successful payment",
            },
        }

    def _sandbox_refund(self, order, amount, reason):
        if not _sandbox_payments_allowed():
            raise PaymentError('Sandbox refunds are disabled outside development.')
        return {
            "status": "REFUNDED",
            "refund_id": f"sandbox_refund_{self.code.lower()}_{order.id}",
            "raw": {
                "sandbox_mode": True,
                "gateway": self.code,
                "amount": str(amount),
                "reason": reason,
            },
        }

    @property
    def _is_live(self):
        return bool(self.gateway and self.gateway.mode == "LIVE" and self.gateway.secret_key)

    # --- public interface ----------------------------------------------------
    def charge(self, order, payload):
        """Verify/capture a payment. Returns a normalized result dict.

        In LIVE mode subclasses should call the provider SDK to VERIFY the
        client-supplied payment reference (e.g. Razorpay signature, Stripe
        PaymentIntent) before returning SUCCESS. Until keys exist we sandbox.
        """
        if self._is_live:
            raise PaymentError(
                f'{self.code} live capture is not implemented; disable this gateway '
                'until a provider-backed adapter is deployed.'
            )
        return self._sandbox_charge(order, payload)

    def refund(self, order, amount, reason=""):
        if not (self.gateway and self.gateway.supports_refunds):
            raise PaymentError(f"{self.code} does not support refunds.")
        if self._is_live:
            raise PaymentError(
                f'{self.code} live refunds are not implemented; reconcile this '
                'refund in the provider dashboard.'
            )
        return self._sandbox_refund(order, amount, reason)

    def verify_webhook_signature(self, raw_body: bytes, headers: dict, secret: str) -> bool:
        """
        Gateway-specific verification of the webhook request.
        Must be overridden by subclasses.
        """
        raise NotImplementedError("Subclasses must implement verify_webhook_signature.")

    def parse_webhook_event(self, payload: dict) -> dict:
        """
        Normalizes raw webhook payloads into a standardized event dictionary.
        Returns:
            {
                'event_type': str,  # 'payment.succeeded', 'payment.failed', 'refund.processed', 'unknown'
                'payment_id': str,  # Gateway transaction ID
                'order_id': str,    # Optional Sclero Proteins order ID
                'amount': Decimal,  # Transaction amount (optional)
                'status': str       # Gateway status
            }
        """
        raise NotImplementedError("Subclasses must implement parse_webhook_event.")

    def process_subscription(self, customer, subscription_payload):
        """
        Processes subscription creation, updates, and cancellations.
        Overridden by gateways supporting subscriptions (Stripe/PayPal).
        """
        raise NotImplementedError("Subclasses must implement process_subscription if supported.")


class RazorpayAdapter(BaseGatewayAdapter):
    code = "RAZORPAY"

    def verify_webhook_signature(self, raw_body: bytes, headers: dict, secret: str) -> bool:
        sig_header = headers.get('HTTP_X_RAZORPAY_SIGNATURE', '')
        return verify_razorpay_signature(raw_body, sig_header, secret)

    def parse_webhook_event(self, payload: dict) -> dict:
        event_type = payload.get('event', '')
        payment_entity = payload.get('payload', {}).get('payment', {}).get('entity', {})
        
        normalized_event = 'unknown'
        if event_type in ('payment.captured', 'order.paid'):
            normalized_event = 'payment.succeeded'
        elif event_type == 'payment.failed':
            normalized_event = 'payment.failed'
        elif event_type == 'refund.processed':
            normalized_event = 'refund.processed'

        payment_id = payment_entity.get('order_id') or payment_entity.get('id') or ''
        notes = payment_entity.get('notes', {})
        order_id = notes.get('order_id')

        amount = Decimal('0.00')
        if payment_entity.get('amount'):
            amount = Decimal(str(payment_entity.get('amount'))) / Decimal('100.00')

        return {
            'event_type': normalized_event,
            'payment_id': payment_id,
            'order_id': order_id,
            'amount': amount,
            'status': payment_entity.get('status', '')
        }


class StripeAdapter(BaseGatewayAdapter):
    code = "STRIPE"

    def verify_webhook_signature(self, raw_body: bytes, headers: dict, secret: str) -> bool:
        sig_header = headers.get('HTTP_STRIPE_SIGNATURE', '')
        return verify_stripe_signature(raw_body, sig_header, secret)

    def parse_webhook_event(self, payload: dict) -> dict:
        event_type = payload.get('type', '')
        data_obj = payload.get('data', {}).get('object', {})
        
        normalized_event = 'unknown'
        if event_type in ('payment_intent.succeeded', 'charge.succeeded'):
            normalized_event = 'payment.succeeded'
        elif event_type in ('payment_intent.payment_failed', 'charge.failed'):
            normalized_event = 'payment.failed'
        elif event_type in ('charge.refunded',):
            normalized_event = 'refund.processed'

        payment_id = data_obj.get('id') or data_obj.get('payment_intent') or ''
        metadata = data_obj.get('metadata', {})
        order_id = metadata.get('order_id') or data_obj.get('client_reference_id')

        amount = Decimal('0.00')
        if data_obj.get('amount_received') or data_obj.get('amount'):
            amt_val = data_obj.get('amount_received') or data_obj.get('amount')
            amount = Decimal(str(amt_val)) / Decimal('100.00')

        return {
            'event_type': normalized_event,
            'payment_id': payment_id,
            'order_id': order_id,
            'amount': amount,
            'status': data_obj.get('status', '')
        }


class PayPalAdapter(BaseGatewayAdapter):
    code = "PAYPAL"

    def verify_webhook_signature(self, raw_body: bytes, headers: dict, secret: str) -> bool:
        webhook_id = (self.gateway.extra_config or {}).get('webhook_id') or os.getenv('PAYPAL_WEBHOOK_ID', '')
        client_id = self.gateway.publishable_key or os.getenv('PAYPAL_CLIENT_ID', '')
        client_secret = self.gateway.secret_key or os.getenv('PAYPAL_CLIENT_SECRET', '')
        return verify_paypal_signature(
            headers, raw_body, webhook_id, client_id, client_secret, self.gateway.mode
        )

    def parse_webhook_event(self, payload: dict) -> dict:
        event_type = payload.get('event_type', '')
        resource = payload.get('resource', {})
        
        normalized_event = 'unknown'
        if event_type in ('PAYMENT.CAPTURE.COMPLETED', 'CHECKOUT.ORDER.APPROVED'):
            normalized_event = 'payment.succeeded'
        elif event_type in ('PAYMENT.CAPTURE.DENIED', 'PAYMENT.CAPTURE.DECLINED'):
            normalized_event = 'payment.failed'
        elif event_type in ('PAYMENT.CAPTURE.REFUNDED',):
            normalized_event = 'refund.processed'

        payment_id = resource.get('id') or resource.get('parent_payment') or ''
        order_id = resource.get('custom_id') or resource.get('invoice_number')

        amount = Decimal('0.00')
        amt_struct = resource.get('amount', {})
        if amt_struct.get('value'):
            amount = Decimal(str(amt_struct.get('value')))

        return {
            'event_type': normalized_event,
            'payment_id': payment_id,
            'order_id': order_id,
            'amount': amount,
            'status': resource.get('status', '')
        }


class CODAdapter(BaseGatewayAdapter):
    code = "COD"
    supports_live = True

    def charge(self, order, payload):
        return {
            "status": "PENDING",
            "transaction_id": f"cod_{order.id}",
            "raw": {"gateway": "COD", "message": "Cash to be collected on delivery"},
        }

    def refund(self, order, amount, reason=""):
        return {
            "status": "REFUND_PENDING",
            "refund_id": f"cod_refund_{order.id}",
            "raw": {"gateway": "COD", "amount": str(amount), "reason": reason,
                    "message": "Manual/offline COD refund required"},
        }

    def verify_webhook_signature(self, raw_body: bytes, headers: dict, secret: str) -> bool:
        return True # COD has no external webhooks

    def parse_webhook_event(self, payload: dict) -> dict:
        return {
            'event_type': 'unknown',
            'payment_id': '',
            'order_id': '',
            'amount': Decimal('0.00'),
            'status': ''
        }


_ADAPTERS = {}

def register_adapter(code: str, adapter_cls):
    """
    Registers a payment gateway adapter class dynamically.
    Allows future payment methods to be added without modifying core files.
    """
    _ADAPTERS[code.upper()] = adapter_cls

# Register default gateways
register_adapter("RAZORPAY", RazorpayAdapter)
register_adapter("STRIPE", StripeAdapter)
register_adapter("PAYPAL", PayPalAdapter)
register_adapter("COD", CODAdapter)


def get_adapter(gateway):
    cls = _ADAPTERS.get(gateway.code, BaseGatewayAdapter)
    adapter = cls(gateway)
    adapter.code = gateway.code
    return adapter


def resolve_gateway(region, code):
    """
    Region-locked gateway resolution ("smart routing").
    """
    code = (code or "").upper()
    gateway = PaymentGateway.objects.filter(
        region=region, code=code, is_enabled=True
    ).first()
    if not gateway:
        raise PaymentError(
            f"Payment method '{code}' is not available for region {region.code}."
        )
    adapter = get_adapter(gateway)
    if gateway.code == 'COD':
        return adapter
    if gateway.mode == 'LIVE' and not adapter.supports_live:
        raise PaymentError(
            f"Payment method '{code}' is disabled because its live provider adapter "
            'has not been implemented.'
        )
    if gateway.mode != 'LIVE' and not _sandbox_payments_allowed():
        raise PaymentError(f"Test payment method '{code}' is disabled in production.")
    return adapter


def gateway_is_checkout_ready(gateway) -> bool:
    """Return whether a gateway can safely be offered to a shopper."""
    adapter = get_adapter(gateway)
    if gateway.code == 'COD':
        return True
    if gateway.mode == 'LIVE':
        return adapter.supports_live
    return _sandbox_payments_allowed()


def refund_payment(order, amount=None, reason=""):
    """
    Issue a refund with integrity guarantees.
    """
    amount = Decimal(str(amount)) if amount is not None else order.total
    if amount <= 0 or amount > order.total:
        raise PaymentError("Refund amount must be between 0 and the order total.")

    adapter = resolve_gateway(order.region, order.payment_method)
    result = adapter.refund(order, amount, reason)
    result["currency_code"] = order.currency_code
    result["gateway"] = order.payment_method
    return result


# --------------------------------------------------------------------------- #
# Webhook signature verification
# --------------------------------------------------------------------------- #
def verify_stripe_signature(payload_bytes: bytes, sig_header: str,
                            secret: str, tolerance: int = 300) -> bool:
    if not sig_header or not secret:
        return False
    try:
        parts = [p.split('=', 1) for p in sig_header.split(',') if '=' in p]
        ts = next((value for key, value in parts if key == 't'), None)
        signatures = [value for key, value in parts if key == 'v1']
        if not ts or not signatures:
            return False
        if abs(time.time() - int(ts)) > tolerance:
            return False
        signed_payload = f"{ts}.{payload_bytes.decode('utf-8')}".encode('utf-8')
        computed = hmac.new(secret.encode('utf-8'), signed_payload,
                            hashlib.sha256).hexdigest()
        return any(hmac.compare_digest(signature, computed) for signature in signatures)
    except Exception:
        return False


def verify_razorpay_signature(payload_bytes: bytes, sig_header: str,
                              secret: str) -> bool:
    if not secret:
        return False
    try:
        computed = hmac.new(secret.encode('utf-8'), payload_bytes,
                            hashlib.sha256).hexdigest()
        return hmac.compare_digest(computed, sig_header or '')
    except Exception:
        return False


def verify_paypal_signature(headers, payload_bytes: bytes, webhook_id: str,
                            client_id: str, client_secret: str,
                            mode: str = 'LIVE') -> bool:
    required = {
        'auth_algo': headers.get('HTTP_PAYPAL_AUTH_ALGO', ''),
        'cert_url': headers.get('HTTP_PAYPAL_CERT_URL', ''),
        'transmission_id': headers.get('HTTP_PAYPAL_TRANSMISSION_ID', ''),
        'transmission_sig': headers.get('HTTP_PAYPAL_TRANSMISSION_SIG', ''),
        'transmission_time': headers.get('HTTP_PAYPAL_TRANSMISSION_TIME', ''),
    }
    if not webhook_id or not client_id or not client_secret or not all(required.values()):
        return False

    try:
        event = json.loads(payload_bytes.decode('utf-8'))
        base = 'https://api-m.sandbox.paypal.com' if mode == 'TEST' \
            else 'https://api-m.paypal.com'
        token_response = requests.post(
            f'{base}/v1/oauth2/token',
            auth=(client_id, client_secret),
            data={'grant_type': 'client_credentials'},
            headers={'Accept': 'application/json'},
            timeout=10,
        )
        token_response.raise_for_status()
        access_token = token_response.json().get('access_token', '')
        if not access_token:
            return False

        verify_response = requests.post(
            f'{base}/v1/notifications/verify-webhook-signature',
            json={
                **required,
                'webhook_id': webhook_id,
                'webhook_event': event,
            },
            headers={
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json',
            },
            timeout=10,
        )
        verify_response.raise_for_status()
        return verify_response.json().get('verification_status') == 'SUCCESS'
    except (ValueError, UnicodeDecodeError, requests.RequestException):
        return False
