"""
Django signals for automatic badge awarding.

These signals listen to various model events and trigger badge eligibility checks.
All signals verify that badges haven't been awarded previously to avoid duplicates.
"""

from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.contenttypes.models import ContentType

from . import rules
from utils.logging_utils import gamification_logger, log_error


@receiver(post_save, sender='profiles.UserNodeCompletion')
def check_node_completion_badges(sender, instance, created, **kwargs):
    """
    Check badges when a node is completed:
    - Knowledge Seeker: 20+ nodes completed
    - First Explorer: First KnowledgePath completed
    """
    try:
        if not instance.is_completed:
            return

        user = instance.user
        knowledge_path = instance.knowledge_path

        # Check Knowledge Seeker badge (accumulated)
        rules.check_knowledge_seeker(user)

        # Check if KnowledgePath is completed
        from knowledge_paths.services.node_user_activity_service import is_knowledge_path_completed
        if is_knowledge_path_completed(user, knowledge_path):
            rules.check_first_knowledge_path_completed(user, knowledge_path)
    except Exception as e:
        log_error(e, f"Error in check_node_completion_badges for user {instance.user.id}", instance.user.id)


@receiver(post_save, sender='comments.Comment')
def check_comment_badges(sender, instance, created, **kwargs):
    """
    Check badges when a comment is created:
    - First Voice: First comment
    """
    try:
        if not created:
            return

        user = instance.author
        rules.check_first_comment(user)
    except Exception as e:
        log_error(e, f"Error in check_comment_badges for user {instance.author.id}", instance.author.id)


@receiver(post_save, sender='votes.VoteCount')
def check_vote_count_badges(sender, instance, created, **kwargs):
    """
    Check badges when VoteCount is updated:
    - Valued Contributor: Comment with 5+ votes
    - Content Curator: Content with 10+ votes
    - Community Voice: 20+ votes accumulated on comments
    - Creator: 3 contents with 5+ votes each
    - Curador de Conexiones: Topic with 5+ contents and 2+ with votes
    - Arquitecto de Temas: Topic with 10+ contents with votes, 50+ total votes, 5+ distinct voters
    """
    try:
        content_object = instance.content_object
        if not content_object:
            return

        # Check topic-related badges if VoteCount has a topic
        if instance.topic:
            topic = instance.topic
            if topic.creator:
                # Check both topic badges
                rules.check_topic_curator(topic.creator, topic)
                rules.check_topic_architect(topic.creator, topic)

        # Determine the model type
        from comments.models import Comment
        from content.models import Content

        if isinstance(content_object, Comment):
            user = content_object.author
            # Check Valued Contributor (first highly rated comment)
            if instance.vote_count >= 5:
                rules.check_first_highly_rated_comment(user, content_object)
            # Check Community Voice (accumulated votes on comments)
            rules.check_community_voice(user)

        elif isinstance(content_object, Content):
            user = content_object.uploaded_by
            if not user:
                return
            # Check Content Curator (first highly rated content)
            if instance.vote_count >= 10:
                rules.check_first_highly_rated_content(user, content_object)
            # Check Creator (3 contents with 5+ votes)
            rules.check_content_creator(user)
    except Exception as e:
        log_error(e, f"Error in check_vote_count_badges", None)


@receiver(post_save, sender='knowledge_paths.Node')
def check_knowledge_path_creation_badge(sender, instance, created, **kwargs):
    """
    Check badge when a Node is added to a KnowledgePath:
    - Path Creator: First KnowledgePath with 2+ nodes
    """
    try:
        if not created:
            return

        knowledge_path = instance.knowledge_path
        user = knowledge_path.author
        if not user:
            return

        # Check if this KnowledgePath now has 2+ nodes
        if knowledge_path.nodes.count() >= 2:
            rules.check_first_knowledge_path_created(user, knowledge_path)
    except Exception as e:
        log_error(e, f"Error in check_knowledge_path_creation_badge", None)


@receiver(post_save, sender='quizzes.UserQuizAttempt')
def check_quiz_badges(sender, instance, created, **kwargs):
    """
    Check badges when a quiz attempt is completed:
    - Quiz Master: 5 quizzes with perfect score
    """
    try:
        if not created:
            return

        # Only check if score is perfect (100)
        if instance.score == 100:
            user = instance.user
            rules.check_quiz_master(user)
    except Exception as e:
        log_error(e, f"Error in check_quiz_badges for user {instance.user.id}", instance.user.id)