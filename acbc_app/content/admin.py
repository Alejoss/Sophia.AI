from django.contrib import admin

from .models import Library, Group, File


@admin.register(Library)
class LibraryAdmin(admin.ModelAdmin):
    list_display = ['name', 'user']
    list_filter = ['user']
    search_fields = ['name', 'user__username']


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ['name', 'library']
    list_filter = ['library']
    search_fields = ['name']


@admin.register(File)
class FileAdmin(admin.ModelAdmin):
    list_display = ['title', 'group', 'uploaded_at']
    list_filter = ['group', 'uploaded_at']
    search_fields = ['title']
    date_hierarchy = 'uploaded_at'
