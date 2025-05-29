from django.contrib.contenttypes.models import ContentType
from django.http import Http404

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from utils.permissions import IsAuthor

from comments.managers import CommentManager
from content.models import Topic, Content
from comments.models import Comment
from comments.serializers import CommentSerializer, KnowledgePathCommentSerializer, ContentTopicCommentSerializer, \
    TopicCommentSerializer, CommentCreateSerializer
from knowledge_paths.models import KnowledgePath


class BaseCommentView(APIView):
    """ Base view for retrieving and adding comments. """

    def get_permissions(self):
        if self.request.method == 'GET':
            return []
        return super().get_permissions()

    def get_serializer_class(self):
        """ Override in subclasses to provide specific serializer. """
        raise NotImplementedError("Subclasses must implement get_serializer_class.")

    def get_queryset(self, **kwargs):
        """ Override in subclasses to customize the queryset retrieval. """
        raise NotImplementedError("Subclasses must implement get_queryset.")

    def get(self, request, *args, **kwargs):
        queryset = self.get_queryset(**kwargs)
        serializer = self.get_serializer_class()(queryset, many=True, context={'request': request})
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
        comment = self.save_serializer(serializer, **kwargs)
        
        # Return the serialized comment data
        return_serializer = self.get_serializer_class()(comment, context={'request': request})
        return Response(return_serializer.data, status=status.HTTP_201_CREATED)

    def save_serializer(self, serializer, **kwargs):
        """ Override to save with specific attributes. """
        raise NotImplementedError("Subclasses must implement save_serializer.")


class KnowledgePathCommentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        """Get all comments for a knowledge path"""
        knowledge_path = get_object_or_404(KnowledgePath, pk=pk)
        knowledge_path_type = ContentType.objects.get_for_model(KnowledgePath)
        
        # Get comments that:
        # 1. Are linked to a KnowledgePath via content_object
        # 2. Have no topic association (topic is null)
        # 3. Are top-level comments (no parent)
        # 4. Are active
        comments = Comment.objects.filter(
            content_type=knowledge_path_type,
            object_id=pk,
            topic__isnull=True,  # Ensure these are not topic-related comments
            parent=None,
            is_active=True
        ).order_by('-created_at')
        
        serializer = KnowledgePathCommentSerializer(comments, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request, pk):
        """Add a new comment to a knowledge path"""
        knowledge_path = get_object_or_404(KnowledgePath, pk=pk)
        knowledge_path_type = ContentType.objects.get_for_model(KnowledgePath)
        
        comment_data = {
            'body': request.data.get('body'),
            'content_type': knowledge_path_type.id,
            'object_id': pk,
            'author': request.user.id,
            'parent': request.data.get('parent'),
            # No topic field - it will default to null
        }
        
        serializer = CommentCreateSerializer(data=comment_data)
        if serializer.is_valid():
            comment = serializer.save()
            return_serializer = KnowledgePathCommentSerializer(comment, context={'request': request})
            return Response(return_serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TopicCommentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        """Get all comments for a topic"""
        topic = get_object_or_404(Topic, pk=pk)
        topic_type = ContentType.objects.get_for_model(Topic)
        
        # Get comments that:
        # 1. Are linked to the Topic via content_object
        # 2. Have no topic association (to distinguish from content+topic comments)
        # 3. Are active
        comments = Comment.objects.filter(
            content_type=topic_type,
            object_id=pk,
            topic__isnull=True,
            parent=None,
            is_active=True
        ).order_by('-created_at')
        
        serializer = TopicCommentSerializer(comments, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request, pk):
        """Add a new comment to a topic"""
        topic = get_object_or_404(Topic, pk=pk)
        topic_type = ContentType.objects.get_for_model(Topic)
        
        comment_data = {
            'body': request.data.get('body'),
            'content_type': topic_type.id,
            'object_id': pk,
            'author': request.user.id,
            'parent': request.data.get('parent'),
            # No topic field - it will default to null
        }
        
        serializer = CommentCreateSerializer(data=comment_data)
        if serializer.is_valid():
            comment = serializer.save()
            return_serializer = TopicCommentSerializer(comment, context={'request': request})
            return Response(return_serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


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
        comment = serializer.save(
            object_id=content.id,
            content_type=ContentType.objects.get_for_model(Content),
            topic=topic
        )
        return comment


class BaseCommentRepliesView(APIView):
    """ Base view for retrieving and adding replies to comments. """

    def get_permissions(self):
        if self.request.method == 'GET':
            return []
        return super().get_permissions()

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
        serializer = self.get_serializer_class()(replies, many=True, context={'request': request})

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


class KnowledgePathCommentRepliesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        """Get all replies for a knowledge path comment"""
        parent_comment = get_object_or_404(Comment, pk=pk, is_active=True)
        replies = Comment.objects.filter(parent=parent_comment, is_active=True).order_by('created_at')
        serializer = KnowledgePathCommentSerializer(replies, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request, pk):
        """Add a reply to a knowledge path comment"""
        parent_comment = get_object_or_404(Comment, pk=pk)
        
        serializer = CommentCreateSerializer(data={
            'body': request.data.get('body'),
            'knowledge_path': parent_comment.knowledge_path.id,
            'parent': parent_comment.id,
            'author': request.user.id
        })
        
        if serializer.is_valid():
            comment = serializer.save()
            return_serializer = KnowledgePathCommentSerializer(comment, context={'request': request})
            return Response(return_serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


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
    """ View for retrieving, updating and deleting comments. """
    permission_classes = [IsAuthor]

    def get(self, request, pk):
        """Get a specific comment"""
        comment = get_object_or_404(Comment, pk=pk, is_active=True)
        serializer = CommentSerializer(comment, context={'request': request})
        return Response(serializer.data)

    def put(self, request, pk):
        """ Update a comment. """
        try:
            comment = get_object_or_404(Comment, pk=pk)
            self.check_object_permissions(request, comment)

            body = request.data.get('body')
            if not body:
                return Response(
                    {"error": "Comment body is required."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            comment.body = body
            comment.is_edited = True
            comment.save()

            # Return the updated comment data
            serializer = CommentSerializer(comment, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Comment.DoesNotExist:
            raise
        except Exception as e:
            raise

    def delete(self, request, pk):
        """ Delete a comment. """
        try:
            comment = get_object_or_404(Comment, pk=pk)
            self.check_object_permissions(request, comment)
            
            # Delete the comment
            Comment.objects.logic_delete(comment)

            return Response(status=status.HTTP_204_NO_CONTENT)
        except Comment.DoesNotExist:
            raise
        except Exception as e:
            raise


class CommentRepliesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        """Get all replies for a comment"""
        try:
            parent_comment = get_object_or_404(Comment, pk=pk, is_active=True)
            replies = Comment.objects.filter(parent=parent_comment, is_active=True).order_by('created_at')
            serializer = CommentSerializer(replies, many=True, context={'request': request})
            return Response(serializer.data)
        except Comment.DoesNotExist:
            raise
        except Exception as e:
            raise

    def post(self, request, pk):
        """Add a reply to a comment"""
        parent_comment = get_object_or_404(Comment, pk=pk)
        
        # Inherit content_type and object_id from parent comment
        comment_data = {
            'body': request.data.get('body'),
            'content_type': parent_comment.content_type.id,
            'object_id': parent_comment.object_id,
            'author': request.user.id,
            'parent': parent_comment.id,
            'topic': parent_comment.topic_id  # Will be None for non-topic comments
        }
        
        serializer = CommentCreateSerializer(data=comment_data)
        if serializer.is_valid():
            comment = serializer.save()
            # Use CommentSerializer for the response to include all fields
            return_serializer = CommentSerializer(comment, context={'request': request})
            return Response(return_serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)