"""POST /api/content/topics/<topic_id>/chat/ — RAG chat over topic transcripts."""

from __future__ import annotations

import logging

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from content.models import Topic
from content.serializers import TopicChatRequestSerializer
from content.topic_chat import TopicChatError, run_topic_chat, topic_chat_ready

logger = logging.getLogger(__name__)


class TopicChatView(APIView):
    """
    Authenticated topic RAG chat.

    Embeds the user message, retrieves Qdrant chunks filtered by topic_id,
    and asks OpenAI to answer strictly from that context.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        topic = get_object_or_404(Topic, pk=pk)
        if not topic.can_be_viewed_by(request.user):
            return Response(
                {'error': 'Tema no encontrado'},
                status=status.HTTP_404_NOT_FOUND,
            )

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
        history = serializer.validated_data.get('history') or []

        try:
            result = run_topic_chat(
                topic_id=topic.id,
                topic_title=topic.title or f'Tema {topic.id}',
                message=message,
                history=history,
            )
        except TopicChatError as exc:
            return Response(
                {'error': str(exc)},
                status=exc.status_code,
            )

        logger.info(
            'Topic chat ok topic_id=%s user_id=%s sources=%s',
            topic.id,
            request.user.id,
            len(result.get('sources') or []),
        )
        return Response(result, status=status.HTTP_200_OK)
