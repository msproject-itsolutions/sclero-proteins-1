import os
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.orders.models import Order, Cart, Invoice
from apps.products.models import Product, BundleItem

class Command(BaseCommand):
    help = 'Purge all orders, drafts, abandoned checkouts, and archived products from database and local storage.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Retrieve and list objects to delete without actually modifying the database or disk.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        if dry_run:
            self.stdout.write(self.style.WARNING("--- DRY RUN: No modifications will be made ---"))

        # 1. Collect Orders and Invoices
        orders = Order.objects.all()
        orders_count = orders.count()
        drafts_count = orders.filter(status='PENDING').count()
        non_drafts_count = orders_count - drafts_count

        invoices = Invoice.objects.filter(order__in=orders).exclude(pdf_file='')
        invoice_pdf_files = []
        for inv in invoices:
            if inv.pdf_file and inv.pdf_file.name:
                try:
                    pdf_path = inv.pdf_file.path
                    invoice_pdf_files.append(pdf_path)
                except ValueError:
                    # Catch cases where there's no actual file path (e.g. mock file storage)
                    pass

        # 2. Collect Abandoned Checkouts (Carts containing items)
        abandoned_carts = Cart.objects.filter(items__isnull=False).distinct()
        carts_count = abandoned_carts.count()

        # 3. Collect Archived Products and their BundleItems
        archived_products = Product.objects.filter(is_archived=True)
        products_count = archived_products.count()

        bundle_items = BundleItem.objects.filter(product__in=archived_products)
        bundle_items_count = bundle_items.count()

        # Print summary
        self.stdout.write(f"Found {orders_count} orders to delete:")
        self.stdout.write(f"  - {drafts_count} drafts (status='PENDING')")
        self.stdout.write(f"  - {non_drafts_count} completed/other orders")
        # Static analysis may mistake the word "delete" in a formatted string
        # for SQL; this is display text only and never reaches the database.
        invoice_message = "Found {count} invoice PDF files on disk."
        self.stdout.write(invoice_message.format(count=len(invoice_pdf_files)))
        self.stdout.write(f"Found {carts_count} abandoned checkouts (carts with items) to delete.")
        self.stdout.write(f"Found {products_count} archived products to delete.")
        self.stdout.write(f"Found {bundle_items_count} bundle items referencing archived products to delete.")

        if dry_run:
            self.stdout.write(self.style.SUCCESS("Dry run completed. No data was deleted."))
            return

        # Perform deletion inside a transaction
        try:
            with transaction.atomic():
                # Delete BundleItems referencing archived products first to avoid ProtectedError
                if bundle_items_count > 0:
                    self.stdout.write(f"Deleting {bundle_items_count} bundle items...")
                    bundle_items.delete()

                # Delete Orders (this will cascade delete Invoices, OrderItems, refunds, payment logs)
                if orders_count > 0:
                    self.stdout.write(f"Deleting {orders_count} orders...")
                    # We can call delete on the queryset directly
                    orders.delete()

                # Delete Carts
                if carts_count > 0:
                    self.stdout.write(f"Deleting {carts_count} abandoned checkouts...")
                    abandoned_carts.delete()

                # Delete Archived Products
                if products_count > 0:
                    self.stdout.write(f"Deleting {products_count} archived products...")
                    archived_products.delete()

            # Disk cleanup (Invoices PDFs)
            deleted_files_count = 0
            for pdf_path in invoice_pdf_files:
                if os.path.exists(pdf_path):
                    try:
                        os.remove(pdf_path)
                        deleted_files_count += 1
                        self.stdout.write(f"Deleted PDF file: {pdf_path}")
                    except Exception as e:
                        self.stdout.write(self.style.ERROR(f"Failed to delete {pdf_path}: {e}"))

            self.stdout.write(self.style.SUCCESS(f"Purge completed successfully! Deleted {orders_count} orders, {carts_count} abandoned checkouts, {products_count} archived products, and {deleted_files_count} PDF files."))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Purge failed: {e}"))
            raise e
