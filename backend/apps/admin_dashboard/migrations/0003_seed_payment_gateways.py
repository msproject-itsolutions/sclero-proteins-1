from django.db import migrations


# (region_code, code, display_name, sort_order, supports_refunds)
DEFAULTS = [
    ('IN', 'RAZORPAY', 'Razorpay (UPI, Cards, Net Banking, Wallets)', 0, True),
    ('IN', 'COD', 'Cash on Delivery', 1, False),
    ('UK', 'STRIPE', 'Card (Stripe, Apple Pay & Google Pay)', 0, True),
    ('UK', 'PAYPAL', 'PayPal', 1, True),
]


def seed_gateways(apps, schema_editor):
    Region = apps.get_model('regions', 'Region')
    PaymentGateway = apps.get_model('admin_dashboard', 'PaymentGateway')

    for region_code, code, name, order, refunds in DEFAULTS:
        region = Region.objects.filter(code=region_code).first()
        if not region:
            continue
        PaymentGateway.objects.get_or_create(
            code=code,
            region=region,
            defaults={
                'display_name': name,
                'is_enabled': True,
                'mode': 'TEST',
                'supports_refunds': refunds,
                'sort_order': order,
            },
        )


def unseed_gateways(apps, schema_editor):
    PaymentGateway = apps.get_model('admin_dashboard', 'PaymentGateway')
    codes = {(c, r) for r, c, *_ in DEFAULTS}
    for code, region_code in codes:
        PaymentGateway.objects.filter(code=code, region__code=region_code).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('admin_dashboard', '0002_paymentgateway'),
        ('regions', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_gateways, unseed_gateways),
    ]
