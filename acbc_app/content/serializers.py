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
    vote_count = serializers.SerializerMethodField()
    user_vote = serializers.SerializerMethodField()
    favicon = serializers.SerializerMethodField()

    class Meta:
        model = Content
        fields = [
            'id', 'media_type', 'file_details', 'topics', 'created_at',
            'original_title', 'original_author', 'uploaded_by', 'url',
            'vote_count', 'user_vote', 'favicon'
        ]
    
    def get_file_details(self, obj):
        try:
            # Try to get file_details from the object first
            if hasattr(obj, 'file_details') and obj.file_details:
                serializer = FileDetailsSerializer(obj.file_details, context=self.context)
                return serializer.data
            else:
                # If file_details are not loaded, try to get them from the database
                try:
                    from content.models import FileDetails
                    file_details = FileDetails.objects.get(content=obj)
                    serializer = FileDetailsSerializer(file_details, context=self.context)
                    return serializer.data
                except FileDetails.DoesNotExist:
                    return None
                except Exception as db_error:
                    return None
        except Exception as e:
            print(f"Error serializing file_details for content {obj.id}: {str(e)}")
            # Return None instead of failing the entire serialization
            return None
    
    def get_vote_count(self, obj):
        topic = self.context.get('topic')
        return obj.get_vote_count(topic)

    def get_user_vote(self, obj):
        request = self.context.get('request')
        topic = self.context.get('topic')
        if not request or not request.user.is_authenticated:
            return 0
        return obj.get_user_vote(request.user, topic)

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

    def update(self, instance, validated_data):
        print(f"\n=== ContentSerializer update ===")
        print(f"Instance before update: {instance}")
        print(f"Instance URL before update: {instance.url}")
        print(f"Validated data: {validated_data}")
        
        # Call the parent update method
        updated_instance = super().update(instance, validated_data)
        
        print(f"Instance after update: {updated_instance}")
        print(f"Instance URL after update: {updated_instance.url}")
        
        return updated_instance


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
        
        # If no direct selected_profile, check if we have selected_profiles dict
        if not profile and 'selected_profiles' in self.context:
            profile = self.context['selected_profiles'].get(content.id)
        
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
    vote_count = serializers.SerializerMethodField()
    user_vote = serializers.SerializerMethodField()
    
    class Meta:
        model = Publication
        fields = ['id', 'content_profile_id', 'content_profile', 'content', 'text_content', 'status', 'published_at', 'updated_at', 'username', 'vote_count', 'user_vote']
        read_only_fields = ['published_at', 'updated_at']

    def get_content(self, instance):
        if not instance.content_profile or not instance.content_profile.content:
            return None
        
        # Use PreviewContentProfileSerializer for content since publications use preview mode
        serializer = PreviewContentProfileSerializer(
            instance.content_profile,
            context={'request': self.context.get('request')}
        )
        return serializer.data

    def get_vote_count(self, obj):
        return obj.vote_count

    def get_user_vote(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0
        return obj.get_user_vote(request.user)

    def create(self, validated_data):
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
    topic_image = serializers.SerializerMethodField()
    
    class Meta:
        model = Topic
        fields = ['id', 'title', 'topic_image']
    
    def get_topic_image(self, obj):
        if obj.topic_image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.topic_image.url)
            return obj.topic_image.url
        return None


class PublicationBasicSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    profile_picture = serializers.SerializerMethodField()
    
    class Meta:
        model = Publication
        fields = ['id', 'username', 'published_at', 'profile_picture']
    
    def get_profile_picture(self, obj):
        try:
            # Get the user's profile picture
            profile = obj.user.profile
            if profile.profile_picture:
                request = self.context.get('request')
                if request:
                    return request.build_absolute_uri(profile.profile_picture.url)
                return profile.profile_picture.url
        except Exception:
            pass
        return None


class ContentReferencesSerializer(serializers.Serializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Import here to avoid circular import
        from knowledge_paths.serializers import KnowledgePathBasicSerializer
        self.fields['knowledge_paths'] = KnowledgePathBasicSerializer(many=True)
        self.fields['topics'] = TopicIdTitleSerializer(many=True)
        self.fields['publications'] = PublicationBasicSerializer(many=True)


class SimpleContentSerializer(serializers.ModelSerializer):
    """
    Ultra-lightweight serializer specifically designed for ContentDisplay's "simple" mode.
    Only includes the absolute minimum data needed for basic display with icons.
    """
    url = serializers.SerializerMethodField()
    
    class Meta:
        model = Content
        fields = ['id', 'media_type', 'original_title', 'url']
    
    def get_url(self, obj):
        """Get URL for icon determination only"""
        try:
            return obj.url if obj.url else None
        except Exception as e:
            print(f"Error getting URL in SimpleContentSerializer for content {obj.id}: {str(e)}")
            return None


class SimpleContentProfileSerializer(serializers.ModelSerializer):
    """
    Simple serializer for ContentProfile when used with ContentDisplay's "simple" mode.
    Returns minimal data structure that matches what ContentDisplay expects.
    """
    content = SimpleContentSerializer(read_only=True)
    
    class Meta:
        model = ContentProfile
        fields = ['id', 'title', 'author', 'content']
        
    def to_representation(self, instance):
        try:
            data = super().to_representation(instance)
            # Ensure title falls back to original_title if not set
            if not data['title'] and data['content'] and data['content']['original_title']:
                data['title'] = data['content']['original_title']
            return data
        except Exception as e:
            print(f"Error in SimpleContentProfileSerializer for profile {instance.id}: {str(e)}")
            # Return a minimal valid structure instead of failing
            return {
                'id': instance.id,
                'title': getattr(instance, 'title', 'Untitled'),
                'author': getattr(instance, 'author', ''),
                'content': {
                    'id': getattr(instance.content, 'id', None) if instance.content else None,
                    'media_type': getattr(instance.content, 'media_type', 'TEXT') if instance.content else 'TEXT',
                    'original_title': getattr(instance.content, 'original_title', 'Untitled') if instance.content else 'Untitled',
                    'url': getattr(instance.content, 'url', None) if instance.content else None
                }
            }


class PreviewContentSerializer(serializers.ModelSerializer):
    """
    Medium-weight serializer for ContentDisplay's "preview" mode.
    Includes file details, favicon, and Open Graph metadata but excludes vote data.
    """
    file_details = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()
    favicon = serializers.SerializerMethodField()

    class Meta:
        model = Content
        fields = [
            'id', 'media_type', 'file_details', 'original_title', 
            'original_author', 'uploaded_by', 'url', 'favicon'
        ]
    
    def get_file_details(self, obj):
        try:
            if hasattr(obj, 'file_details') and obj.file_details:
                # Only include essential file details for preview
                file_details = obj.file_details
                return {
                    'file': file_details.file.url if file_details.file else None,
                    'file_size': file_details.file_size,
                    'uploaded_at': file_details.uploaded_at,
                    # Open Graph metadata for preview
                    'og_description': file_details.og_description,
                    'og_image': file_details.og_image,
                    'og_type': file_details.og_type,
                    'og_site_name': file_details.og_site_name
                }
            return None
        except Exception as e:
            print(f"Error serializing file_details for content {obj.id}: {str(e)}")
            return None
    
    def get_url(self, obj):
        try:
            # Only return the content URL, don't fall back to file_details
            return obj.url if obj.url else None
        except Exception as e:
            print(f"Error getting URL for content {obj.id}: {str(e)}")
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


class PreviewContentProfileSerializer(serializers.ModelSerializer):
    """
    Medium-weight serializer for ContentProfile when used with ContentDisplay's "preview" mode.
    Includes file details, favicon, and Open Graph metadata but excludes vote data and heavy metadata.
    """
    content = PreviewContentSerializer(read_only=True)
    
    class Meta:
        model = ContentProfile
        fields = ['id', 'title', 'author', 'personal_note', 'content']
        
    def to_representation(self, instance):
        try:
            data = super().to_representation(instance)
            # Ensure title falls back to original_title if not set
            if not data['title'] and data['content'] and data['content']['original_title']:
                data['title'] = data['content']['original_title']
            return data
        except Exception as e:
            print(f"Error in PreviewContentProfileSerializer for profile {instance.id}: {str(e)}")
            # Return a minimal valid structure instead of failing
            return {
                'id': instance.id,
                'title': getattr(instance, 'title', 'Untitled'),
                'author': getattr(instance, 'author', ''),
                'personal_note': getattr(instance, 'personal_note', ''),
                'content': {
                    'id': getattr(instance.content, 'id', None) if instance.content else None,
                    'media_type': getattr(instance.content, 'media_type', 'TEXT') if instance.content else 'TEXT',
                    'original_title': getattr(instance.content, 'original_title', 'Untitled') if instance.content else 'Untitled',
                    'original_author': getattr(instance.content, 'original_author', '') if instance.content else '',
                    'url': getattr(instance.content, 'url', None) if instance.content else None,
                    'file_details': None,  # Will be populated by PreviewContentSerializer if available
                    'favicon': None  # Will be populated by PreviewContentSerializer if available
                }
            }
