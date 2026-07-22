import logging
import uuid
from decimal import Decimal

from django.db import transaction

from events.models import EventRegistration
from knowledge_paths.models import KnowledgePathPurchase
from payments.models import CryptoPayment
from payments.nowpayments_client import NOWPaymentsClient, NOWPaymentsError
from payments.handlers import on_crypto_payment_completed
from utils.db_encoding import prepare_json_for_db, prepare_text_for_db
from utils.notification_utils import notify_payment_accepted

logger = logging.getLogger(__name__)

ALLOWED_PAY_CURRENCIES = {'bch', 'xmr'}
# NOWPayments: only "finished" means funds reached the merchant wallet (safe to fulfill).
# "confirmed" is on-chain only — proceed only if you validate actually_paid vs pay_amount.
FULFILLMENT_STATUS = 'finished'
OPEN_PAYMENT_STATUSES = ('waiting', 'confirming', 'confirmed', 'sending', 'partially_paid')
# Backwards-compatible alias
REGISTRATION_PAID_STATUS = FULFILLMENT_STATUS


def _extract_pay_address(payload: dict) -> str:
    return payload.get('pay_address') or payload.get('payment_address') or ''


def _invoice_id_for(crypto_payment: CryptoPayment):
    payload = crypto_payment.provider_payload or {}
    return payload.get('invoice_id') or payload.get('id') or crypto_payment.nowpayments_payment_id


def _payment_id_for(crypto_payment: CryptoPayment):
    payload = crypto_payment.provider_payload or {}
    return payload.get('payment_id')


def _pick_payment_payload_from_list(response: dict) -> dict:
    if not isinstance(response, dict):
        return {}
    if response.get('payment_id') is not None:
        return response
    items = response.get('data') or []
    if not items:
        return {}
    return items[0]


def _merge_provider_payload(crypto_payment: CryptoPayment, payload: dict) -> dict:
    previous_payload = crypto_payment.provider_payload or {}
    safe_payload = prepare_json_for_db(payload)
    invoice_id = (
        previous_payload.get('invoice_id')
        or previous_payload.get('id')
        or payload.get('invoice_id')
        or payload.get('id')
    )
    if invoice_id is not None and not safe_payload.get('invoice_id'):
        safe_payload['invoice_id'] = invoice_id
    return safe_payload


def fetch_remote_payment_payload(client: NOWPaymentsClient, crypto_payment: CryptoPayment) -> dict:
    """
    Resolve the latest NOWPayments payment payload for a local record.

    Invoice checkouts store an invoice id first; the real payment_id appears only
    after the customer pays on the hosted invoice page.
    """
    payment_id = _payment_id_for(crypto_payment)
    invoice_id = _invoice_id_for(crypto_payment)

    if payment_id is not None:
        try:
            return client.get_payment_status(payment_id)
        except NOWPaymentsError as exc:
            logger.warning(
                'NOWPayments payment lookup failed for payment_id=%s order=%s: %s',
                payment_id,
                crypto_payment.order_id,
                exc,
            )

    if invoice_id is None:
        raise NOWPaymentsError('El pago no tiene invoice_id ni payment_id de NOWPayments.')

    for resolver_name, resolver in (
        ('invoice-payment', lambda: client.get_invoice_payment(invoice_id)),
        ('payment-list', lambda: _pick_payment_payload_from_list(
            client.list_payments(invoice_id=invoice_id, limit=5, order_by='desc'),
        )),
    ):
        try:
            payload = resolver()
        except NOWPaymentsError as exc:
            logger.warning(
                'NOWPayments %s lookup failed for invoice_id=%s order=%s: %s',
                resolver_name,
                invoice_id,
                crypto_payment.order_id,
                exc,
            )
            continue
        if payload.get('payment_id') is not None:
            return payload

    raise NOWPaymentsError('NOWPayments aún no reporta un pago para esta invoice.')


def refresh_crypto_payment_from_nowpayments(crypto_payment: CryptoPayment) -> CryptoPayment:
    client = NOWPaymentsClient()
    if not client.configured:
        return crypto_payment
    remote = fetch_remote_payment_payload(client, crypto_payment)
    return sync_payment_from_provider(crypto_payment, remote)


def _public_base_url():
    from django.conf import settings
    return getattr(settings, 'ACADEMIA_PUBLIC_URL', 'http://localhost:8000').rstrip('/')


def is_payments_gateway_configured() -> bool:
    return NOWPaymentsClient().configured


def _should_fulfill_payment(status: str, payload: dict, crypto_payment: CryptoPayment) -> bool:
    if status != FULFILLMENT_STATUS:
        return False
    pay_amount = crypto_payment.pay_amount
    if pay_amount is None:
        pay_amount = payload.get('pay_amount')
    actually_paid = payload.get('actually_paid')
    if actually_paid is None:
        actually_paid = crypto_payment.actually_paid
    if pay_amount is not None and actually_paid is not None:
        try:
            return Decimal(str(actually_paid)) >= Decimal(str(pay_amount))
        except Exception:
            logger.warning(
                'Could not compare actually_paid vs pay_amount for order %s',
                crypto_payment.order_id,
            )
    return True


def _mark_event_registration_paid_if_needed(crypto_payment: CryptoPayment) -> None:
    with transaction.atomic():
        registration = EventRegistration.objects.select_for_update().get(
            pk=crypto_payment.event_registration_id
        )
        if registration.payment_status == 'PAID':
            return
        registration.payment_status = 'PAID'
        registration.save(update_fields=['payment_status'])

    registration = EventRegistration.objects.select_related('event', 'event__owner', 'user').get(
        pk=crypto_payment.event_registration_id
    )
    try:
        notify_payment_accepted(registration)
    except Exception as exc:
        logger.error('Payment notification failed for registration %s: %s', registration.id, exc)
    try:
        on_crypto_payment_completed(crypto_payment, event_registration=registration)
    except Exception as exc:
        logger.error(
            'on_crypto_payment_completed failed for registration %s: %s',
            registration.id,
            exc,
            exc_info=True,
        )


def _mark_path_purchase_paid_if_needed(crypto_payment: CryptoPayment) -> None:
    with transaction.atomic():
        purchase = KnowledgePathPurchase.objects.select_for_update().get(
            pk=crypto_payment.path_purchase_id
        )
        if purchase.payment_status == 'PAID':
            return
        purchase.payment_status = 'PAID'
        purchase.save(update_fields=['payment_status', 'updated_at'])

    purchase = KnowledgePathPurchase.objects.select_related(
        'knowledge_path', 'knowledge_path__author', 'user'
    ).get(pk=crypto_payment.path_purchase_id)
    try:
        on_crypto_payment_completed(crypto_payment, path_purchase=purchase)
    except Exception as exc:
        logger.error(
            'on_crypto_payment_completed failed for path_purchase %s: %s',
            purchase.id,
            exc,
            exc_info=True,
        )


def _fulfill_if_needed(crypto_payment: CryptoPayment) -> None:
    if crypto_payment.event_registration_id:
        _mark_event_registration_paid_if_needed(crypto_payment)
    elif crypto_payment.path_purchase_id:
        _mark_path_purchase_paid_if_needed(crypto_payment)


def sync_payment_from_provider(crypto_payment: CryptoPayment, payload: dict) -> CryptoPayment:
    """Update local payment record and entitlement from NOWPayments payload."""
    status = payload.get('payment_status') or payload.get('status') or crypto_payment.payment_status
    crypto_payment.payment_status = status
    if payload.get('payment_id') is not None:
        crypto_payment.nowpayments_payment_id = payload.get('payment_id')
    if payload.get('pay_currency'):
        crypto_payment.pay_currency = str(payload.get('pay_currency')).lower().strip()
    if payload.get('pay_amount') is not None:
        crypto_payment.pay_amount = payload.get('pay_amount')
    pay_address = _extract_pay_address(payload)
    if pay_address:
        crypto_payment.pay_address = pay_address
    if payload.get('actually_paid') is not None:
        crypto_payment.actually_paid = payload.get('actually_paid')
    crypto_payment.provider_payload = _merge_provider_payload(crypto_payment, payload)
    crypto_payment.save()

    if _should_fulfill_payment(status, payload, crypto_payment):
        _fulfill_if_needed(crypto_payment)

    return crypto_payment


def _reuse_or_refresh_open_payment(queryset):
    existing = queryset.filter(payment_status__in=OPEN_PAYMENT_STATUSES).order_by('-created_at').first()
    if not existing:
        return None
    try:
        return refresh_crypto_payment_from_nowpayments(existing)
    except NOWPaymentsError:
        if existing.invoice_url:
            return existing
    return None


def create_event_registration_payment(*, event_registration: EventRegistration, user, pay_currency=None) -> CryptoPayment:
    if event_registration.user_id != user.id:
        raise PermissionError('Solo el participante puede iniciar el pago.')
    if event_registration.registration_status != 'REGISTERED':
        raise ValueError('El registro no está activo.')
    if event_registration.payment_status == 'PAID':
        raise ValueError('Este registro ya está pagado.')

    event = event_registration.event
    if not event.reference_price or event.reference_price <= 0:
        raise ValueError('Este evento no requiere pago.')

    client = NOWPaymentsClient()
    if not client.configured:
        raise NOWPaymentsError('La pasarela de pagos no está configurada en el servidor.')

    reused = _reuse_or_refresh_open_payment(
        CryptoPayment.objects.filter(event_registration=event_registration)
    )
    if reused:
        return reused

    from django.conf import settings

    order_id = f'evt-reg-{event_registration.id}-{uuid.uuid4().hex[:12]}'
    ipn_url = f'{_public_base_url()}/api/payments/ipn/'
    frontend_base = getattr(settings, 'FRONTEND_PUBLIC_URL', 'http://localhost:5173').rstrip('/')
    event_url = f'{frontend_base}/events/{event.id}'

    order_description = f'Registro: {prepare_text_for_db(event.title)}'
    payload = client.create_invoice(
        price_amount=float(event.reference_price),
        price_currency='usd',
        order_id=order_id,
        order_description=order_description,
        ipn_callback_url=ipn_url,
        success_url=event_url,
        cancel_url=event_url,
    )

    invoice_url = payload.get('invoice_url') or ''
    if not invoice_url:
        raise NOWPaymentsError('NOWPayments no devolvió invoice_url.')

    logger.info(
        'NOWPayments invoice created order=%s event_registration=%s invoice_id=%s',
        order_id,
        event_registration.id,
        payload.get('id'),
    )

    stored_payload = prepare_json_for_db(payload)
    if payload.get('id') is not None and not stored_payload.get('invoice_id'):
        stored_payload['invoice_id'] = payload.get('id')

    with transaction.atomic():
        crypto_payment = CryptoPayment.objects.create(
            event_registration=event_registration,
            order_id=order_id,
            nowpayments_payment_id=payload.get('id'),
            pay_currency=(pay_currency or '').lower().strip(),
            price_amount=float(event.reference_price),
            price_currency='usd',
            payment_status='waiting',
            invoice_url=invoice_url,
            provider_payload=stored_payload,
        )
    return crypto_payment


def get_or_create_path_purchase(*, knowledge_path, user) -> KnowledgePathPurchase:
    if not knowledge_path.is_paid_path:
        raise ValueError('Este camino de conocimiento es gratuito.')
    if knowledge_path.author_id == user.id:
        raise ValueError('El autor ya tiene acceso a este camino.')

    purchase, created = KnowledgePathPurchase.objects.get_or_create(
        user=user,
        knowledge_path=knowledge_path,
        defaults={
            'payment_status': 'PENDING',
            'price_amount': float(knowledge_path.reference_price),
        },
    )
    if not created and purchase.payment_status != 'PAID':
        # Keep price snapshot in sync while still pending
        if purchase.price_amount != float(knowledge_path.reference_price):
            purchase.price_amount = float(knowledge_path.reference_price)
            purchase.save(update_fields=['price_amount', 'updated_at'])
    return purchase


def create_path_purchase_payment(*, path_purchase: KnowledgePathPurchase, user, pay_currency=None) -> CryptoPayment:
    if path_purchase.user_id != user.id:
        raise PermissionError('Solo el comprador puede iniciar el pago.')
    if path_purchase.payment_status == 'PAID':
        raise ValueError('Este camino ya está desbloqueado.')

    knowledge_path = path_purchase.knowledge_path
    if not knowledge_path.is_paid_path:
        raise ValueError('Este camino de conocimiento es gratuito.')

    client = NOWPaymentsClient()
    if not client.configured:
        raise NOWPaymentsError('La pasarela de pagos no está configurada en el servidor.')

    reused = _reuse_or_refresh_open_payment(
        CryptoPayment.objects.filter(path_purchase=path_purchase)
    )
    if reused:
        return reused

    from django.conf import settings

    order_id = f'kp-purchase-{path_purchase.id}-{uuid.uuid4().hex[:12]}'
    ipn_url = f'{_public_base_url()}/api/payments/ipn/'
    frontend_base = getattr(settings, 'FRONTEND_PUBLIC_URL', 'http://localhost:5173').rstrip('/')
    path_url = f'{frontend_base}/knowledge_path/{knowledge_path.id}'

    order_description = f'Camino: {prepare_text_for_db(knowledge_path.title)}'
    price_amount = float(path_purchase.price_amount or knowledge_path.reference_price)
    payload = client.create_invoice(
        price_amount=price_amount,
        price_currency='usd',
        order_id=order_id,
        order_description=order_description,
        ipn_callback_url=ipn_url,
        success_url=path_url,
        cancel_url=path_url,
    )

    invoice_url = payload.get('invoice_url') or ''
    if not invoice_url:
        raise NOWPaymentsError('NOWPayments no devolvió invoice_url.')

    logger.info(
        'NOWPayments invoice created order=%s path_purchase=%s invoice_id=%s',
        order_id,
        path_purchase.id,
        payload.get('id'),
    )

    stored_payload = prepare_json_for_db(payload)
    if payload.get('id') is not None and not stored_payload.get('invoice_id'):
        stored_payload['invoice_id'] = payload.get('id')

    with transaction.atomic():
        crypto_payment = CryptoPayment.objects.create(
            path_purchase=path_purchase,
            order_id=order_id,
            nowpayments_payment_id=payload.get('id'),
            pay_currency=(pay_currency or '').lower().strip(),
            price_amount=price_amount,
            price_currency='usd',
            payment_status='waiting',
            invoice_url=invoice_url,
            provider_payload=stored_payload,
        )
    return crypto_payment
