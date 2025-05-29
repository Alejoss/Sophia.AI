from rest_framework import serializers
from django.contrib.auth.models import User
from content.models import Content, Topic
from knowledge_paths.models import KnowledgePath
from profiles.models import Profile

class SearchResultSerializer(serializers.Serializer):
    """
    A lightweight serializer for search results that normalizes data from different models.
    This serializer is optimized for performance by only including essential fields.
    """
    id = serializers.IntegerField()
    title = serializers.CharField()
    description = serializers.CharField(allow_null=True)
    type = serializers.CharField()  # 'content', 'topic', 'knowledge_path', 'person'
    url = serializers.CharField(allow_null=True)
    thumbnail = serializers.CharField(allow_null=True)
    created_at = serializers.DateTimeField(allow_null=True)
    # Additional fields for content profiles
    source = serializers.CharField(allow_null=True)  # 'original' or 'profile'
    profile_id = serializers.IntegerField(allow_null=True)
    user_id = serializers.IntegerField(allow_null=True)

class ContentSearchSerializer(serializers.ModelSerializer):
    """
    A lightweight serializer for Content model search results.
    """
    class Meta:
        model = Content
        fields = ['id', 'original_title', 'original_author', 'media_type', 'created_at']
        read_only_fields = fields

class TopicSearchSerializer(serializers.ModelSerializer):
    """
    A lightweight serializer for Topic model search results.
    """
    class Meta:
        model = Topic
        fields = ['id', 'title', 'description', 'created_at']
        read_only_fields = fields

class KnowledgePathSearchSerializer(serializers.ModelSerializer):
    """
    A lightweight serializer for KnowledgePath model search results.
    """
    class Meta:
        model = KnowledgePath
        fields = ['id', 'title', 'description', 'created_at']
        read_only_fields = fields

class UserSearchSerializer(serializers.ModelSerializer):
    """
    A lightweight serializer for User model search results.
    """
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email']
        read_only_fields = fields 