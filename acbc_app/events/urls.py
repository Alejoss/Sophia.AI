from django.urls import path

from events import views

app_name = "events"

urlpatterns = [
    path('', views.EventList.as_view(), name='event-list'),
    path('<int:pk>/', views.EventDetail.as_view(), name='event-detail'),
]