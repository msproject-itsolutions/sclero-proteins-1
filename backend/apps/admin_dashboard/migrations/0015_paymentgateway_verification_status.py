from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('admin_dashboard', '0014_herobannerslide_accent_color_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='paymentgateway',
            name='verification_status',
            field=models.CharField(
                choices=[
                    ('PENDING_VERIFICATION', 'Pending verification'),
                    ('CONNECTED', 'Connected'),
                    ('CONNECTION_FAILED', 'Connection failed'),
                    ('CONFIGURATION_ERROR', 'Configuration error'),
                ],
                db_index=True,
                default='PENDING_VERIFICATION',
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name='paymentgateway',
            name='verification_message',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='paymentgateway',
            name='last_verified_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
