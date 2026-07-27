"""API endpoints for embedding ingest (external embed workers).

Machine-to-machine (same auth as transcript-ingest: ``X-Transcript-Ingest-Key``
or ``Authorization: Bearer`` with ``TRANSCRIPT_INGEST_API_KEY``):

* ``GET  /api/content/embedding-ingest/``
  Work queue of VIDEO/AUDIO contents that already have a transcript and whose
  ``embedding_status`` needs work (default: ``pending``, ``stale``, ``failed``).

* ``GET  /api/content/embedding-ingest/<content_id>/``
  One-item manifest + embedding metadata.

* ``PUT  /api/content/embedding-ingest/<content_id>/``
  Ack from the embed worker after indexing (or failure/skip). Does **not**
  store vectors in Django -- only updates ``ContentTranscript`` bookkeeping.
"""

from __future__ import annotations
import logging
from datetime import datetime, timezone

from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from content.models import Content, ContentTranscript, Topic
from content.permissions import TranscriptIngestPermission
from content.serializers import (
    ContentEmbeddingAckSerializer,
    ContentEmbeddingQueueItemSerializer,
    ContentTranscriptIngestSummarySerializer,
)
from content.views_transcript_ingest import (
    DEFAULT_QUEUE_LIMIT,
    MAX_QUEUE_LIMIT,
    TRANSCRIPT_MEDIA_TYPES,
    _parse_bool,
)

logger = logging.getLogger(__name__)

DEFAULT_NEEDING_STATUSES = (
    ContentTranscript.EMBEDDING_STATUS_PENDING,
    ContentTranscript.EMBEDDING_STATUS_STALE,
    ContentTranscript.EMBEDDING_STATUS_FAILED,
)
ALL_EMBEDDING_STATUSES = {
    choice[0] for choice in ContentTranscript.EMBEDDING_STATUS_CHOICES
}


class EmbeddingIngestAPIView(APIView):
    """Shared auth for machine-to-machine embedding ingest (reuses transcript key)."""

    authentication_classes = []
    permission_classes = [TranscriptIngestPermission]


def _parse_status_filter(raw: str | None) -> list[str] | None:
    if raw is None or not str(raw).strip():
        return None
    statuses = []
    for part in str(raw).split(','):
        value = part.strip().lower()
        if not value:
            continue
        if value not in ALL_EMBEDDING_STATUSES:
            return None
        if value not in statuses:
            statuses.append(value)
    return statuses or None


class ContentEmbeddingIngestQueueView(EmbeddingIngestAPIView):
    """
    GET /api/content/embedding-ingest/

    List VIDEO/AUDIO contents with a transcript that need (or already have)
    vector indexing metadata updated.
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
        status_filter = _parse_status_filter(request.query_params.get('status'))
        if request.query_params.get('status') is not None and status_filter is None:
            return Response(
                {
                    'error': (
                        'status inválido. Use una lista separada por comas de: '
                        + ', '.join(sorted(ALL_EMBEDDING_STATUSES))
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if status_filter is not None:
            statuses = status_filter
        elif include_completed:
            statuses = sorted(ALL_EMBEDDING_STATUSES)
        else:
            statuses = list(DEFAULT_NEEDING_STATUSES)

        queryset = (
            Content.objects.filter(
                media_type__in=TRANSCRIPT_MEDIA_TYPES,
                transcript__isnull=False,
                transcript__embedding_status__in=statuses,
            )
            .select_related('file_details', 'transcript')
            .order_by('id')
        )
        if media_type:
            queryset = queryset.filter(media_type=media_type)
        if topic_id is not None:
            queryset = queryset.filter(topics__id=topic_id).distinct()
        if content_id is not None:
            queryset = queryset.filter(pk=content_id)

        total = queryset.count()
        items = queryset[offset:offset + limit]
        serializer = ContentEmbeddingQueueItemSerializer(items, many=True)

        return Response({
            'count': total,
            'limit': limit,
            'offset': offset,
            'include_completed': include_completed,
            'status_filter': statuses,
            'topic_id': topic_id,
            'items': serializer.data,
        })


class ContentEmbeddingIngestDetailView(EmbeddingIngestAPIView):
    """
    GET /api/content/embedding-ingest/<content_id>/
    Job metadata and current embedding status for one content item.

    PUT /api/content/embedding-ingest/<content_id>/
    Ack indexing result (indexed / failed / skipped). No vectors stored here.
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
        try:
            transcript = content.transcript
        except ContentTranscript.DoesNotExist:
            transcript = None
        if transcript is None:
            return None, Response(
                {
                    'error': (
                        f'El contenido {content_id} no tiene transcript. '
                        'Transcribe primero vía /api/content/transcript-ingest/.'
                    ),
                },
                status=status.HTTP_409_CONFLICT,
            )
        return content, None

    def get(self, request, content_id):
        content, error_response = self._get_content(content_id)
        if error_response:
            return error_response

        return Response({
            'content': ContentEmbeddingQueueItemSerializer(content).data,
            'has_transcript': True,
            'transcript': ContentTranscriptIngestSummarySerializer(content.transcript).data,
        })

    def put(self, request, content_id):
        content, error_response = self._get_content(content_id)
        if error_response:
            return error_response

        serializer = ContentEmbeddingAckSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        payload = serializer.validated_data
        transcript = content.transcript
        ack_status = payload['status']

        if ack_status == ContentTranscript.EMBEDDING_STATUS_INDEXED:
            current_hash = (transcript.text_hash or '').strip()
            if not current_hash:
                return Response(
                    {
                        'error': (
                            'El transcript no tiene text_hash; no se puede marcar indexed.'
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            ack_hash = (payload.get('embedded_text_hash') or '').strip() or current_hash
            if ack_hash != current_hash:
                return Response(
                    {
                        'error': (
                            'embedded_text_hash no coincide con text_hash actual del transcript. '
                            'Re-embebe el texto vigente o omite el campo para usar el hash actual.'
                        ),
                        'text_hash': current_hash,
                        'embedded_text_hash': ack_hash,
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            transcript.embedding_status = ContentTranscript.EMBEDDING_STATUS_INDEXED
            transcript.embedded_text_hash = current_hash
            transcript.embedding_model = payload.get('embedding_model') or ''
            transcript.embedding_dims = payload.get('embedding_dims')
            transcript.chunk_count = payload.get('chunk_count')
            transcript.embedding_error = ''
            embedded_at = payload.get('embedded_at')
            if embedded_at:
                if isinstance(embedded_at, str):
                    parsed = parse_datetime(embedded_at)
                    transcript.embedded_at = parsed or datetime.now(timezone.utc)
                else:
                    transcript.embedded_at = embedded_at
            else:
                transcript.embedded_at = datetime.now(timezone.utc)

        elif ack_status == ContentTranscript.EMBEDDING_STATUS_FAILED:
            transcript.embedding_status = ContentTranscript.EMBEDDING_STATUS_FAILED
            transcript.embedding_error = (payload.get('embedding_error') or '').strip()
            if payload.get('embedding_model'):
                transcript.embedding_model = payload['embedding_model']
            if payload.get('embedding_dims') is not None:
                transcript.embedding_dims = payload['embedding_dims']

        else:  # skipped
            transcript.embedding_status = ContentTranscript.EMBEDDING_STATUS_SKIPPED
            transcript.embedding_error = (payload.get('embedding_error') or '').strip()
            if payload.get('embedding_model'):
                transcript.embedding_model = payload['embedding_model']

        # Persist via QuerySet.update to avoid ContentTranscript.save() re-running
        # sync_embedding_status_for_text_hash, which would overwrite an explicit ack.
        update_fields = {
            'embedding_status': transcript.embedding_status,
            'embedded_text_hash': transcript.embedded_text_hash,
            'embedding_model': transcript.embedding_model,
            'embedding_dims': transcript.embedding_dims,
            'chunk_count': transcript.chunk_count,
            'embedded_at': transcript.embedded_at,
            'embedding_error': transcript.embedding_error,
            'updated_at': datetime.now(timezone.utc),
        }
        ContentTranscript.objects.filter(pk=transcript.pk).update(**update_fields)
        transcript.refresh_from_db()

        logger.info(
            'Embedding ingest ack status=%s content_id=%s model=%s chunks=%s',
            ack_status,
            content_id,
            transcript.embedding_model or '-',
            transcript.chunk_count,
        )

        return Response({
            'content_id': content.id,
            'transcript': ContentTranscriptIngestSummarySerializer(transcript).data,
        })
