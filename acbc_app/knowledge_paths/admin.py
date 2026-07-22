from django.contrib import admin
from .models import KnowledgePath, KnowledgePathPurchase, Node


@admin.register(KnowledgePath)
class KnowledgePathAdmin(admin.ModelAdmin):
    list_display = (
        'title',
        'author',
        'reference_price',
        'is_visible',
        'certificates_enabled',
        'created_at',
        'updated_at',
        'vote_count',
    )
    search_fields = ('title', 'description', 'author__username')
    list_filter = ('is_visible', 'certificates_enabled', 'created_at', 'updated_at')
    readonly_fields = ('vote_count',)

    def vote_count(self, obj):
        return obj.vote_count
    vote_count.short_description = 'Votes'


@admin.register(KnowledgePathPurchase)
class KnowledgePathPurchaseAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'knowledge_path', 'payment_status', 'price_amount', 'created_at')
    list_filter = ('payment_status', 'created_at')
    search_fields = ('user__username', 'knowledge_path__title')


@admin.register(Node)
class NodeAdmin(admin.ModelAdmin):
    list_display = ('title', 'knowledge_path', 'media_type', 'created_at')
    list_filter = ('media_type', 'created_at')
    search_fields = ('title', 'description', 'knowledge_path__title')
