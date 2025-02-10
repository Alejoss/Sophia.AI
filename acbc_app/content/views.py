from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile

from utils.permissions import IsAuthor
from content.models import Library, Collection, Content, KnowledgePath, Node, Topic, ContentProfile, FileDetails
from content.serializers import (LibrarySerializer,
                                 CollectionSerializer,
                                 ContentSerializer,
                                 KnowledgePathSerializer,
                                 TopicContentsSerializer, NodeSerializer, ContentProfileSerializer)


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

    permission_classes = [IsAuthenticated]  # Only for POST

    def get(self, request):
        # Retrieve a queryset of KnowledgePath objects, returning only the 'title' and 'author' fields.
        knowledge_paths = KnowledgePath.objects.values('title', 'author')
        return Response(knowledge_paths, status=status.HTTP_200_OK)

    def post(self, request):
        # Create a new KnowledgePath object using the provided data.
        serializer = KnowledgePathSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(author=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class KnowledgePathDetailView(APIView):
    """
    API view to retrieve a specific KnowledgePath instance by its primary key.
    """

    permission_classes = [IsAuthor]

    def get(self, request, pk):
        # Retrieve a KnowledgePath object by its pk, prefetching related 'nodes' to optimize queries.
        knowledge_path = get_object_or_404(KnowledgePath.objects.prefetch_related('nodes'), pk=pk)
        serializer = KnowledgePathSerializer(knowledge_path)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        """
        Update a KnowledgePath object by its pk using the provided data.
        Only KnowledgePath fields, not nodes.
        """
        knowledge_path = get_object_or_404(KnowledgePath, pk=pk)
        self.check_object_permissions(request, knowledge_path) # Check if the user is the author of the KnowledgePath

        serializer = KnowledgePathSerializer(knowledge_path, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        """
        Delete a KnowledgePath object by its pk.
        """
        knowledge_path = get_object_or_404(KnowledgePath, pk=pk)
        self.check_object_permissions(request, knowledge_path)

        knowledge_path.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class KnowledgePathNodesView(APIView):
    """
    API view to retrieve the nodes associated with a specific KnowledgePath instance.
    """

    permission_classes = [IsAuthor]

    def post(self, request, pk):
        knowledge_path = get_object_or_404(KnowledgePath, pk=pk)
        self.check_object_permissions(request, knowledge_path)
        serializer = NodeSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(knowledge_path=knowledge_path)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class NodeDetailView(APIView):
    """
    API view to retrieve a specific Node instance by its primary key.
    """

    permission_classes = [IsAuthor]

    def get(self, request, pk):
        node = get_object_or_404(Node, pk=pk)
        return Response(node, status=status.HTTP_200_OK)

    def put(self, request, pk):
        node = get_object_or_404(Node.objects.select_related('knowledge_path'), pk=pk)
        knowledge_path = node.knowledge_path # Get the knowledge path to check if the user is the author
        self.check_object_permissions(request, knowledge_path)
        serializer = NodeSerializer(node, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        node = get_object_or_404(Node.objects.select_related('knowledge_path'), pk=pk)
        knowledge_path = node.knowledge_path # Get the knowledge path to check if the user is the author
        self.check_object_permissions(request, knowledge_path)
        node.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


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


class UploadContentView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)  # Required for handling file uploads

    def post(self, request):
        try:
            # Get the uploaded file
            file = request.FILES.get('file')
            if not file:
                return Response({'error': 'No file provided'}, 
                              status=status.HTTP_400_BAD_REQUEST)

            # Create the Content instance with just media_type
            content = Content.objects.create(
                uploaded_by=request.user,
                media_type='TEXT'  # Default value, you might want to detect this from the file
            )

            # Create the ContentProfile
            content_profile = ContentProfile.objects.create(
                content=content,
                title=request.data.get('title'),
                author=request.data.get('author'),
                personal_note=request.data.get('personalNote'),
                user=request.user,
                is_visible=True  # Default value
            )

            # Save file details
            file_details = FileDetails.objects.create(
                content=content,
                file=file,
                extension=file.name.split('.')[-1] if '.' in file.name else '',
                file_size=file.size
            )

            return Response({
                'message': 'Content uploaded successfully',
                'content_id': content.id
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        

class UserContentListView(APIView):
    """
    API view to retrieve all content profiles owned by a user.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        content_profiles = ContentProfile.objects.filter(user=request.user)\
            .select_related('content')\
            .order_by('-content__uploaded_by')
        
        serializer = ContentProfileSerializer(content_profiles, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
                