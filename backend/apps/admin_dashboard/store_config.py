"""
Store-wide configuration helpers backed by SystemSetting (key -> JSON).

Currently exposes the tax display/charge mode:
  - 'inclusive': displayed prices already include tax; checkout extracts the tax
                 portion and does NOT add it on top.
  - 'exclusive': displayed prices are net; tax is added at checkout.
"""
from .models import SystemSetting

TAX_SETTINGS_KEY = 'TAX_SETTINGS'
DEFAULT_TAX_MODE = 'inclusive'
VALID_TAX_MODES = ('inclusive', 'exclusive')


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
