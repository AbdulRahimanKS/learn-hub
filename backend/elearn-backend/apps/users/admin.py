from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.translation import gettext_lazy as _
from .models import User, Profile, UserType

class CustomUserAdmin(UserAdmin):
    """
    Custom User Admin to handle the custom User model fields.
    """
    ordering = ('email',)
    list_display = ('email', 'fullname', 'user_type', 'is_staff', 'is_active')
    search_fields = ('email', 'fullname', 'user_code')
    readonly_fields = ('user_code', 'created_at', 'updated_at')

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        (_('Personal Info'), {'fields': ('fullname', 'user_code', 'phone_number_code', 'contact_number')}),
        (_('Role'), {'fields': ('user_type',)}),
        (_('Permissions'), {
            'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'),
        }),
        (_('Important dates'), {'fields': ('last_login', 'created_at', 'updated_at')}),
    )
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('email', 'password', 'fullname'),
        }),
    )

from django.apps import apps
from django.contrib.admin.sites import AlreadyRegistered

# custom admin configurations
custom_admins = {
    User: CustomUserAdmin,
}

# Auto-register all models in this app
app_config = apps.get_app_config('users')
for model in app_config.get_models():
    try:
        if model in custom_admins:
            admin.site.register(model, custom_admins[model])
        else:
            admin.site.register(model)
    except AlreadyRegistered:
        pass
