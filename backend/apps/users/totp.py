"""TOTP (RFC 6238) two-factor authentication for staff accounts.

Endpoints (all require IsAuthenticated, all under /api/auth/2fa/):
  POST   /setup/    — generate fresh secret + QR; persist as CANDIDATE secret
                      with `totp_enabled=False` so retries are idempotent.
  POST   /verify/   — verify 6-digit code → flip `totp_enabled=True`,
                      issue 10 single-use backup codes (plaintext returned
                      EXACTLY ONCE; only SHA-256 hashes persisted).
  POST   /disable/  — requires password + current code (TOTP or backup).
                      Clears secret + backup codes. NIST: disable must never
                      be one-click.
  GET    /status/   — { enabled, backup_codes_remaining }.

Login enforcement is in `AuditedLoginView.post`. Only staff/superusers are
gated; non-staff customers may enable TOTP but are not forced through it on
login (avoids locking out non-technical buyers).
"""
import base64
import hashlib
import io
import secrets

import pyotp
import qrcode
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


ISSUER_NAME = 'Sclero Proteins'
BACKUP_CODE_COUNT = 10
BACKUP_CODE_LENGTH = 8
BACKUP_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'  # no 0/1/I/O ambiguity


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.strip().upper().encode()).hexdigest()


def generate_backup_codes(n: int = BACKUP_CODE_COUNT):
    """Return (plaintext_codes, hashed_codes). Plaintext shown to user ONCE."""
    plain = [
        ''.join(secrets.choice(BACKUP_CODE_ALPHABET) for _ in range(BACKUP_CODE_LENGTH))
        for _ in range(n)
    ]
    hashed = [_hash_code(c) for c in plain]
    return plain, hashed


def verify_totp_or_backup(user, code: str) -> bool:
    """Verify a 6-digit TOTP code OR a backup code. Consumes a matched backup code.

    Returns True if verified. Caller should save() the user after a backup hit.
    """
    if not code or not user.totp_secret:
        return False
    code = code.strip().replace(' ', '')

    # Try TOTP first (numeric, 6 digits, with ±1 window for clock drift).
    if code.isdigit() and len(code) == 6:
        if pyotp.TOTP(user.totp_secret).verify(code, valid_window=1):
            return True

    # Fallback: backup code match (alphanumeric, case-insensitive).
    hashed = _hash_code(code)
    if hashed in (user.totp_backup_codes or []):
        user.totp_backup_codes = [c for c in user.totp_backup_codes if c != hashed]
        return True

    return False


def _qr_data_url(provisioning_uri: str) -> str:
    img = qrcode.make(provisioning_uri)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()


class TOTPSetupView(APIView):
    """POST /api/auth/2fa/setup/ — issue a fresh candidate secret + QR.

    Persists the new secret on the user (overwriting any prior candidate),
    but DOES NOT set totp_enabled=True until /verify/ is called. Calling
    /setup/ repeatedly is safe — last call wins.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        # Already enabled? Don't clobber the live secret.
        if user.totp_enabled:
            return Response(
                {'detail': 'TOTP already enabled. Disable it first to re-enroll.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        secret = pyotp.random_base32()
        provisioning_uri = pyotp.totp.TOTP(secret).provisioning_uri(
            name=user.email,
            issuer_name=ISSUER_NAME,
        )
        user.totp_secret = secret
        user.totp_enabled = False
        user.save(update_fields=['totp_secret', 'totp_enabled'])
        return Response({
            'secret': secret,
            'provisioning_uri': provisioning_uri,
            'qr_data_url': _qr_data_url(provisioning_uri),
        })


class TOTPVerifyView(APIView):
    """POST /api/auth/2fa/verify/ {code} — finalize enrollment."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.audit.recorder import record_audit

        user = request.user
        code = (request.data.get('code') or '').strip()
        if not user.totp_secret:
            return Response(
                {'detail': 'Call /setup/ first.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not code or not code.isdigit() or len(code) != 6:
            return Response(
                {'detail': 'Enter the 6-digit code from your authenticator app.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not pyotp.TOTP(user.totp_secret).verify(code, valid_window=1):
            return Response(
                {'detail': 'Invalid code. Check your authenticator app and try again.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        plain, hashed = generate_backup_codes()
        user.totp_backup_codes = hashed
        user.totp_enabled = True
        user.save(update_fields=['totp_backup_codes', 'totp_enabled'])

        record_audit(
            '2fa.enabled',
            actor=user,
            summary=f'TOTP 2FA enabled for {user.email}',
        )
        return Response({'enabled': True, 'backup_codes': plain})


class TOTPDisableView(APIView):
    """POST /api/auth/2fa/disable/ {password, code} — requires re-auth."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        from apps.audit.recorder import record_audit

        user = request.user
        password = request.data.get('password') or ''
        code = (request.data.get('code') or '').strip()

        if not user.totp_enabled:
            return Response(
                {'detail': 'TOTP is not enabled on this account.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not user.check_password(password):
            return Response(
                {'detail': 'Password is incorrect.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not verify_totp_or_backup(user, code):
            return Response(
                {'detail': 'Invalid authenticator or backup code.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.totp_secret = ''
        user.totp_enabled = False
        user.totp_backup_codes = []
        user.save(update_fields=['totp_secret', 'totp_enabled', 'totp_backup_codes'])

        record_audit(
            '2fa.disabled',
            actor=user,
            summary=f'TOTP 2FA disabled for {user.email}',
        )
        return Response({'enabled': False})


class TOTPStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            'enabled': bool(user.totp_enabled),
            'backup_codes_remaining': len(user.totp_backup_codes or []),
        })
