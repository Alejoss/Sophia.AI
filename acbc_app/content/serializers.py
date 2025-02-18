from django.db.models import Max, Value, Q
from django.db.models.functions import Coalesce
from rest_framework import serializers

from content.models import Library, Collection, Content, Topic, ContentProfile, FileDetails
from knowledge_paths.models import KnowledgePath, Node


class LibrarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Library
        fields = ['id', 'name', 'user']


class FileDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = FileDetails
        fields = ['file', 'file_size', 'uploaded_at']


class ContentSerializer(serializers.ModelSerializer):
    file_details = FileDetailsSerializer(read_only=True)
    topics = serializers.StringRelatedField(many=True, read_only=True)

    class Meta:
        model = Content
        fields = [
            'id', 
            'media_type', 
            'file_details', 
            'topics', 
            'created_at',
            'original_title',
            'original_author',
            'uploaded_by'
        ]


class ContentProfileSerializer(serializers.ModelSerializer):
    collection_name = serializers.CharField(source='collection.name', read_only=True)
    content = ContentSerializer(read_only=True)

    class Meta:
        model = ContentProfile
        fields = ['id', 'title', 'author', 'personal_note', 'is_visible', 'collection', 'collection_name', 'content', 'user']


class ContentWithSelectedProfileSerializer(ContentSerializer):
    selected_profile = serializers.SerializerMethodField()

    class Meta(ContentSerializer.Meta):
        fields = ContentSerializer.Meta.fields + ['selected_profile']

    def get_selected_profile(self, content):
        topic = self.context.get('topic')
        if not topic:
            return None

        creator_profile = ContentProfile.objects.filter(
            content=content,
            user=topic.creator
        ).first()
        
        if creator_profile:
            return ContentProfileSerializer(creator_profile).data

        latest_profile = ContentProfile.objects.filter(
            content=content
        ).order_by('-created_at').first()
        
        if latest_profile:
            return ContentProfileSerializer(latest_profile).data

        return None


class CollectionSerializer(serializers.ModelSerializer):
    library_name = serializers.CharField(source='library.name', read_only=True)
    content_count = serializers.SerializerMethodField()

    class Meta:
        model = Collection
        fields = ['id', 'name', 'library', 'library_name', 'content_count']
        extra_kwargs = {
            'library': {'write_only': True}
        }

    def get_content_count(self, obj):
        return ContentProfile.objects.filter(collection=obj).count()


class TopicBasicSerializer(serializers.ModelSerializer):
    topic_image = serializers.ImageField(max_length=None, allow_empty_file=True, required=False)

    class Meta:
        model = Topic
        fields = ['id', 'title', 'description', 'creator', 'topic_image']
        read_only_fields = ['creator']


class TopicDetailSerializer(TopicBasicSerializer):
    contents = ContentWithSelectedProfileSerializer(many=True, read_only=True)
    
    class Meta(TopicBasicSerializer.Meta):
        fields = TopicBasicSerializer.Meta.fields + ['contents']

    def to_representation(self, instance):
        self.context['topic'] = instance
        return super().to_representation(instance)


class TopicContentSerializer(serializers.ModelSerializer):
    topic_image = serializers.ImageField(max_length=None, allow_empty_file=True, required=False)
    contents = ContentWithSelectedProfileSerializer(many=True, read_only=True)

    class Meta:
        model = Topic
        fields = ['id', 'title', 'description', 'creator', 'topic_image', 'contents']
        read_only_fields = ['creator']

    def to_representation(self, instance):
        self.context['topic'] = instance
        return super().to_representation(instance)
