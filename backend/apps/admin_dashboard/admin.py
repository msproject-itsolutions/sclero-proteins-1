from django.contrib import admin

from .models import FeatureToggle, SystemSetting, PaymentGateway


@admin.register(FeatureToggle)
class FeatureToggleAdmin(admin.ModelAdmin):
    list_display = ('module_name', 'region', 'is_enabled', 'updated_at')
    list_filter = ('is_enabled', 'region')
    search_fields = ('module_name',)


@admin.register(SystemSetting)
class SystemSettingAdmin(admin.ModelAdmin):
    list_display = ('key', 'description', 'updated_at')
    search_fields = ('key',)


@admin.register(PaymentGateway)
class PaymentGatewayAdmin(admin.ModelAdmin):
    list_display = ('display_name', 'code', 'region', 'is_enabled', 'mode', 'is_configured', 'sort_order')
    list_filter = ('is_enabled', 'mode', 'region', 'code')
    list_editable = ('is_enabled', 'sort_order')
    search_fields = ('display_name', 'code')
