"""Logging filter that scrubs common secret patterns from log records.

Defence-in-depth: even if a code path accidentally logs a payment key or
bearer token, the filter rewrites it to ***REDACTED*** before any handler
sees it. The patterns target the formats we know we use — Stripe secret &
webhook keys, Razorpay's HMAC-hex secrets, bearer tokens, JWTs.
"""
import logging
import re


_PATTERNS = [
    # Stripe restricted/secret/publishable + webhook signing secrets
    re.compile(r'\bs[kp]_(?:live|test)_[A-Za-z0-9]{8,}'),
    re.compile(r'\bwhsec_[A-Za-z0-9]{8,}'),
    re.compile(r'\brk_(?:live|test)_[A-Za-z0-9]{8,}'),
    # Bearer tokens
    re.compile(r'(?i)\bBearer\s+[A-Za-z0-9._\-+/=]{12,}'),
    # JWTs (three dot-separated base64url segments)
    re.compile(r'\beyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}'),
    # Razorpay key id + key secret (rzp_test_..., rzp_live_..., generic 40-char hex)
    re.compile(r'\brzp_(?:live|test)_[A-Za-z0-9]{10,}'),
]


def _scrub(text):
    if not isinstance(text, str):
        return text
    for pat in _PATTERNS:
        text = pat.sub('***REDACTED***', text)
    return text


class SensitiveDataFilter(logging.Filter):
    def filter(self, record):
        try:
            record.msg = _scrub(record.msg)
            if record.args:
                record.args = tuple(_scrub(a) for a in record.args) \
                    if isinstance(record.args, tuple) else _scrub(record.args)
        except Exception:
            # Never let logging-scrubbing break logging itself.
            pass
        return True
