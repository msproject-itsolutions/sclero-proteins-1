from django.contrib import admin

from .models import User, UserAddress, Role


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ('name', 'is_system', 'updated_at')
    list_filter = ('is_system',)
    search_fields = ('name',)


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('email', 'first_name', 'last_name', 'is_staff', 'is_active')
    list_filter = ('is_staff', 'is_active')
    search_fields = ('email', 'first_name', 'last_name')
    filter_horizontal = ('roles',)


@admin.register(UserAddress)
class UserAddressAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'city', 'country', 'address_type', 'is_default')
    list_filter = ('address_type', 'country')
