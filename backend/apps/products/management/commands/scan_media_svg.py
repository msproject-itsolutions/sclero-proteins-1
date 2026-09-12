"""Report script-capable files in MEDIA_ROOT and media rows that point at them."""
import os
from urllib.parse import urlsplit

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.products.media_validation import BLOCKED_EXTENSIONS
from apps.products.models import ProductMedia


class Command(BaseCommand):
    help = 'List SVG/HTML/XML/script files under MEDIA_ROOT and ProductMedia rows referencing them.'

    def handle(self, *args, **options):
        files = []
        for root, _dirs, names in os.walk(settings.MEDIA_ROOT):
            for name in names:
                if name.lower().endswith(BLOCKED_EXTENSIONS):
                    files.append(os.path.relpath(os.path.join(root, name), settings.MEDIA_ROOT))

        rows = []
        for media in ProductMedia.objects.only('id', 'file_url').iterator():
            url = media.file_url or ''
            if url.lower().startswith('data:image/svg') or urlsplit(url).path.lower().endswith(BLOCKED_EXTENSIONS):
                rows.append(media)

        for path in sorted(files):
            self.stdout.write(f'file: {path}')
        for media in rows:
            self.stdout.write(f'media#{media.pk}: {(media.file_url or "")[:120]}')
        self.stdout.write(f'{len(files)} file(s) and {len(rows)} media row(s) need review.')
