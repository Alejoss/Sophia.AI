import logging
import uuid

from django.conf import settings
from django.db import transaction

from events.models import EventRegistration
from payments.models import CryptoPayment
from payments.nowpayments_client import NOWPaymentsClient, NOWPaymentsError
from utils.notification_utils import notify_payment_accepted

logger = logging.getLogger(__name__)

ALLOWED_PAY_CURRENCIES = {'bch', 'xmr'}
TERMINAL_SUCCESS = {'finished', 'confirmed'}


def _public_base_url():
    return getattr(settings, 'ACADEMIA_PUBLIC_URL', 'http://localhost:8000').rstrip('/')


def _frontend_base_url():
    return getattr(settings, 'FRONTEND_PUBLIC_URL', 'http://localhost:5173').rstrip('/')


def sync_payment_from_provider(crypto_payment: CryptoPayment, payload: dict) -> CryptoPayment:
    """Update local payment record and registration from NOWPayments payload."""
    status = payload.get('payment_status') or payload.get('status') or crypto_payment.payment_status
    crypto_payment.payment_status = status
    if payload.get('pay_amount') is not None:
        crypto_payment.pay_amount = payload.get('pay_amount')
    if payload.get('pay_address'):
        crypto_payment.pay_address = payload.get('pay_address')
    if payload.get('actually_paid') is not None:
        crypto_payment.actually_paid = payload.get('actually_paid')
    crypto_payment.provider_payload = payload
    crypto_payment.save()

    if status in TERMINAL_SUCCESS:
        registration = crypto_payment.registration
        if registration.payment_status != 'PAID':
            registration.payment_status = 'PAID'
            registration.save(update_fields=['payment_status'])
            try:
                notify_payment_accepted(registration)
            except Exception as exc:
                logger.error('Payment notification failed for registration %s: %s', registration.id, exc)

    return crypto_payment


@transaction.atomic
def create_event_registration_payment(*, registration: EventRegistration, pay_currency: str, user) -> CryptoPayment:
    if registration.user_id != user.id:
        raise PermissionError('Solo el participante puede iniciar el pago.')
    if registration.registration_status != 'REGISTERED':
        raise ValueError('El registro no está activo.')
    if registration.payment_status == 'PAID':
        raise ValueError('Este registro ya está pagado.')

    event = registration.event
    if not event.reference_price or event.reference_price <= 0:
        raise ValueError('Este evento no requiere pago.')

    pay_currency = pay_currency.lower().strip()
    if pay_currency not in ALLOWED_PAY_CURRENCIES:
        raise ValueError('Moneda no soportada. Use BCH o XMR.')

    client = NOWPaymentsClient()
    if not client.configured:
        raise NOWPaymentsError('La pasarela de pagos no está configurada en el servidor.')

    # Reuse open payment for same currency if still waiting
    existing = (
        CryptoPayment.objects.filter(
            registration=registration,
            pay_currency=pay_currency,
            payment_status__in=('waiting', 'confirming', 'confirmed', 'sending', 'partially_paid'),
        )
        .order_by('-created_at')
        .first()
    )
    if existing and existing.nowpayments_payment_id:
        try:
            remote = client.get_payment_status(existing.nowpayments_payment_id)
            return sync_payment_from_provider(existing, remote)
        except NOWPaymentsError:
            pass

    order_id = f'evt-reg-{registration.id}-{uuid.uuid4().hex[:12]}'
    ipn_url = f'{_public_base_url()}/api/payments/ipn/'
    success_url = f'{_frontend_base_url()}/events/{event.id}?payment=success'
    cancel_url = f'{_frontend_base_url()}/events/{event.id}?payment=cancelled'

    payload = client.create_payment(
        price_amount=float(event.reference_price),
        price_currency='usd',
        pay_currency=pay_currency,
        order_id=order_id,
        order_description=f'Registro: {event.title}',
        ipn_callback_url=ipn_url,
        success_url=success_url,
        cancel_url=cancel_url,
    )

    crypto_payment = CryptoPayment.objects.create(
        registration=registration,
        order_id=order_id,
        nowpayments_payment_id=payload.get('payment_id'),
        pay_currency=pay_currency,
        price_amount=float(event.reference_price),
        price_currency='usd',
        pay_amount=payload.get('pay_amount'),
        pay_address=payload.get('pay_address', ''),
        payment_status=payload.get('payment_status', 'waiting'),
        invoice_url=payload.get('invoice_url', '') or payload.get('payment_url', '') or '',
        provider_payload=payload,
    )
    return crypto_payment
