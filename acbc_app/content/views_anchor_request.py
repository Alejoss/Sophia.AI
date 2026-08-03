"""API for paid transcript Bitcoin anchor requests."""
import logging

from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from content.anchor_request_service import AnchorRequestError, create_anchor_request
from content.models import Content, TranscriptAnchorRequest
from content.serializers import TranscriptAnchorRequestSerializer

logger = logging.getLogger(__name__)


class ContentTranscriptAnchorRequestView(APIView):
    """
    GET  — current user's latest request for this content's current text_hash (or null).
    POST — create (or return active) anchor request for the current transcript hash.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, content_id):
        content = get_object_or_404(Content, pk=content_id)
        transcript = getattr(content, 'transcript', None)
        text_hash = transcript.text_hash if transcript else None
        req = None
        is_mine = False
        if text_hash:
            req = (
                TranscriptAnchorRequest.objects.filter(
                    content=content,
                    text_hash=text_hash,
                    requester=request.user,
                )
                .order_by('-created_at')
                .first()
            )
            if req is not None:
                is_mine = True
            else:
                req = TranscriptAnchorRequest.objects.filter(
                    text_hash=text_hash,
                    status__in=TranscriptAnchorRequest.ACTIVE_STATUSES,
                ).first()
        return Response({
            'content_id': content.id,
            'current_text_hash': text_hash,
            'price_usd': float(getattr(settings, 'ANCHOR_REQUEST_PRICE_USD', 1)),
            'request': TranscriptAnchorRequestSerializer(req).data if req else None,
            'is_mine': is_mine,
        })

    def post(self, request, content_id):
        content = get_object_or_404(Content.objects.select_related('transcript'), pk=content_id)
        try:
            req = create_anchor_request(content=content, user=request.user)
        except AnchorRequestError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            TranscriptAnchorRequestSerializer(req).data,
            status=status.HTTP_201_CREATED,
        )
