from django.db.models import Max, Value, Q
from django.db.models.functions import Coalesce
from rest_framework import serializers

from content.models import Library, Collection, Content, KnowledgePath, Node, Topic


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
    nodes = KnowledgePathNodeSerializer(many=True)

    class Meta:
        model = KnowledgePath
        fields = ['id', 'title', 'author', 'description', 'created_at', 'updated_at', 'nodes']


class TopicContentsSerializer(serializers.ModelSerializer):
    contents = serializers.SerializerMethodField()

    class Meta:
        model = Topic
        fields = ['title', 'creator', 'contents']

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