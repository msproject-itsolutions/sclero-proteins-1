import apps.common.fields
from django.db import migrations


def encrypt_existing_credentials(apps, schema_editor):
    PaymentGateway = apps.get_model('admin_dashboard', 'PaymentGateway')
    for gateway in PaymentGateway.objects.all().iterator():
        gateway.save(update_fields=['secret_key', 'extra_config'])


class Migration(migrations.Migration):
    dependencies = [
        ('admin_dashboard', '0012_blogpost_category_herobannerslide_arrow_position_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='paymentgateway',
            name='secret_key',
            field=apps.common.fields.EncryptedTextField(
                blank=True,
                help_text='Server-side secret. NEVER exposed to the storefront.',
            ),
        ),
        migrations.AlterField(
            model_name='paymentgateway',
            name='extra_config',
            field=apps.common.fields.EncryptedJSONField(
                blank=True,
                default=dict,
                help_text='Additional config: webhook secret, PayPal merchant id, etc. Server-side only.',
            ),
        ),
        migrations.RunPython(encrypt_existing_credentials, migrations.RunPython.noop),
    ]
