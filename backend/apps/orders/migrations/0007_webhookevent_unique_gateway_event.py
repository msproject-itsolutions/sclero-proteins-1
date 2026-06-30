from django.db import migrations, models


def remove_duplicate_webhook_events(apps, schema_editor):
    from django.db.models import Count

    WebhookEvent = apps.get_model('orders', 'WebhookEvent')
    duplicates = (
        WebhookEvent.objects.exclude(event_id='')
        .values('gateway', 'event_id')
        .annotate(total=Count('id'))
        .filter(total__gt=1)
    )
    for duplicate in duplicates.iterator():
        rows = WebhookEvent.objects.filter(
            gateway=duplicate['gateway'],
            event_id=duplicate['event_id'],
        ).order_by('created_at', 'id')
        keep_id = rows.values_list('id', flat=True).first()
        rows.exclude(id=keep_id).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0006_webhookevent_error_message_webhookevent_event_id'),
    ]

    operations = [
        migrations.RunPython(remove_duplicate_webhook_events, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='webhookevent',
            constraint=models.UniqueConstraint(
                condition=~models.Q(event_id=''),
                fields=('gateway', 'event_id'),
                name='unique_gateway_webhook_event',
            ),
        ),
    ]
