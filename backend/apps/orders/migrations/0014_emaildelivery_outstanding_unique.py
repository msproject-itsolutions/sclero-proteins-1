from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('orders', '0013_cart_order_variant_snapshots'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='emaildelivery',
            constraint=models.UniqueConstraint(
                condition=models.Q(status__in=['PENDING', 'FAILED']),
                fields=(
                    'event', 'recipient_email', 'audit_target_type',
                    'audit_target_id',
                ),
                name='unique_outstanding_email_delivery',
            ),
        ),
    ]
