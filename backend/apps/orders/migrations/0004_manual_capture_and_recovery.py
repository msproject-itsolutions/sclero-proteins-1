from django.db import migrations, models


def backfill_payment_totals(apps, schema_editor):
    Order = apps.get_model('orders', 'Order')
    for order in Order.objects.all().only('id', 'total'):
        Order.objects.filter(id=order.id).update(
            payment_authorized_amount=order.total,
            payment_captured_amount=order.total,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0003_refund'),
    ]

    operations = [
        migrations.AddField(
            model_name='cart',
            name='last_recovery_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='cart',
            name='recovery_attempts',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name='cart',
            name='recovery_status',
            field=models.CharField(choices=[('NOT_CONTACTED', 'Not contacted'), ('CONTACTED', 'Contacted'), ('RECOVERED', 'Recovered'), ('DISMISSED', 'Dismissed')], db_index=True, default='NOT_CONTACTED', max_length=20),
        ),
        migrations.AddField(
            model_name='order',
            name='payment_authorized_amount',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name='order',
            name='payment_capture_mode',
            field=models.CharField(choices=[('AUTO', 'Automatic capture'), ('MANUAL', 'Manual capture')], default='AUTO', max_length=20),
        ),
        migrations.AddField(
            model_name='order',
            name='payment_captured_amount',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name='order',
            name='payment_status',
            field=models.CharField(choices=[('PENDING', 'Pending'), ('AUTHORIZED', 'Authorized'), ('PARTIALLY_CAPTURED', 'Partially captured'), ('PAID', 'Paid'), ('FAILED', 'Failed'), ('REFUNDED', 'Refunded')], db_index=True, default='PAID', max_length=30),
        ),
        migrations.RunPython(backfill_payment_totals, migrations.RunPython.noop),
    ]
