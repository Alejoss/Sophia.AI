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
    url = serializers.SerializerMethodField()

    class Meta:
        model = FileDetails
        fields = ['file', 'file_size', 'uploaded_at', 'url']
    
    def get_url(self, obj):
        if obj.file:
            url = obj.file.url
            absolute_url = self.context['request'].build_absolute_uri(url) if 'request' in self.context else url
            print(f"FileDetails URL for file {obj.id}:")
            print(f"  - Raw URL: {url}")
            print(f"  - Absolute URL: {absolute_url}")
            return absolute_url
        print(f"No file URL for FileDetails {obj.id}")
        return None


class ContentSerializer(serializers.ModelSerializer):
    file_details = FileDetailsSerializer(read_only=True)
    topics = serializers.StringRelatedField(many=True, read_only=True)
    url = serializers.SerializerMethodField()

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
            'uploaded_by',
            'url'
        ]
    
    def get_url(self, obj):
        if obj.file_details and obj.file_details.file:
            return obj.file_details.file.url
        return None


class ContentProfileSerializer(serializers.ModelSerializer):
    collection_name = serializers.CharField(source='collection.name', read_only=True)
    content = ContentSerializer(read_only=True)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        print(f"ContentProfile serialized data for id {instance.id}:", data)
        return data

    class Meta:
        model = ContentProfile
        fields = ['id', 'title', 'author', 'personal_note', 'is_visible', 'collection', 'collection_name', 'content', 'user']


class ContentWithSelectedProfileSerializer(ContentSerializer):
    selected_profile = serializers.SerializerMethodField()

    class Meta(ContentSerializer.Meta):
        fields = ContentSerializer.Meta.fields + ['selected_profile']

    def get_selected_profile(self, content):
        user = self.context.get('user')
        topic = self.context.get('topic')
        
        # 1. Try to get the logged-in user's profile
        try:
            user_profile = ContentProfile.objects.get(
                content=content,
                user=user
            )
            return ContentProfileSerializer(user_profile).data
        except ContentProfile.DoesNotExist:
            # 2. If we have a topic, try to get the topic creator's profile
            if topic and topic.creator:
                try:
                    creator_profile = ContentProfile.objects.get(
                        content=content,
                        user=topic.creator
                    )
                    return ContentProfileSerializer(creator_profile).data
                except ContentProfile.DoesNotExist:
                    pass

        # 3. Fall back to original content data
        return {
            'title': content.original_title,
            'author': content.original_author,
            'personal_note': None
        }


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
        # Pass user context to the content serializer
        self.context['user'] = self.context.get('user')
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
