from django.contrib import admin

from content.models import Library, Collection, FileDetails, Content, ContentProfile, ContentTranscript, Topic, Publication, TopicCreationRequest


@admin.register(Library)
class LibraryAdmin(admin.ModelAdmin):
    list_display = ['name', 'user']
    list_filter = ['user']
    search_fields = ['name', 'user__username']


@admin.register(Collection)
class GroupAdmin(admin.ModelAdmin):
    list_display = ['name', 'library']
    list_filter = ['library']
    search_fields = ['name']


@admin.register(Content)
class ContentAdmin(admin.ModelAdmin):
    list_display = ['id', 'media_type', 'uploaded_by']
    list_filter = ['media_type']
    search_fields = ['id']


@admin.register(ContentProfile)
class ContentProfileAdmin(admin.ModelAdmin):
    list_display = ['title', 'author', 'user', 'collection']
    list_filter = ['user', 'collection']
    search_fields = ['title', 'author']


@admin.register(FileDetails)
class FileDetailsAdmin(admin.ModelAdmin):
    list_display = ['id', 'file', 'uploaded_at']
    list_filter = ['uploaded_at']
    search_fields = ['file']
    date_hierarchy = 'uploaded_at'


@admin.register(ContentTranscript)
class ContentTranscriptAdmin(admin.ModelAdmin):
    list_display = [
        'id', 'content', 'format', 'language', 'text_length', 'text_hash', 'updated_at',
    ]
    list_filter = ['format', 'language', 'updated_at']
    search_fields = ['content__original_title', 'processed_plain', 'text_hash']
    readonly_fields = [
        'segments',
        'obsidian_frontmatter',
        'text_length',
        'text_hash',
        'created_at',
        'updated_at',
    ]
    date_hierarchy = 'updated_at'


@admin.register(Topic)
class TopicAdmin(admin.ModelAdmin):
    list_display = ['id', 'title', 'creator', 'is_public', 'created_at', 'updated_at']
    list_filter = ['is_public', 'creator', 'created_at']
    search_fields = ['title', 'description', 'creator__username']
    filter_horizontal = ['moderators', 'related_topics']
    raw_id_fields = ['creator']
    readonly_fields = ['topic_image_thumbnail', 'created_at', 'updated_at']
    fieldsets = (
        ('Información básica', {
            'fields': ('title', 'description', 'creator', 'is_public'),
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


