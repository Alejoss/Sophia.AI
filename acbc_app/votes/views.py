from django.contrib.contenttypes.models import ContentType

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.apps import apps
import logging

from comments.models import Comment
from content.models import Topic, Content, Publication, ContentSuggestion
from knowledge_paths.models import KnowledgePath
from votes.models import Vote, VoteCount
from utils.notification_utils import notify_content_upvote, notify_knowledge_path_upvote
import logging

# Get logger for votes app
logger = logging.getLogger('academia_blockchain.votes')


class BaseVoteView(APIView):
    """Base class for handling voting actions."""
    permission_classes = [IsAuthenticated]
    model = None

    def get_vote(self, user, obj, topic=None):
        """Get the user's vote for an object, optionally filtered by topic."""
        # Check if user is authenticated
        if not user.is_authenticated:
            return None
            
        content_type = ContentType.objects.get_for_model(obj)
        try:
            vote_query = Vote.objects.filter(
                user=user,
                content_type=content_type,
                object_id=obj.id
            )
            if topic:
                vote_query = vote_query.filter(topic=topic)
            else:
                vote_query = vote_query.filter(topic__isnull=True)
            return vote_query.first()
        except Vote.DoesNotExist:
            return None

    def get_vote_count(self, obj, topic=None):
        """Get the vote count for an object, optionally filtered by topic."""
        content_type = ContentType.objects.get_for_model(obj)
        try:
            vote_count_query = VoteCount.objects.filter(
                content_type=content_type,
                object_id=obj.id
            )
            if topic:
                vote_count_query = vote_count_query.filter(topic=topic)
            else:
                vote_count_query = vote_count_query.filter(topic__isnull=True)
            vote_count = vote_count_query.first()
            return vote_count.vote_count if vote_count else 0
        except VoteCount.DoesNotExist:
            return 0

    def perform_vote_action(self, request, obj, action, topic=None):
        """Perform a vote action (upvote, downvote, or remove vote)."""
        logger.info(f"Vote action started: {action} on {type(obj).__name__} {obj.id}", extra={
            'user_id': request.user.id,
            'username': request.user.username,
            'object_type': type(obj).__name__,
            'object_id': obj.id,
            'action': action,
            'topic_id': topic.id if topic else None,
        })
        
        user = request.user
        
        # Check if user is authenticated
        if not user.is_authenticated:
            logger.warning("Vote attempt by unauthenticated user", extra={
                'object_type': type(obj).__name__,
                'object_id': obj.id,
                'action': action,
            })
            raise Exception("User must be authenticated to vote")
        
        content_type = ContentType.objects.get_for_model(obj)
        
        logger.debug(f"Processing vote: User={user.id}, Content type={content_type}, Object ID={obj.id}")
        
        # Get or create vote count with topic consideration
        vote_count, created = VoteCount.objects.get_or_create(
            content_type=content_type,
            object_id=obj.id,
            topic=topic,
            defaults={'vote_count': 0}
        )
        
        logger.debug(f"VoteCount - Created: {created}, Current count: {vote_count.vote_count}")
        
        # Get existing vote if any, considering topic
        existing_vote = self.get_vote(user, obj, topic)
        created_vote = None
        
        logger.debug(f"Existing vote: {existing_vote.value if existing_vote else 'None'}")
        
        if action == 'upvote':
            logger.debug("Processing upvote...")
            if existing_vote:
                if existing_vote.value == 1:
                    # Remove upvote
                    logger.info("Removing existing upvote", extra={
                        'user_id': user.id,
                        'object_type': type(obj).__name__,
                        'object_id': obj.id,
                        'vote_id': existing_vote.id,
                    })
                    existing_vote.delete()
                    vote_count.vote_count -= 1
                else:
                    # Change downvote to upvote
                    logger.info("Changing downvote to upvote", extra={
                        'user_id': user.id,
                        'object_type': type(obj).__name__,
                        'object_id': obj.id,
                        'vote_id': existing_vote.id,
                        'old_value': existing_vote.value,
                        'new_value': 1,
                    })
                    existing_vote.value = 1
                    existing_vote.save()
                    vote_count.vote_count += 2
                    created_vote = existing_vote
            else:
                # Create new upvote
                logger.info("Creating new upvote", extra={
                    'user_id': user.id,
                    'object_type': type(obj).__name__,
                    'object_id': obj.id,
                })
                created_vote = Vote.objects.create(
                    user=user,
                    content_type=content_type,
                    object_id=obj.id,
                    topic=topic,
                    value=1
                )
                vote_count.vote_count += 1
                
        elif action == 'downvote':
            logger.debug("Processing downvote...")
            if existing_vote:
                if existing_vote.value == -1:
                    # Remove downvote
                    logger.info("Removing existing downvote", extra={
                        'user_id': user.id,
                        'object_type': type(obj).__name__,
                        'object_id': obj.id,
                        'vote_id': existing_vote.id,
                    })
                    existing_vote.delete()
                    vote_count.vote_count += 1
                else:
                    # Change upvote to downvote
                    logger.info("Changing upvote to downvote", extra={
                        'user_id': user.id,
                        'object_type': type(obj).__name__,
                        'object_id': obj.id,
                        'vote_id': existing_vote.id,
                        'old_value': existing_vote.value,
                        'new_value': -1,
                    })
                    existing_vote.value = -1
                    existing_vote.save()
                    vote_count.vote_count -= 2
            else:
                # Create new downvote
                logger.info("Creating new downvote", extra={
                    'user_id': user.id,
                    'object_type': type(obj).__name__,
                    'object_id': obj.id,
                })
                Vote.objects.create(
                    user=user,
                    content_type=content_type,
                    object_id=obj.id,
                    topic=topic,
                    value=-1
                )
                vote_count.vote_count -= 1
                
        elif action == 'remove':
            logger.debug("Processing remove vote...")
            if existing_vote:
                logger.info("Removing vote", extra={
                    'user_id': user.id,
                    'object_type': type(obj).__name__,
                    'object_id': obj.id,
                    'vote_id': existing_vote.id,
                    'vote_value': existing_vote.value,
                })
                vote_count.vote_count -= existing_vote.value
                existing_vote.delete()
        
        logger.debug(f"Final vote count before save: {vote_count.vote_count}")
        vote_count.save()
        logger.debug("VoteCount saved successfully")
        
        # Send notification for upvotes
        if created_vote and action == 'upvote':
            try:
                # Check if this is a content upvote
                if isinstance(obj, Content):
                    logger.info("Sending content upvote notification", extra={
                        'user_id': user.id,
                        'content_id': obj.id,
                        'vote_id': created_vote.id,
                    })
                    notify_content_upvote(created_vote)
                # Check if this is a knowledge path upvote
                elif isinstance(obj, KnowledgePath):
                    logger.info("Sending knowledge path upvote notification", extra={
                        'user_id': user.id,
                        'knowledge_path_id': obj.id,
                        'vote_id': created_vote.id,
                    })
                    notify_knowledge_path_upvote(created_vote)
            except Exception as e:
                logger.error(f"Error sending upvote notification: {str(e)}", extra={
                    'user_id': user.id,
                    'object_type': type(obj).__name__,
                    'object_id': obj.id,
                    'vote_id': created_vote.id if created_vote else None,
                }, exc_info=True)
                # Don't fail the vote operation if notification fails
        
        # Log business event
        logger.info(f"Business event: vote_{action}", extra={
            'user_id': user.id,
            'object_id': obj.id,
            'object_type': type(obj).__name__,
            'vote_count': vote_count.vote_count,
            'topic_id': topic.id if topic else None,
            'event_type': f'vote_{action}',
        })
        
        return vote_count.vote_count


class BaseGetVoteView(BaseVoteView):
    """Base class for getting vote information."""

    def get(self, request, pk=None, topic_pk=None, content_pk=None):
        """Get vote information for an object."""
        try:
            if pk:
                obj = get_object_or_404(self.model, pk=pk)
            elif topic_pk and content_pk:
                obj = get_object_or_404(self.model, pk=content_pk)
            else:
                logger.warning("Invalid parameters for vote retrieval", extra={
                    'pk': pk,
                    'topic_pk': topic_pk,
                    'content_pk': content_pk,
                    'user_id': request.user.id if request.user.is_authenticated else None,
                })
                return Response(
                    {'error': 'Invalid parameters'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # For anonymous users, only return vote count, not user vote
            if not request.user.is_authenticated:
                vote_count = self.get_vote_count(obj)
                logger.debug("Vote info retrieved for anonymous user", extra={
                    'object_type': type(obj).__name__,
                    'object_id': obj.id,
                    'vote_count': vote_count,
                })
                return Response({
                    'user_vote': 0,
                    'vote_count': vote_count
                })
            
            user_vote = self.get_vote(request.user, obj)
            vote_count = self.get_vote_count(obj)
            
            logger.debug("Vote info retrieved successfully", extra={
                'user_id': request.user.id,
                'object_type': type(obj).__name__,
                'object_id': obj.id,
                'user_vote': user_vote.value if user_vote else 0,
                'vote_count': vote_count,
            })
            
            return Response({
                'user_vote': user_vote.value if user_vote else 0,
                'vote_count': vote_count
            })
        except Exception as e:
            logger.error("Error retrieving vote information", extra={
                'user_id': request.user.id if request.user.is_authenticated else None,
                'pk': pk,
                'topic_pk': topic_pk,
                'content_pk': content_pk,
                'object_type': self.model.__name__ if self.model else None,
            }, exc_info=True)
            return Response(
                {'error': 'An error occurred while retrieving vote information'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class KnowledgePathVoteView(BaseGetVoteView):
    model = KnowledgePath

    def post(self, request, pk):
        """Handle vote actions for a knowledge path."""
        try:
            knowledge_path = get_object_or_404(KnowledgePath, pk=pk)
            action = request.data.get('action')
            
            logger.info(f"Knowledge path vote request: {action}", extra={
                'user_id': request.user.id,
                'knowledge_path_id': pk,
                'action': action,
            })
            
            if action not in ['upvote', 'downvote', 'remove']:
                logger.warning("Invalid vote action for knowledge path", extra={
                    'user_id': request.user.id,
                    'knowledge_path_id': pk,
                    'action': action,
                })
                return Response(
                    {'error': 'Invalid action'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            vote_count = self.perform_vote_action(request, knowledge_path, action)
            
            # Get the user's current vote after the action
            user_vote = self.get_vote(request.user, knowledge_path)
            
            response_data = {
                'vote_count': vote_count,
                'user_vote': user_vote.value if user_vote else 0
            }
            
            logger.info("Knowledge path vote completed successfully", extra={
                'user_id': request.user.id,
                'knowledge_path_id': pk,
                'action': action,
                'final_vote_count': vote_count,
                'user_vote': user_vote.value if user_vote else 0,
            })
            
            return Response(response_data)
        except Exception as e:
            if "User must be authenticated" in str(e):
                logger.warning("Unauthenticated vote attempt on knowledge path", extra={
                    'knowledge_path_id': pk,
                    'action': request.data.get('action'),
                })
                return Response(
                    {'error': 'Authentication required to vote'}, 
                    status=status.HTTP_401_UNAUTHORIZED
                )
            else:
                logger.error("Error processing knowledge path vote", extra={
                    'user_id': request.user.id,
                    'knowledge_path_id': pk,
                    'action': request.data.get('action'),
                }, exc_info=True)
                return Response(
                    {'error': 'An error occurred while processing your vote'}, 
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )


class ContentVoteView(BaseGetVoteView):
    model = Content

    def post(self, request, topic_pk, content_pk):
        """Handle vote actions for content within a topic."""
        try:
            logger.info(f"Content vote request: topic_pk={topic_pk}, content_pk={content_pk}", extra={
                'user_id': request.user.id,
                'topic_id': topic_pk,
                'content_id': content_pk,
                'action': request.data.get('action'),
            })
            
            content = get_object_or_404(Content, pk=content_pk)
            topic = get_object_or_404(Topic, pk=topic_pk)
            action = request.data.get('action')
            
            logger.debug(f"Content found: {content.id} - {content.original_title}")
            logger.debug(f"Topic found: {topic.id} - {topic.title}")
            logger.debug(f"Action: {action}")
            
            if action not in ['upvote', 'downvote', 'remove']:
                logger.warning("Invalid vote action for content", extra={
                    'user_id': request.user.id,
                    'topic_id': topic_pk,
                    'content_id': content_pk,
                    'action': action,
                })
                return Response(
                    {'error': 'Invalid action'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            logger.debug(f"Before vote - Vote count: {self.get_vote_count(content, topic)}")
            logger.debug(f"Before vote - User vote: {self.get_vote(request.user, content, topic).value if self.get_vote(request.user, content, topic) else 'None'}")
            
            vote_count = self.perform_vote_action(request, content, action, topic)
            
            logger.debug(f"After vote - Vote count: {vote_count}")
            logger.debug(f"After vote - User vote: {self.get_vote(request.user, content, topic).value if self.get_vote(request.user, content, topic) else 'None'}")
            
            # Get the user's current vote after the action
            user_vote = self.get_vote(request.user, content, topic)
            
            response_data = {
                'vote_count': vote_count,
                'user_vote': user_vote.value if user_vote else 0
            }
            
            logger.info("Content vote completed successfully", extra={
                'user_id': request.user.id,
                'topic_id': topic_pk,
                'content_id': content_pk,
                'action': action,
                'final_vote_count': vote_count,
                'user_vote': user_vote.value if user_vote else 0,
            })
            
            return Response(response_data)
        except Exception as e:
            if "User must be authenticated" in str(e):
                logger.warning("Unauthenticated vote attempt on content", extra={
                    'topic_id': topic_pk,
                    'content_id': content_pk,
                    'action': request.data.get('action'),
                })
                return Response(
                    {'error': 'Authentication required to vote'}, 
                    status=status.HTTP_401_UNAUTHORIZED
                )
            else:
                logger.error("Error processing content vote", extra={
                    'user_id': request.user.id,
                    'topic_id': topic_pk,
                    'content_id': content_pk,
                    'action': request.data.get('action'),
                }, exc_info=True)
                return Response(
                    {'error': 'An error occurred while processing your vote'}, 
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

    def get(self, request, topic_pk, content_pk):
        """Get vote information for content within a topic."""
        try:
            content = get_object_or_404(Content, pk=content_pk)
            topic = get_object_or_404(Topic, pk=topic_pk)
            
            logger.debug("Retrieving vote info for content", extra={
                'user_id': request.user.id if request.user.is_authenticated else None,
                'topic_id': topic_pk,
                'content_id': content_pk,
            })
            
            # For anonymous users, only return vote count, not user vote
            if not request.user.is_authenticated:
                vote_count = self.get_vote_count(content, topic)
                logger.debug("Vote info retrieved for anonymous user", extra={
                    'topic_id': topic_pk,
                    'content_id': content_pk,
                    'vote_count': vote_count,
                })
                return Response({
                    'user_vote': 0,
                    'vote_count': vote_count
                })
            
            user_vote = self.get_vote(request.user, content, topic)
            vote_count = self.get_vote_count(content, topic)
            
            logger.debug("Vote info retrieved successfully", extra={
                'user_id': request.user.id,
                'topic_id': topic_pk,
                'content_id': content_pk,
                'user_vote': user_vote.value if user_vote else 0,
                'vote_count': vote_count,
            })
            
            return Response({
                'user_vote': user_vote.value if user_vote else 0,
                'vote_count': vote_count
            })
        except Exception as e:
            logger.error("Error retrieving content vote information", extra={
                'user_id': request.user.id if request.user.is_authenticated else None,
                'topic_id': topic_pk,
                'content_id': content_pk,
            }, exc_info=True)
            return Response(
                {'error': 'An error occurred while retrieving vote information'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CommentVoteView(BaseGetVoteView):
    model = Comment

    def post(self, request, pk):
        """Handle vote actions for a comment."""
        try:
            comment = get_object_or_404(Comment, pk=pk)
            action = request.data.get('action')
            
            logger.info(f"Comment vote request: {action}", extra={
                'user_id': request.user.id,
                'comment_id': pk,
                'action': action,
            })
            
            if action not in ['upvote', 'downvote', 'remove']:
                logger.warning("Invalid vote action for comment", extra={
                    'user_id': request.user.id,
                    'comment_id': pk,
                    'action': action,
                })
                return Response(
                    {'error': 'Invalid action'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            vote_count = self.perform_vote_action(request, comment, action)
            
            # Get the user's current vote after the action
            user_vote = self.get_vote(request.user, comment)
            
            response_data = {
                'vote_count': vote_count,
                'user_vote': user_vote.value if user_vote else 0
            }
            
            logger.info("Comment vote completed successfully", extra={
                'user_id': request.user.id,
                'comment_id': pk,
                'action': action,
                'final_vote_count': vote_count,
                'user_vote': user_vote.value if user_vote else 0,
            })
            
            return Response(response_data)
        except Exception as e:
            if "User must be authenticated" in str(e):
                logger.warning("Unauthenticated vote attempt on comment", extra={
                    'comment_id': pk,
                    'action': request.data.get('action'),
                })
                return Response(
                    {'error': 'Authentication required to vote'}, 
                    status=status.HTTP_401_UNAUTHORIZED
                )
            else:
                logger.error("Error processing comment vote", extra={
                    'user_id': request.user.id,
                    'comment_id': pk,
                    'action': request.data.get('action'),
                }, exc_info=True)
                return Response(
                    {'error': 'An error occurred while processing your vote'}, 
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )


class PublicationVoteView(BaseGetVoteView):
    model = Publication

    def post(self, request, pk):
        """Handle vote actions for a publication."""
        try:
            publication = get_object_or_404(Publication, pk=pk)
            action = request.data.get('action')
            
            logger.info(f"Publication vote request: {action}", extra={
                'user_id': request.user.id,
                'publication_id': pk,
                'action': action,
            })
            
            if action not in ['upvote', 'downvote', 'remove']:
                logger.warning("Invalid vote action for publication", extra={
                    'user_id': request.user.id,
                    'publication_id': pk,
                    'action': action,
                })
                return Response(
                    {'error': 'Invalid action'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            vote_count = self.perform_vote_action(request, publication, action)
            
            # Get the user's current vote after the action
            user_vote = self.get_vote(request.user, publication)
            
            response_data = {
                'vote_count': vote_count,
                'user_vote': user_vote.value if user_vote else 0
            }
            
            logger.info("Publication vote completed successfully", extra={
                'user_id': request.user.id,
                'publication_id': pk,
                'action': action,
                'final_vote_count': vote_count,
                'user_vote': user_vote.value if user_vote else 0,
            })
            
            return Response(response_data)
        except Exception as e:
            if "User must be authenticated" in str(e):
                logger.warning("Unauthenticated vote attempt on publication", extra={
                    'publication_id': pk,
                    'action': request.data.get('action'),
                })
                return Response(
                    {'error': 'Authentication required to vote'}, 
                    status=status.HTTP_401_UNAUTHORIZED
                )
            else:
                logger.error("Error processing publication vote", extra={
                    'user_id': request.user.id,
                    'publication_id': pk,
                    'action': request.data.get('action'),
                }, exc_info=True)
                return Response(
                    {'error': 'An error occurred while processing your vote'}, 
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )


class ContentSuggestionVoteView(BaseGetVoteView):
    model = ContentSuggestion

    def post(self, request, pk):
        """Handle vote actions for a content suggestion. Votes are not topic-specific."""
        try:
            suggestion = get_object_or_404(ContentSuggestion, pk=pk)
            action = request.data.get('action')
            
            logger.info(f"Content suggestion vote request: {action}", extra={
                'user_id': request.user.id,
                'suggestion_id': pk,
                'action': action,
            })
            
            if action not in ['upvote', 'downvote', 'remove']:
                logger.warning("Invalid vote action for content suggestion", extra={
                    'user_id': request.user.id,
                    'suggestion_id': pk,
                    'action': action,
                })
                return Response(
                    {'error': 'Invalid action'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Votes for suggestions are not topic-specific (topic=None)
            vote_count = self.perform_vote_action(request, suggestion, action, topic=None)
            
            # Get the user's current vote after the action
            user_vote = self.get_vote(request.user, suggestion, topic=None)
            
            response_data = {
                'vote_count': vote_count,
                'user_vote': user_vote.value if user_vote else 0
            }
            
            logger.info("Content suggestion vote completed successfully", extra={
                'user_id': request.user.id,
                'suggestion_id': pk,
                'action': action,
                'final_vote_count': vote_count,
                'user_vote': user_vote.value if user_vote else 0,
            })
            
            return Response(response_data)
        except Exception as e:
            if "User must be authenticated" in str(e):
                logger.warning("Unauthenticated vote attempt on content suggestion", extra={
                    'suggestion_id': pk,
                    'action': request.data.get('action'),
                })
                return Response(
                    {'error': 'Authentication required to vote'}, 
                    status=status.HTTP_401_UNAUTHORIZED
                )
            else:
                logger.error("Error processing content suggestion vote", extra={
                    'user_id': request.user.id,
                    'suggestion_id': pk,
                    'action': request.data.get('action'),
                }, exc_info=True)
                return Response(
                    {'error': 'An error occurred while processing your vote'}, 
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

    def get(self, request, pk):
        """Get vote information for a content suggestion. Votes are not topic-specific."""
        try:
            suggestion = get_object_or_404(ContentSuggestion, pk=pk)
            
            logger.debug("Retrieving vote info for content suggestion", extra={
                'user_id': request.user.id if request.user.is_authenticated else None,
                'suggestion_id': pk,
            })
            
            # For anonymous users, only return vote count, not user vote
            if not request.user.is_authenticated:
                vote_count = self.get_vote_count(suggestion, topic=None)
                logger.debug("Vote info retrieved for anonymous user", extra={
                    'suggestion_id': pk,
                    'vote_count': vote_count,
                })
                return Response({
                    'user_vote': 0,
                    'vote_count': vote_count
                })
            
            user_vote = self.get_vote(request.user, suggestion, topic=None)
            vote_count = self.get_vote_count(suggestion, topic=None)
            
            logger.debug("Vote info retrieved successfully", extra={
                'user_id': request.user.id,
                'suggestion_id': pk,
                'user_vote': user_vote.value if user_vote else 0,
                'vote_count': vote_count,
            })
            
            return Response({
                'user_vote': user_vote.value if user_vote else 0,
                'vote_count': vote_count
            })
        except Exception as e:
            logger.error("Error retrieving vote information for content suggestion", extra={
                'user_id': request.user.id if request.user.is_authenticated else None,
                'suggestion_id': pk,
            }, exc_info=True)
            return Response(
                {'error': 'An error occurred while retrieving vote information'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )