from django.db import migrations


def seed_roles(apps, schema_editor):
    from apps.users.permissions import DEFAULT_ROLES
    Role = apps.get_model('users', 'Role')
    for name, perms in DEFAULT_ROLES.items():
        role, created = Role.objects.get_or_create(
            name=name,
            defaults={'permissions': list(perms), 'is_system': True,
                      'description': 'System role'},
        )
        if not created:
            # Keep system role permissions in sync with the registry.
            role.permissions = list(perms)
            role.is_system = True
            role.save(update_fields=['permissions', 'is_system'])


def unseed_roles(apps, schema_editor):
    from apps.users.permissions import DEFAULT_ROLES
    Role = apps.get_model('users', 'Role')
    Role.objects.filter(name__in=list(DEFAULT_ROLES.keys()), is_system=True).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_role_user_roles'),
    ]

    operations = [
        migrations.RunPython(seed_roles, unseed_roles),
    ]
