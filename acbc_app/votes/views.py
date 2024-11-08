from django.contrib.contenttypes.models import ContentType

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import get_object_or_404

from comments.models import Comment
from content.models import KnowledgePath, Topic, Content
from events.models import ConnectionPlatform
from votes.models import Vote, ContentVoteTopicCount


class BaseVoteView(APIView):
    """Base class for handling voting actions."""

    model = None
    vote_count_model = None
    vote_related_field = None
    vote_count_related_field = None

    def get_vote_count_instance(self, obj, topic):
        """Retrieve or create the vote count instance based on provided kwargs."""
        if not self.vote_count_model:
            return obj # Return the object itself, this model has vote count

        vote_count_instance, _ = self.vote_count_model.objects.get_or_create(
            **{self.vote_related_field: obj, 'topic': topic}
        )
        return vote_count_instance

    def get_vote(self, user, obj_id):
        """Retrieve the user's vote for a specific object and topic, if applicable."""
        return Vote.objects.filter(
            user=user,
            content_type=ContentType.objects.get_for_model(self.model),
            object_id=obj_id,
        ).first()

    def perform_vote_action(self, request, obj, vote_method, topic=None):
        user = request.user

        # Get or create vote
        existing_vote, _ = Vote.objects.get_or_create(
            user=user,
            content_type=ContentType.objects.get_for_model(self.model),
            object_id=obj.id,
        )

        # Perform voting action
        new_vote = getattr(existing_vote, vote_method)()

        # Update the vote count
        vote_count_instance = self.get_vote_count_instance(obj, topic)
        vote_count_instance.update_vote_count(new_votes=new_vote)

        return Response({"vote": existing_vote.value}, status=status.HTTP_200_OK)


class BaseGetVoteView(BaseVoteView):
    """Base class for retrieving the vote count and user's vote."""

    def get_permissions(self):
        print("GET PERMISSIONS")
        if self.request.method == 'GET':
            return []
        return super().get_permissions_classes()

    def get(self, request, pk, topic_pk=None):
        obj = get_object_or_404(self.model, pk=pk)
        topic = None

        if topic_pk:
            topic = get_object_or_404(Topic, pk=topic_pk)
            obj = get_object_or_404(topic.contents, pk=pk)

        vote_count_instance = self.get_vote_count_instance(obj, topic)
        existing_vote = self.get_vote(request.user, obj.id) if request.user.is_authenticated else None

        vote_count = getattr(vote_count_instance, self.vote_count_related_field)
        vote = existing_vote.value if existing_vote else 0 # Return 0 if no vote exists

        return Response(
            {
                "vote_count": vote_count,
                "vote": vote
            },
            status=status.HTTP_200_OK,
        )


class KnowledgePathUpvoteView(BaseVoteView):
    model = KnowledgePath
    vote_count_related_field = 'votes'

    def post(self, request, pk):
        obj = get_object_or_404(self.model, pk=pk)
        return self.perform_vote_action(request, obj, 'upvote')


class KnowledgePathDownvoteView(BaseVoteView):
    model = KnowledgePath
    vote_count_related_field = 'votes'

    def post(self, request, pk):
        obj = get_object_or_404(self.model, pk=pk)
        return self.perform_vote_action(request, obj, 'downvote')


class ContentVoteTopicView(BaseGetVoteView):
    model = Content
    vote_count_model = ContentVoteTopicCount
    vote_related_field = 'content'
    vote_count_related_field = 'vote_count'

    def get(self, request, topic_pk, content_pk):
        return super().get(request, content_pk, topic_pk)


class ContentUpvoteTopicView(BaseVoteView):
    model = Content
    vote_count_model = ContentVoteTopicCount
    vote_related_field = 'content'
    vote_count_related_field = 'vote_count'

    def post(self, request, topic_pk, content_pk):
        topic = get_object_or_404(Topic, pk=topic_pk)
        obj = get_object_or_404(topic.contents, pk=content_pk)
        return self.perform_vote_action(request, obj, 'upvote', topic)


class ContentDownvoteTopicView(BaseVoteView):
    model = Content
    vote_count_model = ContentVoteTopicCount
    vote_related_field = 'content'
    vote_count_related_field = 'vote_count'

    def post(self, request, topic_pk, content_pk):
        topic = get_object_or_404(Topic, pk=topic_pk)
        obj = get_object_or_404(topic.contents, pk=content_pk)
        return self.perform_vote_action(request, obj, 'downvote', topic)


class CommentUpvoteView(BaseVoteView):
    model = Comment
    vote_count_related_field = 'votes'

    def post(self, request, pk):
        obj = get_object_or_404(self.model, pk=pk)
        return self.perform_vote_action(request, obj, 'upvote')


class CommentDownvoteView(BaseVoteView):
    model = Comment
    vote_count_related_field = 'votes'

    def post(self, request, pk):
        obj = get_object_or_404(self.model, pk=pk)
        return self.perform_vote_action(request, obj, 'downvote')