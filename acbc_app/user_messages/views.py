import logging
from django.shortcuts import render
from rest_framework import generics, permissions, status, serializers
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User
from .models import MessageThread, Message
from .serializers import MessageThreadSerializer, MessageSerializer
from django.db import models

logger = logging.getLogger(__name__)

# Create your views here.

class ThreadListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MessageThreadSerializer

    def get_queryset(self):
        user = self.request.user
        logger.info(f"Thread list requested by user {user.username}")
        
        try:
            queryset = MessageThread.objects.filter(
                models.Q(participant1=user) | models.Q(participant2=user)
            ).order_by('-messages__timestamp').distinct()
            
            logger.debug(f"Retrieved {queryset.count()} message threads for user {user.username}")
            return queryset
        except Exception as e:
            logger.error(f"Error retrieving thread list for user {user.username}: {str(e)}", exc_info=True)
            raise

class ThreadDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MessageThreadSerializer

    def get_object(self):
        user_id = self.kwargs['user_id']
        logger.info(f"Thread detail requested - User ID: {user_id}, Requested by: {self.request.user.username}")
        
        try:
            other_user = get_object_or_404(User, id=user_id)
            thread = MessageThread.get_or_create_thread(self.request.user, other_user)
            logger.debug(f"Thread retrieved/created successfully - Thread ID: {thread.id}, Participants: {self.request.user.username} and {other_user.username}")
            return thread
        except Exception as e:
            logger.error(f"Error in ThreadDetailView for user {self.request.user.username} with other user {user_id}: {str(e)}", exc_info=True)
            raise

class MessageListView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MessageSerializer

    def get_queryset(self):
        thread_id = self.kwargs['thread_id']
        logger.info(f"Message list requested - Thread ID: {thread_id}, User: {self.request.user.username}")
        
        try:
            thread = get_object_or_404(MessageThread, id=thread_id)
            # Ensure user is a participant
            if self.request.user not in [thread.participant1, thread.participant2]:
                logger.warning(f"Unauthorized access attempt - User {self.request.user.username} tried to access thread {thread_id} they are not a participant in")
                raise permissions.PermissionDenied("You are not a participant in this thread")
            
            messages = Message.objects.filter(thread=thread, deleted_at__isnull=True).order_by('timestamp')
            logger.debug(f"Retrieved {messages.count()} messages for thread {thread_id}")
            return messages
        except Exception as e:
            logger.error(f"Error in MessageListView get_queryset for thread {thread_id} and user {self.request.user.username}: {str(e)}", exc_info=True)
            raise

    def list(self, request, *args, **kwargs):
        thread_id = self.kwargs['thread_id']
        logger.info(f"Message list operation - Thread ID: {thread_id}, User: {request.user.username}")
        
        try:
            queryset = self.get_queryset()
            serializer = self.get_serializer(queryset, many=True)
            logger.debug(f"Successfully serialized {len(serializer.data)} messages for thread {thread_id}")
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error in MessageListView list for thread {thread_id} and user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def create(self, request, *args, **kwargs):
        thread_id = self.kwargs['thread_id']
        logger.info(f"Message creation requested - Thread ID: {thread_id}, User: {request.user.username}")
        logger.debug(f"Message creation data: {request.data}")
        
        try:
            # Validate thread exists and user is participant
            try:
                thread = get_object_or_404(MessageThread, id=thread_id)
                if request.user not in [thread.participant1, thread.participant2]:
                    logger.warning(f"Permission denied - User {request.user.username} is not a participant in thread {thread_id}")
                    return Response(
                        {"error": "You are not a participant in this thread"},
                        status=status.HTTP_403_FORBIDDEN
                    )
            except MessageThread.DoesNotExist:
                logger.warning(f"Thread not found - Thread ID: {thread_id}, User: {request.user.username}")
                return Response(
                    {"error": "Thread not found"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # Validate message text
            if not request.data.get('text'):
                logger.warning(f"Validation error - Message text is missing from user {request.user.username} in thread {thread_id}")
                return Response(
                    {"error": "Message text is required"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Create and validate serializer
            serializer = self.get_serializer(data=request.data)
            if not serializer.is_valid():
                logger.warning(f"Serializer validation errors for user {request.user.username} in thread {thread_id}: {serializer.errors}")
                return Response(
                    {"error": serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Save the message
            message = serializer.save(thread=thread, sender=request.user)
            logger.info(f"Message created successfully - ID: {message.id}, Thread: {thread_id}, Sender: {request.user.username}")
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Unexpected error in MessageListView create for thread {thread_id} and user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class MessageDeleteView(generics.UpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MessageSerializer

    def get_object(self):
        message_id = self.kwargs['pk']
        logger.info(f"Message deletion requested - Message ID: {message_id}, User: {self.request.user.username}")
        
        try:
            message = get_object_or_404(Message, id=message_id)
            if message.sender != self.request.user:
                logger.warning(f"Permission denied - User {self.request.user.username} tried to delete message {message_id} owned by user {message.sender.username}")
                raise permissions.PermissionDenied("You can only delete your own messages")
            logger.debug(f"Message {message_id} retrieved successfully for deletion by user {self.request.user.username}")
            return message
        except Exception as e:
            logger.error(f"Error in MessageDeleteView get_object for message {message_id} and user {self.request.user.username}: {str(e)}", exc_info=True)
            raise

    def update(self, request, *args, **kwargs):
        message_id = self.kwargs['pk']
        logger.info(f"Message deletion operation - Message ID: {message_id}, User: {request.user.username}")
        
        try:
            message = self.get_object()
            message.delete_message()
            logger.info(f"Message {message_id} deleted successfully by user {request.user.username}")
            return Response({'status': 'message deleted'})
        except Exception as e:
            logger.error(f"Error in MessageDeleteView update for message {message_id} and user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
