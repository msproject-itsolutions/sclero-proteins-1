"""No-op stub.

Bundles were deprecated on 2026-06-24 in favour of Collections. The previous
implementation seeded sample Bundle/BundleItem/BundleRegionConfig rows so the
public storefront ``/bundles`` page had something to show. With the public
endpoint and storefront pages removed, seeding sample bundles serves no
purpose. The model + admin CRUD remain for historical data, but this command
no longer creates anything.
"""
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Deprecated — Bundles have been retired in favour of Collections. No-op."

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING(
            "seed_bundles is a no-op: Bundles were deprecated on 2026-06-24 in "
            "favour of Collections. Use seed_catalog / the admin Collections "
            "screen instead. Nothing was created."
        ))
        return
