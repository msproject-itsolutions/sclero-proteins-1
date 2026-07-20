from pathlib import Path
from urllib.parse import unquote, urlparse

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q
from django.utils import timezone

from apps.admin_dashboard.models import HeroBannerSlide
from apps.products.models import Product, ProductMedia


class Command(BaseCommand):
    help = (
        "Verify that production storefront content and local media survived a "
        "deployment. This command never creates, updates, or deletes content."
    )

    def handle(self, *args, **options):
        errors = []
        now = timezone.now()
        products = Product.objects.filter(is_active=True, is_archived=False)
        banners = HeroBannerSlide.objects.filter(is_enabled=True).filter(
            Q(starts_at__isnull=True) | Q(starts_at__lte=now),
            Q(ends_at__isnull=True) | Q(ends_at__gte=now),
        )

        product_count = products.count()
        banner_count = banners.count()
        if product_count == 0:
            errors.append("No active storefront products were found.")
        if banner_count == 0:
            errors.append("No currently active homepage banners were found.")

        product_media = ProductMedia.objects.filter(
            product__in=products,
            media_type="IMAGE",
        ).select_related("product")
        media_by_product = {}
        for media in product_media:
            media_by_product.setdefault(media.product_id, []).append(media)
            self._validate_url(
                media.file_url,
                f"product {media.product.sku} image {media.pk}",
                errors,
            )

        for product in products.only("id", "sku"):
            if not media_by_product.get(product.id):
                errors.append(f"Active product {product.sku} has no product image.")

        for banner in banners:
            sources = [
                banner.desktop_media_url,
                banner.tablet_media_url,
                banner.mobile_media_url,
            ]
            populated_sources = [source for source in sources if source.strip()]
            if not populated_sources:
                errors.append(
                    f"Homepage banner {banner.pk} ({banner.title}) has no media URL."
                )
                continue
            for index, source in enumerate(populated_sources, start=1):
                self._validate_url(
                    source,
                    f"homepage banner {banner.pk} media {index}",
                    errors,
                )

        if errors:
            details = "\n - ".join(errors)
            raise CommandError(f"Storefront content verification failed:\n - {details}")

        self.stdout.write(
            self.style.SUCCESS(
                "Storefront content verified: "
                f"{product_count} active product(s), "
                f"{product_media.count()} product image(s), "
                f"{banner_count} active homepage banner(s)."
            )
        )

    @staticmethod
    def _validate_url(value, label, errors):
        value = (value or "").strip()
        if not value:
            errors.append(f"{label} is empty.")
            return
        if value.startswith("data:"):
            errors.append(
                f"{label} is still an embedded data URI; run migrate_datauri_media first."
            )
            return

        parsed = urlparse(value)
        if parsed.scheme and parsed.scheme not in {"https"}:
            errors.append(f"{label} must use HTTPS: {value}")
            return
        if parsed.scheme == "https" and not parsed.netloc:
            errors.append(f"{label} is not a valid absolute URL: {value}")
            return
        if not parsed.scheme and not value.startswith("/"):
            errors.append(f"{label} must be an HTTPS URL or root-relative path: {value}")
            return

        site_url = urlparse(getattr(settings, "SITE_URL", ""))
        is_local_media = parsed.path.startswith(settings.MEDIA_URL) and (
            not parsed.netloc or parsed.netloc == site_url.netloc
        )
        if not is_local_media:
            return

        relative_path = unquote(parsed.path[len(settings.MEDIA_URL) :]).lstrip("/")
        media_root = Path(settings.MEDIA_ROOT).resolve()
        candidate = (media_root / relative_path).resolve()
        try:
            candidate.relative_to(media_root)
        except ValueError:
            errors.append(f"{label} escapes the configured media directory: {value}")
            return
        if not candidate.is_file() or candidate.stat().st_size == 0:
            errors.append(f"{label} is missing or empty in the media volume: {value}")
