from django.db import migrations, models
import apps.common.fields


class Migration(migrations.Migration):
    dependencies = [('admin_dashboard', '0015_paymentgateway_verification_status')]

    operations = [
        migrations.CreateModel(
            name='InstagramReelsConnection',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('instagram_user_id', models.CharField(blank=True, default='', max_length=64)),
                ('access_token', apps.common.fields.EncryptedTextField(blank=True, default='')),
                ('is_enabled', models.BooleanField(default=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Instagram Reels connection',
                'verbose_name_plural': 'Instagram Reels connection',
            },
        ),
    ]
