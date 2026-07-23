from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('glossary', '0002_generalfaq'),
    ]

    operations = [
        migrations.AddField(
            model_name='glossaryterm',
            name='internal_code',
            field=models.CharField(
                blank=True,
                db_index=True,
                default='',
                help_text='Optional internal knowledge-hub identifier for the term.',
                max_length=150,
            ),
        ),
    ]
