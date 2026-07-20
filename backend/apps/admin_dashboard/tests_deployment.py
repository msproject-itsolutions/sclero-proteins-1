from pathlib import Path
from tempfile import TemporaryDirectory

from django.core.management import CommandError, call_command
from django.test import TestCase, override_settings

from apps.admin_dashboard.models import HeroBannerSlide
from apps.products.models import Product, ProductMedia


class StorefrontContentVerificationTests(TestCase):
    def setUp(self):
        self.product = Product.objects.create(
            sku="VERIFY-001",
            name="Verification product",
            description="Description",
            benefits="Benefits",
            ingredients="Ingredients",
        )
        HeroBannerSlide.objects.create(
            title="Verification banner",
            heading="Verification",
            desktop_media_url="/home/verification-banner.jpg",
        )

    def test_rejects_an_active_product_without_an_image(self):
        with self.assertRaisesMessage(CommandError, "has no product image"):
            call_command("verify_storefront_content")

    def test_accepts_present_local_media(self):
        with TemporaryDirectory() as directory:
            image_path = Path(directory) / "products" / "verification.jpg"
            image_path.parent.mkdir(parents=True)
            image_path.write_bytes(b"valid-image-placeholder")
            ProductMedia.objects.create(
                product=self.product,
                file_url="/media/products/verification.jpg",
                media_type="IMAGE",
            )
            with override_settings(MEDIA_ROOT=directory):
                call_command("verify_storefront_content", verbosity=0)
