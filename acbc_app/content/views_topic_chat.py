"""Topic RAG consultations: independent Q&A (persisted), not multi-turn memory."""

from __future__ import annotations

import logging

from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from django.db.models import Exists, IntegerField, OuterRef, Subquery, Value
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from content.models import ContentEmbedding, Topic, TopicChatPin, TopicChatQuery
from content.serializers import (
    TopicChatPinRequestSerializer,
    TopicChatPublicQuerySerializer,
    TopicChatQueryListSerializer,
    TopicChatQuerySerializer,
    TopicChatRequestSerializer,
    TopicChatSourceSerializer,
)
from votes.models import Vote, VoteCount
from content.topic_access import user_has_topic_consultas_access
from content.topic_chat import TopicChatError, run_topic_chat, topic_chat_ready
from content.topic_chat_quota import daily_quota_exceeded_payload, daily_quota_payload

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
    Validate the consultation's content id against indexed contents in the topic.

    Returns (ordered_ids_or_None, error_response).
    None means "all indexed" and is only kept for callers that omit the field.
    The public API requires exactly one id.
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
        content_ids = serializer.validated_data['content_ids']
        selected_ids, selection_error = _resolve_selected_content_ids(topic, content_ids)
        if selection_error:
            return selection_error

        # Enforce free-tier daily cap before OpenAI/Qdrant spend.
        quota_error = daily_quota_exceeded_payload(request.user)
        if quota_error:
            return Response(
                quota_error,
                status=status.HTTP_429_TOO_MANY_REQUESTS,
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
            {
                **TopicChatQuerySerializer(query).data,
                **daily_quota_payload(request.user),
            },
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

        qs = (
            TopicChatQuery.objects.filter(topic=topic, user=request.user)
            .prefetch_related('pins')
        )
        try:
            limit = int(request.query_params.get('limit', 50))
        except (TypeError, ValueError):
            return Response(
                {'error': 'limit debe ser un entero.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        limit = max(1, min(limit, 100))

        items = qs[:limit]
        payload = {
            'count': qs.count(),
            'limit': limit,
            'results': TopicChatQueryListSerializer(items, many=True).data,
        }
        payload.update(daily_quota_payload(request.user))
        return Response(payload)


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

        query = (
            TopicChatQuery.objects.filter(
                pk=query_id,
                topic=topic,
                user=request.user,
            )
            .prefetch_related('pins')
            .first()
        )
        if query is None:
            return Response(
                {'error': 'Consulta no encontrada'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(TopicChatQuerySerializer(query).data)


def _can_unpin(user, query):
    if user is None or not user.is_authenticated:
        return False
    if query.user_id == user.id or user.is_staff:
        return True
    return query.topic.is_moderator_or_creator(user)


def _eligible_pin_content_ids(topic, query):
    """Indexed texts this consultation is allowed to be pinned to."""
    indexed_ids = set(_indexed_contents_qs(topic).values_list('id', flat=True))
    selected = list(query.selected_content_ids or [])
    if selected:
        return indexed_ids.intersection(selected)
    return indexed_ids


def _parse_optional_content_id(request):
    raw = request.query_params.get('content_id')
    if raw is None or raw == '':
        return None, None
    try:
        content_id = int(raw)
    except (TypeError, ValueError):
        return None, Response(
            {'error': 'content_id debe ser un entero.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if content_id < 1:
        return None, Response(
            {'error': 'content_id debe ser un entero.'},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return content_id, None


def _public_queries(topic, user, content_id=None):
    """Pinned consultations with vote score and the viewer's own vote."""
    pin_exists = TopicChatPin.objects.filter(query_id=OuterRef('pk'))
    if content_id is not None:
        pin_exists = pin_exists.filter(content_id=content_id)
    first_pin = (
        TopicChatPin.objects.filter(query_id=OuterRef('pk'))
        .order_by('pinned_at')
        .values('pinned_at')[:1]
    )
    content_type = ContentType.objects.get_for_model(TopicChatQuery)
    vote_count_sq = VoteCount.objects.filter(
        content_type=content_type,
        object_id=OuterRef('pk'),
        topic_id=OuterRef('topic_id'),
    ).values('vote_count')[:1]
    if user is not None and user.is_authenticated:
        user_vote_expr = Coalesce(
            Subquery(
                Vote.objects.filter(
                    content_type=content_type,
                    object_id=OuterRef('pk'),
                    topic_id=OuterRef('topic_id'),
                    user_id=user.id,
                ).values('value')[:1],
                output_field=IntegerField(),
            ),
            Value(0),
        )
    else:
        user_vote_expr = Value(0, output_field=IntegerField())

    return (
        TopicChatQuery.objects.filter(topic=topic)
        .filter(Exists(pin_exists))
        .annotate(
            pinned_at=Subquery(first_pin),
            vote_count=Coalesce(
                Subquery(vote_count_sq, output_field=IntegerField()),
                Value(0),
            ),
            user_vote=user_vote_expr,
        )
        .select_related('user', 'topic')
        .prefetch_related('pins', 'topic__moderators')
        .order_by('-vote_count', '-pinned_at', '-id')
    )


def _serialize_public(request, queries):
    return TopicChatPublicQuerySerializer(
        queries,
        many=True,
        context={'request': request},
    ).data


class TopicChatPublicListView(APIView):
    """GET pinned consultations for a topic. Reading does not require purchase."""

    permission_classes = [AllowAny]

    def get(self, request, pk):
        topic, error_response = _get_viewable_topic(request, pk)
        if error_response:
            return error_response
        disabled = _require_chat_enabled(topic)
        if disabled:
            return disabled

        content_id, error_response = _parse_optional_content_id(request)
        if error_response:
            return error_response

        try:
            limit = int(request.query_params.get('limit', 50))
        except (TypeError, ValueError):
            return Response(
                {'error': 'limit debe ser un entero.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        limit = max(1, min(limit, 100))

        qs = _public_queries(topic, request.user, content_id=content_id)
        total = qs.count()
        items = list(qs[:limit])
        return Response({
            'count': total,
            'limit': limit,
            'results': _serialize_public(request, items),
        })


class TopicChatPublicDetailView(APIView):
    """GET one pinned consultation. 404 while it has no pins."""

    permission_classes = [AllowAny]

    def get(self, request, pk, query_id):
        topic, error_response = _get_viewable_topic(request, pk)
        if error_response:
            return error_response
        disabled = _require_chat_enabled(topic)
        if disabled:
            return disabled

        query = _public_queries(topic, request.user).filter(pk=query_id).first()
        if query is None:
            return Response(
                {'error': 'Consulta no encontrada'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(
            TopicChatPublicQuerySerializer(
                query,
                context={'request': request},
            ).data
        )


class TopicChatQueryPinView(APIView):
    """Author pins a consultation onto texts. Author or moderator can unpin."""

    permission_classes = [IsAuthenticated]

    def _owned_query(self, request, topic, query_id):
        return (
            TopicChatQuery.objects.filter(
                pk=query_id,
                topic=topic,
                user=request.user,
            )
            .prefetch_related('pins')
            .first()
        )

    def post(self, request, pk, query_id):
        topic, error_response = _get_viewable_topic(request, pk)
        if error_response:
            return error_response
        disabled = _require_chat_enabled(topic)
        if disabled:
            return disabled

        query = self._owned_query(request, topic, query_id)
        if query is None:
            return Response(
                {'error': 'Consulta no encontrada'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = TopicChatPinRequestSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        content_ids = serializer.validated_data['content_ids']
        eligible = _eligible_pin_content_ids(topic, query)
        invalid = [cid for cid in content_ids if cid not in eligible]
        if invalid:
            return Response(
                {
                    'error': (
                        'Solo puedes fijar la consulta en textos indexados '
                        'que formaron parte de esta consulta.'
                    ),
                    'invalid_content_ids': invalid,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        desired = set(content_ids)
        with transaction.atomic():
            existing = {
                pin.content_id: pin
                for pin in query.pins.select_for_update()
            }
            for content_id, pin in existing.items():
                if content_id not in desired:
                    pin.delete()
            for content_id in content_ids:
                if content_id not in existing:
                    TopicChatPin.objects.create(
                        query=query,
                        content_id=content_id,
                        pinned_by=request.user,
                    )

        published = _public_queries(topic, request.user).filter(pk=query.pk).first()
        return Response(
            TopicChatPublicQuerySerializer(
                published,
                context={'request': request},
            ).data,
            status=status.HTTP_201_CREATED,
        )

    def delete(self, request, pk, query_id):
        topic, error_response = _get_viewable_topic(request, pk)
        if error_response:
            return error_response
        disabled = _require_chat_enabled(topic)
        if disabled:
            return disabled

        query = (
            TopicChatQuery.objects.filter(pk=query_id, topic=topic)
            .select_related('topic')
            .first()
        )
        if query is None or not _can_unpin(request.user, query):
            return Response(
                {'error': 'Consulta no encontrada'},
                status=status.HTTP_404_NOT_FOUND,
            )
        query.pins.all().delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
