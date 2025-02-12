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

    class Meta:
        model = Collection
        fields = ['id', 'name', 'library', 'library_name']
        extra_kwargs = {
            'library': {'write_only': True}  # Hide library id in responses but allow it in creation
        }


class FileDetailsSerializer(serializers.ModelSerializer):
    class Meta:
        model = FileDetails
        fields = ['file', 'file_size', 'uploaded_at']


class ContentSerializer(serializers.ModelSerializer):
    file_details = FileDetailsSerializer(read_only=True)

    class Meta:
        model = Content
        fields = ['id', 'media_type', 'file_details']


class ContentProfileSerializer(serializers.ModelSerializer):
    content = ContentSerializer(read_only=True)
    collection_name = serializers.CharField(source='collection.name', read_only=True)

    class Meta:
        model = ContentProfile
        fields = ['id', 'title', 'author', 'personal_note', 
                 'is_visible', 'collection', 'collection_name', 'content']


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
                'title': content.title,
                'total_votes': content.total_votes,
            })
            grouped_contents[media_type]['count'] += 1

        return grouped_contents
        