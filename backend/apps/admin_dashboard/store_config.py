"""
Store-wide configuration helpers backed by SystemSetting (key -> JSON).

Currently exposes:
  - 'inclusive' / 'exclusive' tax mode
  - guest checkout availability
"""
from .models import SystemSetting

TAX_SETTINGS_KEY = 'TAX_SETTINGS'
CHECKOUT_SETTINGS_KEY = 'CHECKOUT_SETTINGS'
DEFAULT_TAX_MODE = 'inclusive'
VALID_TAX_MODES = ('inclusive', 'exclusive')
DEFAULT_GUEST_CHECKOUT_ENABLED = True


def get_store_tax_mode():
    """Return 'inclusive' or 'exclusive' (never raises)."""
    try:
        setting = SystemSetting.objects.filter(key=TAX_SETTINGS_KEY).first()
        if setting and isinstance(setting.value, dict):
            mode = setting.value.get('tax_mode')
            if mode in VALID_TAX_MODES:
                return mode
    except Exception:
        pass
    return DEFAULT_TAX_MODE


def set_store_tax_mode(mode):
    """Persist the tax mode; falls back to the default for unknown values."""
    mode = mode if mode in VALID_TAX_MODES else DEFAULT_TAX_MODE
    setting, _ = SystemSetting.objects.get_or_create(
        key=TAX_SETTINGS_KEY,
        defaults={'value': {}, 'description': 'Storefront tax display & charge mode'},
    )
    value = setting.value if isinstance(setting.value, dict) else {}
    value['tax_mode'] = mode
    setting.value = value
    setting.save(update_fields=['value', 'updated_at'])
    return mode


def get_guest_checkout_enabled():
    """Return whether guests can place an order (never raises)."""
    try:
        setting = SystemSetting.objects.filter(key=CHECKOUT_SETTINGS_KEY).first()
        if setting and isinstance(setting.value, dict):
            if 'allow_guest_checkout' in setting.value:
                return bool(setting.value.get('allow_guest_checkout'))
            if 'guest_checkout_enabled' in setting.value:
                return bool(setting.value.get('guest_checkout_enabled'))
    except Exception:
        pass
    return DEFAULT_GUEST_CHECKOUT_ENABLED


def set_guest_checkout_enabled(enabled):
    """Persist guest checkout availability."""
    enabled = bool(enabled)
    setting, _ = SystemSetting.objects.get_or_create(
        key=CHECKOUT_SETTINGS_KEY,
        defaults={'value': {}, 'description': 'Guest checkout availability for the storefront'},
    )
    value = setting.value if isinstance(setting.value, dict) else {}
    value['allow_guest_checkout'] = enabled
    value['guest_checkout_enabled'] = enabled
    setting.value = value
    setting.save(update_fields=['value', 'updated_at'])
    return enabled
