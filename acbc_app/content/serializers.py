from django.db.models import Max, Value, Q
from django.db.models.functions import Coalesce
from rest_framework import serializers

from content.models import (
    Library,
    Collection,
    Content,
    Topic,
    TopicTimeline,
    TopicTimelineEntry,
    TopicTimelineEntryContent,
    ContentProfile,
    FileDetails,
    Publication,
    TopicModeratorInvitation,
    ContentSuggestion,
    FileSuggestion,
    ContentTranscript,
)
from content.utils import build_media_url
from content.image_utils import (
    validate_cover_image_size,
    validate_content_profile_thumbnail_size,
    generate_content_profile_thumbnail_preview,
    delete_content_profile_thumbnail_preview,
)
from knowledge_paths.models import KnowledgePath, Node
from profiles.serializers import UserSerializer


def _content_profile_thumbnail_urls(profile, request):
    """Absolute URLs for full custom thumbnail and listing-sized preview."""
    thumb = build_media_url(profile.thumbnail, request) if profile.thumbnail else None
    preview = (
        build_media_url(profile.thumbnail_preview, request)
        if profile.thumbnail_preview
        else None
    )
    if preview and getattr(profile, 'updated_at', None):
        sep = '&' if '?' in preview else '?'
        preview = f"{preview}{sep}t={int(profile.updated_at.timestamp())}"
    return thumb, preview


class LibrarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Library
        fields = ['id', 'name', 'user']


class FileDetailsSerializer(serializers.ModelSerializer):
    file = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()

    class Meta:
        model = FileDetails
        fields = [
            'file', 'file_size', 'uploaded_at', 'url',
            'og_description', 'og_image', 'og_type', 'og_site_name'
        ]

    def _get_file_url(self, obj):
        """Return absolute media URL. Build S3 URL explicitly to avoid build_absolute_uri mangling."""
        if not obj.file:
            return None
        return build_media_url(obj.file, self.context.get('request'))

    def get_file(self, obj):
        return self._get_file_url(obj)

    def get_url(self, obj):
        return self._get_file_url(obj)


class ContentSerializer(serializers.ModelSerializer):
    file_details = serializers.SerializerMethodField()
    topics = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    vote_count = serializers.SerializerMethodField()
    user_vote = serializers.SerializerMethodField()
    favicon = serializers.SerializerMethodField()
    has_file_available = serializers.SerializerMethodField()
    is_original_uploader = serializers.SerializerMethodField()
    can_suggest_file = serializers.SerializerMethodField()

    class Meta:
        model = Content
        fields = [
            'id', 'media_type', 'file_details', 'topics', 'created_at',
            'original_title', 'original_author', 'uploaded_by', 'url',
            'has_spanish_subtitles', 'has_spanish_dubbing',
            'vote_count', 'user_vote', 'favicon',
            'has_file_available', 'is_original_uploader', 'can_suggest_file'
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

    def _has_file(self, obj):
        return bool(getattr(getattr(obj, 'file_details', None), 'file', None))

    def get_has_file_available(self, obj):
        return self._has_file(obj)

    def get_is_original_uploader(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return bool(obj.uploaded_by_id and obj.uploaded_by_id == request.user.id)

    def get_can_suggest_file(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        if not obj.url:
            return False
        if self._has_file(obj):
            return False
        return bool(obj.uploaded_by_id and obj.uploaded_by_id != request.user.id)

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
    thumbnail = serializers.ImageField(required=False, allow_null=True)
    thumbnail_preview = serializers.ImageField(read_only=True, required=False)

    def validate_thumbnail(self, value):
        if value:
            try:
                validate_content_profile_thumbnail_size(value)
            except ValueError as e:
                raise serializers.ValidationError(str(e)) from e
        return value

    def create(self, validated_data):
        instance = super().create(validated_data)
        if instance.thumbnail:
            generate_content_profile_thumbnail_preview(instance)
        return instance

    def update(self, instance, validated_data):
        thumbnail_updated = 'thumbnail' in validated_data
        instance = super().update(instance, validated_data)
        if thumbnail_updated:
            delete_content_profile_thumbnail_preview(instance, save=False)
            if instance.thumbnail:
                generate_content_profile_thumbnail_preview(instance)
        return instance

    def to_representation(self, instance):
        data = super().to_representation(instance)
        request = self.context.get('request')
        thumb, preview = _content_profile_thumbnail_urls(instance, request)
        data['thumbnail'] = thumb
        data['thumbnail_preview'] = preview
        return data

    class Meta:
        model = ContentProfile
        fields = [
            'id', 'title', 'author', 'personal_note', 'thumbnail', 'thumbnail_preview',
            'is_visible', 'is_producer', 'collection', 'collection_name', 'content', 'user',
        ]


class ContentWithSelectedProfileSerializer(ContentSerializer):
    selected_profile = serializers.SerializerMethodField()

    class Meta(ContentSerializer.Meta):
        fields = ContentSerializer.Meta.fields + ['selected_profile']

    def get_selected_profile(self, content):
        # Get the pre-selected profile from context
        profile = self.context.get('selected_profile')
        request = self.context.get('request')
        
        # If no direct selected_profile, check if we have selected_profiles dict
        if not profile and 'selected_profiles' in self.context:
            profile = self.context['selected_profiles'].get(content.id)
        
        if profile:
            thumb, preview = _content_profile_thumbnail_urls(profile, request)
            return {
                'id': profile.id,
                'title': profile.title or content.original_title,
                'author': profile.author or content.original_author,
                'personal_note': profile.personal_note,
                'thumbnail': thumb,
                'thumbnail_preview': preview,
                'is_visible': profile.is_visible,
                'is_producer': profile.is_producer,
                'user': profile.user.id,
                'user_username': profile.user.username,
                'created_at': profile.created_at.isoformat() if profile.created_at else None,
                'updated_at': profile.updated_at.isoformat() if profile.updated_at else None,
            }
        
        # Fallback to original content data
        return {
            'id': None,
            'title': content.original_title,
            'author': content.original_author,
            'personal_note': None,
            'thumbnail': None,
            'thumbnail_preview': None,
            'is_visible': True,
            'is_producer': False,
            'user': content.uploaded_by.id if content.uploaded_by else None,
            'user_username': content.uploaded_by.username if content.uploaded_by else None
        }


class CollectionSerializer(serializers.ModelSerializer):
    library_name = serializers.CharField(source='library.name', read_only=True)
    owner_id = serializers.IntegerField(source='library.user.id', read_only=True)
    owner_username = serializers.CharField(source='library.user.username', read_only=True)
    content_count = serializers.SerializerMethodField()
    is_owner = serializers.SerializerMethodField()

    class Meta:
        model = Collection
        fields = [
            'id', 'name', 'library', 'library_name', 'is_public',
            'content_count', 'owner_id', 'owner_username', 'is_owner',
        ]
        extra_kwargs = {
            'library': {'write_only': True}
        }

    def get_is_owner(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return obj.library.user_id == request.user.id

    def get_content_count(self, obj):
        return ContentProfile.objects.filter(collection=obj).count()


class PublicCollectionSummarySerializer(serializers.ModelSerializer):
    """List entry for discoverable public collections (library home)."""
    owner_id = serializers.IntegerField(source='library.user.id', read_only=True)
    owner_username = serializers.CharField(source='library.user.username', read_only=True)
    visible_item_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Collection
        fields = ['id', 'name', 'owner_id', 'owner_username', 'visible_item_count']


class TopicBasicSerializer(serializers.ModelSerializer):
    topic_image = serializers.ImageField(max_length=None, allow_empty_file=True, required=False)
    creator_username = serializers.CharField(source='creator.username', read_only=True)
    title = serializers.CharField(
        max_length=200,
        required=True,
        error_messages={
            'blank': 'Title cannot be empty.',
            'required': 'Title is required.',
            'max_length': 'Title cannot be longer than 200 characters.'
        }
    )

    topic_image_focal_x = serializers.FloatField(required=False, min_value=0, max_value=1)
    topic_image_focal_y = serializers.FloatField(required=False, min_value=0, max_value=1)

    topic_image_thumbnail = serializers.ImageField(read_only=True, required=False)

    class Meta:
        model = Topic
        fields = ['id', 'title', 'description', 'creator', 'creator_username', 'topic_image', 'topic_image_thumbnail', 'topic_image_focal_x', 'topic_image_focal_y']
        read_only_fields = ['creator']

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        if instance.topic_image:
            url = build_media_url(instance.topic_image, self.context.get('request'))
            if url and getattr(instance, 'updated_at', None):
                sep = '&' if '?' in url else '?'
                ret['topic_image'] = f"{url}{sep}t={int(instance.updated_at.timestamp())}"
            else:
                ret['topic_image'] = url
        # Downsized cover for listings; falls back to None so the client can
        # use topic_image when no thumbnail exists yet.
        if instance.topic_image_thumbnail:
            turl = build_media_url(instance.topic_image_thumbnail, self.context.get('request'))
            if turl and getattr(instance, 'updated_at', None):
                sep = '&' if '?' in turl else '?'
                ret['topic_image_thumbnail'] = f"{turl}{sep}t={int(instance.updated_at.timestamp())}"
            else:
                ret['topic_image_thumbnail'] = turl
        else:
            ret['topic_image_thumbnail'] = None
        return ret

    def validate_title(self, value):
        if len(value.strip()) == 0:
            raise serializers.ValidationError("El título no puede estar vacío o contener solo espacios en blanco.")
        return value.strip()

    def validate_topic_image(self, value):
        if value:
            try:
                validate_cover_image_size(value)
            except ValueError as e:
                raise serializers.ValidationError(str(e)) from e
        return value


class TopicDetailSerializer(TopicBasicSerializer):
    contents = serializers.SerializerMethodField()
    moderators = UserSerializer(many=True, read_only=True)

    class Meta(TopicBasicSerializer.Meta):
        fields = TopicBasicSerializer.Meta.fields + ['contents', 'moderators']

    def get_contents(self, instance):
        ordered_contents = self.context.get('ordered_contents')
        if ordered_contents is not None:
            to_serialize = ordered_contents
        else:
            to_serialize = instance.contents.all()
        return ContentWithSelectedProfileSerializer(
            to_serialize,
            many=True,
            context={
                'request': self.context.get('request'),
                'topic': instance,
                'selected_profiles': self.context.get('selected_profiles', {}),
            }
        ).data

    def to_representation(self, instance):
        self.context['user'] = self.context.get('user')
        return super().to_representation(instance)


class TopicTimelineEntryContentSerializer(serializers.ModelSerializer):
    content = ContentWithSelectedProfileSerializer(read_only=True)
    content_id = serializers.PrimaryKeyRelatedField(
        queryset=Content.objects.all(),
        source='content',
        write_only=True,
    )

    class Meta:
        model = TopicTimelineEntryContent
        fields = ['id', 'content', 'content_id', 'order', 'caption']


class TopicTimelineEntrySerializer(serializers.ModelSerializer):
    contents = TopicTimelineEntryContentSerializer(
        source='entry_contents',
        many=True,
        required=False,
    )
    created_by_username = serializers.CharField(source='created_by.username', read_only=True)
    updated_by_username = serializers.CharField(source='updated_by.username', read_only=True)

    class Meta:
        model = TopicTimelineEntry
        fields = [
            'id',
            'title',
            'description',
            'start_date',
            'end_date',
            'order',
            'contents',
            'created_by',
            'created_by_username',
            'updated_by',
            'updated_by_username',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'created_by',
            'created_by_username',
            'updated_by',
            'updated_by_username',
            'created_at',
            'updated_at',
        ]

    def validate(self, attrs):
        start_date = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end_date = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({
                'end_date': 'La fecha final no puede ser anterior a la fecha inicial.'
            })

        entry_contents = attrs.get('entry_contents')
        if entry_contents is not None:
            topic = self.context.get('topic')
            if topic is None:
                timeline = self.context.get('timeline') or getattr(self.instance, 'timeline', None)
                topic = timeline.topic if timeline else None
            if topic is None:
                raise serializers.ValidationError('No se pudo validar el tema de la timeline.')

            seen_content_ids = set()
            invalid_content_ids = []
            duplicate_content_ids = []
            topic_content_ids = set(topic.contents.values_list('id', flat=True))
            for item in entry_contents:
                content = item.get('content')
                if content is None:
                    continue
                if content.id in seen_content_ids:
                    duplicate_content_ids.append(content.id)
                seen_content_ids.add(content.id)
                if content.id not in topic_content_ids:
                    invalid_content_ids.append(content.id)

            if duplicate_content_ids:
                raise serializers.ValidationError({
                    'contents': 'No se puede adjuntar el mismo contenido mas de una vez a la misma entrada.'
                })
            if invalid_content_ids:
                raise serializers.ValidationError({
                    'contents': 'Solo se pueden adjuntar contenidos que ya pertenecen al tema.'
                })

        title = attrs.get('title')
        if title is not None and not title.strip():
            raise serializers.ValidationError({'title': 'El titulo no puede estar vacio.'})
        return attrs

    def _sync_contents(self, entry, entry_contents):
        if entry_contents is None:
            return

        entry.entry_contents.all().delete()
        links = []
        for index, item in enumerate(entry_contents):
            content = item['content']
            links.append(TopicTimelineEntryContent(
                entry=entry,
                content=content,
                order=item.get('order', index),
                caption=item.get('caption') or '',
            ))
        if links:
            TopicTimelineEntryContent.objects.bulk_create(links)

    def create(self, validated_data):
        entry_contents = validated_data.pop('entry_contents', None)
        timeline = self.context['timeline']
        request = self.context.get('request')
        if 'order' not in validated_data:
            max_order = timeline.entries.aggregate(Max('order'))['order__max']
            validated_data['order'] = (max_order or 0) + 1
        entry = TopicTimelineEntry.objects.create(
            timeline=timeline,
            created_by=request.user if request and request.user.is_authenticated else None,
            updated_by=request.user if request and request.user.is_authenticated else None,
            **validated_data,
        )
        self._sync_contents(entry, entry_contents)
        return entry

    def update(self, instance, validated_data):
        entry_contents = validated_data.pop('entry_contents', None)
        request = self.context.get('request')
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if request and request.user.is_authenticated:
            instance.updated_by = request.user
        instance.save()
        self._sync_contents(instance, entry_contents)
        return instance


class TopicTimelineSerializer(serializers.ModelSerializer):
    entries = serializers.SerializerMethodField()

    class Meta:
        model = TopicTimeline
        fields = ['id', 'topic', 'title', 'description', 'entries', 'created_by', 'created_at', 'updated_at']
        read_only_fields = ['topic', 'created_by', 'created_at', 'updated_at']

    def get_entries(self, timeline):
        from content.utils import sort_timeline_entries

        sorted_entries = sort_timeline_entries(list(timeline.entries.all()))
        return TopicTimelineEntrySerializer(
            sorted_entries,
            many=True,
            context=self.context,
        ).data


class TopicContentSerializer(serializers.ModelSerializer):
    topic_image = serializers.ImageField(max_length=None, allow_empty_file=True, required=False)
    contents = ContentWithSelectedProfileSerializer(many=True, read_only=True)

    class Meta:
        model = Topic
        fields = ['id', 'title', 'description', 'creator', 'topic_image', 'contents']
        read_only_fields = ['creator']

    def to_representation(self, instance):
        self.context['topic'] = instance
        ret = super().to_representation(instance)
        if instance.topic_image:
            url = build_media_url(instance.topic_image, self.context.get('request'))
            if url and getattr(instance, 'updated_at', None):
                sep = '&' if '?' in url else '?'
                ret['topic_image'] = f"{url}{sep}t={int(instance.updated_at.timestamp())}"
            else:
                ret['topic_image'] = url
        return ret


class TopicModeratorInvitationSerializer(serializers.ModelSerializer):
    invited_user = UserSerializer(read_only=True)
    invited_by = UserSerializer(read_only=True)
    topic = TopicBasicSerializer(read_only=True)
    
    class Meta:
        model = TopicModeratorInvitation
        fields = ['id', 'topic', 'invited_user', 'invited_by', 'status', 
                  'created_at', 'updated_at', 'message']


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
            url = build_media_url(obj.topic_image, self.context.get('request'))
            if url and getattr(obj, 'updated_at', None):
                sep = '&' if '?' in url else '?'
                return f"{url}{sep}t={int(obj.updated_at.timestamp())}"
            return url
        return None


class PublicationBasicSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    profile_picture = serializers.SerializerMethodField()
    
    class Meta:
        model = Publication
        fields = ['id', 'username', 'published_at', 'profile_picture']
    
    def get_profile_picture(self, obj):
        try:
            profile = obj.user.profile
            if profile.profile_picture:
                return build_media_url(profile.profile_picture, self.context.get('request'))
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
    file_details = serializers.SerializerMethodField()

    class Meta:
        model = Content
        fields = [
            'id', 'media_type', 'original_title', 'url',
            'has_spanish_subtitles', 'has_spanish_dubbing',
            'uploaded_by', 'file_details',
        ]

    def get_file_details(self, obj):
        if not self.context.get('collection_detail'):
            return None
        try:
            if hasattr(obj, 'file_details') and obj.file_details:
                return FileDetailsSerializer(obj.file_details, context=self.context).data
        except Exception as e:
            print(f"Error getting file_details in SimpleContentSerializer for content {obj.id}: {str(e)}")
        return None

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
    user = serializers.IntegerField(source='user_id', read_only=True)

    class Meta:
        model = ContentProfile
        fields = ['id', 'title', 'author', 'personal_note', 'content', 'user', 'created_at']

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
                'personal_note': getattr(instance, 'personal_note', None),
                'user': getattr(instance, 'user_id', None),
                'created_at': (
                    instance.created_at.isoformat()
                    if getattr(instance, 'created_at', None)
                    else None
                ),
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
    has_file_available = serializers.SerializerMethodField()
    is_original_uploader = serializers.SerializerMethodField()
    can_suggest_file = serializers.SerializerMethodField()

    class Meta:
        model = Content
        fields = [
            'id', 'media_type', 'file_details', 'original_title',
            'original_author', 'uploaded_by', 'url', 'created_at',
            'has_spanish_subtitles', 'has_spanish_dubbing',
            'favicon', 'has_file_available', 'is_original_uploader', 'can_suggest_file'
        ]
    
    def get_file_details(self, obj):
        try:
            if hasattr(obj, 'file_details') and obj.file_details:
                fd = obj.file_details
                url = build_media_url(fd.file, self.context.get('request')) if fd.file else None
                return {
                    'file': url,
                    'url': url,
                    'file_size': fd.file_size,
                    'uploaded_at': fd.uploaded_at,
                    'og_description': fd.og_description,
                    'og_image': fd.og_image,
                    'og_type': fd.og_type,
                    'og_site_name': fd.og_site_name
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

    def _has_file(self, obj):
        return bool(getattr(getattr(obj, 'file_details', None), 'file', None))

    def get_has_file_available(self, obj):
        return self._has_file(obj)

    def get_is_original_uploader(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        return bool(obj.uploaded_by_id and obj.uploaded_by_id == request.user.id)

    def get_can_suggest_file(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        if not obj.url:
            return False
        if self._has_file(obj):
            return False
        return bool(obj.uploaded_by_id and obj.uploaded_by_id != request.user.id)


class PreviewContentProfileSerializer(serializers.ModelSerializer):
    """
    Medium-weight serializer for ContentProfile when used with ContentDisplay's "preview" mode.
    Includes file details, favicon, and Open Graph metadata but excludes vote data and heavy metadata.
    """
    content = PreviewContentSerializer(read_only=True)
    thumbnail = serializers.ImageField(required=False, allow_null=True)
    thumbnail_preview = serializers.ImageField(read_only=True, required=False)

    class Meta:
        model = ContentProfile
        fields = [
            'id', 'title', 'author', 'personal_note', 'thumbnail', 'thumbnail_preview',
            'content', 'created_at', 'updated_at',
        ]

    def to_representation(self, instance):
        try:
            data = super().to_representation(instance)

            request = self.context.get('request')
            thumb, preview = _content_profile_thumbnail_urls(instance, request)
            data['thumbnail'] = thumb
            data['thumbnail_preview'] = preview

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
                'thumbnail': None,
                'thumbnail_preview': None,
                'content': {
                    'id': getattr(instance.content, 'id', None) if instance.content else None,
                    'media_type': getattr(instance.content, 'media_type', 'TEXT') if instance.content else 'TEXT',
                    'original_title': getattr(instance.content, 'original_title', 'Untitled') if instance.content else 'Untitled',
                    'original_author': getattr(instance.content, 'original_author', '') if instance.content else '',
                    'url': getattr(instance.content, 'url', None) if instance.content else None,
                    'created_at': (
                        instance.content.created_at.isoformat()
                        if instance.content and getattr(instance.content, 'created_at', None)
                        else None
                    ),
                    'file_details': None,  # Will be populated by PreviewContentSerializer if available
                    'favicon': None  # Will be populated by PreviewContentSerializer if available
                }
            }


class ContentSuggestionSerializer(serializers.ModelSerializer):
    suggested_by = UserSerializer(read_only=True)
    reviewed_by = UserSerializer(read_only=True)
    topic = TopicBasicSerializer(read_only=True)
    content = ContentSerializer(read_only=True)
    content_profile = serializers.SerializerMethodField()
    vote_count = serializers.SerializerMethodField()
    user_vote = serializers.SerializerMethodField()
    
    class Meta:
        model = ContentSuggestion
        fields = ['id', 'topic', 'content', 'content_profile', 'suggested_by', 
                  'reviewed_by', 'status', 'message', 'rejection_reason', 
                  'is_duplicate', 'created_at', 'updated_at', 'reviewed_at',
                  'vote_count', 'user_vote']
    
    def get_content_profile(self, obj):
        """Get the content profile for the suggested_by user. If not found, fallback to topic creator's profile."""
        try:
            request = self.context.get('request')
            
            # First, try to get the suggested_by user's profile for this content
            if obj.suggested_by:
                try:
                    return SimpleContentProfileSerializer(
                        ContentProfile.objects.get(content=obj.content, user=obj.suggested_by),
                        context=self.context
                    ).data
                except ContentProfile.DoesNotExist:
                    pass
            
            # Fallback to topic creator's profile
            if obj.topic.creator:
                try:
                    return SimpleContentProfileSerializer(
                        ContentProfile.objects.get(content=obj.content, user=obj.topic.creator),
                        context=self.context
                    ).data
                except ContentProfile.DoesNotExist:
                    pass
            
            return None
        except Exception as e:
            return None
    
    def get_vote_count(self, obj):
        """Get the vote count for this content suggestion. Votes are not topic-specific."""
        from django.contrib.contenttypes.models import ContentType
        from votes.models import VoteCount
        
        content_type = ContentType.objects.get_for_model(ContentSuggestion)
        vote_count_obj = VoteCount.objects.filter(
            content_type=content_type,
            object_id=obj.id,
            topic__isnull=True  # Suggestions votes are not topic-specific
        ).first()
        
        return vote_count_obj.vote_count if vote_count_obj else 0
    
    def get_user_vote(self, obj):
        """Get the user's vote for this content suggestion. Votes are not topic-specific."""
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0
        
        from django.contrib.contenttypes.models import ContentType
        from votes.models import Vote
        
        content_type = ContentType.objects.get_for_model(ContentSuggestion)
        vote = Vote.objects.filter(
            user=request.user,
            content_type=content_type,
            object_id=obj.id,
            topic__isnull=True  # Suggestions votes are not topic-specific
        ).first()
        
        return vote.value if vote else 0


class FileSuggestionSerializer(serializers.ModelSerializer):
    suggested_by = UserSerializer(read_only=True)
    reviewed_by = UserSerializer(read_only=True)
    file = serializers.SerializerMethodField()

    class Meta:
        model = FileSuggestion
        fields = [
            'id', 'content', 'suggested_by', 'reviewed_by', 'status',
            'file', 'file_size', 'message', 'rejection_reason',
            'created_at', 'updated_at', 'reviewed_at'
        ]
        read_only_fields = [
            'id', 'content', 'suggested_by', 'reviewed_by', 'status',
            'file_size', 'created_at', 'updated_at', 'reviewed_at'
        ]

    def get_file(self, obj):
        return build_media_url(obj.file, self.context.get('request')) if obj.file else None


class ContentTranscriptIngestSerializer(serializers.Serializer):
    parsed_plain = serializers.CharField(required=False, allow_blank=True, default='')
    processed_plain = serializers.CharField(required=False, allow_blank=True, default='')
    obsidian_markdown = serializers.CharField(required=False, allow_blank=True, default='')
    source_subtitles = serializers.CharField(required=False, allow_blank=True, default='')
    format = serializers.ChoiceField(choices=ContentTranscript.FORMAT_CHOICES, default='SRT')
    language = serializers.CharField(max_length=10, required=False, allow_blank=True, default='')

    def validate(self, attrs):
        has_artifact = any(
            (attrs.get(field) or '').strip()
            for field in ('parsed_plain', 'processed_plain', 'obsidian_markdown')
        )
        if not has_artifact:
            raise serializers.ValidationError(
                'Debe enviar al menos uno de: parsed_plain, processed_plain, obsidian_markdown.'
            )
        return attrs


class ContentTranscriptIngestSummarySerializer(serializers.ModelSerializer):
    segment_count = serializers.SerializerMethodField()
    has_parsed_plain = serializers.SerializerMethodField()
    has_processed_plain = serializers.SerializerMethodField()
    has_obsidian_markdown = serializers.SerializerMethodField()

    class Meta:
        model = ContentTranscript
        fields = [
            'format',
            'language',
            'text_length',
            'text_hash',
            'segment_count',
            'has_parsed_plain',
            'has_processed_plain',
            'has_obsidian_markdown',
            'obsidian_frontmatter',
            'created_at',
            'updated_at',
        ]

    def get_segment_count(self, obj):
        return len(obj.segments or [])

    def get_has_parsed_plain(self, obj):
        return bool((obj.parsed_plain or '').strip())

    def get_has_processed_plain(self, obj):
        return bool((obj.processed_plain or '').strip())

    def get_has_obsidian_markdown(self, obj):
        return bool((obj.obsidian_markdown or '').strip())


class ContentTranscriptQueueItemSerializer(serializers.ModelSerializer):
    has_file = serializers.SerializerMethodField()
    file_key = serializers.SerializerMethodField()

    class Meta:
        model = Content
        fields = [
            'id',
            'media_type',
            'original_title',
            'original_author',
            'url',
            'has_file',
            'file_key',
            'created_at',
        ]

    def get_has_file(self, obj):
        file_details = getattr(obj, 'file_details', None)
        return bool(file_details and file_details.file)

    def get_file_key(self, obj):
        file_details = getattr(obj, 'file_details', None)
        if not file_details or not file_details.file:
            return None
        return file_details.file.name
