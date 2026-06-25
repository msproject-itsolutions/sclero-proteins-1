from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from django.shortcuts import get_object_or_404
from django.db.models import Q, Count
from apps.regions.models import Region
from apps.users.permissions import require_permission
from .models import (
    Product, ProductReview, Category, ProductRegionConfig, ProductMedia, ProductLandingPage,
    Bundle,
)
from .serializers import (
    ProductListSerializer, ProductDetailSerializer,
    ProductReviewSerializer, ProductReviewAdminSerializer,
    CategorySerializer, ProductAdminSerializer, ProductAdminCreateUpdateSerializer,
    ProductRegionConfigSerializer, ProductMediaAdminSerializer, ProductLandingPageSerializer,
    BundleSerializer, BundleAdminSerializer, BundleAdminCreateUpdateSerializer,
)

class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Product.objects.filter(is_active=True, is_archived=False)
    lookup_field = 'sku'

    def get_region(self):
        region_code = self.request.query_params.get('region', '').upper()
        if not region_code:
            # Try to fetch default or fallback
            return Region.objects.filter(is_active=True).first()
        return Region.objects.filter(code=region_code, is_active=True).first()

    def list(self, request, *args, **kwargs):
        region = self.get_region()
        if not region:
            return Response({"error": "A valid and active region parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Filter products visible in this region
        queryset = self.queryset.filter(
            regional_configs__region=region,
            regional_configs__is_visible=True
        ).distinct()

        # Synonym and Typo-tolerant search
        TYPO_MAP = {
            "createn": "creatine",
            "creatin": "creatine",
            "colagen": "collagen",
            "collegen": "collagen",
            "collagin": "collagen",
            "glutameen": "glutamine",
            "glutamin": "glutamine",
            "protean": "protein",
            "protien": "protein",
            "calsem": "calcium",
            "calcum": "calcium",
            "ashwaganda": "ashwagandha",
            "ashwaghanda": "ashwagandha"
        }
        
        SYNONYMS = {
            "ashwagandha": ["glutamine", "recovery", "sleep", "stress", "immune"],
            "ginseng": ["glutamine", "recovery", "sleep", "stress", "immune"],
            "withania somnifera": ["glutamine", "recovery", "sleep", "stress", "immune"],
            "muscle": ["protein", "whey", "creatine", "glutamine", "recovery"],
            "strength": ["creatine", "protein", "whey"],
            "sleep": ["glutamine", "recovery", "soreness"],
            "stress": ["glutamine", "recovery"],
            "joint": ["bjc", "bone", "joint", "collagen", "eggshell", "membrane"],
            "bone": ["bjc", "bone", "calcium", "calpure"],
            "skin": ["collagen", "combocollagen", "ovoshell", "beauty"],
            "hair": ["collagen", "combocollagen", "ovoshell", "beauty"],
            "nails": ["collagen", "combocollagen", "ovoshell", "beauty"],
            "beauty": ["collagen", "combocollagen", "ovoshell"],
            "fertilizer": ["soilpro", "lawncal"],
            "grass": ["lawncal", "soilpro"],
            "lawn": ["lawncal", "soilpro"],
            "upcycled": ["bjc", "collagen", "calpure", "ovoshell"]
        }

        search = request.query_params.get('search', '').strip().lower()
        if search:
            # Tokenize and clean
            tokens = [t.strip() for t in search.split() if t.strip()]
            resolved_terms = set()
            for token in tokens:
                resolved_terms.add(token)
                if token in TYPO_MAP:
                    resolved_terms.add(TYPO_MAP[token])
                for key in TYPO_MAP:
                    if len(token) > 4 and len(key) > 4:
                        if token.startswith(key[:4]) or key.startswith(token[:4]):
                            resolved_terms.add(TYPO_MAP[key])
            
            extra_synonyms = set()
            for term in list(resolved_terms):
                if term in SYNONYMS:
                    extra_synonyms.update(SYNONYMS[term])
            
            q_filter = Q()
            for term in resolved_terms:
                q_filter |= (
                    Q(name__icontains=term)
                    | Q(description__icontains=term)
                    | Q(benefits__icontains=term)
                    | Q(ingredients__icontains=term)
                    | Q(sku__icontains=term)
                )
            for syn in extra_synonyms:
                q_filter |= (
                    Q(name__icontains=syn)
                    | Q(description__icontains=syn)
                    | Q(benefits__icontains=syn)
                    | Q(ingredients__icontains=syn)
                    | Q(sku__icontains=syn)
                )
            queryset = queryset.filter(q_filter)

        # Optional category facet (slug). Repeatable: ?category=protein&category=recovery
        category_slugs = [s for s in request.query_params.getlist('category') if s]
        if category_slugs:
            queryset = queryset.filter(categories__slug__in=category_slugs).distinct()

        # Sorting. Price sorts are resolved in Python because price is regional
        # and lives on ProductRegionConfig rather than Product.
        sort = request.query_params.get('sort', '')
        if sort == 'newest':
            queryset = queryset.order_by('-created_at')
        elif sort == 'name':
            queryset = queryset.order_by('name')

        serializer = ProductListSerializer(queryset, many=True, context={'region': region})
        data = serializer.data

        if sort in ('price_asc', 'price_desc'):
            def effective_price(item):
                p = item.get('promotional_price') or item.get('price') or 0
                return float(p)
            data = sorted(data, key=effective_price, reverse=(sort == 'price_desc'))
        elif sort == 'rating':
            data = sorted(data, key=lambda i: float(i.get('average_rating') or 0), reverse=True)

        return Response(data)

    @action(detail=False, methods=['get'], permission_classes=[AllowAny])
    def categories(self, request):
        """Active categories with a count of region-visible products, for filter facets."""
        region = self.get_region()
        qs = Category.objects.filter(is_active=True)
        if region:
            qs = qs.annotate(
                product_count=Count(
                    'products',
                    filter=Q(
                        products__regional_configs__region=region,
                        products__regional_configs__is_visible=True,
                        products__is_active=True,
                        products__is_archived=False,
                    ),
                    distinct=True,
                )
            )
        else:
            qs = qs.annotate(product_count=Count('products', distinct=True))
        return Response(CategorySerializer(qs, many=True).data)

    def retrieve(self, request, *args, **kwargs):
        region = self.get_region()
        if not region:
            return Response({"error": "A valid and active region parameter is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        product = self.get_object()
        
        # Verify visibility in this region
        is_visible = product.regional_configs.filter(region=region, is_visible=True).exists()
        if not is_visible:
            return Response({"error": "Product not available in this region."}, status=status.HTTP_404_NOT_FOUND)

        serializer = ProductDetailSerializer(product, context={'region': region})
        return Response(serializer.data)

    @action(detail=True, methods=['get'], permission_classes=[AllowAny], url_path='related')
    def related(self, request, sku=None):
        """Up to 4 products sharing at least one category with this one,
        visible+in-stock in the same region. Falls back to other region-visible
        products if the category overlap is empty."""
        region = self.get_region()
        if not region:
            return Response({"error": "region is required"}, status=status.HTTP_400_BAD_REQUEST)
        product = self.get_object()
        category_ids = list(product.categories.values_list('id', flat=True))
        base = (Product.objects.filter(is_active=True, is_archived=False,
                                       regional_configs__region=region,
                                       regional_configs__is_visible=True)
                .exclude(pk=product.pk).distinct())
        related = list(base.filter(categories__in=category_ids).distinct()[:4]) if category_ids else []
        if len(related) < 4:
            seen = {p.pk for p in related}
            for p in base.exclude(pk__in=seen)[:4 - len(related)]:
                related.append(p)
        ser = ProductDetailSerializer(related, many=True, context={'region': region})
        return Response(ser.data)

    @action(detail=True, methods=['post'], permission_classes=[AllowAny])
    def reviews(self, request, sku=None):
        product = self.get_object()
        serializer = ProductReviewSerializer(data=request.data)
        if serializer.is_valid():
            # Auto-detect verified purchase: did this email actually order this product?
            from apps.orders.models import Order
            email = serializer.validated_data.get('user_email', '')
            verified = bool(email) and Order.objects.filter(
                email__iexact=email, items__product=product
            ).exists()
            # Always created unapproved — visible only after moderation.
            serializer.save(product=product, is_approved=False, is_verified_purchase=verified)
            return Response({
                "message": "Review submitted successfully! It will be visible once approved by an administrator.",
                "review": serializer.data
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ProductReviewAdminViewSet(viewsets.ModelViewSet):
    """
    Moderation API for reviews. Gated by 'reviews.moderate' when RBAC is enforced.
    Filter with ?approved=true|false&featured=true&product=<sku>.
    """
    queryset = ProductReview.objects.select_related('product').all()
    serializer_class = ProductReviewAdminSerializer
    permission_classes = [require_permission('reviews.moderate')]

    def get_queryset(self):
        qs = self.queryset
        approved = self.request.query_params.get('approved')
        if approved in ('true', 'false'):
            qs = qs.filter(is_approved=(approved == 'true'))
        if self.request.query_params.get('featured') == 'true':
            qs = qs.filter(is_featured=True)
        sku = self.request.query_params.get('product')
        if sku:
            qs = qs.filter(product__sku=sku)
        return qs

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        review = self.get_object()
        review.is_approved = True
        review.save(update_fields=['is_approved'])
        return Response(self.get_serializer(review).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        review = self.get_object()
        review.is_approved = False
        review.save(update_fields=['is_approved'])
        return Response(self.get_serializer(review).data)

    @action(detail=True, methods=['post'])
    def toggle_feature(self, request, pk=None):
        review = self.get_object()
        review.is_featured = not review.is_featured
        review.save(update_fields=['is_featured'])
        return Response(self.get_serializer(review).data)


# --- Admin ViewSets for Regional CRUD Operations --- #

class ProductAdminViewSet(viewsets.ModelViewSet):
    """
    Admin CRUD operations for products with regional configurations.
    Requires 'products.manage' permission when RBAC is enforced.
    Supports regional filtering via ?region=IN,UK,US
    """
    permission_classes = [require_permission('products.manage')]
    lookup_field = 'sku'

    def get_queryset(self):
        queryset = Product.objects.all()
        
        # Enforce Regional Restrictions for Country Managers
        user = self.request.user
        if user and user.is_authenticated and not user.is_superuser:
            assigned_regions = user.assigned_regions.all()
            if assigned_regions.exists():
                queryset = queryset.filter(regional_configs__region__in=assigned_regions).distinct()

        region_code = self.request.query_params.get('region')
        if region_code:
            queryset = queryset.filter(regional_configs__region__code=region_code.upper()).distinct()
        # regional_configs is a reverse FK → prefetch (not select_related).
        return queryset.prefetch_related(
            'regional_configs__region', 'media', 'categories', 'reviews'
        )

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return ProductAdminCreateUpdateSerializer
        return ProductAdminSerializer

    @action(detail=False, methods=['get'])
    def by_region(self, request):
        """Get all products configured for a specific region."""
        region_code = request.query_params.get('region')
        if not region_code:
            return Response({"error": "Region parameter is required"}, status=status.HTTP_400_BAD_REQUEST)

        products = self.get_queryset().filter(
            regional_configs__region__code=region_code.upper()
        ).distinct()
        serializer = self.get_serializer(products, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def regional_config(self, request, sku=None):
        """Add or update regional configuration for a product."""
        product = self.get_object()
        region_id = request.data.get('region')
        price = request.data.get('price')
        promotional_price = request.data.get('promotional_price')
        is_visible = request.data.get('is_visible', True)

        if not region_id or not price:
            return Response({"error": "region and price are required"}, status=status.HTTP_400_BAD_REQUEST)

        config, created = ProductRegionConfig.objects.update_or_create(
            product=product,
            region_id=region_id,
            defaults={
                'price': price,
                'promotional_price': promotional_price,
                'is_visible': is_visible
            }
        )
        serializer = ProductRegionConfigSerializer(config)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class CategoryAdminViewSet(viewsets.ModelViewSet):
    """
    Admin CRUD operations for product categories.
    Requires 'products.manage' permission when RBAC is enforced.
    """
    queryset = Category.objects.all()
    permission_classes = [require_permission('products.manage')]
    serializer_class = CategorySerializer

    def get_queryset(self):
        return self.queryset.annotate(product_count=Count('products', distinct=True))


class ProductMediaAdminViewSet(viewsets.ModelViewSet):
    """
    Admin CRUD operations for product media.
    Requires 'products.manage' permission when RBAC is enforced.
    """
    queryset = ProductMedia.objects.all()
    permission_classes = [require_permission('products.manage')]
    serializer_class = ProductMediaAdminSerializer

    def get_queryset(self):
        product_sku = self.request.query_params.get('product')
        if product_sku:
            return self.queryset.filter(product__sku=product_sku)
        return self.queryset


class ProductLandingPageViewSet(viewsets.ModelViewSet):
    """
    CRUD operations for Automated Product Landing Pages (Open Pages Module).
    Requires 'products.manage' permission.
    """
    queryset = ProductLandingPage.objects.select_related('product').all()
    serializer_class = ProductLandingPageSerializer
    permission_classes = [require_permission('products.manage')]

    def get_queryset(self):
        qs = self.queryset
        product_sku = self.request.query_params.get('product')
        if product_sku:
            qs = qs.filter(product__sku=product_sku)
        return qs



# BundleViewSet (public storefront) removed per spec 2026-06-24 — Bundles are
# deprecated on the storefront in favour of Collections. The admin viewset and
# underlying models are retained so existing data is not orphaned.


class BundleAdminViewSet(viewsets.ModelViewSet):
    """Admin CRUD for bundles. Requires 'products.manage'."""
    queryset = Bundle.objects.all().prefetch_related(
        'items__product__media', 'regional_configs__region'
    )
    permission_classes = [require_permission('products.manage')]

    def get_serializer_class(self):
        if self.action in ['create', 'update', 'partial_update']:
            return BundleAdminCreateUpdateSerializer
        return BundleAdminSerializer
