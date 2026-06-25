from django.db import models
from apps.regions.models import Warehouse
from apps.products.models import Product

class StockLevel(models.Model):
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="stocks")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="stocks")
    available = models.PositiveIntegerField(default=0)
    reserved = models.PositiveIntegerField(default=0, help_text="Stock reserved in unpaid carts / checkouts")
    low_stock_threshold = models.PositiveIntegerField(default=10)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('warehouse', 'product')
        indexes = [
            models.Index(fields=['product', 'available']),
        ]

    def __str__(self):
        return f"{self.product.name} in {self.warehouse.name}: {self.available} available"


class StockTransfer(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    from_warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="transfers_sent")
    to_warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="transfers_received")
    quantity = models.PositiveIntegerField()
    status = models.CharField(max_length=50, default="PENDING", choices=[
        ("PENDING", "Pending"),
        ("COMPLETED", "Completed"),
        ("CANCELLED", "Cancelled"),
    ])
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['from_warehouse', 'status']),
            models.Index(fields=['to_warehouse', 'status']),
        ]
