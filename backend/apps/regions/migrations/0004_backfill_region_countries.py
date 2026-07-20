from django.db import migrations


def backfill(apps, schema_editor):
    """Seed the country lists that were previously hardcoded in geo.py.

    Reproduces the old behaviour exactly: India serves IN, the UK serves GB,
    and the UK is the catch-all for everywhere else. Anything already
    configured is left alone.
    """
    Region = apps.get_model('regions', 'Region')

    defaults = {
        'IN': ['IN'],
        # Cloudflare reports the UK as 'GB'; accept both spellings.
        'UK': ['GB', 'UK'],
        'GB': ['GB', 'UK'],
    }

    for region in Region.objects.all():
        if region.countries:
            continue
        # Only real storefronts claim countries. A region with no domain is a
        # placeholder (e.g. seeded RBAC rows) and must not compete for traffic
        # with the live region for the same country.
        if not (region.domain or '').strip():
            continue
        region.countries = defaults.get(region.code.upper(), [])
        region.save(update_fields=['countries'])

    # Preserve "unknown country -> UK" as the default, rather than silently
    # changing where existing traffic lands.
    if not Region.objects.filter(is_default=True).exists():
        fallback = (
            Region.objects.filter(code__iexact='UK').first()
            or Region.objects.filter(code__iexact='GB').first()
            or Region.objects.filter(is_active=True).order_by('id').first()
        )
        if fallback:
            fallback.is_default = True
            fallback.save(update_fields=['is_default'])


def unbackfill(apps, schema_editor):
    # Field removal handles the data; nothing to undo explicitly.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('regions', '0003_region_countries_region_is_default'),
    ]

    operations = [
        migrations.RunPython(backfill, unbackfill),
    ]
