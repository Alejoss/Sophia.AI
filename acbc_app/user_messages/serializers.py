from rest_framework import serializers
from django.contrib.auth.models import User
from .models import MessageThread, Message
from profiles.serializers import UserSerializer

class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    thread = serializers.PrimaryKeyRelatedField(read_only=True)
    
    class Meta:
        model = Message
        fields = ['id', 'thread', 'sender', 'text', 'timestamp']
        read_only_fields = ['sender', 'timestamp', 'thread']

class MessageThreadSerializer(serializers.ModelSerializer):
    participant1 = UserSerializer(read_only=True)
    participant2 = UserSerializer(read_only=True)
    last_message = serializers.SerializerMethodField()
    
    class Meta:
        model = MessageThread
        fields = ['id', 'participant1', 'participant2', 'last_message']
    
    def get_last_message(self, obj):
        last_message = obj.messages.filter(deleted_at__isnull=True).order_by('-timestamp').first()
        if last_message:
            return MessageSerializer(last_message).data
        return None 