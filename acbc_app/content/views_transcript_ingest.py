"""API endpoints for transcript ingest (workers) and public transcript read.

Machine-to-machine ingest (header ``X-Transcript-Ingest-Key`` or ``Authorization: Bearer``):

* ``GET  /api/content/transcript-ingest/``
  Work queue / topic manifest. Default: VIDEO/AUDIO/TEXT without a transcript.
  Query params:
  - ``topic_id`` — only contents linked to this topic
  - ``media_type`` — ``VIDEO``, ``AUDIO``, or ``TEXT``
  - ``content_id`` — single content
  - ``include_completed`` — ``true``/``1`` to also return items that already have a transcript
  - ``funded_only`` — ``true``/``1`` to return only content with a paid transcript-generation request
  - ``limit`` / ``offset`` — pagination (default limit 100, max 500)

Paid generation requests (``generation_funded``) are ordered ahead of the rest of the
queue so a worker that polls the default list transcribes funded items first.

* ``GET  /api/content/transcript-ingest/<content_id>/``
  One-item manifest + transcript summary (if any).

* ``PUT  /api/content/transcript-ingest/<content_id>/``
  Idempotent upsert of transcript artifacts. Body may include any of
  ``parsed_plain``, ``processed_plain``, ``obsidian_markdown`` (at least one required),
  plus optional ``source_subtitles`` (SRT/VTT; A/V), ``format``, ``language``.

  TEXT/PDF extracts use the same ``ContentTranscript`` row as A/V (canonical plain
  text for embeddings and knowledge-path snapshots). Prefer ``format=PLAIN`` for
  PDF/text extracts.

* ``PUT  /api/content/transcript-ingest/<content_id>/text-hash/``
  Accept an externally computed ``text_hash`` (Vincent) after artifacts exist.
  Verifies the hash against ``plain_text`` (recommended on SQL_ASCII) or against
  stored artifacts, then locks ``text_hash`` + stores ``hash_plain_text`` for
  public verification display.

Queue items expose ``file_key`` (S3 object key) for workers with bucket credentials;
they do not return pre-signed download URLs.

User-facing read (JWT optional, same visibility as content detail GET):

* ``GET /api/content/content_details/<content_id>/transcript/``
  Full display text + optional timed segments for the content detail UI.
"""
import logging

from django.core.exceptions import ValidationError
from django.db.models import Exists, OuterRef
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from content.models import Content, ContentTranscript, Topic, TranscriptGenerationRequest
from content.permissions import TranscriptIngestPermission
from content.serializers import (
    ContentTranscriptIngestSerializer,
    ContentTranscriptIngestSummarySerializer,
    ContentTranscriptPublicSerializer,
    ContentTranscriptQueueItemSerializer,
    ContentTranscriptTextHashSerializer,
)
from content.transcript_utils import (
    compute_text_hash,
    normalize_plain_text_for_hash,
    resolve_hash_source_text,
)
from utils.db_encoding import is_sql_ascii_error

logger = logging.getLogger(__name__)

# Content is atomic: VIDEO/AUDIO/TEXT all store canonical plain text on
# ContentTranscript (Whisper/captions for A/V; PDF/text extract for TEXT).
TRANSCRIPT_MEDIA_TYPES = ('VIDEO', 'AUDIO', 'TEXT')
DEFAULT_QUEUE_LIMIT = 100
MAX_QUEUE_LIMIT = 500


def _parse_bool(value):
    if value is None:
        return False
    return str(value).strip().lower() in ('1', 'true', 'yes', 'on')


class ContentTranscriptPublicView(APIView):
    """
    GET /api/content/content_details/<content_id>/transcript/

    Returns the user-facing transcript for a content item, or 404 if none exists.

    Query ``summary=1`` returns metadata only (no text/segments) for detail-page
    teasers that link to the dedicated transcript page.
    """

    permission_classes = [AllowAny]

    def get(self, request, content_id):
        content = get_object_or_404(Content, pk=content_id)
        transcript = ContentTranscript.objects.filter(content=content).first()
        if transcript is None:
            return Response(
                {'error': 'Este contenido aún no tiene transcripción.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        if _parse_bool(request.query_params.get('summary')):
            return Response({
                'has_transcript': True,
                'language': transcript.language or '',
                'text_length': transcript.text_length,
                'segment_count': len(transcript.segments or []),
                'updated_at': transcript.updated_at,
            })
        return Response(ContentTranscriptPublicSerializer(transcript).data)


class TranscriptIngestAPIView(APIView):
    """Shared auth for machine-to-machine transcript ingest."""

    authentication_classes = []
    permission_classes = [TranscriptIngestPermission]


class ContentTranscriptIngestQueueView(TranscriptIngestAPIView):
    """
    GET /api/content/transcript-ingest/

    List VIDEO/AUDIO/TEXT content for an external transcript worker.
    Optional query params: topic_id, media_type, content_id, include_completed, limit, offset.
    """

    def get(self, request):
        media_type = request.query_params.get('media_type')
        if media_type and media_type not in TRANSCRIPT_MEDIA_TYPES:
            return Response(
                {'error': 'media_type debe ser VIDEO, AUDIO o TEXT.'},
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
        funded_only = _parse_bool(request.query_params.get('funded_only'))

        funded = TranscriptGenerationRequest.objects.filter(
            content_id=OuterRef('pk'),
            status=TranscriptGenerationRequest.STATUS_QUEUED,
        )
        queryset = (
            Content.objects.filter(media_type__in=TRANSCRIPT_MEDIA_TYPES)
            .select_related('file_details', 'transcript')
            .annotate(generation_funded=Exists(funded))
            .order_by('-generation_funded', 'id')
        )
        if not include_completed:
            queryset = queryset.filter(transcript__isnull=True)
        if media_type:
            queryset = queryset.filter(media_type=media_type)
        if topic_id is not None:
            queryset = queryset.filter(topics__id=topic_id).distinct()
        if content_id is not None:
            queryset = queryset.filter(pk=content_id)
        if funded_only:
            queryset = queryset.filter(generation_funded=True)

        total = queryset.count()
        items = queryset[offset:offset + limit]
        serializer = ContentTranscriptQueueItemSerializer(items, many=True)

        return Response({
            'count': total,
            'limit': limit,
            'offset': offset,
            'include_completed': include_completed,
            'funded_only': funded_only,
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
                        'Solo se admiten VIDEO, AUDIO y TEXT.'
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
        # Replacing artifacts invalidates any externally locked hash.
        transcript.text_hash_locked = False
        transcript.hash_plain_text = ''

        try:
            transcript.save()
        except ValidationError as exc:
            return Response(exc.message_dict, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            # Prefer UTF8 migration; ContentTranscript.save degrades on SQL_ASCII.
            # If something still slips through, return a clear machine-readable error.
            message = str(exc)
            if is_sql_ascii_error(exc):
                logger.exception(
                    'Transcript ingest blocked by PostgreSQL encoding content_id=%s',
                    content_id,
                )
                return Response(
                    {
                        'error': (
                            'La base de datos no soporta Unicode (SERVER_ENCODING=SQL_ASCII). '
                            'Migrar a UTF8: ./scripts/migrate-db-to-utf8.sh'
                        ),
                        'detail': message,
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            raise

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


class ContentTranscriptTextHashView(TranscriptIngestAPIView):
    """
    PUT /api/content/transcript-ingest/<content_id>/text-hash/

    Persist a SHA-256 computed by an external worker (Vincent) after the
    transcript artifacts already exist. Used when production Postgres is
    SQL_ASCII and Sophia's on-save hash would be of accent-stripped text.

    Body:
      - ``text_hash`` (required): 64-char hex SHA-256
      - ``plain_text`` (recommended): exact text that was hashed. Required when
        stored artifacts no longer match the worker digest (SQL_ASCII degrade).

    On success locks ``text_hash`` and stores normalized ``hash_plain_text`` so
    public pages show the string users can re-hash.
    """

    def put(self, request, content_id):
        content = get_object_or_404(
            Content.objects.select_related('transcript'),
            pk=content_id,
        )
        if content.media_type not in TRANSCRIPT_MEDIA_TYPES:
            return Response(
                {
                    'error': (
                        f'El contenido {content_id} tiene media_type={content.media_type}. '
                        'Solo se admiten VIDEO, AUDIO y TEXT.'
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        transcript = ContentTranscript.objects.filter(content=content).first()
        if transcript is None:
            return Response(
                {
                    'error': (
                        'Este contenido aún no tiene transcripción. '
                        'Envía primero PUT /transcript-ingest/<id>/ con los artefactos.'
                    ),
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = ContentTranscriptTextHashSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        text_hash = serializer.validated_data['text_hash']
        plain_text = serializer.validated_data.get('plain_text')

        if plain_text is not None:
            computed = compute_text_hash(plain_text)
            if computed != text_hash:
                return Response(
                    {
                        'error': (
                            'text_hash no coincide con SHA-256 del plain_text '
                            '(NFC + colapso de espacios en blanco).'
                        ),
                        'text_hash': text_hash,
                        'computed_text_hash': computed,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            normalized = normalize_plain_text_for_hash(plain_text)
        else:
            computed = compute_text_hash(resolve_hash_source_text(transcript))
            if computed != text_hash:
                return Response(
                    {
                        'error': (
                            'text_hash no coincide con el texto almacenado. '
                            'En SQL_ASCII los acentos pueden haberse degradado; '
                            'reenvía plain_text con el texto original hasheado en Vincent.'
                        ),
                        'text_hash': text_hash,
                        'computed_text_hash': computed,
                        'code': 'hash_mismatch_stored_text',
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            normalized = normalize_plain_text_for_hash(resolve_hash_source_text(transcript))

        if not normalized:
            return Response(
                {'error': 'El texto normalizado está vacío; no se puede guardar text_hash.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        transcript.text_hash = text_hash
        transcript.text_length = len(normalized)
        transcript.text_hash_locked = True
        transcript.hash_plain_text = normalized

        try:
            # Persist locked hash + hash_plain_text without recomputing hash.
            # Full save() still runs prepare_* on other text fields (no-op if
            # already degraded) and sync respects text_hash_locked.
            transcript.save()
        except Exception as exc:
            if is_sql_ascii_error(exc):
                logger.exception(
                    'External text-hash ingest blocked by PostgreSQL encoding '
                    'content_id=%s',
                    content_id,
                )
                return Response(
                    {
                        'error': (
                            'La base de datos no soporta Unicode (SERVER_ENCODING=SQL_ASCII) '
                            'al guardar hash_plain_text. Migrar a UTF8: '
                            './scripts/migrate-db-to-utf8.sh'
                        ),
                        'detail': str(exc),
                        'code': 'sql_ascii_blocked',
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            raise

        logger.info(
            'External text_hash locked for content_id=%s text_hash=%s…',
            content_id,
            text_hash[:12],
        )

        return Response(
            {
                'content_id': content.id,
                'text_hash': transcript.text_hash,
                'text_length': transcript.text_length,
                'text_hash_locked': transcript.text_hash_locked,
                'has_hash_plain_text': bool((transcript.hash_plain_text or '').strip()),
                'transcript': ContentTranscriptIngestSummarySerializer(transcript).data,
            },
            status=status.HTTP_200_OK,
        )
