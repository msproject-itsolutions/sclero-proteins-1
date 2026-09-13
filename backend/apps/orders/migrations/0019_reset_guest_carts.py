import secrets

from django.db import migrations


def reset_guest_carts(apps, schema_editor):
    """Old cart ids came from the browser and were guessable: start guests afresh."""
    Cart = apps.get_model('orders', 'Cart')
    Cart.objects.filter(user__isnull=True).delete()
    for cart_id in Cart.objects.values_list('pk', flat=True):
        Cart.objects.filter(pk=cart_id).update(session_id=secrets.token_urlsafe(32))


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0018_order_first_payments'),
    ]

    operations = [
        migrations.RunPython(reset_guest_carts, migrations.RunPython.noop),
    ]
