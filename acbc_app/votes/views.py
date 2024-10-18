from django.contrib.contenttypes.models import ContentType

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import get_object_or_404

from content.models import KnowledgePath
from votes.models import Vote, KnowledgePathVoteCount


class KnowledgePathVoteView(APIView):
    """ View for voting on KnowledgePaths. """

    def get(self, request, pk):
        """ Retrieve the vote count for a KnowledgePath. """
        knowledge_path = get_object_or_404(KnowledgePath, pk=pk)
        user = request.user

        # Ensure the KnowledgePath has a vote count record
        knowledge_path_vote_count, _ = KnowledgePathVoteCount.objects.get_or_create(
            knowledge_path=knowledge_path
        )

        # Retrieve or create the user's vote
        existing_vote, _ = Vote.objects.get_or_create(
            user=user,
            content_type=ContentType.objects.get_for_model(KnowledgePath),
            object_id=knowledge_path.id,
        )

        # Determine if the user has upvoted or downvoted
        vote = False if existing_vote.value == -1 else True

        return Response(
            {
                "vote_count": knowledge_path_vote_count.vote_count,
                "vote": vote
            },
            status=status.HTTP_200_OK,
        )


class KnowledgePathUpvoteView(APIView):
    """ View for upvoting a KnowledgePath. """

    def post(self, request, pk):
        """ Upvote a KnowledgePath. """
        knowledge_path = get_object_or_404(KnowledgePath, pk=pk)
        user = request.user

        # Get or create the user's vote for the KnowledgePath
        existing_vote, _ = Vote.objects.get_or_create(
            user=user,
            content_type=ContentType.objects.get_for_model(KnowledgePath),
            object_id=knowledge_path.id,
        )

        if existing_vote.value == 1:
            return Response(
                {"error": "You have already upvoted this KnowledgePath."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Set vote to upvote
        existing_vote.value = 1
        existing_vote.save()

        # Update the total vote count
        knowledge_path_vote_count, _ = KnowledgePathVoteCount.objects.get_or_create(
            knowledge_path=knowledge_path
        )
        knowledge_path_vote_count.update_vote_count(new_votes=1)

        return Response(
            {"vote": True},
            status=status.HTTP_200_OK,
        )


class KnowledgePathDownvoteView(APIView):
    """ View for downvoting a KnowledgePath. """

    def post(self, request, pk):
        """ Downvote a KnowledgePath. """
        knowledge_path = get_object_or_404(KnowledgePath, pk=pk)
        user = request.user

        # Get or create the user's vote for the KnowledgePath
        existing_vote, _ = Vote.objects.get_or_create(
            user=user,
            content_type=ContentType.objects.get_for_model(KnowledgePath),
            object_id=knowledge_path.id,
        )

        if existing_vote.value == -1:
            return Response(
                {"error": "You have already downvoted this KnowledgePath."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Prevent downvoting if no upvotes exist
        knowledge_path_vote_count, _ = KnowledgePathVoteCount.objects.get_or_create(
            knowledge_path=knowledge_path
        )
        if knowledge_path_vote_count.vote_count == 0:
            return Response(
                {"vote": False},
                status=status.HTTP_200_OK,
            )

        # Set vote to downvote
        existing_vote.value = -1
        existing_vote.save()
        knowledge_path_vote_count.update_vote_count(new_votes=-1)

        return Response(
            {"vote": False},
            status=status.HTTP_200_OK,
        )
