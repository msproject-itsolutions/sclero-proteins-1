"""Installed payment-provider definitions used by the admin console.

The catalog keeps provider-specific form fields and capabilities out of the
frontend. Adding a supported adapter automatically makes its configuration
schema available to every admin client.
"""

PAYMENT_PROVIDER_CATALOG = {
    'RAZORPAY': {
        'name': 'Razorpay',
        'description': 'Cards, UPI, netbanking and wallets for India.',
        'credential_fields': [
            {'key': 'publishable_key', 'label': 'Key ID', 'secret': False, 'required': True},
            {'key': 'secret_key', 'label': 'Key Secret', 'secret': True, 'required': True},
            {'key': 'webhook_secret', 'label': 'Webhook signing secret', 'secret': True, 'required': True},
        ],
        'capabilities': ['payments', 'refunds', 'webhooks', 'status_sync'],
    },
    'STRIPE': {
        'name': 'Stripe',
        'description': 'Cards, wallets and local payment methods worldwide.',
        'credential_fields': [
            {'key': 'publishable_key', 'label': 'Publishable key', 'secret': False, 'required': True},
            {'key': 'secret_key', 'label': 'Secret key', 'secret': True, 'required': True},
            {'key': 'webhook_secret', 'label': 'Webhook signing secret', 'secret': True, 'required': True},
        ],
        'capabilities': ['payments', 'refunds', 'webhooks', 'status_sync'],
    },
    'PAYPAL': {
        'name': 'PayPal',
        'description': 'PayPal checkout, capture, refunds and signed webhooks.',
        'credential_fields': [
            {'key': 'publishable_key', 'label': 'Client ID', 'secret': False, 'required': True},
            {'key': 'secret_key', 'label': 'Client Secret', 'secret': True, 'required': True},
            {'key': 'webhook_id', 'label': 'Webhook ID', 'secret': False, 'required': True},
        ],
        'capabilities': ['payments', 'refunds', 'webhooks', 'status_sync'],
    },
    'COD': {
        'name': 'Cash on Delivery',
        'description': 'Offline payment collected when the order is delivered.',
        'credential_fields': [],
        'capabilities': ['offline_payments', 'manual_refunds'],
    },
}


def payment_provider_catalog():
    return [
        {'code': code, **definition}
        for code, definition in PAYMENT_PROVIDER_CATALOG.items()
    ]

