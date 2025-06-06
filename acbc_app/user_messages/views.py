from django.shortcuts import render
from rest_framework import generics, permissions, status, serializers
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.contrib.auth.models import User
from .models import MessageThread, Message
from .serializers import MessageThreadSerializer, MessageSerializer
from django.db import models

# Create your views here.

class ThreadListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MessageThreadSerializer

    def get_queryset(self):
        user = self.request.user
        return MessageThread.objects.filter(
            models.Q(participant1=user) | models.Q(participant2=user)
        ).order_by('-messages__timestamp').distinct()

class ThreadDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MessageThreadSerializer

    def get_object(self):
        try:
            other_user = get_object_or_404(User, id=self.kwargs['user_id'])
            thread = MessageThread.get_or_create_thread(self.request.user, other_user)
            return thread
        except Exception as e:
            print(f"Error in ThreadDetailView: {str(e)}")
            raise

class MessageListView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MessageSerializer

    def get_queryset(self):
        try:
            thread_id = self.kwargs['thread_id']
            thread = get_object_or_404(MessageThread, id=thread_id)
            # Ensure user is a participant
            if self.request.user not in [thread.participant1, thread.participant2]:
                raise permissions.PermissionDenied("You are not a participant in this thread")
            return Message.objects.filter(thread=thread, deleted_at__isnull=True).order_by('timestamp')
        except Exception as e:
            print(f"Error in MessageListView get_queryset: {str(e)}")
            raise

    def list(self, request, *args, **kwargs):
        try:
            queryset = self.get_queryset()
            serializer = self.get_serializer(queryset, many=True)
            return Response(serializer.data)
        except Exception as e:
            print(f"Error in MessageListView list: {str(e)}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def create(self, request, *args, **kwargs):
        try:
            print(f"Received message creation request with data: {request.data}")
            
            # Validate thread exists and user is participant
            thread_id = self.kwargs['thread_id']
            try:
                thread = get_object_or_404(MessageThread, id=thread_id)
                if request.user not in [thread.participant1, thread.participant2]:
                    print(f"Permission denied: User {request.user.id} is not a participant in thread {thread_id}")
                    return Response(
                        {"error": "You are not a participant in this thread"},
                        status=status.HTTP_403_FORBIDDEN
                    )
            except MessageThread.DoesNotExist:
                print(f"Thread not found with id: {thread_id}")
                return Response(
                    {"error": "Thread not found"},
                    status=status.HTTP_404_NOT_FOUND
                )

            # Validate message text
            if not request.data.get('text'):
                print("Validation error: Message text is missing")
                return Response(
                    {"error": "Message text is required"},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Create and validate serializer
            serializer = self.get_serializer(data=request.data)
            if not serializer.is_valid():
                print(f"Serializer validation errors: {serializer.errors}")
                return Response(
                    {"error": serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Save the message
            message = serializer.save(thread=thread, sender=request.user)
            print(f"Message created successfully: id={message.id}, thread={thread_id}, sender={request.user.id}")
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            print(f"Unexpected error in MessageListView create: {str(e)}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class MessageDeleteView(generics.UpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MessageSerializer

    def get_object(self):
        try:
            message = get_object_or_404(Message, id=self.kwargs['pk'])
            if message.sender != self.request.user:
                print(f"Permission denied: User {self.request.user.id} tried to delete message {message.id} owned by user {message.sender.id}")
                raise permissions.PermissionDenied("You can only delete your own messages")
            return message
        except Exception as e:
            print(f"Error in MessageDeleteView get_object: {str(e)}")
            raise

    def update(self, request, *args, **kwargs):
        try:
            message = self.get_object()
            message.delete_message()
            print(f"Message {message.id} deleted successfully by user {request.user.id}")
            return Response({'status': 'message deleted'})
        except Exception as e:
            print(f"Error in MessageDeleteView update: {str(e)}")
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
