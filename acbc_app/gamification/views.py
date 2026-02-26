from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User

from .models import Badge, UserBadge
from .serializers import BadgeSerializer, UserBadgeSerializer, UserBadgeSummarySerializer
from . import rules
from utils.logging_utils import gamification_logger, log_error, log_business_event


class BadgeViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing badges.
    List all active badges or retrieve a specific badge.
    """
    queryset = Badge.objects.filter(is_active=True)
    serializer_class = BadgeSerializer
    permission_classes = []  # Public read access

    @action(detail=True, methods=['post'], permission_classes=[IsAdminUser])
    def grant(self, request, pk=None):
        """
        Manually grant a badge to a user (admin only).
        POST /api/gamification/badges/{id}/grant/
        Body: {"user_id": <user_id>}
        """
        badge = self.get_object()
        user_id = request.data.get('user_id')
        
        if not user_id:
            return Response(
                {'error': 'user_id is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Award badge using rules engine
        user_badge = rules.award_badge(user, badge.code)
        
        if user_badge:
            serializer = UserBadgeSerializer(user_badge)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        else:
            return Response(
                {'error': 'User already has this badge or badge is inactive'}, 
                status=status.HTTP_400_BAD_REQUEST
            )


class UserBadgeViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for viewing user badges.
    """
    serializer_class = UserBadgeSummarySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Return badges for the requested user (user_id via query param)."""
        user_id = self.request.query_params.get('user_id') or self.kwargs.get('user_id')
        if user_id is not None:
            try:
                user_id = int(user_id)
            except (TypeError, ValueError):
                user_id = None

        if user_id:
            # View badges of a specific user (public)
            user = get_object_or_404(User, id=user_id)
            return UserBadge.objects.filter(user=user).select_related('badge', 'user')
        else:
            # View own badges
            return UserBadge.objects.filter(user=self.request.user).select_related('badge', 'user')

    @action(detail=False, methods=['get'])
    def my_badges(self, request):
        """Get badges of the authenticated user."""
        try:
            badges = UserBadge.objects.filter(user=request.user).select_related('badge', 'user')
            serializer = self.get_serializer(badges, many=True)
            
            # Get total points (use get_or_create to handle edge cases)
            from profiles.models import Profile
            profile, _ = Profile.objects.get_or_create(user=request.user)
            
            gamification_logger.debug(
                f"Retrieved badges for user {request.user.id}",
                extra={'user_id': request.user.id, 'badge_count': badges.count()}
            )
            
            return Response({
                'badges': serializer.data,
                'total_points': profile.total_points,
                'badge_count': badges.count()
            })
        except Exception as e:
            log_error(e, f"Error retrieving badges for user {request.user.id}", request.user.id)
            return Response(
                {'error': 'Error retrieving badges'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserPointsView(viewsets.ViewSet):
    """
    ViewSet for user points.
    """
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=['get'])
    def my_points(self, request):
        """Get total points of the authenticated user."""
        from profiles.models import Profile
        profile, _ = Profile.objects.get_or_create(user=request.user)
        
        return Response({
            'total_points': profile.total_points,
            'user_id': request.user.id,
            'username': request.user.username
        })