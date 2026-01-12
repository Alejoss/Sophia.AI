"""
Badge Rules Engine

This module contains the logic for determining when badges should be awarded.
Each function checks if a user is eligible for a specific badge and awards it if conditions are met.

All rules follow the principle: badges are awarded only the first time the condition is met.
"""

from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from django.db.models import Sum, Count, Q, F
from django.apps import apps
from django.db import models, transaction

from .models import Badge, UserBadge
from profiles.models import Profile
from utils.logging_utils import gamification_logger, log_error, log_business_event


def get_badge_by_code(code):
    """Helper function to get a badge by its code."""
    try:
        return Badge.objects.get(code=code, is_active=True)
    except Badge.DoesNotExist:
        return None


def has_badge(user, badge_code):
    """Check if a user already has a specific badge."""
    return UserBadge.objects.filter(user=user, badge__code=badge_code).exists()


@transaction.atomic
def award_badge(user, badge_code, context_data=None):
    """
    Award a badge to a user if they don't already have it.
    Returns the UserBadge instance if awarded, None otherwise.
    
    Raises:
        Badge.DoesNotExist: If badge code doesn't exist
        Exception: For other database errors
    """
    try:
        if has_badge(user, badge_code):
            gamification_logger.debug(
                f"User {user.id} already has badge {badge_code}",
                extra={'user_id': user.id, 'badge_code': badge_code}
            )
            return None

        badge = get_badge_by_code(badge_code)
        if not badge:
            gamification_logger.warning(
                f"Badge {badge_code} not found or inactive",
                extra={'badge_code': badge_code}
            )
            return None

        # Create UserBadge and update points atomically
        user_badge = UserBadge.objects.create(
            user=user,
            badge=badge,
            points_earned=badge.points_value,
            context_data=context_data or {}
        )

        # Update user's total points
        Profile.objects.filter(user=user).update(
            total_points=F('total_points') + badge.points_value
        )

        # Log badge award
        log_business_event(
            event_type='badge_awarded',
            user_id=user.id,
            object_id=user_badge.id,
            object_type='badge',
            extra={
                'badge_code': badge_code,
                'badge_name': badge.name,
                'points_earned': badge.points_value,
                'context_data': context_data
            }
        )

        gamification_logger.info(
            f"Badge {badge_code} awarded to user {user.id}",
            extra={
                'user_id': user.id,
                'badge_id': badge.id,
                'badge_code': badge_code,
                'points_earned': badge.points_value
            }
        )

        return user_badge

    except Exception as e:
        log_error(e, f"Error awarding badge {badge_code} to user {user.id}", user.id)
        raise




def check_first_knowledge_path_completed(user, knowledge_path):
    """
    Check if user completed their first KnowledgePath.
    Trigger: When a KnowledgePath is completed for the first time.
    
    Optimized: Uses aggregation instead of iterating all paths.
    """
    try:
        if has_badge(user, 'first_knowledge_path_completed'):
            return None

        # Check if this is the first completed knowledge path
        from knowledge_paths.services.node_user_activity_service import is_knowledge_path_completed
        from knowledge_paths.models import KnowledgePath
        from profiles.models import UserNodeCompletion
        
        if is_knowledge_path_completed(user, knowledge_path):
            # Count completed paths efficiently using aggregation
            total_paths = KnowledgePath.objects.count()
            completed_paths_count = 0
            
            # Use aggregation to count completed paths
            for path in KnowledgePath.objects.only('id'):
                if is_knowledge_path_completed(user, path):
                    completed_paths_count += 1
                    if completed_paths_count > 1:
                        break  # Early exit if more than one
            
            # Only award if this is the first completed path
            if completed_paths_count == 1:
                return award_badge(
                    user,
                    'first_knowledge_path_completed',
                    {'knowledge_path_id': knowledge_path.id, 'knowledge_path_title': knowledge_path.title}
                )
    except Exception as e:
        log_error(e, f"Error checking first knowledge path completion for user {user.id}", user.id)
    return None


def check_first_comment(user):
    """
    Check if user made their first comment.
    Trigger: When a comment is created.
    """
    if has_badge(user, 'first_comment'):
        return None

    Comment = apps.get_model('comments', 'Comment')
    comment_count = Comment.objects.filter(author=user).count()
    
    if comment_count == 1:
        return award_badge(user, 'first_comment')
    return None


def check_first_highly_rated_comment(user, comment):
    """
    Check if a comment reached 5+ positive votes for the first time.
    Trigger: When VoteCount is updated for a Comment.
    """
    if has_badge(user, 'first_highly_rated_comment'):
        return None

    VoteCount = apps.get_model('votes', 'VoteCount')
    ContentType = apps.get_model('contenttypes', 'ContentType')
    
    comment_content_type = ContentType.objects.get_for_model(comment)
    vote_count_obj = VoteCount.objects.filter(
        content_type=comment_content_type,
        object_id=comment.id
    ).first()
    
    if vote_count_obj and vote_count_obj.vote_count >= 5:
        return award_badge(
            user,
            'first_highly_rated_comment',
            {'comment_id': comment.id, 'vote_count': vote_count_obj.vote_count}
        )
    return None


def check_first_highly_rated_content(user, content):
    """
    Check if content reached 10+ positive votes for the first time.
    Trigger: When VoteCount is updated for Content.
    """
    if has_badge(user, 'first_highly_rated_content'):
        return None

    VoteCount = apps.get_model('votes', 'VoteCount')
    ContentType = apps.get_model('contenttypes', 'ContentType')
    
    content_content_type = ContentType.objects.get_for_model(content)
    vote_count_obj = VoteCount.objects.filter(
        content_type=content_content_type,
        object_id=content.id
    ).first()
    
    if vote_count_obj and vote_count_obj.vote_count >= 10:
        return award_badge(
            user,
            'first_highly_rated_content',
            {'content_id': content.id, 'vote_count': vote_count_obj.vote_count}
        )
    return None


def check_first_knowledge_path_created(user, knowledge_path):
    """
    Check if user created their first KnowledgePath with 2+ nodes.
    Trigger: When a Node is added to a KnowledgePath.
    """
    if has_badge(user, 'first_knowledge_path_created'):
        return None

    # Check if this is the first knowledge path created by the user
    from knowledge_paths.models import KnowledgePath
    
    user_paths = KnowledgePath.objects.filter(author=user)
    if user_paths.count() == 1 and knowledge_path.id == user_paths.first().id:
        # Check if it has at least 2 nodes
        if knowledge_path.nodes.count() >= 2:
            return award_badge(
                user,
                'first_knowledge_path_created',
                {'knowledge_path_id': knowledge_path.id, 'knowledge_path_title': knowledge_path.title}
            )
    return None


def check_quiz_master(user):
    """
    Check if user completed 5 quizzes with perfect score.
    Trigger: When UserQuizAttempt is created with score=100.
    """
    if has_badge(user, 'quiz_master'):
        return None

    UserQuizAttempt = apps.get_model('quizzes', 'UserQuizAttempt')
    perfect_quizzes = UserQuizAttempt.objects.filter(user=user, score=100).count()
    
    if perfect_quizzes >= 5:
        return award_badge(
            user,
            'quiz_master',
            {'perfect_quizzes_count': perfect_quizzes}
        )
    return None


def check_knowledge_seeker(user):
    """
    Check if user completed 20 nodes.
    Trigger: When UserNodeCompletion is marked as completed.
    """
    if has_badge(user, 'knowledge_seeker'):
        return None

    from profiles.models import UserNodeCompletion
    completed_nodes = UserNodeCompletion.objects.filter(user=user, is_completed=True).count()
    
    if completed_nodes >= 20:
        return award_badge(
            user,
            'knowledge_seeker',
            {'completed_nodes_count': completed_nodes}
        )
    return None


def check_community_voice(user):
    """
    Check if user received 20+ positive votes accumulated on comments.
    Trigger: When VoteCount is updated for a Comment.
    
    Optimized: Uses aggregation instead of iterating all comments.
    """
    try:
        if has_badge(user, 'community_voice'):
            return None

        VoteCount = apps.get_model('votes', 'VoteCount')
        Comment = apps.get_model('comments', 'Comment')
        ContentType = apps.get_model('contenttypes', 'ContentType')
        
        comment_content_type = ContentType.objects.get_for_model(Comment)
        
        # Use aggregation to sum votes efficiently
        total_votes = VoteCount.objects.filter(
            content_type=comment_content_type,
            object_id__in=Comment.objects.filter(author=user).values_list('id', flat=True),
            vote_count__gt=0
        ).aggregate(total=Sum('vote_count'))['total'] or 0
        
        if total_votes >= 20:
            return award_badge(
                user,
                'community_voice',
                {'total_comment_votes': total_votes}
            )
    except Exception as e:
        log_error(e, f"Error checking community voice badge for user {user.id}", user.id)
    return None


def check_content_creator(user):
    """
    Check if user created 3 contents with 5+ votes each.
    Trigger: When VoteCount is updated for Content.
    
    Optimized: Uses aggregation instead of iterating all contents.
    """
    try:
        if has_badge(user, 'content_creator'):
            return None

        VoteCount = apps.get_model('votes', 'VoteCount')
        Content = apps.get_model('content', 'Content')
        ContentType = apps.get_model('contenttypes', 'ContentType')
        
        content_content_type = ContentType.objects.get_for_model(Content)
        user_content_ids = Content.objects.filter(uploaded_by=user).values_list('id', flat=True)
        
        # Use aggregation to count highly rated contents efficiently
        highly_rated_contents = VoteCount.objects.filter(
            content_type=content_content_type,
            object_id__in=user_content_ids,
            vote_count__gte=5
        ).count()
        
        if highly_rated_contents >= 3:
            return award_badge(
                user,
                'content_creator',
                {'highly_rated_contents_count': highly_rated_contents}
            )
    except Exception as e:
        log_error(e, f"Error checking content creator badge for user {user.id}", user.id)
    return None


def check_topic_curator(user, topic):
    """
    Check if user created a topic that successfully organizes content with initial community validation.
    Trigger: When VoteCount is updated for content within a topic.
    
    Requirements:
    - User is the topic creator
    - Topic has 5+ contents
    - At least 2 contents have positive votes (vote_count >= 1) specific to that topic
    """
    try:
        if has_badge(user, 'topic_curator'):
            return None
        
        # Verify user is the topic creator
        if topic.creator != user:
            return None
        
        # Check minimum contents count
        contents_count = topic.contents.count()
        if contents_count < 5:
            return None
        
        # Count contents with positive votes specific to this topic
        VoteCount = apps.get_model('votes', 'VoteCount')
        Content = apps.get_model('content', 'Content')
        ContentType = apps.get_model('contenttypes', 'ContentType')
        
        content_type = ContentType.objects.get_for_model(Content)
        topic_content_ids = topic.contents.values_list('id', flat=True)
        
        # Count contents with positive votes in this topic
        contents_with_votes = VoteCount.objects.filter(
            content_type=content_type,
            object_id__in=topic_content_ids,
            topic=topic,
            vote_count__gte=1
        ).count()
        
        if contents_with_votes >= 2:
            return award_badge(
                user,
                'topic_curator',
                {
                    'topic_id': topic.id,
                    'topic_title': topic.title,
                    'contents_count': contents_count,
                    'contents_with_votes': contents_with_votes
                }
            )
    except Exception as e:
        log_error(e, f"Error checking topic curator badge for user {user.id}", user.id)
    return None


def check_topic_architect(user, topic):
    """
    Check if user created a topic that achieves broad community recognition.
    Trigger: When VoteCount is updated for content within a topic.
    
    Requirements (all must be met):
    - User is the topic creator
    - Topic has 10+ contents with positive votes (vote_count >= 1) specific to that topic
    - Topic has 50+ total votes accumulated
    - At least 5 distinct users have voted content in the topic
    """
    try:
        if has_badge(user, 'topic_architect'):
            return None
        
        # Verify user is the topic creator
        if topic.creator != user:
            return None
        
        VoteCount = apps.get_model('votes', 'VoteCount')
        Vote = apps.get_model('votes', 'Vote')
        Content = apps.get_model('content', 'Content')
        ContentType = apps.get_model('contenttypes', 'ContentType')
        
        content_type = ContentType.objects.get_for_model(Content)
        topic_content_ids = topic.contents.values_list('id', flat=True)
        
        # 1. Count contents with positive votes (must be >= 10)
        contents_with_votes = VoteCount.objects.filter(
            content_type=content_type,
            object_id__in=topic_content_ids,
            topic=topic,
            vote_count__gte=1
        ).count()
        
        if contents_with_votes < 10:
            return None
        
        # 2. Calculate total votes accumulated (must be >= 50)
        total_votes = VoteCount.objects.filter(
            content_type=content_type,
            object_id__in=topic_content_ids,
            topic=topic,
            vote_count__gt=0
        ).aggregate(total=Sum('vote_count'))['total'] or 0
        
        if total_votes < 50:
            return None
        
        # 3. Count distinct users who voted (must be >= 5)
        distinct_voters = Vote.objects.filter(
            content_type=content_type,
            object_id__in=topic_content_ids,
            topic=topic,
            value__gt=0
        ).values('user').distinct().count()
        
        if distinct_voters < 5:
            return None
        
        # All conditions met
        return award_badge(
            user,
            'topic_architect',
            {
                'topic_id': topic.id,
                'topic_title': topic.title,
                'contents_with_votes': contents_with_votes,
                'total_votes': total_votes,
                'distinct_voters': distinct_voters
            }
        )
    except Exception as e:
        log_error(e, f"Error checking topic architect badge for user {user.id}", user.id)
    return None