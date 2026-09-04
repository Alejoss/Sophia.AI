"""Create / verify self-custody BCH payments for anchors, paths, and topics."""
from __future__ import annotations

import logging
from datetime import timedelta
from decimal import ROUND_UP, Decimal

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from content.models import TopicPurchase, TranscriptAnchorRequest
from knowledge_paths.models import KnowledgePathPurchase
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
from payments.models import BchDirectPayment
from payments.services import (
    abandon_waiting_nowpayments,
    has_in_flight_nowpayments,
    mark_anchor_request_paid,
    mark_path_purchase_paid,
    mark_topic_purchase_paid,
)

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


def _target_filter(
    *,
    anchor_request=None,
    path_purchase=None,
    topic_purchase=None,
) -> Q:
    if anchor_request is not None:
        return Q(anchor_request=anchor_request)
    if path_purchase is not None:
        return Q(path_purchase=path_purchase)
    if topic_purchase is not None:
        return Q(topic_purchase=topic_purchase)
    raise BchPaymentError('Falta el entitlement del pago BCH.')


def _release_waiting_nowpayments(*, anchor_request=None, path_purchase=None) -> None:
    """Allow switching from an unused NOWPayments invoice to BCH."""
    if has_in_flight_nowpayments(anchor_request=anchor_request, path_purchase=path_purchase):
        raise BchPaymentError(
            'Hay un pago NOWPayments en confirmación. Espera a que termine o expire.'
        )
    abandon_waiting_nowpayments(anchor_request=anchor_request, path_purchase=path_purchase)


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


def _authorize_create(*, user, anchor_request=None, path_purchase=None, topic_purchase=None) -> None:
    if not is_bch_direct_configured():
        raise BchPaymentError('Pagos BCH directos no están configurados en el servidor.')

    if anchor_request is not None:
        if anchor_request.requester_id != user.id:
            raise PermissionError('Solo quien solicitó el anclaje puede iniciar el pago BCH.')
        if anchor_request.status != TranscriptAnchorRequest.STATUS_PENDING_PAYMENT:
            raise BchPaymentError('Esta solicitud no admite un nuevo pago BCH.')
        _release_waiting_nowpayments(anchor_request=anchor_request)
        return

    if path_purchase is not None:
        path = path_purchase.knowledge_path
        if path_purchase.user_id != user.id:
            raise PermissionError('Solo el comprador puede iniciar el pago BCH.')
        if path_purchase.payment_status == 'PAID':
            raise BchPaymentError('Este camino ya está desbloqueado.')
        if not path.is_paid_path:
            raise BchPaymentError('Este camino de conocimiento es gratuito.')
        if not path.bch_direct_enabled:
            raise BchPaymentError('El pago BCH no está activado para este camino.')
        _release_waiting_nowpayments(path_purchase=path_purchase)
        return

    if topic_purchase is not None:
        topic = topic_purchase.topic
        if topic_purchase.user_id != user.id:
            raise PermissionError('Solo el comprador puede iniciar el pago BCH.')
        if topic_purchase.payment_status == 'PAID':
            raise BchPaymentError('Las consultas de este tema ya están desbloqueadas.')
        if not topic.is_paid_topic:
            raise BchPaymentError('Las consultas de este tema son gratuitas.')
        if not topic.bch_direct_enabled:
            raise BchPaymentError('El pago BCH no está activado para este tema.')
        return

    raise BchPaymentError('Falta el entitlement del pago BCH.')


def _authorize_verify(*, user, anchor_request=None, path_purchase=None, topic_purchase=None) -> None:
    if anchor_request is not None:
        if anchor_request.requester_id != user.id and not getattr(user, 'is_staff', False):
            raise PermissionError('No tiene permiso para verificar este pago.')
        return
    if path_purchase is not None:
        path = path_purchase.knowledge_path
        if (
            path_purchase.user_id != user.id
            and path.author_id != user.id
            and not getattr(user, 'is_staff', False)
        ):
            raise PermissionError('No tiene permiso para verificar este pago.')
        return
    if topic_purchase is not None:
        topic = topic_purchase.topic
        if (
            topic_purchase.user_id != user.id
            and not topic.is_moderator_or_creator(user)
            and not getattr(user, 'is_staff', False)
        ):
            raise PermissionError('No tiene permiso para verificar este pago.')
        return
    raise BchPaymentError('Falta el entitlement del pago BCH.')


def _usd_for_target(*, anchor_request=None, path_purchase=None, topic_purchase=None) -> Decimal:
    if anchor_request is not None:
        return Decimal(str(
            anchor_request.price_amount or getattr(settings, 'ANCHOR_REQUEST_PRICE_USD', 1)
        ))
    if path_purchase is not None:
        return Decimal(str(
            path_purchase.price_amount or path_purchase.knowledge_path.reference_price or 0
        ))
    if topic_purchase is not None:
        return Decimal(str(
            topic_purchase.price_amount or topic_purchase.topic.reference_price or 0
        ))
    return Decimal('0')


def create_or_reuse_bch_payment(
    *,
    user,
    anchor_request: TranscriptAnchorRequest | None = None,
    path_purchase: KnowledgePathPurchase | None = None,
    topic_purchase: TopicPurchase | None = None,
    client: BchPublicClient | BchElectrumClient | None = None,
) -> BchDirectPayment:
    targets = [t for t in (anchor_request, path_purchase, topic_purchase) if t is not None]
    if len(targets) != 1:
        raise BchPaymentError('El pago BCH debe apuntar a un solo producto.')

    _authorize_create(
        user=user,
        anchor_request=anchor_request,
        path_purchase=path_purchase,
        topic_purchase=topic_purchase,
    )

    target_q = _target_filter(
        anchor_request=anchor_request,
        path_purchase=path_purchase,
        topic_purchase=topic_purchase,
    )
    _expire_stale_pending()
    existing = (
        BchDirectPayment.objects.filter(target_q)
        .filter(status=BchDirectPayment.STATUS_PENDING, expires_at__gt=timezone.now())
        .order_by('-created_at')
        .first()
    )
    if existing:
        return existing

    BchDirectPayment.objects.filter(target_q, status=BchDirectPayment.STATUS_PENDING).update(
        status=BchDirectPayment.STATUS_CANCELLED,
        updated_at=timezone.now(),
    )

    client = client or build_bch_client()
    try:
        rate = client.get_bch_usd_rate()
    except BchApiError as exc:
        logger.exception(
            'BCH USD rate failed network=%s user=%s: %s',
            get_bch_network(),
            getattr(user, 'id', None),
            exc,
        )
        raise BchPaymentError(str(exc)) from exc

    usd = _usd_for_target(
        anchor_request=anchor_request,
        path_purchase=path_purchase,
        topic_purchase=topic_purchase,
    )
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
        path_purchase=path_purchase,
        topic_purchase=topic_purchase,
        address=address,
        expected_amount_sats=sats,
        usd_amount=usd.quantize(Decimal('0.01')),
        usd_bch_rate=rate,
        status=BchDirectPayment.STATUS_PENDING,
        expires_at=expires_at,
        provider_payload={'network': network},
    )
    logger.info(
        'BCH direct order created id=%s network=%s sats=%s expires=%s',
        payment.pk,
        network,
        sats,
        expires_at.isoformat(),
    )
    return payment


def verify_bch_payment(
    *,
    user,
    anchor_request: TranscriptAnchorRequest | None = None,
    path_purchase: KnowledgePathPurchase | None = None,
    topic_purchase: TopicPurchase | None = None,
    client: BchPublicClient | BchElectrumClient | None = None,
) -> BchDirectPayment:
    targets = [t for t in (anchor_request, path_purchase, topic_purchase) if t is not None]
    if len(targets) != 1:
        raise BchPaymentError('El pago BCH debe apuntar a un solo producto.')

    _authorize_verify(
        user=user,
        anchor_request=anchor_request,
        path_purchase=path_purchase,
        topic_purchase=topic_purchase,
    )

    if anchor_request is not None:
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
    elif path_purchase is not None and path_purchase.payment_status == 'PAID':
        paid = (
            BchDirectPayment.objects.filter(
                path_purchase=path_purchase,
                status=BchDirectPayment.STATUS_PAID,
            )
            .order_by('-paid_at')
            .first()
        )
        if paid:
            return paid
        raise BchPaymentError('Este camino ya está desbloqueado.')
    elif topic_purchase is not None and topic_purchase.payment_status == 'PAID':
        paid = (
            BchDirectPayment.objects.filter(
                topic_purchase=topic_purchase,
                status=BchDirectPayment.STATUS_PAID,
            )
            .order_by('-paid_at')
            .first()
        )
        if paid:
            return paid
        raise BchPaymentError('Las consultas de este tema ya están desbloqueadas.')

    target_q = _target_filter(
        anchor_request=anchor_request,
        path_purchase=path_purchase,
        topic_purchase=topic_purchase,
    )
    payment = (
        BchDirectPayment.objects.filter(target_q, status=BchDirectPayment.STATUS_PENDING)
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
        txs = client.list_recent_transactions(payment.address, limit=15)
    except BchApiError as exc:
        logger.exception(
            'BCH chain lookup failed network=%s payment_id=%s address=%s sats=%s: %s',
            get_bch_network(),
            payment.pk,
            payment.address,
            payment.expected_amount_sats,
            exc,
        )
        raise BchPaymentError(
            'No se pudo consultar la blockchain de BCH. Inténtelo más tarde '
            'o avise por mensaje con el monto y la dirección de la orden.'
        ) from exc

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

    logger.info(
        'BCH verify no exact-amount match yet payment_id=%s address=%s sats=%s txs_scanned=%s',
        payment.pk,
        payment.address,
        payment.expected_amount_sats,
        len(txs),
    )
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
        'path_purchase',
        'topic_purchase',
        'topic_purchase__topic',
        'path_purchase__knowledge_path',
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

    if locked.anchor_request_id:
        mark_anchor_request_paid(locked.anchor_request, source='bch_direct')
    elif locked.path_purchase_id:
        mark_path_purchase_paid(locked.path_purchase, source='bch_direct')
    elif locked.topic_purchase_id:
        mark_topic_purchase_paid(locked.topic_purchase, source='bch_direct')

    logger.info(
        'BCH direct payment fulfilled id=%s txid=%s',
        locked.pk,
        txid,
    )
    return locked
