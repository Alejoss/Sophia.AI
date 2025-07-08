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
        return is_completed


class KnowledgePathSerializer(serializers.ModelSerializer):
    nodes = NodeSerializer(many=True, read_only=True)
    progress = serializers.SerializerMethodField()
    author = serializers.CharField(source='author.username', read_only=True)
    author_id = serializers.IntegerField(source='author.id', read_only=True)
    vote_count = serializers.SerializerMethodField()
    user_vote = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    can_be_visible = serializers.SerializerMethodField()

    class Meta:
        model = KnowledgePath
        fields = [
            'id', 'title', 'author', 'author_id', 'description', 'created_at', 
            'updated_at', 'nodes', 'progress', 'vote_count', 'user_vote', 'image', 'is_visible', 'can_be_visible'
        ]

    def get_can_be_visible(self, obj):
        return obj.can_be_visible()

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
    
    def get_image(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class KnowledgePathCreateSerializer(serializers.ModelSerializer):
    title = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    can_be_visible = serializers.SerializerMethodField()
    
    class Meta:
        model = KnowledgePath
        fields = ['id', 'title', 'description', 'author', 'created_at', 'image', 'is_visible', 'can_be_visible']
        read_only_fields = ['author', 'created_at']

    def get_can_be_visible(self, obj):
        return obj.can_be_visible()

    def validate_is_visible(self, value):
        """Validate that knowledge path can be made visible"""
        if value and not self.instance.can_be_visible():
            raise serializers.ValidationError(
                "Knowledge paths need at least two nodes to be visible"
            )
        return value

    def create(self, validated_data):
        """Override create to ensure visibility is False for new knowledge paths"""
        validated_data['is_visible'] = False  # New knowledge paths start as not visible
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        # Handle image upload specifically
        if 'image' in validated_data:
            # Delete old image if it exists
            if instance.image:
                instance.image.delete(save=False)
            instance.image = validated_data['image']
        
        # Update other fields
        instance.title = validated_data.get('title', instance.title)
        instance.description = validated_data.get('description', instance.description)
        
        # Handle visibility with validation
        if 'is_visible' in validated_data:
            new_visibility = validated_data['is_visible']
            if new_visibility and not instance.can_be_visible():
                raise serializers.ValidationError({
                    'is_visible': "Knowledge paths need at least two nodes to be visible"
                })
            instance.is_visible = new_visibility
        
        instance.save()
        
        return instance


class KnowledgePathBasicSerializer(serializers.ModelSerializer):
    image = serializers.SerializerMethodField()
    
    class Meta:
        model = KnowledgePath
        fields = ['id', 'title', 'image']
    
    def get_image(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class KnowledgePathEngagedSerializer(serializers.ModelSerializer):
    author = serializers.CharField(source='author.username', read_only=True)
    author_id = serializers.IntegerField(source='author.id', read_only=True)
    image = serializers.SerializerMethodField()

    class Meta:
        model = KnowledgePath
        fields = ['id', 'title', 'description', 'author', 'author_id', 'created_at', 'image']

    def get_image(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


class KnowledgePathListSerializer(serializers.ModelSerializer):
    author = serializers.CharField(source='author.username', read_only=True)
    author_id = serializers.IntegerField(source='author.id', read_only=True)
    vote_count = serializers.SerializerMethodField()
    user_vote = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    can_be_visible = serializers.SerializerMethodField()

    class Meta:
        model = KnowledgePath
        fields = ['id', 'title', 'description', 'author', 'author_id', 
                 'created_at', 'vote_count', 'user_vote', 'image', 'is_visible', 'can_be_visible']

    def get_can_be_visible(self, obj):
        return obj.can_be_visible()

    def get_vote_count(self, obj):
        return getattr(obj, '_vote_count', 0)

    def get_user_vote(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0
        return getattr(obj, '_user_vote', 0)
    
    def get_image(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None


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
