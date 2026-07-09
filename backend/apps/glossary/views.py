from rest_framework import viewsets
from rest_framework.permissions import AllowAny
from apps.users.permissions import require_permission
from .models import GlossaryTerm, GeneralFAQ
from .serializers import GlossaryTermSerializer, GeneralFAQSerializer

class GlossaryViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Public API endpoint to list all glossary terms.
    Accessible by anyone (no authentication required).
    """
    queryset = GlossaryTerm.objects.all().order_by('term')
    serializer_class = GlossaryTermSerializer
    permission_classes = [AllowAny]
    pagination_class = None  # Return all terms in a single array for frontend caching


class AdminGlossaryViewSet(viewsets.ModelViewSet):
    """
    Admin API endpoint to CRUD glossary terms.
    Requires 'settings.manage' permission.
    """
    queryset = GlossaryTerm.objects.all().order_by('term')
    serializer_class = GlossaryTermSerializer
    permission_classes = [require_permission('settings.manage')]


class GeneralFAQViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Public API endpoint to list active General FAQs.
    Accessible by anyone (no authentication required).
    """
    queryset = GeneralFAQ.objects.filter(is_active=True).order_by('category', 'display_order', 'question')
    serializer_class = GeneralFAQSerializer
    permission_classes = [AllowAny]
    pagination_class = None  # Return all FAQs in a single array for easy category grouping on the client


class AdminGeneralFAQViewSet(viewsets.ModelViewSet):
    """
    Admin API endpoint to CRUD General FAQs.
    Requires 'settings.manage' permission.
    """
    queryset = GeneralFAQ.objects.all().order_by('category', 'display_order', 'question')
    serializer_class = GeneralFAQSerializer
    permission_classes = [require_permission('settings.manage')]
