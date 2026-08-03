"""Create / review paid transcript Bitcoin anchor requests."""
from __future__ import annotations

import logging

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from content.bitcoin.service import (
    AnchorBroadcastError,
    broadcast_anchor,
    ensure_pending_anchor,
)
from content.models import Content, ContentTranscript, TranscriptAnchor, TranscriptAnchorRequest

logger = logging.getLogger(__name__)


class AnchorRequestError(Exception):
    """Validation / business error for anchor requests."""


def _price_usd() -> float:
    return float(getattr(settings, 'ANCHOR_REQUEST_PRICE_USD', 1) or 1)


def create_anchor_request(*, content: Content, user) -> TranscriptAnchorRequest:
    """
    Any authenticated user may request anchoring of the current transcript hash.
    At most one active (pending_payment | paid_pending_review) request per text_hash.
    """
    if user is None or not user.is_authenticated:
        raise AnchorRequestError('Debe iniciar sesión para solicitar el anclaje.')

    try:
        transcript = content.transcript
    except ContentTranscript.DoesNotExist as exc:
        raise AnchorRequestError('Este contenido aún no tiene transcripción.') from exc
    if not transcript.text_hash:
        raise AnchorRequestError('La transcripción no tiene text_hash.')

    existing_anchor = TranscriptAnchor.objects.filter(
        content=content,
        text_hash=transcript.text_hash,
    ).exclude(status=TranscriptAnchor.STATUS_FAILED).first()
    if existing_anchor is not None and existing_anchor.btc_txid:
        raise AnchorRequestError('Este hash ya está anclado en Bitcoin.')

    active = TranscriptAnchorRequest.objects.filter(
        text_hash=transcript.text_hash,
        status__in=TranscriptAnchorRequest.ACTIVE_STATUSES,
    ).first()
    if active is not None:
        if active.requester_id == user.id:
            return active
        raise AnchorRequestError(
            'Ya existe una solicitud activa para este hash. Inténtelo más tarde.'
        )

    try:
        return TranscriptAnchorRequest.objects.create(
            requester=user,
            content=content,
            text_hash=transcript.text_hash,
            text_length=transcript.text_length,
            price_amount=_price_usd(),
            status=TranscriptAnchorRequest.STATUS_PENDING_PAYMENT,
        )
    except IntegrityError as exc:
        raise AnchorRequestError(
            'Ya existe una solicitud activa para este hash. Inténtelo más tarde.'
        ) from exc


@transaction.atomic
def approve_anchor_request(
    anchor_request: TranscriptAnchorRequest,
    *,
    admin_user,
) -> TranscriptAnchorRequest:
    """
    Staff approve → broadcast OP_RETURN via platform wallet.

    On fee/wallet failures the request stays paid_pending_review so ops can retry
    later (no automatic refund; users are not shown wallet/fee internals).
    """
    req = TranscriptAnchorRequest.objects.select_for_update().select_related(
        'content', 'content__transcript',
    ).get(pk=anchor_request.pk)

    if req.status != TranscriptAnchorRequest.STATUS_PAID_PENDING_REVIEW:
        raise AnchorRequestError(
            f'Solo se pueden aprobar solicitudes en revisión (estado actual: {req.status}).'
        )

    network = (getattr(settings, 'BTC_NETWORK', None) or TranscriptAnchor.BTC_NETWORK_MAINNET).lower()
    try:
        anchor = ensure_pending_anchor(
            req.content,
            network=network,
            anchored_by=admin_user,
        )
        if anchor.text_hash != req.text_hash:
            raise AnchorRequestError(
                'El hash de la transcripción cambió; no se puede aprobar esta solicitud.'
            )
        if anchor.btc_network != network:
            anchor.btc_network = network
            anchor.save(update_fields=['btc_network', 'updated_at'])
        if not (anchor.status == TranscriptAnchor.STATUS_ANCHORED and anchor.btc_txid):
            if not (anchor.status == TranscriptAnchor.STATUS_BTC_BROADCAST and anchor.btc_txid):
                anchor = broadcast_anchor(anchor, dry_run=False)
    except AnchorBroadcastError as exc:
        # Keep in review queue; admin retries when fees drop / wallet is funded.
        req.review_note = str(exc)[:2000]
        req.save(update_fields=['review_note', 'updated_at'])
        logger.warning(
            'Approve anchor_request=%s deferred: %s',
            req.pk,
            exc,
        )
        raise AnchorRequestError(
            'No se pudo emitir aún (comisiones o fondos). La solicitud sigue en revisión; '
            'reintente más tarde.'
        ) from exc

    req.anchor = anchor
    req.status = TranscriptAnchorRequest.STATUS_APPROVED
    req.reviewed_by = admin_user
    req.reviewed_at = timezone.now()
    req.review_note = ''
    req.save(
        update_fields=[
            'anchor',
            'status',
            'reviewed_by',
            'reviewed_at',
            'review_note',
            'updated_at',
        ]
    )
    return req


@transaction.atomic
def reject_anchor_request(
    anchor_request: TranscriptAnchorRequest,
    *,
    admin_user,
    note: str = '',
) -> TranscriptAnchorRequest:
    req = TranscriptAnchorRequest.objects.select_for_update().get(pk=anchor_request.pk)
    if req.status != TranscriptAnchorRequest.STATUS_PAID_PENDING_REVIEW:
        raise AnchorRequestError(
            f'Solo se pueden rechazar solicitudes en revisión (estado actual: {req.status}).'
        )
    req.status = TranscriptAnchorRequest.STATUS_REJECTED
    req.reviewed_by = admin_user
    req.reviewed_at = timezone.now()
    req.review_note = (note or '').strip()
    req.save(
        update_fields=['status', 'reviewed_by', 'reviewed_at', 'review_note', 'updated_at']
    )
    return req
