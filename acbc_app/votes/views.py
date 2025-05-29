from django.contrib.contenttypes.models import ContentType

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import get_object_or_404

from comments.models import Comment
from content.models import Topic, Content
from knowledge_paths.models import KnowledgePath
from events.models import ConnectionPlatform
from votes.models import Vote, VoteCount


class BaseVoteView(APIView):
    """Base class for handling voting actions."""

    model = None

    def get_vote(self, user, obj):
        """Retrieve or create the user's vote for a specific object"""
        print(f"Getting vote for user {user.id} and object {obj.id} of type {self.model.__name__}")
        content_type = ContentType.objects.get_for_model(self.model)
        vote = Vote.objects.filter(
            user=user,
            content_type=content_type,
            object_id=obj.id
        ).first()
        print(f"Found vote: {vote.value if vote else 'None'}")
        return vote

    def get_vote_count(self, obj, topic=None):
        """Get or create VoteCount for the object"""
        print(f"Getting vote count for object {obj.id} of type {self.model.__name__}" + 
              (f" in topic {topic.id}" if topic else ""))
        content_type = ContentType.objects.get_for_model(self.model)
        vote_count, created = VoteCount.objects.get_or_create(
            content_type=content_type,
            object_id=obj.id,
            topic=topic
        )
        print(f"Vote count {'created' if created else 'retrieved'}: {vote_count.vote_count}")
        return vote_count

    def perform_vote_action(self, request, obj, action, topic=None):
        print(f"Performing {action} for user {request.user.id} on {self.model.__name__} {obj.id}" +
              (f" in topic {topic.id}" if topic else ""))
        
        user = request.user
        content_type = ContentType.objects.get_for_model(self.model)

        # Get or create vote with proper topic
        vote, created = Vote.objects.get_or_create(
            user=user,
            content_type=content_type,
            object_id=obj.id,
            topic=topic,  # Include topic in get_or_create
            defaults={'value': 0}
        )
        print(f"Vote {'created' if created else 'retrieved'}: {vote.value}")

        # Perform voting action
        if action == 'upvote':
            print(f"Upvoting from current value: {vote.value}")
            vote_change = vote.upvote()
        elif action == 'downvote':
            print(f"Downvoting from current value: {vote.value}")
            vote_change = vote.downvote()
        
        print(f"Vote changed by: {vote_change}, new value: {vote.value}")

        # Update vote count
        vote_count = self.get_vote_count(obj, topic)
        old_count = vote_count.vote_count
        vote_count.update_vote_count(obj)
        print(f"Vote count updated from {old_count} to {vote_count.vote_count}")

        response_data = {
            "vote": vote.value,
            "vote_count": vote_count.vote_count
        }
        print(f"Returning response: {response_data}")
        return Response(response_data, status=status.HTTP_200_OK)


class BaseGetVoteView(BaseVoteView):
    """Base class for retrieving vote count and user's vote."""

    def get(self, request, pk=None, topic_pk=None, content_pk=None):
        print(f"Getting vote status for {self.model.__name__} with params: pk={pk}, topic_pk={topic_pk}, content_pk={content_pk}")
        
        # Handle different ID parameters
        object_id = content_pk or pk  # Use content_pk if available, otherwise use pk
        obj = get_object_or_404(self.model, pk=object_id)
        topic = None

        if topic_pk:
            print(f"Getting topic-specific vote for topic {topic_pk}")
            topic = get_object_or_404(Topic, pk=topic_pk)
            if hasattr(topic, 'contents'):
                obj = get_object_or_404(topic.contents, pk=object_id)

        vote_count = self.get_vote_count(obj, topic)
        existing_vote = self.get_vote(request.user, obj)

        response_data = {
            "vote_count": vote_count.vote_count,
            "vote": existing_vote.value if existing_vote else 0
        }
        print(f"Returning vote status: {response_data}")
        return Response(response_data, status=status.HTTP_200_OK)


class KnowledgePathVoteView(BaseGetVoteView):
    model = KnowledgePath

    def post(self, request, pk):
        print(f"KnowledgePath vote request for path {pk}: {request.data}")
        obj = get_object_or_404(self.model, pk=pk)
        action = request.data.get('action')
        
        if action not in ['upvote', 'downvote']:
            print(f"Invalid action: {action}")
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
            
        return self.perform_vote_action(request, obj, action)


class ContentVoteView(BaseGetVoteView):
    model = Content

    def post(self, request, topic_pk, content_pk):
        print(f"Content vote request for topic {topic_pk}, content {content_pk}: {request.data}")
        topic = get_object_or_404(Topic, pk=topic_pk)
        obj = get_object_or_404(topic.contents, pk=content_pk)
        action = request.data.get('action')
        
        if action not in ['upvote', 'downvote']:
            print(f"Invalid action: {action}")
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get or create vote with proper topic
        content_type = ContentType.objects.get_for_model(self.model)
        vote, created = Vote.objects.get_or_create(
            user=request.user,
            content_type=content_type,
            object_id=obj.id,
            topic=topic,
            defaults={'value': 0}
        )
        print(f"Vote {'created' if created else 'retrieved'}: {vote.value}")

        # Perform voting action
        if action == 'upvote':
            print(f"Upvoting from current value: {vote.value}")
            vote_change = vote.upvote()
        elif action == 'downvote':
            print(f"Downvoting from current value: {vote.value}")
            vote_change = vote.downvote()
        
        print(f"Vote changed by: {vote_change}, new value: {vote.value}")

        # Update vote count
        vote_count = self.get_vote_count(obj, topic)
        old_count = vote_count.vote_count
        vote_count.update_vote_count(obj)
        print(f"Vote count updated from {old_count} to {vote_count.vote_count}")

        response_data = {
            "vote": vote.value,
            "vote_count": vote_count.vote_count
        }
        print(f"Returning response: {response_data}")
        return Response(response_data, status=status.HTTP_200_OK)

    def get(self, request, topic_pk, content_pk):
        print(f"Getting content vote status for topic {topic_pk}, content {content_pk}")
        topic = get_object_or_404(Topic, pk=topic_pk)
        obj = get_object_or_404(topic.contents, pk=content_pk)
        
        # Get vote count
        vote_count = self.get_vote_count(obj, topic)
        
        # Get user's vote
        content_type = ContentType.objects.get_for_model(self.model)
        vote = Vote.objects.filter(
            user=request.user,
            content_type=content_type,
            object_id=obj.id,
            topic=topic
        ).first()

        response_data = {
            "vote_count": vote_count.vote_count,
            "vote": vote.value if vote else 0
        }
        print(f"Returning vote status: {response_data}")
        return Response(response_data, status=status.HTTP_200_OK)


class CommentVoteView(BaseGetVoteView):
    model = Comment

    def post(self, request, pk):
        print(f"Comment vote request for comment {pk}: {request.data}")
        obj = get_object_or_404(self.model, pk=pk)
        action = request.data.get('action')
        
        if action not in ['upvote', 'downvote']:
            print(f"Invalid action: {action}")
            return Response({"error": "Invalid action"}, status=status.HTTP_400_BAD_REQUEST)
            
        return self.perform_vote_action(request, obj, action)
    