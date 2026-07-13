from django.contrib import admin

from book_clubs.models import (
    BookClub,
    BookClubEvent,
    BookClubMembership,
    DiscussionQuestion,
)


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
    list_display = ('title', 'slug', 'status', 'starts_at', 'ends_at', 'knowledge_path')
    list_filter = ('status',)
    prepopulated_fields = {'slug': ('title',)}
    search_fields = ('title', 'slug', 'description')
    raw_id_fields = ('knowledge_path', 'topic', 'created_by')
    inlines = [BookClubMembershipInline, BookClubEventInline, DiscussionQuestionInline]


@admin.register(BookClubMembership)
class BookClubMembershipAdmin(admin.ModelAdmin):
    list_display = ('user', 'book_club', 'role', 'joined_at')
    list_filter = ('role',)
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
