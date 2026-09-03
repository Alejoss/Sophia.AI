from django.contrib import admin, messages

from content.anchor_request_service import (
    AnchorRequestError,
    approve_anchor_request,
    reject_anchor_request,
)
from content.models import (
    Library,
    Collection,
    FileDetails,
    Content,
    ContentProfile,
    ContentTranscript,
    TranscriptAnchor,
    TranscriptAnchorRequest,
    Topic,
    Publication,
    TopicCreationRequest,
    TopicChatQuery,
    TopicPurchase,
)


@admin.register(Library)
class LibraryAdmin(admin.ModelAdmin):
    list_display = ['name', 'user']
    list_filter = ['user']
    search_fields = ['name', 'user__username']


@admin.register(Collection)
class GroupAdmin(admin.ModelAdmin):
    list_display = ['name', 'library', 'is_public']
    list_filter = ['library', 'is_public']
    search_fields = ['name', 'description']


@admin.register(Content)
class ContentAdmin(admin.ModelAdmin):
    list_display = ['id', 'media_type', 'uploaded_by']
    list_filter = ['media_type']
    search_fields = ['id']


@admin.register(ContentProfile)
class ContentProfileAdmin(admin.ModelAdmin):
    list_display = ['title', 'author', 'user', 'collection', 'is_visible', 'is_featured', 'featured_order']
    list_filter = ['user', 'collection', 'is_visible', 'is_featured']
    search_fields = ['title', 'author']
    list_editable = ['is_featured', 'featured_order']


@admin.register(FileDetails)
class FileDetailsAdmin(admin.ModelAdmin):
    list_display = ['id', 'file', 'uploaded_at']
    list_filter = ['uploaded_at']
    search_fields = ['file']
    date_hierarchy = 'uploaded_at'


@admin.register(ContentTranscript)
class ContentTranscriptAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'content',
        'format',
        'language',
        'text_length',
        'text_hash',
        'embedding_status',
        'chunk_count',
        'updated_at',
    ]
    list_filter = ['format', 'language', 'embedding_status', 'updated_at']
    search_fields = [
        'content__original_title',
        'processed_plain',
        'text_hash',
        'embedded_text_hash',
    ]
    readonly_fields = [
        'segments',
        'obsidian_frontmatter',
        'text_length',
        'text_hash',
        'embedded_text_hash',
        'embedded_at',
        'created_at',
        'updated_at',
    ]
    date_hierarchy = 'updated_at'


@admin.register(TranscriptAnchor)
class TranscriptAnchorAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'content',
        'text_hash_short',
        'status',
        'btc_network',
        'btc_txid',
        'ipfs_cid',
        'anchored_by',
        'created_at',
    ]
    list_filter = ['status', 'btc_network', 'created_at']
    search_fields = [
        'text_hash',
        'btc_txid',
        'ipfs_cid',
        'content__original_title',
    ]
    raw_id_fields = ['content', 'anchored_by']
    readonly_fields = [
        'btc_op_return_hex',
        'btc_confirmed_at',
        'created_at',
        'updated_at',
    ]
    date_hierarchy = 'created_at'

    @admin.display(description='text_hash')
    def text_hash_short(self, obj):
        if not obj.text_hash:
            return ''
        return f'{obj.text_hash[:12]}…'


@admin.register(TranscriptAnchorRequest)
class TranscriptAnchorRequestAdmin(admin.ModelAdmin):
    list_display = [
        'id',
        'content',
        'requester',
        'text_hash_short',
        'status',
        'price_amount',
        'anchor',
        'created_at',
        'reviewed_at',
    ]
    list_filter = ['status', 'created_at']
    search_fields = [
        'text_hash',
        'requester__username',
        'content__original_title',
        'review_note',
    ]
    raw_id_fields = ['content', 'requester', 'anchor', 'reviewed_by']
    readonly_fields = ['created_at', 'updated_at', 'reviewed_at']
    actions = ['approve_selected', 'reject_selected']
    date_hierarchy = 'created_at'

    @admin.display(description='text_hash')
    def text_hash_short(self, obj):
        if not obj.text_hash:
            return ''
        return f'{obj.text_hash[:12]}…'

    @admin.action(description='Aprobar y emitir anclaje Bitcoin')
    def approve_selected(self, request, queryset):
        ok = 0
        for req in queryset:
            try:
                approve_anchor_request(req, admin_user=request.user)
                ok += 1
            except AnchorRequestError as exc:
                self.message_user(request, f'#{req.pk}: {exc}', level=messages.WARNING)
        if ok:
            self.message_user(request, f'{ok} solicitud(es) aprobada(s).', level=messages.SUCCESS)

    @admin.action(description='Rechazar (sin reembolso automático)')
    def reject_selected(self, request, queryset):
        ok = 0
        for req in queryset:
            try:
                reject_anchor_request(req, admin_user=request.user, note='Rechazado desde admin')
                ok += 1
            except AnchorRequestError as exc:
                self.message_user(request, f'#{req.pk}: {exc}', level=messages.WARNING)
        if ok:
            self.message_user(request, f'{ok} solicitud(es) rechazada(s).', level=messages.SUCCESS)


@admin.register(Topic)
class TopicAdmin(admin.ModelAdmin):
    list_display = ['id', 'title', 'creator', 'is_public', 'chat_enabled', 'reference_price', 'bch_direct_enabled', 'created_at', 'updated_at']
    list_filter = ['is_public', 'chat_enabled', 'bch_direct_enabled', 'creator', 'created_at']
    list_editable = ['chat_enabled', 'bch_direct_enabled']
    search_fields = ['title', 'description', 'creator__username']
    filter_horizontal = ['moderators', 'related_topics']
    raw_id_fields = ['creator']
    readonly_fields = ['topic_image_thumbnail', 'created_at', 'updated_at']
    fieldsets = (
        ('Información básica', {
            'fields': ('title', 'description', 'creator', 'is_public', 'chat_enabled', 'reference_price', 'bch_direct_enabled'),
        }),
        ('Imagen de portada', {
            'fields': (
                'topic_image',
                'topic_image_thumbnail',
                'topic_image_focal_x',
                'topic_image_focal_y',
            ),
        }),
        ('Moderación y relaciones', {
            'fields': ('moderators', 'related_topics'),
        }),
        ('Fechas', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',),
        }),
    )


@admin.register(TopicChatQuery)
class TopicChatQueryAdmin(admin.ModelAdmin):
    list_display = ['id', 'topic', 'user', 'created_at']
    list_filter = ['created_at']
    search_fields = ['question', 'answer', 'user__username', 'topic__title']
    raw_id_fields = ['topic', 'user']
    readonly_fields = ['created_at']
    date_hierarchy = 'created_at'


@admin.register(TopicCreationRequest)
class TopicCreationRequestAdmin(admin.ModelAdmin):
    list_display = ['id', 'proposed_title', 'requested_by', 'status', 'created_at']
    list_filter = ['status', 'created_at']
    search_fields = ['proposed_title', 'approved_title', 'requested_by__username']
    readonly_fields = ['created_at', 'updated_at', 'reviewed_at']


@admin.register(Publication)
class PublicationAdmin(admin.ModelAdmin):
    list_display = ['id', 'content_profile', 'status', 'published_at']
    list_filter = ['status', 'published_at']
    search_fields = ['text_content']
    date_hierarchy = 'published_at'
    readonly_fields = ['published_at', 'updated_at']


@admin.register(TopicPurchase)
class TopicPurchaseAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'topic', 'payment_status', 'price_amount', 'created_at')
    list_filter = ('payment_status', 'created_at')
    search_fields = ('user__username', 'topic__title')
    raw_id_fields = ('user', 'topic')


