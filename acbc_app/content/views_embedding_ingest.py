"""API endpoints for embedding ingest (external embed workers).

Machine-to-machine (same auth as transcript-ingest: ``X-Transcript-Ingest-Key``
or ``Authorization: Bearer`` with ``TRANSCRIPT_INGEST_API_KEY``):

* ``GET  /api/content/embedding-ingest/``
  Work queue of VIDEO/AUDIO/TEXT contents whose ``ContentEmbedding.status``
  needs work (default: ``pending``, ``stale``, ``failed``). VIDEO/AUDIO require
  a transcript; TEXT is queued by embedding status alone (worker reads the file).

* ``GET  /api/content/embedding-ingest/topics/``
  Topics that have at least one content matching the embedding status filter
  (same defaults as the content queue).

* ``GET  /api/content/embedding-ingest/<content_id>/``
  One-item manifest + embedding metadata.

* ``PUT  /api/content/embedding-ingest/<content_id>/``
  Ack from the embed worker after indexing (or failure/skip). Does **not**
  store vectors in Django -- only updates ``ContentEmbedding`` bookkeeping.
"""

from __future__ import annotations
import logging
from datetime import datetime, timezone

from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from content.models import Content, ContentEmbedding, ContentTranscript, Topic
from content.permissions import TranscriptIngestPermission
from content.serializers import (
    ContentEmbeddingAckSerializer,
    ContentEmbeddingIngestDetailSerializer,
    ContentEmbeddingQueueItemSerializer,
    ContentEmbeddingTopicQueueItemSerializer,
)
from content.views_transcript_ingest import (
    DEFAULT_QUEUE_LIMIT,
    MAX_QUEUE_LIMIT,
    TRANSCRIPT_MEDIA_TYPES,
    _parse_bool,
)

logger = logging.getLogger(__name__)

EMBEDDING_MEDIA_TYPES = TRANSCRIPT_MEDIA_TYPES + ('TEXT',)

DEFAULT_NEEDING_STATUSES = (
    ContentEmbedding.EMBEDDING_STATUS_PENDING,
    ContentEmbedding.EMBEDDING_STATUS_STALE,
    ContentEmbedding.EMBEDDING_STATUS_FAILED,
)
ALL_EMBEDDING_STATUSES = {
    choice[0] for choice in ContentEmbedding.EMBEDDING_STATUS_CHOICES
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


def _parse_embedding_queue_params(request):
    """Parse shared embedding-queue query params.

    Returns ``(error_response, params)``. ``params`` is None when there is an error.
    """
    media_type = request.query_params.get('media_type')
    if media_type and media_type not in EMBEDDING_MEDIA_TYPES:
        return Response(
            {'error': 'media_type debe ser VIDEO, AUDIO o TEXT.'},
            status=status.HTTP_400_BAD_REQUEST,
        ), None

    topic_id = request.query_params.get('topic_id')
    if topic_id is not None:
        try:
            topic_id = int(topic_id)
        except (TypeError, ValueError):
            return Response(
                {'error': 'topic_id debe ser un entero.'},
                status=status.HTTP_400_BAD_REQUEST,
            ), None
        if not Topic.objects.filter(pk=topic_id).exists():
            return Response(
                {'error': f'No existe el tema {topic_id}.'},
                status=status.HTTP_404_NOT_FOUND,
            ), None

    content_id = request.query_params.get('content_id')
    if content_id is not None:
        try:
            content_id = int(content_id)
        except (TypeError, ValueError):
            return Response(
                {'error': 'content_id debe ser un entero.'},
                status=status.HTTP_400_BAD_REQUEST,
            ), None

    try:
        limit = int(request.query_params.get('limit', DEFAULT_QUEUE_LIMIT))
    except (TypeError, ValueError):
        return Response(
            {'error': 'limit debe ser un entero.'},
            status=status.HTTP_400_BAD_REQUEST,
        ), None
    limit = max(1, min(limit, MAX_QUEUE_LIMIT))

    try:
        offset = int(request.query_params.get('offset', 0))
    except (TypeError, ValueError):
        return Response(
            {'error': 'offset debe ser un entero.'},
            status=status.HTTP_400_BAD_REQUEST,
        ), None
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
        ), None

    if status_filter is not None:
        statuses = status_filter
    elif include_completed:
        statuses = sorted(ALL_EMBEDDING_STATUSES)
    else:
        statuses = list(DEFAULT_NEEDING_STATUSES)

    return None, {
        'media_type': media_type,
        'topic_id': topic_id,
        'content_id': content_id,
        'limit': limit,
        'offset': offset,
        'include_completed': include_completed,
        'statuses': statuses,
    }


def _topic_media_types(media_type):
    if media_type:
        return (media_type,)
    return EMBEDDING_MEDIA_TYPES


def _embedding_queue_filter(*, statuses):
    """VIDEO/AUDIO need a transcript; TEXT is queued by embedding status only."""
    return Q(
        media_type__in=EMBEDDING_MEDIA_TYPES,
        embedding__status__in=statuses,
    ) & (
        Q(media_type='TEXT')
        | Q(transcript__isnull=False)
    )


def _embedding_ack_response(embedding):
    """Map ContentEmbedding fields to legacy API names for worker back-compat."""
    return {
        'embedding_status': embedding.status,
        'embedding_model': embedding.model or '',
        'embedding_dims': embedding.dims,
        'chunk_count': embedding.chunk_count,
        'embedded_text_hash': embedding.source_hash,
        'embedded_at': embedding.embedded_at,
        'embedding_error': embedding.error or '',
    }


class ContentEmbeddingIngestQueueView(EmbeddingIngestAPIView):
    """
    GET /api/content/embedding-ingest/

    List VIDEO/AUDIO/TEXT contents that need (or already have) vector indexing
    metadata updated on ContentEmbedding.
    """

    def get(self, request):
        error, params = _parse_embedding_queue_params(request)
        if error:
            return error

        media_type = params['media_type']
        topic_id = params['topic_id']
        content_id = params['content_id']
        limit = params['limit']
        offset = params['offset']
        include_completed = params['include_completed']
        statuses = params['statuses']

        queryset = (
            Content.objects.filter(_embedding_queue_filter(statuses=statuses))
            .select_related('file_details', 'transcript', 'embedding')
            .prefetch_related('topics')
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


class ContentEmbeddingIngestTopicQueueView(EmbeddingIngestAPIView):
    """
    GET /api/content/embedding-ingest/topics/

    List topics that have contents matching the embedding status filter.
    Default statuses: pending, stale, failed.

    Use this to discover which topics need embed work, then fetch content with
    ``GET /embedding-ingest/?topic_id=<id>``.
    """

    def get(self, request):
        error, params = _parse_embedding_queue_params(request)
        if error:
            return error

        media_type = params['media_type']
        topic_id = params['topic_id']
        limit = params['limit']
        offset = params['offset']
        include_completed = params['include_completed']
        statuses = params['statuses']
        media_types = _topic_media_types(media_type)

        av_transcript_ok = Q(contents__media_type='TEXT') | Q(
            contents__transcript__isnull=False,
        )

        def _count_for(*status_values):
            return Count(
                'contents',
                filter=Q(
                    contents__media_type__in=media_types,
                    contents__embedding__status__in=status_values,
                ) & av_transcript_ok,
                distinct=True,
            )

        queryset = (
            Topic.objects.annotate(
                matching_count=_count_for(*statuses),
                pending_count=_count_for(ContentEmbedding.EMBEDDING_STATUS_PENDING),
                stale_count=_count_for(ContentEmbedding.EMBEDDING_STATUS_STALE),
                failed_count=_count_for(ContentEmbedding.EMBEDDING_STATUS_FAILED),
                indexed_count=_count_for(ContentEmbedding.EMBEDDING_STATUS_INDEXED),
                skipped_count=_count_for(ContentEmbedding.EMBEDDING_STATUS_SKIPPED),
            )
            .filter(matching_count__gt=0)
            .order_by('-matching_count', 'id')
        )
        if topic_id is not None:
            queryset = queryset.filter(pk=topic_id)

        total = queryset.count()
        items = queryset[offset:offset + limit]
        serializer = ContentEmbeddingTopicQueueItemSerializer(items, many=True)

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
            Content.objects.select_related('file_details', 'transcript', 'embedding')
            .prefetch_related('topics'),
            pk=content_id,
        )
        if content.media_type not in EMBEDDING_MEDIA_TYPES:
            return None, Response(
                {
                    'error': (
                        f'El contenido {content_id} tiene media_type={content.media_type}. '
                        'Solo se admiten VIDEO, AUDIO y TEXT.'
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if content.media_type in TRANSCRIPT_MEDIA_TYPES:
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

        has_transcript = False
        transcript_data = None
        try:
            transcript = content.transcript
            has_transcript = True
            transcript_data = ContentEmbeddingIngestDetailSerializer(transcript).data
        except ContentTranscript.DoesNotExist:
            pass

        return Response({
            'content': ContentEmbeddingQueueItemSerializer(content).data,
            'has_transcript': has_transcript,
            'transcript': transcript_data,
        })

    def put(self, request, content_id):
        content, error_response = self._get_content(content_id)
        if error_response:
            return error_response

        serializer = ContentEmbeddingAckSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        payload = serializer.validated_data
        embedding, _ = ContentEmbedding.objects.get_or_create(
            content=content,
            defaults={'status': ContentEmbedding.STATUS_PENDING},
        )
        ack_status = payload['status']
        now = datetime.now(timezone.utc)

        if ack_status == ContentEmbedding.EMBEDDING_STATUS_INDEXED:
            if content.media_type in TRANSCRIPT_MEDIA_TYPES:
                transcript = content.transcript
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
                ack_hash = (
                    payload.get('source_hash')
                    or payload.get('embedded_text_hash')
                    or ''
                ).strip() or current_hash
                if ack_hash != current_hash:
                    return Response(
                        {
                            'error': (
                                'embedded_text_hash no coincide con text_hash actual del '
                                'transcript. Re-embebe el texto vigente o omite el campo '
                                'para usar el hash actual.'
                            ),
                            'text_hash': current_hash,
                            'embedded_text_hash': ack_hash,
                        },
                        status=status.HTTP_409_CONFLICT,
                    )
                source_hash = current_hash
            else:
                source_hash = (
                    payload.get('source_hash')
                    or payload.get('embedded_text_hash')
                    or ''
                ).strip()
                if not source_hash:
                    return Response(
                        {
                            'error': (
                                'source_hash (o embedded_text_hash) es requerido cuando '
                                'status=indexed para contenido TEXT.'
                            ),
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            embedded_at = payload.get('embedded_at')
            if embedded_at:
                if isinstance(embedded_at, str):
                    parsed = parse_datetime(embedded_at)
                    embedded_at = parsed or now
            else:
                embedded_at = now

            update_fields = {
                'status': ContentEmbedding.STATUS_INDEXED,
                'source_hash': source_hash,
                'model': payload.get('embedding_model') or '',
                'dims': payload.get('embedding_dims'),
                'chunk_count': payload.get('chunk_count'),
                'error': '',
                'embedded_at': embedded_at,
                'updated_at': now,
            }

        elif ack_status == ContentEmbedding.EMBEDDING_STATUS_FAILED:
            update_fields = {
                'status': ContentEmbedding.STATUS_FAILED,
                'error': (payload.get('embedding_error') or '').strip(),
                'updated_at': now,
            }
            if payload.get('embedding_model'):
                update_fields['model'] = payload['embedding_model']
            if payload.get('embedding_dims') is not None:
                update_fields['dims'] = payload['embedding_dims']

        else:  # skipped
            update_fields = {
                'status': ContentEmbedding.STATUS_SKIPPED,
                'error': (payload.get('embedding_error') or '').strip(),
                'updated_at': now,
            }
            if payload.get('embedding_model'):
                update_fields['model'] = payload['embedding_model']

        ContentEmbedding.objects.filter(pk=embedding.pk).update(**update_fields)
        embedding.refresh_from_db()

        logger.info(
            'Embedding ingest ack status=%s content_id=%s model=%s chunks=%s',
            ack_status,
            content_id,
            embedding.model or '-',
            embedding.chunk_count,
        )

        return Response({
            'content_id': content.id,
            'embedding': _embedding_ack_response(embedding),
        })
