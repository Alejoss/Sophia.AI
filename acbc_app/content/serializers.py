from django.db.models import Max, Value, Q
from django.db.models.functions import Coalesce
from rest_framework import serializers

from content.models import Library, Collection, Content, KnowledgePath, Node, Topic, ContentProfile, FileDetails


class LibrarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Library
        fields = ['id', 'name', 'user']


class CollectionSerializer(serializers.ModelSerializer):
    library_name = serializers.CharField(source='library.name', read_only=True)
    content_count = serializers.SerializerMethodField()

    class Meta:
        model = Collection
        fields = ['id', 'name', 'library', 'library_name', 'content_count']
        extra_kwargs = {
            'library': {'write_only': True}  # Hide library id in responses but allow it in creation
        }

    def get_content_count(self, obj):
        return ContentProfile.objects.filter(collection=obj).count()


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


# Now update ContentSerializer to include profiles
class ContentSerializerWithProfiles(ContentSerializer):
    profiles = ContentProfileSerializer(many=True, read_only=True)

    class Meta(ContentSerializer.Meta):
        fields = ContentSerializer.Meta.fields + ['profiles']


class KnowledgePathNodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Node
        fields = ['id', 'title', 'media_type']


class KnowledgePathSerializer(serializers.ModelSerializer):
    nodes = KnowledgePathNodeSerializer(many=True, read_only=True)

    class Meta:
        model = KnowledgePath
        fields = ['id', 'title', 'author', 'description', 'created_at', 'updated_at', 'nodes']
        extra_kwargs = {
            'author': {'read_only': True}
        }


class NodeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Node
        fields = ['id', 'title', 'author', 'description', 'created_at', 'updated_at', 'votes', 'nodes']
        extra_kwargs = {
            'knowledge_path': {'read_only': True},
            'media_type': {'read_only': True}
        }

    def create(self, validated_data):
        content = validated_data.get('content')
        validated_data['media_type'] = content.media_type
        node = super().create(validated_data)
        return node


class TopicContentsSerializer(serializers.ModelSerializer):
    contents = serializers.SerializerMethodField()

    class Meta:
        model = Topic
        fields = ['title', 'creator', 'contents']

    def get_contents(self, obj):
        contents = Content.objects.filter(topics=obj).annotate(
            total_votes=Coalesce(Max('vote_summaries__vote_count', filter=Q(vote_summaries__topic=obj)), Value(0))
        ).order_by('-total_votes')

        grouped_contents = {}
        for content in contents:
            media_type = content.media_type
            if media_type not in grouped_contents:
                grouped_contents[media_type] = {'contents': [], 'count': 0}

            grouped_contents[media_type]['contents'].append({
                'id': content.id,
                'title': content.original_title,
                'total_votes': content.total_votes,
            })
            grouped_contents[media_type]['count'] += 1

        return grouped_contents


class ContentWithSelectedProfileSerializer(ContentSerializer):
    selected_profile = serializers.SerializerMethodField()

    class Meta(ContentSerializer.Meta):
        fields = ContentSerializer.Meta.fields + ['selected_profile']

    def get_selected_profile(self, content):
        topic = self.context.get('topic')
        if not topic:
            return None

        # First try to find a profile belonging to the topic creator
        creator_profile = content.profiles.filter(user=topic.creator).first()
        if creator_profile:
            return ContentProfileSerializer(creator_profile).data

        # If no creator profile exists, get the most recently created profile
        latest_profile = content.profiles.order_by('-created_at').first()
        if latest_profile:
            return ContentProfileSerializer(latest_profile).data

        return None


class TopicSerializer(serializers.ModelSerializer):
    topic_image = serializers.ImageField(max_length=None, allow_empty_file=True, required=False)
    contents = ContentWithSelectedProfileSerializer(many=True, read_only=True)

    class Meta:
        model = Topic
        fields = ['id', 'title', 'description', 'creator', 'topic_image', 'contents']
        read_only_fields = ['creator']

    def to_representation(self, instance):
        # Add topic to serializer context so ContentWithSelectedProfileSerializer can access it
        self.context['topic'] = instance
        return super().to_representation(instance)
        