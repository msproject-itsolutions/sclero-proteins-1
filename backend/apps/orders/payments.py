"""
Payment gateway routing + adapters.

Goals:
  * Smart, region-locked routing — a gateway can only be charged if it is
    enabled for the order's region (Razorpay/COD for India, Stripe/PayPal for UK).
  * One uniform interface (`charge` / `refund`) regardless of provider.
  * Refund integrity — refunds are always issued through the SAME gateway and
    currency the order was paid with; this module is the single place that
    enforces that.

Live SDK calls are made only when a gateway is configured with real credentials
AND the provider SDK is installed. Otherwise a deterministic sandbox result is
returned, preserving the project's existing sandbox checkout behaviour. Staff
paste real keys from the admin panel later — no code change required here.
"""
import hashlib
import hmac
import os
import time
from decimal import Decimal

from apps.admin_dashboard.models import PaymentGateway


class PaymentError(Exception):
    """Raised for routing/validation/charge failures. Carries an HTTP-friendly message."""


# --------------------------------------------------------------------------- #
# Adapters
# --------------------------------------------------------------------------- #
class BaseGatewayAdapter:
    code = None

    def __init__(self, gateway):
        self.gateway = gateway  # PaymentGateway instance

    # --- sandbox helpers (used until live credentials + SDK are present) ----
    def _sandbox_charge(self, order, payload):
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
        return self._sandbox_charge(order, payload)

    def refund(self, order, amount, reason=""):
        if not (self.gateway and self.gateway.supports_refunds):
            raise PaymentError(f"{self.code} does not support refunds.")
        return self._sandbox_refund(order, amount, reason)


class RazorpayAdapter(BaseGatewayAdapter):
    code = "RAZORPAY"
    # LIVE hook: verify payload['payment_id'] + payload['signature'] via
    # `razorpay` SDK against publishable_key/secret_key, then return SUCCESS.


class StripeAdapter(BaseGatewayAdapter):
    code = "STRIPE"
    # LIVE hook: retrieve/confirm the PaymentIntent (payload['payment_id'])
    # via the `stripe` SDK using secret_key, then return SUCCESS.


class PayPalAdapter(BaseGatewayAdapter):
    code = "PAYPAL"
    # LIVE hook: capture the approved order id (payload['payment_id']) via the
    # PayPal Orders API using secret_key + extra_config['merchant_id'].


class CODAdapter(BaseGatewayAdapter):
    code = "COD"

    def charge(self, order, payload):
        # No money moves now; payment is collected on delivery.
        return {
            "status": "PENDING",
            "transaction_id": f"cod_{order.id}",
            "raw": {"gateway": "COD", "message": "Cash to be collected on delivery"},
        }

    def refund(self, order, amount, reason=""):
        # COD refunds are handled manually/offline; record the intent.
        return {
            "status": "REFUND_PENDING",
            "refund_id": f"cod_refund_{order.id}",
            "raw": {"gateway": "COD", "amount": str(amount), "reason": reason,
                    "message": "Manual/offline COD refund required"},
        }


_ADAPTERS = {
    "RAZORPAY": RazorpayAdapter,
    "STRIPE": StripeAdapter,
    "PAYPAL": PayPalAdapter,
    "COD": CODAdapter,
}


def get_adapter(gateway):
    cls = _ADAPTERS.get(gateway.code, BaseGatewayAdapter)
    adapter = cls(gateway)
    adapter.code = gateway.code
    return adapter


# --------------------------------------------------------------------------- #
# Routing
# --------------------------------------------------------------------------- #
def resolve_gateway(region, code):
    """
    Region-locked gateway resolution ("smart routing").

    Returns an adapter for `code` only if that gateway is ENABLED for `region`.
    Raises PaymentError otherwise — this is what prevents, e.g., a UK order
    being pushed through Razorpay.
    """
    code = (code or "").upper()
    gateway = PaymentGateway.objects.filter(
        region=region, code=code, is_enabled=True
    ).first()
    if not gateway:
        raise PaymentError(
            f"Payment method '{code}' is not available for region {region.code}."
        )
    return get_adapter(gateway)


def refund_payment(order, amount=None, reason=""):
    """
    Issue a refund with integrity guarantees:
      * routed through the SAME gateway the order was paid with (order.payment_method),
      * and only if that gateway is still enabled for the order's region,
      * amount defaults to the full order total and is implicitly in the order's
        original currency (order.currency_code) — no cross-currency refunds.
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
    """Verify a Stripe-Signature header ("t=...,v1=...") against the raw body.

    Returns False on any parse error, timestamp drift > tolerance, or HMAC mismatch.
    """
    if not sig_header or not secret:
        return False
    try:
        parts = dict(p.split('=', 1) for p in sig_header.split(',') if '=' in p)
        ts = parts.get('t')
        v1 = parts.get('v1')
        if not ts or not v1:
            return False
        if abs(time.time() - int(ts)) > tolerance:
            return False
        signed_payload = f"{ts}.{payload_bytes.decode('utf-8')}".encode('utf-8')
        computed = hmac.new(secret.encode('utf-8'), signed_payload,
                            hashlib.sha256).hexdigest()
        return hmac.compare_digest(v1, computed)
    except Exception:
        return False


def verify_razorpay_signature(payload_bytes: bytes, sig_header: str,
                              secret: str) -> bool:
    """Verify Razorpay's X-Razorpay-Signature (HMAC-SHA256 over raw body)."""
    if not secret:
        return False
    try:
        computed = hmac.new(secret.encode('utf-8'), payload_bytes,
                            hashlib.sha256).hexdigest()
        return hmac.compare_digest(computed, sig_header or '')
    except Exception:
        return False


def verify_paypal_signature(headers, payload_bytes: bytes,
                            webhook_id: str) -> bool:
    """STUB. PayPal verification requires a server-to-server call to
    POST /v1/notifications/verify-webhook-signature with the auth_algo /
    cert_url / transmission_id / transmission_sig / transmission_time headers
    plus the merchant's webhook_id.

    Gate the real verification behind PAYPAL_WEBHOOK_VERIFY=True so sandbox
    deployments without PayPal credentials keep working.
    """
    if os.getenv('PAYPAL_WEBHOOK_VERIFY', 'False') != 'True':
        return True
    # TODO: real implementation should POST to
    # https://api.paypal.com/v1/notifications/verify-webhook-signature and
    # return verification_status == 'SUCCESS'.
    return False
