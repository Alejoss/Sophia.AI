"""Buyer API for paying $1 to generate a missing public transcript."""
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from content.models import Content, ContentEmbedding
from content.transcript_generation import (
    GENERATION_MEDIA_TYPES,
    TranscriptGenerationError,
    content_has_transcript,
    create_generation_request,
    generation_price_usd,
    open_generation_request,
)
from payments.token_pricing import tokens_required_for_usd


def _embedding_status(content):
    try:
        return content.embedding.status
    except ContentEmbedding.DoesNotExist:
        return None


def _request_payload(generation_request, user):
    if generation_request is None:
        return None
    requester_is_me = bool(
        getattr(user, 'is_authenticated', False)
        and generation_request.requester_id == user.id
    )
    return {
        'id': generation_request.id,
        'status': generation_request.status,
        'price_usd': generation_request.price_amount,
        'requester_is_me': requester_is_me,
        'created_at': generation_request.created_at,
    }


def _token_balance(user):
    if not getattr(user, 'is_authenticated', False):
        return None
    from profiles.models import Profile

    balance = (
        Profile.objects.filter(user_id=user.id)
        .values_list('token_balance', flat=True)
        .first()
    )
    return balance if balance is not None else 0


def generation_offer_payload(content, user):
    has_transcript = content_has_transcript(content)
    price_usd = generation_price_usd()
    request_row = None if has_transcript else open_generation_request(content)
    eligible = content.media_type in GENERATION_MEDIA_TYPES and not has_transcript
    blocking = (
        request_row is not None
        and request_row.status == request_row.STATUS_PENDING_PAYMENT
        and not (
            getattr(user, 'is_authenticated', False)
            and request_row.requester_id == user.id
        )
    )
    queued = request_row is not None and request_row.status == request_row.STATUS_QUEUED
    return {
        'content_id': content.id,
        'media_type': content.media_type,
        'has_transcript': has_transcript,
        'can_request': eligible and not blocking and not queued,
        'price_usd': price_usd,
        'price_tokens': tokens_required_for_usd(price_usd),
        'token_balance': _token_balance(user),
        'embedding_status': _embedding_status(content),
        'request': _request_payload(request_row, user),
    }


class ContentTranscriptGenerationView(APIView):
    """
    GET  — price and status for generating a missing transcript.
    POST — start or resume the authenticated user's $1 request.
    """

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return [AllowAny()]

    def get(self, request, content_id):
        content = get_object_or_404(Content, pk=content_id)
        return Response(generation_offer_payload(content, request.user))

    def post(self, request, content_id):
        content = get_object_or_404(Content, pk=content_id)
        try:
            generation_request, created = create_generation_request(
                content=content,
                user=request.user,
            )
        except TranscriptGenerationError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        payload = generation_offer_payload(content, request.user)
        payload['request'] = _request_payload(generation_request, request.user)
        if generation_request.status == generation_request.STATUS_QUEUED:
            payload['can_request'] = False
        return Response(
            payload,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )
