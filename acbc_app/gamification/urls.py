from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import BadgeViewSet, UserBadgeViewSet, UserPointsView

router = DefaultRouter()
router.register(r'badges', BadgeViewSet, basename='badge')
router.register(r'user-badges', UserBadgeViewSet, basename='user-badge')
router.register(r'points', UserPointsView, basename='points')

urlpatterns = [
    path('', include(router.urls)),
]