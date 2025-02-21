from rest_framework import serializers
from .models import KnowledgePath, Node, ActivityRequirement, NodeActivityRequirement
from django.contrib.auth.models import User


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


class NodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Node
        fields = ['id', 'title', 'order', 'media_type', 'content', 'knowledge_path', 'content_id']
        read_only_fields = ['id', 'order']


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