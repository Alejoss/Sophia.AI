"""API for transcript Bitcoin certification anchors (OP_RETURN)."""
import logging

from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from content.models import Content, ContentTranscript, TranscriptAnchor
from content.serializers import (
    TranscriptAnchorCreateSerializer,
    TranscriptAnchorSerializer,
)
from content.bitcoin.fees import FEE_TOO_HIGH_MESSAGE, FeeBudgetError
from content.bitcoin.service import (
    AnchorBroadcastError,
    broadcast_anchor,
    ensure_pending_anchor,
    maybe_refresh_broadcast_anchor,
)

logger = logging.getLogger(__name__)


def _user_can_certify(user, content):
    if not user or not user.is_authenticated:
        return False
    if user.is_staff or user.is_superuser:
        return True
    return content.uploaded_by_id == user.id


class ContentTranscriptAnchorListView(APIView):
    """
    GET  /api/content/content_details/<content_id>/transcript/anchors/
    POST /api/content/content_details/<content_id>/transcript/anchors/

    GET is public (directory of Bitcoin proofs). POST creates a pending anchor for
    the current transcript text_hash (uploader or staff).
    """

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return [AllowAny()]

    def get(self, request, content_id):
        content = get_object_or_404(Content, pk=content_id)
        anchors = list(TranscriptAnchor.objects.filter(content=content))
        for anchor in anchors:
            if anchor.status == TranscriptAnchor.STATUS_BTC_BROADCAST and anchor.btc_txid:
                maybe_refresh_broadcast_anchor(anchor)
        anchors = TranscriptAnchor.objects.filter(content=content)
        return Response(TranscriptAnchorSerializer(anchors, many=True).data)

    def post(self, request, content_id):
        content = get_object_or_404(Content, pk=content_id)
        if not _user_can_certify(request.user, content):
            return Response(
                {'error': 'No tiene permiso para certificar este contenido.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        transcript = ContentTranscript.objects.filter(content=content).first()
        if transcript is None:
            return Response(
                {'error': 'Este contenido aún no tiene transcripción.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        if not transcript.text_hash:
            return Response(
                {'error': 'La transcripción no tiene text_hash.'},
                status=status.HTTP_409_CONFLICT,
            )

        existing = TranscriptAnchor.objects.filter(
            content=content,
            text_hash=transcript.text_hash,
        ).first()
        if existing is not None:
            return Response(
                {
                    'error': 'Ya existe un anclaje para el text_hash actual.',
                    'anchor': TranscriptAnchorSerializer(existing).data,
                },
                status=status.HTTP_409_CONFLICT,
            )

        create = TranscriptAnchorCreateSerializer(data=request.data)
        create.is_valid(raise_exception=True)
        data = create.validated_data

        anchor = TranscriptAnchor(
            content=content,
            text_hash=transcript.text_hash,
            text_length=transcript.text_length,
            op_return_prefix=data.get(
                'op_return_prefix',
                TranscriptAnchor.DEFAULT_OP_RETURN_PREFIX,
            ),
            btc_network=data.get(
                'btc_network',
                TranscriptAnchor.BTC_NETWORK_SIGNET,
            ),
            ipfs_cid=data.get('ipfs_cid', ''),
            anchored_by=request.user,
            status=TranscriptAnchor.STATUS_PENDING,
        )
        anchor.btc_op_return_hex = anchor.build_op_return_payload_hex()
        anchor.save()

        return Response(
            TranscriptAnchorSerializer(anchor).data,
            status=status.HTTP_201_CREATED,
        )


class ContentTranscriptAnchorCurrentView(APIView):
    """
    GET  /api/content/content_details/<content_id>/transcript/anchor/
    POST /api/content/content_details/<content_id>/transcript/anchor/

    GET returns the Bitcoin anchor matching the current transcript hash, or null.
    If the matching row is still ``btc_broadcast``, polls Esplora once to update
    confirmations / mark ``anchored`` when ready.

    POST (uploader/staff) ensures a pending row and broadcasts via the platform
    wallet. Rejects with 503 when estimated fee USD exceeds ``BTC_MAX_FEE_USD``.
    """

    def get_permissions(self):
        if self.request.method == 'POST':
            return [IsAuthenticated()]
        return [AllowAny()]

    def get(self, request, content_id):
        content = get_object_or_404(Content, pk=content_id)
        transcript = ContentTranscript.objects.filter(content=content).first()
        payload = {
            'content_id': content.id,
            'has_transcript': transcript is not None,
            'current_text_hash': transcript.text_hash if transcript else None,
            'current_text_length': transcript.text_length if transcript else None,
            'anchor': None,
            'can_certify': _user_can_certify(request.user, content),
        }
        if transcript and transcript.text_hash:
            anchor = TranscriptAnchor.objects.filter(
                content=content,
                text_hash=transcript.text_hash,
            ).first()
            if anchor is not None:
                anchor = maybe_refresh_broadcast_anchor(anchor)
                payload['anchor'] = TranscriptAnchorSerializer(anchor).data
        return Response(payload)

    def post(self, request, content_id):
        content = get_object_or_404(Content, pk=content_id)
        if not _user_can_certify(request.user, content):
            return Response(
                {'error': 'No tiene permiso para certificar este contenido.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        network = (
            request.data.get('btc_network')
            or getattr(settings, 'BTC_NETWORK', TranscriptAnchor.BTC_NETWORK_SIGNET)
        )
        try:
            anchor = ensure_pending_anchor(
                content,
                network=network,
                anchored_by=request.user,
            )
            if request.data.get('btc_network'):
                anchor.btc_network = str(network).lower()
                anchor.save(update_fields=['btc_network', 'updated_at'])
            anchor = broadcast_anchor(anchor, dry_run=False)
        except FeeBudgetError as exc:
            return Response(
                {
                    'error': str(exc) or FEE_TOO_HIGH_MESSAGE,
                    'code': 'fee_too_high',
                    'fee_sats': getattr(exc, 'fee_sats', None),
                    'fee_usd': getattr(exc, 'fee_usd', None),
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except AnchorBroadcastError as exc:
            message = str(exc)
            cause = exc.__cause__ if isinstance(exc.__cause__, FeeBudgetError) else None
            if cause is not None or message == FEE_TOO_HIGH_MESSAGE:
                return Response(
                    {
                        'error': FEE_TOO_HIGH_MESSAGE,
                        'code': 'fee_too_high',
                        'fee_sats': getattr(cause, 'fee_sats', None),
                        'fee_usd': getattr(cause, 'fee_usd', None),
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )
            return Response({'error': message}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                'content_id': content.id,
                'has_transcript': True,
                'current_text_hash': anchor.text_hash,
                'current_text_length': anchor.text_length,
                'can_certify': True,
                'anchor': TranscriptAnchorSerializer(anchor).data,
            },
            status=status.HTTP_200_OK,
        )
