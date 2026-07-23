import apps.common.fields
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('regions', '0010_shipping_configuration'),
    ]

    operations = [
        migrations.CreateModel(
            name='ShippingProvider',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(db_index=True, max_length=40)),
                ('display_name', models.CharField(max_length=100)),
                ('is_enabled', models.BooleanField(db_index=True, default=False)),
                ('mode', models.CharField(choices=[('TEST', 'Test / Sandbox'), ('LIVE', 'Live')], default='TEST', max_length=10)),
                ('credentials', apps.common.fields.EncryptedJSONField(blank=True, default=dict)),
                ('configuration', models.JSONField(blank=True, default=dict, help_text='Non-secret provider settings such as account number, pickup location, and service codes.')),
                ('webhook_secret', apps.common.fields.EncryptedTextField(blank=True, default='')),
                ('sort_order', models.PositiveIntegerField(default=0)),
                ('connection_status', models.CharField(choices=[('NOT_TESTED', 'Not tested'), ('CONNECTED', 'Connected'), ('ERROR', 'Connection error')], default='NOT_TESTED', max_length=20)),
                ('last_tested_at', models.DateTimeField(blank=True, null=True)),
                ('last_error', models.TextField(blank=True, default='')),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('region', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='shipping_providers', to='regions.region')),
            ],
            options={
                'ordering': ['region__code', 'sort_order', 'code'],
                'unique_together': {('code', 'region')},
            },
        ),
        migrations.AddIndex(
            model_name='shippingprovider',
            index=models.Index(fields=['region', 'is_enabled'], name='regions_shi_region__2ed8df_idx'),
        ),
    ]
