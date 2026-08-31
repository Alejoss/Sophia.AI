"""Create / verify self-custody BCH payments for transcript anchor requests."""
from __future__ import annotations

import logging
from datetime import timedelta
from decimal import ROUND_UP, Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from content.models import TranscriptAnchorRequest
from payments.bch_client import (
    SATS_PER_BCH,
    BchApiError,
    BchElectrumClient,
    BchPublicClient,
    build_bch_client,
    get_bch_network,
    get_bch_receive_address,
    is_bch_direct_configured,
)
from payments.models import BchDirectPayment, CryptoPayment
from payments.services import OPEN_PAYMENT_STATUSES, mark_anchor_request_paid

logger = logging.getLogger(__name__)


class BchPaymentError(Exception):
    """Business/validation error for BCH direct payments."""


def _ttl_minutes() -> int:
    return max(5, int(getattr(settings, 'BCH_PAYMENT_TTL_MINUTES', 30) or 30))


def _min_confirmations() -> int:
    return max(0, int(getattr(settings, 'BCH_MIN_CONFIRMATIONS', 0) or 0))


def _receive_address() -> str:
    address = get_bch_receive_address()
    if not address:
        raise BchPaymentError('Pagos BCH directos no están configurados en el servidor.')
    return address


def _normalize_addr(address: str) -> str:
    return (address or '').strip().lower()


def _addresses_match(a: str, b: str) -> bool:
    """Loose match: full string or cashaddr payload after bitcoincash:."""
    na, nb = _normalize_addr(a), _normalize_addr(b)
    if not na or not nb:
        return False
    if na == nb:
        return True
    def payload(x: str) -> str:
        if ':' in x:
            return x.split(':', 1)[1]
        return x
    return payload(na) == payload(nb)


def _has_open_nowpayments(anchor_request: TranscriptAnchorRequest) -> bool:
    return CryptoPayment.objects.filter(
        anchor_request=anchor_request,
        payment_status__in=OPEN_PAYMENT_STATUSES,
    ).exists()


def _expire_stale_pending() -> None:
    now = timezone.now()
    BchDirectPayment.objects.filter(
        status=BchDirectPayment.STATUS_PENDING,
        expires_at__lte=now,
    ).update(status=BchDirectPayment.STATUS_EXPIRED, updated_at=now)


def _allocate_unique_sats(base_sats: int) -> int:
    """Reserve an unused expected_amount_sats among non-expired pending orders."""
    _expire_stale_pending()
    sats = max(1000, int(base_sats))
    now = timezone.now()
    for _ in range(10_000):
        taken = BchDirectPayment.objects.filter(
            expected_amount_sats=sats,
            status=BchDirectPayment.STATUS_PENDING,
            expires_at__gt=now,
        ).exists()
        if not taken:
            return sats
        sats += 1
    raise BchPaymentError('No se pudo asignar un monto BCH único. Inténtelo de nuevo.')


def create_or_reuse_bch_payment(
    *,
    anchor_request: TranscriptAnchorRequest,
    user,
    client: BchPublicClient | BchElectrumClient | None = None,
) -> BchDirectPayment:
    if anchor_request.requester_id != user.id:
        raise PermissionError('Solo quien solicitó el anclaje puede iniciar el pago BCH.')
    if anchor_request.status != TranscriptAnchorRequest.STATUS_PENDING_PAYMENT:
        raise BchPaymentError('Esta solicitud no admite un nuevo pago BCH.')
    if not is_bch_direct_configured():
        raise BchPaymentError('Pagos BCH directos no están configurados en el servidor.')
    if _has_open_nowpayments(anchor_request):
        raise BchPaymentError(
            'Ya hay un pago NOWPayments en curso. Complételo o espere a que expire.'
        )

    _expire_stale_pending()
    existing = (
        BchDirectPayment.objects.filter(
            anchor_request=anchor_request,
            status=BchDirectPayment.STATUS_PENDING,
            expires_at__gt=timezone.now(),
        )
        .order_by('-created_at')
        .first()
    )
    if existing:
        return existing

    # Cancel older pending rows for this request (expired path already handled).
    BchDirectPayment.objects.filter(
        anchor_request=anchor_request,
        status=BchDirectPayment.STATUS_PENDING,
    ).update(status=BchDirectPayment.STATUS_CANCELLED, updated_at=timezone.now())

    client = client or build_bch_client()
    try:
        rate = client.get_bch_usd_rate()
    except BchApiError as exc:
        raise BchPaymentError(str(exc)) from exc

    usd = Decimal(str(anchor_request.price_amount or getattr(settings, 'ANCHOR_REQUEST_PRICE_USD', 1)))
    if usd <= 0 or rate <= 0:
        raise BchPaymentError('No se pudo calcular el monto BCH.')

    bch_amount = (usd / rate).quantize(Decimal('0.00000001'), rounding=ROUND_UP)
    base_sats = int(bch_amount * SATS_PER_BCH)
    sats = _allocate_unique_sats(base_sats)
    address = _receive_address()
    expires_at = timezone.now() + timedelta(minutes=_ttl_minutes())
    network = get_bch_network()

    payment = BchDirectPayment.objects.create(
        anchor_request=anchor_request,
        address=address,
        expected_amount_sats=sats,
        usd_amount=usd.quantize(Decimal('0.01')),
        usd_bch_rate=rate,
        status=BchDirectPayment.STATUS_PENDING,
        expires_at=expires_at,
        provider_payload={'network': network},
    )
    logger.info(
        'BCH direct order created id=%s request=%s network=%s sats=%s expires=%s',
        payment.pk,
        anchor_request.pk,
        network,
        sats,
        expires_at.isoformat(),
    )
    return payment


def verify_bch_payment(
    *,
    anchor_request: TranscriptAnchorRequest,
    user,
    client: BchPublicClient | BchElectrumClient | None = None,
) -> BchDirectPayment:
    if anchor_request.requester_id != user.id and not getattr(user, 'is_staff', False):
        raise PermissionError('No tiene permiso para verificar este pago.')
    if anchor_request.status == TranscriptAnchorRequest.STATUS_PAID_PENDING_REVIEW:
        paid = (
            BchDirectPayment.objects.filter(
                anchor_request=anchor_request,
                status=BchDirectPayment.STATUS_PAID,
            )
            .order_by('-paid_at')
            .first()
        )
        if paid:
            return paid
        raise BchPaymentError('La solicitud ya está pagada y en revisión.')
    if anchor_request.status != TranscriptAnchorRequest.STATUS_PENDING_PAYMENT:
        raise BchPaymentError('Esta solicitud no está pendiente de pago.')

    payment = (
        BchDirectPayment.objects.filter(
            anchor_request=anchor_request,
            status=BchDirectPayment.STATUS_PENDING,
        )
        .order_by('-created_at')
        .first()
    )
    if payment is None:
        raise BchPaymentError('No hay una orden BCH pendiente. Cree una primero.')

    payment.mark_expired_if_needed()
    if payment.status == BchDirectPayment.STATUS_EXPIRED:
        raise BchPaymentError('La orden BCH expiró. Genere una nueva orden.')

    client = client or build_bch_client()
    try:
        txs = client.list_recent_transactions(payment.address, limit=30)
    except BchApiError as exc:
        raise BchPaymentError(
            'No se pudo consultar la blockchain de BCH. Inténtelo más tarde.'
        ) from exc

    # Allow small clock skew vs created_at
    min_ts = int((payment.created_at - timedelta(seconds=60)).timestamp())
    min_conf = _min_confirmations()
    receive = payment.address

    for tx in txs:
        if tx.confirmations < min_conf:
            continue
        if tx.timestamp is not None and tx.timestamp < min_ts:
            continue
        if BchDirectPayment.objects.filter(payment_txid=tx.txid).exclude(pk=payment.pk).exists():
            continue
        for out in tx.outputs:
            if not _addresses_match(out.address, receive):
                continue
            if out.amount_sats != payment.expected_amount_sats:
                continue
            return _fulfill_bch_payment(payment, tx.txid, tx_payload={
                'txid': tx.txid,
                'timestamp': tx.timestamp,
                'confirmations': tx.confirmations,
                'amount_sats': out.amount_sats,
            })

    raise BchPaymentError(
        'No encontramos un pago BCH con el monto exacto aún. '
        'Espere unos segundos y vuelva a intentarlo.'
    )


@transaction.atomic
def _fulfill_bch_payment(
    payment: BchDirectPayment,
    txid: str,
    *,
    tx_payload: dict,
) -> BchDirectPayment:
    locked = BchDirectPayment.objects.select_for_update().select_related(
        'anchor_request',
    ).get(pk=payment.pk)
    if locked.status == BchDirectPayment.STATUS_PAID:
        return locked
    if locked.status != BchDirectPayment.STATUS_PENDING:
        raise BchPaymentError('La orden BCH ya no está pendiente.')

    locked.status = BchDirectPayment.STATUS_PAID
    locked.payment_txid = txid
    locked.paid_at = timezone.now()
    locked.provider_payload = tx_payload
    locked.save(
        update_fields=['status', 'payment_txid', 'paid_at', 'provider_payload', 'updated_at']
    )

    mark_anchor_request_paid(locked.anchor_request, source='bch_direct')
    logger.info(
        'BCH direct payment fulfilled id=%s request=%s txid=%s',
        locked.pk,
        locked.anchor_request_id,
        txid,
    )
    return locked
