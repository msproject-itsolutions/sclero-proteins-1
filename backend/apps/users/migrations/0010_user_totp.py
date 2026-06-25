from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0009_user_sms_marketing'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='totp_secret',
            field=models.CharField(blank=True, default='', max_length=64),
        ),
        migrations.AddField(
            model_name='user',
            name='totp_enabled',
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name='user',
            name='totp_backup_codes',
            field=models.JSONField(blank=True, default=list),
        ),
    ]
