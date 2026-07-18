from django.contrib import admin

from book_clubs.models import (
    BookClub,
    BookClubEvent,
    BookClubMembership,
    DiscussionQuestion,
)
from knowledge_paths.models import KnowledgePath


class BookClubMembershipInline(admin.TabularInline):
    model = BookClubMembership
    extra = 0
    raw_id_fields = ('user',)


class BookClubEventInline(admin.TabularInline):
    model = BookClubEvent
    extra = 0
    raw_id_fields = ('event',)


class DiscussionQuestionInline(admin.TabularInline):
    model = DiscussionQuestion
    extra = 0
    fields = ('body', 'node', 'order', 'status', 'opens_at', 'closes_at')
    raw_id_fields = ('node', 'event')


@admin.register(BookClub)
class BookClubAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug', 'status', 'starts_at', 'ends_at', 'knowledge_path', 'created_by')
    list_filter = ('status',)
    prepopulated_fields = {'slug': ('title',)}
    search_fields = ('title', 'slug', 'description')
    raw_id_fields = ('knowledge_path', 'topic')
    readonly_fields = ('created_by', 'created_at', 'updated_at')
    inlines = [BookClubMembershipInline, BookClubEventInline, DiscussionQuestionInline]

    def save_model(self, request, obj, form, change):
        if not obj.created_by_id:
            obj.created_by = request.user
        if not obj.knowledge_path_id:
            obj.knowledge_path = KnowledgePath.objects.create(
                title=obj.title,
                description=obj.description or '',
                author=request.user,
                is_visible=False,
            )
        super().save_model(request, obj, form, change)
        if not change:
            BookClubMembership.objects.get_or_create(
                book_club=obj,
                user=request.user,
            )


@admin.register(BookClubMembership)
class BookClubMembershipAdmin(admin.ModelAdmin):
    list_display = ('user', 'book_club', 'joined_at', 'intro_updated_at')
    raw_id_fields = ('user', 'book_club')


@admin.register(BookClubEvent)
class BookClubEventAdmin(admin.ModelAdmin):
    list_display = ('book_club', 'event', 'created_at')
    raw_id_fields = ('book_club', 'event')


@admin.register(DiscussionQuestion)
class DiscussionQuestionAdmin(admin.ModelAdmin):
    list_display = ('id', 'book_club', 'status', 'order', 'node', 'opens_at', 'closes_at')
    list_filter = ('status',)
    search_fields = ('body',)
    raw_id_fields = ('book_club', 'node', 'event', 'created_by')
