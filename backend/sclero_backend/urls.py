from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from rest_framework.routers import DefaultRouter
from sclero_backend.health import live, ready

from apps.regions.views import (
    RegionViewSet, detect_region, geo_detect,
    RegionAdminViewSet, WarehouseAdminViewSet,
    ShippingZoneAdminViewSet, ShippingRateAdminViewSet,
    ShippingProviderAdminViewSet,
    PostcodeLookupView, ShippingCalculateView,
)
from apps.products.views import (
    ProductViewSet, ProductReviewAdminViewSet,
    ProductAdminViewSet, CategoryAdminViewSet, ProductMediaAdminViewSet,
    ProductLandingPageViewSet, BundleAdminViewSet, MediaUploadView,
)
from apps.users.views import (
    RegisterView, UserProfileView, UserAddressViewSet, UserErasureRequestView,
    SendOTPView, VerifyOTPView, GoogleLoginView,
    MagicLinkRequestView, MagicLinkVerifyView,
    RoleViewSet, StaffUserViewSet, WishlistViewSet, WishlistGroupViewSet, PublicWishlistView, AuditedLoginView,
    CookieTokenRefreshView, LogoutView,
    CustomerProfileViewSet, CustomerSegmentViewSet, CustomerActivityViewSet, SupportTicketViewSet,
    TerminateDevicesView, DataExportView, AccountDeleteView,
    PasswordResetRequestView, PasswordResetConfirmView,
)
from apps.users.totp import (
    TOTPSetupView, TOTPVerifyView, TOTPDisableView, TOTPStatusView,
)
from apps.orders.views import (
    CartViewSet, CheckoutView, ApplyCouponView, CreatePaymentIntentView, RefundView, MyOrdersView,
    PublicOrderDetailView, OrderAdminViewSet, RefundAdminViewSet, InvoiceAdminViewSet, AbandonedCheckoutsView,
    StripeWebhookView, RazorpayWebhookView, PaypalWebhookView,
    UnifiedPaymentWebhookView, CouponAdminViewSet,
)
from apps.webhooks.views import (
    WebhookSubscriptionViewSet, WebhookDeliveryViewSet, IncomingWebhookEventViewSet
)
from apps.admin_dashboard.views import (
    FeatureToggleViewSet, SystemSettingViewSet, HeroBannerSlideViewSet, PaymentGatewayViewSet, EmailTemplateViewSet,
    MarketingIntegrationViewSet, ContentPageViewSet, BlogPostViewSet, ReportAnalyticsView,
    ApprovalRequestViewSet, PublishedContentPageListView, PublishedContentPageDetailView,
    CronJobRunViewSet, PublishedPolicyPagesView,
    PublishedBlogPostListView, PublishedBlogPostDetailView, PublicSiteSettingView,
    StoreConfigView, TaxSettingsAdminView, SmtpTestView, InstagramReelsView, InstagramReelsConnectionAdminView,
)
from apps.audit.views import AuditLogViewSet
from apps.enquiries.views import BulkEnquiryCreateView, BulkEnquiryAdminViewSet, NewsletterSubscribeView
from apps.inventory.views import StockLevelAdminViewSet, StockTransferAdminViewSet
from apps.fraud.views import RiskAssessmentAdminViewSet
from apps.push_notifications.views import PushCampaignViewSet, PushConfigurationView, PushSubscriptionView

router = DefaultRouter()
router.register(r'regions', RegionViewSet, basename='region')
router.register(r'products', ProductViewSet, basename='product')
router.register(r'addresses', UserAddressViewSet, basename='address')
router.register(r'admin/toggles', FeatureToggleViewSet, basename='toggle')
router.register(r'admin/settings', SystemSettingViewSet, basename='setting')
router.register(r'admin/hero-banners', HeroBannerSlideViewSet, basename='admin-hero-banner')
router.register(r'admin/payment-gateways', PaymentGatewayViewSet, basename='payment-gateway')
router.register(r'admin/email-templates', EmailTemplateViewSet, basename='email-template')
router.register(r'admin/roles', RoleViewSet, basename='role')
router.register(r'admin/staff', StaffUserViewSet, basename='staff')
router.register(r'admin/reviews', ProductReviewAdminViewSet, basename='admin-review')
router.register(r'admin/audit-logs', AuditLogViewSet, basename='audit-log')
router.register(r'enquiries', BulkEnquiryCreateView, basename='enquiry')
router.register(r'admin/enquiries', BulkEnquiryAdminViewSet, basename='admin-enquiry')
router.register(r'wishlist', WishlistViewSet, basename='wishlist')
router.register(r'wishlists', WishlistGroupViewSet, basename='wishlists')

# New Admin Regional CRUD Endpoints
router.register(r'admin/products', ProductAdminViewSet, basename='admin-product')
router.register(r'admin/categories', CategoryAdminViewSet, basename='admin-category')
router.register(r'admin/product-media', ProductMediaAdminViewSet, basename='admin-product-media')
router.register(r'admin/regions', RegionAdminViewSet, basename='admin-region')
router.register(r'admin/warehouses', WarehouseAdminViewSet, basename='admin-warehouse')
router.register(r'admin/shipping-zones', ShippingZoneAdminViewSet, basename='admin-shipping-zone')
router.register(r'admin/shipping-rates', ShippingRateAdminViewSet, basename='admin-shipping-rate')
router.register(r'admin/shipping-providers', ShippingProviderAdminViewSet, basename='admin-shipping-provider')
router.register(r'admin/orders', OrderAdminViewSet, basename='admin-order')
router.register(r'admin/refunds', RefundAdminViewSet, basename='admin-refund')
router.register(r'admin/invoices', InvoiceAdminViewSet, basename='admin-invoice')
router.register(r'admin/stock-levels', StockLevelAdminViewSet, basename='admin-stock-level')
router.register(r'admin/stock-transfers', StockTransferAdminViewSet, basename='admin-stock-transfer')

# CRM & Marketing router registrations
router.register(r'admin/customers', CustomerProfileViewSet, basename='admin-customer')
router.register(r'admin/customer-segments', CustomerSegmentViewSet, basename='admin-customer-segment')
router.register(r'admin/customer-activities', CustomerActivityViewSet, basename='admin-customer-activity')
router.register(r'admin/support-tickets', SupportTicketViewSet, basename='admin-support-ticket')
router.register(r'admin/marketing-integrations', MarketingIntegrationViewSet, basename='admin-marketing-integration')
router.register(r'admin/content-pages', ContentPageViewSet, basename='admin-content-page')
router.register(r'admin/blog-posts', BlogPostViewSet, basename='admin-blog-post')
router.register(r'admin/product-landing-pages', ProductLandingPageViewSet, basename='admin-product-landing-page')
router.register(r'admin/approval-requests', ApprovalRequestViewSet, basename='admin-approval-request')
# Public storefront bundles endpoint removed per spec 2026-06-24 — bundles
# replaced by Collections on the storefront. Admin CRUD retained for legacy data.
router.register(r'admin/bundles', BundleAdminViewSet, basename='admin-bundle')
router.register(r'admin/coupons', CouponAdminViewSet, basename='admin-coupon')
router.register(r'admin/risk-assessments', RiskAssessmentAdminViewSet, basename='admin-risk-assessment')
router.register(r'admin/webhook-subscriptions', WebhookSubscriptionViewSet, basename='admin-webhook-subscription')
router.register(r'admin/webhook-deliveries', WebhookDeliveryViewSet, basename='admin-webhook-delivery')
router.register(r'admin/incoming-webhooks', IncomingWebhookEventViewSet, basename='admin-incoming-webhook')
router.register(r'admin/push-campaigns', PushCampaignViewSet, basename='admin-push-campaign')
router.register(r'admin/cron-runs', CronJobRunViewSet, basename='admin-cron-run')

urlpatterns = [
    path('api/health/live/', live, name='health_live'),
    path('api/health/ready/', ready, name='health_ready'),
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
    path('api/', include('apps.glossary.urls')),
    path('api/', include('apps.analytics.urls')),
    path('api/detect-region/', detect_region, name='detect_region'),
    path('api/geo/', geo_detect, name='geo_detect'),
    path('api/store-config/', StoreConfigView.as_view(), name='store_config'),
    path('api/instagram/reels/', InstagramReelsView.as_view(), name='instagram_reels'),
    path('api/shipping/lookup/', PostcodeLookupView.as_view(), name='shipping_lookup'),
    path('api/shipping/calculate/', ShippingCalculateView.as_view(), name='shipping_calculate'),
    path('api/admin/tax-settings/', TaxSettingsAdminView.as_view(), name='admin_tax_settings'),
    path('api/admin/smtp-test/', SmtpTestView.as_view(), name='admin_smtp_test'),
    path('api/admin/instagram-reels/', InstagramReelsConnectionAdminView.as_view(), name='admin_instagram_reels'),
    path('api/newsletter/subscribe/', NewsletterSubscribeView.as_view(), name='newsletter_subscribe'),
    path('api/push/config/', PushConfigurationView.as_view(), name='push_config'),
    path('api/push/subscriptions/', PushSubscriptionView.as_view(), name='push_subscriptions'),
    path('api/wishlists/shared/<str:share_token>/', PublicWishlistView.as_view(), name='shared-wishlist'),
    path('api/admin/upload-media/', MediaUploadView.as_view(), name='admin_upload_media'),
    
    # Custom Reports & Analytics
    path('api/admin/reports/analytics/', ReportAnalyticsView.as_view(), name='admin-analytics'),
    
    # Auth Endpoints
    path('api/auth/register/', RegisterView.as_view(), name='auth_register'),
    path('api/auth/login/', AuditedLoginView.as_view(), name='auth_login'),
    path('api/auth/token/refresh/', CookieTokenRefreshView.as_view(), name='auth_token_refresh'),
    path('api/auth/logout/', LogoutView.as_view(), name='auth_logout'),
    path('api/auth/profile/', UserProfileView.as_view(), name='auth_profile'),
    path('api/auth/profile/erasure-request/', UserErasureRequestView.as_view(), name='auth_erasure_request'),
    path('api/auth/me/export/', DataExportView.as_view(), name='auth_data_export'),
    path('api/auth/me/', AccountDeleteView.as_view(), name='auth_account_delete'),
    path('api/auth/profile/terminate-devices/', TerminateDevicesView.as_view(), name='auth_terminate_devices'),
    path('api/auth/otp/send/', SendOTPView.as_view(), name='auth_otp_send'),
    path('api/auth/otp/verify/', VerifyOTPView.as_view(), name='auth_otp_verify'),
    path('api/auth/magic-link/request/', MagicLinkRequestView.as_view(), name='auth_magic_request'),
    path('api/auth/magic-link/verify/', MagicLinkVerifyView.as_view(), name='auth_magic_verify'),
    # TOTP (authenticator-app) 2FA
    path('api/auth/2fa/setup/', TOTPSetupView.as_view(), name='auth_2fa_setup'),
    path('api/auth/2fa/verify/', TOTPVerifyView.as_view(), name='auth_2fa_verify'),
    path('api/auth/2fa/disable/', TOTPDisableView.as_view(), name='auth_2fa_disable'),
    path('api/auth/2fa/status/', TOTPStatusView.as_view(), name='auth_2fa_status'),
    path('api/auth/google/', GoogleLoginView.as_view(), name='auth_google'),
    path('api/auth/password/reset/request/', PasswordResetRequestView.as_view(), name='auth_password_reset_request'),
    path('api/auth/password/reset/confirm/', PasswordResetConfirmView.as_view(), name='auth_password_reset_confirm'),
    
    # Cart & Checkout
    path('api/cart/', CartViewSet.as_view({'get': 'retrieve'}), name='cart_retrieve'),
    path('api/cart/add/', CartViewSet.as_view({'post': 'add_item'}), name='cart_add'),
    path('api/cart/update/', CartViewSet.as_view({'post': 'update_item'}), name='cart_update'),
    path('api/cart/remove/', CartViewSet.as_view({'post': 'remove_item'}), name='cart_remove'),
    path('api/checkout/', CheckoutView.as_view(), name='checkout'),
    path('api/checkout/apply-coupon/', ApplyCouponView.as_view(), name='checkout_apply_coupon'),
    path('api/checkout/payment-intent/', CreatePaymentIntentView.as_view(), name='checkout_payment_intent'),
    path('api/webhooks/stripe/', StripeWebhookView.as_view(), name='webhook_stripe'),
    path('api/webhooks/razorpay/', RazorpayWebhookView.as_view(), name='webhook_razorpay'),
    path('api/webhooks/paypal/', PaypalWebhookView.as_view(), name='webhook_paypal'),
    path('api/webhooks/payment/<str:gateway_code>/', UnifiedPaymentWebhookView.as_view(), name='webhook_payment_unified'),
    path('api/orders/mine/', MyOrdersView.as_view(), name='my_orders'),
    path('api/orders/lookup/', PublicOrderDetailView.as_view(), name='public_order_detail'),
    path('api/admin/abandoned-checkouts/', AbandonedCheckoutsView.as_view(), name='abandoned_checkouts'),
    path('api/orders/<int:order_id>/refund/', RefundView.as_view(), name='order_refund'),

    # Public CMS endpoints
    path('api/policies/', PublishedPolicyPagesView.as_view(), name='public_policy_pages'),
    path('api/content-pages/published-slugs/', PublishedContentPageListView.as_view(), name='public_content_pages_slugs'),
    path('api/content-pages/<slug:slug>/', PublishedContentPageDetailView.as_view(), name='public_content_page_detail'),
    path('api/blog-posts/', PublishedBlogPostListView.as_view(), name='public_blog_posts'),
    path('api/blog-posts/<slug:slug>/', PublishedBlogPostDetailView.as_view(), name='public_blog_post_detail'),
    path('api/site-settings/<str:key>/', PublicSiteSettingView.as_view(), name='public_site_setting'),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
