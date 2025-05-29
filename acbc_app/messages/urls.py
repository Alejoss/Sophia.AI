from django.urls import path
from . import views

urlpatterns = [
    path('threads/', views.ThreadListView.as_view(), name='thread-list'),
    path('threads/<int:user_id>/', views.ThreadDetailView.as_view(), name='thread-detail'),
    path('threads/<int:thread_id>/messages/', views.MessageListView.as_view(), name='message-list'),
    path('messages/<int:pk>/delete/', views.MessageDeleteView.as_view(), name='message-delete'),
]
