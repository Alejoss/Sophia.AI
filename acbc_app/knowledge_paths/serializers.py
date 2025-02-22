from rest_framework import serializers
from .models import KnowledgePath, Node, ActivityRequirement, NodeActivityRequirement
from django.contrib.auth.models import User
from content.models import FileDetails


class KnowledgePathNodeSerializer(serializers.ModelSerializer):
    content_id = serializers.IntegerField(source='content.id')

    class Meta:
        model = Node
        fields = ['id', 'title', 'media_type', 'content_id']


class KnowledgePathSerializer(serializers.ModelSerializer):
    nodes = KnowledgePathNodeSerializer(many=True, read_only=True)

    class Meta:
        model = KnowledgePath
        fields = ['id', 'title', 'author', 'description', 'created_at', 'updated_at', 'nodes']
        extra_kwargs = {
            'author': {'read_only': True}
        }


class FileDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = FileDetails
        fields = ['file', 'file_size', 'uploaded_at']


class NodeSerializer(serializers.ModelSerializer):
    content_id = serializers.IntegerField(source='content.id', read_only=True)
    file_details = FileDetailsSerializer(source='content.file_details', read_only=True)
    
    class Meta:
        model = Node
        fields = ['id', 'title', 'description', 'order', 'media_type', 'content', 'knowledge_path', 'content_id', 'file_details']
        read_only_fields = ['id', 'order', 'content', 'knowledge_path', 'media_type']


class ActivityRequirementSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityRequirement
        fields = ['id', 'knowledge_path', 'activity_type', 'description']
        read_only_fields = ['id']


class NodeActivityRequirementSerializer(serializers.ModelSerializer):
    class Meta:
        model = NodeActivityRequirement
        fields = ['id', 'preceding_node', 'following_node', 'activity_requirement', 'is_mandatory']


class KnowledgePathCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgePath
        fields = ['id', 'title', 'description', 'author', 'created_at']
        read_only_fields = ['author', 'created_at']


class KnowledgePathBasicSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgePath
        fields = ['id', 'title', 'description', 'author', 'created_at']
