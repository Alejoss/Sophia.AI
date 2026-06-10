"""API endpoints for external async transcript extraction workers."""
import logging

from django.core.exceptions import ValidationError
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from content.models import Content, ContentTranscript
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


class TranscriptIngestAPIView(APIView):
    """Shared auth for machine-to-machine transcript ingest."""

    authentication_classes = []
    permission_classes = [TranscriptIngestPermission]


class ContentTranscriptIngestQueueView(TranscriptIngestAPIView):
    """
    GET /api/content/transcript-ingest/

    List video/audio content that still has no transcript (work queue for external jobs).
    Optional query params: media_type, content_id, limit, offset.
    """

    def get(self, request):
        media_type = request.query_params.get('media_type')
        if media_type and media_type not in TRANSCRIPT_MEDIA_TYPES:
            return Response(
                {'error': 'media_type debe ser VIDEO o AUDIO.'},
                status=status.HTTP_400_BAD_REQUEST,
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

        queryset = (
            Content.objects.filter(media_type__in=TRANSCRIPT_MEDIA_TYPES)
            .exclude(transcript__isnull=False)
            .select_related('file_details')
            .order_by('id')
        )
        if media_type:
            queryset = queryset.filter(media_type=media_type)
        if content_id is not None:
            queryset = queryset.filter(pk=content_id)

        total = queryset.count()
        items = queryset[offset:offset + limit]
        serializer = ContentTranscriptQueueItemSerializer(items, many=True)

        return Response({
            'count': total,
            'limit': limit,
            'offset': offset,
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
