from django.contrib import admin
from events.models import Event, EventRegistration, FeaturedEvent

@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ('title', 'owner', 'event_type', 'is_visible', 'date_start', 'date_created')
    list_filter = ('event_type', 'is_visible', 'date_created', 'owner')
    search_fields = ('title', 'description', 'owner__username')
    readonly_fields = ('date_created',)

@admin.register(FeaturedEvent)
class FeaturedEventAdmin(admin.ModelAdmin):
    list_display = ('event', 'is_active', 'updated_at')
    list_filter = ('is_active',)
    list_editable = ('is_active',)
    autocomplete_fields = ('event',)
    readonly_fields = ('created_at', 'updated_at')


@admin.register(EventRegistration)
class EventRegistrationAdmin(admin.ModelAdmin):
    list_display = ('user', 'event', 'registration_status', 'payment_status', 'registered_at')
    list_filter = ('registration_status', 'payment_status', 'registered_at')
    search_fields = ('user__username', 'event__title')
    readonly_fields = ('registered_at',)

