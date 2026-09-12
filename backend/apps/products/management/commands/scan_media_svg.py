"""Report script-capable files in MEDIA_ROOT and media rows that fail URL validation."""
import os

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.products.media_validation import BLOCKED_EXTENSIONS, MediaUrlError, validate_media_url
from apps.products.models import ProductMedia


class Command(BaseCommand):
    help = 'List SVG/HTML/XML/script files under MEDIA_ROOT and ProductMedia rows whose URL fails media validation.'

    def handle(self, *args, **options):
        files = []
        for root, _dirs, names in os.walk(settings.MEDIA_ROOT):
            for name in names:
                if name.lower().endswith(BLOCKED_EXTENSIONS):
                    files.append(os.path.relpath(os.path.join(root, name), settings.MEDIA_ROOT))

        # The same rule the admin API enforces on new media, so legacy rows
        # with any unsafe URL (not only SVG) are surfaced.
        rows = []
        for media in ProductMedia.objects.only('id', 'file_url').iterator():
            try:
                validate_media_url(media.file_url)
            except MediaUrlError as exc:
                rows.append((media, exc))

        for path in sorted(files):
            self.stdout.write(f'file: {path}')
        for media, reason in rows:
            self.stdout.write(f'media#{media.pk}: {(media.file_url or "")[:120]} ({reason})')
        self.stdout.write(f'{len(files)} file(s) and {len(rows)} media row(s) need review.')
