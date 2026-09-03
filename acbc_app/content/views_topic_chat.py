"""Topic RAG consultations: independent Q&A (persisted), not multi-turn memory."""

from __future__ import annotations

import logging

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from content.models import ContentEmbedding, Topic, TopicChatQuery
from content.serializers import (
    TopicChatQueryListSerializer,
    TopicChatQuerySerializer,
    TopicChatRequestSerializer,
    TopicChatSourceSerializer,
)
from content.topic_access import user_has_topic_consultas_access
from content.topic_chat import TopicChatError, run_topic_chat, topic_chat_ready

logger = logging.getLogger(__name__)


def _get_viewable_topic(request, pk):
    topic = get_object_or_404(Topic, pk=pk)
    if not topic.can_be_viewed_by(request.user):
        return None, Response(
            {'error': 'Tema no encontrado'},
            status=status.HTTP_404_NOT_FOUND,
        )
    return topic, None


def _require_chat_enabled(topic):
    if not topic.chat_enabled:
        return Response(
            {
                'error': (
                    'Las consultas de este tema no están activadas. '
                    'Un moderador puede habilitarlas en la edición del tema.'
                ),
            },
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


def _indexed_contents_qs(topic):
    """VIDEO/AUDIO/TEXT in the topic with ContentEmbedding.status=indexed."""
    return (
        topic.contents.filter(
            media_type__in=('VIDEO', 'AUDIO', 'TEXT'),
            embedding__status=ContentEmbedding.STATUS_INDEXED,
        )
        .select_related('embedding')
        .order_by('original_title', 'id')
    )


def _serialize_chat_sources(queryset):
    rows = []
    for content in queryset:
        embedding = getattr(content, 'embedding', None)
        rows.append({
            'content_id': content.id,
            'title': content.original_title or f'Contenido {content.id}',
            'media_type': content.media_type or '',
            'original_author': content.original_author or '',
            'chunk_count': getattr(embedding, 'chunk_count', None),
            'embedded_at': getattr(embedding, 'embedded_at', None),
        })
    return TopicChatSourceSerializer(rows, many=True).data


def _resolve_selected_content_ids(topic, content_ids):
    """
    Validate optional content_ids against indexed contents in the topic.

    Returns (ordered_ids_or_None, error_response).
    None means "all indexed" (client omitted the field).
    """
    if content_ids is None:
        return None, None

    indexed_ids = set(_indexed_contents_qs(topic).values_list('id', flat=True))
    if not indexed_ids:
        return None, Response(
            {
                'error': (
                    'Este tema aún no tiene contenidos indexados '
                    'para consultas.'
                ),
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    invalid = [cid for cid in content_ids if cid not in indexed_ids]
    if invalid:
        return None, Response(
            {
                'error': (
                    'Algunos archivos no están disponibles para consultas en '
                    'este tema (deben pertenecer al tema y estar indexados).'
                ),
                'invalid_content_ids': invalid,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    return list(content_ids), None


def _require_consultas_access(user, topic):
    if user_has_topic_consultas_access(user, topic):
        return None
    return Response(
        {
            'error': 'Debes pagar para usar las consultas de este tema.',
            'code': 'topic_payment_required',
        },
        status=status.HTTP_403_FORBIDDEN,
    )


class TopicChatSourcesView(APIView):
    """
    GET /api/content/topics/<topic_id>/chat/sources/

    Indexed contents the user may select for a consultation.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        topic, error_response = _get_viewable_topic(request, pk)
        if error_response:
            return error_response

        disabled = _require_chat_enabled(topic)
        if disabled:
            return disabled
        unpaid = _require_consultas_access(request.user, topic)
        if unpaid:
            return unpaid

        qs = _indexed_contents_qs(topic)
        results = _serialize_chat_sources(qs)
        return Response({
            'count': len(results),
            'results': results,
        })


class TopicChatView(APIView):
    """
    POST /api/content/topics/<topic_id>/chat/

    Runs one independent RAG consultation (no conversational history to the LLM)
    and persists question + answer + sources for the authenticated user.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        topic, error_response = _get_viewable_topic(request, pk)
        if error_response:
            return error_response

        disabled = _require_chat_enabled(topic)
        if disabled:
            return disabled
        unpaid = _require_consultas_access(request.user, topic)
        if unpaid:
            return unpaid

        serializer = TopicChatRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        message = serializer.validated_data['message']
        content_ids = serializer.validated_data.get('content_ids')
        selected_ids, selection_error = _resolve_selected_content_ids(topic, content_ids)
        if selection_error:
            return selection_error

        ready, reason = topic_chat_ready()
        if not ready:
            return Response(
                {
                    'error': (
                        'El chat del tema no está disponible: falta configuración '
                        f'({reason})'
                    ),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            result = run_topic_chat(
                topic_id=topic.id,
                topic_title=topic.title or f'Tema {topic.id}',
                message=message,
                history=None,
                content_ids=selected_ids,
            )
        except TopicChatError as exc:
            return Response(
                {'error': str(exc)},
                status=exc.status_code,
            )

        query = TopicChatQuery.objects.create(
            topic=topic,
            user=request.user,
            question=message,
            answer=result.get('answer') or '',
            sources=result.get('sources') or [],
            retrieved_chunk_count=int(result.get('retrieved_chunk_count') or 0),
            used_chunk_count=int(result.get('used_chunk_count') or 0),
            selected_content_ids=selected_ids or [],
        )

        logger.info(
            'Topic chat query saved id=%s topic_id=%s user_id=%s sources=%s '
            'retrieved=%s used=%s selected_content_ids=%s',
            query.id,
            topic.id,
            request.user.id,
            len(query.sources or []),
            query.retrieved_chunk_count,
            query.used_chunk_count,
            selected_ids,
        )
        return Response(
            TopicChatQuerySerializer(query).data,
            status=status.HTTP_201_CREATED,
        )


class TopicChatQueryListView(APIView):
    """GET /api/content/topics/<topic_id>/chat/queries/ — current user's consultations."""

    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        topic, error_response = _get_viewable_topic(request, pk)
        if error_response:
            return error_response

        disabled = _require_chat_enabled(topic)
        if disabled:
            return disabled
        unpaid = _require_consultas_access(request.user, topic)
        if unpaid:
            return unpaid

        qs = TopicChatQuery.objects.filter(topic=topic, user=request.user)
        try:
            limit = int(request.query_params.get('limit', 50))
        except (TypeError, ValueError):
            return Response(
                {'error': 'limit debe ser un entero.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        limit = max(1, min(limit, 100))

        items = qs[:limit]
        return Response({
            'count': qs.count(),
            'limit': limit,
            'results': TopicChatQueryListSerializer(items, many=True).data,
        })


class TopicChatQueryDetailView(APIView):
    """GET /api/content/topics/<topic_id>/chat/queries/<query_id>/ — own consultation."""

    permission_classes = [IsAuthenticated]

    def get(self, request, pk, query_id):
        topic, error_response = _get_viewable_topic(request, pk)
        if error_response:
            return error_response

        disabled = _require_chat_enabled(topic)
        if disabled:
            return disabled
        unpaid = _require_consultas_access(request.user, topic)
        if unpaid:
            return unpaid

        query = TopicChatQuery.objects.filter(
            pk=query_id,
            topic=topic,
            user=request.user,
        ).first()
        if query is None:
            return Response(
                {'error': 'Consulta no encontrada'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(TopicChatQuerySerializer(query).data)
