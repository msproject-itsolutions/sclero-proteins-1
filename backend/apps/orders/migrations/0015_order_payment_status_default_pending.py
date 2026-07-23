from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0014_emaildelivery_outstanding_unique'),
    ]

    operations = [
        migrations.AlterField(
            model_name='order',
            name='payment_status',
            field=models.CharField(
                choices=[
                    ('PENDING', 'Pending'),
                    ('AUTHORIZED', 'Authorized'),
                    ('PARTIALLY_CAPTURED', 'Partially captured'),
                    ('PAID', 'Paid'),
                    ('FAILED', 'Failed'),
                    ('REFUNDED', 'Refunded'),
                ],
                db_index=True,
                default='PENDING',
                max_length=30,
            ),
        ),
    ]
