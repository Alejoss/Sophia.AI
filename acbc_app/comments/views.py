from django.contrib.contenttypes.models import ContentType
from django.http import Http404
from notifications.signals import notify

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from utils.permissions import IsAuthor
from utils.notification_utils import notify_comment_reply, notify_knowledge_path_comment, notify_content_comment

from comments.managers import CommentManager
from content.models import Topic, Content
from comments.models import Comment
from comments.serializers import CommentSerializer, KnowledgePathCommentSerializer, ContentTopicCommentSerializer, \
    TopicCommentSerializer, CommentCreateSerializer
from knowledge_paths.models import KnowledgePath
from utils.logging_utils import comments_logger, log_error, log_business_event, log_performance_metric


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
        try:
            comments_logger.debug("Comment list request", extra={
                'user_id': request.user.id if request.user.is_authenticated else None,
                'view_type': self.__class__.__name__,
            })
            
            queryset = self.get_queryset(**kwargs)
            serializer = self.get_serializer_class()(queryset, many=True, context={'request': request})
            
            comments_logger.debug("Comment list retrieved successfully", extra={
                'user_id': request.user.id if request.user.is_authenticated else None,
                'view_type': self.__class__.__name__,
                'comment_count': len(queryset),
            })
            
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Exception as e:
            log_error(e, "Error retrieving comment list", request.user.id if request.user.is_authenticated else None, {
                'view_type': self.__class__.__name__,
            })
            return Response(
                {'error': 'An error occurred while retrieving comments'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def post(self, request, *args, **kwargs):
        try:
            user = request.user
            body = request.data.get('body')
            
            comments_logger.info("Comment creation request", extra={
                'user_id': user.id,
                'username': user.username,
                'view_type': self.__class__.__name__,
                'body_length': len(body) if body else 0,
            })
            
            data = {
                "author": user.id,
                "body": body,
            }

            serializer = self.get_serializer_class()(data=data)
            serializer.is_valid(raise_exception=True)
            comment = self.save_serializer(serializer, **kwargs)
            
            comments_logger.info("Comment created successfully", extra={
                'user_id': user.id,
                'comment_id': comment.id,
                'view_type': self.__class__.__name__,
            })
            
            # Log business event
            log_business_event(
                event_type="comment_created",
                user_id=user.id,
                object_id=comment.id,
                object_type='comment',
                extra={
                    'view_type': self.__class__.__name__,
                    'body_length': len(comment.body),
                }
            )
            
            # Return the serialized comment data
            return_serializer = self.get_serializer_class()(comment, context={'request': request})
            return Response(return_serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            log_error(e, "Error creating comment", request.user.id, {
                'view_type': self.__class__.__name__,
                'body': request.data.get('body'),
            })
            return Response(
                {'error': 'An error occurred while creating the comment'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def save_serializer(self, serializer, **kwargs):
        """ Override to save with specific attributes. """
        raise NotImplementedError("Subclasses must implement save_serializer.")


class KnowledgePathCommentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        """Get all comments for a knowledge path"""
        try:
            comments_logger.debug("Knowledge path comments request", extra={
                'user_id': request.user.id,
                'knowledge_path_id': pk,
            })
            
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
            
            comments_logger.debug("Knowledge path comments retrieved successfully", extra={
                'user_id': request.user.id,
                'knowledge_path_id': pk,
                'comment_count': len(comments),
            })
            
            return Response(serializer.data)
        except Exception as e:
            log_error(e, "Error retrieving knowledge path comments", request.user.id, {
                'knowledge_path_id': pk,
            })
            return Response(
                {'error': 'An error occurred while retrieving comments'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def post(self, request, pk):
        """Add a new comment to a knowledge path"""
        try:
            comments_logger.info("Knowledge path comment creation request", extra={
                'user_id': request.user.id,
                'username': request.user.username,
                'knowledge_path_id': pk,
                'body_length': len(request.data.get('body', '')),
            })
            
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
                
                comments_logger.info("Knowledge path comment created successfully", extra={
                    'user_id': request.user.id,
                    'comment_id': comment.id,
                    'knowledge_path_id': pk,
                    'is_reply': bool(comment.parent),
                })
                
                # Send notification to knowledge path author if this is a top-level comment
                if not comment.parent and knowledge_path.author and knowledge_path.author != request.user:
                    try:
                        notify_knowledge_path_comment(comment)
                        comments_logger.debug("Knowledge path comment notification sent", extra={
                            'user_id': request.user.id,
                            'comment_id': comment.id,
                            'knowledge_path_id': pk,
                            'author_id': knowledge_path.author.id,
                        })
                    except Exception as e:
                        comments_logger.error("Failed to send knowledge path comment notification", extra={
                            'user_id': request.user.id,
                            'comment_id': comment.id,
                            'knowledge_path_id': pk,
                            'error': str(e),
                        }, exc_info=True)
                
                # Log business event
                log_business_event(
                    event_type="knowledge_path_comment_created",
                    user_id=request.user.id,
                    object_id=comment.id,
                    object_type='comment',
                    extra={
                        'knowledge_path_id': pk,
                        'is_reply': bool(comment.parent),
                    }
                )
                
                return_serializer = KnowledgePathCommentSerializer(comment, context={'request': request})
                return Response(return_serializer.data, status=status.HTTP_201_CREATED)
            else:
                comments_logger.warning("Knowledge path comment creation failed - validation errors", extra={
                    'user_id': request.user.id,
                    'knowledge_path_id': pk,
                    'errors': serializer.errors,
                })
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            log_error(e, "Error creating knowledge path comment", request.user.id, {
                'knowledge_path_id': pk,
                'request_data': request.data,
            })
            return Response(
                {'error': 'An error occurred while creating the comment'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TopicCommentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        """Get all comments for a topic"""
        try:
            comments_logger.debug("Topic comments request", extra={
                'user_id': request.user.id,
                'topic_id': pk,
            })
            
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
            
            comments_logger.debug("Topic comments retrieved successfully", extra={
                'user_id': request.user.id,
                'topic_id': pk,
                'comment_count': len(comments),
            })
            
            return Response(serializer.data)
        except Exception as e:
            log_error(e, "Error retrieving topic comments", request.user.id, {
                'topic_id': pk,
            })
            return Response(
                {'error': 'An error occurred while retrieving comments'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def post(self, request, pk):
        """Add a new comment to a topic"""
        try:
            comments_logger.info("Topic comment creation request", extra={
                'user_id': request.user.id,
                'username': request.user.username,
                'topic_id': pk,
                'body_length': len(request.data.get('body', '')),
            })
            
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
                
                comments_logger.info("Topic comment created successfully", extra={
                    'user_id': request.user.id,
                    'comment_id': comment.id,
                    'topic_id': pk,
                    'is_reply': bool(comment.parent),
                })
                
                # Log business event
                log_business_event(
                    event_type="topic_comment_created",
                    user_id=request.user.id,
                    object_id=comment.id,
                    object_type='comment',
                    extra={
                        'topic_id': pk,
                        'is_reply': bool(comment.parent),
                    }
                )
                
                return_serializer = TopicCommentSerializer(comment, context={'request': request})
                return Response(return_serializer.data, status=status.HTTP_201_CREATED)
            else:
                comments_logger.warning("Topic comment creation failed - validation errors", extra={
                    'user_id': request.user.id,
                    'topic_id': pk,
                    'errors': serializer.errors,
                })
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            log_error(e, "Error creating topic comment", request.user.id, {
                'topic_id': pk,
                'request_data': request.data,
            })
            return Response(
                {'error': 'An error occurred while creating the comment'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
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
        comment = serializer.save(
            object_id=content.id,
            content_type=ContentType.objects.get_for_model(Content),
            topic=topic
        )
        
        # Get the content profile for this content
        content_profile = content.profiles.filter(user=content.uploaded_by).first()
        if content_profile:
            # Set the content_object to the content profile for notification purposes
            comment.content_object = content_profile
            comment.save()
            
            # Send notification to content owner if this is a top-level comment
            if not comment.parent and content_profile.user and content_profile.user != self.request.user:
                try:
                    notify_content_comment(comment)
                    comments_logger.debug("Content comment notification sent", extra={
                        'user_id': self.request.user.id,
                        'comment_id': comment.id,
                        'content_id': content.id,
                        'topic_id': topic.id,
                        'content_owner_id': content_profile.user.id,
                    })
                except Exception as e:
                    comments_logger.error("Failed to send content comment notification", extra={
                        'user_id': self.request.user.id,
                        'comment_id': comment.id,
                        'content_id': content.id,
                        'topic_id': topic.id,
                        'error': str(e),
                    }, exc_info=True)
        
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
        try:
            comments_logger.debug("Comment replies request", extra={
                'user_id': request.user.id if request.user.is_authenticated else None,
                'comment_id': pk,
                'view_type': self.__class__.__name__,
            })
            
            comment = get_object_or_404(
                Comment.objects.prefetch_related('replies').select_related('author'),
                pk=pk,
                is_active=True
            )
            self.validate_comment(comment)

            replies = comment.replies.all()
            serializer = self.get_serializer_class()(replies, many=True, context={'request': request})

            comments_logger.debug("Comment replies retrieved successfully", extra={
                'user_id': request.user.id if request.user.is_authenticated else None,
                'comment_id': pk,
                'view_type': self.__class__.__name__,
                'reply_count': len(replies),
            })

            return Response(
                serializer.data,
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            log_error(e, "Error retrieving comment replies", request.user.id if request.user.is_authenticated else None, {
                'comment_id': pk,
                'view_type': self.__class__.__name__,
            })
            return Response(
                {'error': 'An error occurred while retrieving replies'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def post(self, request, pk):
        try:
            comments_logger.info("Comment reply creation request", extra={
                'user_id': request.user.id,
                'username': request.user.username,
                'comment_id': pk,
                'view_type': self.__class__.__name__,
                'body_length': len(request.data.get('body', '')),
            })
            
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
            reply = serializer.save(
                object_id=comment.object_id,
                content_type=comment.content_type,
                topic=getattr(comment, 'topic', None)  # Adding topic if exists
            )

            comments_logger.info("Comment reply created successfully", extra={
                'user_id': request.user.id,
                'reply_id': reply.id,
                'comment_id': pk,
                'view_type': self.__class__.__name__,
            })
            
            # Log business event
            log_business_event(
                event_type="comment_reply_created",
                user_id=request.user.id,
                object_id=reply.id,
                object_type='comment',
                extra={
                    'parent_comment_id': pk,
                    'view_type': self.__class__.__name__,
                }
            )

            return Response(
                {"success": "Reply added successfully."},
                status=status.HTTP_201_CREATED,
            )
        except Exception as e:
            log_error(e, "Error creating comment reply", request.user.id, {
                'comment_id': pk,
                'view_type': self.__class__.__name__,
                'body': request.data.get('body'),
            })
            return Response(
                {'error': 'An error occurred while creating the reply'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class KnowledgePathCommentRepliesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        """Get all replies for a knowledge path comment"""
        try:
            comments_logger.debug("Knowledge path comment replies request", extra={
                'user_id': request.user.id,
                'comment_id': pk,
            })
            
            parent_comment = get_object_or_404(Comment, pk=pk, is_active=True)
            replies = Comment.objects.filter(parent=parent_comment, is_active=True).order_by('created_at')
            serializer = KnowledgePathCommentSerializer(replies, many=True, context={'request': request})
            
            comments_logger.debug("Knowledge path comment replies retrieved successfully", extra={
                'user_id': request.user.id,
                'comment_id': pk,
                'reply_count': len(replies),
            })
            
            return Response(serializer.data)
        except Exception as e:
            log_error(e, "Error retrieving knowledge path comment replies", request.user.id, {
                'comment_id': pk,
            })
            return Response(
                {'error': 'An error occurred while retrieving replies'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def post(self, request, pk):
        """Add a reply to a knowledge path comment"""
        try:
            comments_logger.info("Knowledge path comment reply creation request", extra={
                'user_id': request.user.id,
                'username': request.user.username,
                'comment_id': pk,
                'body_length': len(request.data.get('body', '')),
            })
            
            parent_comment = get_object_or_404(Comment, pk=pk)
            
            serializer = CommentCreateSerializer(data={
                'body': request.data.get('body'),
                'knowledge_path': parent_comment.knowledge_path.id,
                'parent': parent_comment.id,
                'author': request.user.id
            })
            
            if serializer.is_valid():
                comment = serializer.save()
                
                comments_logger.info("Knowledge path comment reply created successfully", extra={
                    'user_id': request.user.id,
                    'reply_id': comment.id,
                    'comment_id': pk,
                })
                
                # Log business event
                log_business_event(
                    event_type="knowledge_path_comment_reply_created",
                    user_id=request.user.id,
                    object_id=comment.id,
                    object_type='comment',
                    extra={
                        'parent_comment_id': pk,
                    }
                )
                
                return_serializer = KnowledgePathCommentSerializer(comment, context={'request': request})
                return Response(return_serializer.data, status=status.HTTP_201_CREATED)
            else:
                comments_logger.warning("Knowledge path comment reply creation failed - validation errors", extra={
                    'user_id': request.user.id,
                    'comment_id': pk,
                    'errors': serializer.errors,
                })
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            log_error(e, "Error creating knowledge path comment reply", request.user.id, {
                'comment_id': pk,
                'request_data': request.data,
            })
            return Response(
                {'error': 'An error occurred while creating the reply'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


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
        try:
            comments_logger.debug("Comment detail request", extra={
                'user_id': request.user.id if request.user.is_authenticated else None,
                'comment_id': pk,
            })
            
            comment = get_object_or_404(Comment, pk=pk, is_active=True)
            serializer = CommentSerializer(comment, context={'request': request})
            
            comments_logger.debug("Comment detail retrieved successfully", extra={
                'user_id': request.user.id if request.user.is_authenticated else None,
                'comment_id': pk,
            })
            
            return Response(serializer.data)
        except Exception as e:
            log_error(e, "Error retrieving comment detail", request.user.id if request.user.is_authenticated else None, {
                'comment_id': pk,
            })
            return Response(
                {'error': 'An error occurred while retrieving the comment'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def put(self, request, pk):
        """ Update a comment. """
        try:
            comments_logger.info("Comment update request", extra={
                'user_id': request.user.id,
                'username': request.user.username,
                'comment_id': pk,
                'body_length': len(request.data.get('body', '')),
            })
            
            comment = get_object_or_404(Comment, pk=pk)
            self.check_object_permissions(request, comment)

            body = request.data.get('body')
            if not body:
                comments_logger.warning("Comment update failed - missing body", extra={
                    'user_id': request.user.id,
                    'comment_id': pk,
                })
                return Response(
                    {"error": "Comment body is required."},
                    status=status.HTTP_400_BAD_REQUEST
                )

            comment.body = body
            comment.is_edited = True
            comment.save()

            comments_logger.info("Comment updated successfully", extra={
                'user_id': request.user.id,
                'comment_id': pk,
            })
            
            # Log business event
            log_business_event(
                event_type="comment_updated",
                user_id=request.user.id,
                object_id=pk,
                object_type='comment',
            )

            # Return the updated comment data
            serializer = CommentSerializer(comment, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
        except Comment.DoesNotExist:
            comments_logger.warning("Comment update failed - comment not found", extra={
                'user_id': request.user.id,
                'comment_id': pk,
            })
            raise
        except Exception as e:
            log_error(e, "Error updating comment", request.user.id, {
                'comment_id': pk,
                'request_data': request.data,
            })
            return Response(
                {'error': 'An error occurred while updating the comment'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def delete(self, request, pk):
        """ Delete a comment. """
        try:
            comments_logger.info("Comment deletion request", extra={
                'user_id': request.user.id,
                'username': request.user.username,
                'comment_id': pk,
            })
            
            comment = get_object_or_404(Comment, pk=pk)
            self.check_object_permissions(request, comment)
            
            # Delete the comment
            Comment.objects.logic_delete(comment)

            comments_logger.info("Comment deleted successfully", extra={
                'user_id': request.user.id,
                'comment_id': pk,
            })
            
            # Log business event
            log_business_event(
                event_type="comment_deleted",
                user_id=request.user.id,
                object_id=pk,
                object_type='comment',
            )

            return Response(status=status.HTTP_204_NO_CONTENT)
        except Comment.DoesNotExist:
            comments_logger.warning("Comment deletion failed - comment not found", extra={
                'user_id': request.user.id,
                'comment_id': pk,
            })
            return Response(
                {'error': 'Comment not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            log_error(e, "Error deleting comment", request.user.id, {
                'comment_id': pk,
            })
            return Response(
                {'error': 'An error occurred while deleting the comment'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CommentRepliesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        """Get all replies for a comment"""
        try:
            comments_logger.debug("Comment replies request", extra={
                'user_id': request.user.id,
                'comment_id': pk,
            })
            
            parent_comment = get_object_or_404(Comment, pk=pk, is_active=True)
            replies = Comment.objects.filter(parent=parent_comment, is_active=True).order_by('created_at')
            serializer = CommentSerializer(replies, many=True, context={'request': request})
            
            comments_logger.debug("Comment replies retrieved successfully", extra={
                'user_id': request.user.id,
                'comment_id': pk,
                'reply_count': len(replies),
            })
            
            return Response(serializer.data)
        except Comment.DoesNotExist:
            comments_logger.warning("Comment replies request failed - comment not found", extra={
                'user_id': request.user.id,
                'comment_id': pk,
            })
            raise
        except Exception as e:
            log_error(e, "Error retrieving comment replies", request.user.id, {
                'comment_id': pk,
            })
            return Response(
                {'error': 'An error occurred while retrieving replies'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def post(self, request, pk):
        """Add a reply to a comment"""
        try:
            comments_logger.info("Comment reply creation request", extra={
                'user_id': request.user.id,
                'username': request.user.username,
                'comment_id': pk,
                'body_length': len(request.data.get('body', '')),
            })
            
            parent_comment = get_object_or_404(Comment, pk=pk)
            
            comments_logger.debug("Creating reply for comment", extra={
                'user_id': request.user.id,
                'comment_id': pk,
                'parent_author': parent_comment.author.username,
            })
            
            # Inherit content_type and object_id from parent comment
            comment_data = {
                'body': request.data.get('body'),
                'content_type': parent_comment.content_type.id,
                'object_id': parent_comment.object_id,
                'author': request.user.id,
                'parent': parent_comment.id,
                'topic': parent_comment.topic_id  # Will be None for non-topic comments
            }
            
            comments_logger.debug("Reply data prepared", extra={
                'user_id': request.user.id,
                'comment_id': pk,
                'comment_data': comment_data,
            })
            
            serializer = CommentCreateSerializer(data=comment_data)
            if serializer.is_valid():
                comment = serializer.save()
                
                comments_logger.info("Comment reply created successfully", extra={
                    'user_id': request.user.id,
                    'reply_id': comment.id,
                    'comment_id': pk,
                })
                
                # Send notification for the new reply
                try:
                    notify_comment_reply(comment)
                    comments_logger.debug("Comment reply notification sent", extra={
                        'user_id': request.user.id,
                        'reply_id': comment.id,
                        'comment_id': pk,
                    })
                except Exception as e:
                    comments_logger.error("Failed to send comment reply notification", extra={
                        'user_id': request.user.id,
                        'reply_id': comment.id,
                        'comment_id': pk,
                        'error': str(e),
                    }, exc_info=True)
                
                # Log business event
                log_business_event(
                    event_type="comment_reply_created",
                    user_id=request.user.id,
                    object_id=comment.id,
                    object_type='comment',
                    extra={
                        'parent_comment_id': pk,
                    }
                )
                
                # Use CommentSerializer for the response to include all fields
                return_serializer = CommentSerializer(comment, context={'request': request})
                return Response(return_serializer.data, status=status.HTTP_201_CREATED)
            
            comments_logger.warning("Comment reply creation failed - validation errors", extra={
                'user_id': request.user.id,
                'comment_id': pk,
                'errors': serializer.errors,
            })
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            log_error(e, "Error creating comment reply", request.user.id, {
                'comment_id': pk,
                'request_data': request.data,
            })
            return Response(
                {'error': 'An error occurred while creating the reply'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )