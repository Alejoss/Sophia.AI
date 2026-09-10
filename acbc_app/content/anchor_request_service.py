"""Create / fulfill paid transcript Bitcoin anchor requests."""
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
    Any authenticated user may start anchoring of the current transcript hash.
    At most one active (pending_payment | paid_pending_review) request per text_hash.
    """
    if user is None or not user.is_authenticated:
        raise AnchorRequestError('Debe iniciar sesión para anclar la transcripción.')

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
            'Ya existe un anclaje en curso para este hash. Inténtalo más tarde.'
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
            'Ya existe un anclaje en curso para este hash. Inténtalo más tarde.'
        ) from exc


def fulfill_paid_anchor_request(
    anchor_request: TranscriptAnchorRequest,
    *,
    actor=None,
    raise_on_defer: bool = False,
) -> TranscriptAnchorRequest:
    """
    After payment: ensure pending TranscriptAnchor and broadcast OP_RETURN.

    Idempotent. On fee/wallet failures the request stays ``paid_pending_review``
    (retry via admin or a later payment-fulfillment path). Payment is never
    rolled back. Set ``raise_on_defer=True`` for admin UX that needs an error.
    """
    with transaction.atomic():
        req = TranscriptAnchorRequest.objects.select_for_update().select_related(
            'content', 'content__transcript', 'requester',
        ).get(pk=anchor_request.pk)

        if req.status == TranscriptAnchorRequest.STATUS_APPROVED:
            return req
        if req.status != TranscriptAnchorRequest.STATUS_PAID_PENDING_REVIEW:
            if raise_on_defer:
                raise AnchorRequestError(
                    f'Solo se pueden emitir solicitudes pagadas '
                    f'(estado actual: {req.status}).'
                )
            return req

        network = (
            getattr(settings, 'BTC_NETWORK', None)
            or TranscriptAnchor.BTC_NETWORK_SIGNET
        ).lower()
        anchored_by = actor or req.requester

        try:
            anchor = ensure_pending_anchor(
                req.content,
                network=network,
                anchored_by=anchored_by,
            )
            if anchor.text_hash != req.text_hash:
                raise AnchorRequestError(
                    'El hash de la transcripción cambió; no se puede emitir este anclaje.'
                )
            if anchor.btc_network != network:
                anchor.btc_network = network
                anchor.save(update_fields=['btc_network', 'updated_at'])
            if not (anchor.status == TranscriptAnchor.STATUS_ANCHORED and anchor.btc_txid):
                if not (
                    anchor.status == TranscriptAnchor.STATUS_BTC_BROADCAST
                    and anchor.btc_txid
                ):
                    # Network I/O while holding the row lock — same as prior admin path.
                    # Payment is already committed in a separate transaction.
                    anchor = broadcast_anchor(anchor, dry_run=False)
        except AnchorBroadcastError as exc:
            req.review_note = str(exc)[:2000]
            req.save(update_fields=['review_note', 'updated_at'])
            logger.warning(
                'Fulfill anchor_request=%s deferred: %s',
                req.pk,
                exc,
            )
            if raise_on_defer:
                raise AnchorRequestError(
                    'No se pudo emitir aún (comisiones o fondos). '
                    'El pago está confirmado; se reintentará más tarde.'
                ) from exc
            return req
        except AnchorRequestError:
            if raise_on_defer:
                raise
            logger.warning(
                'Fulfill anchor_request=%s blocked by validation',
                req.pk,
                exc_info=True,
            )
            return req

        req.anchor = anchor
        req.status = TranscriptAnchorRequest.STATUS_APPROVED
        if actor is not None:
            req.reviewed_by = actor
            req.reviewed_at = timezone.now()
        req.review_note = ''
        update_fields = [
            'anchor',
            'status',
            'review_note',
            'updated_at',
        ]
        if actor is not None:
            update_fields.extend(['reviewed_by', 'reviewed_at'])
        req.save(update_fields=update_fields)
        logger.info(
            'Anchor request %s fulfilled (anchor=%s txid=%s)',
            req.pk,
            anchor.pk,
            anchor.btc_txid,
        )
        return req


def approve_anchor_request(
    anchor_request: TranscriptAnchorRequest,
    *,
    admin_user,
) -> TranscriptAnchorRequest:
    """Staff retry / manual emit for a paid request that deferred broadcast."""
    return fulfill_paid_anchor_request(
        anchor_request,
        actor=admin_user,
        raise_on_defer=True,
    )


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
            f'Solo se pueden rechazar solicitudes pagadas pendientes de emisión '
            f'(estado actual: {req.status}).'
        )
    req.status = TranscriptAnchorRequest.STATUS_REJECTED
    req.reviewed_by = admin_user
    req.reviewed_at = timezone.now()
    req.review_note = (note or '').strip()
    req.save(
        update_fields=['status', 'reviewed_by', 'reviewed_at', 'review_note', 'updated_at']
    )
    return req
