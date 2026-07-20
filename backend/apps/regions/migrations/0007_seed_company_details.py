from django.conf import settings
from django.db import migrations

# Company details supplied by the business owner (2026-07-17). These were
# previously hardcoded in apps/orders/utils.py; they now live on the Region so
# the admin can correct them without a redeploy. Only blank fields are filled,
# so a later admin edit is never overwritten by a re-run.
SHARED_PHONE = '+91 98779 69309, +91 98244 31259, +44 7539 231760'
SHARED_EMAIL = 'support@scleroproteins.in'

DETAILS = {
    'UK': {
        'company_name': 'Sclero Proteins Ltd',
        'company_address': 'Station Road, Horley RH6 9HL,\nEngland, United Kingdom',
        'company_phone': SHARED_PHONE,
        'company_email': SHARED_EMAIL,
        'tax_registration_label': 'VAT Reg No',
        'extra_registrations': [],
    },
    'IN': {
        'company_name': 'Sclero Proteins (India)',
        'company_address': 'Ajarpura 388310, Anand,\nGujarat, India',
        'company_phone': SHARED_PHONE,
        'company_email': SHARED_EMAIL,
        'tax_registration_label': 'GSTIN',
        # FSSAI is an India-specific food licence, so it prints only on IN invoices.
        'extra_registrations': [
            {'label': 'FSSAI License No.', 'value': '10725997000097'},
        ],
    },
}


def seed(apps, schema_editor):
    Region = apps.get_model('regions', 'Region')
    for region in Region.objects.all():
        detail = DETAILS.get(region.code.upper())
        if not detail:
            continue
        changed = []
        for field, value in detail.items():
            if not getattr(region, field, None):
                setattr(region, field, value)
                changed.append(field)
        # Carry the tax numbers over from env settings so invoices keep working.
        if not region.tax_registration_number:
            env_number = (
                getattr(settings, 'IN_GSTIN', '') if region.code.upper() == 'IN'
                else getattr(settings, 'UK_VAT_NUMBER', '')
            )
            if env_number:
                region.tax_registration_number = env_number
                changed.append('tax_registration_number')
        if changed:
            region.save(update_fields=changed)


def unseed(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('regions', '0006_region_company_address_region_company_email_and_more'),
    ]

    operations = [
        migrations.RunPython(seed, unseed),
    ]
