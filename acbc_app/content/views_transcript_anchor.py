"""API for transcript Bitcoin certification anchors (OP_RETURN)."""
import hashlib
import logging

from django.conf import settings
from django.http import HttpResponse
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
    set_anchor_network,
    validate_btc_network,
)

logger = logging.getLogger(__name__)


def _user_can_certify(user, content):
    """Staff/ops may prepare/broadcast without a paid request; everyone else pays $1."""
    if not user or not user.is_authenticated:
        return False
    return bool(user.is_staff or user.is_superuser)


class ContentTranscriptAnchorListView(APIView):
    """
    GET  /api/content/content_details/<content_id>/transcript/anchors/
    POST /api/content/content_details/<content_id>/transcript/anchors/

    GET is public (directory of Bitcoin proofs). POST creates a pending anchor for
    the current transcript text_hash (staff/ops only; public users pay via
    TranscriptAnchorRequest).
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

        from content.transcript_utils import resolve_certified_plain_text

        try:
            network = validate_btc_network(
                data.get(
                    'btc_network',
                    TranscriptAnchor.BTC_NETWORK_SIGNET,
                )
            )
        except AnchorBroadcastError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        anchor = TranscriptAnchor(
            content=content,
            text_hash=transcript.text_hash,
            text_length=transcript.text_length,
            certified_plain_text=resolve_certified_plain_text(transcript),
            op_return_prefix=data.get(
                'op_return_prefix',
                TranscriptAnchor.DEFAULT_OP_RETURN_PREFIX,
            ),
            btc_network=network,
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
    If the matching row is still ``btc_broadcast`` (or ``anchored``), polls Esplora
    once to update confirmations / mark ``anchored`` or demote after a reorg.

    POST (staff/ops) ensures a pending row and broadcasts via the platform
    wallet. Rejects with 503 when estimated fee USD exceeds ``BTC_MAX_FEE_USD``.
    Public users must pay via ``TranscriptAnchorRequest`` ($1).
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
            network = validate_btc_network(network)
            anchor = ensure_pending_anchor(
                content,
                network=network,
                anchored_by=request.user,
            )
            if request.data.get('btc_network'):
                set_anchor_network(anchor, network)
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


class ContentTranscriptAnchorCertifiedTextView(APIView):
    """
    GET /api/content/content_details/<content_id>/transcript/anchors/<anchor_id>/certified-text/

    Public download of the exact normalized UTF-8 bytes whose SHA-256 is
    ``text_hash``. Used for independent verification after the live transcript
    has been edited. Returns 404 when the historical snapshot was never saved.
    """

    permission_classes = [AllowAny]

    def get(self, request, content_id, anchor_id):
        content = get_object_or_404(Content, pk=content_id)
        anchor = get_object_or_404(
            TranscriptAnchor,
            pk=anchor_id,
            content=content,
        )
        text = anchor.certified_plain_text or ''
        if not text.strip():
            return Response(
                {
                    'error': (
                        'Este anclaje no tiene texto certificado guardado; '
                        'no se puede verificar de forma independiente.'
                    ),
                    'code': 'certified_text_missing',
                    'text_hash': anchor.text_hash,
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        body = text.encode('utf-8')
        digest = hashlib.sha256(body).hexdigest()
        response = HttpResponse(body, content_type='text/plain; charset=utf-8')
        filename = f'transcript-anchor-{anchor.pk}-{anchor.text_hash[:12]}.txt'
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        response['X-Text-Hash'] = digest
        response['X-Expected-Text-Hash'] = anchor.text_hash
        response['X-Hash-Match'] = 'true' if digest == anchor.text_hash else 'false'
        return response
