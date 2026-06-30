from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0011_user_password_reset_token_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='otp_secret',
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
    ]
