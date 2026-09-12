from rest_framework import serializers
from django.db.models import Avg, Sum
from apps.regions.models import Warehouse
from apps.inventory.models import StockLevel
from .pricing import resolve_price, resolve_variant_price
from .models import (
    Product, ProductVariant, ProductRegionConfig, ProductMedia, ProductReview, Category, ProductLandingPage,
    Bundle, BundleItem, BundleRegionConfig,
)
from .media_validation import MediaUrlError, validate_media_url


def normalize_media_url(url: str) -> str:
    if not url:
        return ""
    url = str(url).strip()
    for prefix in ['http://localhost:8000', 'http://127.0.0.1:8000', 'http://localhost:8001', 'http://localhost:3000']:
        if url.startswith(prefix):
            url = url[len(prefix):]
    return url


class CategorySerializer(serializers.ModelSerializer):
    product_count = serializers.IntegerField(read_only=True, required=False)

    class Meta:
        model = Category
        fields = ['id', 'name', 'slug', 'description', 'display_order', 'product_count', 'image_url']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        if data.get('image_url'):
            data['image_url'] = normalize_media_url(data['image_url'])
        return data


class ProductVariantSerializer(serializers.ModelSerializer):
    price = serializers.SerializerMethodField()

    class Meta:
        model = ProductVariant
        fields = [
            'id', 'sku', 'name', 'option_name', 'option_value',
            'price', 'price_gbp', 'price_inr', 'stock_qty', 'is_active', 'sort_order'
        ]

    def get_price(self, obj):
        region = self.context.get('region')
        return resolve_variant_price(obj, region) if region else None


class ProductMediaSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = ProductMedia
        fields = ['id', 'file_url', 'media_type', 'display_order']

    def get_file_url(self, obj):
        return normalize_media_url(obj.file_url)

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
        read_only_fields = ['created_at']

class ProductListSerializer(serializers.ModelSerializer):
    price = serializers.SerializerMethodField()
    promotional_price = serializers.SerializerMethodField()
    stock_available = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()
    thumbnail = serializers.SerializerMethodField()
    categories = CategorySerializer(many=True, read_only=True)
    variants = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ['id', 'sku', 'name', 'price', 'promotional_price', 'stock_available', 'average_rating', 'thumbnail', 'categories', 'variants']

    def get_region(self):
        return self.context.get('region')

    def get_price(self, obj):
        region = self.get_region()
        if not region:
            return None
        if hasattr(obj, '_public_region_configs'):
            configs = obj._public_region_configs
            return resolve_price(obj, region, config=configs[0] if configs else None)[0]
        return resolve_price(obj, region)[0]

    def get_promotional_price(self, obj):
        region = self.get_region()
        if not region:
            return None
        if hasattr(obj, '_public_region_configs'):
            configs = obj._public_region_configs
            return resolve_price(obj, region, config=configs[0] if configs else None)[1]
        return resolve_price(obj, region)[1]

    def get_stock_available(self, obj):
        region = self.get_region()
        if not region:
            return 0
        prefetched = getattr(obj, '_public_region_stock', None)
        if prefetched is not None:
            return sum(row.available for row in prefetched)
        warehouses = Warehouse.objects.filter(region=region, is_active=True)
        return StockLevel.objects.filter(
            product=obj, warehouse__in=warehouses,
        ).aggregate(total=Sum('available'))['total'] or 0

    def get_average_rating(self, obj):
        prefetched = getattr(obj, '_public_reviews', None)
        if prefetched is not None:
            ratings = [review.rating for review in prefetched]
            rating = sum(ratings) / len(ratings) if ratings else None
        else:
            rating = obj.reviews.filter(is_approved=True).aggregate(avg=Avg('rating'))['avg']
        return round(rating, 1) if rating else 5.0

    def get_thumbnail(self, obj):
        prefetched = getattr(obj, '_public_images', None)
        media = prefetched[0] if prefetched else obj.media.filter(media_type='IMAGE').first()
        return normalize_media_url(media.file_url) if media else None

    def get_variants(self, obj):
        variants = getattr(obj, '_public_variants', None)
        if variants is None:
            variants = obj.variants.filter(is_active=True).order_by('sort_order', 'id')
        return ProductVariantSerializer(variants, many=True, context=self.context).data


class ProductDetailSerializer(serializers.ModelSerializer):
    price = serializers.SerializerMethodField()
    promotional_price = serializers.SerializerMethodField()
    stock_available = serializers.SerializerMethodField()
    average_rating = serializers.SerializerMethodField()
    media = ProductMediaSerializer(many=True, read_only=True)
    reviews = serializers.SerializerMethodField()
    categories = CategorySerializer(many=True, read_only=True)
    variants = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'sku', 'name', 'hsn_code', 'description', 'benefits',
            'ingredients', 'nutrition_facts', 'faq', 'dietary_tags', 'short_benefit', 'price',
            'promotional_price', 'stock_available', 'average_rating',
            'media', 'reviews', 'categories', 'variants'
        ]

    def get_region(self):
        return self.context.get('region')

    def get_price(self, obj):
        region = self.get_region()
        if not region:
            return None
        if hasattr(obj, '_public_region_configs'):
            configs = obj._public_region_configs
            return resolve_price(obj, region, config=configs[0] if configs else None)[0]
        return resolve_price(obj, region)[0]

    def get_promotional_price(self, obj):
        region = self.get_region()
        if not region:
            return None
        if hasattr(obj, '_public_region_configs'):
            configs = obj._public_region_configs
            return resolve_price(obj, region, config=configs[0] if configs else None)[1]
        return resolve_price(obj, region)[1]

    def get_stock_available(self, obj):
        region = self.get_region()
        if not region:
            return 0
        prefetched = getattr(obj, '_public_region_stock', None)
        if prefetched is not None:
            return sum(row.available for row in prefetched)
        warehouses = Warehouse.objects.filter(region=region, is_active=True)
        return StockLevel.objects.filter(
            product=obj, warehouse__in=warehouses,
        ).aggregate(total=Sum('available'))['total'] or 0

    def get_average_rating(self, obj):
        prefetched = getattr(obj, '_public_reviews', None)
        if prefetched is not None:
            ratings = [review.rating for review in prefetched]
            rating = sum(ratings) / len(ratings) if ratings else None
        else:
            rating = obj.reviews.filter(is_approved=True).aggregate(avg=Avg('rating'))['avg']
        return round(rating, 1) if rating else 5.0

    def get_reviews(self, obj):
        reviews = getattr(obj, '_public_reviews', None)
        if reviews is None:
            reviews = obj.reviews.filter(is_approved=True)[:10]
        else:
            reviews = reviews[:10]
        return ProductReviewSerializer(reviews, many=True).data

    def get_variants(self, obj):
        variants = getattr(obj, '_public_variants', None)
        if variants is None:
            variants = obj.variants.filter(is_active=True).order_by('sort_order', 'id')
        return ProductVariantSerializer(variants, many=True, context=self.context).data


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

    def validate_file_url(self, value):
        try:
            return validate_media_url(value)
        except MediaUrlError as exc:
            raise serializers.ValidationError(str(exc))


class ProductAdminSerializer(serializers.ModelSerializer):
    regional_configs = ProductRegionConfigSerializer(many=True, read_only=True)
    regional_stock = serializers.SerializerMethodField()
    media = ProductMediaAdminSerializer(many=True, read_only=True)
    categories = CategorySerializer(many=True, read_only=True)
    variants = ProductVariantSerializer(many=True, read_only=True)
    average_rating = serializers.SerializerMethodField()
    total_reviews = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'sku', 'name', 'hsn_code', 'description', 'benefits',
            'ingredients', 'nutrition_facts', 'faq', 'dietary_tags', 'short_benefit',
            'base_price', 'is_active', 'is_archived',
            'regional_configs', 'regional_stock', 'media', 'categories', 'variants',
            'average_rating', 'total_reviews', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_average_rating(self, obj):
        reviews = [review for review in obj.reviews.all() if review.is_approved]
        if not reviews:
            return 0.0
        return round(sum(review.rating for review in reviews) / len(reviews), 1)

    def get_total_reviews(self, obj):
        return sum(1 for review in obj.reviews.all() if review.is_approved)

    def get_regional_stock(self, obj):
        """Per-region available stock (summed across that region's warehouses).
        Surfacing stock per region prevents 'ghost stock' — admins see exactly
        what can be fulfilled in each market, not a misleading global total."""
        from apps.regions.models import Region
        regions = self.context.get('active_regions')
        if regions is None:
            regions = list(Region.objects.filter(is_active=True).order_by('code'))
        stock_rows = list(obj.stocks.all())
        out = []
        for region in regions:
            rows = [
                row for row in stock_rows
                if row.warehouse.region_id == region.id and row.warehouse.is_active
            ]
            out.append({
                'region_id': region.id,
                'region_code': region.code,
                'available': sum(row.available for row in rows),
                'reserved': sum(row.reserved for row in rows),
            })
        return out


class ProductAdminCreateUpdateSerializer(serializers.ModelSerializer):
    """For creating/updating products with nested regional configs, media, and variants."""
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
    variants = serializers.ListField(
        child=serializers.DictField(), write_only=True, required=False
    )

    class Meta:
        model = Product
        fields = [
            'sku', 'name', 'hsn_code', 'description', 'benefits',
            'ingredients', 'nutrition_facts', 'faq', 'dietary_tags', 'short_benefit', 'is_active', 'is_archived',
            'regional_configs', 'media_files', 'category_ids', 'regional_stock', 'variants'
        ]

    def validate_media_files(self, value):
        cleaned = []
        for index, item in enumerate(value):
            try:
                url = validate_media_url(item.get('file_url'))
            except MediaUrlError as exc:
                raise serializers.ValidationError(f'Media item {index + 1}: {exc}')
            cleaned.append({**item, 'file_url': url})
        return cleaned

    def _apply_regional_stock(self, product, regional_stock_data):
        from apps.regions.models import Warehouse
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

    def _apply_variants(self, product, variants_data):
        from .models import ProductVariant
        product.variants.all().delete()
        for idx, v_data in enumerate(variants_data):
            v_sku = v_data.get('sku') or f"{product.sku}-V{idx+1}"
            ProductVariant.objects.create(
                product=product,
                sku=v_sku,
                name=v_data.get('name') or 'Standard',
                option_name=v_data.get('option_name', 'Size'),
                option_value=v_data.get('option_value', v_data.get('name', 'Standard')),
                price_gbp=v_data.get('price_gbp'),
                price_inr=v_data.get('price_inr'),
                stock_qty=v_data.get('stock_qty', 100),
                is_active=v_data.get('is_active', True),
                sort_order=idx,
            )

    def create(self, validated_data):
        regional_configs_data = validated_data.pop('regional_configs', [])
        media_files_data = validated_data.pop('media_files', [])
        category_ids = validated_data.pop('category_ids', [])
        regional_stock_data = validated_data.pop('regional_stock', [])
        variants_data = validated_data.pop('variants', [])

        product = Product.objects.create(**validated_data)
        self._apply_regional_stock(product, regional_stock_data)
        if variants_data:
            self._apply_variants(product, variants_data)

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
        variants_data = validated_data.pop('variants', None)

        # Update base product fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if regional_stock_data is not None:
            self._apply_regional_stock(instance, regional_stock_data)

        if variants_data is not None:
            self._apply_variants(instance, variants_data)

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
            'thumbnail': normalize_media_url(media.file_url) if media else None,
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

