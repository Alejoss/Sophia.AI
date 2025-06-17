from django.db.models import Max, Value, Q
from django.db.models.functions import Coalesce
from rest_framework import serializers

from content.models import Library, Collection, Content, Topic, ContentProfile, FileDetails, Publication
from knowledge_paths.models import KnowledgePath, Node
from profiles.serializers import UserSerializer


class LibrarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Library
        fields = ['id', 'name', 'user']


class FileDetailsSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    class Meta:
        model = FileDetails
        fields = [
            'file', 'file_size', 'uploaded_at', 'url',
            'og_description', 'og_image', 'og_type', 'og_site_name'
        ]
    
    def get_url(self, obj):
        if obj.file:
            url = obj.file.url
            if 'request' in self.context and self.context['request'] is not None:
                return self.context['request'].build_absolute_uri(url)
            return url
        return None


class ContentSerializer(serializers.ModelSerializer):
    file_details = serializers.SerializerMethodField()
    topics = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    url = serializers.SerializerMethodField()
    vote_count = serializers.SerializerMethodField()
    user_vote = serializers.SerializerMethodField()

    class Meta:
        model = Content
        fields = [
            'id', 'media_type', 'file_details', 'topics', 'created_at',
            'original_title', 'original_author', 'uploaded_by', 'url',
            'vote_count', 'user_vote'
        ]
    
    def get_file_details(self, obj):
        try:
            if hasattr(obj, 'file_details') and obj.file_details:
                serializer = FileDetailsSerializer(obj.file_details, context=self.context)
                return serializer.data
            return None
        except Exception as e:
            print(f"Error serializing file_details: {str(e)}")
            return None
    
    def get_url(self, obj):
        try:
            # First check if this is URL-based content
            if obj.url:
                return obj.url
                
            # Then check for file-based content
            if obj.file_details and obj.file_details.file:
                return obj.file_details.file.url
                
            return None
        except Content.file_details.RelatedObjectDoesNotExist:
            # If no file_details exist but we have a URL, return it
            return obj.url if obj.url else None
        except Exception as e:
            print(f"Error getting URL: {str(e)}")
            return None

    def get_vote_count(self, obj):
        topic = self.context.get('topic')
        print(f"\nContentSerializer.get_vote_count - Using topic: {topic.id if topic else 'None'}")
        return obj.get_vote_count(topic)

    def get_user_vote(self, obj):
        request = self.context.get('request')
        topic = self.context.get('topic')
        if not request or not request.user.is_authenticated:
            return 0
        return obj.get_user_vote(request.user, topic)


class ContentProfileSerializer(serializers.ModelSerializer):
    collection_name = serializers.CharField(source='collection.name', read_only=True)
    content = ContentSerializer(read_only=True)
    is_visible = serializers.BooleanField(default=True)
    is_producer = serializers.BooleanField(default=False)
    user = UserSerializer(read_only=True)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return data

    class Meta:
        model = ContentProfile
        fields = ['id', 'title', 'author', 'personal_note', 'is_visible', 'is_producer', 'collection', 'collection_name', 'content', 'user']


class ContentWithSelectedProfileSerializer(ContentSerializer):
    selected_profile = serializers.SerializerMethodField()

    class Meta(ContentSerializer.Meta):
        fields = ContentSerializer.Meta.fields + ['selected_profile']

    def get_selected_profile(self, content):
        # Get the pre-selected profile from context
        profile = self.context.get('selected_profile')
        
        if profile:
            return {
                'id': profile.id,
                'title': profile.title or content.original_title,
                'author': profile.author or content.original_author,
                'personal_note': profile.personal_note,
                'is_visible': profile.is_visible,
                'is_producer': profile.is_producer,
                'user': profile.user.id,
                'user_username': profile.user.username
            }
        
        # Fallback to original content data
        return {
            'id': None,
            'title': content.original_title,
            'author': content.original_author,
            'personal_note': None,
            'is_visible': True,
            'is_producer': False,
            'user': content.uploaded_by.id if content.uploaded_by else None,
            'user_username': content.uploaded_by.username if content.uploaded_by else None
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
    title = serializers.CharField(
        max_length=200,
        required=True,
        error_messages={
            'blank': 'Title cannot be empty.',
            'required': 'Title is required.',
            'max_length': 'Title cannot be longer than 200 characters.'
        }
    )

    class Meta:
        model = Topic
        fields = ['id', 'title', 'description', 'creator', 'topic_image']
        read_only_fields = ['creator']

    def validate_title(self, value):
        if len(value.strip()) == 0:
            raise serializers.ValidationError("Title cannot be empty or contain only whitespace.")
        return value.strip()


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


class PublicationSerializer(serializers.ModelSerializer):
    content_profile_id = serializers.PrimaryKeyRelatedField(
        queryset=ContentProfile.objects.all(),
        source='content_profile',
        required=False,
        allow_null=True
    )
    content = serializers.SerializerMethodField()
    username = serializers.CharField(source='user.username', read_only=True)
    content_profile = ContentProfileSerializer(read_only=True)
    
    class Meta:
        model = Publication
        fields = ['id', 'content_profile_id', 'content_profile', 'content', 'text_content', 'status', 'published_at', 'updated_at', 'username']
        read_only_fields = ['published_at', 'updated_at']

    def get_content(self, instance):
        if not instance.content_profile or not instance.content_profile.content:
            return None
        
        # Use ContentWithSelectedProfileSerializer for content
        serializer = ContentWithSelectedProfileSerializer(
            instance.content_profile.content,
            context={
                'request': self.context.get('request'),
                'selected_profile': instance.content_profile
            }
        )
        return serializer.data

    def create(self, validated_data):
        # Debug prints
        print("PublicationSerializer.create - validated_data:", validated_data)
        
        # Get the user from the request context
        request = self.context.get('request')
        user = request.user if request else None
        
        # Create the Publication
        publication = Publication.objects.create(
            user=user,
            content_profile=validated_data.get('content_profile'),
            text_content=validated_data.get('text_content'),
            status=validated_data.get('status', 'DRAFT')
        )
        return publication


class TopicIdTitleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Topic
        fields = ['id', 'title']


class PublicationBasicSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = Publication
        fields = ['id', 'username', 'published_at']


class ContentReferencesSerializer(serializers.Serializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Import here to avoid circular import
        from knowledge_paths.serializers import KnowledgePathBasicSerializer
        self.fields['knowledge_paths'] = KnowledgePathBasicSerializer(many=True)
        self.fields['topics'] = TopicIdTitleSerializer(many=True)
        self.fields['publications'] = PublicationBasicSerializer(many=True)


class ContentBasicSerializer(serializers.ModelSerializer):
    """
    A lightweight serializer that provides only the essential content data
    needed for basic display purposes, particularly for RecentUserContent.
    """
    url = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    favicon = serializers.SerializerMethodField()
    
    class Meta:
        model = Content
        fields = ['id', 'media_type', 'url', 'file_url', 'original_title', 'favicon']
    
    def get_url(self, obj):
        return obj.url if obj.url else None
    
    def get_file_url(self, obj):
        try:
            if hasattr(obj, 'file_details') and obj.file_details and obj.file_details.file:
                if 'request' in self.context:
                    return self.context['request'].build_absolute_uri(obj.file_details.file.url)
                return obj.file_details.file.url
            return None
        except Content.file_details.RelatedObjectDoesNotExist:
            return None
        
    def get_favicon(self, obj):
        """Get favicon URL for URL-based content"""
        try:
            if not obj.url or obj.media_type != 'TEXT':
                return None
                
            # Special cases for known platforms
            if 'youtube.com' in obj.url or 'youtu.be' in obj.url:
                return 'https://www.youtube.com/favicon.ico'
            if 'medium.com' in obj.url:
                return 'https://medium.com/favicon.ico'
            if 'patreon.com' in obj.url:
                return 'https://www.patreon.com/favicon.ico'
                
            # Get from Open Graph metadata if available
            if hasattr(obj, 'file_details') and obj.file_details and obj.file_details.og_site_name:
                try:
                    from urllib.parse import urlparse
                    hostname = urlparse(obj.url).hostname
                    return f'https://{hostname}/favicon.ico'
                except:
                    pass
            return None
        except Content.file_details.RelatedObjectDoesNotExist:
            # If no file_details exist but we have a URL, try to get favicon from URL
            if obj.url:
                try:
                    from urllib.parse import urlparse
                    hostname = urlparse(obj.url).hostname
                    return f'https://{hostname}/favicon.ico'
                except:
                    pass
            return None


class ContentProfileBasicSerializer(serializers.ModelSerializer):
    """
    A lightweight serializer for ContentProfile that includes only the data
    needed for basic display in components like RecentUserContent.
    """
    content = ContentBasicSerializer(read_only=True)
    
    class Meta:
        model = ContentProfile
        fields = ['id', 'title', 'author', 'content']
        
    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Ensure title falls back to original_title if not set
        if not data['title']:
            data['title'] = data['content']['original_title']
        return data
