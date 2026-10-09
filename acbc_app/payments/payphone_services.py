"""Create / confirm Payphone Botón de pago orders and fulfill entitlements."""

from __future__ import annotations

import logging
import uuid
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal
from urllib.parse import urlencode

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from content.models import TopicPurchase, TranscriptAnchorRequest, TranscriptGenerationRequest
from events.models import EventRegistration
from knowledge_paths.models import KnowledgePathPurchase
from payments.models import CoursePurchase, PayphonePayment, TokenPurchase
from payments.payphone_client import PayphoneClient, PayphoneError
from payments.services import (
    abandon_waiting_nowpayments,
    has_in_flight_nowpayments,
    mark_anchor_request_paid,
    mark_course_purchase_paid,
    mark_path_purchase_paid,
    mark_token_purchase_paid,
    mark_topic_purchase_paid,
)
from content.transcript_generation import mark_generation_request_paid
from utils.db_encoding import prepare_json_for_db, prepare_text_for_db

logger = logging.getLogger(__name__)

# Payphone hosted form TTL is 10 minutes; confirm window after pay is 5 minutes.
PAYPHONE_FORM_TTL_MINUTES = 10
APPROVED_STATUS_CODES = {3}
APPROVED_STATUS_NAMES = {'approved', 'aprobada', 'aprobado'}


def is_payphone_configured() -> bool:
    return PayphoneClient().configured


def _public_base_url() -> str:
    return getattr(settings, 'ACADEMIA_PUBLIC_URL', 'http://localhost:8000').rstrip('/')


def _frontend_base_url() -> str:
    return getattr(settings, 'FRONTEND_PUBLIC_URL', 'http://localhost:5173').rstrip('/')


def _result_redirect_url(*, status: str, **extra) -> str:
    params = {'status': status, **{k: v for k, v in extra.items() if v is not None}}
    return f'{_frontend_base_url()}/payments/payphone/result?{urlencode(params)}'


def usd_to_cents(amount_usd) -> int:
    return int(
        (Decimal(str(amount_usd)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP) * 100)
    )


def split_amount_for_payphone(amount_cents: int) -> dict:
    """
    Build amount fields for Prepare.

    Product ``price_usd`` is treated as the total the buyer pays.
    If ``PAYPHONE_IVA_PERCENT`` > 0, split that total into base + IVA.
    """
    amount_cents = int(amount_cents)
    if amount_cents <= 0:
        raise ValueError('El monto debe ser mayor a cero.')

    iva_percent = Decimal(str(getattr(settings, 'PAYPHONE_IVA_PERCENT', 0) or 0))
    if iva_percent <= 0:
        return {
            'amount': amount_cents,
            'amount_without_tax': amount_cents,
            'amount_with_tax': None,
            'tax': None,
        }

    divisor = Decimal(1) + (iva_percent / Decimal(100))
    amount_with_tax = int(
        (Decimal(amount_cents) / divisor).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    )
    tax = amount_cents - amount_with_tax
    if tax < 0:
        tax = 0
        amount_with_tax = amount_cents
    return {
        'amount': amount_cents,
        'amount_without_tax': None,
        'amount_with_tax': amount_with_tax,
        'tax': tax,
    }


def _target_filter(
    *,
    event_registration=None,
    path_purchase=None,
    topic_purchase=None,
    anchor_request=None,
    token_purchase=None,
    course_purchase=None,
    transcript_generation=None,
) -> Q:
    if event_registration is not None:
        return Q(event_registration=event_registration)
    if path_purchase is not None:
        return Q(path_purchase=path_purchase)
    if topic_purchase is not None:
        return Q(topic_purchase=topic_purchase)
    if anchor_request is not None:
        return Q(anchor_request=anchor_request)
    if token_purchase is not None:
        return Q(token_purchase=token_purchase)
    if course_purchase is not None:
        return Q(course_purchase=course_purchase)
    if transcript_generation is not None:
        return Q(transcript_generation=transcript_generation)
    raise ValueError('Falta el producto del pago Payphone.')


def payphone_queryset(
    *,
    event_registration=None,
    path_purchase=None,
    topic_purchase=None,
    anchor_request=None,
    token_purchase=None,
    course_purchase=None,
    transcript_generation=None,
):
    return PayphonePayment.objects.filter(
        _target_filter(
            event_registration=event_registration,
            path_purchase=path_purchase,
            topic_purchase=topic_purchase,
            anchor_request=anchor_request,
            token_purchase=token_purchase,
            course_purchase=course_purchase,
            transcript_generation=transcript_generation,
        )
    )


def expire_stale_payphone_payments() -> int:
    now = timezone.now()
    return PayphonePayment.objects.filter(
        status=PayphonePayment.STATUS_PENDING,
        expires_at__lte=now,
    ).update(status=PayphonePayment.STATUS_EXPIRED, updated_at=now)


def has_pending_payphone(
    *,
    event_registration=None,
    path_purchase=None,
    topic_purchase=None,
    anchor_request=None,
    token_purchase=None,
    course_purchase=None,
    transcript_generation=None,
) -> bool:
    expire_stale_payphone_payments()
    return payphone_queryset(
        event_registration=event_registration,
        path_purchase=path_purchase,
        topic_purchase=topic_purchase,
        anchor_request=anchor_request,
        token_purchase=token_purchase,
        course_purchase=course_purchase,
        transcript_generation=transcript_generation,
    ).filter(
        status=PayphonePayment.STATUS_PENDING,
        expires_at__gt=timezone.now(),
    ).exists()


def abandon_pending_payphone(
    *,
    event_registration=None,
    path_purchase=None,
    topic_purchase=None,
    anchor_request=None,
    token_purchase=None,
    course_purchase=None,
    transcript_generation=None,
) -> int:
    """Cancel unused pending Payphone orders so the buyer can switch methods."""
    expire_stale_payphone_payments()
    return payphone_queryset(
        event_registration=event_registration,
        path_purchase=path_purchase,
        topic_purchase=topic_purchase,
        anchor_request=anchor_request,
        token_purchase=token_purchase,
        course_purchase=course_purchase,
        transcript_generation=transcript_generation,
    ).filter(status=PayphonePayment.STATUS_PENDING).update(
        status=PayphonePayment.STATUS_CANCELED,
        updated_at=timezone.now(),
    )


def _release_other_rails(
    *,
    event_registration=None,
    path_purchase=None,
    topic_purchase=None,
    anchor_request=None,
    token_purchase=None,
    course_purchase=None,
    transcript_generation=None,
) -> None:
    """Block if NOWPayments coins are in flight; abandon waiting invoices and BCH."""
    from payments.models import BchDirectPayment

    now_kwargs = {}
    if path_purchase is not None:
        now_kwargs['path_purchase'] = path_purchase
    if anchor_request is not None:
        now_kwargs['anchor_request'] = anchor_request
    if token_purchase is not None:
        now_kwargs['token_purchase'] = token_purchase
    if course_purchase is not None:
        now_kwargs['course_purchase'] = course_purchase
    if transcript_generation is not None:
        now_kwargs['transcript_generation'] = transcript_generation
    # Event registrations only use NOWPayments (no BCH rail).
    if event_registration is not None:
        from payments.models import CryptoPayment
        from payments.services import IN_FLIGHT_NOWPAYMENTS_STATUSES, SWITCHABLE_NOWPAYMENTS_STATUSES
        if CryptoPayment.objects.filter(
            event_registration=event_registration,
            payment_status__in=IN_FLIGHT_NOWPAYMENTS_STATUSES,
        ).exists():
            raise ValueError(
                'Hay un pago NOWPayments en confirmación. Espera a que termine o expire.'
            )
        CryptoPayment.objects.filter(
            event_registration=event_registration,
            payment_status__in=SWITCHABLE_NOWPAYMENTS_STATUSES,
        ).update(payment_status='expired')
        return

    if now_kwargs and has_in_flight_nowpayments(**now_kwargs):
        raise ValueError(
            'Hay un pago NOWPayments en confirmación. Espera a que termine o expire.'
        )
    if now_kwargs:
        abandon_waiting_nowpayments(**now_kwargs)

    bch_q = Q()
    if path_purchase is not None:
        bch_q = Q(path_purchase=path_purchase)
    elif topic_purchase is not None:
        bch_q = Q(topic_purchase=topic_purchase)
    elif anchor_request is not None:
        bch_q = Q(anchor_request=anchor_request)
    elif token_purchase is not None:
        bch_q = Q(token_purchase=token_purchase)
    elif course_purchase is not None:
        bch_q = Q(course_purchase=course_purchase)
    elif transcript_generation is not None:
        bch_q = Q(transcript_generation=transcript_generation)
    else:
        return

    pending_bch = BchDirectPayment.objects.filter(
        bch_q,
        status=BchDirectPayment.STATUS_PENDING,
        expires_at__gt=timezone.now(),
    ).exists()
    if pending_bch:
        raise ValueError(
            'Hay una orden BCH pendiente. Verifícala o espera a que expire '
            'antes de pagar con tarjeta.'
        )


def _usd_and_reference(
    *,
    event_registration=None,
    path_purchase=None,
    topic_purchase=None,
    anchor_request=None,
    token_purchase=None,
    course_purchase=None,
    transcript_generation=None,
) -> tuple[Decimal, str, str]:
    """Return (usd_amount, reference, frontend_return_path)."""
    if event_registration is not None:
        event = event_registration.event
        usd = Decimal(str(event.reference_price or 0))
        title = prepare_text_for_db(event.title)[:180]
        return usd, f'Registro: {title}', f'/events/{event.id}'

    if path_purchase is not None:
        path = path_purchase.knowledge_path
        usd = Decimal(str(path_purchase.price_amount or path.reference_price or 0))
        title = prepare_text_for_db(path.title)[:180]
        return usd, f'Camino: {title}', f'/knowledge_path/{path.id}'

    if topic_purchase is not None:
        topic = topic_purchase.topic
        usd = Decimal(str(topic_purchase.price_amount or topic.reference_price or 0))
        title = prepare_text_for_db(topic.title)[:180]
        return usd, f'Consultas: {title}', f'/content/topics/{topic.id}'

    if anchor_request is not None:
        usd = Decimal(str(
            anchor_request.price_amount
            or getattr(settings, 'ANCHOR_REQUEST_PRICE_USD', 1)
        ))
        return usd, 'Anclaje SHA-256 a Bitcoin', '/content/library_user'

    if token_purchase is not None:
        usd = Decimal(str(token_purchase.usd_price or 0))
        name = prepare_text_for_db(token_purchase.package_name or 'tokens')[:120]
        return usd, f'Tokens: {name}', '/acbc-tokens'

    if course_purchase is not None:
        course = course_purchase.course
        usd = Decimal(str(course_purchase.price_amount or course.price_usd or 0))
        title = prepare_text_for_db(course.title)[:180]
        return usd, f'Curso: {title}', f'/cursos/{course.code}/checkout'

    if transcript_generation is not None:
        usd = Decimal(str(
            transcript_generation.price_amount
            or getattr(settings, 'TRANSCRIPT_GENERATION_PRICE_USD', 1)
        ))
        return (
            usd,
            'Generar transcripción pública',
            f'/content/{transcript_generation.content_id}',
        )

    raise ValueError('Falta el producto del pago Payphone.')


def _authorize_create(
    *,
    user,
    event_registration=None,
    path_purchase=None,
    topic_purchase=None,
    anchor_request=None,
    token_purchase=None,
    course_purchase=None,
    transcript_generation=None,
) -> None:
    if not is_payphone_configured():
        raise PayphoneError('Payphone no está configurado en el servidor.')

    if event_registration is not None:
        if event_registration.user_id != user.id:
            raise PermissionError('Solo el participante puede iniciar el pago.')
        if event_registration.registration_status != 'REGISTERED':
            raise ValueError('El registro no está activo.')
        if event_registration.payment_status == 'PAID':
            raise ValueError('Este registro ya está pagado.')
        if not event_registration.event.reference_price or event_registration.event.reference_price <= 0:
            raise ValueError('Este evento no requiere pago.')
        return

    if path_purchase is not None:
        path = path_purchase.knowledge_path
        if path_purchase.user_id != user.id:
            raise PermissionError('Solo el comprador puede iniciar el pago.')
        if path_purchase.payment_status == 'PAID':
            raise ValueError('Este camino ya está desbloqueado.')
        if not path.is_paid_path:
            raise ValueError('Este camino de conocimiento es gratuito.')
        if not path.sales_enabled:
            raise ValueError('La venta de este camino está desactivada.')
        return

    if topic_purchase is not None:
        topic = topic_purchase.topic
        if topic_purchase.user_id != user.id:
            raise PermissionError('Solo el comprador puede iniciar el pago.')
        if topic_purchase.payment_status == 'PAID':
            raise ValueError('Las consultas de este tema ya están desbloqueadas.')
        if not topic.is_paid_topic:
            raise ValueError('Las consultas de este tema son gratuitas.')
        if not topic.sales_enabled:
            raise ValueError('La venta de consultas de este tema está desactivada.')
        return

    if anchor_request is not None:
        if anchor_request.requester_id != user.id:
            raise PermissionError('Solo quien solicitó el anclaje puede iniciar el pago.')
        if anchor_request.status != TranscriptAnchorRequest.STATUS_PENDING_PAYMENT:
            raise ValueError('Esta solicitud no admite un nuevo pago.')
        return

    if token_purchase is not None:
        if token_purchase.user_id != user.id:
            raise PermissionError('Solo el comprador puede iniciar el pago.')
        if token_purchase.payment_status == 'PAID':
            raise ValueError('Esta compra de tokens ya está pagada.')
        if token_purchase.payment_status == 'CANCELLED':
            raise ValueError('Esta compra de tokens fue cancelada.')
        if token_purchase.usd_price <= 0 or token_purchase.token_amount <= 0:
            raise ValueError('Este paquete de tokens no es válido.')
        return

    if course_purchase is not None:
        course = course_purchase.course
        if course_purchase.user_id != user.id:
            raise PermissionError('Solo el comprador puede iniciar el pago.')
        if course_purchase.payment_status == 'PAID':
            raise ValueError('Este curso ya está pagado.')
        if not course.is_for_sale:
            raise ValueError('Este curso no está a la venta.')
        if not course_purchase.price_amount or course_purchase.price_amount <= 0:
            raise ValueError('Este curso no tiene un precio de pago.')
        return

    if transcript_generation is not None:
        if transcript_generation.requester_id != user.id:
            raise PermissionError('Solo quien solicitó la transcripción puede iniciar el pago.')
        if transcript_generation.status != TranscriptGenerationRequest.STATUS_PENDING_PAYMENT:
            raise ValueError('Esta solicitud no admite un nuevo pago.')
        return

    raise ValueError('Falta el producto del pago Payphone.')


def create_or_reuse_payphone_payment(
    *,
    user,
    event_registration: EventRegistration | None = None,
    path_purchase: KnowledgePathPurchase | None = None,
    topic_purchase: TopicPurchase | None = None,
    anchor_request: TranscriptAnchorRequest | None = None,
    token_purchase: TokenPurchase | None = None,
    course_purchase: CoursePurchase | None = None,
    transcript_generation: TranscriptGenerationRequest | None = None,
    client: PayphoneClient | None = None,
) -> PayphonePayment:
    targets = [
        t for t in (
            event_registration, path_purchase, topic_purchase,
            anchor_request, token_purchase, course_purchase, transcript_generation,
        ) if t is not None
    ]
    if len(targets) != 1:
        raise ValueError('El pago Payphone debe apuntar a un solo producto.')

    _authorize_create(
        user=user,
        event_registration=event_registration,
        path_purchase=path_purchase,
        topic_purchase=topic_purchase,
        anchor_request=anchor_request,
        token_purchase=token_purchase,
        course_purchase=course_purchase,
        transcript_generation=transcript_generation,
    )
    _release_other_rails(
        event_registration=event_registration,
        path_purchase=path_purchase,
        topic_purchase=topic_purchase,
        anchor_request=anchor_request,
        token_purchase=token_purchase,
        course_purchase=course_purchase,
        transcript_generation=transcript_generation,
    )

    expire_stale_payphone_payments()
    target_q = _target_filter(
        event_registration=event_registration,
        path_purchase=path_purchase,
        topic_purchase=topic_purchase,
        anchor_request=anchor_request,
        token_purchase=token_purchase,
        course_purchase=course_purchase,
        transcript_generation=transcript_generation,
    )
    existing = (
        PayphonePayment.objects.filter(target_q)
        .filter(status=PayphonePayment.STATUS_PENDING, expires_at__gt=timezone.now())
        .exclude(pay_with_card_url='')
        .order_by('-created_at')
        .first()
    )
    if existing:
        return existing

    PayphonePayment.objects.filter(target_q, status=PayphonePayment.STATUS_PENDING).update(
        status=PayphonePayment.STATUS_CANCELED,
        updated_at=timezone.now(),
    )

    usd, reference, return_path = _usd_and_reference(
        event_registration=event_registration,
        path_purchase=path_purchase,
        topic_purchase=topic_purchase,
        anchor_request=anchor_request,
        token_purchase=token_purchase,
        course_purchase=course_purchase,
        transcript_generation=transcript_generation,
    )
    if usd <= 0:
        raise ValueError('No se pudo calcular el monto a cobrar.')

    amount_fields = split_amount_for_payphone(usd_to_cents(usd))
    client_transaction_id = f'pp-{uuid.uuid4().hex[:20]}'
    response_url = f'{_public_base_url()}/api/payments/payphone/return/'
    cancellation_url = _result_redirect_url(
        status='cancelled',
        next=return_path,
    )

    client = client or PayphoneClient()
    payload = client.prepare(
        amount=amount_fields['amount'],
        amount_without_tax=amount_fields['amount_without_tax'],
        amount_with_tax=amount_fields['amount_with_tax'],
        tax=amount_fields['tax'],
        client_transaction_id=client_transaction_id,
        response_url=response_url,
        cancellation_url=cancellation_url,
        reference=reference[:250],
        email=getattr(user, 'email', '') or '',
    )

    pay_with_card = payload.get('payWithCard') or ''
    pay_with_payphone = payload.get('payWithPayPhone') or ''
    payment_id = payload.get('paymentId') or ''
    if not pay_with_card and not pay_with_payphone:
        raise PayphoneError('Payphone no devolvió enlaces de pago.')

    expires_at = timezone.now() + timedelta(minutes=PAYPHONE_FORM_TTL_MINUTES)
    payment = PayphonePayment.objects.create(
        event_registration=event_registration,
        path_purchase=path_purchase,
        topic_purchase=topic_purchase,
        anchor_request=anchor_request,
        token_purchase=token_purchase,
        course_purchase=course_purchase,
        transcript_generation=transcript_generation,
        client_transaction_id=client_transaction_id,
        payphone_payment_id=str(payment_id),
        amount_cents=amount_fields['amount'],
        currency='USD',
        reference=reference[:250],
        status=PayphonePayment.STATUS_PENDING,
        pay_with_card_url=pay_with_card,
        pay_with_payphone_url=pay_with_payphone,
        expires_at=expires_at,
        provider_payload=prepare_json_for_db({
            **payload,
            'return_path': return_path,
            'amount_fields': amount_fields,
        }),
    )
    logger.info(
        'Payphone order created id=%s client_tx=%s payment_id=%s cents=%s',
        payment.pk,
        client_transaction_id,
        payment_id,
        amount_fields['amount'],
    )
    return payment


def _is_approved_confirm(payload: dict) -> bool:
    status_code = payload.get('statusCode')
    try:
        if int(status_code) in APPROVED_STATUS_CODES:
            return True
    except (TypeError, ValueError):
        pass
    status_name = str(payload.get('transactionStatus') or '').strip().lower()
    return status_name in APPROVED_STATUS_NAMES


def _fulfill_payphone_payment(payment: PayphonePayment) -> None:
    if payment.event_registration_id:
        registration = EventRegistration.objects.select_related('event', 'user').get(
            pk=payment.event_registration_id,
        )
        if registration.payment_status != 'PAID':
            with transaction.atomic():
                locked = EventRegistration.objects.select_for_update().get(pk=registration.pk)
                if locked.payment_status != 'PAID':
                    locked.payment_status = 'PAID'
                    locked.save(update_fields=['payment_status'])
            try:
                from utils.notification_utils import notify_payment_accepted
                notify_payment_accepted(
                    EventRegistration.objects.select_related('event', 'event__owner', 'user').get(
                        pk=registration.pk,
                    )
                )
            except Exception as exc:
                logger.error('Payphone event notify failed registration=%s: %s', registration.pk, exc)
        return

    if payment.path_purchase_id:
        mark_path_purchase_paid(
            KnowledgePathPurchase.objects.get(pk=payment.path_purchase_id),
            source='payphone',
        )
        return

    if payment.topic_purchase_id:
        mark_topic_purchase_paid(
            TopicPurchase.objects.get(pk=payment.topic_purchase_id),
            source='payphone',
        )
        return

    if payment.anchor_request_id:
        mark_anchor_request_paid(
            TranscriptAnchorRequest.objects.get(pk=payment.anchor_request_id),
            source='payphone',
        )
        return

    if payment.token_purchase_id:
        mark_token_purchase_paid(
            TokenPurchase.objects.get(pk=payment.token_purchase_id),
            source='payphone',
        )
        return

    if payment.course_purchase_id:
        mark_course_purchase_paid(
            CoursePurchase.objects.get(pk=payment.course_purchase_id),
        )
        return

    if payment.transcript_generation_id:
        mark_generation_request_paid(
            TranscriptGenerationRequest.objects.get(pk=payment.transcript_generation_id),
            source='payphone',
        )
        return


def confirm_payphone_return(
    *,
    transaction_id: int | str,
    client_transaction_id: str,
    client: PayphoneClient | None = None,
) -> tuple[PayphonePayment, str]:
    """
    Confirm a Payphone redirect and fulfill if approved.

    Returns (payment, frontend_redirect_url).
    """
    client_transaction_id = (client_transaction_id or '').strip()
    if not client_transaction_id:
        raise ValueError('Falta clientTransactionId.')
    try:
        transaction_id_int = int(transaction_id)
    except (TypeError, ValueError) as exc:
        raise ValueError('Identificador de transacción inválido.') from exc

    try:
        payment = PayphonePayment.objects.get(client_transaction_id=client_transaction_id)
    except PayphonePayment.DoesNotExist as exc:
        raise ValueError('No encontramos ese pago Payphone.') from exc

    return_path = (payment.provider_payload or {}).get('return_path') or '/'

    if payment.status == PayphonePayment.STATUS_APPROVED:
        return payment, _result_redirect_url(
            status='approved',
            next=return_path,
            payment=payment.pk,
        )

    client = client or PayphoneClient()
    confirm_payload = client.confirm(
        transaction_id=transaction_id_int,
        client_transaction_id=client_transaction_id,
    )

    with transaction.atomic():
        locked = PayphonePayment.objects.select_for_update().get(pk=payment.pk)
        locked.transaction_id = (
            confirm_payload.get('transactionId')
            or transaction_id_int
        )
        locked.confirm_payload = prepare_json_for_db(confirm_payload)
        if _is_approved_confirm(confirm_payload):
            locked.status = PayphonePayment.STATUS_APPROVED
            locked.paid_at = timezone.now()
        else:
            status_name = str(confirm_payload.get('transactionStatus') or '').lower()
            if 'cancel' in status_name:
                locked.status = PayphonePayment.STATUS_CANCELED
            else:
                locked.status = PayphonePayment.STATUS_FAILED
        locked.save(update_fields=[
            'transaction_id', 'confirm_payload', 'status', 'paid_at', 'updated_at',
        ])
        payment = locked

    if payment.status == PayphonePayment.STATUS_APPROVED:
        try:
            _fulfill_payphone_payment(payment)
        except Exception:
            logger.exception(
                'Payphone fulfill failed payment=%s client_tx=%s',
                payment.pk,
                client_transaction_id,
            )
            # Payment is approved at Payphone; leave approved for ops retry.
        return payment, _result_redirect_url(
            status='approved',
            next=return_path,
            payment=payment.pk,
        )

    return payment, _result_redirect_url(
        status=payment.status,
        next=return_path,
        payment=payment.pk,
        message=confirm_payload.get('message') or confirm_payload.get('transactionStatus') or '',
    )


def resolve_payphone_target(*, kind: str, purchase_id: int, user):
    """Map frontend paymentTarget to a model instance for create."""
    kind = (kind or '').strip().lower()
    try:
        purchase_id = int(purchase_id)
    except (TypeError, ValueError) as exc:
        raise ValueError('purchaseId inválido.') from exc

    if kind == 'event':
        try:
            return {'event_registration': EventRegistration.objects.select_related('event', 'user').get(pk=purchase_id)}
        except EventRegistration.DoesNotExist as exc:
            raise ValueError('Registro no encontrado.') from exc

    if kind == 'path':
        try:
            return {
                'path_purchase': KnowledgePathPurchase.objects.select_related(
                    'knowledge_path', 'user',
                ).get(pk=purchase_id),
            }
        except KnowledgePathPurchase.DoesNotExist as exc:
            raise ValueError('Compra de camino no encontrada.') from exc

    if kind == 'topic':
        try:
            return {
                'topic_purchase': TopicPurchase.objects.select_related('topic', 'user').get(pk=purchase_id),
            }
        except TopicPurchase.DoesNotExist as exc:
            raise ValueError('Compra de consultas no encontrada.') from exc

    if kind == 'anchor':
        try:
            return {
                'anchor_request': TranscriptAnchorRequest.objects.select_related(
                    'content', 'requester',
                ).get(pk=purchase_id),
            }
        except TranscriptAnchorRequest.DoesNotExist as exc:
            raise ValueError('Solicitud de anclaje no encontrada.') from exc

    if kind in ('token_package', 'token'):
        try:
            return {
                'token_purchase': TokenPurchase.objects.select_related('user', 'package').get(pk=purchase_id),
            }
        except TokenPurchase.DoesNotExist as exc:
            raise ValueError('Compra de tokens no encontrada.') from exc

    if kind == 'course':
        try:
            return {
                'course_purchase': CoursePurchase.objects.select_related('course', 'user').get(pk=purchase_id),
            }
        except CoursePurchase.DoesNotExist as exc:
            raise ValueError('Compra de curso no encontrada.') from exc

    if kind in ('transcript_generation', 'transcript'):
        try:
            return {
                'transcript_generation': TranscriptGenerationRequest.objects.select_related(
                    'content', 'requester',
                ).get(pk=purchase_id),
            }
        except TranscriptGenerationRequest.DoesNotExist as exc:
            raise ValueError('Solicitud de transcripción no encontrada.') from exc

    raise ValueError(f'Tipo de producto no soportado para Payphone: {kind}')
