from django.contrib.contenttypes.models import ContentType

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import get_object_or_404

from content.models import KnowledgePath
from comments.permissions import IsAuthorOrAdmin
from comments.models import Comment
from comments.serializer import CommentSerializer, KnowledgePathCommentSerializer


class KnowledgePathCommentsView(APIView):
    """ View for retrieving comments on a KnowledgePath. """

    def get(self, request, pk):
        """ Retrieve comments for a KnowledgePath. """
        knowledge_path = get_object_or_404(KnowledgePath, pk=pk)
        comments = Comment.objects.filter(
            content_type=ContentType.objects.get_for_model(knowledge_path),
            object_id=knowledge_path.id,
            parent=None
        ).select_related('author')

        serializer = KnowledgePathCommentSerializer(comments, many=True)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK
        )

    def post(self, request, pk):
        """ Add a new comment to a KnowledgePath. """
        knowledge_path = get_object_or_404(KnowledgePath, pk=pk)
        user = request.user
        body = request.data.get('body')

        data = {
            "author": user.id,
            "body": body,
        }
        serializer = KnowledgePathCommentSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save(
            object_id=knowledge_path.id,
            content_type=ContentType.objects.get_for_model(knowledge_path)
        )

        return Response(
            {"success": "Comment added successfully."},
            status=status.HTTP_201_CREATED,
        )


class KnowledgePathCommentRepliesView(APIView):
    """ View for retrieving and adding replies to comments. """

    def get(self, request, pk):
        """ Retrieve replies for a comment. """
        comment = get_object_or_404(
            Comment.objects.prefetch_related('replies').select_related('author'),
            pk=pk
        )
        replies = comment.replies.all()
        serializer = KnowledgePathCommentSerializer(replies, many=True)

        return Response(
            serializer.data,
            status=status.HTTP_200_OK,
        )

    def post(self, request, pk):
        """ Add a new reply to a comment. """
        comment = get_object_or_404(Comment, pk=pk)
        user = request.user
        body = request.data.get('body')

        data = {
            "author": user.id,
            "body": body,
            "parent": comment.id,
        }
        serializer = KnowledgePathCommentSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save(
            object_id=comment.object_id,
            content_type=comment.content_type
        )

        return Response(
            {"success": "Reply added successfully."},
            status=status.HTTP_201_CREATED,
        )


class CommentView(APIView):
    """ View for updating and deleting comments. """
    permission_classes = [IsAuthorOrAdmin]

    def put(self, request, pk):
        """ Update a comment. """
        comment = get_object_or_404(Comment, pk=pk)
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
        comment = get_object_or_404(Comment, pk=pk)
        self.check_object_permissions(request, comment) # Check if the user is the author of the comment or an admin

        comment.delete()

        return Response(
            {"success": "Comment deleted successfully."},
            status=status.HTTP_200_OK,
        )