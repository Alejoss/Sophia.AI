from rest_framework import serializers
from .models import KnowledgePath, Node, ActivityRequirement, NodeActivityRequirement
from django.contrib.auth.models import User


class KnowledgePathNodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Node
        fields = ['id', 'title', 'media_type']


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
        fields = ['id', 'title', 'author', 'description', 'created_at', 'updated_at', 'votes', 'nodes']
        extra_kwargs = {
            'knowledge_path': {'read_only': True},
            'media_type': {'read_only': True}
        }

    def create(self, validated_data):
        content = validated_data.get('content')
        validated_data['media_type'] = content.media_type
        node = super().create(validated_data)
        return node


class ActivityRequirementSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityRequirement
        fields = ['id', 'knowledge_path', 'activity_type', 'description']


class NodeActivityRequirementSerializer(serializers.ModelSerializer):
    class Meta:
        model = NodeActivityRequirement
        fields = ['id', 'preceding_node', 'following_node', 'activity_requirement', 'is_mandatory']


class KnowledgePathCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgePath
        fields = ['id', 'title', 'description', 'author', 'created_at']
        read_only_fields = ['author', 'created_at'] 