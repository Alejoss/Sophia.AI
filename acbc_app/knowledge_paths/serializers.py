from rest_framework import serializers
from .models import KnowledgePath, Node
from django.contrib.auth.models import User
from content.models import FileDetails, ContentProfile
from profiles.models import UserNodeCompletion
from knowledge_paths.services.node_user_activity_service import is_node_available_for_user, is_node_completed_by_user, get_knowledge_path_progress
from quizzes.serializers import QuizSerializer


class FileDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = FileDetails
        fields = ['file', 'file_size', 'uploaded_at']


class NodeSerializer(serializers.ModelSerializer):
    content_profile_id = serializers.PrimaryKeyRelatedField(source='content_profile', read_only=True)
    is_available = serializers.SerializerMethodField()
    is_completed = serializers.SerializerMethodField()
    quizzes = QuizSerializer(many=True, read_only=True)
    
    class Meta:
        model = Node
        fields = ['id', 'title', 'description', 'order', 'media_type', 
                 'is_available', 'is_completed', 'content_profile_id', 'quizzes']
        read_only_fields = ['id', 'order', 'content_profile_id', 'knowledge_path', 'media_type']

    def get_is_available(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return is_node_available_for_user(obj, request.user)

    def get_is_completed(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        
        is_completed = is_node_completed_by_user(obj, request.user)
        print(f"Node {obj.id} is_completed for user {request.user}: {is_completed}")
        return is_completed


class KnowledgePathSerializer(serializers.ModelSerializer):
    nodes = NodeSerializer(many=True, read_only=True)
    progress = serializers.SerializerMethodField()
    author = serializers.CharField(source='author.username', read_only=True)
    author_id = serializers.IntegerField(source='author.id', read_only=True)
    vote_count = serializers.SerializerMethodField()
    user_vote = serializers.SerializerMethodField()

    class Meta:
        model = KnowledgePath
        fields = [
            'id', 'title', 'author', 'author_id', 'description', 'created_at', 
            'updated_at', 'nodes', 'progress', 'vote_count', 'user_vote'
        ]

    def get_progress(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
            
        # Use the service function to get detailed progress
        progress_data = get_knowledge_path_progress(request.user, obj)
        
        return {
            'completed_nodes': progress_data['completed_nodes'],
            'total_nodes': progress_data['total_nodes'],
            'percentage': progress_data['completion_percentage'],
            'is_completed': progress_data['is_completed']
        }

    def get_vote_count(self, obj):
        return obj.vote_count

    def get_user_vote(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0
        return obj.get_user_vote(request.user)


class KnowledgePathCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgePath
        fields = ['id', 'title', 'description', 'author', 'created_at']
        read_only_fields = ['author', 'created_at']


class KnowledgePathBasicSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgePath
        fields = ['id', 'title']


class KnowledgePathListSerializer(serializers.ModelSerializer):
    author = serializers.CharField(source='author.username', read_only=True)
    author_id = serializers.IntegerField(source='author.id', read_only=True)
    vote_count = serializers.SerializerMethodField()
    user_vote = serializers.SerializerMethodField()

    class Meta:
        model = KnowledgePath
        fields = ['id', 'title', 'description', 'author', 'author_id', 
                 'created_at', 'vote_count', 'user_vote']

    def get_vote_count(self, obj):
        return getattr(obj, '_vote_count', 0)

    def get_user_vote(self, obj):
        return getattr(obj, '_user_vote', 0)


# Add a new serializer for reordering
class NodeReorderSerializer(serializers.Serializer):
    node_orders = serializers.ListField(
        child=serializers.DictField(
            child=serializers.IntegerField()
        )
    )

    def validate_node_orders(self, value):
        """
        Validate that each dict in the list has 'id' and 'order' keys
        """
        for item in value:
            if not all(k in item for k in ('id', 'order')):
                raise serializers.ValidationError(
                    "Each item must have 'id' and 'order' fields"
                )
        return value
