import json
import logging

from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from events.models import EventRegistration
from payments.models import CryptoPayment
from payments.nowpayments_client import NOWPaymentsClient, NOWPaymentsError
from payments.serializers import CryptoPaymentSerializer
from payments.services import (
    ALLOWED_PAY_CURRENCIES,
    OPEN_PAYMENT_STATUSES,
    create_event_registration_payment,
    refresh_crypto_payment_from_nowpayments,
    sync_payment_from_provider,
)

logger = logging.getLogger(__name__)


def _find_crypto_payment_for_ipn(body: dict):
    """Resolve CryptoPayment from NOWPayments IPN payload (payment or invoice flow)."""
    order_id = body.get('order_id')
    if order_id:
        try:
            return CryptoPayment.objects.select_related('registration').get(order_id=order_id)
        except CryptoPayment.DoesNotExist:
            pass

    invoice_id = body.get('invoice_id')
    if invoice_id is not None:
        payment = CryptoPayment.objects.filter(nowpayments_payment_id=invoice_id).first()
        if payment:
            return payment
        payment = CryptoPayment.objects.filter(provider_payload__invoice_id=invoice_id).first()
        if payment:
            return payment
        payment = CryptoPayment.objects.filter(provider_payload__id=invoice_id).first()
        if payment:
            return payment

    payment_id = body.get('payment_id')
    if payment_id is not None:
        payment = CryptoPayment.objects.filter(nowpayments_payment_id=payment_id).first()
        if payment:
            return payment
        payment = CryptoPayment.objects.filter(provider_payload__payment_id=payment_id).first()
        if payment:
            return payment

    return None


class PaymentGatewayStatusView(APIView):
    """Public info about whether crypto payments are enabled."""

    permission_classes = [AllowAny]

    def get(self, request):
        client = NOWPaymentsClient()
        return Response({
            'enabled': client.configured,
            'currencies': sorted(ALLOWED_PAY_CURRENCIES),
            'provider': 'nowpayments',
        })


class EventRegistrationPaymentView(APIView):
    """Create or refresh a NOWPayments invoice for an event registration."""

    permission_classes = [IsAuthenticated]

    def post(self, request, registration_id):
        pay_currency = (request.data.get('pay_currency') or '').lower().strip() or None

        try:
            registration = EventRegistration.objects.select_related('event', 'user').get(pk=registration_id)
        except EventRegistration.DoesNotExist:
            return Response({'error': 'Registro no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        logger.info(
            'Payment create request registration=%s user=%s event=%s',
            registration_id,
            request.user.id,
            registration.event_id,
        )

        try:
            payment = create_event_registration_payment(
                registration=registration,
                pay_currency=pay_currency,
                user=request.user,
            )
        except PermissionError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_403_FORBIDDEN)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except NOWPaymentsError as exc:
            logger.warning(
                'NOWPayments error for registration=%s: %s',
                registration_id,
                exc,
            )
            return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        except Exception as exc:
            logger.error(
                'Unexpected error creating payment for registration=%s: %s',
                registration_id,
                exc,
                exc_info=True,
            )
            return Response(
                {'error': 'No se pudo iniciar el pago. Inténtelo de nuevo.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        logger.info(
            'Payment created id=%s order=%s registration=%s',
            payment.id,
            payment.order_id,
            registration_id,
        )
        return Response(CryptoPaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class CryptoPaymentDetailView(APIView):
    """Poll payment status (syncs with NOWPayments)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, payment_id):
        try:
            payment = CryptoPayment.objects.select_related('registration', 'registration__user').get(pk=payment_id)
        except CryptoPayment.DoesNotExist:
            return Response({'error': 'Pago no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        if payment.registration.user_id != request.user.id and payment.registration.event.owner_id != request.user.id:
            return Response({'error': 'Permiso denegado.'}, status=status.HTTP_403_FORBIDDEN)

        client = NOWPaymentsClient()
        if client.configured:
            try:
                payment = refresh_crypto_payment_from_nowpayments(payment)
            except NOWPaymentsError as exc:
                logger.warning('Could not refresh payment %s: %s', payment_id, exc)

        return Response(CryptoPaymentSerializer(payment).data)


class RegistrationPaymentsListView(APIView):
    """List payments for a registration (participant or event owner)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, registration_id):
        try:
            registration = EventRegistration.objects.select_related('event').get(pk=registration_id)
        except EventRegistration.DoesNotExist:
            return Response({'error': 'Registro no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        if registration.user_id != request.user.id and registration.event.owner_id != request.user.id:
            return Response({'error': 'Permiso denegado.'}, status=status.HTTP_403_FORBIDDEN)

        payments = CryptoPayment.objects.filter(registration=registration).order_by('-created_at')[:10]
        client = NOWPaymentsClient()
        if client.configured:
            refreshed = []
            for payment in payments:
                if payment.payment_status in OPEN_PAYMENT_STATUSES:
                    try:
                        payment = refresh_crypto_payment_from_nowpayments(payment)
                    except NOWPaymentsError as exc:
                        logger.warning(
                            'Could not refresh payment %s for registration %s: %s',
                            payment.id,
                            registration_id,
                            exc,
                        )
                refreshed.append(payment)
            payments = refreshed
        return Response(CryptoPaymentSerializer(payments, many=True).data)


@method_decorator(csrf_exempt, name='dispatch')
class NOWPaymentsIPNView(APIView):
    """Instant Payment Notification webhook from NOWPayments."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        try:
            raw = request.body.decode('utf-8') if request.body else ''
            body = json.loads(raw) if raw else {}
        except (json.JSONDecodeError, TypeError, UnicodeDecodeError):
            return Response({'error': 'Invalid JSON'}, status=status.HTTP_400_BAD_REQUEST)

        signature = request.headers.get('x-nowpayments-sig', '')
        client = NOWPaymentsClient()

        if getattr(settings, 'ENVIRONMENT', '') == 'PRODUCTION' and not client.ipn_secret:
            logger.error('NOWPayments IPN rejected: IPN secret not configured in production')
            return Response({'error': 'IPN not configured'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        if not client.ipn_secret:
            logger.warning('NOWPayments IPN accepted without signature verification (dev only)')
        elif not signature:
            return Response({'error': 'Missing signature'}, status=status.HTTP_403_FORBIDDEN)
        elif not client.verify_ipn_signature(body, signature):
            logger.warning('NOWPayments IPN signature mismatch for order %s', body.get('order_id'))
            return Response({'error': 'Invalid signature'}, status=status.HTTP_403_FORBIDDEN)

        order_id = body.get('order_id')
        payment = _find_crypto_payment_for_ipn(body)
        if payment is None:
            logger.warning(
                'IPN for unknown payment (order_id=%s, invoice_id=%s, payment_id=%s)',
                order_id,
                body.get('invoice_id'),
                body.get('payment_id'),
            )
            return Response({'status': 'ignored'}, status=status.HTTP_200_OK)

        sync_payment_from_provider(payment, body)
        logger.info(
            'IPN processed for order %s — status %s',
            payment.order_id,
            body.get('payment_status'),
        )
        return Response({'status': 'ok'})
