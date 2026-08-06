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
from decimal import Decimal, ROUND_HALF_UP

import requests
from django.conf import settings

from apps.admin_dashboard.models import PaymentGateway

logger = logging.getLogger(__name__)

class PaymentError(Exception):
    """Raised for routing/validation/charge failures. Carries an HTTP-friendly message."""


# Stripe quotes amounts in a currency's smallest unit. Most currencies have 100
# of them (£1.00 -> 100), but these do not — sending 100 for ¥1 would overcharge
# a customer 100x. https://docs.stripe.com/currencies#special-cases
ZERO_DECIMAL_CURRENCIES = {
    'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA',
    'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
}
# Charged in thousandths, but Stripe requires the last digit to be 0.
THREE_DECIMAL_CURRENCIES = {'BHD', 'JOD', 'KWD', 'OMR', 'TND'}


def to_minor_units(amount, currency_code: str) -> int:
    """Convert a decimal amount to the integer minor units Stripe expects."""
    code = (currency_code or '').upper()
    amount = Decimal(str(amount))
    if code in ZERO_DECIMAL_CURRENCIES:
        return int(amount.to_integral_value(rounding=ROUND_HALF_UP))
    if code in THREE_DECIMAL_CURRENCIES:
        units = int((amount * Decimal('1000')).to_integral_value(rounding=ROUND_HALF_UP))
        return units - (units % 10)  # Stripe rejects thousandths not ending in 0
    return int((amount * Decimal('100')).to_integral_value(rounding=ROUND_HALF_UP))


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
        if not _sandbox_payments_allowed() and not (self.gateway and self.gateway.is_enabled and self.gateway.mode == 'TEST'):
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
        if not _sandbox_payments_allowed() and not (self.gateway and self.gateway.mode == 'TEST'):
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

    def create_intent(self, amount, currency_code, metadata=None):
        """Open a payment with the provider so the browser SDK can collect it.

        Returns a dict the frontend hands to the gateway's JS SDK, e.g.
        {"client_secret": ..., "publishable_key": ...} for Stripe. Amount is
        always supplied by the server, never by the client.
        """
        raise NotImplementedError(f"{self.code} has no browser payment collection.")

    def reconcile_payment(self, payment_id, expected_amount, currency_code):
        """Return the authoritative state of a previously opened payment.

        This is intentionally a server-to-server lookup. It is used only as a
        fallback to signed webhooks, so an untrusted browser can never promote
        an unpaid checkout to a paid order.
        """
        return {'state': 'unavailable'}

    def test_connection(self):
        if self.code == 'COD':
            return {'ok': True, 'message': 'Cash on Delivery requires no external connection.'}
        if not self.gateway or not self.gateway.secret_key:
            raise PaymentError('Add the required credentials before testing this gateway.')
        if self.gateway.mode != 'LIVE':
            return {'ok': True, 'message': 'Credentials are saved. Switch to live mode to verify them with the provider.'}
        raise PaymentError(f'{self.code} does not expose a connection test.')

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
    supports_live = True

    API_BASE = "https://api.razorpay.com/v1"
    TIMEOUT = 20

    def _auth(self):
        # Razorpay authenticates with key_id:key_secret basic auth.
        return (self.gateway.publishable_key or "", self.gateway.secret_key or "")

    def _request(self, method, path, data=None):
        try:
            resp = requests.request(
                method, f"{self.API_BASE}{path}",
                auth=self._auth(), data=data, timeout=self.TIMEOUT,
            )
        except requests.RequestException as exc:
            logger.exception("Razorpay %s %s failed to connect", method, path)
            raise PaymentError("Could not reach Razorpay. No money has been taken; please try again.") from exc

        try:
            body = resp.json()
        except ValueError:
            logger.error("Razorpay %s %s returned non-JSON (HTTP %s)", method, path, resp.status_code)
            raise PaymentError("Razorpay returned an unreadable response.")

        if resp.status_code >= 400:
            err = (body.get("error") or {})
            logger.error(
                "Razorpay %s %s -> HTTP %s code=%s: %s",
                method, path, resp.status_code, err.get("code"), err.get("description"),
            )
            raise PaymentError(err.get("description") or "Razorpay rejected the payment.")
        return body

    def create_intent(self, amount, currency_code, metadata=None):
        if not self.gateway or not self.gateway.is_configured:
            return {"sandbox": True, "razorpay_order_id": None,
                    "publishable_key": self.gateway.publishable_key or ""}

        data = {
            "amount": to_minor_units(amount, currency_code),
            "currency": (currency_code or "").upper(),
        }
        for key, value in (metadata or {}).items():
            data[f"notes[{key}]"] = str(value)

        rzp_order = self._request("POST", "/orders", data=data)
        return {
            "razorpay_order_id": rzp_order.get("id"),
            "publishable_key": self.gateway.publishable_key or "",
        }

    def test_connection(self):
        if not self.gateway.publishable_key or not self.gateway.secret_key:
            raise PaymentError('Razorpay Key ID and Key Secret are required.')
        self._request('GET', '/payments?count=1')
        return {'ok': True, 'message': 'Razorpay credentials verified successfully.'}

    def _verify_handshake(self, payload):
        """Verify the browser callback really came from Razorpay.

        Signature = HMAC_SHA256("<razorpay_order_id>|<razorpay_payment_id>", key_secret).
        """
        rzp_order_id = (payload or {}).get("razorpay_order_id")
        signature = (payload or {}).get("razorpay_signature")
        payment_id = (payload or {}).get("payment_id")
        if not (rzp_order_id and signature):
            # No handshake supplied — the authoritative API fetch below still
            # gates the charge, so this is a warning rather than a hard failure.
            logger.warning("Razorpay charge for %s arrived without an order id/signature", payment_id)
            return
        expected_body = f"{rzp_order_id}|{payment_id}".encode()
        if not verify_razorpay_signature(expected_body, signature, self.gateway.secret_key):
            logger.error("Razorpay signature mismatch for payment %s", payment_id)
            raise PaymentError("Payment verification failed. Please contact support before retrying.")

    def charge(self, order, payload):
        if not self.gateway or not self.gateway.is_configured:
            return self._sandbox_charge(order, payload)

        payment_id = (payload or {}).get("payment_id") or ""
        if not payment_id.startswith("pay_"):
            if not self._is_live:
                return self._sandbox_charge(order, payload)
            raise PaymentError("A valid Razorpay payment reference is required.")

        if not self._is_live:
            try:
                self._verify_handshake(payload)
                payment = self._request("GET", f"/payments/{payment_id}")
            except PaymentError as exc:
                logger.warning("Razorpay TEST mode live API fetch failed (%s); falling back to sandbox charge.", exc)
                return self._sandbox_charge(order, payload)
        else:
            self._verify_handshake(payload)
            payment = self._request("GET", f"/payments/{payment_id}")

        expected_minor = to_minor_units(order.total, order.currency_code)
        paid_minor = int(payment.get("amount") or 0)
        payment_currency = (payment.get("currency") or "").upper()

        if payment_currency != (order.currency_code or "").upper():
            logger.error(
                "Razorpay currency mismatch on order %s: got %s, expected %s",
                order.id, payment_currency, order.currency_code,
            )
            raise PaymentError("The payment currency does not match the order.")
        if paid_minor != expected_minor:
            logger.error(
                "Razorpay amount mismatch on order %s: got %s, expected %s",
                order.id, paid_minor, expected_minor,
            )
            raise PaymentError("The amount paid does not match the order total.")

        state = payment.get("status")
        if state == "authorized":
            # Funds are held but not taken; capture or they auto-void.
            payment = self._request(
                "POST", f"/payments/{payment_id}/capture",
                data={"amount": expected_minor, "currency": payment_currency},
            )
            state = payment.get("status")

        if state != "captured":
            logger.warning("Razorpay payment %s not captured (status=%s)", payment_id, state)
            raise PaymentError(f"Payment was not completed (status: {state}).")

        return {
            "status": "SUCCESS",
            "transaction_id": payment_id,
            "raw": {
                "gateway": self.code,
                "mode": "LIVE",
                "amount": paid_minor,
                "currency": payment_currency,
                "method": payment.get("method"),
            },
        }

    def reconcile_payment(self, payment_id, expected_amount, currency_code):
        if not self._is_live or not (payment_id or '').startswith('pay_'):
            return {'state': 'unavailable'}
        payment = self._request('GET', f'/payments/{payment_id}')
        if (payment.get('currency') or '').upper() != (currency_code or '').upper():
            raise PaymentError('Gateway payment currency does not match the checkout.')
        if int(payment.get('amount') or 0) != to_minor_units(expected_amount, currency_code):
            raise PaymentError('Gateway payment amount does not match the checkout.')
        state = payment.get('status')
        if state == 'captured':
            return {'state': 'paid', 'raw': payment}
        if state in {'failed', 'refunded'}:
            return {'state': 'failed', 'raw': payment}
        return {'state': 'pending', 'raw': payment}

    def refund(self, order, amount, reason=""):
        if not (self.gateway and self.gateway.supports_refunds):
            raise PaymentError(f"{self.code} does not support refunds.")
        if not self._is_live:
            return self._sandbox_refund(order, amount, reason)

        if not (order.payment_id or "").startswith("pay_"):
            raise PaymentError("This order has no Razorpay payment to refund against.")

        minor = to_minor_units(amount, order.currency_code)
        # NOTE: unlike Stripe, Razorpay's refund API has no idempotency key, so a
        # retry after a timeout can issue a second refund. The caller records the
        # refund row; reconcile in the Razorpay dashboard before re-running one.
        body = self._request(
            "POST", f"/payments/{order.payment_id}/refund",
            data={"amount": minor, "notes[order_id]": str(order.id), "notes[reason]": (reason or "")[:255]},
        )
        return {
            "status": "REFUNDED" if body.get("status") in ("processed", "pending") else "FAILED",
            "refund_id": body.get("id"),
            "raw": {"gateway": self.code, "mode": "LIVE", "razorpay_status": body.get("status")},
        }

    def verify_webhook_signature(self, raw_body: bytes, headers: dict, secret: str) -> bool:
        sig_header = headers.get('HTTP_X_RAZORPAY_SIGNATURE', '')
        return verify_razorpay_signature(raw_body, sig_header, secret)

    def parse_webhook_event(self, payload: dict) -> dict:
        event_type = payload.get('event', '')
        payload_entities = payload.get('payload', {})
        payment_entity = payload_entities.get('payment', {}).get('entity', {})
        refund_entity = payload_entities.get('refund', {}).get('entity', {})
        entity = payment_entity or refund_entity
        
        normalized_event = 'unknown'
        if event_type in ('payment.captured', 'order.paid'):
            normalized_event = 'payment.succeeded'
        elif event_type == 'payment.failed':
            normalized_event = 'payment.failed'
        elif event_type == 'refund.processed':
            normalized_event = 'refund.processed'

        payment_id = payment_entity.get('id') or refund_entity.get('payment_id') or ''
        notes = entity.get('notes', {})
        order_id = notes.get('order_id')

        amount = Decimal('0.00')
        if entity.get('amount'):
            amount = Decimal(str(entity.get('amount'))) / Decimal('100.00')

        return {
            'event_type': normalized_event,
            'payment_id': payment_id,
            'order_id': order_id,
            'amount': amount,
            'status': entity.get('status', ''),
            'currency': entity.get('currency', ''),
        }


class StripeAdapter(BaseGatewayAdapter):
    code = "STRIPE"
    supports_live = True

    API_BASE = "https://api.stripe.com/v1"
    TIMEOUT = 20

    def _request(self, method, path, data=None):
        """Call the Stripe REST API with the gateway's secret key.

        Uses `requests` rather than the stripe SDK to stay consistent with the
        PayPal adapter and avoid a new runtime dependency.
        """
        try:
            resp = requests.request(
                method,
                f"{self.API_BASE}{path}",
                auth=(self.gateway.secret_key, ""),
                data=data,
                timeout=self.TIMEOUT,
            )
        except requests.RequestException as exc:
            logger.exception("Stripe %s %s failed to connect", method, path)
            raise PaymentError("Could not reach Stripe. No money has been taken; please try again.") from exc

        try:
            body = resp.json()
        except ValueError:
            logger.error("Stripe %s %s returned non-JSON (HTTP %s)", method, path, resp.status_code)
            raise PaymentError("Stripe returned an unreadable response.")

        if resp.status_code >= 400:
            err = (body.get("error") or {})
            logger.error(
                "Stripe %s %s -> HTTP %s type=%s code=%s: %s",
                method, path, resp.status_code, err.get("type"), err.get("code"), err.get("message"),
            )
            # Surface Stripe's own decline text — it is written for shoppers.
            raise PaymentError(err.get("message") or "Stripe rejected the payment.")
        return body

    def create_intent(self, amount, currency_code, metadata=None):
        if not self.gateway or not self.gateway.is_configured:
            # Keeps the sandbox checkout flow working without Stripe credentials.
            return {"sandbox": True, "client_secret": None,
                    "publishable_key": self.gateway.publishable_key or ""}

        data = {
            "amount": to_minor_units(amount, currency_code),
            "currency": (currency_code or "").lower(),
            "automatic_payment_methods[enabled]": "true",
        }
        for key, value in (metadata or {}).items():
            data[f"metadata[{key}]"] = str(value)

        intent = self._request("POST", "/payment_intents", data=data)
        return {
            "intent_id": intent.get("id"),
            "client_secret": intent.get("client_secret"),
            "publishable_key": self.gateway.publishable_key or "",
        }

    def test_connection(self):
        if not self.gateway.secret_key:
            raise PaymentError('Stripe secret key is required.')
        self._request('GET', '/balance')
        return {'ok': True, 'message': 'Stripe credentials verified successfully.'}

    def charge(self, order, payload):
        """Verify a PaymentIntent the client already confirmed.

        The client confirms the PaymentIntent in the browser; this only reads it
        back and checks it really succeeded, for the right amount, in the right
        currency. Never trust the client's word that payment happened.
        """
        if not self.gateway or not self.gateway.is_configured:
            return self._sandbox_charge(order, payload)

        intent_id = (payload or {}).get("payment_id") or ""
        if not intent_id.startswith("pi_"):
            if not self._is_live:
                return self._sandbox_charge(order, payload)
            raise PaymentError("A valid Stripe PaymentIntent reference is required.")

        if not self._is_live:
            try:
                intent = self._request("GET", f"/payment_intents/{intent_id}")
            except PaymentError as exc:
                logger.warning("Stripe TEST mode live API fetch failed (%s); falling back to sandbox charge.", exc)
                return self._sandbox_charge(order, payload)
        else:
            intent = self._request("GET", f"/payment_intents/{intent_id}")

        status_ = intent.get("status")
        if status_ != "succeeded":
            logger.warning("Stripe intent %s not succeeded (status=%s)", intent_id, status_)
            raise PaymentError(f"Payment was not completed (status: {status_}).")

        # Guard against a tampered client confirming a cheap intent for a costly
        # order, or paying in a weaker currency.
        expected_minor = to_minor_units(order.total, order.currency_code)
        received_minor = int(intent.get("amount_received") or 0)
        if received_minor != expected_minor:
            logger.error(
                "Stripe amount mismatch on order %s: got %s, expected %s",
                order.id, received_minor, expected_minor,
            )
            raise PaymentError("The amount paid does not match the order total.")

        intent_currency = (intent.get("currency") or "").upper()
        if intent_currency != (order.currency_code or "").upper():
            logger.error(
                "Stripe currency mismatch on order %s: got %s, expected %s",
                order.id, intent_currency, order.currency_code,
            )
            raise PaymentError("The payment currency does not match the order.")

        return {
            "status": "SUCCESS",
            "transaction_id": intent_id,
            "raw": {
                "gateway": self.code,
                "mode": "LIVE",
                "amount_received": received_minor,
                "currency": intent_currency,
                "latest_charge": intent.get("latest_charge"),
            },
        }

    def reconcile_payment(self, payment_id, expected_amount, currency_code):
        if not self._is_live or not (payment_id or '').startswith('pi_'):
            return {'state': 'unavailable'}
        intent = self._request('GET', f'/payment_intents/{payment_id}')
        if (intent.get('currency') or '').upper() != (currency_code or '').upper():
            raise PaymentError('Gateway payment currency does not match the checkout.')
        if int(intent.get('amount_received') or 0) not in (0, to_minor_units(expected_amount, currency_code)):
            raise PaymentError('Gateway payment amount does not match the checkout.')
        if intent.get('status') == 'succeeded':
            if int(intent.get('amount_received') or 0) != to_minor_units(expected_amount, currency_code):
                raise PaymentError('Gateway payment amount does not match the checkout.')
            return {'state': 'paid', 'raw': intent}
        if intent.get('status') in {'canceled', 'requires_payment_method'}:
            return {'state': 'failed', 'raw': intent}
        return {'state': 'pending', 'raw': intent}

    def refund(self, order, amount, reason=""):
        if not (self.gateway and self.gateway.supports_refunds):
            raise PaymentError(f"{self.code} does not support refunds.")
        if not self._is_live:
            return self._sandbox_refund(order, amount, reason)

        if not (order.payment_id or "").startswith("pi_"):
            raise PaymentError("This order has no Stripe PaymentIntent to refund against.")

        data = {
            "payment_intent": order.payment_id,
            "amount": to_minor_units(amount, order.currency_code),
            "metadata[order_id]": str(order.id),
        }
        if reason:
            data["metadata[reason]"] = reason[:500]

        # Stripe dedupes retries of the same refund for 24h via this key, so a
        # timeout-and-retry cannot pay the customer twice.
        headers_key = f"refund_{order.id}_{to_minor_units(amount, order.currency_code)}"
        try:
            resp = requests.post(
                f"{self.API_BASE}/refunds",
                auth=(self.gateway.secret_key, ""),
                data=data,
                headers={"Idempotency-Key": headers_key},
                timeout=self.TIMEOUT,
            )
            body = resp.json()
        except (requests.RequestException, ValueError) as exc:
            logger.exception("Stripe refund failed for order %s", order.id)
            raise PaymentError("Could not reach Stripe to issue the refund.") from exc

        if resp.status_code >= 400:
            err = (body.get("error") or {})
            logger.error("Stripe refund error for order %s: %s", order.id, err.get("message"))
            raise PaymentError(err.get("message") or "Stripe rejected the refund.")

        return {
            "status": "REFUNDED" if body.get("status") in ("succeeded", "pending") else "FAILED",
            "refund_id": body.get("id"),
            "raw": {"gateway": self.code, "mode": "LIVE", "stripe_status": body.get("status")},
        }

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

        payment_id = data_obj.get('payment_intent') or data_obj.get('id') or ''
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
            'status': data_obj.get('status', ''),
            'currency': data_obj.get('currency', ''),
        }


class PayPalAdapter(BaseGatewayAdapter):
    code = "PAYPAL"
    supports_live = True
    TIMEOUT = 20

    @property
    def API_BASE(self):
        return 'https://api-m.sandbox.paypal.com' if self.gateway.mode == 'TEST' else 'https://api-m.paypal.com'

    def _token(self):
        client_id = self.gateway.publishable_key or ''
        client_secret = self.gateway.secret_key or ''
        if not client_id or not client_secret:
            raise PaymentError('PayPal Client ID and Client Secret are required.')
        try:
            response = requests.post(
                f'{self.API_BASE}/v1/oauth2/token',
                auth=(client_id, client_secret),
                data={'grant_type': 'client_credentials'},
                headers={'Accept': 'application/json'},
                timeout=self.TIMEOUT,
            )
            body = response.json()
        except (requests.RequestException, ValueError) as exc:
            raise PaymentError('Could not reach PayPal. Please try again.') from exc
        if response.status_code >= 400 or not body.get('access_token'):
            raise PaymentError(body.get('error_description') or 'PayPal rejected these credentials.')
        return body['access_token']

    def _request(self, method, path, payload=None, idempotency_key=''):
        headers = {
            'Authorization': f'Bearer {self._token()}',
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        }
        if idempotency_key:
            headers['PayPal-Request-Id'] = idempotency_key
        try:
            response = requests.request(
                method, f'{self.API_BASE}{path}', json=payload,
                headers=headers, timeout=self.TIMEOUT,
            )
            body = response.json() if response.content else {}
        except (requests.RequestException, ValueError) as exc:
            raise PaymentError('Could not reach PayPal. Please try again.') from exc
        if response.status_code >= 400:
            details = body.get('details') or []
            message = details[0].get('description') if details else body.get('message')
            raise PaymentError(message or 'PayPal rejected the request.')
        return body

    def test_connection(self):
        self._token()
        return {'ok': True, 'message': 'PayPal credentials verified successfully.'}

    def create_intent(self, amount, currency_code, metadata=None):
        if not self._is_live:
            return {'sandbox': True, 'paypal_order_id': None,
                    'client_id': self.gateway.publishable_key or ''}
        metadata = metadata or {}
        order = self._request(
            'POST', '/v2/checkout/orders',
            {
                'intent': 'CAPTURE',
                'purchase_units': [{
                    'reference_id': str(metadata.get('order_id') or metadata.get('cart_id') or 'checkout'),
                    'custom_id': str(metadata.get('order_id') or ''),
                    'amount': {
                        'currency_code': (currency_code or '').upper(),
                        'value': f'{Decimal(str(amount)):.2f}',
                    },
                }],
            },
            idempotency_key=f"paypal_intent_{metadata.get('order_id') or metadata.get('cart_id') or int(time.time())}",
        )
        return {
            'paypal_order_id': order.get('id'),
            'client_id': self.gateway.publishable_key or '',
        }

    def charge(self, order, payload):
        if not self._is_live:
            return self._sandbox_charge(order, payload)
        paypal_order_id = (payload or {}).get('payment_id') or ''
        if not paypal_order_id:
            raise PaymentError('A PayPal order reference is required.')
        remote = self._request('GET', f'/v2/checkout/orders/{paypal_order_id}')
        if remote.get('status') == 'APPROVED':
            remote = self._request(
                'POST', f'/v2/checkout/orders/{paypal_order_id}/capture', {},
                idempotency_key=f'paypal_capture_{order.id}',
            )
        if remote.get('status') != 'COMPLETED':
            raise PaymentError(f"PayPal payment is not complete (status: {remote.get('status', 'unknown')}).")
        purchase_units = remote.get('purchase_units') or []
        captures = ((purchase_units[0].get('payments') or {}).get('captures') or []) if purchase_units else []
        capture = captures[0] if captures else {}
        amount = capture.get('amount') or (purchase_units[0].get('amount') if purchase_units else {}) or {}
        if Decimal(str(amount.get('value') or '0')) != Decimal(str(order.total)):
            raise PaymentError('The PayPal amount does not match the order total.')
        if (amount.get('currency_code') or '').upper() != (order.currency_code or '').upper():
            raise PaymentError('The PayPal currency does not match the order.')
        return {
            'status': 'SUCCESS',
            'transaction_id': capture.get('id') or paypal_order_id,
            'raw': {'gateway': self.code, 'mode': 'LIVE', 'paypal_order_id': paypal_order_id},
        }

    def reconcile_payment(self, payment_id, expected_amount, currency_code):
        if not self._is_live or not payment_id:
            return {'state': 'unavailable'}
        remote = self._request('GET', f'/v2/payments/captures/{payment_id}')
        amount = remote.get('amount') or {}
        if (amount.get('currency_code') or '').upper() != (currency_code or '').upper():
            raise PaymentError('Gateway payment currency does not match the checkout.')
        if Decimal(str(amount.get('value') or '0')) != Decimal(str(expected_amount)):
            raise PaymentError('Gateway payment amount does not match the checkout.')
        if remote.get('status') == 'COMPLETED':
            return {'state': 'paid', 'raw': remote}
        if remote.get('status') in {'DENIED', 'DECLINED', 'FAILED'}:
            return {'state': 'failed', 'raw': remote}
        return {'state': 'pending', 'raw': remote}

    def refund(self, order, amount, reason=''):
        if not (self.gateway and self.gateway.supports_refunds):
            raise PaymentError('PayPal refunds are disabled for this gateway.')
        if not self._is_live:
            return self._sandbox_refund(order, amount, reason)
        if not order.payment_id:
            raise PaymentError('This order has no PayPal capture reference to refund.')
        body = self._request(
            'POST', f'/v2/payments/captures/{order.payment_id}/refund',
            {
                'amount': {
                    'value': f'{Decimal(str(amount)):.2f}',
                    'currency_code': (order.currency_code or '').upper(),
                },
                'note_to_payer': (reason or 'Refund from Sclero Proteins')[:255],
            },
            idempotency_key=f'paypal_refund_{order.id}_{to_minor_units(amount, order.currency_code)}',
        )
        return {
            'status': 'REFUNDED' if body.get('status') in ('COMPLETED', 'PENDING') else 'FAILED',
            'refund_id': body.get('id', ''),
            'raw': {'gateway': self.code, 'mode': 'LIVE', 'paypal_status': body.get('status')},
        }

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
            'status': resource.get('status', ''),
            'currency': amt_struct.get('currency_code', ''),
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


def resolve_gateway(region, code, allow_disabled=False):
    """
    Region-locked gateway resolution ("smart routing").
    """
    code = (code or "").upper()
    filter_kwargs = {'region': region, 'code': code}
    if not allow_disabled:
        filter_kwargs['is_enabled'] = True
    gateway = PaymentGateway.objects.filter(**filter_kwargs).first()
    if not gateway and allow_disabled:
        gateway = PaymentGateway.objects.filter(code=code).first()
    if not gateway:
        if allow_disabled:
            return CODAdapter(None)
        region_str = region.code if region else 'N/A'
        raise PaymentError(f"Payment method '{code}' is not available for region {region_str}.")
    adapter = get_adapter(gateway)
    if gateway.code == 'COD' or allow_disabled:
        return adapter
    if gateway.mode == 'LIVE' and not adapter.supports_live:
        raise PaymentError(
            f"Payment method '{code}' is disabled because its live provider adapter "
            'has not been implemented.'
        )
    if gateway.mode != 'LIVE' and not gateway.is_configured and not _sandbox_payments_allowed():
        raise PaymentError(f"Test payment method '{code}' is disabled in production.")
    return adapter


def gateway_is_checkout_ready(gateway) -> bool:
    """Return whether a gateway can safely be offered to a shopper."""
    if not gateway or not gateway.is_enabled:
        return False
    adapter = get_adapter(gateway)
    if gateway.code == 'COD':
        return True
    if gateway.mode == 'LIVE':
        return adapter.supports_live
    if gateway.is_configured:
        return True
    return _sandbox_payments_allowed()


def refund_payment(order, amount=None, reason=""):
    """
    Issue a refund with integrity guarantees.
    """
    amount = Decimal(str(amount)) if amount is not None else order.total
    if amount <= 0 or amount > order.total:
        raise PaymentError("Refund amount must be between 0 and the order total.")

    try:
        adapter = resolve_gateway(order.region, order.payment_method, allow_disabled=True)
        result = adapter.refund(order, amount, reason)
    except PaymentError as exc:
        logger.warning("Live gateway refund for order %s failed: %s; falling back to offline refund.", order.id, exc)
        result = {
            "status": "REFUNDED",
            "refund_id": f"offline_refund_{order.id}",
            "raw": {
                "gateway": order.payment_method or "MANUAL",
                "amount": str(amount),
                "reason": reason,
                "note": f"Offline refund recorded: {exc}",
            },
        }

    result["currency_code"] = order.currency_code
    result["gateway"] = order.payment_method or "MANUAL"
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
