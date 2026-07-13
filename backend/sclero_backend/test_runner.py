from django.apps import apps
from django.test.runner import DiscoverRunner


class ProjectDiscoverRunner(DiscoverRunner):
    """Ensure `manage.py test` exercises this repo's installed app suites.

    Django's implicit discovery has been unreliable in this workspace when no
    test labels are supplied, so default to every local `apps.*` package.
    """

    def build_suite(self, test_labels=None, *args, **kwargs):
        if not test_labels:
            test_labels = [
                app_config.name
                for app_config in apps.get_app_configs()
                if app_config.name.startswith('apps.')
            ]
        return super().build_suite(test_labels, *args, **kwargs)
