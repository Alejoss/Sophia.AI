from django.urls import path
from .views import (
    BookmarkListView,
    BookmarkDetailView,
    BookmarkStatusView,
    BookmarkToggleView,
    BookmarkCollectionsView
)

urlpatterns = [
    # Check bookmark status (most specific)
    path('check_status/', BookmarkStatusView.as_view(), name='bookmark-check-status'),
    
    # Toggle bookmark
    path('toggle/', BookmarkToggleView.as_view(), name='bookmark-toggle'),
    
    # Get collections
    path('collections/', BookmarkCollectionsView.as_view(), name='bookmark-collections'),
    
    # Individual bookmark operations
    path('<int:pk>/', BookmarkDetailView.as_view(), name='bookmark-detail'),
    
    # List and create bookmarks (least specific)
    path('', BookmarkListView.as_view(), name='bookmark-list'),
] 