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

# Library Views
class LibraryListView(APIView):
    """API view to retrieve the list of all Library instances."""
    def get(self, request):
        libraries = Library.objects.all()
        serializer = LibrarySerializer(libraries, many=True)
        return Response(serializer.data)


class LibraryDetailView(APIView):
    """API view to retrieve a specific Library instance by its primary key."""
    def get(self, request, pk):
        library = get_object_or_404(Library, pk=pk)
        serializer = LibrarySerializer(library)
        return Response(serializer.data)


# Content Views
class ContentListView(APIView):
    """API view to retrieve the list of all Content instances."""
    def get(self, request):
        contents = Content.objects.values('title', 'author')
        return Response(contents)


class ContentDetailView(APIView):
    """API view to retrieve a specific Content instance by its primary key."""
    def get(self, request, pk):
        try:
            content = get_object_or_404(Content, pk=pk)
            serializer = ContentWithSelectedProfileSerializer(
                content, 
                context={'user': request.user}
            )
            return Response(serializer.data)
        except Content.DoesNotExist:
            return Response(
                {'error': 'Content not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )


class UploadContentView(APIView):
    """API view to handle content uploads."""
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        try:
            file = request.FILES.get('file')
            if not file:
                return Response(
                    {'error': 'No file provided'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            print("Request data:", request.data)
            print("Media type from request:", request.data.get('media_type'))
            print("File type:", file.content_type)

            media_type = request.data.get('media_type')
            if not media_type:
                return Response(
                    {'error': 'Media type not detected'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            content = Content.objects.create(
                uploaded_by=request.user,
                media_type=media_type,  # No default value
                original_title=request.data.get('title'),
                original_author=request.data.get('author')
            )

            content_profile = ContentProfile.objects.create(
                content=content,
                title=request.data.get('title'),
                author=request.data.get('author'),
                personal_note=request.data.get('personalNote'),
                user=request.user,
                is_visible=True
            )

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
    """API view to retrieve all content profiles owned by a user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        content_profiles = ContentProfile.objects.filter(user=request.user)\
            .select_related('content', 'content__file_details')\
            .order_by('title')
        
        print(f"Found {content_profiles.count()} content profiles for user {request.user.id}")
        
        serializer = ContentProfileSerializer(
            content_profiles, 
            many=True,
            context={'request': request}
        )
        response_data = serializer.data
        print("API response data:", response_data)
        
        return Response(response_data, status=status.HTTP_200_OK)


class RecentUserContentView(APIView):
    """Get user's recently uploaded content profiles"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        recent_content = ContentProfile.objects.filter(
            user=request.user
        ).select_related(
            'content',
            'content__file_details'
        ).order_by(
            '-created_at'
        )[:4]
        
        serializer = ContentProfileSerializer(recent_content, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


# Collection Views
class UserCollectionsView(APIView):
    """Get all collections for the authenticated user"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        collections = Collection.objects.filter(library__user=request.user)
        serializer = CollectionSerializer(collections, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
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
        collection = get_object_or_404(
            Collection, 
            id=collection_id, 
            library__user=request.user
        )
        
        content_profiles = ContentProfile.objects.filter(
            collection=collection
        ).select_related('content', 'content__file_details')\
            .order_by('title')
        
        serializer = ContentProfileSerializer(content_profiles, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, collection_id):
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


# Knowledge Path Views
class KnowledgePathListView(APIView):
    """API view to retrieve the list of all KnowledgePath instances."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        knowledge_paths = KnowledgePath.objects.values('title', 'author')
        return Response(knowledge_paths, status=status.HTTP_200_OK)

    def post(self, request):
        serializer = KnowledgePathSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(author=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class KnowledgePathDetailView(APIView):
    """API view to retrieve a specific KnowledgePath instance."""
    permission_classes = [IsAuthor]

    def get(self, request, pk):
        knowledge_path = get_object_or_404(
            KnowledgePath.objects.prefetch_related('nodes'), 
            pk=pk
        )
        serializer = KnowledgePathSerializer(knowledge_path)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        knowledge_path = get_object_or_404(KnowledgePath, pk=pk)
        self.check_object_permissions(request, knowledge_path)
        serializer = KnowledgePathSerializer(knowledge_path, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        knowledge_path = get_object_or_404(KnowledgePath, pk=pk)
        self.check_object_permissions(request, knowledge_path)
        knowledge_path.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class KnowledgePathNodesView(APIView):
    """API view to manage nodes in a KnowledgePath."""
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
    """API view to manage individual nodes."""
    permission_classes = [IsAuthor]

    def get(self, request, pk):
        node = get_object_or_404(Node, pk=pk)
        return Response(node, status=status.HTTP_200_OK)

    def put(self, request, pk):
        node = get_object_or_404(Node.objects.select_related('knowledge_path'), pk=pk)
        knowledge_path = node.knowledge_path
        self.check_object_permissions(request, knowledge_path)
        
        serializer = NodeSerializer(node, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        node = get_object_or_404(Node.objects.select_related('knowledge_path'), pk=pk)
        knowledge_path = node.knowledge_path
        self.check_object_permissions(request, knowledge_path)
        node.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# Topic Views
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


class TopicDetailView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request, pk):
        topic = get_object_or_404(
            Topic.objects.prefetch_related(
                'contents',
                'contents__file_details',
                'contents__profiles'
            ),
            pk=pk
        )
        serializer = TopicDetailSerializer(topic, context={
            'request': request,
            'user': request.user,
            'topic': topic
        })
        return Response(serializer.data)

    def patch(self, request, pk):
        topic = get_object_or_404(Topic, pk=pk)
        
        if 'topic_image' in request.FILES:
            if topic.topic_image:
                old_image_path = os.path.join(settings.MEDIA_ROOT, str(topic.topic_image))
                if os.path.exists(old_image_path):
                    os.remove(old_image_path)
                topic.topic_image.delete(save=False)
            
            topic.topic_image = request.FILES['topic_image']
            topic.save()
        
        serializer = TopicDetailSerializer(topic, context={'request': request})
        return Response(serializer.data)


class TopicBasicView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        topic = get_object_or_404(Topic, pk=pk)
        serializer = TopicBasicSerializer(topic)
        return Response(serializer.data)


class TopicEditContentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        topic = get_object_or_404(Topic, pk=pk)
        content_ids = request.data.get('content_ids', [])
        
        try:
            contents = Content.objects.filter(id__in=content_ids)
            topic.contents.add(*contents)
            return Response(
                {'message': 'Content added successfully'}, 
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'error': f'Failed to add content: {str(e)}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

    def patch(self, request, pk):
        topic = get_object_or_404(Topic, pk=pk)
        content_ids = request.data.get('content_ids', [])
        
        try:
            contents = Content.objects.filter(id__in=content_ids)
            topic.contents.remove(*contents)
            return Response(
                {'message': 'Content removed successfully'}, 
                status=status.HTTP_200_OK
            )
        except Exception as e:
            return Response(
                {'error': f'Failed to remove content: {str(e)}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )


class TopicContentMediaTypeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk, media_type):
        topic = get_object_or_404(Topic, pk=pk)
        media_type = media_type.upper()
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
