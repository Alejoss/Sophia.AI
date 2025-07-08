from rest_framework import serializers
from .models import Bookmark
from django.contrib.contenttypes.models import ContentType
from content.serializers import TopicBasicSerializer, SimpleContentSerializer, SimpleContentProfileSerializer
from content.models import Content, ContentProfile

class BookmarkSerializer(serializers.ModelSerializer):
    content_type_name = serializers.SerializerMethodField()
    content_profile = serializers.SerializerMethodField()
    topic = TopicBasicSerializer(read_only=True)
    
    class Meta:
        model = Bookmark
        fields = ['id', 'content_type', 'object_id', 'content_type_name', 
                 'content_profile', 'topic', 'deleted', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_content_type_name(self, obj):
        return obj.content_type.model
    
    def get_content_profile(self, obj):
        # Get the actual object being bookmarked
        content_object = obj.content_object
        if not content_object:
            return None

        # Handle different content types
        if isinstance(content_object, Content):
            # Get the user's profile for this content if it exists
            try:
                profile = ContentProfile.objects.get(
                    content=content_object,
                    user=obj.user
                )
                # Use SimpleContentProfileSerializer for consistent serialization with RecentUserContent
                serializer = SimpleContentProfileSerializer(
                    profile,
                    context={'request': self.context.get('request')}
                )
                return serializer.data
            except ContentProfile.DoesNotExist:
                # If no profile exists, use SimpleContentSerializer for consistency
                serializer = SimpleContentSerializer(
                    content_object,
                    context={'request': self.context.get('request')}
                )
                return serializer.data
        else:
            # For other types (knowledgepath, publication), return basic info
            return {
                'id': content_object.id,
                'title': getattr(content_object, 'title', None) or 
                        getattr(content_object, 'name', None) or 
                        str(content_object)
            }

class BookmarkCreateSerializer(serializers.Serializer):
    content_type = serializers.CharField()
    object_id = serializers.IntegerField()
    topic_id = serializers.IntegerField(required=False, allow_null=True)
    
    def validate_content_type(self, value):
        try:
            ContentType.objects.get(model=value)
            return value
        except ContentType.DoesNotExist:
            raise serializers.ValidationError(f"Content type '{value}' does not exist")
    
    def create(self, validated_data):
        user = self.context['request'].user
        content_type = ContentType.objects.get(model=validated_data['content_type'])
        model_class = content_type.model_class()
        
        try:
            obj = model_class.objects.get(id=validated_data['object_id'])
        except model_class.DoesNotExist:
            raise serializers.ValidationError(f"Object with id {validated_data['object_id']} does not exist")
        
        topic = None
        if validated_data.get('topic_id'):
            from content.models import Topic
            try:
                topic = Topic.objects.get(id=validated_data['topic_id'])
            except Topic.DoesNotExist:
                raise serializers.ValidationError(f"Topic with id {validated_data['topic_id']} does not exist")
        
        return Bookmark.create_bookmark(
            user=user,
            obj=obj,
            topic=topic
        ) 