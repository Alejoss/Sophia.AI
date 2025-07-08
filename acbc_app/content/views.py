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
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from django.apps import apps
from django.contrib.contenttypes.models import ContentType
from django.contrib.auth.models import User
from django.db import models

from utils.permissions import IsAuthor
from content.models import Library, Collection, Content, Topic, ContentProfile, FileDetails, Publication
from knowledge_paths.models import KnowledgePath, Node
from votes.models import VoteCount
from content.serializers import (
    LibrarySerializer,
    CollectionSerializer,
    ContentSerializer,
    ContentWithSelectedProfileSerializer,
    TopicBasicSerializer,
    TopicDetailSerializer,
    ContentProfileSerializer,
    SimpleContentProfileSerializer,
    PreviewContentProfileSerializer,
    PreviewContentSerializer,
    TopicIdTitleSerializer,
    PublicationBasicSerializer
)
from knowledge_paths.serializers import (
    KnowledgePathSerializer,
    NodeSerializer
)
from .serializers import PublicationSerializer
from content.utils import get_top_voted_contents
from bs4 import BeautifulSoup
import requests
import re
from urllib.parse import urlparse, urljoin, parse_qs, urlencode, urlunparse
from django.core.validators import URLValidator
from django.core.exceptions import ValidationError

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


class ContentDetailView(APIView):
    """API view to retrieve, update, or delete a specific Content instance."""
    permission_classes = [IsAuthenticated]

    def get_content_profile(self, content, request):
        """
        Get the appropriate ContentProfile based on context parameters.
        Falls back to user's profile and finally to None if no profile is found.
        """
        context = request.query_params.get('context')
        context_id = request.query_params.get('id')

        if not context or not context_id:
            return None

        try:
            # Try to get profile based on context
            if context == 'topic':
                topic = Topic.objects.get(id=context_id)
                return ContentProfile.objects.get(content=content, user=topic.creator)
            
            elif context == 'library':
                library_owner = User.objects.get(id=context_id)
                return ContentProfile.objects.get(content=content, user=library_owner)
            
            elif context == 'publication':
                publication = Publication.objects.get(id=context_id)
                return ContentProfile.objects.get(content=content, user=publication.user)
            
            elif context == 'knowledge_path':
                path = KnowledgePath.objects.get(id=context_id)
                return ContentProfile.objects.get(content=content, user=path.author)

        except (Topic.DoesNotExist, User.DoesNotExist, 
                Publication.DoesNotExist, KnowledgePath.DoesNotExist,
                ContentProfile.DoesNotExist):
            pass

        # First fallback: try to get logged user's profile
        try:
            return ContentProfile.objects.get(content=content, user=request.user)
        except ContentProfile.DoesNotExist:
            pass

        # Final fallback: return None (serializer will use original content data)
        return None

    def get(self, request, pk):
        try:
            content = Content.objects.get(pk=pk)
            selected_profile = self.get_content_profile(content, request)
            
            # Get topic from context if available
            topic = None
            context = request.query_params.get('context')
            context_id = request.query_params.get('id')
            if context == 'topic' and context_id:
                topic = Topic.objects.get(id=context_id)
            
            # Always use the full serializer for ContentDetailView
            serializer = ContentWithSelectedProfileSerializer(
                content,
                context={
                    'request': request,
                    'selected_profile': selected_profile,
                    'topic': topic  # Pass the topic to the serializer context
                }
            )
            
            serialized_data = serializer.data
            return Response(serialized_data)
            
        except Content.DoesNotExist:
            return Response(
                {'error': 'Content not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )

    def delete(self, request, pk):
        try:
            content = get_object_or_404(Content, pk=pk)
            # Check if the user has permission to delete this content
            content_profile = ContentProfile.objects.get(content=content, user=request.user)
            
            # Delete the content profile first
            content_profile.delete()
            
            # Only delete the content and file if this was the last profile
            remaining_profiles = ContentProfile.objects.filter(content=content).count()
            if remaining_profiles == 0:
                # No more profiles exist, safe to delete the content and file
                if content.file_details:
                    if content.file_details.file:
                        content.file_details.file.delete()
                    content.file_details.delete()
                content.delete()
            
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ContentProfile.DoesNotExist:
            return Response(
                {'error': 'You do not have permission to delete this content'},
                status=status.HTTP_403_FORBIDDEN
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ContentPreviewView(APIView):
    """API view to retrieve content for preview mode display with lighter serializer."""
    permission_classes = [IsAuthenticated]

    def get_content_profile(self, content, request):
        """
        Get the appropriate ContentProfile based on context parameters.
        Falls back to user's profile and finally to None if no profile is found.
        """
        context = request.query_params.get('context')
        context_id = request.query_params.get('id')

        if not context or not context_id:
            return None

        try:
            # Try to get profile based on context
            if context == 'topic':
                topic = Topic.objects.get(id=context_id)
                return ContentProfile.objects.get(content=content, user=topic.creator)
            
            elif context == 'library':
                library_owner = User.objects.get(id=context_id)
                return ContentProfile.objects.get(content=content, user=library_owner)
            
            elif context == 'publication':
                publication = Publication.objects.get(id=context_id)
                return ContentProfile.objects.get(content=content, user=publication.user)
            
            elif context == 'knowledge_path':
                path = KnowledgePath.objects.get(id=context_id)
                return ContentProfile.objects.get(content=content, user=path.author)

        except (Topic.DoesNotExist, User.DoesNotExist, 
                Publication.DoesNotExist, KnowledgePath.DoesNotExist,
                ContentProfile.DoesNotExist):
            pass

        # First fallback: try to get logged user's profile
        try:
            return ContentProfile.objects.get(content=content, user=request.user)
        except ContentProfile.DoesNotExist:
            pass

        # Final fallback: return None (serializer will use original content data)
        return None

    def get(self, request, pk):
        try:
            content = Content.objects.get(pk=pk)
            selected_profile = self.get_content_profile(content, request)
            
            if selected_profile:
                # Use the lightweight PreviewContentProfileSerializer for preview mode
                serializer = PreviewContentProfileSerializer(
                    selected_profile,
                    context={'request': request}
                )
            else:
                # Fallback to original content data with basic serializer
                serializer = PreviewContentSerializer(
                    content,
                    context={'request': request}
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
            # Validate input
            url = request.data.get('url')
            file = request.FILES.get('file')
            
            # Check if both URL and file are provided
            if url and file:
                return Response(
                    {'error': 'Cannot provide both file and URL'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if neither URL nor file is provided
            if not url and not file:
                return Response(
                    {'error': 'No file or URL provided'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # If URL is provided, validate its format
            if url:
                # Normalize YouTube URLs to remove unnecessary parameters
                normalized_url = normalize_youtube_url(url)
                
                validator = URLValidator()
                try:
                    validator(normalized_url)
                except ValidationError:
                    return Response(
                        {'error': 'Invalid URL format'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # For URL content, get media_type from request data or default to TEXT
                media_type = request.data.get('media_type', 'TEXT')
                
                # Validate media_type
                valid_media_types = ['VIDEO', 'AUDIO', 'TEXT', 'IMAGE']
                if media_type not in valid_media_types:
                    return Response(
                        {'error': f'Invalid media type. Must be one of: {", ".join(valid_media_types)}'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                title = request.data.get('title', normalized_url)
                
                content = Content.objects.create(
                    uploaded_by=request.user,
                    media_type=media_type,
                    original_title=title,
                    original_author=request.data.get('author'),
                    url=normalized_url  # Store the normalized URL
                )

                content_profile = ContentProfile.objects.create(
                    content=content,
                    title=title,
                    author=request.data.get('author'),
                    personal_note=request.data.get('personalNote'),
                    user=request.user,
                    is_visible=True,  # URLs are always visible
                    is_producer=False  # URLs can't be produced content
                )

                file_details = FileDetails.objects.create(
                    content=content,
                    og_description=request.data.get('og_description'),
                    og_image=request.data.get('og_image'),
                    og_type=request.data.get('og_type'),
                    og_site_name=request.data.get('og_site_name')
                )

                # Serialize the content profile to return in the response
                content_profile_serializer = ContentProfileSerializer(
                    content_profile,
                    context={'request': request}
                )

                return Response({
                    'message': 'Content uploaded successfully',
                    'content_id': content.id,
                    'content_profile': content_profile_serializer.data
                }, status=status.HTTP_201_CREATED)

            else:
                # Handle file upload
                file = request.FILES.get('file')
                if not file:
                    return Response(
                        {'error': 'No file provided'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )

                media_type = request.data.get('media_type')
                if not media_type:
                    return Response(
                        {'error': 'Media type not detected'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Get title from request or use filename if not provided
                title = request.data.get('title')
                if not title:
                    # Use the filename without extension as the title
                    filename = os.path.splitext(file.name)[0]
                    title = filename

                # Convert string booleans to actual booleans
                is_visible = request.data.get('is_visible')
                if isinstance(is_visible, str):
                    is_visible = is_visible.lower() == 'true'
                else:
                    is_visible = bool(is_visible)

                is_producer = request.data.get('is_producer')
                if isinstance(is_producer, str):
                    is_producer = is_producer.lower() == 'true'
                else:
                    is_producer = bool(is_producer)

                content = Content.objects.create(
                    uploaded_by=request.user,
                    media_type=media_type,
                    original_title=title,
                    original_author=request.data.get('author')
                )

                content_profile = ContentProfile.objects.create(
                    content=content,
                    title=title,
                    author=request.data.get('author'),
                    personal_note=request.data.get('personalNote'),
                    user=request.user,
                    is_visible=is_visible,
                    is_producer=is_producer
                )

                file_details = FileDetails.objects.create(
                    content=content,
                    file=file,
                    file_size=file.size
                )

            # Serialize the content profile to return in the response
            content_profile_serializer = ContentProfileSerializer(
                content_profile,
                context={'request': request}
            )

            return Response({
                'message': 'Content uploaded successfully',
                'content_id': content.id,
                'content_profile': content_profile_serializer.data
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response(
                {
                    'error': 'Failed to upload content',
                    'details': str(e)  # Include error details in response
                }, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserContentListView(APIView):
    """API view to retrieve all content profiles owned by a user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            content_profiles = ContentProfile.objects.filter(user=request.user)\
                .select_related('content')\
                .order_by('title')
            
            # Serialize each profile individually to handle errors gracefully
            response_data = []
            for profile in content_profiles:
                try:
                    serializer = SimpleContentProfileSerializer(
                        profile, 
                        context={'request': request}
                    )
                    response_data.append(serializer.data)
                except Exception as e:
                    # Skip this profile instead of failing the entire request
                    continue
            
            return Response(response_data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {'error': 'An error occurred while fetching content'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserContentWithDetailsView(APIView):
    """API view to retrieve all content profiles owned by a user with file details for card mode display."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            content_profiles = ContentProfile.objects.filter(user=request.user)\
                .select_related('content', 'content__file_details')\
                .order_by('title')
            
            # Serialize each profile individually to handle errors gracefully
            response_data = []
            for profile in content_profiles:
                try:
                    serializer = ContentProfileSerializer(
                        profile, 
                        context={'request': request}
                    )
                    response_data.append(serializer.data)
                except Exception as e:
                    # Skip this profile instead of failing the entire request
                    continue
            
            return Response(response_data, status=status.HTTP_200_OK)
        except Exception as e:
            return Response(
                {'error': 'An error occurred while fetching content'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserContentByIdView(APIView):
    """API view to retrieve all content profiles owned by a specific user by ID."""
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        try:
            # Get the user object
            user = User.objects.get(id=user_id)
            
            # Get all content profiles for this user
            content_profiles = ContentProfile.objects.filter(user=user)\
                .select_related('content', 'content__file_details')\
                .order_by('title')
            
            # Serialize each profile individually to handle errors gracefully
            response_data = []
            for profile in content_profiles:
                try:
                    serializer = ContentProfileSerializer(
                        profile, 
                        context={'request': request}
                    )
                    response_data.append(serializer.data)
                except Exception as e:
                    # Skip this profile instead of failing the entire request
                    continue
            
            return Response(response_data, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response(
                {'error': f'User with ID {user_id} not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': 'An error occurred while fetching content'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class RecentUserContentView(APIView):
    """Get user's recently uploaded content profiles optimized for simple mode display"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        recent_content = ContentProfile.objects.filter(
            user=request.user
        ).select_related(
            'content'  # Only select content, not file_details since simple mode doesn't need it
        ).order_by(
            '-created_at'
        )[:4]
        
        serializer = SimpleContentProfileSerializer(
            recent_content, 
            many=True, 
            context={'request': request}
        )
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
        ).select_related('content')\
            .order_by('title')
        
        serializer = SimpleContentProfileSerializer(content_profiles, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, collection_id):
        collection = get_object_or_404(
            Collection, 
            id=collection_id, 
            library__user=request.user
        )
        
        content_profile_ids = request.data.get('content_profile_ids')
        if not content_profile_ids or not isinstance(content_profile_ids, list):
            return Response(
                {'error': 'content_profile_ids must be a non-empty array'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
            
        updated_profiles = []
        for profile_id in content_profile_ids:
            try:
                content_profile = ContentProfile.objects.get(
                    id=profile_id,
                    user=request.user
                )
                content_profile.collection = collection
                content_profile.save()
                updated_profiles.append(content_profile)
            except ContentProfile.DoesNotExist:
                # Skip profiles that don't exist or don't belong to the user
                continue
        
        serializer = ContentProfileSerializer(updated_profiles, many=True)
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
        
        # If trying to change visibility, check if user has claimed to be the producer
        if 'is_visible' in request.data:
            if not request.data.get('is_producer', False):
                return Response(
                    {'error': 'You must claim to be the producer to change visibility'},
                    status=status.HTTP_403_FORBIDDEN
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

    def put(self, request, content_profile_id):
        """Update content profile to reference a different content"""
        content_profile = get_object_or_404(
            ContentProfile,
            id=content_profile_id,
            user=request.user
        )
        
        new_content_id = request.data.get('content_id')
        if not new_content_id:
            return Response(
                {'error': 'content_id is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            new_content = Content.objects.get(id=new_content_id)
        except Content.DoesNotExist:
            return Response(
                {'error': 'Content not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Update the content profile to reference the new content
        content_profile.content = new_content
        content_profile.save()
        
        serializer = ContentProfileSerializer(content_profile, context={'request': request})
        return Response(serializer.data)


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
    # TODO: Add permission classes
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

    def get_content_profile(self, content, request, topic):
        """
        Get the appropriate ContentProfile based on context.
        For topics, we want the topic creator's profile for the content.
        """
        try:
            # Try to get the topic creator's profile for this content
            return ContentProfile.objects.get(content=content, user=topic.creator)
        except ContentProfile.DoesNotExist:
            pass

        # Fallback: try to get logged user's profile
        try:
            return ContentProfile.objects.get(content=content, user=request.user)
        except ContentProfile.DoesNotExist:
            pass

        # Final fallback: return None (serializer will use original content data)
        return None

    def get(self, request, pk):
        topic = get_object_or_404(
            Topic.objects.prefetch_related(
                'contents',
                'contents__file_details',
                'contents__profiles'
            ),
            pk=pk
        )

        # Get top 3 most upvoted contents for each media type
        top_contents = {}
        for media_type in ['IMAGE', 'TEXT', 'AUDIO', 'VIDEO']:
            contents = get_top_voted_contents(topic, media_type)
            top_contents[media_type] = contents

        # Create ordered list of contents
        ordered_contents = []
        for media_type in ['IMAGE', 'TEXT', 'AUDIO', 'VIDEO']:
            ordered_contents.extend(top_contents[media_type])

        # Update the topic's contents with the ordered list
        topic.contents.set(ordered_contents)
        
        # Reload the contents with file_details prefetched
        content_ids = [content.id for content in ordered_contents]
        reloaded_contents = Content.objects.filter(id__in=content_ids).prefetch_related('file_details')
        
        # Create a mapping of content objects with file_details loaded
        content_map = {content.id: content for content in reloaded_contents}
        
        # Replace the contents in the topic with the reloaded ones
        topic.contents.clear()
        for content_id in content_ids:
            if content_id in content_map:
                topic.contents.add(content_map[content_id])

        # Get the appropriate profile for each content
        contents_with_profiles = []
        for content in topic.contents.all():
            selected_profile = self.get_content_profile(content, request, topic)
            contents_with_profiles.append({
                'content': content,
                'selected_profile': selected_profile
            })

        serializer = TopicDetailSerializer(topic, context={
            'request': request,
            'user': request.user,
            'topic': topic,
            'selected_profiles': {item['content'].id: item['selected_profile'] for item in contents_with_profiles}
        })
        return Response(serializer.data)

    def patch(self, request, pk):
        topic = get_object_or_404(Topic, pk=pk)
        
        # Check if user is author or moderator
        if not topic.is_moderator_or_creator(request.user):
            return Response(
                {"error": "You do not have permission to update this topic."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Handle image update if present
        if 'topic_image' in request.FILES:
            if topic.topic_image:
                old_image_path = os.path.join(settings.MEDIA_ROOT, str(topic.topic_image))
                if os.path.exists(old_image_path):
                    os.remove(old_image_path)
                topic.topic_image.delete(save=False)
            
            request.data['topic_image'] = request.FILES['topic_image']
        
        serializer = TopicDetailSerializer(
            topic,
            data=request.data,
            context={'request': request},
            partial=True
        )
        
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TopicContentSimpleView(APIView):
    """Topic content view optimized for content management operations"""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        topic = get_object_or_404(
            Topic.objects.prefetch_related('contents'),
            pk=pk
        )

        # Get all content profiles for the user that are in this topic
        content_profiles = ContentProfile.objects.filter(
            content__in=topic.contents.all(),
            user=request.user
        ).select_related('content').order_by('title')
        
        # Serialize each profile individually to handle errors gracefully
        response_data = []
        for profile in content_profiles:
            try:
                serializer = SimpleContentProfileSerializer(
                    profile, 
                    context={'request': request}
                )
                response_data.append(serializer.data)
            except Exception as e:
                # Skip this profile instead of failing the entire request
                continue

        return Response({
            'topic': {
                'id': topic.id,
                'title': topic.title,
                'description': topic.description
            },
            'contents': response_data
        }, status=status.HTTP_200_OK)


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
        
        content_profile_ids = request.data.get('content_profile_ids', [])
        
        try:
            # Get content profiles and verify they belong to the user
            content_profiles = ContentProfile.objects.filter(
                id__in=content_profile_ids,
                user=request.user
            )
            
            # Extract content objects from profiles and add to topic
            contents = [profile.content for profile in content_profiles]
            
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

    def get_content_profile(self, content, request, topic):
        """
        Get the appropriate ContentProfile based on context.
        For topics, we want the topic creator's profile for the content.
        """
        try:
            # Try to get the topic creator's profile for this content
            return ContentProfile.objects.get(content=content, user=topic.creator)
        except ContentProfile.DoesNotExist:
            pass

        # Fallback: try to get logged user's profile
        try:
            return ContentProfile.objects.get(content=content, user=request.user)
        except ContentProfile.DoesNotExist:
            pass

        # Final fallback: return None (serializer will use original content data)
        return None

    def get(self, request, pk, media_type):
        topic = get_object_or_404(Topic, pk=pk)
        media_type = media_type.upper()
        contents = topic.contents.filter(media_type=media_type)\
            .prefetch_related('file_details')\
            .order_by('-created_at')

        # Get the appropriate profile for each content
        contents_with_profiles = []
        for content in contents:
            selected_profile = self.get_content_profile(content, request, topic)
            contents_with_profiles.append({
                'content': content,
                'selected_profile': selected_profile
            })

        serializer = ContentWithSelectedProfileSerializer(
            [item['content'] for item in contents_with_profiles], 
            many=True,
            context={
                'request': request, 
                'topic': topic,
                'selected_profiles': {item['content'].id: item['selected_profile'] for item in contents_with_profiles}
            }
        )
        
        return Response({
            'topic': {
                'id': topic.id,
                'title': topic.title
            },
            'contents': serializer.data
        })


class PublicationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id=None):
        if user_id is not None:
            return self.get_user_publications(request, user_id)
        
        publications = Publication.objects.filter(user=request.user, deleted=False)
        serializer = PublicationSerializer(publications, many=True, context={'request': request})
        data = serializer.data        
        return Response(data)

    def post(self, request):
        serializer = PublicationSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def get_user_publications(self, request, user_id):
        try:
            publications = Publication.objects.filter(user_id=user_id, deleted=False, status='PUBLISHED')
            serializer = PublicationSerializer(publications, many=True, context={'request': request})
            return Response(serializer.data)
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )


class PublicationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            publication = Publication.objects.get(id=pk)
            serializer = PublicationSerializer(publication)
            return Response(serializer.data)
        except Publication.DoesNotExist:
            return Response(
                {'error': 'Publication not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def put(self, request, pk):
        publication = get_object_or_404(Publication, pk=pk)
        serializer = PublicationSerializer(publication, data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        publication = get_object_or_404(Publication, pk=pk)
        publication.deleted = True
        publication.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ContentReferencesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            content = Content.objects.get(pk=pk)
            
            # Get all knowledge paths that reference this content through content_profile
            knowledge_paths = KnowledgePath.objects.filter(
                nodes__content_profile__content=content
            ).distinct()
            
            # Get all topics that reference this content
            topics = Topic.objects.filter(
                contents=content
            ).distinct()
            
            # Get all publications that reference this content
            publications = Publication.objects.filter(
                content_profile__content=content
            ).distinct()
            
            from knowledge_paths.serializers import KnowledgePathBasicSerializer
            knowledge_paths_data = KnowledgePathBasicSerializer(
                knowledge_paths, 
                many=True, 
                context={'request': request}
            ).data
            topics_data = TopicIdTitleSerializer(
                topics, 
                many=True, 
                context={'request': request}
            ).data
            publications_data = PublicationBasicSerializer(
                publications, 
                many=True, 
                context={'request': request}
            ).data
            data = {
                'knowledge_paths': knowledge_paths_data,
                'topics': topics_data,
                'publications': publications_data
            }
            return Response(data)
        except Content.DoesNotExist:
            return Response(
                {'error': 'Content not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ContentProfileDetailView(APIView):
    """
    Retrieve a specific content profile by ID
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, profile_id):
        try:
            content_profile = ContentProfile.objects.get(pk=profile_id)
            serializer = ContentProfileSerializer(
                content_profile, 
                context={'request': request}
            )
            return Response(serializer.data)
        except ContentProfile.DoesNotExist:
            return Response(
                {"error": "Content profile not found"}, 
                status=status.HTTP_404_NOT_FOUND
            )


class ContentProfileCreateView(APIView):
    """API view to create a new content profile for a user."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:     # Validate required fields
            content_id = request.data.get('content')
            if not content_id:
                return Response(
                    {'error': 'Content ID is required'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Check if content exists
            try:
                content = Content.objects.get(id=content_id)
            except Content.DoesNotExist:
                return Response(
                    {'error': f'Content with ID {content_id} not found'}, 
                    status=status.HTTP_404_NOT_FOUND
                )

            # Check if user already has a profile for this content
            existing_profile = ContentProfile.objects.filter(
                content=content,
                user=request.user
            ).first()

            if existing_profile:
                return Response(
                    {'error': 'You already have a profile for this content'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Extract and validate profile data
            title = request.data.get('title', content.original_title)
            author = request.data.get('author', content.original_author)
            personal_note = request.data.get('personalNote', '')
            is_visible = request.data.get('isVisible', True)
            is_producer = request.data.get('isProducer', False)

            # Create new content profile
            try:
                content_profile = ContentProfile.objects.create(
                    content=content,
                    user=request.user,
                    title=title,
                    author=author,
                    personal_note=personal_note,
                    is_visible=is_visible,
                    is_producer=is_producer
                )
            except Exception as e:
                return Response(
                    {
                        'error': 'Failed to create content profile',
                        'details': 'Database error occurred while creating the profile'
                    }, 
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            # Serialize the response
            try:
                serializer = ContentProfileSerializer(
                    content_profile,
                    context={'request': request}
                )
                response_data = serializer.data
                return Response(response_data, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response(
                    {
                        'error': 'Failed to serialize content profile',
                        'details': 'Error occurred while preparing the response'
                    }, 
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        except Exception as e:
            return Response(
                {
                    'error': 'An unexpected error occurred',
                    'details': 'Please check the server logs for more information'
                }, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class URLPreviewView(APIView):
    """API view to get preview data for a URL."""
    permission_classes = [IsAuthenticated]

    def extract_favicon(self, soup, base_url):
        """Extract favicon URL from HTML."""
        # Try standard favicon locations
        favicon_link = soup.find('link', rel=lambda r: r and ('icon' in r or 'shortcut icon' in r))
        if favicon_link and favicon_link.get('href'):
            favicon_url = urljoin(base_url, favicon_link['href'])
            return favicon_url
        
        # Try default location
        parsed_url = urlparse(base_url)
        default_favicon = f"{parsed_url.scheme}://{parsed_url.netloc}/favicon.ico"
        try:
            response = requests.head(default_favicon)
            if response.status_code == 200:
                return default_favicon
        except Exception:
            pass
        
        return None

    def extract_youtube_data(self, url):
        """Extract metadata from YouTube URLs."""
        # Extract video ID from URL
        video_id = None
        patterns = [
            r'youtube\.com/watch\?v=([^&]+)',
            r'youtu\.be/([^?]+)',
            r'youtube\.com/embed/([^?]+)'
        ]
        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                video_id = match.group(1)
                break
        
        if not video_id:
            return None

        try:
            # Get oEmbed data from YouTube
            oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
            response = requests.get(oembed_url, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                return {
                    'title': data.get('title'),
                    'description': None,
                    'image': f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg",
                    'favicon': "https://www.youtube.com/favicon.ico",
                    'siteName': "YouTube",
                    'type': 'VIDEO'
                }
        except Exception:
            pass
        return None

    def post(self, request):
        url = request.data.get('url')
        
        if not url:
            return Response(
                {'error': 'URL is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Check if it's a YouTube URL first
            if 'youtube.com' in url or 'youtu.be' in url:
                youtube_data = self.extract_youtube_data(url)
                if youtube_data:
                    return Response(youtube_data)

            # Make request with browser-like headers
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            }
            
            response = requests.get(url, headers=headers, timeout=5, verify=True)

            if response.status_code == 403:
                return Response(
                    {'error': 'Unable to access this URL'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            response.raise_for_status()
            
            # Check content type
            content_type = response.headers.get('content-type', '').lower()
            
            if not content_type.startswith('text/html'):
                return Response({
                    'error': 'URL must point to a webpage'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Parse HTML
            soup = BeautifulSoup(response.text, 'html.parser')
            
            # Extract Open Graph metadata
            metadata = {
                'title': None,
                'description': None,
                'image': None,
                'siteName': None,
                'type': None,
                'favicon': None
            }
            
            # Get Open Graph metadata
            og_tags = {
                'title': ['og:title', 'twitter:title'],
                'description': ['og:description', 'twitter:description', 'description'],
                'image': ['og:image', 'twitter:image'],
                'siteName': ['og:site_name'],
                'type': ['og:type']
            }
            
            for key, properties in og_tags.items():
                for prop in properties:
                    meta = soup.find('meta', property=prop)
                    if not meta:
                        meta = soup.find('meta', attrs={'name': prop})
                    
                    if meta and meta.get('content'):
                        metadata[key] = meta.get('content')
                        break
            
            # Fallbacks
            if not metadata['title']:
                metadata['title'] = soup.title.string if soup.title else None
                
            if not metadata['type']:
                metadata['type'] = 'website'
            
            # Convert relative URLs to absolute
            if metadata['image'] and not metadata['image'].startswith(('http://', 'https://')):
                metadata['image'] = urljoin(url, metadata['image'])
            
            # Get favicon
            metadata['favicon'] = self.extract_favicon(soup, url)
            
            # Clean up None values and validate
            metadata = {k: v for k, v in metadata.items() if v is not None}
            
            if not metadata.get('title') and not metadata.get('description') and not metadata.get('image'):
                return Response(
                    {'error': 'Could not extract preview information from this URL'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            return Response(metadata)
            
        except requests.Timeout:
            return Response(
                {'error': 'Failed to fetch URL data'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except requests.RequestException as e:
            return Response(
                {'error': 'Failed to fetch URL data'}, 
                status=status.HTTP_400_BAD_REQUEST
            )


def normalize_youtube_url(url):
    """
    Normalize YouTube URLs by removing unnecessary parameters and keeping only essential ones.
    This ensures consistent behavior for YouTube metadata extraction.
    """
    if not url or ('youtube.com' not in url and 'youtu.be' not in url):
        return url
    
    try:
        parsed = urlparse(url)
        
        # Handle youtu.be URLs
        if parsed.netloc == 'youtu.be':
            video_id = parsed.path.lstrip('/')
            return f"https://www.youtube.com/watch?v={video_id}"
        
        # Handle youtube.com URLs
        if parsed.netloc in ['www.youtube.com', 'youtube.com'] and parsed.path == '/watch':
            query_params = parse_qs(parsed.query)
            
            # Keep only essential parameters
            essential_params = {}
            if 'v' in query_params:
                essential_params['v'] = query_params['v'][0]
            
            # Rebuild the URL with only essential parameters
            clean_query = urlencode(essential_params)
            clean_url = urlunparse((
                parsed.scheme,
                parsed.netloc,
                parsed.path,
                parsed.params,
                clean_query,
                parsed.fragment
            ))
            
            return clean_url
        
        return url
    except Exception:
        # If parsing fails, return the original URL
        return url


class ContentModificationCheckView(APIView):
    """API view to check if content can be modified by the current user."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        try:
            content = Content.objects.get(pk=pk)
            
            can_modify = content.can_be_modified_by(request.user)
            other_users_count = content.get_other_user_profiles_count()
            
            return Response({
                'can_modify': can_modify,
                'other_users_count': other_users_count,
                'is_original_uploader': content.uploaded_by and content.uploaded_by.id == request.user.id,
                'message': (
                    f"Cannot change the source of this content because {other_users_count} other user(s) have added it to their libraries"
                    if not can_modify and other_users_count > 0
                    else "Content can be modified"
                )
            })
            
        except Content.DoesNotExist:
            return Response(
                {'error': 'Content not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class ContentUpdateView(APIView):
    """API view to update a specific Content instance."""
    permission_classes = [IsAuthenticated]

    def put(self, request, pk):
        try:
            print(f"\n=== ContentUpdateView PUT request ===")
            print(f"Content ID: {pk}")
            print(f"Request data: {request.data}")
            print(f"Request user: {request.user}")
            
            content = get_object_or_404(Content, pk=pk)
            print(f"Found content: {content}")
            print(f"Current content URL: {content.url}")
            print(f"Current content media_type: {content.media_type}")
            print(f"Current content original_title: {content.original_title}")
            print(f"Current content original_author: {content.original_author}")
            
            # Check if the user has a profile for this content (i.e., owns it)
            try:
                content_profile = ContentProfile.objects.get(content=content, user=request.user)
                print(f"Found content profile: {content_profile}")
            except ContentProfile.DoesNotExist:
                print("Content profile not found for user")
                return Response(
                    {'error': 'You do not have permission to edit this content'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Validate media_type if provided
            if 'media_type' in request.data:
                print(f"Media type in request: {request.data['media_type']}")
                valid_media_types = ['VIDEO', 'AUDIO', 'TEXT', 'IMAGE']
                if request.data['media_type'] not in valid_media_types:
                    return Response(
                        {'error': f'Invalid media type. Must be one of: {", ".join(valid_media_types)}'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Validate URL if provided
            if 'url' in request.data and request.data['url']:
                print(f"URL in request: {request.data['url']}")
                validator = URLValidator()
                try:
                    validator(request.data['url'])
                    print("URL validation passed")
                except ValidationError:
                    print("URL validation failed")
                    return Response(
                        {'error': 'Invalid URL format'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Update the content
            print("About to update content with data:", request.data)
            serializer = ContentSerializer(content, data=request.data, partial=True)
            if serializer.is_valid():
                print("Serializer is valid")
                print("Serializer validated data:", serializer.validated_data)
                updated_content = serializer.save()
                print(f"Content updated successfully")
                print(f"Updated content URL: {updated_content.url}")
                print(f"Updated content media_type: {updated_content.media_type}")
                print(f"Updated content original_title: {updated_content.original_title}")
                print(f"Updated content original_author: {updated_content.original_author}")
                return Response(serializer.data)
            else:
                print("Serializer errors:", serializer.errors)
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        except Content.DoesNotExist:
            print("Content not found")
            return Response(
                {'error': 'Content not found'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            print(f"Unexpected error: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

