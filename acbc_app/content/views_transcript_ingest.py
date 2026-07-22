"""API endpoints for external async transcript extraction workers.

Contract (machine-to-machine, header ``X-Transcript-Ingest-Key`` or ``Authorization: Bearer``):

* ``GET  /api/content/transcript-ingest/``
  Work queue / topic manifest. Default: VIDEO/AUDIO without a transcript.
  Query params:
  - ``topic_id`` — only contents linked to this topic
  - ``media_type`` — ``VIDEO`` or ``AUDIO``
  - ``content_id`` — single content
  - ``include_completed`` — ``true``/``1`` to also return items that already have a transcript
  - ``limit`` / ``offset`` — pagination (default limit 100, max 500)

* ``GET  /api/content/transcript-ingest/<content_id>/``
  One-item manifest + transcript summary (if any).

* ``PUT  /api/content/transcript-ingest/<content_id>/``
  Idempotent upsert of transcript artifacts. Body may include any of
  ``parsed_plain``, ``processed_plain``, ``obsidian_markdown`` (at least one required),
  plus optional ``source_subtitles`` (SRT/VTT), ``format``, ``language``.

Queue items expose ``file_key`` (S3 object key) for workers with bucket credentials;
they do not return pre-signed download URLs.
"""
import logging

from django.core.exceptions import ValidationError
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from content.models import Content, ContentTranscript, Topic
from content.permissions import TranscriptIngestPermission
from content.serializers import (
    ContentTranscriptIngestSerializer,
    ContentTranscriptIngestSummarySerializer,
    ContentTranscriptQueueItemSerializer,
)

logger = logging.getLogger(__name__)

TRANSCRIPT_MEDIA_TYPES = ('VIDEO', 'AUDIO')
DEFAULT_QUEUE_LIMIT = 100
MAX_QUEUE_LIMIT = 500


def _parse_bool(value):
    if value is None:
        return False
    return str(value).strip().lower() in ('1', 'true', 'yes', 'on')


class TranscriptIngestAPIView(APIView):
    """Shared auth for machine-to-machine transcript ingest."""

    authentication_classes = []
    permission_classes = [TranscriptIngestPermission]


class ContentTranscriptIngestQueueView(TranscriptIngestAPIView):
    """
    GET /api/content/transcript-ingest/

    List video/audio content for an external transcript worker.
    Optional query params: topic_id, media_type, content_id, include_completed, limit, offset.
    """

    def get(self, request):
        media_type = request.query_params.get('media_type')
        if media_type and media_type not in TRANSCRIPT_MEDIA_TYPES:
            return Response(
                {'error': 'media_type debe ser VIDEO o AUDIO.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        topic_id = request.query_params.get('topic_id')
        if topic_id is not None:
            try:
                topic_id = int(topic_id)
            except (TypeError, ValueError):
                return Response(
                    {'error': 'topic_id debe ser un entero.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not Topic.objects.filter(pk=topic_id).exists():
                return Response(
                    {'error': f'No existe el tema {topic_id}.'},
                    status=status.HTTP_404_NOT_FOUND,
                )

        content_id = request.query_params.get('content_id')
        if content_id is not None:
            try:
                content_id = int(content_id)
            except (TypeError, ValueError):
                return Response(
                    {'error': 'content_id debe ser un entero.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            limit = int(request.query_params.get('limit', DEFAULT_QUEUE_LIMIT))
        except (TypeError, ValueError):
            return Response(
                {'error': 'limit debe ser un entero.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        limit = max(1, min(limit, MAX_QUEUE_LIMIT))

        try:
            offset = int(request.query_params.get('offset', 0))
        except (TypeError, ValueError):
            return Response(
                {'error': 'offset debe ser un entero.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        offset = max(0, offset)

        include_completed = _parse_bool(request.query_params.get('include_completed'))

        queryset = (
            Content.objects.filter(media_type__in=TRANSCRIPT_MEDIA_TYPES)
            .select_related('file_details', 'transcript')
            .order_by('id')
        )
        if not include_completed:
            queryset = queryset.filter(transcript__isnull=True)
        if media_type:
            queryset = queryset.filter(media_type=media_type)
        if topic_id is not None:
            queryset = queryset.filter(topics__id=topic_id).distinct()
        if content_id is not None:
            queryset = queryset.filter(pk=content_id)

        total = queryset.count()
        items = queryset[offset:offset + limit]
        serializer = ContentTranscriptQueueItemSerializer(items, many=True)

        return Response({
            'count': total,
            'limit': limit,
            'offset': offset,
            'include_completed': include_completed,
            'topic_id': topic_id,
            'items': serializer.data,
        })


class ContentTranscriptIngestDetailView(TranscriptIngestAPIView):
    """
    GET /api/content/transcript-ingest/<content_id>/
    Job metadata and current transcript status for one content item.

    PUT /api/content/transcript-ingest/<content_id>/
    Create or replace transcript for the content (idempotent upsert).
    """

    def _get_content(self, content_id):
        content = get_object_or_404(
            Content.objects.select_related('file_details', 'transcript'),
            pk=content_id,
        )
        if content.media_type not in TRANSCRIPT_MEDIA_TYPES:
            return None, Response(
                {
                    'error': (
                        f'El contenido {content_id} tiene media_type={content.media_type}. '
                        'Solo se admiten VIDEO y AUDIO.'
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return content, None

    def get(self, request, content_id):
        content, error_response = self._get_content(content_id)
        if error_response:
            return error_response

        queue_item = ContentTranscriptQueueItemSerializer(content).data
        transcript = getattr(content, 'transcript', None)
        transcript_data = (
            ContentTranscriptIngestSummarySerializer(transcript).data
            if transcript
            else None
        )

        return Response({
            'content': queue_item,
            'has_transcript': transcript is not None,
            'transcript': transcript_data,
        })

    def put(self, request, content_id):
        content, error_response = self._get_content(content_id)
        if error_response:
            return error_response

        serializer = ContentTranscriptIngestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        payload = serializer.validated_data
        existing = ContentTranscript.objects.filter(content=content).first()
        created = existing is None

        transcript = existing or ContentTranscript(content=content)
        transcript.parsed_plain = payload.get('parsed_plain', '')
        transcript.processed_plain = payload.get('processed_plain', '')
        transcript.obsidian_markdown = payload.get('obsidian_markdown', '')
        transcript.source_subtitles = payload.get('source_subtitles', '')
        transcript.format = payload.get('format', 'SRT')
        transcript.language = payload.get('language', '')

        try:
            transcript.save()
        except ValidationError as exc:
            return Response(exc.message_dict, status=status.HTTP_400_BAD_REQUEST)

        logger.info(
            'Transcript ingest %s for content_id=%s segments=%s',
            'created' if created else 'updated',
            content_id,
            len(transcript.segments or []),
        )

        return Response(
            {
                'content_id': content.id,
                'created': created,
                'transcript': ContentTranscriptIngestSummarySerializer(transcript).data,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
