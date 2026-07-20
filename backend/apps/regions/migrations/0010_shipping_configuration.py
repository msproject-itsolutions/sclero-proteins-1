from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('regions', '0009_shippingrate_description_shippingrate_estimated_days_and_more'),
    ]

    operations = [
        migrations.AddField(model_name='shippingzone', name='cities', field=models.JSONField(blank=True, default=list, help_text='Optional city names covered by this zone')),
        migrations.AddField(model_name='shippingzone', name='description', field=models.TextField(blank=True, default='', help_text='Internal notes for staff')),
        migrations.AddField(model_name='shippingzone', name='postal_ranges', field=models.JSONField(blank=True, default=list, help_text='Optional postal-code ranges or prefixes covered by this zone')),
        migrations.AddField(model_name='shippingzone', name='priority', field=models.PositiveIntegerField(default=0, help_text='Higher-priority zones are evaluated first when locations overlap')),
        migrations.AddField(model_name='shippingrate', name='handling_fee', field=models.DecimalField(decimal_places=2, default=0, help_text='Optional fixed handling charge', max_digits=10)),
        migrations.AddField(model_name='shippingrate', name='per_unit_price', field=models.DecimalField(decimal_places=2, default=0, help_text='Optional charge per kg or item above the minimum', max_digits=10)),
        migrations.AddField(model_name='shippingrate', name='priority', field=models.PositiveIntegerField(default=0, help_text='Display order at checkout; lower values appear first')),
        migrations.AddField(model_name='shippingrate', name='surcharge_amount', field=models.DecimalField(decimal_places=2, default=0, help_text='Extra charge for matching remote-area postcodes', max_digits=10)),
    ]
