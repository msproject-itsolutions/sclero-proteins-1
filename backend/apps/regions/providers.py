"""Installed shipping-provider registry and connection checks."""
import requests


class ShippingProviderError(Exception):
    pass


SHIPPING_PROVIDER_CATALOG = {
    'DHL_EXPRESS': {
        'name': 'DHL Express',
        'description': 'International rating, labels, pickup and tracking through MyDHL API.',
        'required_credentials': ['username', 'password'],
        'credential_fields': [
            {'key': 'username', 'label': 'API username', 'secret': False, 'required': True},
            {'key': 'password', 'label': 'API password', 'secret': True, 'required': True},
        ],
        'configuration_fields': [
            {'key': 'account_number', 'label': 'DHL account number', 'required': True},
            {'key': 'service_code', 'label': 'Default service code', 'required': False},
        ],
        'capabilities': ['rates', 'labels', 'tracking', 'pickup', 'cancellation'],
    },
    'SHIPROCKET': {
        'name': 'Shiprocket',
        'description': 'India courier aggregation, serviceability, labels and tracking.',
        'required_credentials': ['email', 'password'],
        'credential_fields': [
            {'key': 'email', 'label': 'API user email', 'secret': False, 'required': True},
            {'key': 'password', 'label': 'API user password', 'secret': True, 'required': True},
        ],
        'configuration_fields': [
            {'key': 'pickup_location', 'label': 'Pickup location name', 'required': True},
            {'key': 'channel_id', 'label': 'Channel ID', 'required': False},
        ],
        'capabilities': ['rates', 'labels', 'tracking', 'pickup', 'cancellation'],
    },
    'MANUAL': {
        'name': 'Manual fulfilment',
        'description': 'Use admin-managed rates and enter carrier/tracking details manually.',
        'required_credentials': [],
        'credential_fields': [],
        'configuration_fields': [],
        'capabilities': ['manual_labels', 'manual_tracking'],
    },
}


def shipping_provider_catalog():
    return [{'code': code, **definition} for code, definition in SHIPPING_PROVIDER_CATALOG.items()]


class BaseShippingAdapter:
    def __init__(self, provider):
        self.provider = provider

    def test_connection(self):
        if not self.provider.is_configured:
            raise ShippingProviderError('Complete all required credentials before testing.')
        return {'ok': True, 'message': 'Provider configuration is complete.'}


class DHLExpressAdapter(BaseShippingAdapter):
    def test_connection(self):
        super().test_connection()
        if not (self.provider.configuration or {}).get('account_number'):
            raise ShippingProviderError('DHL account number is required.')
        # MyDHL validates BasicAuth on operational requests rather than through
        # a standalone identity endpoint. Validate the full configuration here;
        # the first rate/label call remains the authoritative credential check.
        return {
            'ok': True,
            'message': 'DHL credentials and account settings are complete. They will be verified on the first MyDHL request.',
        }


class ShiprocketAdapter(BaseShippingAdapter):
    API_BASE = 'https://apiv2.shiprocket.in/v1/external'

    def test_connection(self):
        super().test_connection()
        credentials = self.provider.credentials or {}
        try:
            response = requests.post(
                f'{self.API_BASE}/auth/login',
                json={'email': credentials.get('email'), 'password': credentials.get('password')},
                timeout=20,
            )
            body = response.json()
        except (requests.RequestException, ValueError) as exc:
            raise ShippingProviderError('Could not reach Shiprocket.') from exc
        if response.status_code >= 400 or not body.get('token'):
            raise ShippingProviderError(body.get('message') or 'Shiprocket rejected these credentials.')
        return {'ok': True, 'message': 'Shiprocket credentials verified successfully.'}


ADAPTERS = {
    'DHL_EXPRESS': DHLExpressAdapter,
    'SHIPROCKET': ShiprocketAdapter,
    'MANUAL': BaseShippingAdapter,
}


def get_shipping_adapter(provider):
    adapter_class = ADAPTERS.get(provider.code)
    if not adapter_class:
        raise ShippingProviderError('This shipping provider is not installed on the platform.')
    return adapter_class(provider)
