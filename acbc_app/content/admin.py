from django.contrib import admin

from content.models import Library, Collection, FileDetails, Content, ContentProfile, Topic, Publication


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

@admin.register(Topic)
class TopicAdmin(admin.ModelAdmin):
    list_display = ['id', 'title', 'creator']
    list_filter = ['creator']
    search_fields = ['title']


@admin.register(Publication)
class PublicationAdmin(admin.ModelAdmin):
    list_display = ['id', 'content_profile', 'status', 'published_at']
    list_filter = ['status', 'published_at']
    search_fields = ['text_content']
    date_hierarchy = 'published_at'
    readonly_fields = ['published_at', 'updated_at']


