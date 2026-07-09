from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GlossaryViewSet, AdminGlossaryViewSet, GeneralFAQViewSet, AdminGeneralFAQViewSet

router = DefaultRouter()
router.register(r'glossary', GlossaryViewSet, basename='glossary')
router.register(r'admin/glossary', AdminGlossaryViewSet, basename='admin_glossary')
router.register(r'faqs', GeneralFAQViewSet, basename='faqs')
router.register(r'admin/faqs', AdminGeneralFAQViewSet, basename='admin_faqs')

urlpatterns = [
    path('', include(router.urls)),
]
