from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('orders', '0012_emaildelivery'),
    ]

    operations = [
        migrations.AlterUniqueTogether(
            name='cartitem',
            unique_together=set(),
        ),
        migrations.AddField(
            model_name='cartitem',
            name='variant_name',
            field=models.CharField(blank=True, default='', max_length=150),
        ),
        migrations.AddField(
            model_name='cartitem',
            name='variant_sku',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddField(
            model_name='orderitem',
            name='variant_name',
            field=models.CharField(blank=True, default='', max_length=150),
        ),
        migrations.AddField(
            model_name='orderitem',
            name='variant_sku',
            field=models.CharField(blank=True, default='', max_length=100),
        ),
        migrations.AddConstraint(
            model_name='cartitem',
            constraint=models.UniqueConstraint(
                fields=('cart', 'product', 'variant_sku'),
                name='unique_cart_product_variant',
            ),
        ),
    ]
