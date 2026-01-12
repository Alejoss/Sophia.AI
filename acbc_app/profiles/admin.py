from django.contrib import admin
from profiles.models import Profile, UserNodeCompletion, CryptoCurrency, AcceptedCrypto
import os


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'total_points', 'featured_badge', 'is_teacher')
    list_filter = ('is_teacher',)
    search_fields = ('user__username', 'user__email')
    raw_id_fields = ('featured_badge',)


admin.site.register(UserNodeCompletion)

@admin.register(CryptoCurrency)
class CryptoCurrencyAdmin(admin.ModelAdmin):
    list_display = ('name', 'code', 'thumbnail_preview')
    search_fields = ('name', 'code')
    ordering = ('name',)
    
    def thumbnail_preview(self, obj):
        if obj.thumbnail:
            file_extension = os.path.splitext(obj.thumbnail.name)[1].lower()
            if file_extension == '.svg':
                # For SVG files, show a link to view the file
                return f'<a href="{obj.thumbnail.url}" target="_blank">View SVG</a>'
            else:
                # For image files, show the image
                return f'<img src="{obj.thumbnail.url}" style="max-height: 50px; max-width: 50px;" />'
        return 'No thumbnail'
    thumbnail_preview.short_description = 'Thumbnail'
    thumbnail_preview.allow_tags = True

@admin.register(AcceptedCrypto)
class AcceptedCryptoAdmin(admin.ModelAdmin):
    list_display = ('user', 'crypto', 'address', 'deleted')
    list_filter = ('deleted', 'crypto')
    search_fields = ('user__username', 'crypto__name', 'address')
    ordering = ('user__username', 'crypto__name')
