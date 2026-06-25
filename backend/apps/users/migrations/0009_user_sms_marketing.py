from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0008_alter_wishlistitem_user_wishlist_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='sms_marketing',
            field=models.BooleanField(default=False),
        ),
    ]
