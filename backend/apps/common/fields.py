"""Database fields for secrets managed through the administration console.

Values are encrypted before they reach the database and transparently
decrypted inside the application.  Existing plaintext values remain readable
and are encrypted the next time they are saved, allowing a safe rolling
migration for already-configured stores.
"""
import base64
import hashlib
import json

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.db import models


PREFIX = "enc:v1:"


def _fernet():
    configured = getattr(settings, "INTEGRATION_ENCRYPTION_KEY", "")
    if configured:
        key = configured.encode("utf-8")
    else:
        digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
        key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_value(value):
    if value in (None, ""):
        return value
    text = str(value)
    if text.startswith(PREFIX):
        return text
    token = _fernet().encrypt(text.encode("utf-8")).decode("ascii")
    return f"{PREFIX}{token}"


def decrypt_value(value):
    if value in (None, ""):
        return value
    text = str(value)
    if not text.startswith(PREFIX):
        return text
    try:
        return _fernet().decrypt(text[len(PREFIX):].encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError):
        # Fail closed: a key mismatch must never leak ciphertext to an API or
        # accidentally be used as a provider credential.
        return ""


class EncryptedTextField(models.TextField):
    description = "Application-encrypted text"

    def from_db_value(self, value, expression, connection):
        return decrypt_value(value)

    def to_python(self, value):
        return decrypt_value(value)

    def get_prep_value(self, value):
        return encrypt_value(value)


class EncryptedJSONField(EncryptedTextField):
    description = "Application-encrypted JSON"

    def from_db_value(self, value, expression, connection):
        decrypted = decrypt_value(value)
        if decrypted in (None, ""):
            return {}
        if isinstance(decrypted, (dict, list)):
            return decrypted
        try:
            return json.loads(decrypted)
        except (TypeError, ValueError):
            return {}

    def to_python(self, value):
        if isinstance(value, (dict, list)):
            return value
        if value in (None, ""):
            return {}
        decrypted = decrypt_value(value)
        try:
            return json.loads(decrypted)
        except (TypeError, ValueError):
            return {}

    def get_prep_value(self, value):
        if value in (None, ""):
            value = {}
        if isinstance(value, (dict, list)):
            value = json.dumps(value, separators=(",", ":"), sort_keys=True)
        return encrypt_value(value)


SENSITIVE_KEY_PARTS = ('password', 'secret', 'token', 'api_key', 'private_key', 'webhook')


def is_sensitive_key(key):
    normalized = str(key or '').lower()
    return any(part in normalized for part in SENSITIVE_KEY_PARTS)


def transform_sensitive_values(value, transform, inside_sensitive=False):
    """Apply `transform` to every non-empty string stored under a sensitive key."""
    if isinstance(value, dict):
        return {
            key: transform_sensitive_values(item, transform, inside_sensitive or is_sensitive_key(key))
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [transform_sensitive_values(item, transform, inside_sensitive) for item in value]
    if inside_sensitive and isinstance(value, str) and value:
        return transform(value)
    return value


class SensitiveKeysJSONField(models.JSONField):
    """JSON whose values under secret-looking keys are encrypted at rest.

    Ordinary configuration stays readable JSON; strings under keys such as
    `password`, `api_key` or `webhook_secret` are stored as Fernet tokens and
    decrypted transparently on load.
    """
    description = "JSON with encrypted secret values"

    def from_db_value(self, value, expression, connection):
        value = super().from_db_value(value, expression, connection)
        return transform_sensitive_values(value, decrypt_value)

    def get_prep_value(self, value):
        return super().get_prep_value(transform_sensitive_values(value, encrypt_value))

