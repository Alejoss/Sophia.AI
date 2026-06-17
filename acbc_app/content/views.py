from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from rest_framework import status
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import IsAuthenticated, AllowAny
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
from django.db import models, IntegrityError, transaction
from django.db.models import Q, OuterRef, Subquery, Count
from django.db.models.functions import Coalesce
from django.utils import timezone
import logging

from utils.permissions import IsAuthor
from utils.notification_utils import (
    notify_topic_moderator_invitation,
    notify_topic_moderator_invitation_accepted,
    notify_topic_moderator_invitation_declined,
    notify_topic_moderator_removed,
)
from content.models import (
    Library,
    Collection,
    Content,
    Topic,
    TopicTimeline,
    TopicTimelineEntry,
    ContentProfile,
    FileDetails,
    Publication,
    TopicModeratorInvitation,
    ContentSuggestion,
    FileSuggestion,
)
from knowledge_paths.models import KnowledgePath, Node
from votes.models import VoteCount
from content.serializers import (
    LibrarySerializer,
    CollectionSerializer,
    PublicCollectionSummarySerializer,
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
    ContentSuggestionSerializer,
    FileSuggestionSerializer,
    TopicTimelineSerializer,
    TopicTimelineEntrySerializer,
)
from knowledge_paths.serializers import (
    KnowledgePathSerializer,
    NodeSerializer
)
from .serializers import PublicationSerializer
from content.utils import get_top_voted_contents, get_topic_contents_ordered_for_public_view
from content.image_utils import generate_topic_thumbnail, delete_topic_thumbnail
from content.s3_key_utils import is_unsafe_s3_key, sanitize_filename_for_s3_key
from bs4 import BeautifulSoup
import requests
import re
from urllib.parse import urlparse, urljoin, parse_qs, urlencode, urlunparse
from math import ceil
from django.core.validators import URLValidator
from django.core.exceptions import ValidationError
from utils.logging_utils import log_error
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
            context_id_int = int(context_id)
        except (TypeError, ValueError):
            return None

        try:
            # Try to get profile based on context
            if context == 'topic':
                topic = Topic.objects.get(id=context_id_int)
                return ContentProfile.objects.get(content=content, user=topic.creator)
            
            elif context == 'library':
                # Prevent profile data leaks across users in library context.
                if context_id_int != request.user.id and not request.user.is_staff:
                    return None
                library_owner = User.objects.get(id=context_id_int)
                return ContentProfile.objects.get(content=content, user=library_owner)
            
            elif context == 'publication':
                publication = Publication.objects.get(id=context_id_int)
                return ContentProfile.objects.get(content=content, user=publication.user)
            
            elif context == 'knowledge_path':
                path = KnowledgePath.objects.get(id=context_id_int)
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
                        {'error': 'Formato de URL invalido'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # For URL content, get media_type from request data or default to TEXT
                media_type = request.data.get('media_type', 'TEXT')
                
                # Validate media_type
                valid_media_types = ['VIDEO', 'AUDIO', 'TEXT', 'IMAGE']
                if media_type not in valid_media_types:
                    return Response(
                        {'error': f'Tipo de medio invalido. Debe ser uno de: {", ".join(valid_media_types)}'}, 
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                title = request.data.get('title', normalized_url)
                
                has_spanish_subtitles = request.data.get('has_spanish_subtitles')
                if isinstance(has_spanish_subtitles, str):
                    has_spanish_subtitles = has_spanish_subtitles.lower() == 'true'
                else:
                    has_spanish_subtitles = bool(has_spanish_subtitles)

                has_spanish_dubbing = request.data.get('has_spanish_dubbing')
                if isinstance(has_spanish_dubbing, str):
                    has_spanish_dubbing = has_spanish_dubbing.lower() == 'true'
                else:
                    has_spanish_dubbing = bool(has_spanish_dubbing)

                content = Content.objects.create(
                    uploaded_by=request.user,
                    media_type=media_type,
                    original_title=title,
                    original_author=request.data.get('author'),
                    url=normalized_url,  # Store the normalized URL
                    has_spanish_subtitles=has_spanish_subtitles,
                    has_spanish_dubbing=has_spanish_dubbing
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

                has_spanish_subtitles = request.data.get('has_spanish_subtitles')
                if isinstance(has_spanish_subtitles, str):
                    has_spanish_subtitles = has_spanish_subtitles.lower() == 'true'
                else:
                    has_spanish_subtitles = bool(has_spanish_subtitles)

                has_spanish_dubbing = request.data.get('has_spanish_dubbing')
                if isinstance(has_spanish_dubbing, str):
                    has_spanish_dubbing = has_spanish_dubbing.lower() == 'true'
                else:
                    has_spanish_dubbing = bool(has_spanish_dubbing)

                content = Content.objects.create(
                    uploaded_by=request.user,
                    media_type=media_type,
                    original_title=title,
                    original_author=request.data.get('author'),
                    has_spanish_subtitles=has_spanish_subtitles,
                    has_spanish_dubbing=has_spanish_dubbing
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


# S3 limits: single PUT up to 5 GB, multipart up to 5 TB.
S3_SINGLE_PUT_MAX_SIZE = 5 * 1024 * 1024 * 1024
UPLOAD_CONTENT_MAX_SIZE = 5 * 1024 * 1024 * 1024 * 1024
S3_MULTIPART_MIN_PART_SIZE = 5 * 1024 * 1024
S3_MULTIPART_DEFAULT_PART_SIZE = 64 * 1024 * 1024
S3_MULTIPART_MAX_PARTS = 10000
VALID_MEDIA_TYPES = ['VIDEO', 'AUDIO', 'TEXT', 'IMAGE']


def _compute_multipart_part_size(file_size):
    dynamic_part_size = ceil(file_size / S3_MULTIPART_MAX_PARTS)
    return max(S3_MULTIPART_MIN_PART_SIZE, S3_MULTIPART_DEFAULT_PART_SIZE, dynamic_part_size)


def _build_s3_upload_plan(s3_client, bucket, key, content_type, file_size, expires_in):
    if file_size <= S3_SINGLE_PUT_MAX_SIZE:
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
        return {
            'upload_mode': 'single',
            'upload_url': upload_url,
            'key': key,
            'expires_in': expires_in,
        }

    part_size = _compute_multipart_part_size(file_size)
    total_parts = ceil(file_size / part_size)
    multipart_resp = s3_client.create_multipart_upload(
        Bucket=bucket,
        Key=key,
        ACL='public-read',
        ContentType=content_type,
    )
    upload_id = multipart_resp['UploadId']
    part_urls = []
    for part_number in range(1, total_parts + 1):
        part_url = s3_client.generate_presigned_url(
            'upload_part',
            Params={
                'Bucket': bucket,
                'Key': key,
                'UploadId': upload_id,
                'PartNumber': part_number,
            },
            ExpiresIn=expires_in
        )
        part_urls.append({'part_number': part_number, 'upload_url': part_url})

    return {
        'upload_mode': 'multipart',
        'key': key,
        'upload_id': upload_id,
        'part_size': part_size,
        'total_parts': total_parts,
        'part_urls': part_urls,
        'expires_in': expires_in,
    }


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
                {'error': 'S3 no esta configurado para subida directa'},
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
                {'error': f'media_type invalido. Debe ser uno de: {", ".join(VALID_MEDIA_TYPES)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            file_size = int(file_size)
        except (TypeError, ValueError):
            return Response({'error': 'file_size debe ser un numero'}, status=status.HTTP_400_BAD_REQUEST)
        if file_size <= 0 or file_size > UPLOAD_CONTENT_MAX_SIZE:
            return Response(
                {'error': 'El tamano del archivo debe estar entre 1 byte y 5 TB'},
                status=status.HTTP_400_BAD_REQUEST
            )
        # Sanitize filename for key (keep extension). Structure: content/{media_type}/{user_id}/{uuid}_{name}
        safe_name = sanitize_filename_for_s3_key(filename)
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
            upload_plan = _build_s3_upload_plan(
                s3_client=s3_client,
                bucket=bucket,
                key=key,
                content_type=content_type,
                file_size=file_size,
                expires_in=expires_in
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
        return Response(upload_plan, status=status.HTTP_200_OK)


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
                {'error': 'S3 no esta configurado'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        key = request.data.get('key')
        upload_id = request.data.get('upload_id')
        multipart_parts = request.data.get('parts')
        if not key or not isinstance(key, str) or not key.strip():
            return Response({'error': 'Se requiere key'}, status=status.HTTP_400_BAD_REQUEST)
        key = key.strip()
        if is_unsafe_s3_key(key):
            return Response({'error': 'key invalido'}, status=status.HTTP_400_BAD_REQUEST)
        bucket = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', 'academiablockchain')
        logger.info(
            "S3 confirm: checking object in S3",
            extra={'user_id': request.user.id, 's3_key': key, 'bucket': bucket}
        )
        media_type = request.data.get('media_type')
        if not media_type or media_type not in VALID_MEDIA_TYPES:
            return Response(
                {'error': f'media_type invalido. Debe ser uno de: {", ".join(VALID_MEDIA_TYPES)}'},
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
        has_spanish_subtitles = request.data.get('has_spanish_subtitles')
        if isinstance(has_spanish_subtitles, str):
            has_spanish_subtitles = has_spanish_subtitles.lower() == 'true'
        else:
            has_spanish_subtitles = bool(has_spanish_subtitles) if has_spanish_subtitles is not None else False
        has_spanish_dubbing = request.data.get('has_spanish_dubbing')
        if isinstance(has_spanish_dubbing, str):
            has_spanish_dubbing = has_spanish_dubbing.lower() == 'true'
        else:
            has_spanish_dubbing = bool(has_spanish_dubbing) if has_spanish_dubbing is not None else False
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
            if upload_id:
                if not isinstance(upload_id, str) or not upload_id.strip():
                    return Response({'error': 'upload_id invalido'}, status=status.HTTP_400_BAD_REQUEST)
                if not isinstance(multipart_parts, list) or not multipart_parts:
                    return Response({'error': 'Se requieren parts para completar multipart upload'}, status=status.HTTP_400_BAD_REQUEST)
                normalized_parts = []
                for part in multipart_parts:
                    if not isinstance(part, dict):
                        return Response({'error': 'parts invalido'}, status=status.HTTP_400_BAD_REQUEST)
                    etag = part.get('etag')
                    part_number = part.get('part_number')
                    if etag is None or part_number is None:
                        return Response({'error': 'Cada part requiere etag y part_number'}, status=status.HTTP_400_BAD_REQUEST)
                    try:
                        part_number = int(part_number)
                    except (TypeError, ValueError):
                        return Response({'error': 'part_number invalido'}, status=status.HTTP_400_BAD_REQUEST)
                    normalized_parts.append({'ETag': str(etag), 'PartNumber': part_number})
                normalized_parts.sort(key=lambda p: p['PartNumber'])
                s3_client.complete_multipart_upload(
                    Bucket=bucket,
                    Key=key,
                    UploadId=upload_id.strip(),
                    MultipartUpload={'Parts': normalized_parts}
                )
            s3_client.head_object(Bucket=bucket, Key=key)
        except Exception as e:
            logger.warning(
                "S3 confirm: head_object failed (file not in S3)",
                extra={'s3_key': key, 'bucket': bucket, 'error': str(e)}
            )
            return Response(
                {'error': 'El archivo no se encontro en el almacenamiento. Sube primero con la URL de subida.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        logger.info("S3 confirm: head_object OK, creating Content/FileDetails", extra={'s3_key': key})
        content = Content.objects.create(
            uploaded_by=request.user,
            media_type=media_type,
            original_title=title,
            original_author=author,
            has_spanish_subtitles=has_spanish_subtitles,
            has_spanish_dubbing=has_spanish_dubbing
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
                {'error': 'Ocurrio un error al obtener el contenido'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserLibraryPagination(PageNumberPagination):
    """Paginated user library list (aligned with search API shape for the frontend)."""
    page_size = 12
    page_size_query_param = 'page_size'
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response({
            'count': self.page.paginator.count,
            'current_page': self.page.number,
            'total_pages': self.page.paginator.num_pages,
            'results': data,
        })


class TopicContentMediaTypePagination(PageNumberPagination):
    """Pagination for topic media-type listings (used by carousel lazy loading)."""
    page_size = 12
    page_size_query_param = 'page_size'
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response({
            'count': self.page.paginator.count,
            'current_page': self.page.number,
            'total_pages': self.page.paginator.num_pages,
            'has_next': self.page.has_next(),
            'has_previous': self.page.has_previous(),
            # Keep both keys for compatibility with existing frontend consumers.
            'results': data,
            'contents': data,
        })


class UserContentWithDetailsView(APIView):
    """Paginated list of the current user's content profiles with file details for library display."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_id = request.user.id
        username = request.user.username
        try:
            queryset = ContentProfile.objects.filter(user=request.user).select_related(
                'content', 'content__file_details'
            ).order_by('-created_at')

            media_type = (request.query_params.get('media_type') or 'ALL').upper()
            if media_type != 'ALL':
                queryset = queryset.filter(content__media_type=media_type)

            search = (request.query_params.get('search') or '').strip()
            if search:
                queryset = queryset.filter(
                    Q(title__icontains=search)
                    | Q(author__icontains=search)
                    | Q(personal_note__icontains=search)
                    | Q(content__original_title__icontains=search)
                    | Q(content__media_type__icontains=search)
                )

            paginator = UserLibraryPagination()
            page = paginator.paginate_queryset(queryset, request)

            response_data = []
            for profile in page:
                try:
                    serializer = ContentProfileSerializer(
                        profile,
                        context={'request': request},
                    )
                    response_data.append(serializer.data)
                except Exception as e:
                    logger.warning(
                        "Failed to serialize content profile (card mode)",
                        extra={
                            'user_id': user_id,
                            'username': username,
                            'profile_id': profile.id,
                            'content_id': profile.content_id,
                            'error': str(e),
                        },
                        exc_info=True,
                    )
                    continue

            return paginator.get_paginated_response(response_data)
        except Exception as e:
            log_error(
                e,
                context='UserContentWithDetailsView.get',
                user_id=user_id,
                extra={'username': username},
                logger_instance=logger,
            )
            return Response(
                {'error': 'Ocurrio un error al obtener el contenido'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
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
                    logger.warning(
                        "Failed to serialize content profile (by user id)",
                        extra={
                            'requesting_user_id': request.user.id,
                            'target_user_id': user_id,
                            'profile_id': profile.id,
                            'content_id': profile.content_id,
                            'error': str(e),
                        },
                        exc_info=True,
                    )
            
            return Response(response_data, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response(
                {'error': f'Usuario con ID {user_id} no encontrado'}, 
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            log_error(
                e,
                context='UserContentByIdView.get',
                user_id=request.user.id,
                extra={'target_user_id': user_id},
                logger_instance=logger,
            )
            return Response(
                {'error': 'Ocurrio un error al obtener el contenido'}, 
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
        collections = Collection.objects.filter(library__user=request.user).select_related(
            'library__user'
        )
        serializer = CollectionSerializer(
            collections, many=True, context={'request': request}
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        library, _ = Library.objects.get_or_create(
            user=request.user,
            defaults={'name': f"{request.user.username}'s Library"}
        )
        
        collection_data = request.data.copy()
        collection_data['library'] = library.id
        
        serializer = CollectionSerializer(
            data=collection_data, context={'request': request}
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PublicCollectionsView(APIView):
    """
    Paginated list of collections marked public by any user.
    Only includes collections with at least one visible content profile.

    Query params:
    - search: filter by collection name (icontains)
    - owner: user id of the library owner (only their public collections with visible items)
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = (
            Collection.objects.filter(is_public=True)
            .select_related('library__user')
            .annotate(
                visible_item_count=Count(
                    'contentprofile',
                    filter=Q(contentprofile__is_visible=True),
                )
            )
            .filter(visible_item_count__gt=0)
            .order_by('-id')
        )
        search = (request.query_params.get('search') or '').strip()
        if search:
            qs = qs.filter(name__icontains=search)

        owner_raw = (request.query_params.get('owner') or '').strip()
        if owner_raw:
            try:
                owner_id = int(owner_raw)
                if owner_id < 1:
                    raise ValueError
                qs = qs.filter(library__user_id=owner_id)
            except (TypeError, ValueError):
                return Response(
                    {'error': 'Parámetro owner inválido'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        paginator = UserLibraryPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = PublicCollectionSummarySerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class CollectionDetailView(APIView):
    """Get or update a specific collection"""
    permission_classes = [IsAuthenticated]

    def get(self, request, collection_id):
        collection = get_object_or_404(
            Collection.objects.select_related('library__user'),
            id=collection_id,
        )
        is_owner = collection.library.user_id == request.user.id
        if not is_owner and not collection.is_public:
            return Response(
                {'error': 'Colección no encontrada'},
                status=status.HTTP_404_NOT_FOUND,
            )
        serializer = CollectionSerializer(
            collection, context={'request': request}
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, collection_id):
        collection = get_object_or_404(
            Collection,
            id=collection_id,
            library__user=request.user,
        )
        payload = {}
        if 'name' in request.data:
            payload['name'] = request.data['name']
        if 'is_public' in request.data:
            payload['is_public'] = bool(request.data['is_public'])
        if not payload:
            return Response(
                {'error': 'No hay campos para actualizar'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = CollectionSerializer(
            collection,
            data=payload,
            partial=True,
            context={'request': request},
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CollectionContentView(APIView):
    """Get all content profiles for a specific collection"""
    permission_classes = [IsAuthenticated]

    def get(self, request, collection_id):
        collection = get_object_or_404(
            Collection.objects.select_related('library__user'),
            id=collection_id,
        )
        is_owner = collection.library.user_id == request.user.id
        if not is_owner and not collection.is_public:
            return Response(
                {'error': 'Colección no encontrada'},
                status=status.HTTP_404_NOT_FOUND,
            )

        content_profiles = (
            ContentProfile.objects.filter(collection=collection)
            .select_related('content', 'content__file_details')
            .order_by('title')
        )
        if not is_owner:
            content_profiles = content_profiles.filter(is_visible=True)

        serializer = SimpleContentProfileSerializer(
            content_profiles,
            many=True,
            context={'request': request, 'collection_detail': True},
        )
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
                {'error': 'content_profile_ids debe ser un array no vacio'}, 
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
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def patch(self, request, content_profile_id):
        content_profile = get_object_or_404(
            ContentProfile,
            id=content_profile_id,
            user=request.user
        )
        
        # Enforce producer claim when attempting to make content invisible.
        # Anyone can keep it visible, but hiding requires producer status.
        if 'is_visible' in request.data:
            requested_visible = str(request.data.get('is_visible')).lower() in ('true', '1', 'yes', 'on')
            claimed_is_producer = request.data.get('is_producer', None)
            if claimed_is_producer is None:
                effective_is_producer = bool(content_profile.is_producer)
            else:
                effective_is_producer = str(claimed_is_producer).lower() in ('true', '1', 'yes', 'on')

            if not requested_visible and not effective_is_producer:
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


def get_topic_content_profile_for_display(
    content, request, topic, prefetched_profiles=None
):
    """
    Pick a ContentProfile to represent this content in a topic context.
    Prefer the topic creator's profile, then the current user's, then lowest id.

    If prefetched_profiles is passed (list from content.profiles.all()), no DB
    queries are run for profile lookup.
    """
    if prefetched_profiles is not None:
        profiles = prefetched_profiles
        if not profiles:
            return None
        creator_id = topic.creator_id
        uid = request.user.id
        for p in profiles:
            if creator_id and p.user_id == creator_id:
                return p
        for p in profiles:
            if p.user_id == uid:
                return p
        return min(profiles, key=lambda p: p.id)

    try:
        return ContentProfile.objects.get(content=content, user=topic.creator)
    except ContentProfile.DoesNotExist:
        pass
    try:
        return ContentProfile.objects.get(content=content, user=request.user)
    except ContentProfile.DoesNotExist:
        pass
    return (
        ContentProfile.objects.filter(content=content)
        .select_related("content")
        .order_by("id")
        .first()
    )


# Topic Views
class TopicView(APIView):
    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [permission() for permission in self.permission_classes]

    def get(self, request):
        topics = Topic.objects.all()
        serializer = TopicBasicSerializer(topics, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        serializer = TopicBasicSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            topic = serializer.save(creator=request.user)
            # Best-effort; missing/unreadable cover only logs a warning, never fails the request.
            if topic.topic_image:
                generate_topic_thumbnail(topic)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TopicDetailView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_content_profile(
        self, content, request, topic, prefetched_profiles=None
    ):
        """
        Get the appropriate ContentProfile based on context.
        For topics, we want the topic creator's profile for the content.
        """
        return get_topic_content_profile_for_display(
            content, request, topic, prefetched_profiles=prefetched_profiles
        )

    def get(self, request, pk):
        topic = get_object_or_404(
            Topic.objects.prefetch_related(
                'contents',
                'contents__file_details',
                'contents__profiles'
            ),
            pk=pk
        )

        include_contents = request.query_params.get('include_contents', 'true').lower() not in (
            '0', 'false', 'no'
        )

        ordered_contents = []
        contents_with_profiles = []
        if include_contents:
            # Get contents ordered by vote count per media type (same order as "ver todos")
            for media_type in ['IMAGE', 'TEXT', 'AUDIO', 'VIDEO']:
                ordered_contents.extend(get_top_voted_contents(topic, media_type))

            # Prefetch file_details for the ordered contents
            content_ids = [c.id for c in ordered_contents]
            contents_prefetched = {
                c.id: c
                for c in Content.objects.filter(id__in=content_ids).prefetch_related(
                    "file_details", "profiles"
                )
            }
            ordered_contents = [
                contents_prefetched[cid] for cid in content_ids if cid in contents_prefetched
            ]

            # Get the appropriate profile for each content
            for content in ordered_contents:
                selected_profile = self.get_content_profile(
                    content,
                    request,
                    topic,
                    prefetched_profiles=list(content.profiles.all()),
                )
                contents_with_profiles.append({
                    'content': content,
                    'selected_profile': selected_profile
                })

        serializer = TopicDetailSerializer(topic, context={
            'request': request,
            'user': request.user,
            'topic': topic,
            'ordered_contents': ordered_contents,
            'selected_profiles': {item['content'].id: item['selected_profile'] for item in contents_with_profiles}
        })
        return Response(serializer.data)

    def patch(self, request, pk):
        logger.info("Topic PATCH topic_id=%s", pk)
        topic = get_object_or_404(Topic, pk=pk)

        if not topic.is_moderator_or_creator(request.user):
            logger.warning("Topic PATCH forbidden topic_id=%s", pk)
            return Response(
                {"error": "No tiene permiso para actualizar este tema."},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        except Exception as e:
            logger.exception("Topic PATCH copy request.data failed: %s", e)
            return Response({"error": "Error procesando la peticion."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        has_image = "topic_image" in request.FILES
        logger.info("Topic PATCH topic_id=%s has_image=%s", pk, has_image)

        if has_image:
            if topic.topic_image:
                old_image_path = os.path.join(settings.MEDIA_ROOT, str(topic.topic_image))
                if os.path.exists(old_image_path):
                    os.remove(old_image_path)
                topic.topic_image.delete(save=False)
            # Drop the stale thumbnail; it gets regenerated after save.
            delete_topic_thumbnail(topic, save=False)
            data["topic_image"] = request.FILES["topic_image"]

        serializer = TopicDetailSerializer(
            topic,
            data=data,
            context={"request": request},
            partial=True
        )

        if not serializer.is_valid():
            logger.warning("Topic PATCH invalid topic_id=%s errors=%s", pk, serializer.errors)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            saved_topic = serializer.save()
            # Best-effort; thumbnail failure must not roll back a successful topic save.
            if has_image:
                generate_topic_thumbnail(saved_topic)
            logger.info("Topic PATCH saved topic_id=%s", pk)
            return Response(serializer.data)
        except Exception as e:
            logger.exception("Topic PATCH save failed topic_id=%s: %s", pk, e)
            return Response(
                {"error": "Error al guardar el tema."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def delete(self, request, pk):
        logger.info("Topic DELETE topic_id=%s user=%s", pk, request.user.username)
        topic = get_object_or_404(Topic, pk=pk)

        if topic.creator != request.user:
            logger.warning("Topic DELETE forbidden topic_id=%s user=%s (only creator can delete)", pk, request.user.username)
            return Response(
                {"error": "Solo el creador del tema puede eliminarlo."},
                status=status.HTTP_403_FORBIDDEN
            )

        topic_title = topic.title
        topic.delete()
        logger.info("Topic DELETE success topic_id=%s title=%s", pk, topic_title)
        return Response(status=status.HTTP_204_NO_CONTENT)


class TopicContentSimpleView(APIView):
    """Topic content view optimized for content management operations"""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        topic = get_object_or_404(Topic.objects.prefetch_related("contents"), pk=pk)

        if not topic.is_moderator_or_creator(request.user):
            return Response(
                {
                    "error": "No tiene permiso para ver el listado de contenido de este tema."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        # Same ordering as the public topic view (vote buckets), then one query
        # batch for profiles — avoids N+1 selects from per-content profile lookup.
        ordered_contents = get_topic_contents_ordered_for_public_view(topic)
        content_ids = [c.id for c in ordered_contents]
        contents_by_id = (
            {
                c.id: c
                for c in Content.objects.filter(id__in=content_ids).prefetch_related(
                    "profiles"
                )
            }
            if content_ids
            else {}
        )
        ordered_loaded = [
            contents_by_id[cid] for cid in content_ids if cid in contents_by_id
        ]

        profiles = []
        for content in ordered_loaded:
            profile = get_topic_content_profile_for_display(
                content,
                request,
                topic,
                prefetched_profiles=list(content.profiles.all()),
            )
            if profile is not None:
                profiles.append(profile)

        response_data = []
        for profile in profiles:
            try:
                serializer = SimpleContentProfileSerializer(
                    profile,
                    context={"request": request},
                )
                response_data.append(serializer.data)
            except Exception as e:
                logger.warning(
                    "Failed to serialize content profile in topic simple view",
                    extra={
                        'user_id': request.user.id,
                        'topic_id': pk,
                        'profile_id': profile.id,
                        'content_id': profile.content_id,
                        'error': str(e),
                    },
                    exc_info=True,
                )
                continue

        return Response(
            {
                "topic": {
                    "id": topic.id,
                    "title": topic.title,
                    "description": topic.description,
                },
                "contents": response_data,
            },
            status=status.HTTP_200_OK,
        )


class TopicTimelineView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    def get_timeline_queryset(self):
        return TopicTimeline.objects.select_related(
            'topic',
            'created_by',
        ).prefetch_related(
            'entries',
            'entries__created_by',
            'entries__updated_by',
            'entries__entry_contents',
            'entries__entry_contents__content',
            'entries__entry_contents__content__file_details',
            'entries__entry_contents__content__profiles',
        )

    def get_selected_profiles(self, timeline, request):
        selected_profiles = {}
        for entry in timeline.entries.all():
            for link in entry.entry_contents.all():
                content = link.content
                selected_profiles[content.id] = get_topic_content_profile_for_display(
                    content,
                    request,
                    timeline.topic,
                    prefetched_profiles=list(content.profiles.all()),
                )
        return selected_profiles

    def serialize_timeline(self, timeline, request):
        return TopicTimelineSerializer(
            timeline,
            context={
                'request': request,
                'topic': timeline.topic,
                'selected_profiles': self.get_selected_profiles(timeline, request),
            },
        ).data

    def get(self, request, pk):
        topic = get_object_or_404(Topic, pk=pk)
        timeline = self.get_timeline_queryset().filter(topic=topic).first()
        if timeline is None:
            return Response(
                {
                    'id': None,
                    'topic': topic.id,
                    'title': '',
                    'description': '',
                    'entries': [],
                    'created_by': None,
                    'created_at': None,
                    'updated_at': None,
                },
                status=status.HTTP_200_OK,
            )
        return Response(self.serialize_timeline(timeline, request), status=status.HTTP_200_OK)

    def post(self, request, pk):
        topic = get_object_or_404(Topic, pk=pk)
        if not topic.is_moderator_or_creator(request.user):
            return Response(
                {'error': 'No tiene permiso para editar la linea de tiempo de este tema.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        timeline, _ = TopicTimeline.objects.get_or_create(
            topic=topic,
            defaults={
                'title': topic.title,
                'created_by': request.user,
            },
        )
        serializer = TopicTimelineEntrySerializer(
            data=request.data,
            context={
                'request': request,
                'topic': topic,
                'timeline': timeline,
            },
        )
        if serializer.is_valid():
            entry = serializer.save()
            timeline = self.get_timeline_queryset().get(pk=timeline.pk)
            response_serializer = TopicTimelineEntrySerializer(
                entry,
                context={
                    'request': request,
                    'topic': topic,
                    'timeline': timeline,
                    'selected_profiles': self.get_selected_profiles(timeline, request),
                },
            )
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class TopicTimelineEntryDetailView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    def get_entry(self, topic_id, entry_id):
        return get_object_or_404(
            TopicTimelineEntry.objects.select_related(
                'timeline',
                'timeline__topic',
                'created_by',
                'updated_by',
            ).prefetch_related(
                'entry_contents',
                'entry_contents__content',
                'entry_contents__content__file_details',
                'entry_contents__content__profiles',
            ),
            pk=entry_id,
            timeline__topic_id=topic_id,
        )

    def get_selected_profiles(self, entry, request):
        selected_profiles = {}
        topic = entry.timeline.topic
        for link in entry.entry_contents.all():
            content = link.content
            selected_profiles[content.id] = get_topic_content_profile_for_display(
                content,
                request,
                topic,
                prefetched_profiles=list(content.profiles.all()),
            )
        return selected_profiles

    def patch(self, request, pk, entry_id):
        entry = self.get_entry(pk, entry_id)
        topic = entry.timeline.topic
        if not topic.is_moderator_or_creator(request.user):
            return Response(
                {'error': 'No tiene permiso para editar la linea de tiempo de este tema.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = TopicTimelineEntrySerializer(
            entry,
            data=request.data,
            partial=True,
            context={
                'request': request,
                'topic': topic,
                'timeline': entry.timeline,
            },
        )
        if serializer.is_valid():
            updated_entry = serializer.save()
            updated_entry = self.get_entry(pk, updated_entry.pk)
            response_serializer = TopicTimelineEntrySerializer(
                updated_entry,
                context={
                    'request': request,
                    'topic': topic,
                    'timeline': updated_entry.timeline,
                    'selected_profiles': self.get_selected_profiles(updated_entry, request),
                },
            )
            return Response(response_serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk, entry_id):
        entry = self.get_entry(pk, entry_id)
        topic = entry.timeline.topic
        if not topic.is_moderator_or_creator(request.user):
            return Response(
                {'error': 'No tiene permiso para editar la linea de tiempo de este tema.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        entry.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TopicTimelineReorderView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    def post(self, request, pk):
        topic = get_object_or_404(Topic, pk=pk)
        if not topic.is_moderator_or_creator(request.user):
            return Response(
                {'error': 'No tiene permiso para editar la linea de tiempo de este tema.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        timeline = TopicTimeline.objects.filter(topic=topic).first()
        if timeline is None:
            return Response({'error': 'La linea de tiempo no existe.'}, status=status.HTTP_404_NOT_FOUND)

        entry_ids = request.data.get('entry_ids', [])
        if not isinstance(entry_ids, list) or not entry_ids:
            return Response(
                {'entry_ids': 'Debe enviar una lista de entradas en el nuevo orden.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        current_ids = set(timeline.entries.values_list('id', flat=True))
        requested_ids = set(entry_ids)
        if current_ids != requested_ids:
            return Response(
                {'entry_ids': 'La lista debe incluir exactamente todas las entradas de la linea de tiempo.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            for index, entry_id in enumerate(entry_ids, start=1):
                TopicTimelineEntry.objects.filter(
                    id=entry_id,
                    timeline=timeline,
                ).update(order=index, updated_by=request.user)

        return Response({'message': 'Timeline reordered successfully'}, status=status.HTTP_200_OK)


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
        except ValidationError as e:
            logger.warning(
                "Topic content add validation error",
                extra={'topic_id': pk, 'user_id': request.user.id, 'detail': str(e)},
            )
            return Response(
                {'error': f'Error al agregar contenido: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except (ValueError, TypeError) as e:
            logger.warning(
                "Topic content add bad input",
                extra={'topic_id': pk, 'user_id': request.user.id, 'detail': str(e)},
            )
            return Response(
                {'error': f'Error al agregar contenido: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except IntegrityError as e:
            logger.warning(
                "Topic content add integrity error",
                extra={'topic_id': pk, 'user_id': request.user.id, 'detail': str(e)},
            )
            return Response(
                {'error': 'No se pudo agregar el contenido al tema.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            log_error(
                e,
                context='TopicEditContentView.post',
                user_id=request.user.id,
                extra={'topic_id': pk},
                logger_instance=logger,
            )
            return Response(
                {'error': 'Ocurrio un error al agregar contenido al tema.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
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
        except ValidationError as e:
            logger.warning(
                "Topic content remove validation error",
                extra={'topic_id': pk, 'user_id': request.user.id, 'detail': str(e)},
            )
            return Response(
                {'error': f'Error al eliminar contenido: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except (ValueError, TypeError) as e:
            logger.warning(
                "Topic content remove bad input",
                extra={'topic_id': pk, 'user_id': request.user.id, 'detail': str(e)},
            )
            return Response(
                {'error': f'Error al eliminar contenido: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            log_error(
                e,
                context='TopicEditContentView.patch',
                user_id=request.user.id,
                extra={'topic_id': pk},
                logger_instance=logger,
            )
            return Response(
                {'error': 'Ocurrio un error al eliminar contenido del tema.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
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
            
        except ValidationError as e:
            logger.warning(
                "Topic moderators add validation error",
                extra={'topic_id': pk, 'user_id': request.user.id, 'detail': str(e)},
            )
            return Response(
                {"error": f"Error al agregar moderadores: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        except (ValueError, TypeError) as e:
            logger.warning(
                "Topic moderators add bad input",
                extra={'topic_id': pk, 'user_id': request.user.id, 'detail': str(e)},
            )
            return Response(
                {"error": f"Error al agregar moderadores: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        except IntegrityError as e:
            logger.warning(
                "Topic moderators add integrity error",
                extra={'topic_id': pk, 'user_id': request.user.id, 'detail': str(e)},
            )
            return Response(
                {"error": "No se pudo agregar moderadores."},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            log_error(
                e,
                context='TopicModeratorsView.post',
                user_id=request.user.id,
                extra={'topic_id': pk},
                logger_instance=logger,
            )
            return Response(
                {"error": "Ocurrio un error al agregar moderadores."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
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
            
        except ValidationError as e:
            logger.warning(
                "Topic moderators remove validation error",
                extra={'topic_id': pk, 'user_id': request.user.id, 'detail': str(e)},
            )
            return Response(
                {"error": f"Error al eliminar moderadores: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        except (ValueError, TypeError) as e:
            logger.warning(
                "Topic moderators remove bad input",
                extra={'topic_id': pk, 'user_id': request.user.id, 'detail': str(e)},
            )
            return Response(
                {"error": f"Error al eliminar moderadores: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        except IntegrityError as e:
            logger.warning(
                "Topic moderators remove integrity error",
                extra={'topic_id': pk, 'user_id': request.user.id, 'detail': str(e)},
            )
            return Response(
                {"error": "No se pudo eliminar moderadores."},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            log_error(
                e,
                context='TopicModeratorsView.delete',
                user_id=request.user.id,
                extra={'topic_id': pk},
                logger_instance=logger,
            )
            return Response(
                {"error": "Ocurrio un error al eliminar moderadores."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserSearchView(APIView):
    """Search users by username for autocomplete (e.g. when inviting topic moderators)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        q = (request.query_params.get('q') or '').strip()
        if not q:
            return Response({'results': []}, status=status.HTTP_200_OK)
        users = User.objects.filter(
            username__icontains=q
        ).values('id', 'username').order_by('username')[:15]
        return Response({'results': list(users)}, status=status.HTTP_200_OK)


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
                {"error": f"Error al crear la invitacion: {str(e)}"},
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
            # Only invited users can see their own invitations; other users get 403.
            if not TopicModeratorInvitation.objects.filter(topic=topic, invited_user=request.user).exists():
                return Response(
                    {"error": "No tiene permiso para ver invitaciones de este tema."},
                    status=status.HTTP_403_FORBIDDEN
                )
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
                {"error": "Solo el usuario invitado puede aceptar la invitacion."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if invitation is pending
        if invitation.status != 'PENDING':
            return Response(
                {"error": "Esta invitacion ya no esta pendiente."},
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
                {"error": f"Error al aceptar la invitacion: {str(e)}"},
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
                {"error": "Solo el usuario invitado puede rechazar la invitacion."},
                status=status.HTTP_403_FORBIDDEN
            )
        
        # Check if invitation is pending
        if invitation.status != 'PENDING':
            return Response(
                {"error": "Esta invitacion ya no esta pendiente."},
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
                {"error": f"Error al rechazar la invitacion: {str(e)}"},
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

    def get(self, request, pk, media_type):
        topic = get_object_or_404(Topic, pk=pk)
        media_type = media_type.upper()
        content_type = ContentType.objects.get_for_model(Content)
        vote_count_subquery = Subquery(
            VoteCount.objects.filter(
                content_type=content_type,
                object_id=OuterRef('id'),
                topic=topic
            ).values('vote_count')[:1]
        )
        contents = topic.contents.filter(media_type=media_type).annotate(
            vote_count_value=Coalesce(vote_count_subquery, 0)
        ).order_by('-vote_count_value', '-created_at').prefetch_related(
            'file_details',
            'profiles',
            'profiles__user',
        ).select_related('uploaded_by')

        # Batch profile lookup via prefetch — avoids N+1 selects on content_contentprofile.
        contents_with_profiles = []
        for content in contents:
            selected_profile = get_topic_content_profile_for_display(
                content,
                request,
                topic,
                prefetched_profiles=list(content.profiles.all()),
            )
            contents_with_profiles.append({
                'content': content,
                'selected_profile': selected_profile
            })

        paginator = TopicContentMediaTypePagination()
        page = paginator.paginate_queryset(contents_with_profiles, request)
        paged_contents = page if page is not None else contents_with_profiles

        serializer = ContentWithSelectedProfileSerializer(
            [item['content'] for item in paged_contents],
            many=True,
            context={
                'request': request,
                'topic': topic,
                'selected_profiles': {
                    item['content'].id: item['selected_profile']
                    for item in paged_contents
                }
            }
        )

        if page is not None:
            response = paginator.get_paginated_response(serializer.data)
            response.data['topic'] = {'id': topic.id, 'title': topic.title}
            return response

        return Response({
            'topic': {'id': topic.id, 'title': topic.title},
            'contents': serializer.data,
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
                {'error': 'Publicacion no encontrada'},
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
                        'details': 'Ocurrio un error en la base de datos al crear el perfil'
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
                        'details': 'Ocurrio un error al preparar la respuesta'
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
                    'error': 'Ocurrio un error inesperado',
                    'details': 'Por favor, revise los registros del servidor para mas informacion'
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
        except Exception as e:
            logger.debug(
                "Favicon head request failed (optional)",
                extra={'base_url': base_url, 'default_favicon': default_favicon, 'error': str(e)},
            )
        
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
        except Exception as e:
            logger.debug(
                "YouTube oEmbed fetch failed (optional)",
                extra={'video_id': video_id, 'error': str(e)},
            )
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
                logger.warning(
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

            if content_type.startswith('application/pdf'):
                parsed_url = urlparse(url)
                file_name = os.path.basename(parsed_url.path)
                pdf_title = file_name if file_name else 'Documento PDF'

                metadata = {
                    'title': pdf_title,
                    'description': 'Documento PDF',
                    'type': 'document',
                    'siteName': parsed_url.netloc,
                }

                logger.info(
                    "URL preview successful for PDF",
                    extra={
                        'user_id': user_id,
                        'username': username,
                        'url': url,
                        'title': metadata.get('title'),
                    }
                )
                return Response(metadata)

            if not content_type.startswith('text/html'):
                logger.warning(
                    "URL preview failed: unsupported content type",
                    extra={
                        'user_id': user_id,
                        'username': username,
                        'url': url,
                        'content_type': content_type,
                    }
                )
                return Response({
                    'error': 'La URL debe apuntar a una pagina web o PDF'
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
                    {'error': 'No se pudo extraer informacion de vista previa de esta URL'}, 
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
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
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
    except Exception as e:
        logger.debug(
            "normalize_youtube_url parse failed; returning original",
            extra={'url': url, 'error': str(e)},
        )
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

            # Source updates are only allowed for original uploader while no other
            # users depend on this content as their library source.
            if not content.can_be_modified_by(request.user):
                other_users_count = content.get_other_user_profiles_count()
                return Response(
                    {
                        'error': (
                            f'No se puede cambiar la fuente de este contenido porque '
                            f'{other_users_count} otro(s) usuario(s) lo han agregado a sus bibliotecas'
                            if other_users_count > 0
                            else 'No se puede cambiar la fuente de este contenido'
                        )
                    },
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
            
            # Validate URL updates (including clearing when a file is attached)
            if 'url' in request.data:
                incoming_url = request.data.get('url')
                if incoming_url is None or incoming_url == '':
                    fd = FileDetails.objects.filter(content=content).first()
                    has_file = bool(fd and fd.file)
                    if not has_file:
                        return Response(
                            {
                                'error': (
                                    'No se puede eliminar la URL sin un archivo adjunto.'
                                )
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                else:
                    logger.debug("Validating URL", extra={
                        'url': incoming_url,
                    })
                    validator = URLValidator()
                    try:
                        validator(incoming_url)
                        logger.debug("URL validation passed")
                    except ValidationError:
                        logger.warning("URL validation failed", extra={
                            'url': incoming_url,
                        })
                        return Response(
                            {'error': 'Formato de URL invalido'},
                            status=status.HTTP_400_BAD_REQUEST,
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


def _apply_accepted_file_suggestion(suggestion, reviewer):
    """Attach suggested file to the Content's FileDetails and mark the suggestion ACCEPTED."""
    content = suggestion.content
    file_details, _created = FileDetails.objects.get_or_create(content=content)
    file_details.file = suggestion.file
    file_details.file_size = suggestion.file_size
    file_details.save()
    suggestion.status = 'ACCEPTED'
    suggestion.reviewed_by = reviewer
    suggestion.reviewed_at = timezone.now()
    suggestion.rejection_reason = None
    suggestion.save()


def _file_suggestion_eligibility_error_response(user, content):
    """Return a DRF Response if the user cannot create a file suggestion, else None."""
    if content.uploaded_by_id == user.id:
        return Response(
            {"error": "No puede sugerir archivo para su propio contenido."},
            status=status.HTTP_403_FORBIDDEN,
        )
    if not content.url:
        return Response(
            {"error": "Solo se permite sugerir archivo para contenidos con URL."},
            status=status.HTTP_400_BAD_REQUEST
        )
    fd = FileDetails.objects.filter(content=content).first()
    has_file = bool(fd and fd.file)
    if has_file:
        return Response(
            {"error": "Este contenido ya tiene un archivo asociado."},
            status=status.HTTP_400_BAD_REQUEST
        )
    if FileSuggestion.objects.filter(
        content=content,
        suggested_by=user,
        status='PENDING'
    ).exists():
        return Response(
            {"error": "Ya tiene una sugerencia pendiente para este contenido."},
            status=status.HTTP_400_BAD_REQUEST
        )
    return None


def _file_suggestion_expected_key_prefix(content_id, user_id):
    return f"content_suggestions/files/{content_id}/{user_id}/"


def _delete_file_suggestion_storage(suggestion):
    """Remove the suggested file from storage (S3 or local). Does not save the model."""
    f = suggestion.file
    if not f:
        return
    path = getattr(f, 'name', None) or ''
    if not path:
        return
    try:
        f.delete(save=False)
    except Exception as e:
        logger.warning(
            'Failed to delete file suggestion blob from storage',
            extra={
                'file_suggestion_id': suggestion.id,
                'path': path,
                'error': str(e),
            },
        )


def _owner_attach_expected_key_prefix(content_id, user_id):
    return f"content_owner_attach/{content_id}/{user_id}/"


def _owner_attach_eligibility_error_response(user, content):
    """Uploader-only: attach file to URL-only content without FileSuggestion."""
    if content.uploaded_by_id != user.id:
        return Response(
            {"error": "Solo el autor original puede adjuntar un archivo directamente."},
            status=status.HTTP_403_FORBIDDEN,
        )
    if not content.url:
        return Response(
            {"error": "Solo aplica a contenidos con URL."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    fd = FileDetails.objects.filter(content=content).first()
    if fd and fd.file:
        return Response(
            {"error": "Este contenido ya tiene un archivo asociado."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not content.can_be_modified_by(user):
        other_users_count = content.get_other_user_profiles_count()
        return Response(
            {
                "error": (
                    f"No se puede adjuntar archivo porque {other_users_count} otro(s) usuario(s) "
                    f"lo han agregado a sus bibliotecas"
                    if other_users_count > 0
                    else "No se puede adjuntar archivo a este contenido"
                )
            },
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


class ContentOwnerAttachPresignView(APIView):
    """Presigned PUT for original uploader to attach a file (no FileSuggestion)."""
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    def post(self, request, pk):
        content = get_object_or_404(Content, pk=pk)
        err = _owner_attach_eligibility_error_response(request.user, content)
        if err is not None:
            return err

        if not getattr(settings, 'AWS_ACCESS_KEY_ID', None) or not getattr(settings, 'AWS_SECRET_ACCESS_KEY', None):
            return Response(
                {'error': 'S3 no esta configurado para subida directa'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        filename = request.data.get('filename')
        file_size = request.data.get('file_size')
        content_type = request.data.get('content_type') or 'application/octet-stream'
        if not filename or file_size is None:
            return Response(
                {'error': 'Se requieren filename y file_size'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            file_size = int(file_size)
        except (TypeError, ValueError):
            return Response({'error': 'file_size debe ser un numero'}, status=status.HTTP_400_BAD_REQUEST)
        if file_size <= 0 or file_size > UPLOAD_CONTENT_MAX_SIZE:
            return Response(
                {'error': 'El tamano del archivo debe estar entre 1 byte y 5 TB'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        safe_name = sanitize_filename_for_s3_key(filename)
        key = f"{_owner_attach_expected_key_prefix(content.id, request.user.id)}{uuid.uuid4().hex}_{safe_name}"
        bucket = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', 'academiablockchain')
        region = getattr(settings, 'AWS_S3_REGION_NAME', 'us-west-2')
        expires_in = 3600
        try:
            s3_client = boto3.client(
                's3',
                region_name=region,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            )
            upload_plan = _build_s3_upload_plan(
                s3_client=s3_client,
                bucket=bucket,
                key=key,
                content_type=content_type,
                file_size=file_size,
                expires_in=expires_in,
            )
        except Exception as e:
            logger.exception("Owner attach presign: boto3 failed: %s", e)
            return Response(
                {'error': 'No se pudo generar la URL de subida', 'details': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return Response(upload_plan, status=status.HTTP_200_OK)


class ContentOwnerAttachConfirmView(APIView):
    """After S3 PUT: persist file key on FileDetails (uploader only, no FileSuggestion)."""
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    def post(self, request, pk):
        content = get_object_or_404(Content, pk=pk)
        err = _owner_attach_eligibility_error_response(request.user, content)
        if err is not None:
            return err

        if not getattr(settings, 'AWS_ACCESS_KEY_ID', None):
            return Response(
                {'error': 'S3 no esta configurado'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        key = request.data.get('key')
        upload_id = request.data.get('upload_id')
        multipart_parts = request.data.get('parts')
        if not key or not isinstance(key, str) or not key.strip():
            return Response({'error': 'Se requiere key'}, status=status.HTTP_400_BAD_REQUEST)
        key = key.strip()
        if is_unsafe_s3_key(key):
            return Response({'error': 'key invalido'}, status=status.HTTP_400_BAD_REQUEST)

        expected = _owner_attach_expected_key_prefix(content.id, request.user.id)
        if not key.startswith(expected):
            return Response({'error': 'key no corresponde a este contenido o usuario'}, status=status.HTTP_400_BAD_REQUEST)

        file_size = request.data.get('file_size')
        try:
            file_size = int(file_size) if file_size is not None else None
        except (TypeError, ValueError):
            file_size = None

        bucket = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', 'academiablockchain')
        try:
            s3_client = boto3.client(
                's3',
                region_name=getattr(settings, 'AWS_S3_REGION_NAME', 'us-west-2'),
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
            )
            if upload_id:
                if not isinstance(upload_id, str) or not upload_id.strip():
                    return Response({'error': 'upload_id invalido'}, status=status.HTTP_400_BAD_REQUEST)
                if not isinstance(multipart_parts, list) or not multipart_parts:
                    return Response({'error': 'Se requieren parts para completar multipart upload'}, status=status.HTTP_400_BAD_REQUEST)
                normalized_parts = []
                for part in multipart_parts:
                    if not isinstance(part, dict):
                        return Response({'error': 'parts invalido'}, status=status.HTTP_400_BAD_REQUEST)
                    etag = part.get('etag')
                    part_number = part.get('part_number')
                    if etag is None or part_number is None:
                        return Response({'error': 'Cada part requiere etag y part_number'}, status=status.HTTP_400_BAD_REQUEST)
                    try:
                        part_number = int(part_number)
                    except (TypeError, ValueError):
                        return Response({'error': 'part_number invalido'}, status=status.HTTP_400_BAD_REQUEST)
                    normalized_parts.append({'ETag': str(etag), 'PartNumber': part_number})
                normalized_parts.sort(key=lambda p: p['PartNumber'])
                s3_client.complete_multipart_upload(
                    Bucket=bucket,
                    Key=key,
                    UploadId=upload_id.strip(),
                    MultipartUpload={'Parts': normalized_parts},
                )
            s3_client.head_object(Bucket=bucket, Key=key)
        except Exception as e:
            logger.warning(
                "Owner attach confirm: head_object failed",
                extra={'s3_key': key, 'bucket': bucket, 'error': str(e)},
            )
            return Response(
                {'error': 'El archivo no se encontro en el almacenamiento. Sube primero con la URL de subida.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        file_details, _created = FileDetails.objects.get_or_create(content=content)
        FileDetails.objects.filter(pk=file_details.pk).update(file=key, file_size=file_size)
        file_details.refresh_from_db()

        serializer = ContentSerializer(content, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class ContentOwnerAttachView(APIView):
    """Multipart attach file for original uploader (no S3 / no FileSuggestion)."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        content = get_object_or_404(Content, pk=pk)
        file_obj = request.FILES.get('file')
        if not file_obj:
            return Response({"error": "Debe adjuntar un archivo."}, status=status.HTTP_400_BAD_REQUEST)

        err = _owner_attach_eligibility_error_response(request.user, content)
        if err is not None:
            return err

        file_details, _created = FileDetails.objects.get_or_create(content=content)
        file_details.file = file_obj
        file_details.file_size = getattr(file_obj, 'size', None)
        file_details.save()

        serializer = ContentSerializer(content, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class FileSuggestionPresignView(APIView):
    """Presigned PUT URL for direct S3 upload of a file suggestion (large files)."""
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    def post(self, request, pk):
        content = get_object_or_404(Content, pk=pk)
        err = _file_suggestion_eligibility_error_response(request.user, content)
        if err is not None:
            return err

        if not getattr(settings, 'AWS_ACCESS_KEY_ID', None) or not getattr(settings, 'AWS_SECRET_ACCESS_KEY', None):
            logger.warning("File suggestion presign: S3 not configured, returning 503")
            return Response(
                {'error': 'S3 no esta configurado para subida directa'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        filename = request.data.get('filename')
        file_size = request.data.get('file_size')
        content_type = request.data.get('content_type') or 'application/octet-stream'
        if not filename or file_size is None:
            return Response(
                {'error': 'Se requieren filename y file_size'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            file_size = int(file_size)
        except (TypeError, ValueError):
            return Response({'error': 'file_size debe ser un numero'}, status=status.HTTP_400_BAD_REQUEST)
        if file_size <= 0 or file_size > UPLOAD_CONTENT_MAX_SIZE:
            return Response(
                {'error': 'El tamano del archivo debe estar entre 1 byte y 5 TB'},
                status=status.HTTP_400_BAD_REQUEST
            )

        safe_name = sanitize_filename_for_s3_key(filename)
        key = (
            f"{_file_suggestion_expected_key_prefix(content.id, request.user.id)}"
            f"{uuid.uuid4().hex}_{safe_name}"
        )
        bucket = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', 'academiablockchain')
        region = getattr(settings, 'AWS_S3_REGION_NAME', 'us-west-2')
        expires_in = 3600
        try:
            s3_client = boto3.client(
                's3',
                region_name=region,
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
            )
            upload_plan = _build_s3_upload_plan(
                s3_client=s3_client,
                bucket=bucket,
                key=key,
                content_type=content_type,
                file_size=file_size,
                expires_in=expires_in
            )
        except Exception as e:
            logger.exception("File suggestion presign: boto3 failed: %s", e)
            return Response(
                {'error': 'No se pudo generar la URL de subida', 'details': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        return Response(upload_plan, status=status.HTTP_200_OK)


class FileSuggestionConfirmView(APIView):
    """After client uploaded to S3, create FileSuggestion row pointing at the key."""
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    def post(self, request, pk):
        content = get_object_or_404(Content, pk=pk)
        err = _file_suggestion_eligibility_error_response(request.user, content)
        if err is not None:
            return err

        if not getattr(settings, 'AWS_ACCESS_KEY_ID', None):
            return Response(
                {'error': 'S3 no esta configurado'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        key = request.data.get('key')
        upload_id = request.data.get('upload_id')
        multipart_parts = request.data.get('parts')
        if not key or not isinstance(key, str) or not key.strip():
            return Response({'error': 'Se requiere key'}, status=status.HTTP_400_BAD_REQUEST)
        key = key.strip()
        if is_unsafe_s3_key(key):
            return Response({'error': 'key invalido'}, status=status.HTTP_400_BAD_REQUEST)

        expected = _file_suggestion_expected_key_prefix(content.id, request.user.id)
        if not key.startswith(expected):
            return Response({'error': 'key no corresponde a este contenido o usuario'}, status=status.HTTP_400_BAD_REQUEST)

        message = request.data.get('message', '') or ''
        file_size = request.data.get('file_size')
        try:
            file_size = int(file_size) if file_size is not None else None
        except (TypeError, ValueError):
            file_size = None

        bucket = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', 'academiablockchain')
        try:
            s3_client = boto3.client(
                's3',
                region_name=getattr(settings, 'AWS_S3_REGION_NAME', 'us-west-2'),
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
            )
            if upload_id:
                if not isinstance(upload_id, str) or not upload_id.strip():
                    return Response({'error': 'upload_id invalido'}, status=status.HTTP_400_BAD_REQUEST)
                if not isinstance(multipart_parts, list) or not multipart_parts:
                    return Response({'error': 'Se requieren parts para completar multipart upload'}, status=status.HTTP_400_BAD_REQUEST)
                normalized_parts = []
                for part in multipart_parts:
                    if not isinstance(part, dict):
                        return Response({'error': 'parts invalido'}, status=status.HTTP_400_BAD_REQUEST)
                    etag = part.get('etag')
                    part_number = part.get('part_number')
                    if etag is None or part_number is None:
                        return Response({'error': 'Cada part requiere etag y part_number'}, status=status.HTTP_400_BAD_REQUEST)
                    try:
                        part_number = int(part_number)
                    except (TypeError, ValueError):
                        return Response({'error': 'part_number invalido'}, status=status.HTTP_400_BAD_REQUEST)
                    normalized_parts.append({'ETag': str(etag), 'PartNumber': part_number})
                normalized_parts.sort(key=lambda p: p['PartNumber'])
                s3_client.complete_multipart_upload(
                    Bucket=bucket,
                    Key=key,
                    UploadId=upload_id.strip(),
                    MultipartUpload={'Parts': normalized_parts}
                )
            s3_client.head_object(Bucket=bucket, Key=key)
        except Exception as e:
            logger.warning(
                "File suggestion confirm: head_object failed",
                extra={'s3_key': key, 'bucket': bucket, 'error': str(e)}
            )
            return Response(
                {'error': 'El archivo no se encontro en el almacenamiento. Sube primero con la URL de subida.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        suggestion = FileSuggestion.objects.create(
            content=content,
            suggested_by=request.user,
            file_size=file_size,
            message=message,
            status='PENDING'
        )
        FileSuggestion.objects.filter(pk=suggestion.pk).update(file=key)
        suggestion.refresh_from_db()

        serializer = FileSuggestionSerializer(suggestion, context={'request': request})
        try:
            from utils.notification_utils import notify_file_suggestion_created

            notify_file_suggestion_created(suggestion)
        except Exception:
            logger.error(
                "Error sending file suggestion notification",
                extra={"suggestion_id": suggestion.id, "content_id": content.id},
                exc_info=True,
            )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class FileSuggestionCreateView(APIView):
    """Create a file suggestion for URL-based content."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request, pk):
        content = get_object_or_404(Content, pk=pk)
        file_obj = request.FILES.get('file')
        message = request.data.get('message', '')

        if not file_obj:
            return Response(
                {"error": "Debe adjuntar un archivo."},
                status=status.HTTP_400_BAD_REQUEST
            )

        err = _file_suggestion_eligibility_error_response(request.user, content)
        if err is not None:
            return err

        suggestion = FileSuggestion.objects.create(
            content=content,
            suggested_by=request.user,
            file=file_obj,
            file_size=getattr(file_obj, 'size', None),
            message=message,
            status='PENDING'
        )

        serializer = FileSuggestionSerializer(suggestion, context={'request': request})
        try:
            from utils.notification_utils import notify_file_suggestion_created

            notify_file_suggestion_created(suggestion)
        except Exception:
            logger.error(
                "Error sending file suggestion notification",
                extra={"suggestion_id": suggestion.id, "content_id": content.id},
                exc_info=True,
            )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class FileSuggestionListView(APIView):
    """List file suggestions for a content.

    - Original uploader sees all suggestions for the content.
    - Other users only see their own suggestions.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        content = get_object_or_404(Content, pk=pk)

        if content.uploaded_by_id == request.user.id:
            suggestions = FileSuggestion.objects.filter(content=content).order_by('-created_at')
        else:
            suggestions = FileSuggestion.objects.filter(
                content=content,
                suggested_by=request.user
            ).order_by('-created_at')

        serializer = FileSuggestionSerializer(suggestions, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class FileSuggestionAcceptView(APIView):
    """Accept a file suggestion and attach file to existing content."""
    permission_classes = [IsAuthenticated]

    def post(self, request, suggestion_id):
        suggestion = get_object_or_404(FileSuggestion, pk=suggestion_id)
        content = suggestion.content

        if content.uploaded_by_id != request.user.id:
            return Response(
                {"error": "Solo el uploader original puede aceptar sugerencias."},
                status=status.HTTP_403_FORBIDDEN
            )

        if suggestion.status != 'PENDING':
            return Response(
                {"error": "Esta sugerencia ya no está pendiente."},
                status=status.HTTP_400_BAD_REQUEST
            )

        _apply_accepted_file_suggestion(suggestion, request.user)

        serializer = FileSuggestionSerializer(suggestion, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class FileSuggestionRejectView(APIView):
    """Reject a file suggestion."""
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser]

    def post(self, request, suggestion_id):
        suggestion = get_object_or_404(FileSuggestion, pk=suggestion_id)
        content = suggestion.content

        if content.uploaded_by_id != request.user.id:
            return Response(
                {"error": "Solo el uploader original puede rechazar sugerencias."},
                status=status.HTTP_403_FORBIDDEN
            )

        if suggestion.status != 'PENDING':
            return Response(
                {"error": "Esta sugerencia ya no está pendiente."},
                status=status.HTTP_400_BAD_REQUEST
            )

        rejection_reason = request.data.get('rejection_reason', '')
        _delete_file_suggestion_storage(suggestion)
        suggestion.status = 'REJECTED'
        suggestion.reviewed_by = request.user
        suggestion.reviewed_at = timezone.now()
        suggestion.rejection_reason = rejection_reason
        suggestion.file = None
        suggestion.save()

        serializer = FileSuggestionSerializer(suggestion, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


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
                {"error": "Esta sugerencia ya no esta pendiente."},
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
                {"error": "Esta sugerencia ya no esta pendiente."},
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
