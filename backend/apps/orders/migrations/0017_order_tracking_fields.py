# Generated manually for order tracking fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0016_order_completed_status'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='shipping_carrier',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='order',
            name='tracking_number',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='order',
            name='tracking_url',
            field=models.CharField(blank=True, default='', max_length=500),
        ),
    ]
