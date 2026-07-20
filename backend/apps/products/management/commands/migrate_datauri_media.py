"""
Convert ProductMedia rows whose `file_url` is an inline base64 `data:` URI into
real image files under MEDIA_ROOT/products/, and rewrite `file_url` to point at
the served file. Inline data-URIs bloat the product API (a single product can be
10+ MB), so this keeps the payload tiny while preserving the images.

Idempotent: only touches rows still holding a `data:` URI.

  python manage.py migrate_datauri_media                 # dev: base http://localhost:8000
  python manage.py migrate_datauri_media --base-url https://scleroproteins.co.uk
  python manage.py migrate_datauri_media --dry-run
"""
import base64
import hashlib
import os

from django.conf import settings
from django.core.management.base import BaseCommand

from apps.products.models import ProductMedia

_EXT = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg',
    'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg',
}


class Command(BaseCommand):
    help = "Convert base64 data: URI ProductMedia into real files and rewrite file_url."

    def add_arguments(self, parser):
        parser.add_argument(
            '--base-url',
            default=os.getenv('MEDIA_PUBLIC_BASE', 'http://localhost:8000'),
            help='Public base URL prefixed onto the rewritten file_url (no trailing slash).',
        )
        parser.add_argument('--dry-run', action='store_true', help='Report only; write nothing.')

    def handle(self, *args, **opts):
        base = opts['base_url'].rstrip('/')
        dry = opts['dry_run']
        out_dir = os.path.join(settings.MEDIA_ROOT, 'products')
        if not dry:
            os.makedirs(out_dir, exist_ok=True)

        qs = ProductMedia.objects.filter(file_url__startswith='data:')
        total = qs.count()
        self.stdout.write(f'Found {total} data-URI media. base-url={base} dry_run={dry}')

        converted = 0
        for m in qs.iterator():
            u = m.file_url or ''
            try:
                header, b64 = u.split(',', 1)
                mime = header.split(';')[0].split(':', 1)[1].lower()
                raw = base64.b64decode(b64)
            except Exception as e:  # malformed data URI — leave it untouched
                self.stderr.write(f'  media#{m.id}: skip (parse error: {e})')
                continue

            ext = _EXT.get(mime, 'bin')
            sku = getattr(m.product, 'sku', 'product')
            digest = hashlib.sha256(raw).hexdigest()[:12]
            fname = f'{sku}-{m.id}-{digest}.{ext}'
            new_url = f'{base}/media/products/{fname}'
            self.stdout.write(
                f'  media#{m.id}: {len(u)} B data-URI -> {fname} ({len(raw)} B) -> {new_url}'
            )
            if dry:
                continue
            with open(os.path.join(out_dir, fname), 'wb') as fh:
                fh.write(raw)
            m.file_url = new_url
            m.save(update_fields=['file_url'])
            converted += 1

        self.stdout.write(self.style.SUCCESS(f'Done. Converted {converted}/{total}.'))
