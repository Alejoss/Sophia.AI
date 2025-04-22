from django.contrib import admin
from django.contrib.contenttypes.admin import GenericTabularInline
from .models import Comment

@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ('id', 'author', 'content_type', 'object_id', 'topic', 'created_at', 'body_preview')
    list_filter = ('content_type', 'created_at', 'author')
    search_fields = ('body', 'author__username')
    raw_id_fields = ('author', 'parent', 'topic')
    readonly_fields = ('created_at',)
    date_hierarchy = 'created_at'

    def body_preview(self, obj):
        """Returns truncated body text for list display"""
        return obj.body[:100] + '...' if len(obj.body) > 100 else obj.body
    body_preview.short_description = 'Comment'

    def get_queryset(self, request):
        """Optimize query by prefetching related fields"""
        return super().get_queryset(request).select_related(
            'author',
            'content_type',
            'topic',
            'parent'
        )
