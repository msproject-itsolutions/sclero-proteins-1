from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0008_order_delivered_at_order_review_request_sent_at_and_more'),
    ]

    operations = [
        migrations.AddField(model_name='order', name='shipping_estimated_days', field=models.CharField(blank=True, default='', max_length=50)),
        migrations.AddField(model_name='order', name='shipping_method', field=models.CharField(blank=True, default='Standard Shipping', max_length=100)),
        migrations.AddField(model_name='order', name='shipping_rate_name', field=models.CharField(blank=True, default='', max_length=100)),
    ]
