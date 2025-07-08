from django.urls import path

from events import views

app_name = "events"

urlpatterns = [
    path('', views.EventList.as_view(), name='event-list'),
    path('<int:pk>/', views.EventDetail.as_view(), name='event-detail'),
    
    # Event registration endpoints
    path('<int:event_id>/register/', views.EventRegistrationView.as_view(), name='event-register'),
    path('<int:event_id>/participants/', views.EventParticipantsView.as_view(), name='event-participants'),
    
    # User event endpoints
    path('my-registrations/', views.UserEventRegistrationsView.as_view(), name='user-registrations'),
    path('my-events/', views.UserCreatedEventsView.as_view(), name='user-created-events'),
    
    # Participant management endpoints
    path('<int:event_id>/participants/<int:registration_id>/status/', views.EventParticipantStatusView.as_view(), name='participant-status'),
]