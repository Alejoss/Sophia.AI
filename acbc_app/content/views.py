from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
import os
from django.conf import settings

from utils.permissions import IsAuthor
from content.models import Library, Collection, Content, Topic, ContentProfile, FileDetails
from knowledge_paths.models import KnowledgePath, Node
from content.serializers import (
    LibrarySerializer,
    CollectionSerializer,
    ContentSerializer,
    ContentWithSelectedProfileSerializer,
    TopicBasicSerializer,
    TopicDetailSerializer,
    ContentProfileSerializer
)
from knowledge_paths.serializers import (
    KnowledgePathSerializer,
    NodeSerializer
)


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
        library = get_object_or_404(
            Library, 
            pk=pk,
            message='Library not found'
        )
        serializer = LibrarySerializer(library)
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
        try:
            content = get_object_or_404(Content, pk=pk)
            serializer = ContentWithSelectedProfileSerializer(content)
            return Response(serializer.data)
        except Content.DoesNotExist:
            return Response(
                {'error': 'Content not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )


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
        knowledge_path = get_object_or_404(
            KnowledgePath.objects.prefetch_related('nodes'), 
            pk=pk,
            message='Knowledge path not found'
        )
        serializer = KnowledgePathSerializer(knowledge_path)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        """
        Update a KnowledgePath object by its pk using the provided data.
        Only KnowledgePath fields, not nodes.
        """
        knowledge_path = get_object_or_404(
            KnowledgePath, 
            pk=pk,
            message='Knowledge path not found'
        )
        self.check_object_permissions(request, knowledge_path)

        serializer = KnowledgePathSerializer(knowledge_path, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        """
        Delete a KnowledgePath object by its pk.
        """
        knowledge_path = get_object_or_404(
            KnowledgePath, 
            pk=pk,
            message='Knowledge path not found'
        )
        self.check_object_permissions(request, knowledge_path)

        knowledge_path.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class KnowledgePathNodesView(APIView):
    """
    API view to retrieve the nodes associated with a specific KnowledgePath instance.
    """

    permission_classes = [IsAuthor]

    def post(self, request, pk):
        knowledge_path = get_object_or_404(
            KnowledgePath, 
            pk=pk,
            message='Knowledge path not found'
        )
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
        node = get_object_or_404(
            Node, 
            pk=pk,
            message='Node not found'
        )
        return Response(node, status=status.HTTP_200_OK)

    def put(self, request, pk):
        node = get_object_or_404(
            Node.objects.select_related('knowledge_path'), 
            pk=pk,
            message='Node not found'
        )
        knowledge_path = node.knowledge_path
        self.check_object_permissions(request, knowledge_path)
        
        serializer = NodeSerializer(node, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        node = get_object_or_404(
            Node.objects.select_related('knowledge_path'), 
            pk=pk,
            message='Node not found'
        )
        knowledge_path = node.knowledge_path
        self.check_object_permissions(request, knowledge_path)
        node.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TopicView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        topics = Topic.objects.all()
        serializer = TopicBasicSerializer(topics, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        serializer = TopicBasicSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save(creator=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UploadContentView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

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
                is_visible=True
            )

            # Save file details - removed the extension field
            file_details = FileDetails.objects.create(
                content=content,
                file=file,
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
            .order_by('title')  # Order alphabetically by title
        
        serializer = ContentProfileSerializer(content_profiles, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class UserCollectionsView(APIView):
    """Get all collections for the authenticated user"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        collections = Collection.objects.filter(library__user=request.user)
        serializer = CollectionSerializer(collections, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        """Create a new collection"""
        library, _ = Library.objects.get_or_create(
            user=request.user,
            defaults={'name': f"{request.user.username}'s Library"}
        )
        
        collection_data = request.data.copy()
        collection_data['library'] = library.id
        
        serializer = CollectionSerializer(data=collection_data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CollectionContentView(APIView):
    """Get all content profiles for a specific collection"""
    permission_classes = [IsAuthenticated]

    def get(self, request, collection_id):
        print(f"DEBUG: Attempting to fetch collection with ID: {collection_id}")
        print(f"DEBUG: Request user: {request.user.username}")
        
        # Get all collections for this user to debug
        user_collections = Collection.objects.filter(library__user=request.user)
        print(f"DEBUG: User's collections: {list(user_collections.values('id', 'name'))}")
        
        try:
            collection = get_object_or_404(
                Collection, 
                id=collection_id, 
                library__user=request.user
            )
            print(f"DEBUG: Found collection: {collection.name}")
            
            content_profiles = ContentProfile.objects.filter(
                collection=collection
            ).select_related('content', 'content__file_details')\
                .order_by('title')
            
            serializer = ContentProfileSerializer(content_profiles, many=True)
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Collection.DoesNotExist:
            print(f"DEBUG: Collection {collection_id} not found")
            return Response(
                {"error": f"Collection {collection_id} not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )

    def post(self, request, collection_id):
        """Add content to a collection"""
        collection = get_object_or_404(
            Collection, 
            id=collection_id, 
            library__user=request.user
        )
        
        content_profile_id = request.data.get('content_profile_id')
        if not content_profile_id:
            return Response(
                {'error': 'content_profile_id is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        content_profile = get_object_or_404(
            ContentProfile,
            id=content_profile_id,
            user=request.user
        )
        
        content_profile.collection = collection
        content_profile.save()
        
        serializer = ContentProfileSerializer(content_profile)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ContentProfileView(APIView):
    """Update content profile details"""
    permission_classes = [IsAuthenticated]

    def patch(self, request, content_profile_id):
        content_profile = get_object_or_404(
            ContentProfile,
            id=content_profile_id,
            user=request.user
        )
        
        serializer = ContentProfileSerializer(
            content_profile, 
            data=request.data, 
            partial=True
        )
        
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TopicDetailView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, pk):
        print(f"Attempting to fetch topic {pk}")
        try:
            topic = Topic.objects.prefetch_related(
                'contents',
                'contents__file_details',
                'contents__profiles'
            ).get(pk=pk)
            print(f"Found topic: {topic.title}")
            print(f"Topic image field: {topic.topic_image}")
            print(f"Topic image URL: {topic.topic_image.url if topic.topic_image else None}")
            print(f"Contents count: {topic.contents.count()}")
            serializer = TopicDetailSerializer(topic, context={'request': request})
            data = serializer.data
            print(f"Serialized data: {data}")
            return Response(data)
        except Topic.DoesNotExist:
            print(f"Topic {pk} not found")
            return Response(
                {"error": "Topic not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            print(f"Error fetching topic: {str(e)}")
            return Response(
                {"error": str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def patch(self, request, pk):
        topic = get_object_or_404(Topic, pk=pk)
        
        if 'topic_image' in request.FILES:
            if topic.topic_image:
                old_image_path = os.path.join(settings.MEDIA_ROOT, str(topic.topic_image))
                if os.path.exists(old_image_path):
                    os.remove(old_image_path)
                topic.topic_image.delete(save=False)
            
            image_file = request.FILES['topic_image']
            
            try:
                topic.topic_image = image_file
                topic.save()
            except Exception as e:
                return Response(
                    {'error': f'Failed to save image: {str(e)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        serializer = TopicDetailSerializer(topic, context={'request': request})
        return Response(serializer.data)


class TopicEditContentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        """Add content to topic"""
        topic = get_object_or_404(Topic, pk=pk)
        content_ids = request.data.get('content_ids', [])
        
        try:
            contents = Content.objects.filter(id__in=content_ids)
            topic.contents.add(*contents)
            return Response({'message': 'Content added successfully'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {'error': f'Failed to add content: {str(e)}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

    def patch(self, request, pk):
        """Remove content from topic"""
        topic = get_object_or_404(Topic, pk=pk)
        content_ids = request.data.get('content_ids', [])
        
        try:
            contents = Content.objects.filter(id__in=content_ids)
            topic.contents.remove(*contents)
            return Response({'message': 'Content removed successfully'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {'error': f'Failed to remove content: {str(e)}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )


class TopicContentMediaTypeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk, media_type):
        topic = get_object_or_404(Topic, pk=pk)
        
        # Convert media_type to uppercase to match model choices
        media_type = media_type.upper()
        
        # Get contents of specific media type
        contents = topic.contents.filter(media_type=media_type)\
            .order_by('-created_at')

        serializer = ContentWithSelectedProfileSerializer(
            contents, 
            many=True,
            context={'topic': topic}
        )
        
        return Response({
            'topic': {
                'id': topic.id,
                'title': topic.title
            },
            'contents': serializer.data
        })

# Add new view for basic topic details
class TopicBasicView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        topic = get_object_or_404(Topic, pk=pk)
        serializer = TopicBasicSerializer(topic)
        return Response(serializer.data)
