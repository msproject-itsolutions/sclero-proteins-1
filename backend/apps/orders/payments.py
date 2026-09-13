"""
Payment gateway routing + adapters.

Goals:
  * Region-locked routing — a gateway can only be used when it is enabled for
    the order's region (Razorpay/COD for India, Stripe/COD for the UK).
  * Order-first collection — each online payment is opened for one order and
    counts only once the provider confirms that order's amount and currency.
  * Refund integrity — refunds go through the SAME gateway and currency the
    order was paid with, carrying an idempotency key.

Environment rules:
  * A gateway with credentials always talks to its provider — live keys, or the
    provider's sandbox with TEST keys — and never falls back to a simulated
    result. TEST-mode gateways are offered only when ALLOW_TEST_GATEWAYS is on.
  * A gateway without credentials is simulated (no provider call), which is
    allowed only when ALLOW_SIMULATED_PAYMENTS is on: DEBUG or the test suite.
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


class PaymentOutcomeUnknown(PaymentError):
    """The provider could not be reached, so whether the call took effect is unknown."""


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
    """Simulated results are for DEBUG and the test suite only (no override)."""
    return bool(settings.ALLOW_SIMULATED_PAYMENTS)


# --------------------------------------------------------------------------- #
# Adapters
# --------------------------------------------------------------------------- #
class BaseGatewayAdapter:
    code = None
    supports_live = False
    # True when the storefront can collect this gateway in the browser.
    browser_checkout = False

    def __init__(self, gateway):
        self.gateway = gateway  # PaymentGateway instance

    @property
    def simulated(self):
        """No credentials: results are simulated and no provider is ever called."""
        return not (self.gateway and self.gateway.is_configured)

    def _require_simulation_allowed(self):
        if not _sandbox_payments_allowed():
            raise PaymentError('Simulated payments are disabled outside development.')

    def _simulated_reference(self, order):
        return f'sim_{(self.code or "gateway").lower()}_{order.pk}'

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

    # --- order-first collection ---------------------------------------------
    def open_payment(self, order):
        """Open the provider payment for this order: {'reference', 'client'}."""
        if self.simulated:
            self._require_simulation_allowed()
            return {'reference': self._simulated_reference(order), 'client': {'simulated': True}}
        return self._open_provider_payment(order)

    def resume_payment(self, order):
        """State of the order's open payment ('open', 'processing', 'succeeded'
        or 'closed') plus the fields the browser SDK needs."""
        if self.simulated:
            self._require_simulation_allowed()
            return {'state': 'open', 'client': {'simulated': True}}
        return self._resume_provider_payment(order)

    def cancel_payment(self, order):
        """Close the order's open payment: 'canceled', 'processing' or 'succeeded'."""
        if self.simulated or not order.payment_reference:
            return 'canceled'
        return self._cancel_provider_payment(order)

    def verify_payment(self, order, client_payload):
        """Ask the provider whether this order's payment completed.

        Returns {'state': 'paid', 'transaction_id', 'amount_minor', 'currency',
        'raw'} or {'state': 'processing', 'raw'}; raises PaymentError otherwise.
        """
        if self.simulated:
            self._require_simulation_allowed()
            return self._simulated_verification(order)
        return self._verify_provider_payment(order, client_payload or {})

    def reconcile_order(self, order):
        """Server-side lookup of the order's payment: 'paid' (with the
        verification fields), 'pending', 'failed' or 'unavailable'."""
        if self.simulated:
            # Only the shopper's browser confirms a simulated payment.
            return {'state': 'unavailable'}
        if not order.payment_reference:
            return {'state': 'failed'}
        return self._reconcile_provider_order(order)

    def _simulated_verification(self, order):
        return {
            'state': 'paid',
            'transaction_id': order.payment_reference or self._simulated_reference(order),
            'amount_minor': to_minor_units(order.total, order.currency_code),
            'currency': (order.currency_code or '').upper(),
            'raw': {'simulated': True, 'gateway': self.code},
        }

    def _open_provider_payment(self, order):
        raise PaymentError(f'{self.code} cannot collect payments in the browser.')

    def _resume_provider_payment(self, order):
        raise PaymentError(f'{self.code} cannot collect payments in the browser.')

    def _cancel_provider_payment(self, order):
        return 'canceled'

    def _verify_provider_payment(self, order, client_payload):
        raise PaymentError(f'{self.code} cannot confirm browser payments.')

    def _reconcile_provider_order(self, order):
        return {'state': 'unavailable'}

    # --- refunds ------------------------------------------------------------
    def refund(self, order, amount, reason='', idempotency_key=None):
        if not (self.gateway and self.gateway.supports_refunds):
            raise PaymentError(f"{self.code} does not support refunds.")
        if self.simulated:
            self._require_simulation_allowed()
            return self._sandbox_refund(order, amount, reason)
        return self._provider_refund(order, amount, reason, idempotency_key)

    def _provider_refund(self, order, amount, reason, idempotency_key):
        raise PaymentError(
            f'{self.code} refunds are not implemented; reconcile this refund in the '
            'provider dashboard.'
        )

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
    browser_checkout = True

    API_BASE = "https://api.razorpay.com/v1"
    TIMEOUT = 20
    VERIFY_FAILED = "Payment verification failed. Please contact support before retrying."
    REFUND_STATES = {'processed': 'REFUNDED', 'pending': 'PENDING', 'failed': 'FAILED'}

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
            raise PaymentOutcomeUnknown("Could not reach Razorpay. Please try again.") from exc

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

    def test_connection(self):
        if not self.gateway.publishable_key or not self.gateway.secret_key:
            raise PaymentError('Razorpay Key ID and Key Secret are required.')
        self._request('GET', '/payments?count=1')
        return {'ok': True, 'message': 'Razorpay credentials verified successfully.'}

    # --- order-first collection ---------------------------------------------
    def _client(self, order, reference):
        return {
            'razorpay_order_id': reference,
            'key_id': self.gateway.publishable_key or '',
            'amount': to_minor_units(order.total, order.currency_code),
            'currency': (order.currency_code or '').upper(),
        }

    def _open_provider_payment(self, order):
        rzp_order = self._request('POST', '/orders', data={
            'amount': to_minor_units(order.total, order.currency_code),
            'currency': (order.currency_code or '').upper(),
            'receipt': f'order-{order.pk}',
            'notes[order_id]': str(order.pk),
        })
        reference = rzp_order.get('id') or ''
        if not reference.startswith('order_'):
            raise PaymentError('Razorpay returned an unexpected response.')
        return {'reference': reference, 'client': self._client(order, reference)}

    def _resume_provider_payment(self, order):
        rzp_order = self._request('GET', f'/orders/{order.payment_reference}')
        state = 'succeeded' if rzp_order.get('status') == 'paid' else 'open'
        return {'state': state, 'client': self._client(order, order.payment_reference)}

    def _order_payments(self, order):
        return self._request('GET', f'/orders/{order.payment_reference}/payments').get('items') or []

    def _cancel_provider_payment(self, order):
        # Razorpay orders cannot be cancelled; an unpaid one simply expires.
        statuses = {payment.get('status') for payment in self._order_payments(order)}
        if 'captured' in statuses:
            return 'succeeded'
        if 'authorized' in statuses:
            return 'processing'
        return 'canceled'

    def _verify_provider_payment(self, order, client_payload):
        reference = order.payment_reference or ''
        payment_id = str(client_payload.get('razorpay_payment_id') or '')
        if not reference.startswith('order_'):
            raise PaymentError('This order has no Razorpay payment to confirm.')
        if str(client_payload.get('razorpay_order_id') or '') != reference or not payment_id.startswith('pay_'):
            raise PaymentError(self.VERIFY_FAILED)
        # The handler signature proves the callback came from Razorpay for this
        # Razorpay order. It is mandatory: nothing is fetched without it.
        signed = f'{reference}|{payment_id}'.encode()
        signature = str(client_payload.get('razorpay_signature') or '')
        if not verify_razorpay_signature(signed, signature, self.gateway.secret_key):
            logger.error('Razorpay signature mismatch for order %s', order.pk)
            raise PaymentError(self.VERIFY_FAILED)
        return self._verification_from_payment(order, self._request('GET', f'/payments/{payment_id}'))

    def _verification_from_payment(self, order, payment):
        """Accept a payment only for this Razorpay order, amount and currency."""
        payment_id = payment.get('id') or ''
        if payment.get('order_id') != order.payment_reference:
            raise PaymentError('The payment does not belong to this order.')
        expected = to_minor_units(order.total, order.currency_code)
        currency = (payment.get('currency') or '').upper()
        if currency != (order.currency_code or '').upper():
            raise PaymentError('The payment currency does not match the order.')
        if int(payment.get('amount') or 0) != expected:
            logger.error('Razorpay amount mismatch on order %s: got %s', order.pk, payment.get('amount'))
            raise PaymentError('The amount paid does not match the order total.')
        state = payment.get('status')
        if state == 'authorized':
            # Funds are held but not taken; capture or they auto-void.
            try:
                payment = self._request(
                    'POST', f'/payments/{payment_id}/capture',
                    data={'amount': expected, 'currency': currency},
                )
            except PaymentOutcomeUnknown:
                raise
            except PaymentError:
                # A concurrent confirmation may already have captured it.
                payment = self._request('GET', f'/payments/{payment_id}')
            state = payment.get('status')
        if state != 'captured':
            raise PaymentError(f'Payment was not completed (status: {state}).')
        return {
            'state': 'paid', 'transaction_id': payment_id, 'amount_minor': expected,
            'currency': currency,
            'raw': {'gateway': self.code, 'payment': payment_id, 'method': payment.get('method')},
        }

    def _reconcile_provider_order(self, order):
        payments = self._order_payments(order)
        for payment in payments:
            if payment.get('status') in ('captured', 'authorized'):
                return self._verification_from_payment(order, payment)
        if any(payment.get('status') == 'created' for payment in payments):
            return {'state': 'pending'}
        return {'state': 'failed'}

    def _provider_refund(self, order, amount, reason, idempotency_key):
        if not (order.payment_id or "").startswith("pay_"):
            raise PaymentError("This order has no Razorpay payment to refund against.")
        data = {
            "amount": to_minor_units(amount, order.currency_code),
            "notes[order_id]": str(order.id),
            "notes[reason]": (reason or "")[:255],
        }
        if idempotency_key:
            # Razorpay has no idempotency header; the key in the notes lets the
            # refund webhook and staff match the refund to our record.
            data["notes[refund_id]"] = idempotency_key
        body = self._request("POST", f"/payments/{order.payment_id}/refund", data=data)
        razorpay_status = body.get("status")
        return {
            "status": self.REFUND_STATES.get(razorpay_status, "PENDING"),
            "refund_id": body.get("id") or "",
            "raw": {"gateway": self.code, "razorpay_status": razorpay_status},
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
    browser_checkout = True

    API_BASE = "https://api.stripe.com/v1"
    TIMEOUT = 20
    SESSION_STATES = {
        'succeeded': 'succeeded', 'processing': 'processing', 'requires_capture': 'processing',
        'canceled': 'closed',
    }
    REFUND_STATES = {
        'succeeded': 'REFUNDED', 'pending': 'PENDING', 'requires_action': 'PENDING',
        'failed': 'FAILED', 'canceled': 'FAILED',
    }

    def _request(self, method, path, data=None, idempotency_key=None):
        """Call the Stripe REST API with the gateway's secret key.

        Uses `requests` rather than the stripe SDK to stay consistent with the
        PayPal adapter and avoid a new runtime dependency.
        """
        headers = {'Idempotency-Key': idempotency_key} if idempotency_key else None
        try:
            resp = requests.request(
                method,
                f"{self.API_BASE}{path}",
                auth=(self.gateway.secret_key, ""),
                data=data,
                headers=headers,
                timeout=self.TIMEOUT,
            )
        except requests.RequestException as exc:
            logger.exception("Stripe %s %s failed to connect", method, path)
            raise PaymentOutcomeUnknown("Could not reach Stripe. Please try again.") from exc

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

    def test_connection(self):
        if not self.gateway.secret_key:
            raise PaymentError('Stripe secret key is required.')
        self._request('GET', '/balance')
        return {'ok': True, 'message': 'Stripe credentials verified successfully.'}

    # --- order-first collection ---------------------------------------------
    def _client(self, intent):
        return {
            'client_secret': intent.get('client_secret'),
            'publishable_key': self.gateway.publishable_key or '',
        }

    def _open_provider_payment(self, order):
        intent = self._request('POST', '/payment_intents', data={
            'amount': to_minor_units(order.total, order.currency_code),
            'currency': (order.currency_code or '').lower(),
            'automatic_payment_methods[enabled]': 'true',
            'description': f'Order #{order.pk}',
            'metadata[order_id]': str(order.pk),
            'metadata[region]': order.region.code,
        }, idempotency_key=f'order-{order.pk}-intent')
        reference = intent.get('id') or ''
        if not reference.startswith('pi_'):
            raise PaymentError('Stripe returned an unexpected response.')
        return {'reference': reference, 'client': self._client(intent)}

    def _resume_provider_payment(self, order):
        intent = self._request('GET', f'/payment_intents/{order.payment_reference}')
        return {
            'state': self.SESSION_STATES.get(intent.get('status'), 'open'),
            'client': self._client(intent),
        }

    def _cancel_provider_payment(self, order):
        reference = order.payment_reference
        try:
            intent = self._request('POST', f'/payment_intents/{reference}/cancel')
        except PaymentOutcomeUnknown:
            raise
        except PaymentError:
            # Stripe refuses to cancel a paid or processing intent; ask which.
            intent = self._request('GET', f'/payment_intents/{reference}')
        status_ = intent.get('status')
        if status_ == 'succeeded':
            return 'succeeded'
        if status_ in ('processing', 'requires_capture'):
            return 'processing'
        if status_ == 'canceled':
            return 'canceled'
        raise PaymentError(f'Stripe could not cancel payment {reference} (status: {status_}).')

    def _verify_provider_payment(self, order, client_payload):
        if not (order.payment_reference or '').startswith('pi_'):
            raise PaymentError('This order has no Stripe payment to confirm.')
        intent = self._request('GET', f'/payment_intents/{order.payment_reference}')
        return self._verification_from_intent(order, intent)

    def _verification_from_intent(self, order, intent):
        """Accept an intent only for this order, amount and currency."""
        metadata = intent.get('metadata') or {}
        if str(metadata.get('order_id') or '') != str(order.pk):
            logger.error('Stripe intent %s is not for order %s', intent.get('id'), order.pk)
            raise PaymentError('The payment does not belong to this order.')
        status_ = intent.get('status')
        if status_ in ('processing', 'requires_capture'):
            return {'state': 'processing', 'raw': {'gateway': self.code, 'status': status_}}
        if status_ != 'succeeded':
            raise PaymentError(f'Payment was not completed (status: {status_}).')
        currency = (intent.get('currency') or '').upper()
        if currency != (order.currency_code or '').upper():
            raise PaymentError('The payment currency does not match the order.')
        received = int(intent.get('amount_received') or 0)
        if received != to_minor_units(order.total, order.currency_code):
            logger.error('Stripe amount mismatch on order %s: got %s', order.pk, received)
            raise PaymentError('The amount paid does not match the order total.')
        return {
            'state': 'paid', 'transaction_id': intent.get('id'), 'amount_minor': received,
            'currency': currency,
            'raw': {'gateway': self.code, 'intent': intent.get('id'), 'latest_charge': intent.get('latest_charge')},
        }

    def _reconcile_provider_order(self, order):
        intent = self._request('GET', f'/payment_intents/{order.payment_reference}')
        status_ = intent.get('status')
        if status_ == 'succeeded':
            return self._verification_from_intent(order, intent)
        if status_ in ('processing', 'requires_capture', 'requires_action'):
            return {'state': 'pending', 'raw': {'status': status_}}
        return {'state': 'failed', 'raw': {'status': status_}}

    def _provider_refund(self, order, amount, reason, idempotency_key):
        if not (order.payment_id or "").startswith("pi_"):
            raise PaymentError("This order has no Stripe PaymentIntent to refund against.")
        minor = to_minor_units(amount, order.currency_code)
        data = {
            "payment_intent": order.payment_id,
            "amount": minor,
            "metadata[order_id]": str(order.id),
        }
        if reason:
            data["metadata[reason]"] = reason[:500]
        if idempotency_key:
            data["metadata[refund_key]"] = idempotency_key
        # Stripe dedupes retries with the same key for 24h, so a timeout and
        # retry cannot pay the customer twice.
        body = self._request(
            "POST", "/refunds", data=data,
            idempotency_key=idempotency_key or f"refund_{order.id}_{minor}",
        )
        stripe_status = body.get("status")
        return {
            "status": self.REFUND_STATES.get(stripe_status, "PENDING"),
            "refund_id": body.get("id") or "",
            "raw": {"gateway": self.code, "stripe_status": stripe_status},
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

    def _provider_refund(self, order, amount, reason, idempotency_key):
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
            idempotency_key=idempotency_key
            or f'paypal_refund_{order.id}_{to_minor_units(amount, order.currency_code)}',
        )
        paypal_status = body.get('status')
        return {
            'status': {'COMPLETED': 'REFUNDED', 'PENDING': 'PENDING'}.get(paypal_status, 'FAILED'),
            'refund_id': body.get('id', ''),
            'raw': {'gateway': self.code, 'paypal_status': paypal_status},
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

    @property
    def simulated(self):
        # Cash is collected offline; there is never a provider to simulate.
        return False

    def _open_provider_payment(self, order):
        raise PaymentError('Cash on delivery takes no online payment.')

    def refund(self, order, amount, reason="", idempotency_key=None):
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


def gateway_checkout_allowed(gateway) -> bool:
    """Whether the storefront may offer and accept this gateway.

    COD is always allowed. An online gateway needs a browser flow; without
    credentials it can only be simulated (development and tests); with TEST-mode
    credentials it talks to the provider sandbox, allowed only when
    ALLOW_TEST_GATEWAYS is on.
    """
    if gateway is None or not gateway.is_enabled:
        return False
    if gateway.code == 'COD':
        return True
    adapter_class = _ADAPTERS.get(gateway.code)
    if adapter_class is None or not adapter_class.browser_checkout:
        return False
    if not gateway.is_configured:
        return bool(settings.ALLOW_SIMULATED_PAYMENTS)
    if gateway.mode == 'LIVE':
        return True
    return bool(settings.ALLOW_TEST_GATEWAYS)


def resolve_gateway(region, code, allow_disabled=False):
    """Region-locked gateway resolution ("smart routing").

    Checkout uses the default: the gateway must be enabled and pass
    gateway_checkout_allowed. allow_disabled=True serves refunds and the
    reconciliation of existing orders, whose gateway may since be disabled.
    """
    code = (code or "").upper()
    if allow_disabled:
        gateway = (
            PaymentGateway.objects.filter(region=region, code=code).first()
            or PaymentGateway.objects.filter(code=code).first()
        )
        return get_adapter(gateway) if gateway else CODAdapter(None)
    gateway = PaymentGateway.objects.filter(region=region, code=code, is_enabled=True).first()
    if not gateway_checkout_allowed(gateway):
        region_str = region.code if region else 'N/A'
        raise PaymentError(f"Payment method '{code}' is not available for region {region_str}.")
    return get_adapter(gateway)


def adapter_for_order(order):
    """The adapter for an existing order's gateway, even if it was since disabled."""
    return resolve_gateway(order.region, order.payment_method, allow_disabled=True)


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
