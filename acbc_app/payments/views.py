import json
import logging

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
    create_event_registration_payment,
    sync_payment_from_provider,
)

logger = logging.getLogger(__name__)


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
        pay_currency = request.data.get('pay_currency', '').lower().strip()
        if not pay_currency:
            return Response({'error': 'pay_currency es requerido (bch o xmr).'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            registration = EventRegistration.objects.select_related('event', 'user').get(pk=registration_id)
        except EventRegistration.DoesNotExist:
            return Response({'error': 'Registro no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

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
            return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

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
        if client.configured and payment.nowpayments_payment_id:
            try:
                remote = client.get_payment_status(payment.nowpayments_payment_id)
                payment = sync_payment_from_provider(payment, remote)
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
        return Response(CryptoPaymentSerializer(payments, many=True).data)


@method_decorator(csrf_exempt, name='dispatch')
class NOWPaymentsIPNView(APIView):
    """Instant Payment Notification webhook from NOWPayments."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        try:
            body = request.data if hasattr(request, 'data') and request.data else json.loads(request.body)
        except (json.JSONDecodeError, TypeError):
            return Response({'error': 'Invalid JSON'}, status=status.HTTP_400_BAD_REQUEST)

        signature = request.headers.get('x-nowpayments-sig', '')
        client = NOWPaymentsClient()

        if client.ipn_secret and not client.verify_ipn_signature(body, signature):
            logger.warning('NOWPayments IPN signature mismatch for order %s', body.get('order_id'))
            return Response({'error': 'Invalid signature'}, status=status.HTTP_403_FORBIDDEN)

        order_id = body.get('order_id')
        if not order_id:
            return Response({'error': 'order_id missing'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payment = CryptoPayment.objects.select_related('registration').get(order_id=order_id)
        except CryptoPayment.DoesNotExist:
            logger.warning('IPN for unknown order_id: %s', order_id)
            return Response({'status': 'ignored'}, status=status.HTTP_200_OK)

        sync_payment_from_provider(payment, body)
        logger.info('IPN processed for order %s — status %s', order_id, body.get('payment_status'))
        return Response({'status': 'ok'})
