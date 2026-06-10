import logging
import uuid
from decimal import Decimal

from django.db import transaction

from events.models import EventRegistration
from payments.models import CryptoPayment
from payments.nowpayments_client import NOWPaymentsClient, NOWPaymentsError
from payments.handlers import on_crypto_payment_completed
from utils.notification_utils import notify_payment_accepted

logger = logging.getLogger(__name__)

ALLOWED_PAY_CURRENCIES = {'bch', 'xmr'}
# NOWPayments: only "finished" means funds reached the merchant wallet (safe to fulfill).
# "confirmed" is on-chain only — proceed only if you validate actually_paid vs pay_amount.
REGISTRATION_PAID_STATUS = 'finished'
OPEN_PAYMENT_STATUSES = ('waiting', 'confirming', 'confirmed', 'sending', 'partially_paid')


def _extract_pay_address(payload: dict) -> str:
    return payload.get('pay_address') or payload.get('payment_address') or ''


def _public_base_url():
    from django.conf import settings
    return getattr(settings, 'ACADEMIA_PUBLIC_URL', 'http://localhost:8000').rstrip('/')


def is_payments_gateway_configured() -> bool:
    return NOWPaymentsClient().configured


def _should_mark_registration_paid(status: str, payload: dict, crypto_payment: CryptoPayment) -> bool:
    if status != REGISTRATION_PAID_STATUS:
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


def _mark_registration_paid_if_needed(crypto_payment: CryptoPayment) -> None:
    with transaction.atomic():
        registration = EventRegistration.objects.select_for_update().get(
            pk=crypto_payment.registration_id
        )
        if registration.payment_status == 'PAID':
            return
        registration.payment_status = 'PAID'
        registration.save(update_fields=['payment_status'])

    registration = EventRegistration.objects.select_related('event', 'event__owner', 'user').get(
        pk=crypto_payment.registration_id
    )
    try:
        notify_payment_accepted(registration)
    except Exception as exc:
        logger.error('Payment notification failed for registration %s: %s', registration.id, exc)
    try:
        on_crypto_payment_completed(crypto_payment, registration)
    except Exception as exc:
        logger.error(
            'on_crypto_payment_completed failed for registration %s: %s',
            registration.id,
            exc,
            exc_info=True,
        )


def sync_payment_from_provider(crypto_payment: CryptoPayment, payload: dict) -> CryptoPayment:
    """Update local payment record and registration from NOWPayments payload."""
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
    crypto_payment.provider_payload = payload
    crypto_payment.save()

    if _should_mark_registration_paid(status, payload, crypto_payment):
        _mark_registration_paid_if_needed(crypto_payment)

    return crypto_payment


def create_event_registration_payment(*, registration: EventRegistration, user, pay_currency=None) -> CryptoPayment:
    if registration.user_id != user.id:
        raise PermissionError('Solo el participante puede iniciar el pago.')
    if registration.registration_status != 'REGISTERED':
        raise ValueError('El registro no está activo.')
    if registration.payment_status == 'PAID':
        raise ValueError('Este registro ya está pagado.')

    event = registration.event
    if not event.reference_price or event.reference_price <= 0:
        raise ValueError('Este evento no requiere pago.')

    client = NOWPaymentsClient()
    if not client.configured:
        raise NOWPaymentsError('La pasarela de pagos no está configurada en el servidor.')

    existing = (
        CryptoPayment.objects.filter(
            registration=registration,
            payment_status__in=OPEN_PAYMENT_STATUSES,
        )
        .order_by('-created_at')
        .first()
    )
    if existing:
        if existing.invoice_url:
            return existing
        if existing.nowpayments_payment_id:
            try:
                remote = client.get_payment_status(existing.nowpayments_payment_id)
                return sync_payment_from_provider(existing, remote)
            except NOWPaymentsError:
                pass

    from django.conf import settings

    order_id = f'evt-reg-{registration.id}-{uuid.uuid4().hex[:12]}'
    ipn_url = f'{_public_base_url()}/api/payments/ipn/'
    frontend_base = getattr(settings, 'FRONTEND_PUBLIC_URL', 'http://localhost:5173').rstrip('/')
    event_url = f'{frontend_base}/events/{event.id}'

    payload = client.create_invoice(
        price_amount=float(event.reference_price),
        price_currency='usd',
        order_id=order_id,
        order_description=f'Registro: {event.title}',
        ipn_callback_url=ipn_url,
        success_url=event_url,
        cancel_url=event_url,
    )

    invoice_url = payload.get('invoice_url') or ''
    if not invoice_url:
        raise NOWPaymentsError('NOWPayments no devolvió invoice_url.')

    with transaction.atomic():
        crypto_payment = CryptoPayment.objects.create(
            registration=registration,
            order_id=order_id,
            nowpayments_payment_id=payload.get('id'),
            pay_currency=(pay_currency or '').lower().strip(),
            price_amount=float(event.reference_price),
            price_currency='usd',
            payment_status='waiting',
            invoice_url=invoice_url,
            provider_payload=payload,
        )
    return crypto_payment
