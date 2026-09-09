"""Create / verify self-custody BCH payments for anchors, paths, and topics."""
from __future__ import annotations

import logging
import re
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
    BchFailoverClient,
    BchPublicClient,
    build_bch_client,
    get_bch_network,
    get_bch_receive_address,
    is_bch_direct_configured,
)
from payments.models import BchDirectPayment, TokenPurchase
from payments.services import (
    abandon_waiting_nowpayments,
    has_in_flight_nowpayments,
    mark_anchor_request_paid,
    mark_path_purchase_paid,
    mark_token_purchase_paid,
    mark_topic_purchase_paid,
)

logger = logging.getLogger(__name__)


class BchPaymentError(Exception):
    """Business/validation error for BCH direct payments.

    Optional ``details`` is merged into HTTP-boundary WARNING logs so operators
    can see expected_sats / amounts_seen without digging into INFO service logs.
    """

    def __init__(self, message: str, *, details: dict | None = None):
        super().__init__(message)
        self.details = details or {}


def _ttl_minutes() -> int:
    return max(5, int(getattr(settings, 'BCH_PAYMENT_TTL_MINUTES', 30) or 30))


def _amount_tolerance_usd() -> Decimal:
    """Max |paid − expected| in USD at the order's frozen rate (default $0.20)."""
    raw = getattr(settings, 'BCH_AMOUNT_TOLERANCE_USD', '0.20')
    try:
        value = Decimal(str(raw))
    except (ArithmeticError, ValueError, TypeError):
        value = Decimal('0.20')
    return max(Decimal('0'), value)


def _tolerance_sats_for_rate(rate: Decimal | None) -> int:
    """Convert USD tolerance → sats using the order's USD/BCH rate."""
    if rate is None:
        return 0
    rate_dec = Decimal(str(rate))
    if rate_dec <= 0:
        return 0
    tol_usd = _amount_tolerance_usd()
    if tol_usd <= 0:
        return 0
    sats = (tol_usd / rate_dec) * Decimal(SATS_PER_BCH)
    return int(sats.to_integral_value(rounding=ROUND_UP))


def _unique_sats_step(rate: Decimal | None) -> int:
    """Space pending expected amounts so ±tolerance windows do not overlap."""
    tol = _tolerance_sats_for_rate(rate)
    return max(1, 2 * tol + 1)


def _verify_timestamp_grace_seconds() -> int:
    """How far before ``created_at`` a chain tx may still count.

    Amount matching (within USD tolerance) is the main discriminator on the
    shared receive address. The old 60s grace rejected legitimate payments when
    block time was slightly earlier than order creation, or when the buyer paid
    and then regenerated the order a minute later.
    """
    configured = getattr(settings, 'BCH_VERIFY_TIMESTAMP_GRACE_SECONDS', None)
    if configured is not None:
        return max(60, int(configured))
    # Default: full order TTL (minutes → seconds), at least 1 hour.
    return max(3600, _ttl_minutes() * 60)


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
    token_purchase=None,
) -> Q:
    if anchor_request is not None:
        return Q(anchor_request=anchor_request)
    if path_purchase is not None:
        return Q(path_purchase=path_purchase)
    if topic_purchase is not None:
        return Q(topic_purchase=topic_purchase)
    if token_purchase is not None:
        return Q(token_purchase=token_purchase)
    raise BchPaymentError('Falta el entitlement del pago BCH.')


def _release_waiting_nowpayments(*, anchor_request=None, path_purchase=None, token_purchase=None) -> None:
    """Allow switching from an unused NOWPayments invoice to BCH."""
    if has_in_flight_nowpayments(
        anchor_request=anchor_request,
        path_purchase=path_purchase,
        token_purchase=token_purchase,
    ):
        raise BchPaymentError(
            'Hay un pago NOWPayments en confirmación. Espera a que termine o expire.'
        )
    abandon_waiting_nowpayments(
        anchor_request=anchor_request,
        path_purchase=path_purchase,
        token_purchase=token_purchase,
    )


def _expire_stale_pending() -> None:
    now = timezone.now()
    BchDirectPayment.objects.filter(
        status=BchDirectPayment.STATUS_PENDING,
        expires_at__lte=now,
    ).update(status=BchDirectPayment.STATUS_EXPIRED, updated_at=now)


def _allocate_unique_sats(base_sats: int, *, rate: Decimal) -> int:
    """Reserve expected_amount_sats whose ±USD-tolerance window is free.

    Pending orders on the shared address must not have overlapping acceptance
    windows, otherwise one payment could match two orders.
    """
    _expire_stale_pending()
    tol = _tolerance_sats_for_rate(rate)
    step = _unique_sats_step(rate)
    sats = max(1000, int(base_sats))
    now = timezone.now()
    pending = list(
        BchDirectPayment.objects.filter(
            status=BchDirectPayment.STATUS_PENDING,
            expires_at__gt=now,
        ).values_list('expected_amount_sats', 'usd_bch_rate')
    )
    for _ in range(10_000):
        conflict = False
        for other_sats, other_rate in pending:
            other_tol = _tolerance_sats_for_rate(Decimal(str(other_rate)))
            window = max(tol, other_tol)
            if abs(int(other_sats) - sats) <= window:
                conflict = True
                break
        if not conflict:
            return sats
        sats += step
    raise BchPaymentError('No se pudo asignar un monto BCH único. Inténtalo de nuevo.')


def _amount_closer_to_other_pending(
    *,
    amount_sats: int,
    payment: BchDirectPayment,
) -> bool:
    """True if another pending order is a better (closer) owner for this output."""
    now = timezone.now()
    my_delta = abs(int(amount_sats) - int(payment.expected_amount_sats))
    others = (
        BchDirectPayment.objects.filter(
            status=BchDirectPayment.STATUS_PENDING,
            expires_at__gt=now,
            address=payment.address,
        )
        .exclude(pk=payment.pk)
        .only('id', 'expected_amount_sats', 'usd_bch_rate')
    )
    for other in others:
        other_tol = _tolerance_sats_for_rate(other.usd_bch_rate)
        other_delta = abs(int(amount_sats) - int(other.expected_amount_sats))
        if other_delta > other_tol:
            continue
        if other_delta < my_delta:
            return True
        if other_delta == my_delta and other.pk < payment.pk:
            return True
    return False


def _authorize_create(*, user, anchor_request=None, path_purchase=None, topic_purchase=None, token_purchase=None) -> None:
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
        if not path.sales_enabled:
            raise BchPaymentError('La venta de este camino está desactivada.')
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
        if not topic.sales_enabled:
            raise BchPaymentError('La venta de consultas de este tema está desactivada.')
        return

    if token_purchase is not None:
        if token_purchase.user_id != user.id:
            raise PermissionError('Solo el comprador puede iniciar el pago BCH.')
        if token_purchase.payment_status == 'PAID':
            raise BchPaymentError('Esta compra de tokens ya está pagada.')
        if token_purchase.usd_price <= 0 or token_purchase.token_amount <= 0:
            raise BchPaymentError('Este paquete de tokens no es válido.')
        _release_waiting_nowpayments(token_purchase=token_purchase)
        return

    raise BchPaymentError('Falta el entitlement del pago BCH.')


def _authorize_verify(*, user, anchor_request=None, path_purchase=None, topic_purchase=None, token_purchase=None) -> None:
    if anchor_request is not None:
        if anchor_request.requester_id != user.id and not getattr(user, 'is_staff', False):
            raise PermissionError('No tienes permiso para verificar este pago.')
        return
    if path_purchase is not None:
        path = path_purchase.knowledge_path
        if (
            path_purchase.user_id != user.id
            and path.author_id != user.id
            and not getattr(user, 'is_staff', False)
        ):
            raise PermissionError('No tienes permiso para verificar este pago.')
        return
    if topic_purchase is not None:
        topic = topic_purchase.topic
        if (
            topic_purchase.user_id != user.id
            and not topic.is_moderator_or_creator(user)
            and not getattr(user, 'is_staff', False)
        ):
            raise PermissionError('No tienes permiso para verificar este pago.')
        return
    if token_purchase is not None:
        if token_purchase.user_id != user.id and not getattr(user, 'is_staff', False):
            raise PermissionError('No tienes permiso para verificar este pago.')
        return
    raise BchPaymentError('Falta el entitlement del pago BCH.')


def _usd_for_target(*, anchor_request=None, path_purchase=None, topic_purchase=None, token_purchase=None) -> Decimal:
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
    if token_purchase is not None:
        return Decimal(str(token_purchase.usd_price or 0))
    return Decimal('0')


def create_or_reuse_bch_payment(
    *,
    user,
    anchor_request: TranscriptAnchorRequest | None = None,
    path_purchase: KnowledgePathPurchase | None = None,
    topic_purchase: TopicPurchase | None = None,
    token_purchase: TokenPurchase | None = None,
    client: BchPublicClient | BchElectrumClient | BchFailoverClient | None = None,
) -> BchDirectPayment:
    targets = [
        t for t in (anchor_request, path_purchase, topic_purchase, token_purchase) if t is not None
    ]
    if len(targets) != 1:
        raise BchPaymentError('El pago BCH debe apuntar a un solo producto.')

    _authorize_create(
        user=user,
        anchor_request=anchor_request,
        path_purchase=path_purchase,
        topic_purchase=topic_purchase,
        token_purchase=token_purchase,
    )

    target_q = _target_filter(
        anchor_request=anchor_request,
        path_purchase=path_purchase,
        topic_purchase=topic_purchase,
        token_purchase=token_purchase,
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
        token_purchase=token_purchase,
    )
    if usd <= 0 or rate <= 0:
        raise BchPaymentError('No se pudo calcular el monto BCH.')

    bch_amount = (usd / rate).quantize(Decimal('0.00000001'), rounding=ROUND_UP)
    base_sats = int(bch_amount * SATS_PER_BCH)
    sats = _allocate_unique_sats(base_sats, rate=rate)
    address = _receive_address()
    expires_at = timezone.now() + timedelta(minutes=_ttl_minutes())
    network = get_bch_network()

    payment = BchDirectPayment.objects.create(
        anchor_request=anchor_request,
        path_purchase=path_purchase,
        topic_purchase=topic_purchase,
        token_purchase=token_purchase,
        address=address,
        expected_amount_sats=sats,
        usd_amount=usd.quantize(Decimal('0.01')),
        usd_bch_rate=rate,
        status=BchDirectPayment.STATUS_PENDING,
        expires_at=expires_at,
        provider_payload={
            'network': network,
            'amount_tolerance_usd': str(_amount_tolerance_usd()),
            'amount_tolerance_sats': _tolerance_sats_for_rate(rate),
        },
    )
    logger.info(
        'BCH direct order created id=%s network=%s sats=%s tol_sats=%s expires=%s',
        payment.pk,
        network,
        sats,
        _tolerance_sats_for_rate(rate),
        expires_at.isoformat(),
    )
    return payment


def _match_payment_on_transactions(
    payment: BchDirectPayment,
    txs: list,
    *,
    lookup_txid: str | None = None,
):
    """
    Pick the best matching receive output within USD tolerance.

    Returns the fulfilled payment, or raises ``BchPaymentError`` with diagnostics.
    """
    grace = _verify_timestamp_grace_seconds()
    min_ts = int((payment.created_at - timedelta(seconds=grace)).timestamp())
    min_conf = _min_confirmations()
    receive = payment.address
    expected = int(payment.expected_amount_sats)
    tol_sats = _tolerance_sats_for_rate(payment.usd_bch_rate)
    skipped_conf = 0
    skipped_time = 0
    skipped_txid = 0
    skipped_other_order = 0
    amounts_to_receive: list[int] = []
    # (abs_delta, -confirmations, -timestamp, txid, amount_sats, confirmations, timestamp)
    best: tuple | None = None

    for tx in txs:
        if tx.confirmations < min_conf:
            skipped_conf += 1
            continue
        if tx.timestamp is not None and tx.timestamp < min_ts:
            skipped_time += 1
            continue
        if BchDirectPayment.objects.filter(payment_txid=tx.txid).exclude(pk=payment.pk).exists():
            skipped_txid += 1
            continue
        for out in tx.outputs:
            if not _addresses_match(out.address, receive):
                continue
            amounts_to_receive.append(out.amount_sats)
            delta = abs(int(out.amount_sats) - expected)
            if delta > tol_sats:
                continue
            if _amount_closer_to_other_pending(amount_sats=out.amount_sats, payment=payment):
                skipped_other_order += 1
                continue
            candidate = (
                delta,
                -int(tx.confirmations or 0),
                -int(tx.timestamp or 0),
                str(tx.txid),
                int(out.amount_sats),
                int(tx.confirmations or 0),
                tx.timestamp,
            )
            if best is None or candidate[:3] < best[:3]:
                best = candidate

    if best is not None:
        _delta, _nc, _nts, txid, amount_sats, confirmations, timestamp = best
        return _fulfill_bch_payment(payment, txid, tx_payload={
            'txid': txid,
            'timestamp': timestamp,
            'confirmations': confirmations,
            'amount_sats': amount_sats,
            'expected_amount_sats': expected,
            'amount_delta_sats': amount_sats - expected,
            'amount_tolerance_sats': tol_sats,
            'amount_tolerance_usd': str(_amount_tolerance_usd()),
            'verify_mode': 'txid' if lookup_txid else 'address_scan',
        })

    logger.warning(
        'BCH verify no amount match within tolerance payment_id=%s address=%s '
        'expected_sats=%s tol_sats=%s tol_usd=%s txs_scanned=%s amounts_seen=%s '
        'skipped_conf=%s skipped_time=%s skipped_txid=%s skipped_other_order=%s '
        'grace_s=%s created_at=%s lookup_txid=%s',
        payment.pk,
        payment.address,
        expected,
        tol_sats,
        str(_amount_tolerance_usd()),
        len(txs),
        amounts_to_receive[:20],
        skipped_conf,
        skipped_time,
        skipped_txid,
        skipped_other_order,
        grace,
        payment.created_at.isoformat(),
        lookup_txid or '',
    )
    details = {
        'payment_id': payment.pk,
        'address': payment.address,
        'expected_sats': expected,
        'tol_sats': tol_sats,
        'tol_usd': str(_amount_tolerance_usd()),
        'txs_scanned': len(txs),
        'amounts_seen': amounts_to_receive[:20],
        'skipped_conf': skipped_conf,
        'skipped_time': skipped_time,
        'skipped_txid': skipped_txid,
        'skipped_other_order': skipped_other_order,
        'grace_s': grace,
        'created_at': payment.created_at.isoformat(),
        'network': get_bch_network(),
        'lookup_txid': lookup_txid or '',
    }
    if lookup_txid:
        raise BchPaymentError(
            'Esa transacción no envía a nuestra dirección un monto cercano al de la orden. '
            'Revisa el TXID, el monto (sats) y vuelve a intentarlo.',
            details=details,
        )
    raise BchPaymentError(
        'No encontramos un pago BCH con un monto cercano al de la orden aún. '
        'Espera unos segundos y vuelve a intentarlo.',
        details=details,
    )


def verify_bch_payment(
    *,
    user,
    anchor_request: TranscriptAnchorRequest | None = None,
    path_purchase: KnowledgePathPurchase | None = None,
    topic_purchase: TopicPurchase | None = None,
    token_purchase: TokenPurchase | None = None,
    payment_txid: str | None = None,
    client: BchPublicClient | BchElectrumClient | BchFailoverClient | None = None,
) -> BchDirectPayment:
    """
    Confirm an on-chain BCH payment for one product entitlement.

    Primary path (no TXID): scan the receive address for a recent output that
    matches the pending order amount (within USD tolerance).

    Optional TXID: used only as a fallback after auto-verify fails (or when the
    buyer/staff already has the tx id). Looks up that single transaction and
    may fulfill a pending, expired, or cancelled order for the same product.
    """
    targets = [
        t for t in (anchor_request, path_purchase, topic_purchase, token_purchase) if t is not None
    ]
    if len(targets) != 1:
        raise BchPaymentError('El pago BCH debe apuntar a un solo producto.')

    _authorize_verify(
        user=user,
        anchor_request=anchor_request,
        path_purchase=path_purchase,
        topic_purchase=topic_purchase,
        token_purchase=token_purchase,
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
    elif token_purchase is not None and token_purchase.payment_status == 'PAID':
        paid = (
            BchDirectPayment.objects.filter(
                token_purchase=token_purchase,
                status=BchDirectPayment.STATUS_PAID,
            )
            .order_by('-paid_at')
            .first()
        )
        if paid:
            return paid
        raise BchPaymentError('Esta compra de tokens ya está pagada.')

    target_q = _target_filter(
        anchor_request=anchor_request,
        path_purchase=path_purchase,
        topic_purchase=topic_purchase,
        token_purchase=token_purchase,
    )

    raw_txid = (payment_txid or '').strip()
    clean_txid = ''
    if raw_txid:
        clean_txid = normalize_bch_txid(raw_txid)

    client = client or build_bch_client()

    if clean_txid:
        return _verify_bch_by_txid(target_q=target_q, clean_txid=clean_txid, client=client)

    return _verify_bch_by_address_scan(target_q=target_q, client=client, user=user)


def _verify_bch_by_address_scan(*, target_q, client, user) -> BchDirectPayment:
    """Automatic verify: find a matching payment on the shared receive address."""
    payment = (
        BchDirectPayment.objects.filter(target_q, status=BchDirectPayment.STATUS_PENDING)
        .order_by('-created_at')
        .first()
    )
    if payment is None:
        expired = (
            BchDirectPayment.objects.filter(target_q, status=BchDirectPayment.STATUS_EXPIRED)
            .order_by('-created_at')
            .first()
        )
        if expired is not None:
            raise BchPaymentError(
                'La orden BCH expiró. Genera una nueva orden. Si ya enviaste el pago, '
                'pega el TXID para verificarlo o envíalo a soporte.',
                details={
                    'payment_id': expired.pk,
                    'expected_sats': expired.expected_amount_sats,
                    'status': expired.status,
                },
            )
        raise BchPaymentError('No hay una orden BCH pendiente. Crea una primero.')

    payment.mark_expired_if_needed()
    if payment.status == BchDirectPayment.STATUS_EXPIRED:
        raise BchPaymentError(
            'La orden BCH expiró. Genera una nueva orden. Si ya enviaste el pago, '
            'pega el TXID para verificarlo o envíalo a soporte.',
            details={
                'payment_id': payment.pk,
                'expected_sats': payment.expected_amount_sats,
                'status': payment.status,
            },
        )

    logger.info(
        'BCH auto-verify address scan payment_id=%s expected_sats=%s address=%s user_id=%s',
        payment.pk,
        payment.expected_amount_sats,
        payment.address,
        getattr(user, 'id', None),
    )
    try:
        txs = client.list_recent_transactions(payment.address, limit=30)
    except BchApiError as exc:
        logger.exception(
            'BCH address scan failed network=%s payment_id=%s address=%s sats=%s: %s',
            get_bch_network(),
            payment.pk,
            payment.address,
            payment.expected_amount_sats,
            exc,
        )
        raise BchPaymentError(
            'No se pudo consultar la blockchain de BCH automáticamente. '
            'Espera un momento e inténtalo de nuevo, o envía el TXID a soporte.',
            details={
                'payment_id': payment.pk,
                'expected_sats': payment.expected_amount_sats,
                'status': payment.status,
            },
        ) from exc

    try:
        return _match_payment_on_transactions(payment, txs, lookup_txid=None)
    except BchPaymentError as exc:
        # Nudge the buyer toward the support TXID path after auto-verify misses.
        if not getattr(exc, 'details', None):
            exc.details = {}
        exc.details.setdefault('payment_id', payment.pk)
        exc.details.setdefault('expected_sats', payment.expected_amount_sats)
        exc.details['auto_verify_failed'] = True
        raise BchPaymentError(
            'No encontramos tu pago BCH todavía. Espera unos segundos y vuelve a '
            'intentarlo. Si ya pagaste hace un rato, envía el TXID a soporte.',
            details=exc.details,
        ) from exc


def _verify_bch_by_txid(*, target_q, clean_txid: str, client) -> BchDirectPayment:
    """Fallback verify with an explicit TXID (support / retry after auto-fail)."""
    candidates = list(
        BchDirectPayment.objects.filter(target_q)
        .exclude(status=BchDirectPayment.STATUS_PAID)
        .order_by('-created_at')[:12]
    )
    if not candidates:
        raise BchPaymentError(
            'No hay una orden BCH para este producto. Crea una primero.',
            details={'lookup_txid': clean_txid},
        )

    for payment in candidates:
        payment.mark_expired_if_needed()

    try:
        tx = client.get_transaction(clean_txid)
    except BchApiError as exc:
        logger.exception(
            'BCH txid lookup failed network=%s payment_ids=%s txid=%s: %s',
            get_bch_network(),
            [p.pk for p in candidates],
            clean_txid,
            exc,
        )
        raise BchPaymentError(
            'No se pudo consultar esa transacción en la blockchain de BCH. '
            'Revisa el TXID o inténtalo más tarde.',
            details={
                'payment_ids': [p.pk for p in candidates],
                'lookup_txid': clean_txid,
            },
        ) from exc

    last_error: BchPaymentError | None = None
    for payment in candidates:
        if payment.status not in (
            BchDirectPayment.STATUS_PENDING,
            BchDirectPayment.STATUS_EXPIRED,
            BchDirectPayment.STATUS_CANCELLED,
        ):
            continue
        try:
            return _match_payment_on_transactions(
                payment, [tx], lookup_txid=clean_txid,
            )
        except BchPaymentError as exc:
            last_error = exc
            logger.info(
                'BCH txid candidate miss payment_id=%s status=%s expected_sats=%s txid=%s: %s',
                payment.pk,
                payment.status,
                payment.expected_amount_sats,
                clean_txid,
                exc,
            )
    if last_error is not None:
        raise last_error
    raise BchPaymentError(
        'Esa transacción no coincide con ninguna orden BCH de este producto.',
        details={
            'payment_ids': [p.pk for p in candidates],
            'lookup_txid': clean_txid,
        },
    )


@transaction.atomic
def _fulfill_bch_payment(
    payment: BchDirectPayment,
    txid: str,
    *,
    tx_payload: dict,
) -> BchDirectPayment:
    # Postgres rejects FOR UPDATE on the nullable side of OUTER JOINs from
    # select_related() on optional FKs (anchor/path/topic/token). Lock only
    # the payment row — same pattern as report_bch_payment_txid / manual_confirm.
    locked = BchDirectPayment.objects.select_for_update(of=('self',)).select_related(
        'anchor_request',
        'path_purchase',
        'topic_purchase',
        'topic_purchase__topic',
        'path_purchase__knowledge_path',
        'token_purchase',
        'token_purchase__user',
        'token_purchase__package',
    ).get(pk=payment.pk)
    if locked.status == BchDirectPayment.STATUS_PAID:
        return locked
    # PENDING is the normal auto-verify path. EXPIRED/CANCELLED are allowed so a
    # TXID fallback can still unlock after TTL or after a replacement order.
    if locked.status not in (
        BchDirectPayment.STATUS_PENDING,
        BchDirectPayment.STATUS_EXPIRED,
        BchDirectPayment.STATUS_CANCELLED,
    ):
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
    elif locked.token_purchase_id:
        mark_token_purchase_paid(locked.token_purchase, source='bch_direct')

    logger.info(
        'BCH direct payment fulfilled id=%s txid=%s',
        locked.pk,
        txid,
    )
    return locked


_TXID_RE = re.compile(r'^[0-9a-f]{64}$')


def normalize_bch_txid(value: str) -> str:
    clean = (value or '').strip().lower()
    if clean.startswith('0x'):
        clean = clean[2:]
    if not _TXID_RE.fullmatch(clean):
        raise BchPaymentError('El TXID debe tener 64 caracteres hexadecimales.')
    return clean


def get_bch_payment_product_meta(payment: BchDirectPayment) -> dict:
    """Product type/title and marketplace owner (path author / topic creator)."""
    if payment.path_purchase_id:
        path = getattr(payment.path_purchase, 'knowledge_path', None)
        return {
            'product_type': 'path',
            'product_id': getattr(path, 'id', None) or payment.path_purchase.knowledge_path_id,
            'product_title': getattr(path, 'title', None) or f'Camino #{payment.path_purchase.knowledge_path_id}',
            'owner': getattr(path, 'author', None),
            'product': path,
        }
    if payment.topic_purchase_id:
        topic = getattr(payment.topic_purchase, 'topic', None)
        return {
            'product_type': 'topic',
            'product_id': getattr(topic, 'id', None) or payment.topic_purchase.topic_id,
            'product_title': getattr(topic, 'title', None) or f'Tema #{payment.topic_purchase.topic_id}',
            'owner': getattr(topic, 'creator', None),
            'product': topic,
        }
    if payment.token_purchase_id:
        purchase = payment.token_purchase
        package = getattr(purchase, 'package', None)
        title = (
            getattr(purchase, 'package_name', None)
            or getattr(package, 'name', None)
            or f'{getattr(purchase, "token_amount", 0)} tokens'
        )
        return {
            'product_type': 'token_package',
            'product_id': getattr(purchase, 'package_id', None) or getattr(purchase, 'pk', None),
            'product_title': title,
            'owner': None,
            'product': package,
        }
    return {
        'product_type': 'anchor',
        'product_id': payment.anchor_request_id,
        'product_title': f'Anclaje #{payment.anchor_request_id}',
        'owner': None,
        'product': None,
    }


def list_staff_bch_orders(
    *,
    statuses: list[str] | None = None,
    limit: int = 50,
) -> list[BchDirectPayment]:
    """Staff inbox: unpaid BCH orders that may need manual TXID confirmation."""
    _expire_stale_pending()
    allowed = {
        BchDirectPayment.STATUS_PENDING,
        BchDirectPayment.STATUS_EXPIRED,
        BchDirectPayment.STATUS_CANCELLED,
        BchDirectPayment.STATUS_PAID,
    }
    if statuses:
        chosen = [s for s in statuses if s in allowed]
    else:
        chosen = [
            BchDirectPayment.STATUS_PENDING,
            BchDirectPayment.STATUS_EXPIRED,
        ]
    cap = max(1, min(int(limit or 50), 200))
    orders = list(
        BchDirectPayment.objects.filter(status__in=chosen)
        .select_related(
            'path_purchase__user',
            'path_purchase__knowledge_path__author',
            'topic_purchase__user',
            'topic_purchase__topic__creator',
            'anchor_request__requester',
            'token_purchase__user',
            'token_purchase__package',
        )
        .order_by('-created_at')[:cap]
    )
    # Buyer-reported TXIDs first so staff see the actionable inbox.
    orders.sort(
        key=lambda order: (
            0 if (order.provider_payload or {}).get('reported_txid') else 1,
            -(order.created_at.timestamp() if order.created_at else 0),
        )
    )
    return orders


@transaction.atomic
def report_bch_payment_txid(
    *,
    payment_id: int,
    txid: str,
    user,
    note: str = '',
) -> tuple[BchDirectPayment, bool]:
    """
    Buyer reports an on-chain TXID after auto-verify failed.

    Stores the report on provider_payload (does not mark paid). Returns
    (payment, should_notify) — notify only when the reported TXID changes.
    """
    clean_txid = normalize_bch_txid(txid)
    clean_note = (note or '').strip()[:1000]

    locked = (
        BchDirectPayment.objects.select_for_update(of=('self',))
        .select_related(
            'anchor_request__requester',
            'path_purchase__user',
            'path_purchase__knowledge_path__author',
            'topic_purchase__user',
            'topic_purchase__topic__creator',
            'token_purchase__user',
            'token_purchase__package',
        )
        .filter(pk=payment_id)
        .first()
    )
    if locked is None:
        raise BchPaymentError('Orden BCH no encontrada.')

    buyer = locked.buyer
    if buyer is None or buyer.id != getattr(user, 'id', None):
        raise PermissionError('Solo el comprador puede reportar el TXID de esta orden.')

    if locked.status == BchDirectPayment.STATUS_PAID:
        raise BchPaymentError('Esta orden ya está marcada como pagada.')

    if locked.status not in (
        BchDirectPayment.STATUS_PENDING,
        BchDirectPayment.STATUS_EXPIRED,
        BchDirectPayment.STATUS_CANCELLED,
    ):
        raise BchPaymentError('Esta orden BCH no admite reporte de TXID.')

    payload = dict(locked.provider_payload or {})
    previous = (payload.get('reported_txid') or '').lower()
    should_notify = previous != clean_txid

    payload.update({
        'reported_txid': clean_txid,
        'reported_at': timezone.now().isoformat(),
        'reported_by_id': user.id,
        'reported_by_username': getattr(user, 'username', ''),
        'reported_note': clean_note,
        'txid_report_pending_staff': True,
    })
    locked.provider_payload = payload
    locked.save(update_fields=['provider_payload', 'updated_at'])

    logger.info(
        'BCH TXID reported payment_id=%s txid=%s by user_id=%s notify=%s',
        locked.pk,
        clean_txid,
        user.id,
        should_notify,
    )
    return locked, should_notify


@transaction.atomic
def manual_confirm_bch_payment(
    *,
    payment_id: int,
    txid: str,
    staff_user,
) -> BchDirectPayment:
    """
    Staff confirms a reported on-chain payment by TXID.

    Works for pending, expired, or cancelled orders (buyer may have paid after
    expiry). Does not re-query the chain — staff already checked the explorer.
    """
    if not getattr(staff_user, 'is_staff', False):
        raise PermissionError('Solo el staff puede confirmar pagos BCH manualmente.')

    clean_txid = normalize_bch_txid(txid)
    locked = (
        BchDirectPayment.objects.select_for_update(of=('self',))
        .select_related(
            'anchor_request',
            'path_purchase',
            'topic_purchase',
            'topic_purchase__topic',
            'path_purchase__knowledge_path',
            'path_purchase__user',
            'topic_purchase__user',
            'anchor_request__requester',
            'token_purchase',
            'token_purchase__user',
            'token_purchase__package',
        )
        .filter(pk=payment_id)
        .first()
    )
    if locked is None:
        raise BchPaymentError('Orden BCH no encontrada.')

    if locked.status == BchDirectPayment.STATUS_PAID:
        if (locked.payment_txid or '').lower() == clean_txid:
            return locked
        raise BchPaymentError('Esta orden ya está marcada como pagada con otro TXID.')

    if locked.status not in (
        BchDirectPayment.STATUS_PENDING,
        BchDirectPayment.STATUS_EXPIRED,
        BchDirectPayment.STATUS_CANCELLED,
    ):
        raise BchPaymentError('Esta orden BCH no se puede confirmar.')

    if (
        BchDirectPayment.objects.filter(payment_txid=clean_txid)
        .exclude(pk=locked.pk)
        .exists()
    ):
        raise BchPaymentError('Ese TXID ya está asociado a otra orden BCH.')

    payload = dict(locked.provider_payload or {})
    payload.update({
        'manual_confirm': True,
        'confirmed_by_id': staff_user.id,
        'confirmed_by_username': getattr(staff_user, 'username', ''),
        'txid': clean_txid,
        'previous_status': locked.status,
    })

    locked.status = BchDirectPayment.STATUS_PAID
    locked.payment_txid = clean_txid
    locked.paid_at = timezone.now()
    locked.provider_payload = payload
    locked.save(
        update_fields=['status', 'payment_txid', 'paid_at', 'provider_payload', 'updated_at']
    )

    if locked.anchor_request_id:
        mark_anchor_request_paid(locked.anchor_request, source='bch_direct_manual')
    elif locked.path_purchase_id:
        mark_path_purchase_paid(locked.path_purchase, source='bch_direct_manual')
    elif locked.topic_purchase_id:
        mark_topic_purchase_paid(locked.topic_purchase, source='bch_direct_manual')
    elif locked.token_purchase_id:
        mark_token_purchase_paid(locked.token_purchase, source='bch_direct_manual')

    logger.info(
        'BCH direct payment manually confirmed id=%s txid=%s by user_id=%s',
        locked.pk,
        clean_txid,
        staff_user.id,
    )
    return locked
