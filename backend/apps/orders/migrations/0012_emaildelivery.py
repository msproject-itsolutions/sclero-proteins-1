import uuid

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('orders', '0011_schedulerlease'),
        ('regions', '0010_shipping_configuration'),
    ]

    operations = [
        migrations.CreateModel(
            name='EmailDelivery',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('event', models.CharField(db_index=True, max_length=40)),
                ('recipient_email', models.EmailField(max_length=254)),
                ('context', models.JSONField(default=dict)),
                ('audit_target_type', models.CharField(default='Order', max_length=100)),
                ('audit_target_id', models.CharField(blank=True, default='', max_length=100)),
                ('status', models.CharField(choices=[('PENDING', 'Pending'), ('SENT', 'Sent'), ('FAILED', 'Failed'), ('DLQ', 'Dead Letter Queue')], db_index=True, default='PENDING', max_length=10)),
                ('attempts', models.PositiveIntegerField(default=0)),
                ('last_attempt_at', models.DateTimeField(blank=True, null=True)),
                ('next_attempt_at', models.DateTimeField(blank=True, db_index=True, null=True)),
                ('error_message', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('region', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='regions.region')),
            ],
            options={'ordering': ['created_at']},
        ),
        migrations.AddIndex(
            model_name='emaildelivery',
            index=models.Index(fields=['status', 'next_attempt_at'], name='orders_ema_status_8cf2c5_idx'),
        ),
    ]
