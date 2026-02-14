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
from django.db.models import Q
from django.db.models.functions import Coalesce
from django.utils import timezone
import logging

from utils.permissions import IsAuthor
from utils.notification_utils import (
    notify_topic_moderator_invitation,
    notify_topic_moderator_invitation_accepted,
    notify_topic_moderator_invitation_declined
)
from content.models import Library, Collection, Content, Topic, ContentProfile, FileDetails, Publication, TopicModeratorInvitation, ContentSuggestion
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
    PublicationBasicSerializer,
    TopicModeratorInvitationSerializer,
    ContentSuggestionSerializer
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
import time
import uuid
import boto3

# Django-standard logger
logger = logging.getLogger('content')

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
        user_id = request.user.id if request.user.is_authenticated else None
        
        logger.info(
            "Content detail request",
            extra={
                'user_id': user_id,
                'content_id': pk,
                'context': request.query_params.get('context'),
                'context_id': request.query_params.get('id'),
            }
        )
        
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
            logger.info(
                "Content detail retrieved successfully",
                extra={
                    'user_id': user_id,
                    'content_id': pk,
                    'has_profile': selected_profile is not None,
                }
            )
            return Response(serialized_data)
            
        except Content.DoesNotExist:
            logger.warning(
                "Content not found",
                extra={
                    'user_id': user_id,
                    'content_id': pk,
                }
            )
            return Response(
                {'error': 'Contenido no encontrado'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(
                f"Error retrieving content detail: {str(e)}",
                extra={
                    'user_id': user_id,
                    'content_id': pk,
                },
                exc_info=True
            )
            return Response(
                {'error': 'Error interno del servidor'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def delete(self, request, pk):
        user_id = request.user.id
        username = request.user.username
        
        logger.info(
            "Content deletion request",
            extra={
                'user_id': user_id,
                'username': username,
                'content_id': pk,
            }
        )
        
        try:
            content = get_object_or_404(Content, pk=pk)
            content_profile = ContentProfile.objects.filter(
                content=content, user=request.user
            ).first()

            # Allow: user has a profile, OR user is the original uploader, OR staff/superuser
            if not content_profile and content.uploaded_by_id != request.user.id and not request.user.is_staff:
                logger.warning(
                    "Content deletion failed: permission denied",
                    extra={
                        'user_id': user_id,
                        'username': username,
                        'content_id': pk,
                    }
                )
                return Response(
                    {'error': 'No tiene permiso para eliminar este contenido'},
                    status=status.HTTP_403_FORBIDDEN
                )

            if content_profile:
                logger.info(
                    "Deleting content profile",
                    extra={
                        'user_id': user_id,
                        'username': username,
                        'content_id': pk,
                        'content_title': content.original_title,
                        'media_type': content.media_type,
                    }
                )
                content_profile.delete()

            # Delete the content and file if no profiles remain (or uploader/staff doing full delete)
            remaining_profiles = ContentProfile.objects.filter(content=content).count()
            delete_content = (
                remaining_profiles == 0
                or (not content_profile and (content.uploaded_by_id == request.user.id or request.user.is_staff))
            )
            if delete_content:
                has_file_details = hasattr(content, 'file_details')
                fd = content.file_details if has_file_details else None
                logger.info(
                    "Deleting content and file (last profile removed)",
                    extra={
                        'user_id': user_id,
                        'username': username,
                        'content_id': pk,
                        'has_file_details': has_file_details,
                        'has_file': bool(fd.file) if fd and fd.file else False,
                    }
                )
                # No more profiles exist, safe to delete the content and file
                if fd:
                    if fd.file:
                        fd.file.delete()
                    fd.delete()
                content.delete()
            else:
                logger.info(
                    "Content profile deleted, content remains (other profiles exist)",
                    extra={
                        'user_id': user_id,
                        'username': username,
                        'content_id': pk,
                        'remaining_profiles': remaining_profiles,
                    }
                )
            
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            logger.error(
                f"Content deletion failed: {str(e)}",
                extra={
                    'user_id': user_id,
                    'username': username,
                    'content_id': pk,
                },
                exc_info=True
            )
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
                {'error': 'Contenido no encontrado'}, 
                status=status.HTTP_404_NOT_FOUND
            )


class UploadContentView(APIView):
    """API view to handle content uploads."""
    permission_classes = [IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        start_time = time.time()
        user_id = request.user.id
        username = request.user.username
        
        logger.info(
            "Content upload request started",
            extra={
                'user_id': user_id,
                'username': username,
                'has_url': bool(request.data.get('url')),
                'has_file': bool(request.FILES.get('file')),
                'media_type': request.data.get('media_type'),
            }
        )
        
        try:
            # Validate input
            url = request.data.get('url')
            file = request.FILES.get('file')
            
            # Check if both URL and file are provided
            if url and file:
                logger.warning(
                    "Upload validation failed: both URL and file provided",
                    extra={'user_id': user_id, 'username': username}
                )
                return Response(
                    {'error': 'No se puede proporcionar tanto archivo como URL'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if neither URL nor file is provided
            if not url and not file:
                logger.warning(
                    "Upload validation failed: no file or URL provided",
                    extra={'user_id': user_id, 'username': username}
                )
                return Response(
                    {'error': 'No se proporcionó archivo ni URL'}, 
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
                        {'error': 'Formato de URL inválido'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # For URL content, get media_type from request data or default to TEXT
                media_type = request.data.get('media_type', 'TEXT')
                
                # Validate media_type
                valid_media_types = ['VIDEO', 'AUDIO', 'TEXT', 'IMAGE']
                if media_type not in valid_media_types:
                    return Response(
                        {'error': f'Tipo de medio inválido. Debe ser uno de: {", ".join(valid_media_types)}'}, 
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
                        {'error': 'No se proporcionó archivo'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )

                media_type = request.data.get('media_type')
                if not media_type:
                    return Response(
                        {'error': 'Tipo de medio no detectado'}, 
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
            logger.error(
                f"Content upload failed: {str(e)}",
                extra={
                    'user_id': user_id,
                    'username': username,
                    'has_url': bool(request.data.get('url')),
                    'has_file': bool(request.FILES.get('file')),
                    'media_type': request.data.get('media_type'),
                    'duration': time.time() - start_time
                },
                exc_info=True  # This will be captured by Sentry
            )
            return Response(
                {
                    'error': 'Error al subir contenido',
                    'details': str(e)  # Include error details in response
                }, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


# Max size for direct presigned PUT (5 GB)
UPLOAD_CONTENT_MAX_SIZE = 5 * 1024 * 1024 * 1024
VALID_MEDIA_TYPES = ['VIDEO', 'AUDIO', 'TEXT', 'IMAGE']


class UploadContentPresignView(APIView):
    """Return a presigned URL for direct upload to S3. Client uploads file to that URL, then calls confirm."""
    permission_classes = [IsAuthenticated]
    parser_classes = (JSONParser,)

    def post(self, request):
        logger.info(
            "S3 presign: request started",
            extra={'user_id': request.user.id, 'username': request.user.username}
        )
        if not getattr(settings, 'AWS_ACCESS_KEY_ID', None) or not getattr(settings, 'AWS_SECRET_ACCESS_KEY', None):
            logger.warning("S3 presign: S3 not configured (missing credentials), returning 503")
            return Response(
                {'error': 'S3 no está configurado para subida directa'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        filename = request.data.get('filename')
        file_size = request.data.get('file_size')
        content_type = request.data.get('content_type') or 'application/octet-stream'
        media_type = request.data.get('media_type')
        if not filename or file_size is None:
            return Response(
                {'error': 'Se requieren filename y file_size'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not media_type or media_type not in VALID_MEDIA_TYPES:
            return Response(
                {'error': f'media_type inválido. Debe ser uno de: {", ".join(VALID_MEDIA_TYPES)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            file_size = int(file_size)
        except (TypeError, ValueError):
            return Response({'error': 'file_size debe ser un número'}, status=status.HTTP_400_BAD_REQUEST)
        if file_size <= 0 or file_size > UPLOAD_CONTENT_MAX_SIZE:
            return Response(
                {'error': 'El tamaño del archivo debe estar entre 1 byte y 5 GB'},
                status=status.HTTP_400_BAD_REQUEST
            )
        # Sanitize filename for key (keep extension). Structure: content/{media_type}/{user_id}/{uuid}_{name}
        safe_name = os.path.basename(filename).replace(' ', '_')[:200]
        media_slug = 'document' if media_type == 'TEXT' else media_type.lower()
        key = f"content/{media_slug}/{request.user.id}/{uuid.uuid4().hex}_{safe_name}"
        bucket = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', 'academiablockchain')
        region = getattr(settings, 'AWS_S3_REGION_NAME', 'us-west-2')
        expires_in = 3600
        logger.info(
            "S3 presign: generating URL",
            extra={
                'user_id': request.user.id,
                'upload_filename': filename,
                'file_size': file_size,
                's3_key': key,
                'bucket': bucket,
                'region': region,
            }
        )
        try:
            s3_client = boto3.client(
                's3',
                region_name=region,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
            )
            upload_url = s3_client.generate_presigned_url(
                'put_object',
                Params={
                    'Bucket': bucket,
                    'Key': key,
                    'ContentType': content_type,
                    'ACL': 'public-read',
                },
                ExpiresIn=expires_in
            )
        except Exception as e:
            logger.exception("S3 presign: boto3 failed: %s", e)
            return Response(
                {'error': 'No se pudo generar la URL de subida', 'details': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        logger.info(
            "S3 presign: success",
            extra={'user_id': request.user.id, 's3_key': key, 'bucket': bucket}
        )
        return Response({
            'upload_url': upload_url,
            'key': key,
            'expires_in': expires_in
        }, status=status.HTTP_200_OK)


class UploadContentConfirmView(APIView):
    """After client uploaded file to S3, create Content/ContentProfile/FileDetails with the given key."""
    permission_classes = [IsAuthenticated]
    parser_classes = (JSONParser,)

    def post(self, request):
        try:
            return self._post_impl(request)
        except Exception as e:
            logger.exception(
                "S3 confirm: unhandled error",
                extra={'user_id': getattr(request.user, 'id', None), 'error': str(e)}
            )
            return Response(
                {'error': 'Error al confirmar la subida', 'details': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def _post_impl(self, request):
        logger.info(
            "S3 confirm: request started",
            extra={'user_id': request.user.id, 'username': request.user.username}
        )
        if not getattr(settings, 'AWS_ACCESS_KEY_ID', None):
            logger.warning("S3 confirm: S3 not configured, returning 503")
            return Response(
                {'error': 'S3 no está configurado'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        key = request.data.get('key')
        if not key or not isinstance(key, str) or not key.strip():
            return Response({'error': 'Se requiere key'}, status=status.HTTP_400_BAD_REQUEST)
        key = key.strip()
        # Prevent path traversal
        if '..' in key or key.startswith('/'):
            return Response({'error': 'key inválido'}, status=status.HTTP_400_BAD_REQUEST)
        bucket = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', 'academiablockchain')
        logger.info(
            "S3 confirm: checking object in S3",
            extra={'user_id': request.user.id, 's3_key': key, 'bucket': bucket}
        )
        media_type = request.data.get('media_type')
        if not media_type or media_type not in VALID_MEDIA_TYPES:
            return Response(
                {'error': f'media_type inválido. Debe ser uno de: {", ".join(VALID_MEDIA_TYPES)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        title = request.data.get('title') or key.split('/')[-1].split('_', 1)[-1]
        author = request.data.get('author')
        personal_note = request.data.get('personalNote')
        is_visible = request.data.get('is_visible')
        if isinstance(is_visible, str):
            is_visible = is_visible.lower() == 'true'
        else:
            is_visible = bool(is_visible) if is_visible is not None else True
        is_producer = request.data.get('is_producer')
        if isinstance(is_producer, str):
            is_producer = is_producer.lower() == 'true'
        else:
            is_producer = bool(is_producer) if is_producer is not None else False
        file_size = request.data.get('file_size')
        try:
            file_size = int(file_size) if file_size is not None else None
        except (TypeError, ValueError):
            file_size = None
        try:
            s3_client = boto3.client(
                's3',
                region_name=getattr(settings, 'AWS_S3_REGION_NAME', 'us-west-2'),
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
            )
            s3_client.head_object(Bucket=bucket, Key=key)
        except Exception as e:
            logger.warning(
                "S3 confirm: head_object failed (file not in S3)",
                extra={'s3_key': key, 'bucket': bucket, 'error': str(e)}
            )
            return Response(
                {'error': 'El archivo no se encontró en el almacenamiento. Sube primero con la URL de subida.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        logger.info("S3 confirm: head_object OK, creating Content/FileDetails", extra={'s3_key': key})
        content = Content.objects.create(
            uploaded_by=request.user,
            media_type=media_type,
            original_title=title,
            original_author=author
        )
        content_profile = ContentProfile.objects.create(
            content=content,
            title=title,
            author=author,
            personal_note=personal_note,
            user=request.user,
            is_visible=is_visible,
            is_producer=is_producer
        )
        file_details = FileDetails.objects.create(
            content=content,
            file_size=file_size
        )
        # Set S3 key in DB without triggering storage upload (file already in S3)
        FileDetails.objects.filter(pk=file_details.pk).update(file=key)
        # Refresh in-memory object so serialization sees the file key (Django caches reverse OneToOne)
        file_details.refresh_from_db()
        logger.info(
            "S3 confirm: success",
            extra={
                'user_id': request.user.id,
                'content_id': content.id,
                's3_key': key,
                'bucket': bucket,
            }
        )
        content_profile_serializer = ContentProfileSerializer(
            content_profile,
            context={'request': request}
        )
        return Response({
            'message': 'Content uploaded successfully',
            'content_id': content.id,
            'content_profile': content_profile_serializer.data
        }, status=status.HTTP_201_CREATED)


class UserContentListView(APIView):
    """API view to retrieve all content profiles owned by a user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_id = request.user.id
        username = request.user.username
        
        logger.info(
            "User content list request",
            extra={
                'user_id': user_id,
                'username': username,
            }
        )
        
        try:
            content_profiles = ContentProfile.objects.filter(user=request.user)\
                .select_related('content')\
                .order_by('title')
            
            logger.info(
                "Retrieved user content profiles",
                extra={
                    'user_id': user_id,
                    'username': username,
                    'profile_count': content_profiles.count(),
                }
            )
            
            # Serialize each profile individually to handle errors gracefully
            response_data = []
            skipped_profiles = 0
            for profile in content_profiles:
                try:
                    serializer = SimpleContentProfileSerializer(
                        profile, 
                        context={'request': request}
                    )
                    response_data.append(serializer.data)
                except Exception as e:
                    # Skip this profile instead of failing the entire request
                    logger.warning(
                        f"Failed to serialize content profile {profile.id}: {str(e)}",
                        extra={
                            'user_id': user_id,
                            'username': username,
                            'profile_id': profile.id,
                            'content_id': profile.content.id if profile.content else None,
                        }
                    )
                    skipped_profiles += 1
                    continue
            
            if skipped_profiles > 0:
                logger.warning(
                    f"Skipped {skipped_profiles} profiles due to serialization errors",
                    extra={
                        'user_id': user_id,
                        'username': username,
                        'skipped_count': skipped_profiles,
                        'successful_count': len(response_data),
                    }
                )
            
            return Response(response_data, status=status.HTTP_200_OK)
        except Exception as e:
            logger.error(
                f"Error fetching user content: {str(e)}",
                extra={
                    'user_id': user_id,
                    'username': username,
                },
                exc_info=True
            )
            return Response(
                {'error': 'Ocurrió un error al obtener el contenido'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserContentWithDetailsView(APIView):
    """API view to retrieve all content profiles owned by a user with file details for card mode display."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            content_profiles = ContentProfile.objects.filter(user=request.user)\
                .select_related('content', 'content__file_details')\
                .order_by('-created_at')
            
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
                {'error': 'Ocurrió un error al obtener el contenido'}, 
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
                {'error': f'Usuario con ID {user_id} no encontrado'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'error': 'Ocurrió un error al obtener el contenido'}, 
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


class CollectionDetailView(APIView):
    """Get or update a specific collection"""
    permission_classes = [IsAuthenticated]

    def get(self, request, collection_id):
        collection = get_object_or_404(
            Collection, 
            id=collection_id, 
            library__user=request.user
        )
        serializer = CollectionSerializer(collection)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, collection_id):
        collection = get_object_or_404(
            Collection, 
            id=collection_id, 
            library__user=request.user
        )
        serializer = CollectionSerializer(collection, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
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
                {'error': 'content_profile_ids debe ser un array no vacío'}, 
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
        
        # If trying to change visibility, check permission: must be producer or profile owner
        if 'is_visible' in request.data:
            is_producer = request.data.get('is_producer', False)
            is_owner = content_profile.user_id == request.user.id
            if not is_producer and not is_owner:
                return Response(
                    {'error': 'Debe reclamar ser el productor para cambiar la visibilidad'},
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
                {'error': 'content_id es requerido'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            new_content = Content.objects.get(id=new_content_id)
        except Content.DoesNotExist:
            return Response(
                {'error': 'Contenido no encontrado'}, 
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
                    {"error": "No tiene permiso para actualizar este tema."},
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
        
        # Check if user is creator or moderator
        if not topic.is_moderator_or_creator(request.user):
            return Response(
                {"error": "No tiene permiso para agregar contenido a este tema."},
                status=status.HTTP_403_FORBIDDEN
            )
        
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
                {'error': f'Error al agregar contenido: {str(e)}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

    def patch(self, request, pk):
        topic = get_object_or_404(Topic, pk=pk)
        
        # Check if user is creator or moderator
        if not topic.is_moderator_or_creator(request.user):
            return Response(
                {"error": "No tiene permiso para eliminar contenido de este tema."},
                status=status.HTTP_403_FORBIDDEN
            )
        
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
                {'error': f'Error al eliminar contenido: {str(e)}'}, 
                status=status.HTTP_400_BAD_REQUEST
            )


class TopicModeratorsView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    def post(self, request, pk):
        """Add moderators to a topic. Only the creator can add moderators."""
        topic = get_object_or_404(Topic, pk=pk)
        
        # Check if user is the creator
        if topic.creator != request.user:
            return Response(
                {"error": "Solo el creador del tema puede agregar moderadores."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        usernames = request.data.get('usernames', [])
        if not usernames:
            return Response(
                {"error": "Debe proporcionar al menos un nombre de usuario."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Get users to add as moderators by username
            users_to_add = User.objects.filter(username__in=usernames)
            
            # Check if all users exist
            found_usernames = set(users_to_add.values_list('username', flat=True))
            missing_usernames = set(usernames) - found_usernames
            if missing_usernames:
                return Response(
                    {"error": f"Los siguientes usuarios no existen: {list(missing_usernames)}"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Add users as moderators (ManyToMany add is idempotent)
            topic.moderators.add(*users_to_add)
            
            # Return updated topic with moderators
            serializer = TopicDetailSerializer(topic, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {"error": f"Error al agregar moderadores: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

    def delete(self, request, pk):
        """Remove moderators from a topic. Only the creator can remove moderators."""
        topic = get_object_or_404(Topic, pk=pk)
        
        # Check if user is the creator
        if topic.creator != request.user:
            return Response(
                {"error": "Solo el creador del tema puede eliminar moderadores."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        usernames = request.data.get('usernames', [])
        if not usernames:
            return Response(
                {"error": "Debe proporcionar al menos un nombre de usuario."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Get users to remove as moderators by username
            users_to_remove = User.objects.filter(username__in=usernames)
            
            # Verify all users exist
            found_usernames = set(users_to_remove.values_list('username', flat=True))
            missing_usernames = set(usernames) - found_usernames
            if missing_usernames:
                return Response(
                    {"error": f"Los siguientes usuarios no existen: {list(missing_usernames)}"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Store users before removal for notifications
            removed_users_list = list(users_to_remove)
            
            # Remove users from moderators
            topic.moderators.remove(*users_to_remove)
            
            # Send notifications to removed moderators
            for removed_user in removed_users_list:
                try:
                    notify_topic_moderator_removed(topic, removed_user, request.user)
                except Exception as e:
                    # Log error but don't fail the request
                    logger.error(f"Error sending moderator removed notification: {str(e)}", extra={
                        'topic_id': topic.id,
                        'removed_user_id': removed_user.id,
                        'removed_by_id': request.user.id,
                    }, exc_info=True)
            
            # Return updated topic with moderators
            serializer = TopicDetailSerializer(topic, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response(
                {"error": f"Error al eliminar moderadores: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )


class TopicModeratorInviteView(APIView):
    """Create a moderator invitation for a topic. Only the creator can send invitations."""
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    def post(self, request, pk):
        topic = get_object_or_404(Topic, pk=pk)
        
        # Check if user is the creator
        if topic.creator != request.user:
            return Response(
                {"error": "Solo el creador del tema puede enviar invitaciones."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        username = request.data.get('username')
        message = request.data.get('message', '')
        
        if not username:
            return Response(
                {"error": "Debe proporcionar un nombre de usuario."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Get user to invite
            invited_user = User.objects.get(username=username)
            
            # Check if user is already a moderator
            if invited_user in topic.moderators.all():
                return Response(
                    {"error": f"El usuario {username} ya es moderador de este tema."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if there's already a pending invitation
            existing_invitation = TopicModeratorInvitation.objects.filter(
                topic=topic,
                invited_user=invited_user,
                status='PENDING'
            ).first()
            
            if existing_invitation:
                return Response(
                    {"error": f"Ya existe una invitación pendiente para {username}."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check if there's an existing invitation (regardless of status) - update it to PENDING
            existing_invitation = TopicModeratorInvitation.objects.filter(
                topic=topic,
                invited_user=invited_user
            ).first()
            
            if existing_invitation:
                # Update existing invitation to PENDING
                existing_invitation.status = 'PENDING'
                existing_invitation.invited_by = request.user
                existing_invitation.message = message
                existing_invitation.save()
                invitation = existing_invitation
            else:
                # Create new invitation
                invitation = TopicModeratorInvitation.objects.create(
                    topic=topic,
                    invited_user=invited_user,
                    invited_by=request.user,
                    message=message,
                    status='PENDING'
                )
            
            # Send notification to invited user
            try:
                notify_topic_moderator_invitation(invitation)
            except Exception as e:
                # Log error but don't fail the request
                logger.error(f"Error sending moderator invitation notification: {str(e)}", extra={
                    'invitation_id': invitation.id,
                    'topic_id': topic.id,
                })
            
            serializer = TopicModeratorInvitationSerializer(invitation, context={'request': request})
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except User.DoesNotExist:
            return Response(
                {"error": f"El usuario {username} no existe."},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {"error": f"Error al crear la invitación: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )


class TopicModeratorInvitationsView(APIView):
    """List invitations for a topic. Creator can see all, invited users can see their own."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, pk):
        topic = get_object_or_404(Topic, pk=pk)
        
        # Creator can see all invitations, invited users can see their own
        if topic.creator == request.user:
            invitations = TopicModeratorInvitation.objects.filter(topic=topic).order_by('-created_at')
        else:
            invitations = TopicModeratorInvitation.objects.filter(
                topic=topic,
                invited_user=request.user
            ).order_by('-created_at')
        
        serializer = TopicModeratorInvitationSerializer(invitations, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class TopicModeratorAcceptView(APIView):
    """Accept a moderator invitation. Only the invited user can accept."""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk, invitation_id):
        topic = get_object_or_404(Topic, pk=pk)
        invitation = get_object_or_404(TopicModeratorInvitation, pk=invitation_id, topic=topic)
        
        # Check if user is the invited user
        if invitation.invited_user != request.user:
            return Response(
                {"error": "Solo el usuario invitado puede aceptar la invitación."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if invitation is pending
        if invitation.status != 'PENDING':
            return Response(
                {"error": "Esta invitación ya no está pendiente."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Accept the invitation
            invitation.accept()
            
            # Send notification to topic creator
            try:
                notify_topic_moderator_invitation_accepted(invitation)
            except Exception as e:
                # Log error but don't fail the request
                logger.error(f"Error sending moderator invitation accepted notification: {str(e)}", extra={
                    'invitation_id': invitation.id,
                    'topic_id': topic.id,
                })
            
            serializer = TopicModeratorInvitationSerializer(invitation, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {"error": f"Error al aceptar la invitación: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )


class TopicModeratorDeclineView(APIView):
    """Decline a moderator invitation. Only the invited user can decline."""
    permission_classes = [IsAuthenticated]
    
    def post(self, request, pk, invitation_id):
        topic = get_object_or_404(Topic, pk=pk)
        invitation = get_object_or_404(TopicModeratorInvitation, pk=invitation_id, topic=topic)
        
        # Check if user is the invited user
        if invitation.invited_user != request.user:
            return Response(
                {"error": "Solo el usuario invitado puede rechazar la invitación."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if invitation is pending
        if invitation.status != 'PENDING':
            return Response(
                {"error": "Esta invitación ya no está pendiente."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Decline the invitation
            invitation.decline()
            
            # Send notification to topic creator
            try:
                notify_topic_moderator_invitation_declined(invitation)
            except Exception as e:
                # Log error but don't fail the request
                logger.error(f"Error sending moderator invitation declined notification: {str(e)}", extra={
                    'invitation_id': invitation.id,
                    'topic_id': topic.id,
                })
            
            serializer = TopicModeratorInvitationSerializer(invitation, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except ValueError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {"error": f"Error al rechazar la invitación: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )


class UserTopicsView(APIView):
    """Get topics where user is creator or moderator."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        topic_type = request.query_params.get('type', None)  # 'created' or 'moderated'
        
        if topic_type == 'created':
            topics = Topic.objects.filter(creator=request.user).order_by('-created_at')
        elif topic_type == 'moderated':
            topics = request.user.moderated_topics.all().order_by('-created_at')
        else:
            # Return both created and moderated (combined, distinct)
            topics = Topic.objects.filter(
                Q(creator=request.user) | Q(moderators=request.user)
            ).distinct().order_by('-created_at')
        
        serializer = TopicBasicSerializer(topics, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class UserTopicInvitationsView(APIView):
    """Get all pending moderator invitations for the authenticated user."""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        status_filter = request.query_params.get('status', 'PENDING')
        
        invitations = TopicModeratorInvitation.objects.filter(
            invited_user=request.user,
            status=status_filter
        ).order_by('-created_at')
        
        serializer = TopicModeratorInvitationSerializer(invitations, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


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
                {'error': 'Publicación no encontrada'},
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
                {'error': 'Contenido no encontrado'}, 
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
                    {"error": "Perfil de contenido no encontrado"}, 
                    status=status.HTTP_404_NOT_FOUND
                )


class ContentProfileCreateView(APIView):
    """API view to create a new content profile for a user."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user_id = request.user.id
        username = request.user.username
        
        logger.info(
            "Content profile creation request",
            extra={
                'user_id': user_id,
                'username': username,
                'content_id': request.data.get('content'),
            }
        )
        
        try:     # Validate required fields
            content_id = request.data.get('content')
            if not content_id:
                logger.warning(
                    "Content profile creation failed: no content ID",
                    extra={
                        'user_id': user_id,
                        'username': username,
                    }
                )
                return Response(
                    {'error': 'ID de contenido es requerido'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Check if content exists
            try:
                content = Content.objects.get(id=content_id)
            except Content.DoesNotExist:
                logger.warning(
                    "Content profile creation failed: content not found",
                    extra={
                        'user_id': user_id,
                        'username': username,
                        'content_id': content_id,
                    }
                )
                return Response(
                    {'error': f'Contenido con ID {content_id} no encontrado'}, 
                    status=status.HTTP_404_NOT_FOUND
                )

            # Check if user already has a profile for this content
            existing_profile = ContentProfile.objects.filter(
                content=content,
                user=request.user
            ).first()

            if existing_profile:
                logger.warning(
                    "Content profile creation failed: profile already exists",
                    extra={
                        'user_id': user_id,
                        'username': username,
                        'content_id': content_id,
                        'existing_profile_id': existing_profile.id,
                    }
                )
                return Response(
                    {'error': 'Ya tiene un perfil para este contenido'}, 
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
                
                logger.info(
                    "Content profile created successfully",
                    extra={
                        'user_id': user_id,
                        'username': username,
                        'content_id': content_id,
                        'profile_id': content_profile.id,
                        'title': title,
                        'is_visible': is_visible,
                        'is_producer': is_producer,
                    }
                )
                
            except Exception as e:
                logger.error(
                    f"Failed to create content profile: {str(e)}",
                    extra={
                        'user_id': user_id,
                        'username': username,
                        'content_id': content_id,
                    },
                    exc_info=True
                )
                return Response(
                    {
                        'error': 'Error al crear el perfil de contenido',
                        'details': 'Ocurrió un error en la base de datos al crear el perfil'
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
                logger.error(
                    f"Failed to serialize content profile: {str(e)}",
                    extra={
                        'user_id': user_id,
                        'username': username,
                        'content_id': content_id,
                        'profile_id': content_profile.id,
                    },
                    exc_info=True
                )
                return Response(
                    {
                        'error': 'Error al serializar el perfil de contenido',
                        'details': 'Ocurrió un error al preparar la respuesta'
                    }, 
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

        except Exception as e:
            logger.error(
                f"Content profile creation unexpected error: {str(e)}",
                extra={
                    'user_id': user_id,
                    'username': username,
                    'content_id': request.data.get('content'),
                },
                exc_info=True
            )
            return Response(
                {
                    'error': 'Ocurrió un error inesperado',
                    'details': 'Por favor, revise los registros del servidor para más información'
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
        user_id = request.user.id
        username = request.user.username
        url = request.data.get('url')
        
        logger.info(
            "URL preview request",
            extra={
                'user_id': user_id,
                'username': username,
                'url': url,
                'is_youtube': 'youtube.com' in url or 'youtu.be' in url if url else False,
            }
        )
        
        if not url:
            logger.warning(
                "URL preview failed: no URL provided",
                extra={
                    'user_id': user_id,
                    'username': username,
                }
            )
            return Response(
                {'error': 'URL es requerida'}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            # Check if it's a YouTube URL first
            if 'youtube.com' in url or 'youtu.be' in url:
                logger.info(
                    "Processing YouTube URL",
                    extra={
                        'user_id': user_id,
                        'username': username,
                        'url': url,
                    }
                )
                youtube_data = self.extract_youtube_data(url)
                if youtube_data:
                    logger.info(
                        "YouTube data extracted successfully",
                        extra={
                            'user_id': user_id,
                            'username': username,
                            'url': url,
                            'title': youtube_data.get('title'),
                        }
                    )
                    return Response(youtube_data)
                else:
                    logger.warning(
                        "Failed to extract YouTube data",
                        extra={
                            'user_id': user_id,
                            'username': username,
                            'url': url,
                        }
                    )

            # Make request with browser-like headers
            logger.info(
                "Fetching URL content",
                extra={
                    'user_id': user_id,
                    'username': username,
                    'url': url,
                }
            )
            
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
            }
            
            try:
                response = requests.get(url, headers=headers, timeout=5, verify=True)
            except requests.exceptions.Timeout:
                logger.error(
                    "URL preview timeout",
                    extra={
                        'user_id': user_id,
                        'username': username,
                        'url': url,
                    }
                )
                return Response(
                    {'error': 'Tiempo de espera agotado'}, 
                    status=status.HTTP_408_REQUEST_TIMEOUT
                )
            except requests.exceptions.RequestException as e:
                logger.error(
                    f"URL preview request failed: {str(e)}",
                    extra={
                        'user_id': user_id,
                        'username': username,
                        'url': url,
                    },
                    exc_info=True
                )
                return Response(
                    {'error': 'No se puede acceder a esta URL'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )

            if response.status_code == 403:
                logger.warning(
                    "URL preview access denied (403)",
                    extra={
                        'user_id': user_id,
                        'username': username,
                        'url': url,
                        'status_code': response.status_code,
                    }
                )
                return Response(
                    {'error': 'No se puede acceder a esta URL'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            try:
                response.raise_for_status()
            except requests.exceptions.HTTPError as e:
                logger.error(
                    f"URL preview HTTP error: {str(e)}",
                    extra={
                        'user_id': user_id,
                        'username': username,
                        'url': url,
                        'status_code': response.status_code,
                    }
                )
                return Response(
                    {'error': 'No se puede acceder a esta URL'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check content type
            content_type = response.headers.get('content-type', '').lower()
            
            if not content_type.startswith('text/html'):
                logger.warning(
                    "URL preview failed: not HTML content",
                    extra={
                        'user_id': user_id,
                        'username': username,
                        'url': url,
                        'content_type': content_type,
                    }
                )
                return Response({
                    'error': 'La URL debe apuntar a una página web'
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
                logger.warning(
                    "URL preview failed: no metadata extracted",
                    extra={
                        'user_id': user_id,
                        'username': username,
                        'url': url,
                        'metadata_keys': list(metadata.keys()),
                    }
                )
                return Response(
                    {'error': 'No se pudo extraer información de vista previa de esta URL'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            logger.info(
                "URL preview successful",
                extra={
                    'user_id': user_id,
                    'username': username,
                    'url': url,
                    'title': metadata.get('title'),
                    'has_description': bool(metadata.get('description')),
                    'has_image': bool(metadata.get('image')),
                    'has_favicon': bool(metadata.get('favicon')),
                }
            )
            
            return Response(metadata)
            
        except requests.Timeout:
            logger.error(
                "URL preview timeout",
                extra={
                    'user_id': user_id,
                    'username': username,
                    'url': url,
                }
            )
            return Response(
                {'error': 'Error al obtener datos de la URL'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except requests.RequestException as e:
            logger.error(
                f"URL preview request exception: {str(e)}",
                extra={
                    'user_id': user_id,
                    'username': username,
                    'url': url,
                },
                exc_info=True
            )
            return Response(
                {'error': 'Error al obtener datos de la URL'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(
                f"URL preview unexpected error: {str(e)}",
                extra={
                    'user_id': user_id,
                    'username': username,
                    'url': url,
                },
                exc_info=True
            )
            return Response(
                {'error': 'Error al obtener datos de la URL'}, 
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
                    f"No se puede cambiar la fuente de este contenido porque {other_users_count} otro(s) usuario(s) lo han agregado a sus bibliotecas"
                    if not can_modify and other_users_count > 0
                    else "El contenido puede ser modificado"
                )
            })
            
        except Content.DoesNotExist:
            return Response(
                {'error': 'Contenido no encontrado'}, 
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
            logger.info("ContentUpdateView PUT request", extra={
                'content_id': pk,
                'user_id': request.user.id,
                'request_data_keys': list(request.data.keys()) if request.data else [],
            })
            
            content = get_object_or_404(Content, pk=pk)
            logger.debug("Found content for update", extra={
                'content_id': content.id,
                'current_url': content.url,
                'current_media_type': content.media_type,
                'current_title': content.original_title,
                'current_author': content.original_author,
            })
            
            # Check if the user has a profile for this content (i.e., owns it)
            try:
                content_profile = ContentProfile.objects.get(content=content, user=request.user)
                logger.debug("Found content profile for user", extra={
                    'content_profile_id': content_profile.id,
                    'user_id': request.user.id,
                })
            except ContentProfile.DoesNotExist:
                logger.warning("Content profile not found for user", extra={
                    'content_id': pk,
                    'user_id': request.user.id,
                })
                return Response(
                    {'error': 'No tiene permiso para editar este contenido'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Validate media_type if provided
            if 'media_type' in request.data:
                logger.debug("Validating media type", extra={
                    'media_type': request.data['media_type'],
                })
                valid_media_types = ['VIDEO', 'AUDIO', 'TEXT', 'IMAGE']
                if request.data['media_type'] not in valid_media_types:
                    logger.warning("Invalid media type provided", extra={
                        'media_type': request.data['media_type'],
                        'valid_types': valid_media_types,
                    })
                    return Response(
                        {'error': f'Invalid media type. Must be one of: {", ".join(valid_media_types)}'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Validate URL if provided
            if 'url' in request.data and request.data['url']:
                logger.debug("Validating URL", extra={
                    'url': request.data['url'],
                })
                validator = URLValidator()
                try:
                    validator(request.data['url'])
                    logger.debug("URL validation passed")
                except ValidationError:
                    logger.warning("URL validation failed", extra={
                        'url': request.data['url'],
                    })
                    return Response(
                        {'error': 'Formato de URL inválido'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
            
            # Update the content
            logger.debug("Updating content", extra={
                'content_id': pk,
                'update_data': request.data,
            })
            serializer = ContentSerializer(content, data=request.data, partial=True)
            if serializer.is_valid():
                logger.debug("Content serializer is valid", extra={
                    'validated_data': serializer.validated_data,
                })
                updated_content = serializer.save()
                logger.info("Content updated successfully", extra={
                    'content_id': updated_content.id,
                    'updated_url': updated_content.url,
                    'updated_media_type': updated_content.media_type,
                    'updated_title': updated_content.original_title,
                    'updated_author': updated_content.original_author,
                })
                return Response(serializer.data)
            else:
                logger.warning("Content serializer validation failed", extra={
                    'content_id': pk,
                    'serializer_errors': serializer.errors,
                })
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
            
        except Content.DoesNotExist:
            logger.warning("Content not found for update", extra={
                'content_id': pk,
                'user_id': request.user.id,
            })
            return Response(
                {'error': 'Contenido no encontrado'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error("Unexpected error in content update", extra={
                'content_id': pk,
                'user_id': request.user.id,
                'error': str(e),
            }, exc_info=True)
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class TopicContentSuggestionCreateView(APIView):
    """Create a content suggestion for a topic."""
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    def post(self, request, pk):
        topic = get_object_or_404(Topic, pk=pk)
        
        content_id = request.data.get('content_id')
        message = request.data.get('message', '')
        
        if not content_id:
            return Response(
                {"error": "Debe proporcionar un ID de contenido."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            content = Content.objects.get(pk=content_id)
        except Content.DoesNotExist:
            return Response(
                {"error": "El contenido especificado no existe."},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Check if suggestion already exists
        existing_suggestion = ContentSuggestion.objects.filter(
            topic=topic,
            content=content,
            suggested_by=request.user
        ).first()
        
        if existing_suggestion:
            return Response(
                {"error": "Ya has sugerido este contenido para este tema."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if content is already in the topic
        is_duplicate = content in topic.contents.all()
        
        # Create the suggestion
        suggestion = ContentSuggestion.objects.create(
            topic=topic,
            content=content,
            suggested_by=request.user,
            message=message,
            is_duplicate=is_duplicate,
            status='PENDING'
        )
        
        # Send notifications to moderators
        try:
            from utils.notification_utils import notify_content_suggestion_created
            notify_content_suggestion_created(suggestion)
        except Exception as e:
            logger.error(f"Error sending content suggestion notification: {str(e)}", extra={
                'suggestion_id': suggestion.id,
                'topic_id': topic.id,
            }, exc_info=True)
        
        serializer = ContentSuggestionSerializer(suggestion, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class TopicContentSuggestionsView(APIView):
    """List content suggestions for a topic. All authenticated users can see all suggestions."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        topic = get_object_or_404(Topic, pk=pk)
        
        # Get filter parameters
        status_filter = request.query_params.get('status', None)
        is_duplicate_filter = request.query_params.get('is_duplicate', None)
        
        # All authenticated users can see all suggestions
        suggestions = ContentSuggestion.objects.filter(topic=topic)
        
        # Apply filters
        if status_filter:
            suggestions = suggestions.filter(status=status_filter)
        
        if is_duplicate_filter is not None:
            is_duplicate_bool = is_duplicate_filter.lower() == 'true'
            suggestions = suggestions.filter(is_duplicate=is_duplicate_bool)
        
        # Annotate with vote counts for ordering
        # Votes for suggestions are not topic-specific (topic=None)
        content_type = ContentType.objects.get_for_model(ContentSuggestion)
        vote_count_subquery = models.Subquery(
            VoteCount.objects.filter(
                content_type=content_type,
                object_id=models.OuterRef('id'),
                topic__isnull=True
            ).values('vote_count')[:1]
        )
        suggestions = suggestions.annotate(
            vote_count_value=Coalesce(vote_count_subquery, 0)
        )
        
        # Order by vote count descending, then by created_at descending
        suggestions = suggestions.order_by('-vote_count_value', '-created_at')
        
        serializer = ContentSuggestionSerializer(suggestions, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class TopicContentSuggestionAcceptView(APIView):
    """Accept a content suggestion. Only moderators/creators can accept."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, suggestion_id):
        topic = get_object_or_404(Topic, pk=pk)
        suggestion = get_object_or_404(ContentSuggestion, pk=suggestion_id, topic=topic)
        
        # Check if user is moderator or creator
        if not topic.is_moderator_or_creator(request.user):
            return Response(
                {"error": "Solo los moderadores y el creador del tema pueden aceptar sugerencias."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if suggestion is pending
        if suggestion.status != 'PENDING':
            return Response(
                {"error": "Esta sugerencia ya no está pendiente."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Update suggestion
            suggestion.status = 'ACCEPTED'
            suggestion.reviewed_by = request.user
            suggestion.reviewed_at = timezone.now()
            suggestion.save()
            
            # Add content to topic if not duplicate
            if not suggestion.is_duplicate:
                topic.contents.add(suggestion.content)
            
            # Send notification to suggester
            try:
                from utils.notification_utils import notify_content_suggestion_accepted
                notify_content_suggestion_accepted(suggestion)
            except Exception as e:
                logger.error(f"Error sending content suggestion accepted notification: {str(e)}", extra={
                    'suggestion_id': suggestion.id,
                    'topic_id': topic.id,
                }, exc_info=True)
            
            serializer = ContentSuggestionSerializer(suggestion, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error accepting content suggestion: {str(e)}", extra={
                'suggestion_id': suggestion.id,
                'topic_id': topic.id,
            }, exc_info=True)
            return Response(
                {"error": f"Error al aceptar la sugerencia: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )


class TopicContentSuggestionRejectView(APIView):
    """Reject a content suggestion. Only moderators/creators can reject."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, suggestion_id):
        topic = get_object_or_404(Topic, pk=pk)
        suggestion = get_object_or_404(ContentSuggestion, pk=suggestion_id, topic=topic)
        
        # Check if user is moderator or creator
        if not topic.is_moderator_or_creator(request.user):
            return Response(
                {"error": "Solo los moderadores y el creador del tema pueden rechazar sugerencias."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if suggestion is pending
        if suggestion.status != 'PENDING':
            return Response(
                {"error": "Esta sugerencia ya no está pendiente."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Require rejection reason
        rejection_reason = request.data.get('rejection_reason', '')
        if not rejection_reason or not rejection_reason.strip():
            return Response(
                {"error": "Debe proporcionar una razón para rechazar la sugerencia."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Update suggestion
            suggestion.status = 'REJECTED'
            suggestion.reviewed_by = request.user
            suggestion.reviewed_at = timezone.now()
            suggestion.rejection_reason = rejection_reason
            suggestion.save()
            
            # Send notification to suggester
            try:
                from utils.notification_utils import notify_content_suggestion_rejected
                notify_content_suggestion_rejected(suggestion)
            except Exception as e:
                logger.error(f"Error sending content suggestion rejected notification: {str(e)}", extra={
                    'suggestion_id': suggestion.id,
                    'topic_id': topic.id,
                }, exc_info=True)
            
            serializer = ContentSuggestionSerializer(suggestion, context={'request': request})
            return Response(serializer.data, status=status.HTTP_200_OK)
            
        except Exception as e:
            logger.error(f"Error rejecting content suggestion: {str(e)}", extra={
                'suggestion_id': suggestion.id,
                'topic_id': topic.id,
            }, exc_info=True)
            return Response(
                {"error": f"Error al rechazar la sugerencia: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )


class UserContentSuggestionsView(APIView):
    """Get all content suggestions made by the authenticated user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Get filter parameters
        status_filter = request.query_params.get('status', None)
        topic_id = request.query_params.get('topic_id', None)
        
        # Build query
        suggestions = ContentSuggestion.objects.filter(suggested_by=request.user)
        
        # Apply filters
        if status_filter:
            suggestions = suggestions.filter(status=status_filter)
        
        if topic_id:
            try:
                suggestions = suggestions.filter(topic_id=topic_id)
            except ValueError:
                pass  # Invalid topic_id, ignore filter
        
        # Order by created_at (most recent first)
        suggestions = suggestions.order_by('-created_at')
        
        serializer = ContentSuggestionSerializer(suggestions, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class TopicContentSuggestionDeleteView(APIView):
    """Delete a content suggestion. Only the user who created it can delete it."""
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk, suggestion_id):
        topic = get_object_or_404(Topic, pk=pk)
        suggestion = get_object_or_404(ContentSuggestion, pk=suggestion_id, topic=topic)
        
        # Only the user who created the suggestion can delete it
        if suggestion.suggested_by != request.user:
            return Response(
                {"error": "No tienes permiso para eliminar esta sugerencia."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        suggestion.delete()
        return Response(
            {"message": "Sugerencia eliminada exitosamente."},
            status=status.HTTP_200_OK
        )
