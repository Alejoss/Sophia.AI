from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import get_object_or_404

from content.models import Library, Collection, Content, KnowledgePath, Node, Topic
from content.serializers import (LibrarySerializer,
                                 CollectionSerializer,
                                 ContentSerializer,
                                 KnowledgePathSerializer,
                                 TopicContentsSerializer)


class LibraryListView(APIView):
    """
    API view to retrieve the list of all Library instances.
    """
    def get(self, request):
        libraries = Library.objects.all()
        serializer = LibrarySerializer(libraries, many=True)
        return Response(serializer.data)


class LibraryDetailView(APIView):
    """
    API view to retrieve a specific Library instance by its primary key.
    """
    def get(self, request, pk):
        library = get_object_or_404(Library, pk=pk)
        serializer = LibrarySerializer(library)
        return Response(serializer.data)


class CollectionListView(APIView):
    """
    API view to retrieve the list of all Collection instances.
    """
    def get(self, request):
        collections = Collection.objects.all()
        serializer = CollectionSerializer(collections, many=True)
        return Response(serializer.data)


class CollectionDetailView(APIView):
    """
    API view to retrieve a specific Collection instance by its primary key.
    """
    def get(self, request, pk):
        collection = get_object_or_404(Collection, pk=pk)
        serializer = CollectionSerializer(collection)
        return Response(serializer.data)


class ContentListView(APIView):
    """
    API view to retrieve the list of all Content instances.
    """
    def get(self, request):
        contents = Content.objects.values('title', 'author')
        return Response(contents)


class ContentDetailView(APIView):
    """
    API view to retrieve a specific Content instance by its primary key.
    """
    def get(self, request, pk):
        content = get_object_or_404(Content, pk=pk)
        serializer = ContentSerializer(content)
        return Response(serializer.data)


class KnowledgePathListView(APIView):
    """
    API view to retrieve the list of all KnowledgePath instances.
    """
    def get(self, request):
        # Retrieve a queryset of KnowledgePath objects, returning only the 'title' and 'author' fields.
        knowledge_paths = KnowledgePath.objects.values('title', 'author')
        return Response(knowledge_paths, status=status.HTTP_200_OK)


class KnowledgePathDetailView(APIView):
    """
    API view to retrieve a specific KnowledgePath instance by its primary key.
    """
    def get(self, request, pk):
        # Retrieve a KnowledgePath object by its pk, prefetching related 'nodes' to optimize queries.
        knowledge_path = get_object_or_404(KnowledgePath.objects.prefetch_related('nodes'), pk=pk)
        serializer = KnowledgePathSerializer(knowledge_path)
        return Response(serializer.data, status=status.HTTP_200_OK)


class NodeDetailView(APIView):
    """
    API view to retrieve a specific Node instance by its primary key.
    """
    def get(self, request, pk):
        node = get_object_or_404(Node, pk=pk)
        return Response(node, status=status.HTTP_200_OK)


class TopicListView(APIView):
    """
    API view to retrieve the list of all topics instances.
    """
    def get(self, request):
        topics = Topic.objects.values('title', 'creator')
        return Response(topics, status=status.HTTP_200_OK)


class TopicContentsListView(APIView):
    """
    API view to retrieve the contents associated with a specific Topic instance.
    """
    def get(self, request, pk):
        topic = get_object_or_404(Topic, pk=pk)
        serializer = TopicContentsSerializer(topic)
        return Response(serializer.data, status=status.HTTP_200_OK)