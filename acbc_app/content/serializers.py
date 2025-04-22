from django.db.models import Max, Value, Q
from django.db.models.functions import Coalesce
from rest_framework import serializers

from content.models import Library, Collection, Content, Topic, ContentProfile, FileDetails, Publication
from knowledge_paths.models import KnowledgePath, Node
from knowledge_paths.serializers import KnowledgePathBasicSerializer


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
            return absolute_url
        return None


class ContentSerializer(serializers.ModelSerializer):
    file_details = FileDetailsSerializer(read_only=True)
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
    
    def get_url(self, obj):
        try:
            if obj.file_details and obj.file_details.file:
                return obj.file_details.file.url
        except Content.file_details.RelatedObjectDoesNotExist:
            pass
        return None

    def get_vote_count(self, obj):
        return obj.vote_count

    def get_user_vote(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0
        return obj.get_user_vote(request.user)


class ContentProfileSerializer(serializers.ModelSerializer):
    collection_name = serializers.CharField(source='collection.name', read_only=True)
    content = ContentSerializer(read_only=True)

    def to_representation(self, instance):
        data = super().to_representation(instance)
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
    content_profile = ContentProfileSerializer(read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    
    class Meta:
        model = Publication
        fields = ['id', 'content_profile_id', 'content_profile', 'text_content', 'status', 'published_at', 'updated_at', 'username']
        read_only_fields = ['published_at', 'updated_at']

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        # Handle the case where content_profile is None
        if instance.content_profile is None:
            representation['content_profile'] = None
        else:
            # Ensure display_title and display_author are included
            representation['content_profile']['display_title'] = instance.content_profile.display_title
            representation['content_profile']['display_author'] = instance.content_profile.display_author
        return representation

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
    knowledge_paths = KnowledgePathBasicSerializer(many=True)
    topics = TopicIdTitleSerializer(many=True)
    publications = PublicationBasicSerializer(many=True)
