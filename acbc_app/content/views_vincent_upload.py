"""Vincent machine endpoints to publish a file into a topic as the actor user."""
import logging
import uuid

import boto3
from django.conf import settings
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView

from content.models import Content, ContentProfile, FileDetails, Topic
from content.permissions import VincentMachinePermission
from content.s3_key_utils import is_unsafe_s3_key, sanitize_filename_for_s3_key
from content.views import UPLOAD_CONTENT_MAX_SIZE, VALID_MEDIA_TYPES, _build_s3_upload_plan

logger = logging.getLogger(__name__)


def vincent_actor_user():
    raw_id = getattr(settings, 'VINCENT_ACTOR_USER_ID', 2)
    try:
        user_id = int(raw_id)
    except (TypeError, ValueError):
        user_id = 2
    return User.objects.filter(pk=user_id, is_active=True).first()


def _media_slug(media_type):
    return 'document' if media_type == 'TEXT' else media_type.lower()


def _actor_key_prefix(actor, media_type):
    return f"content/{_media_slug(media_type)}/{actor.id}/"


def _as_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, str):
        return value.lower() == 'true'
    return bool(value)


def _topic_for_actor(topic_id, actor):
    topic = Topic.objects.filter(pk=topic_id).first()
    if topic is None:
        return None, Response({'error': 'Tema no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
    if not topic.is_moderator_or_creator(actor):
        return None, Response(
            {'error': 'El usuario de Vincent no puede publicar en este tema.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    return topic, None


def _s3_client():
    return boto3.client(
        's3',
        region_name=getattr(settings, 'AWS_S3_REGION_NAME', 'us-west-2'),
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )


class VincentTopicUploadPresignView(APIView):
    """Presign an S3 upload for a topic Vincent is allowed to publish to."""

    authentication_classes = []
    permission_classes = [VincentMachinePermission]
    parser_classes = (JSONParser,)

    def post(self, request, pk):
        actor = vincent_actor_user()
        if actor is None:
            return Response(
                {'error': 'El usuario de Vincent no existe.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        topic, error_response = _topic_for_actor(pk, actor)
        if error_response is not None:
            return error_response
        if not getattr(settings, 'AWS_ACCESS_KEY_ID', None) or not getattr(settings, 'AWS_SECRET_ACCESS_KEY', None):
            return Response(
                {'error': 'S3 no esta configurado para subida directa'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        filename = request.data.get('filename')
        file_size = request.data.get('file_size')
        content_type = request.data.get('content_type') or 'application/octet-stream'
        media_type = request.data.get('media_type')
        if not filename or file_size is None:
            return Response(
                {'error': 'Se requieren filename y file_size'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if media_type not in VALID_MEDIA_TYPES:
            return Response(
                {'error': f'media_type invalido. Debe ser uno de: {", ".join(VALID_MEDIA_TYPES)}'},
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
        key = f"{_actor_key_prefix(actor, media_type)}{uuid.uuid4().hex}_{safe_name}"
        bucket = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', 'academiablockchain')
        try:
            upload_plan = _build_s3_upload_plan(
                s3_client=_s3_client(),
                bucket=bucket,
                key=key,
                content_type=content_type,
                file_size=file_size,
                expires_in=3600,
            )
        except Exception as exc:
            logger.exception('Vincent presign failed topic_id=%s: %s', topic.id, exc)
            return Response(
                {'error': 'No se pudo generar la URL de subida', 'details': str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        upload_plan['topic_id'] = topic.id
        return Response(upload_plan, status=status.HTTP_200_OK)


class VincentTopicUploadConfirmView(APIView):
    """Create content owned by the Vincent actor and attach it to the topic."""

    authentication_classes = []
    permission_classes = [VincentMachinePermission]
    parser_classes = (JSONParser,)

    def post(self, request, pk):
        actor = vincent_actor_user()
        if actor is None:
            return Response(
                {'error': 'El usuario de Vincent no existe.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        topic, error_response = _topic_for_actor(pk, actor)
        if error_response is not None:
            return error_response
        if not getattr(settings, 'AWS_ACCESS_KEY_ID', None):
            return Response(
                {'error': 'S3 no esta configurado'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        key = request.data.get('key')
        if not key or not isinstance(key, str) or not key.strip():
            return Response({'error': 'Se requiere key'}, status=status.HTTP_400_BAD_REQUEST)
        key = key.strip()
        if is_unsafe_s3_key(key):
            return Response({'error': 'key invalido'}, status=status.HTTP_400_BAD_REQUEST)

        media_type = request.data.get('media_type')
        if media_type not in VALID_MEDIA_TYPES:
            return Response(
                {'error': f'media_type invalido. Debe ser uno de: {", ".join(VALID_MEDIA_TYPES)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not key.startswith(_actor_key_prefix(actor, media_type)):
            return Response(
                {'error': 'key invalido para el usuario de Vincent'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing = FileDetails.objects.select_related('content').filter(file=key).first()
        if existing is not None:
            if existing.content.uploaded_by_id != actor.id:
                return Response(
                    {'error': 'Ese archivo ya pertenece a otro usuario.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            topic.contents.add(existing.content)
            profile = existing.content.profiles.filter(user=actor).first()
            return Response(
                {
                    'message': 'Content already uploaded',
                    'content_id': existing.content_id,
                    'content_profile_id': profile.id if profile else None,
                    'topic_id': topic.id,
                },
                status=status.HTTP_200_OK,
            )

        title = request.data.get('title') or key.split('/')[-1].split('_', 1)[-1]
        author = request.data.get('author')
        personal_note = request.data.get('personalNote')
        file_size = request.data.get('file_size')
        try:
            file_size = int(file_size) if file_size is not None else None
        except (TypeError, ValueError):
            file_size = None

        bucket = getattr(settings, 'AWS_STORAGE_BUCKET_NAME', 'academiablockchain')
        try:
            s3_client = _s3_client()
            complete_error = _complete_multipart_if_needed(s3_client, bucket, key, request.data)
            if complete_error is not None:
                return complete_error
            s3_client.head_object(Bucket=bucket, Key=key)
        except Exception as exc:
            logger.warning('Vincent confirm head_object failed key=%s error=%s', key, exc)
            return Response(
                {'error': 'El archivo no se encontro en el almacenamiento. Sube primero con la URL de subida.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        content = Content.objects.create(
            uploaded_by=actor,
            media_type=media_type,
            original_title=title,
            original_author=author,
            has_spanish_subtitles=_as_bool(request.data.get('has_spanish_subtitles')),
            has_spanish_dubbing=_as_bool(request.data.get('has_spanish_dubbing')),
        )
        profile = ContentProfile.objects.create(
            content=content,
            title=title,
            author=author,
            personal_note=personal_note,
            user=actor,
            is_visible=_as_bool(request.data.get('is_visible'), default=True),
            is_producer=_as_bool(request.data.get('is_producer')),
        )
        file_details = FileDetails.objects.create(content=content, file_size=file_size)
        FileDetails.objects.filter(pk=file_details.pk).update(file=key)
        topic.contents.add(content)
        return Response(
            {
                'message': 'Content uploaded successfully',
                'content_id': content.id,
                'content_profile_id': profile.id,
                'topic_id': topic.id,
            },
            status=status.HTTP_201_CREATED,
        )


def _complete_multipart_if_needed(s3_client, bucket, key, data):
    upload_id = data.get('upload_id')
    if not upload_id:
        return None
    if not isinstance(upload_id, str) or not upload_id.strip():
        return Response({'error': 'upload_id invalido'}, status=status.HTTP_400_BAD_REQUEST)
    multipart_parts = data.get('parts')
    if not isinstance(multipart_parts, list) or not multipart_parts:
        return Response(
            {'error': 'Se requieren parts para completar multipart upload'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    normalized_parts = []
    for part in multipart_parts:
        if not isinstance(part, dict):
            return Response({'error': 'parts invalido'}, status=status.HTTP_400_BAD_REQUEST)
        etag = part.get('etag')
        part_number = part.get('part_number')
        if etag is None or part_number is None:
            return Response(
                {'error': 'Cada part requiere etag y part_number'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            part_number = int(part_number)
        except (TypeError, ValueError):
            return Response({'error': 'part_number invalido'}, status=status.HTTP_400_BAD_REQUEST)
        normalized_parts.append({'ETag': str(etag), 'PartNumber': part_number})
    normalized_parts.sort(key=lambda part: part['PartNumber'])
    s3_client.complete_multipart_upload(
        Bucket=bucket,
        Key=key,
        UploadId=upload_id.strip(),
        MultipartUpload={'Parts': normalized_parts},
    )
    return None
