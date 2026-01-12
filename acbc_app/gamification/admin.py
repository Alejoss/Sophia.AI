from django.contrib import admin
from .models import Badge, UserBadge


@admin.register(Badge)
class BadgeAdmin(admin.ModelAdmin):
    list_display = ('code', 'name', 'category', 'points_value', 'is_active', 'created_at')
    list_filter = ('category', 'is_active', 'created_at')
    search_fields = ('code', 'name', 'description')
    readonly_fields = ('created_at',)


@admin.register(UserBadge)
class UserBadgeAdmin(admin.ModelAdmin):
    list_display = ('user', 'badge', 'points_earned', 'earned_at')
    list_filter = ('badge', 'earned_at')
    search_fields = ('user__username', 'badge__name', 'badge__code')
    readonly_fields = ('earned_at',)
    raw_id_fields = ('user', 'badge')