from django.contrib import admin
from events.models import Event, EventRegistration

@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ('title', 'owner', 'event_type', 'date_start', 'date_created')
    list_filter = ('event_type', 'date_created', 'owner')
    search_fields = ('title', 'description', 'owner__username')
    readonly_fields = ('date_created',)

@admin.register(EventRegistration)
class EventRegistrationAdmin(admin.ModelAdmin):
    list_display = ('user', 'event', 'registration_status', 'payment_status', 'registered_at')
    list_filter = ('registration_status', 'payment_status', 'registered_at')
    search_fields = ('user__username', 'event__title')
    readonly_fields = ('registered_at',)

