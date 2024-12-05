from django.db.models import Max, Value, Q
from django.db.models.functions import Coalesce
from django.contrib.auth import get_user_model
from rest_framework import serializers

from content.models import Library, Collection, Content, KnowledgePath, Node, Topic


User = get_user_model()


class LibrarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Library
        fields = '__all__'


class CollectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Collection
        fields = '__all__'


class ContentSerializer(serializers.ModelSerializer):
    topics_count = serializers.SerializerMethodField()
    knowledge_path_count = serializers.SerializerMethodField()

    class Meta:
        model = Content
        fields = ['id', 'title', 'description',
                  'author', 'collection', 'media_type',
                  'activity_requirement', 'rating', 'feedback', 'topics_count']

    def get_topics_count(self, obj):
        return obj.topics.count()


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
        # Set the media_type of the node based on the media_type of the content
        content = validated_data.get('content')
        validated_data['media_type'] = content.media_type

        node = super().create(validated_data)
        return node


class TopicListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Topic
        fields = ['title', 'moderators', 'creator']
        extra_kwargs = {
            'creator': {'read_only': True},
            'moderators': {'read_only': True}
        }


class TopicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Topic
        fields = ['title', 'description', 'creator', 'moderators', 'related_topics']
        extra_kwargs = {
            'creator': {'read_only': True},
        }


class TopicContentsSerializer(serializers.ModelSerializer):
    contents = serializers.SerializerMethodField()
    content_pk = serializers.PrimaryKeyRelatedField(queryset=Content.objects.all(), write_only=True)

    class Meta:
        model = Topic
        fields = ['title', 'creator', 'contents', 'content_pk']
        extra_kwargs = {
            'title': {'read_only': True},
            'creator': {'read_only': True},
            'contents': {'read_only': True}
        }

    def get_contents(self, obj):
        # Get the contents for the topic, ordered by the total number of votes
        contents = Content.objects.filter(topics=obj).annotate(
            total_votes=Coalesce(Max('vote_summaries__vote_count', filter=Q(vote_summaries__topic=obj)), Value(0))
        ).order_by('-total_votes')

        # Group contents by media_type
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