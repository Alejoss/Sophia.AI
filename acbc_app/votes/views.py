from django.contrib.contenttypes.models import ContentType

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from django.apps import apps

from comments.models import Comment
from content.models import Topic, Content, Publication
from knowledge_paths.models import KnowledgePath
from votes.models import Vote, VoteCount
from utils.notification_utils import notify_content_upvote, notify_knowledge_path_upvote


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
        print(f"perform_vote_action called with action={action}, topic={topic}")
        
        user = request.user
        
        # Check if user is authenticated
        if not user.is_authenticated:
            raise Exception("User must be authenticated to vote")
        
        content_type = ContentType.objects.get_for_model(obj)
        
        print(f"User: {user}, Content type: {content_type}, Object ID: {obj.id}")
        
        # Get or create vote count with topic consideration
        vote_count, created = VoteCount.objects.get_or_create(
            content_type=content_type,
            object_id=obj.id,
            topic=topic,
            defaults={'vote_count': 0}
        )
        
        print(f"VoteCount - Created: {created}, Current count: {vote_count.vote_count}")
        
        # Get existing vote if any, considering topic
        existing_vote = self.get_vote(user, obj, topic)
        created_vote = None
        
        print(f"Existing vote: {existing_vote.value if existing_vote else 'None'}")
        
        if action == 'upvote':
            print("Processing upvote...")
            if existing_vote:
                if existing_vote.value == 1:
                    # Remove upvote
                    print("Removing existing upvote")
                    existing_vote.delete()
                    vote_count.vote_count -= 1
                else:
                    # Change downvote to upvote
                    print("Changing downvote to upvote")
                    existing_vote.value = 1
                    existing_vote.save()
                    vote_count.vote_count += 2
                    created_vote = existing_vote
            else:
                # Create new upvote
                print("Creating new upvote")
                created_vote = Vote.objects.create(
                    user=user,
                    content_type=content_type,
                    object_id=obj.id,
                    topic=topic,
                    value=1
                )
                vote_count.vote_count += 1
                
        elif action == 'downvote':
            print("Processing downvote...")
            if existing_vote:
                if existing_vote.value == -1:
                    # Remove downvote
                    print("Removing existing downvote")
                    existing_vote.delete()
                    vote_count.vote_count += 1
                else:
                    # Change upvote to downvote
                    print("Changing upvote to downvote")
                    existing_vote.value = -1
                    existing_vote.save()
                    vote_count.vote_count -= 2
            else:
                # Create new downvote
                print("Creating new downvote")
                Vote.objects.create(
                    user=user,
                    content_type=content_type,
                    object_id=obj.id,
                    topic=topic,
                    value=-1
                )
                vote_count.vote_count -= 1
                
        elif action == 'remove':
            print("Processing remove vote...")
            if existing_vote:
                vote_count.vote_count -= existing_vote.value
                existing_vote.delete()
        
        print(f"Final vote count before save: {vote_count.vote_count}")
        vote_count.save()
        print(f"VoteCount saved successfully")
        
        # Send notification for upvotes
        if created_vote and action == 'upvote':
            try:
                # Check if this is a content upvote
                if isinstance(obj, Content):
                    notify_content_upvote(created_vote)
                # Check if this is a knowledge path upvote
                elif isinstance(obj, KnowledgePath):
                    notify_knowledge_path_upvote(created_vote)
            except Exception as e:
                print(f"Error sending upvote notification: {str(e)}")
                # Don't fail the vote operation if notification fails
        
        return vote_count.vote_count


class BaseGetVoteView(BaseVoteView):
    """Base class for getting vote information."""

    def get(self, request, pk=None, topic_pk=None, content_pk=None):
        """Get vote information for an object."""
        if pk:
            obj = get_object_or_404(self.model, pk=pk)
        elif topic_pk and content_pk:
            obj = get_object_or_404(self.model, pk=content_pk)
        else:
            return Response(
                {'error': 'Invalid parameters'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # For anonymous users, only return vote count, not user vote
        if not request.user.is_authenticated:
            vote_count = self.get_vote_count(obj)
            return Response({
                'user_vote': 0,
                'vote_count': vote_count
            })
        
        user_vote = self.get_vote(request.user, obj)
        vote_count = self.get_vote_count(obj)
        
        return Response({
            'user_vote': user_vote.value if user_vote else 0,
            'vote_count': vote_count
        })


class KnowledgePathVoteView(BaseGetVoteView):
    model = KnowledgePath

    def post(self, request, pk):
        """Handle vote actions for a knowledge path."""
        knowledge_path = get_object_or_404(KnowledgePath, pk=pk)
        action = request.data.get('action')
        
        if action not in ['upvote', 'downvote', 'remove']:
            return Response(
                {'error': 'Invalid action'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            vote_count = self.perform_vote_action(request, knowledge_path, action)
            
            # Get the user's current vote after the action
            user_vote = self.get_vote(request.user, knowledge_path)
            
            return Response({
                'vote_count': vote_count,
                'user_vote': user_vote.value if user_vote else 0
            })
        except Exception as e:
            if "User must be authenticated" in str(e):
                return Response(
                    {'error': 'Authentication required to vote'}, 
                    status=status.HTTP_401_UNAUTHORIZED
                )
            else:
                return Response(
                    {'error': 'An error occurred while processing your vote'}, 
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )


class ContentVoteView(BaseGetVoteView):
    model = Content

    def post(self, request, topic_pk, content_pk):
        """Handle vote actions for content within a topic."""
        print(f"ContentVoteView.post called with topic_pk={topic_pk}, content_pk={content_pk}")
        print(f"Request data: {request.data}")
        print(f"Request user: {request.user}")
        
        content = get_object_or_404(Content, pk=content_pk)
        topic = get_object_or_404(Topic, pk=topic_pk)
        action = request.data.get('action')
        
        print(f"Content found: {content.id} - {content.original_title}")
        print(f"Topic found: {topic.id} - {topic.title}")
        print(f"Action: {action}")
        
        if action not in ['upvote', 'downvote', 'remove']:
            print(f"Invalid action: {action}")
            return Response(
                {'error': 'Invalid action'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        print(f"Before vote - Vote count: {self.get_vote_count(content, topic)}")
        print(f"Before vote - User vote: {self.get_vote(request.user, content, topic).value if self.get_vote(request.user, content, topic) else 'None'}")
        
        try:
            vote_count = self.perform_vote_action(request, content, action, topic)
            
            print(f"After vote - Vote count: {vote_count}")
            print(f"After vote - User vote: {self.get_vote(request.user, content, topic).value if self.get_vote(request.user, content, topic) else 'None'}")
            
            # Get the user's current vote after the action
            user_vote = self.get_vote(request.user, content, topic)
            
            response_data = {
                'vote_count': vote_count,
                'user_vote': user_vote.value if user_vote else 0
            }
            
            print(f"Response data: {response_data}")
            return Response(response_data)
        except Exception as e:
            if "User must be authenticated" in str(e):
                return Response(
                    {'error': 'Authentication required to vote'}, 
                    status=status.HTTP_401_UNAUTHORIZED
                )
            else:
                return Response(
                    {'error': 'An error occurred while processing your vote'}, 
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

    def get(self, request, topic_pk, content_pk):
        """Get vote information for content within a topic."""
        content = get_object_or_404(Content, pk=content_pk)
        topic = get_object_or_404(Topic, pk=topic_pk)
        
        # For anonymous users, only return vote count, not user vote
        if not request.user.is_authenticated:
            vote_count = self.get_vote_count(content, topic)
            return Response({
                'user_vote': 0,
                'vote_count': vote_count
            })
        
        user_vote = self.get_vote(request.user, content, topic)
        vote_count = self.get_vote_count(content, topic)
        
        return Response({
            'user_vote': user_vote.value if user_vote else 0,
            'vote_count': vote_count
        })


class CommentVoteView(BaseGetVoteView):
    model = Comment

    def post(self, request, pk):
        """Handle vote actions for a comment."""
        comment = get_object_or_404(Comment, pk=pk)
        action = request.data.get('action')
        
        if action not in ['upvote', 'downvote', 'remove']:
            return Response(
                {'error': 'Invalid action'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            vote_count = self.perform_vote_action(request, comment, action)
            
            # Get the user's current vote after the action
            user_vote = self.get_vote(request.user, comment)
            
            return Response({
                'vote_count': vote_count,
                'user_vote': user_vote.value if user_vote else 0
            })
        except Exception as e:
            if "User must be authenticated" in str(e):
                return Response(
                    {'error': 'Authentication required to vote'}, 
                    status=status.HTTP_401_UNAUTHORIZED
                )
            else:
                return Response(
                    {'error': 'An error occurred while processing your vote'}, 
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )


class PublicationVoteView(BaseGetVoteView):
    model = Publication

    def post(self, request, pk):
        """Handle vote actions for a publication."""
        publication = get_object_or_404(Publication, pk=pk)
        action = request.data.get('action')
        
        if action not in ['upvote', 'downvote', 'remove']:
            return Response(
                {'error': 'Invalid action'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            vote_count = self.perform_vote_action(request, publication, action)
            
            # Get the user's current vote after the action
            user_vote = self.get_vote(request.user, publication)
            
            return Response({
                'vote_count': vote_count,
                'user_vote': user_vote.value if user_vote else 0
            })
        except Exception as e:
            if "User must be authenticated" in str(e):
                return Response(
                    {'error': 'Authentication required to vote'}, 
                    status=status.HTTP_401_UNAUTHORIZED
                )
            else:
                return Response(
                    {'error': 'An error occurred while processing your vote'}, 
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                ) 