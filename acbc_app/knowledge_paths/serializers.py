from rest_framework import serializers
from .models import KnowledgePath, Node, ActivityRequirement, NodeActivityRequirement
from django.contrib.auth.models import User
from content.models import FileDetails
from profiles.models import UserProgressKnowledgePath


class FileDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = FileDetails
        fields = ['file', 'file_size', 'uploaded_at']


class NodeSerializer(serializers.ModelSerializer):
    content_id = serializers.IntegerField(source='content.id', read_only=True)
    file_details = FileDetailsSerializer(source='content.file_details', read_only=True)
    is_available = serializers.SerializerMethodField()
    is_completed = serializers.SerializerMethodField()
    
    class Meta:
        model = Node
        fields = ['id', 'title', 'description', 'order', 'media_type', 'is_available', 'is_completed', 'content_id', 'file_details']
        read_only_fields = ['id', 'order', 'content', 'knowledge_path', 'media_type']

    def get_is_available(self, obj):
        request = self.context.get('request')
        print(f"\n--- Checking availability for node {obj.id} ---")
        print(f"Request user: {request.user if request else 'No request'}")
        print(f"Path author: {obj.knowledge_path.author}")
        
        if not request or not request.user.is_authenticated:
            print("No request or unauthenticated user - not available")
            return False
            
        # If user is creator, all nodes are available
        if obj.knowledge_path.author == request.user:
            print("User is creator - node available")
            return True
            
        # Get user progress
        try:
            progress = UserProgressKnowledgePath.objects.get(
                user=request.user,
                knowledge_path=obj.knowledge_path
            )
            print(f"Found progress for user")
            
            # Node is available if it's the first one or if previous node is completed
            if obj.order == 1:
                print("First node - available")
                return True
            
            previous_node = Node.objects.filter(
                knowledge_path=obj.knowledge_path,
                order=obj.order - 1
            ).first()
            print(f"Previous node: {previous_node}")
            
            if not previous_node:
                print("No previous node - available")
                return True
            
            is_prev_completed = UserProgressKnowledgePath.objects.filter(
                user=request.user,
                current_node=previous_node,
                is_completed=True
            ).exists()
            print(f"Previous node completed: {is_prev_completed}")
            return is_prev_completed
            
        except UserProgressKnowledgePath.DoesNotExist:
            print("No progress found - checking if first node")
            # Only first node is available for new users
            return obj.order == 1

    def get_is_completed(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
            
        return UserProgressKnowledgePath.objects.filter(
            user=request.user,
            current_node=obj,
            is_completed=True
        ).exists()


class KnowledgePathSerializer(serializers.ModelSerializer):
    nodes = NodeSerializer(many=True, read_only=True)
    progress = serializers.SerializerMethodField()
    author = serializers.CharField(source='author.username', read_only=True)

    class Meta:
        model = KnowledgePath
        fields = ['id', 'title', 'author', 'description', 'created_at', 'updated_at', 'nodes', 'progress']

    def get_progress(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
            
        total_nodes = obj.nodes.count()
        if total_nodes == 0:
            return {
                'completed_nodes': 0,
                'total_nodes': 0,
                'percentage': 0
            }
            
        completed_nodes = UserProgressKnowledgePath.objects.filter(
            user=request.user,
            current_node__knowledge_path=obj,
            is_completed=True
        ).count()
        
        return {
            'completed_nodes': completed_nodes,
            'total_nodes': total_nodes,
            'percentage': (completed_nodes / total_nodes) * 100
        }


class KnowledgePathNodeSerializer(serializers.ModelSerializer):
    content_id = serializers.IntegerField(source='content.id')

    class Meta:
        model = Node
        fields = ['id', 'title', 'media_type', 'content_id']


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
