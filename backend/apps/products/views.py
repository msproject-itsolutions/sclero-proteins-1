from pathlib import Path
from uuid import uuid4

from rest_framework import viewsets, status
from rest_framework.pagination import PageNumberPagination
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser
from django.conf import settings
from django.core.files.storage import default_storage
from django.db.models import Q, Count, Sum, Prefetch, OuterRef, Subquery, IntegerField, Value
from django.db.models.functions import Coalesce
from apps.inventory.models import StockLevel
from apps.regions.models import Region
from apps.users.permissions import require_permission
from .pricing import resolve_price, sellable_in
from .models import (
    Product, ProductReview, ProductVariant, Category, ProductRegionConfig,
    ProductMedia, ProductLandingPage, Bundle,
)
from .serializers import (
    ProductListSerializer, ProductDetailSerializer,
    ProductReviewSerializer, ProductReviewAdminSerializer,
    CategorySerializer, ProductAdminSerializer, ProductAdminCreateUpdateSerializer,
    ProductRegionConfigSerializer, ProductMediaAdminSerializer, ProductLandingPageSerializer,
    BundleAdminSerializer, BundleAdminCreateUpdateSerializer,
)


def _with_public_product_relations(queryset, region):
    """Load all card/detail relations in a fixed number of queries."""
    return queryset.prefetch_related(
        'categories',
        Prefetch(
            'regional_configs',
            queryset=ProductRegionConfig.objects.filter(region=region),
            to_attr='_public_region_configs',
        ),
        Prefetch(
            'stocks',
            queryset=StockLevel.objects.filter(
                warehouse__region=region, warehouse__is_active=True,
            ),
            to_attr='_public_region_stock',
        ),
        Prefetch(
            'reviews',
            queryset=ProductReview.objects.filter(is_approved=True).order_by('-created_at'),
            to_attr='_public_reviews',
        ),
        Prefetch(
            'media',
            queryset=ProductMedia.objects.filter(media_type='IMAGE').order_by('display_order', 'id'),
            to_attr='_public_images',
        ),
        Prefetch(
            'variants',
            queryset=ProductVariant.objects.filter(is_active=True).order_by('sort_order', 'id'),
            to_attr='_public_variants',
        ),
    )

class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Product.objects.filter(is_active=True, is_archived=False)
    lookup_field = 'sku'
    permission_classes = [AllowAny]
    # DRF action kwargs must correspond to attributes on the viewset. Keeping
    # the default unset lets only the review action opt into the review scope.
    throttle_scope = None

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

        # Products sellable in this region: an explicit price, or a base price
        # this market can convert. Mirrors resolve_price() so the catalogue and
        # checkout never disagree about what's for sale.
        queryset = _with_public_product_relations(
            self.queryset.filter(sellable_in(region)).distinct(), region,
        )

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
        if sort in ('popularity', 'bestseller'):
            queryset = queryset.annotate(
                units_sold=Sum(
                    'orderitem__quantity',
                    filter=Q(orderitem__order__region=region) & ~Q(orderitem__order__status__in=['CANCELLED', 'REFUNDED'])
                )
            ).order_by('-units_sold', 'name')
        elif sort == 'newest':
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
            visible_products = (
                Product.objects.filter(
                    categories=OuterRef('pk'), is_active=True, is_archived=False,
                )
                .filter(sellable_in(region))
                .order_by()
                .values('categories')
                .annotate(total=Count('pk', distinct=True))
                .values('total')[:1]
            )
            qs = qs.annotate(
                product_count=Coalesce(
                    Subquery(visible_products, output_field=IntegerField()),
                    Value(0),
                )
            )
        else:
            qs = qs.annotate(product_count=Count('products', distinct=True))
        return Response(CategorySerializer(qs, many=True).data)

    def retrieve(self, request, *args, **kwargs):
        region = self.get_region()
        if not region:
            return Response({"error": "A valid and active region parameter is required."}, status=status.HTTP_400_BAD_REQUEST)
            
        product = _with_public_product_relations(
            self.queryset.filter(sku=self.kwargs[self.lookup_field]), region,
        ).first()
        if product is None:
            return Response({"error": "Product not found."}, status=status.HTTP_404_NOT_FOUND)
        
        # Verify visibility in this region
        config = product._public_region_configs[0] if product._public_region_configs else None
        if resolve_price(product, region, config=config)[0] is None:
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
        base = Product.objects.filter(
            is_active=True, is_archived=False,
        ).filter(sellable_in(region)).exclude(pk=product.pk).distinct()
        related = list(base.filter(categories__in=category_ids).distinct()[:4]) if category_ids else []
        if len(related) < 4:
            seen = {p.pk for p in related}
            for p in base.exclude(pk__in=seen)[:4 - len(related)]:
                related.append(p)
        # List serializer: card-shaped payload including `thumbnail`, which the
        # storefront ProductCard renders. The detail serializer has no
        # thumbnail field, which left the "Recommended Products" grid imageless.
        related_ids = [item.pk for item in related]
        related = list(_with_public_product_relations(
            Product.objects.filter(pk__in=related_ids), region,
        ))
        related.sort(key=lambda item: related_ids.index(item.pk))
        ser = ProductListSerializer(related, many=True, context={'region': region})
        return Response(ser.data)

    @action(detail=True, methods=['post'], permission_classes=[AllowAny], throttle_scope='review')
    def reviews(self, request, sku=None):
        product = self.get_object()
        serializer = ProductReviewSerializer(data=request.data)
        if serializer.is_valid():
            # Auto-detect verified purchase: did this email actually order this product?
            from apps.orders.models import Order
            email = serializer.validated_data.get('user_email', '')
            verified = bool(email) and Order.objects.placed().filter(
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


class PublicFeaturedReviewsView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        reviews = ProductReview.objects.filter(is_approved=True).order_by('-is_featured', '-created_at')[:20]
        ser = ProductReviewSerializer(reviews, many=True)
        from django.db.models import Avg, Count
        stats = ProductReview.objects.filter(is_approved=True).aggregate(
            avg_rating=Avg('rating'),
            total_count=Count('id'),
        )
        return Response({
            'results': ser.data,
            'average_rating': round(float(stats['avg_rating'] or 4.9), 1),
            'total_reviews': stats['total_count'] or len(ser.data),
        })

    def post(self, request):
        serializer = ProductReviewSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(is_approved=False, is_verified_purchase=False)
            return Response({
                "message": "Review submitted successfully! It will be visible once approved by an administrator.",
                "review": serializer.data
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)



# --- Admin ViewSets for Regional CRUD Operations --- #

class AdminDashboardPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


class ProductAdminViewSet(viewsets.ModelViewSet):
    """
    Admin CRUD operations for products with regional configurations.
    Requires 'products.manage' permission when RBAC is enforced.
    Supports regional filtering via ?region=IN,UK,US
    """
    permission_classes = [require_permission('products.manage')]
    lookup_field = 'sku'
    pagination_class = AdminDashboardPagination

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

        # Advanced Search parameters
        search_query = self.request.query_params.get('search')
        if search_query:
            search_query = search_query.strip()
            queryset = queryset.filter(
                Q(name__icontains=search_query) |
                Q(sku__icontains=search_query) |
                Q(description__icontains=search_query)
            ).distinct()

        # Category Filter
        category_id = self.request.query_params.get('category')
        if category_id:
            queryset = queryset.filter(categories__id=category_id).distinct()

        # Sort Ordering parameter
        ordering = self.request.query_params.get('ordering')
        if ordering == 'sku':
            queryset = queryset.order_by('sku')
        elif ordering == '-sku':
            queryset = queryset.order_by('-sku')
        elif ordering == 'name':
            queryset = queryset.order_by('name')
        elif ordering == '-name':
            queryset = queryset.order_by('-name')
        else:
            queryset = queryset.order_by('-id')

        # regional_configs is a reverse FK → prefetch (not select_related).
        return queryset.prefetch_related(
            'regional_configs__region', 'media', 'categories', 'reviews',
            'variants', 'stocks__warehouse',
        )

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['active_regions'] = list(
            Region.objects.filter(is_active=True).order_by('code')
        )
        return context

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


class MediaUploadView(APIView):
    """
    API endpoint for direct device file uploads (Images/Videos).
    Requires 'products.manage' permission.
    """
    parser_classes = [MultiPartParser, FormParser]
    permission_classes = [require_permission('products.manage')]
    throttle_scope = 'media_upload'

    MAX_UPLOAD_BYTES = 25 * 1024 * 1024
    ALLOWED_UPLOADS = {
        '.jpg': {'image/jpeg'},
        '.jpeg': {'image/jpeg'},
        '.png': {'image/png'},
        '.webp': {'image/webp'},
        '.gif': {'image/gif'},
        '.mp4': {'video/mp4'},
        '.mov': {'video/quicktime'},
        '.pdf': {'application/pdf'},
    }

    def post(self, request, *args, **kwargs):
        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response({"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)
        if uploaded_file.size > self.MAX_UPLOAD_BYTES:
            return Response({"error": "File must be 25 MB or smaller."}, status=status.HTTP_400_BAD_REQUEST)

        ext = Path(uploaded_file.name).suffix.lower()
        content_type = (getattr(uploaded_file, 'content_type', '') or '').lower()
        if ext not in self.ALLOWED_UPLOADS or content_type not in self.ALLOWED_UPLOADS[ext]:
            return Response(
                {"error": "Unsupported file type. Upload JPG, PNG, WebP, GIF, MP4, MOV, or PDF files only."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Use a server-generated object name so attacker supplied filenames
        # cannot influence storage paths or response URLs.
        name = default_storage.save(f'uploads/{uuid4().hex}{ext}', uploaded_file)
        file_url = default_storage.url(name)
        # Absolute URLs come from configuration, never from request headers.
        site_url = (getattr(settings, 'SITE_URL', '') or '').rstrip('/')
        if site_url and not file_url.startswith('http'):
            file_url = f"{site_url}{file_url}"
        return Response({"file_url": file_url}, status=status.HTTP_201_CREATED)
