"""Topic RAG consultations: independent Q&A (persisted), not multi-turn memory."""

from __future__ import annotations

import logging

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from content.models import Topic, TopicChatQuery
from content.serializers import (
    TopicChatQueryListSerializer,
    TopicChatQuerySerializer,
    TopicChatRequestSerializer,
)
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

        serializer = TopicChatRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        message = serializer.validated_data['message']

        try:
            result = run_topic_chat(
                topic_id=topic.id,
                topic_title=topic.title or f'Tema {topic.id}',
                message=message,
                history=None,
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
        )

        logger.info(
            'Topic chat query saved id=%s topic_id=%s user_id=%s sources=%s',
            query.id,
            topic.id,
            request.user.id,
            len(query.sources or []),
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
