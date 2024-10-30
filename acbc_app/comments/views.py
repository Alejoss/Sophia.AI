from django.contrib.contenttypes.models import ContentType
from django.http import Http404

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import get_object_or_404

from comments.managers import CommentManager
from content.models import KnowledgePath, Topic, Content
from comments.permissions import IsAuthor
from comments.models import Comment
from comments.serializers import CommentSerializer, KnowledgePathCommentSerializer, ContentTopicCommentSerializer, \
    TopicCommentSerializer


class BaseCommentView(APIView):
    """ Base view for retrieving and adding comments. """

    def get_serializer_class(self):
        """ Override in subclasses to provide specific serializer. """
        raise NotImplementedError("Subclasses must implement get_serializer_class.")

    def get_queryset(self, **kwargs):
        """ Override in subclasses to customize the queryset retrieval. """
        raise NotImplementedError("Subclasses must implement get_queryset.")

    def get(self, request, *args, **kwargs):
        queryset = self.get_queryset(**kwargs)
        serializer = self.get_serializer_class()(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, *args, **kwargs):
        user = request.user
        body = request.data.get('body')
        data = {
            "author": user.id,
            "body": body,
        }

        serializer = self.get_serializer_class()(data=data)
        serializer.is_valid(raise_exception=True)
        self.save_serializer(serializer, **kwargs)

        return Response({"success": "Comment added successfully."}, status=status.HTTP_201_CREATED)

    def save_serializer(self, serializer, **kwargs):
        """ Override to save with specific attributes. """
        raise NotImplementedError("Subclasses must implement save_serializer.")


class KnowledgePathCommentsView(BaseCommentView):
    """ View for retrieving and adding comments on a KnowledgePath. """

    def get_serializer_class(self):
        return KnowledgePathCommentSerializer

    def get_queryset(self, pk):
        knowledge_path = get_object_or_404(KnowledgePath, pk=pk)
        return Comment.objects.filter(
            content_type=ContentType.objects.get_for_model(knowledge_path),
            object_id=knowledge_path.id,
            parent=None,
            is_active=True
        ).select_related('author')

    def save_serializer(self, serializer, pk):
        knowledge_path = get_object_or_404(KnowledgePath, pk=pk)
        serializer.save(
            object_id=knowledge_path.id,
            content_type=ContentType.objects.get_for_model(knowledge_path)
        )


class TopicCommentsView(BaseCommentView):
    """ View for retrieving and adding comments on a Topic. """

    def get_serializer_class(self):
        return TopicCommentSerializer

    def get_queryset(self, pk):
        topic = get_object_or_404(Topic, pk=pk)
        return Comment.objects.filter(
            content_type=ContentType.objects.get_for_model(Topic),
            object_id=topic.id,
            topic=topic,
            parent=None,
            is_active=True
        ).select_related('author')

    def save_serializer(self, serializer, pk):
        topic = get_object_or_404(Topic, pk=pk)
        serializer.save(
            object_id=topic.id,
            content_type=ContentType.objects.get_for_model(Topic),
            topic=topic
        )


class ContentTopicCommentsView(BaseCommentView):
    """ View for retrieving and adding comments on a Content for specific Topic. """

    def get_serializer_class(self):
        return ContentTopicCommentSerializer

    def get_queryset(self, topic_pk, content_pk):
        topic = get_object_or_404(Topic, pk=topic_pk)
        content = get_object_or_404(topic.contents, pk=content_pk)
        return Comment.objects.filter(
            content_type=ContentType.objects.get_for_model(Content),
            object_id=content.id,
            topic=topic,
            parent=None,
            is_active=True
        ).select_related('author')

    def save_serializer(self, serializer, topic_pk, content_pk):
        topic = get_object_or_404(Topic, pk=topic_pk)
        content = get_object_or_404(topic.contents, pk=content_pk)
        serializer.save(
            object_id=content.id,
            content_type=ContentType.objects.get_for_model(Content),
            topic=topic
        )


class BaseCommentRepliesView(APIView):
    """ Base view for retrieving and adding replies to comments. """

    def get_serializer_class(self):
        """ Override this method in subclasses to provide specific serializer. """
        raise NotImplementedError("Subclasses must implement get_serializer_class.")

    def validate_comment(self, comment):
        """ Checks if comment's topic presence is valid for the view type. """
        if (self.requires_topic and comment.topic is None) or (not self.requires_topic and comment.topic is not None):
            raise Http404("Comment not found.")

    def get(self, request, pk):
        comment = get_object_or_404(
            Comment.objects.prefetch_related('replies').select_related('author'),
            pk=pk,
            is_active=True
        )
        self.validate_comment(comment)

        replies = comment.replies.all()
        serializer = self.get_serializer_class()(replies, many=True)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    def post(self, request, pk):
        comment = get_object_or_404(Comment, pk=pk)
        user = request.user
        body = request.data.get('body')

        data = {
            "author": user.id,
            "body": body,
            "parent": comment.id,
        }
        serializer = self.get_serializer_class()(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save(
            object_id=comment.object_id,
            content_type=comment.content_type,
            topic=getattr(comment, 'topic', None)  # Adding topic if exists
        )

        return Response(
            {"success": "Reply added successfully."},
            status=status.HTTP_201_CREATED,
        )


class KnowledgePathCommentRepliesView(BaseCommentRepliesView):
    """ View for retrieving and adding replies to comments for KnowledgePath. """
    requires_topic = False

    def get_serializer_class(self):
        return KnowledgePathCommentSerializer


class TopicCommentRepliesView(BaseCommentRepliesView):
    """ View for retrieving and adding replies to comments for Topic. """
    requires_topic = True

    def get_serializer_class(self):
        return TopicCommentSerializer


class ContentTopicCommentRepliesView(BaseCommentRepliesView):
    """ View for retrieving and adding replies to comments for ContentTopic. """
    requires_topic = True

    def get_serializer_class(self):
        return ContentTopicCommentSerializer


class CommentView(APIView):
    """ View for updating and deleting comments. """
    permission_classes = [IsAuthor]

    def put(self, request, pk):
        """ Update a comment. """
        comment = get_object_or_404(Comment, pk=pk, is_active=True)
        self.check_object_permissions(request, comment) # Check if the user is the author of the comment or an admin

        user = request.user
        body = request.data.get('body')

        data = {
            "author": user.id,
            "body": body,
        }
        serializer = CommentSerializer(data=data)
        serializer.is_valid(raise_exception=True)

        comment.body = body
        comment.save()

        return Response(
            {"success": "Comment updated successfully."},
            status=status.HTTP_200_OK,
        )

    def delete(self, request, pk):
        """ Delete a comment. """
        comment = get_object_or_404(Comment, pk=pk, is_active=True)
        self.check_object_permissions(request, comment) # Check if the user is the author of the comment or an admin

        Comment.objects.logic_delete(comment) # Call the custom manager method to logically delete the comment

        return Response(
            {"success": "Comment deleted successfully."},
            status=status.HTTP_200_OK,
        )