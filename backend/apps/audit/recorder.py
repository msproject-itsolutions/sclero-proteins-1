"""Single entry point for writing audit records."""

from .models import AuditLog
from .context import get_current_user, get_current_ip, get_current_user_agent


# Keys whose values must never be persisted to the audit trail. Matches are
# case-insensitive, substring-based — `payment_secret_key` redacts because
# `secret` is contained. Auth + payment + webhook secrets are the highest
# blast-radius leak surface; redact aggressively rather than trying to allow-list.
REDACTED_KEYS = (
    'password', 'secret', 'token', 'authorization', 'api_key', 'apikey',
    'access', 'refresh', 'totp_secret', 'webhook_secret', 'publishable_key',
    'private_key', 'session_id', 'csrf',
)
_REDACTED = '***REDACTED***'


def _redact(value):
    """Recursively scrub sensitive values from dict/list/scalar payloads."""
    if isinstance(value, dict):
        return {
            k: (_REDACTED if isinstance(k, str) and any(s in k.lower() for s in REDACTED_KEYS)
                else _redact(v))
            for k, v in value.items()
        }
    if isinstance(value, (list, tuple)):
        return [_redact(v) for v in value]
    return value


def record_audit(action, *, target_type='', target_id='', summary='', changes=None,
                 actor=None, ip=None, user_agent=None):
    """Write an AuditLog row. Actor/IP default to the current request context.

    Best-effort: never let auditing break the underlying operation. Sensitive
    keys in `changes` are redacted before persistence — see REDACTED_KEYS.
    """
    try:
        actor = actor if actor is not None else get_current_user()
        ip = ip if ip is not None else get_current_ip()
        user_agent = user_agent if user_agent is not None else get_current_user_agent()
        AuditLog.objects.create(
            actor=actor,
            actor_email=getattr(actor, 'email', '') or '',
            action=action,
            target_type=target_type,
            target_id=str(target_id) if target_id != '' else '',
            summary=summary[:255],
            changes=_redact(changes or {}),
            ip_address=ip,
            user_agent=user_agent or '',
        )
    except Exception:  # pragma: no cover - auditing must never raise
        pass
