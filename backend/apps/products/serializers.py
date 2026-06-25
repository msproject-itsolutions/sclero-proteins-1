from rest_framework import serializers
from django.db.models import Avg, Sum
from apps.regions.models import Warehouse
from apps.inventory.models import StockLevel
from .models import (
    Product, ProductRegionConfig, ProductMedia, ProductReview, Category, ProductLandingPage,
    Bundle, BundleItem, BundleRegionConfig,
)


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description', 'display_order', 'product_count']


class ProductMediaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductMedia
        fields = ['id', 'file_url', 'media_type', 'display_order']

class ProductReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductReview
        fields = ['id', 'user_name', 'user_email', 'rating', 'comment',
                  'is_verified_purchase', 'review_media_urls', 'created_at']
        # email collected for verified-purchase check but never shown publicly;
        # verified flag + approval are decided server-side.
        read_only_fields = ['is_verified_purchase', 'created_at']
        extra_kwargs = {'user_email': {'write_only': True}}


class ProductReviewAdminSerializer(serializers.ModelSerializer):
    """Full review representation for moderation."""
    product_sku = serializers.CharField(source='product.sku', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = ProductReview
        fields = ['id', 'product', 'product_sku', 'product_name', 'user_name', 'user_email',
                  'rating', 'comment', 'is_verified_purchase', 'is_approved', 'is_featured',
                  'review_media_urls', 'created_at']
        read_only_fields = ['product', 'user_name', 'user_email', 'rating', 'comment',
                            'review_media_urls', 'created_at']

class ProductListSerializer(serializers.ModelSerializer):
    price = serializers.SerializerMethodField()
    promotional_price = serializers.SerializerMethodField()
    stock_available = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()
    thumbnail = serializers.SerializerMethodField()
    categories = CategorySerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = ['id', 'sku', 'name', 'price', 'promotional_price', 'stock_available', 'average_rating', 'thumbnail', 'categories']

    def get_region(self):
        return self.context.get('region')

    def get_price(self, obj):
        region = self.get_region()
        if not region:
            return None
        config = obj.regional_configs.filter(region=region).first()
        return config.price if config else None

    def get_promotional_price(self, obj):
        region = self.get_region()
        if not region:
            return None
        config = obj.regional_configs.filter(region=region).first()
        return config.promotional_price if config else None

    def get_stock_available(self, obj):
        region = self.get_region()
        if not region:
            return 0
        # Sum of available stock across all warehouses of this region
        warehouses = Warehouse.objects.filter(region=region, is_active=True)
        stock_sum = StockLevel.objects.filter(product=obj, warehouse__in=warehouses).aggregate(total=Sum('available'))['total']
        return stock_sum or 0

    def get_average_rating(self, obj):
        rating = obj.reviews.filter(is_approved=True).aggregate(avg=Avg('rating'))['avg']
        return round(rating, 1) if rating else 5.0

    def get_thumbnail(self, obj):
        media = obj.media.filter(media_type='IMAGE').first()
        return media.file_url if media else None


class ProductDetailSerializer(serializers.ModelSerializer):
    price = serializers.SerializerMethodField()
    promotional_price = serializers.SerializerMethodField()
    stock_available = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()
    media = ProductMediaSerializer(many=True, read_only=True)
    reviews = serializers.SerializerMethodField()
    categories = CategorySerializer(many=True, read_only=True)

    class Meta:
        model = Product
        fields = [
            'id', 'sku', 'name', 'hsn_code', 'description', 'benefits',
            'ingredients', 'nutrition_facts', 'faq', 'dietary_tags', 'short_benefit', 'price',
            'promotional_price', 'stock_available', 'average_rating',
            'media', 'reviews', 'categories'
        ]

    def get_region(self):
        return self.context.get('region')

    def get_price(self, obj):
        region = self.get_region()
        if not region:
            return None
        config = obj.regional_configs.filter(region=region).first()
        return config.price if config else None

    def get_promotional_price(self, obj):
        region = self.get_region()
        if not region:
            return None
        config = obj.regional_configs.filter(region=region).first()
        return config.promotional_price if config else None

    def get_stock_available(self, obj):
        region = self.get_region()
        if not region:
            return 0
        warehouses = Warehouse.objects.filter(region=region, is_active=True)
        stock_sum = StockLevel.objects.filter(product=obj, warehouse__in=warehouses).aggregate(total=Sum('available'))['total']
        return stock_sum or 0

    def get_average_rating(self, obj):
        rating = obj.reviews.filter(is_approved=True).aggregate(avg=Avg('rating'))['avg']
        return round(rating, 1) if rating else 5.0

    def get_reviews(self, obj):
        reviews = obj.reviews.filter(is_approved=True)[:10]
        return ProductReviewSerializer(reviews, many=True).data


# --- Admin Serializers for Regional CRUD Operations --- #

class ProductRegionConfigSerializer(serializers.ModelSerializer):
    region_code = serializers.CharField(source='region.code', read_only=True)
    region_name = serializers.CharField(source='region.name', read_only=True)

    class Meta:
        model = ProductRegionConfig
        fields = ['id', 'region', 'region_code', 'region_name', 'price', 'promotional_price', 'is_visible']
        read_only_fields = ['id']


class ProductMediaAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductMedia
        fields = ['id', 'file_url', 'media_type', 'display_order']


class ProductAdminSerializer(serializers.ModelSerializer):
    regional_configs = ProductRegionConfigSerializer(many=True, read_only=True)
    regional_stock = serializers.SerializerMethodField()
    media = ProductMediaAdminSerializer(many=True, read_only=True)
    categories = CategorySerializer(many=True, read_only=True)
    average_rating = serializers.SerializerMethodField()
    total_reviews = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'sku', 'name', 'hsn_code', 'description', 'benefits',
            'ingredients', 'nutrition_facts', 'faq', 'dietary_tags', 'short_benefit', 'is_active', 'is_archived',
            'regional_configs', 'regional_stock', 'media', 'categories',
            'average_rating', 'total_reviews', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_average_rating(self, obj):
        rating = obj.reviews.filter(is_approved=True).aggregate(avg=Avg('rating'))['avg']
        return round(rating, 1) if rating else 0.0

    def get_total_reviews(self, obj):
        return obj.reviews.filter(is_approved=True).count()

    def get_regional_stock(self, obj):
        """Per-region available stock (summed across that region's warehouses).
        Surfacing stock per region prevents 'ghost stock' — admins see exactly
        what can be fulfilled in each market, not a misleading global total."""
        from apps.regions.models import Region
        out = []
        for region in Region.objects.filter(is_active=True).order_by('code'):
            warehouses = Warehouse.objects.filter(region=region, is_active=True)
            agg = StockLevel.objects.filter(product=obj, warehouse__in=warehouses).aggregate(
                available=Sum('available'), reserved=Sum('reserved'))
            out.append({
                'region_id': region.id,
                'region_code': region.code,
                'available': agg['available'] or 0,
                'reserved': agg['reserved'] or 0,
            })
        return out


class ProductAdminCreateUpdateSerializer(serializers.ModelSerializer):
    """For creating/updating products with nested regional configs and media."""
    regional_configs = serializers.ListField(
        child=serializers.DictField(), write_only=True, required=False
    )
    media_files = serializers.ListField(
        child=serializers.DictField(), write_only=True, required=False
    )
    category_ids = serializers.ListField(
        child=serializers.IntegerField(), write_only=True, required=False
    )
    regional_stock = serializers.ListField(
        child=serializers.DictField(), write_only=True, required=False
    )

    class Meta:
        model = Product
        fields = [
            'sku', 'name', 'hsn_code', 'description', 'benefits',
            'ingredients', 'nutrition_facts', 'faq', 'dietary_tags', 'short_benefit', 'is_active', 'is_archived',
            'regional_configs', 'media_files', 'category_ids', 'regional_stock'
        ]

    def _apply_regional_stock(self, product, regional_stock_data):
        """Set available stock per region on that region's first active warehouse.
        Keeps UK and IN inventory independent (dual inventory)."""
        from apps.regions.models import Region, Warehouse
        from apps.inventory.models import StockLevel
        for row in regional_stock_data:
            region_id = row.get('region') or row.get('region_id')
            if not region_id:
                continue
            warehouse = Warehouse.objects.filter(region_id=region_id, is_active=True).first()
            if not warehouse:
                continue
            StockLevel.objects.update_or_create(
                product=product, warehouse=warehouse,
                defaults={'available': int(row.get('available', 0))},
            )

    def create(self, validated_data):
        regional_configs_data = validated_data.pop('regional_configs', [])
        media_files_data = validated_data.pop('media_files', [])
        category_ids = validated_data.pop('category_ids', [])
        regional_stock_data = validated_data.pop('regional_stock', [])

        product = Product.objects.create(**validated_data)
        self._apply_regional_stock(product, regional_stock_data)

        # Create regional configs
        for config_data in regional_configs_data:
            region_id = config_data.get('region')
            if region_id:
                ProductRegionConfig.objects.create(
                    product=product,
                    region_id=region_id,
                    price=config_data.get('price', 0),
                    promotional_price=config_data.get('promotional_price'),
                    is_visible=config_data.get('is_visible', True)
                )

        # Create media files
        for media_data in media_files_data:
            ProductMedia.objects.create(
                product=product,
                file_url=media_data.get('file_url'),
                media_type=media_data.get('media_type', 'IMAGE'),
                display_order=media_data.get('display_order', 0)
            )

        # Assign categories
        if category_ids:
            product.categories.set(category_ids)

        return product

    def update(self, instance, validated_data):
        regional_configs_data = validated_data.pop('regional_configs', None)
        media_files_data = validated_data.pop('media_files', None)
        category_ids = validated_data.pop('category_ids', None)
        regional_stock_data = validated_data.pop('regional_stock', None)

        # Update base product fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if regional_stock_data is not None:
            self._apply_regional_stock(instance, regional_stock_data)

        # Update regional configs if provided
        if regional_configs_data is not None:
            instance.regional_configs.all().delete()
            for config_data in regional_configs_data:
                region_id = config_data.get('region')
                if region_id:
                    ProductRegionConfig.objects.create(
                        product=instance,
                        region_id=region_id,
                        price=config_data.get('price', 0),
                        promotional_price=config_data.get('promotional_price'),
                        is_visible=config_data.get('is_visible', True)
                    )

        # Update media if provided
        if media_files_data is not None:
            instance.media.all().delete()
            for media_data in media_files_data:
                ProductMedia.objects.create(
                    product=instance,
                    file_url=media_data.get('file_url'),
                    media_type=media_data.get('media_type', 'IMAGE'),
                    display_order=media_data.get('display_order', 0)
                )

        # Update categories if provided
        if category_ids is not None:
            instance.categories.set(category_ids)

        return instance


class BundleItemSerializer(serializers.ModelSerializer):
    product = serializers.SerializerMethodField()

    class Meta:
        model = BundleItem
        fields = ['product', 'quantity']

    def get_product(self, obj):
        media = obj.product.media.filter(media_type='IMAGE').first()
        return {
            'id': obj.product.id,
            'sku': obj.product.sku,
            'name': obj.product.name,
            'thumbnail': media.file_url if media else None,
        }


class BundleRegionConfigSerializer(serializers.ModelSerializer):
    region_code = serializers.CharField(source='region.code', read_only=True)

    class Meta:
        model = BundleRegionConfig
        fields = ['id', 'region', 'region_code', 'price', 'promotional_price', 'is_visible']


class BundleSerializer(serializers.ModelSerializer):
    """Public storefront serializer — uses context['region'] to resolve price."""
    items = BundleItemSerializer(many=True, read_only=True)
    price = serializers.SerializerMethodField()
    promotional_price = serializers.SerializerMethodField()
    savings_vs_individual = serializers.SerializerMethodField()

    class Meta:
        model = Bundle
        fields = ['id', 'slug', 'name', 'description', 'items', 'price', 'promotional_price', 'savings_vs_individual']

    def _region_config(self, obj):
        region = self.context.get('region')
        if not region:
            return None
        return obj.regional_configs.filter(region=region).first()

    def get_price(self, obj):
        cfg = self._region_config(obj)
        return cfg.price if cfg else None

    def get_promotional_price(self, obj):
        cfg = self._region_config(obj)
        return cfg.promotional_price if cfg else None

    def get_savings_vs_individual(self, obj):
        region = self.context.get('region')
        if not region:
            return None
        bundle_cfg = obj.regional_configs.filter(region=region).first()
        if not bundle_cfg:
            return None
        bundle_price = bundle_cfg.promotional_price or bundle_cfg.price
        total = 0
        for item in obj.items.all():
            pc = item.product.regional_configs.filter(region=region).first()
            if not pc:
                continue
            unit = pc.promotional_price or pc.price
            total += float(unit) * item.quantity
        savings = total - float(bundle_price)
        return round(savings, 2) if savings > 0 else 0


class BundleAdminSerializer(serializers.ModelSerializer):
    items = BundleItemSerializer(many=True, read_only=True)
    regional_configs = BundleRegionConfigSerializer(many=True, read_only=True)

    class Meta:
        model = Bundle
        fields = [
            'id', 'name', 'slug', 'description', 'is_active', 'sort_order',
            'items', 'regional_configs', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class BundleAdminCreateUpdateSerializer(serializers.ModelSerializer):
    items = serializers.ListField(child=serializers.DictField(), write_only=True, required=False)
    regional_configs = serializers.ListField(child=serializers.DictField(), write_only=True, required=False)

    class Meta:
        model = Bundle
        fields = ['name', 'slug', 'description', 'is_active', 'sort_order', 'items', 'regional_configs']

    def _apply_items(self, bundle, items_data):
        bundle.items.all().delete()
        for row in items_data:
            pid = row.get('product_id') or row.get('product')
            if not pid:
                continue
            BundleItem.objects.create(
                bundle=bundle, product_id=pid, quantity=int(row.get('quantity', 1) or 1)
            )

    def _apply_configs(self, bundle, configs_data):
        bundle.regional_configs.all().delete()
        for row in configs_data:
            rid = row.get('region')
            if not rid:
                continue
            BundleRegionConfig.objects.create(
                bundle=bundle, region_id=rid,
                price=row.get('price', 0),
                promotional_price=row.get('promotional_price'),
                is_visible=row.get('is_visible', True),
            )

    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        configs_data = validated_data.pop('regional_configs', [])
        bundle = Bundle.objects.create(**validated_data)
        self._apply_items(bundle, items_data)
        self._apply_configs(bundle, configs_data)
        return bundle

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        configs_data = validated_data.pop('regional_configs', None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if items_data is not None:
            self._apply_items(instance, items_data)
        if configs_data is not None:
            self._apply_configs(instance, configs_data)
        return instance


class ProductLandingPageSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    product_sku = serializers.CharField(source='product.sku', read_only=True)

    class Meta:
        model = ProductLandingPage
        fields = '__all__'

