from rest_framework import serializers

from content.models import Library, Collection, Content, KnowledgePath


class LibrarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Library
        fields = '__all__'


class CollectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Collection
        fields = '__all__'


class ContentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Content
        fields = '__all__'


class KnowledgePathSerializer(serializers.ModelSerializer):
    class Meta:
        model = KnowledgePath
        fields = ['id', 'title', 'author', 'description', 'created_at', 'updated_at', 'nodes']