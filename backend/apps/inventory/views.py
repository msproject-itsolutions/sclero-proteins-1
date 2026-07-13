from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, Q, F
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from apps.users.permissions import require_permission
from .models import StockLevel, StockTransfer
from .serializers import (
    StockLevelSerializer, StockLevelAdminUpdateSerializer,
    StockTransferSerializer, StockTransferCreateSerializer
)


class StockLevelAdminViewSet(viewsets.ModelViewSet):
    """
    Admin CRUD operations for stock levels.
    Requires 'inventory.manage' permission when RBAC is enforced.
    Supports regional filtering via ?region=IN,UK,US and warehouse filtering via ?warehouse=<warehouse_id>
    """
    permission_classes = [require_permission('inventory.manage')]

    def get_queryset(self):
        queryset = StockLevel.objects.select_related(
            'product', 'warehouse', 'warehouse__region'
        )
        region_code = self.request.query_params.get('region')
        warehouse_id = self.request.query_params.get('warehouse')
        low_stock = self.request.query_params.get('low_stock')

        if region_code:
            queryset = queryset.filter(warehouse__region__code=region_code.upper())
        if warehouse_id:
            queryset = queryset.filter(warehouse_id=warehouse_id)
        if low_stock == 'true':
            queryset = queryset.filter(
                available__lte=F('low_stock_threshold')
            )

        return queryset

    def get_serializer_class(self):
        if self.action in ['update', 'partial_update']:
            return StockLevelAdminUpdateSerializer
        return StockLevelSerializer

    @action(detail=False, methods=['get'])
    def by_region(self, request):
        """Get stock levels for a specific region."""
        region_code = request.query_params.get('region')
        if not region_code:
            return Response({"error": "Region parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

        stock_levels = self.get_queryset().filter(warehouse__region__code=region_code.upper())
        serializer = self.get_serializer(stock_levels, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def low_stock_alert(self, request):
        """Get all stock levels below their threshold, optionally filtered by region."""
        queryset = self.get_queryset().filter(
            available__lte=F('low_stock_threshold')
        )
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['post'])
    def bulk_update(self, request):
        """Bulk update stock levels for multiple products."""
        updates = request.data.get('updates', [])
        if not updates:
            return Response({"error": "No updates provided"}, status=status.HTTP_400_BAD_REQUEST)

        updated_count = 0
        errors = []

        for update in updates:
            try:
                stock_id = update.get('id')
                available = update.get('available')
                reserved = update.get('reserved')

                stock = StockLevel.objects.get(id=stock_id)
                if available is not None:
                    stock.available = available
                if reserved is not None:
                    stock.reserved = reserved
                stock.save()
                updated_count += 1
            except Exception as e:
                errors.append({
                    'id': update.get('id'),
                    'error': str(e)
                })

        return Response({
            'updated_count': updated_count,
            'errors': errors
        })

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Get inventory summary filtered by region."""
        queryset = self.get_queryset()
        region_code = request.query_params.get('region')

        if region_code:
            queryset = queryset.filter(warehouse__region__code=region_code.upper())

        total_products = queryset.count()
        total_available = queryset.aggregate(total=Sum('available'))['total'] or 0
        total_reserved = queryset.aggregate(total=Sum('reserved'))['total'] or 0
        low_stock_count = queryset.filter(
            available__lte=F('low_stock_threshold')
        ).count()

        return Response({
            'total_products': total_products,
            'total_available': total_available,
            'total_reserved': total_reserved,
            'low_stock_count': low_stock_count
        })


class StockTransferAdminViewSet(viewsets.ModelViewSet):
    """
    Admin CRUD operations for stock transfers.
    Requires 'inventory.manage' permission when RBAC is enforced.
    Supports regional filtering via ?region=IN,UK,US and status filtering via ?status=PENDING,COMPLETED
    """
    permission_classes = [require_permission('inventory.manage')]

    def get_queryset(self):
        queryset = StockTransfer.objects.select_related(
            'product', 'from_warehouse', 'to_warehouse', 'from_warehouse__region', 'to_warehouse__region'
        )
        region_code = self.request.query_params.get('region')
        status_filter = self.request.query_params.get('status')

        if region_code:
            queryset = queryset.filter(
                Q(from_warehouse__region__code=region_code.upper()) |
                Q(to_warehouse__region__code=region_code.upper())
            )
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())

        return queryset

    def get_serializer_class(self):
        if self.action == 'create':
            return StockTransferCreateSerializer
        return StockTransferSerializer

    def perform_create(self, serializer):
        transfer = serializer.save(status='PENDING')
        return transfer

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """Complete a stock transfer and update inventory levels."""
        transfer = self.get_object()
        if transfer.status != 'PENDING':
            return Response({"error": "Only pending transfers can be completed"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            with transaction.atomic():
                # Deduct from source warehouse
                from_stock, created = StockLevel.objects.get_or_create(
                    warehouse=transfer.from_warehouse,
                    product=transfer.product,
                    defaults={'available': 0, 'reserved': 0, 'low_stock_threshold': 10}
                )
                if from_stock.available < transfer.quantity:
                    raise ValueError(f"Insufficient stock at source warehouse. Available: {from_stock.available}")

                from_stock.available -= transfer.quantity
                from_stock.save()

                # Add to destination warehouse
                to_stock, created = StockLevel.objects.get_or_create(
                    warehouse=transfer.to_warehouse,
                    product=transfer.product,
                    defaults={'available': 0, 'reserved': 0, 'low_stock_threshold': 10}
                )
                to_stock.available += transfer.quantity
                to_stock.save()

                # Update transfer status
                transfer.status = 'COMPLETED'
                transfer.completed_at = timezone.now()
                transfer.save()

            return Response({
                "message": "Stock transfer completed successfully",
                "transfer": StockTransferSerializer(transfer).data
            })

        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a pending stock transfer."""
        transfer = self.get_object()
        if transfer.status != 'PENDING':
            return Response({"error": "Only pending transfers can be cancelled"}, status=status.HTTP_400_BAD_REQUEST)

        transfer.status = 'CANCELLED'
        transfer.save()

        return Response({
            "message": "Stock transfer cancelled successfully",
            "transfer": StockTransferSerializer(transfer).data
        })

    @action(detail=False, methods=['get'])
    def by_region(self, request):
        """Get stock transfers for a specific region."""
        region_code = request.query_params.get('region')
        if not region_code:
            return Response({"error": "Region parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

        transfers = self.get_queryset().filter(
            Q(from_warehouse__region__code=region_code.upper()) |
            Q(to_warehouse__region__code=region_code.upper())
        )
        serializer = self.get_serializer(transfers, many=True)
        return Response(serializer.data)
