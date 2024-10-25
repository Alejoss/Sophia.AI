from django.contrib.contenttypes.models import ContentType

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import get_object_or_404

from content.models import KnowledgePath, Topic, Content
from events.models import ConnectionPlatform
from votes.models import Vote, KnowledgePathVoteCount, ContentVoteTopicCount


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

        existing_vote = Vote.objects.filter(
            user=user,
            content_type=ContentType.objects.get_for_model(KnowledgePath),
            object_id=knowledge_path.id
        ).first()

        if existing_vote:
            return Response(
                {
                    "vote_count": knowledge_path_vote_count.vote_count,
                    "vote": existing_vote.value
                },
                status=status.HTTP_200_OK,
            )

        # Return the vote count with no vote if the user has not voted
        return Response(
            {
                "vote_count": knowledge_path_vote_count.vote_count,
                "vote": 0
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

        new_vote = existing_vote.upvote()

        # Update the total vote count
        knowledge_path_vote_count, _ = KnowledgePathVoteCount.objects.get_or_create(
            knowledge_path=knowledge_path
        )
        knowledge_path_vote_count.update_vote_count(new_votes=new_vote)

        return Response(
            {"vote": existing_vote.value},
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

        new_vote = existing_vote.downvote()

        knowledge_path_vote_count, _ = KnowledgePathVoteCount.objects.get_or_create(
            knowledge_path=knowledge_path
        )
        knowledge_path_vote_count.update_vote_count(new_votes=new_vote)

        return Response(
            {"vote": existing_vote.value},
            status=status.HTTP_200_OK,
        )


class ContentVoteTopicView(APIView):
    """ View for voting on Content of specific Topic. """

    def get(self, request, topic_pk, content_pk):
        topic = get_object_or_404(Topic, pk=topic_pk)
        content = get_object_or_404(topic.contents, pk=content_pk)
        user = request.user

        content_vote_topic_count, _ = ContentVoteTopicCount.objects.get_or_create(
            topic=topic,
            content=content
        )

        existing_vote = Vote.objects.filter(
            user=user,
            content_type=ContentType.objects.get_for_model(Content),
            object_id=content.id,
            topic=topic
        ).first()

        if existing_vote:
            return Response(
                {
                    "vote_count": content_vote_topic_count.vote_count,
                    "vote": existing_vote.value
                },
                status=status.HTTP_200_OK,
            )

        # Return the vote count with no vote if the user has not voted
        return Response(
            {
                "vote_count": content_vote_topic_count.vote_count,
                "vote": 0
            },
            status=status.HTTP_200_OK,
        )


class ContentUpvoteTopicView(APIView):
    """ View for upvoting a Content of specific Topic. """

    def post(self, request, topic_pk, content_pk):
        topic = get_object_or_404(Topic, pk=topic_pk)
        content = get_object_or_404(topic.contents, pk=content_pk)
        user = request.user

        existing_vote, _ = Vote.objects.get_or_create(
            user=user,
            content_type=ContentType.objects.get_for_model(Content),
            object_id=content.id,
            topic=topic
        )

        new_vote = existing_vote.upvote()

        # Update the total vote count
        content_vote_topic_count, _ = ContentVoteTopicCount.objects.get_or_create(
            topic=topic,
            content=content
        )
        content_vote_topic_count.update_vote_count(new_votes=new_vote)

        return Response(
            {"vote": existing_vote.value},
            status=status.HTTP_200_OK,
        )


class ContentDownvoteTopicView(APIView):
    """ View for downvoting a Content of specific Topic. """

    def post(self, request, topic_pk, content_pk):
        topic = get_object_or_404(Topic, pk=topic_pk)
        content = get_object_or_404(topic.contents, pk=content_pk)
        user = request.user

        existing_vote, _ = Vote.objects.get_or_create(
            user=user,
            content_type=ContentType.objects.get_for_model(Content),
            object_id=content.id,
            topic=topic
        )

        new_vote = existing_vote.downvote()

        content_vote_topic_count, _ = ContentVoteTopicCount.objects.get_or_create(
            topic=topic,
            content=content
        )
        content_vote_topic_count.update_vote_count(new_votes=new_vote)

        return Response(
            {"vote": existing_vote.value},
            status=status.HTTP_200_OK,
        )