import json
import logging

from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from content.models import Topic, TopicPurchase, TranscriptAnchorRequest
from events.models import EventRegistration
from knowledge_paths.models import KnowledgePath, KnowledgePathPurchase
from payments.bch_client import get_bch_network, is_bch_direct_configured
from payments.bch_services import (
    BchPaymentError,
    create_or_reuse_bch_payment,
    verify_bch_payment,
)
from payments.models import BchDirectPayment, CryptoPayment
from payments.nowpayments_client import NOWPaymentsClient, NOWPaymentsError
from payments.serializers import BchDirectPaymentSerializer, CryptoPaymentSerializer
from payments.services import (
    ALLOWED_PAY_CURRENCIES,
    OPEN_PAYMENT_STATUSES,
    create_anchor_request_payment,
    create_event_registration_payment,
    create_path_purchase_payment,
    refresh_crypto_payment_from_nowpayments,
    sync_payment_from_provider,
)
from content.serializers import TranscriptAnchorRequestSerializer

logger = logging.getLogger(__name__)


def _ctx_bits(**ctx):
    return ' '.join(f'{key}={value}' for key, value in ctx.items() if value is not None)


def _bch_error_response(exc, *, action, **ctx):
    """
    Log BCH business/infra failures at the HTTP boundary.

    Infrastructure errors are also logged in bch_services; this adds the
    endpoint + entitlement ids that operators grep for in access logs.
    """
    logger.warning('BCH %s failed %s: %s', action, _ctx_bits(**ctx), exc)
    return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


def _permission_error_response(exc, *, action, **ctx):
    logger.info('Payment %s forbidden %s: %s', action, _ctx_bits(**ctx), exc)
    return Response({'error': str(exc)}, status=status.HTTP_403_FORBIDDEN)


def _validation_error_response(exc, *, action, **ctx):
    logger.info('Payment %s rejected %s: %s', action, _ctx_bits(**ctx), exc)
    return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


def _nowpayments_error_response(exc, *, action, **ctx):
    logger.warning('NOWPayments %s failed %s: %s', action, _ctx_bits(**ctx), exc)
    return Response({'error': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)


def _unexpected_payment_error_response(exc, *, action, public_message, **ctx):
    logger.error(
        'Unexpected error during payment %s %s: %s',
        action,
        _ctx_bits(**ctx),
        exc,
        exc_info=True,
    )
    return Response({'error': public_message}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


def _find_crypto_payment_for_ipn(body: dict):
    """Resolve CryptoPayment from NOWPayments IPN payload (payment or invoice flow)."""
    order_id = body.get('order_id')
    if order_id:
        try:
            return CryptoPayment.objects.select_related(
                'event_registration',
                'path_purchase',
                'anchor_request',
            ).get(order_id=order_id)
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


def _user_can_access_payment(user, payment: CryptoPayment) -> bool:
    if payment.event_registration_id:
        reg = payment.event_registration
        return user.id in (reg.user_id, reg.event.owner_id)
    if payment.path_purchase_id:
        purchase = payment.path_purchase
        return user.id in (purchase.user_id, purchase.knowledge_path.author_id)
    if payment.anchor_request_id:
        return user.id == payment.anchor_request.requester_id or user.is_staff
    return False


class PaymentGatewayStatusView(APIView):
    """Public info about whether crypto payments are enabled."""

    permission_classes = [AllowAny]

    def get(self, request):
        client = NOWPaymentsClient()
        return Response({
            'enabled': client.configured,
            'currencies': sorted(ALLOWED_PAY_CURRENCIES),
            'provider': 'nowpayments',
            'bch_direct_enabled': is_bch_direct_configured(),
            'bch_network': get_bch_network(),
            'methods': {
                'nowpayments': client.configured,
                'bch_direct': is_bch_direct_configured(),
            },
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
            'Payment create request event_registration=%s user=%s event=%s',
            registration_id,
            request.user.id,
            registration.event_id,
        )

        try:
            payment = create_event_registration_payment(
                event_registration=registration,
                pay_currency=pay_currency,
                user=request.user,
            )
        except PermissionError as exc:
            return _permission_error_response(
                exc, action='create_event_payment', registration_id=registration_id, user_id=request.user.id,
            )
        except ValueError as exc:
            return _validation_error_response(
                exc, action='create_event_payment', registration_id=registration_id, user_id=request.user.id,
            )
        except NOWPaymentsError as exc:
            return _nowpayments_error_response(
                exc, action='create_event_payment', registration_id=registration_id, user_id=request.user.id,
            )
        except Exception as exc:
            return _unexpected_payment_error_response(
                exc,
                action='create_event_payment',
                public_message='No se pudo iniciar el pago. Inténtelo de nuevo.',
                registration_id=registration_id,
                user_id=request.user.id,
            )

        logger.info(
            'Payment created id=%s order=%s event_registration=%s',
            payment.id,
            payment.order_id,
            registration_id,
        )
        return Response(CryptoPaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class PathPurchasePaymentView(APIView):
    """Create or refresh a NOWPayments invoice for a knowledge path purchase."""

    permission_classes = [IsAuthenticated]

    def post(self, request, purchase_id):
        pay_currency = (request.data.get('pay_currency') or '').lower().strip() or None

        try:
            purchase = KnowledgePathPurchase.objects.select_related(
                'knowledge_path', 'user'
            ).get(pk=purchase_id)
        except KnowledgePathPurchase.DoesNotExist:
            return Response({'error': 'Compra no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            payment = create_path_purchase_payment(
                path_purchase=purchase,
                pay_currency=pay_currency,
                user=request.user,
            )
        except PermissionError as exc:
            return _permission_error_response(
                exc, action='create_path_payment', purchase_id=purchase_id, user_id=request.user.id,
            )
        except ValueError as exc:
            return _validation_error_response(
                exc, action='create_path_payment', purchase_id=purchase_id, user_id=request.user.id,
            )
        except NOWPaymentsError as exc:
            return _nowpayments_error_response(
                exc, action='create_path_payment', purchase_id=purchase_id, user_id=request.user.id,
            )
        except Exception as exc:
            return _unexpected_payment_error_response(
                exc,
                action='create_path_payment',
                public_message='No se pudo iniciar el pago. Inténtelo de nuevo.',
                purchase_id=purchase_id,
                user_id=request.user.id,
            )

        return Response(CryptoPaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class CryptoPaymentDetailView(APIView):
    """Poll payment status (syncs with NOWPayments)."""

    permission_classes = [IsAuthenticated]

    def get(self, request, payment_id):
        try:
            payment = CryptoPayment.objects.select_related(
                'event_registration',
                'event_registration__user',
                'event_registration__event',
                'path_purchase',
                'path_purchase__user',
                'path_purchase__knowledge_path',
                'anchor_request',
                'anchor_request__requester',
            ).get(pk=payment_id)
        except CryptoPayment.DoesNotExist:
            return Response({'error': 'Pago no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        if not _user_can_access_payment(request.user, payment):
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

        payments = CryptoPayment.objects.filter(event_registration=registration).order_by('-created_at')[:10]
        client = NOWPaymentsClient()
        if client.configured:
            refreshed = []
            for payment in payments:
                if payment.payment_status in OPEN_PAYMENT_STATUSES:
                    try:
                        payment = refresh_crypto_payment_from_nowpayments(payment)
                    except NOWPaymentsError as exc:
                        logger.warning(
                            'Could not refresh payment %s for event_registration %s: %s',
                            payment.id,
                            registration_id,
                            exc,
                        )
                refreshed.append(payment)
            payments = refreshed
        return Response(CryptoPaymentSerializer(payments, many=True).data)


class PathPurchasePaymentsListView(APIView):
    """List payments for a knowledge path purchase."""

    permission_classes = [IsAuthenticated]

    def get(self, request, purchase_id):
        try:
            purchase = KnowledgePathPurchase.objects.select_related('knowledge_path').get(pk=purchase_id)
        except KnowledgePathPurchase.DoesNotExist:
            return Response({'error': 'Compra no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        if purchase.user_id != request.user.id and purchase.knowledge_path.author_id != request.user.id:
            return Response({'error': 'Permiso denegado.'}, status=status.HTTP_403_FORBIDDEN)

        payments = CryptoPayment.objects.filter(path_purchase=purchase).order_by('-created_at')[:10]
        client = NOWPaymentsClient()
        if client.configured:
            refreshed = []
            for payment in payments:
                if payment.payment_status in OPEN_PAYMENT_STATUSES:
                    try:
                        payment = refresh_crypto_payment_from_nowpayments(payment)
                    except NOWPaymentsError as exc:
                        logger.warning(
                            'Could not refresh payment %s for path_purchase %s: %s',
                            payment.id,
                            purchase_id,
                            exc,
                        )
                refreshed.append(payment)
            payments = refreshed
        return Response(CryptoPaymentSerializer(payments, many=True).data)


class AnchorRequestPaymentView(APIView):
    """Create or refresh a NOWPayments invoice for a transcript anchor request."""

    permission_classes = [IsAuthenticated]

    def post(self, request, request_id):
        pay_currency = (request.data.get('pay_currency') or '').lower().strip() or None
        try:
            anchor_request = TranscriptAnchorRequest.objects.select_related(
                'content', 'requester'
            ).get(pk=request_id)
        except TranscriptAnchorRequest.DoesNotExist:
            return Response({'error': 'Solicitud no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            payment = create_anchor_request_payment(
                anchor_request=anchor_request,
                pay_currency=pay_currency,
                user=request.user,
            )
        except PermissionError as exc:
            return _permission_error_response(
                exc, action='create_anchor_payment', request_id=request_id, user_id=request.user.id,
            )
        except ValueError as exc:
            return _validation_error_response(
                exc, action='create_anchor_payment', request_id=request_id, user_id=request.user.id,
            )
        except NOWPaymentsError as exc:
            return _nowpayments_error_response(
                exc, action='create_anchor_payment', request_id=request_id, user_id=request.user.id,
            )
        except Exception as exc:
            return _unexpected_payment_error_response(
                exc,
                action='create_anchor_payment',
                public_message='No se pudo iniciar el pago. Inténtelo de nuevo.',
                request_id=request_id,
                user_id=request.user.id,
            )

        return Response(CryptoPaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class AnchorRequestPaymentsListView(APIView):
    """List payments for an anchor request."""

    permission_classes = [IsAuthenticated]

    def get(self, request, request_id):
        try:
            anchor_request = TranscriptAnchorRequest.objects.get(pk=request_id)
        except TranscriptAnchorRequest.DoesNotExist:
            return Response({'error': 'Solicitud no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        if anchor_request.requester_id != request.user.id and not request.user.is_staff:
            return Response({'error': 'Permiso denegado.'}, status=status.HTTP_403_FORBIDDEN)

        payments = CryptoPayment.objects.filter(anchor_request=anchor_request).order_by('-created_at')[:10]
        client = NOWPaymentsClient()
        if client.configured:
            refreshed = []
            for payment in payments:
                if payment.payment_status in OPEN_PAYMENT_STATUSES:
                    try:
                        payment = refresh_crypto_payment_from_nowpayments(payment)
                    except NOWPaymentsError as exc:
                        logger.warning(
                            'Could not refresh payment %s for anchor_request %s: %s',
                            payment.id,
                            request_id,
                            exc,
                        )
                refreshed.append(payment)
            payments = refreshed
        return Response(CryptoPaymentSerializer(payments, many=True).data)


class AnchorRequestBchPaymentView(APIView):
    """
    GET  — current pending/paid BCH direct order for an anchor request.
    POST — create or reuse a BCH exact-amount order.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, request_id):
        try:
            anchor_request = TranscriptAnchorRequest.objects.get(pk=request_id)
        except TranscriptAnchorRequest.DoesNotExist:
            return Response({'error': 'Solicitud no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        if anchor_request.requester_id != request.user.id and not request.user.is_staff:
            return Response({'error': 'Permiso denegado.'}, status=status.HTTP_403_FORBIDDEN)

        payment = (
            BchDirectPayment.objects.filter(anchor_request=anchor_request)
            .order_by('-created_at')
            .first()
        )
        if payment is None:
            return Response({
                'payment': None,
                'bch_direct_enabled': is_bch_direct_configured(),
                'bch_network': get_bch_network(),
            })
        payment.mark_expired_if_needed()
        return Response({
            'payment': BchDirectPaymentSerializer(payment).data,
            'bch_direct_enabled': is_bch_direct_configured(),
            'bch_network': get_bch_network(),
            'request': TranscriptAnchorRequestSerializer(anchor_request).data,
        })

    def post(self, request, request_id):
        try:
            anchor_request = TranscriptAnchorRequest.objects.select_related(
                'content', 'requester'
            ).get(pk=request_id)
        except TranscriptAnchorRequest.DoesNotExist:
            return Response({'error': 'Solicitud no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            payment = create_or_reuse_bch_payment(
                anchor_request=anchor_request,
                user=request.user,
            )
        except PermissionError as exc:
            return _permission_error_response(
                exc, action='create_anchor_bch', request_id=request_id, user_id=request.user.id,
            )
        except BchPaymentError as exc:
            return _bch_error_response(
                exc, action='create_anchor_bch', request_id=request_id, user_id=request.user.id,
            )
        except Exception as exc:
            return _unexpected_payment_error_response(
                exc,
                action='create_anchor_bch',
                public_message='No se pudo crear la orden BCH. Inténtelo de nuevo.',
                request_id=request_id,
                user_id=request.user.id,
            )

        return Response(
            BchDirectPaymentSerializer(payment).data,
            status=status.HTTP_201_CREATED,
        )


class AnchorRequestBchVerifyView(APIView):
    """User-triggered on-chain verification for a BCH direct order."""

    permission_classes = [IsAuthenticated]

    def post(self, request, request_id):
        try:
            anchor_request = TranscriptAnchorRequest.objects.select_related(
                'content', 'requester'
            ).get(pk=request_id)
        except TranscriptAnchorRequest.DoesNotExist:
            return Response({'error': 'Solicitud no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            payment = verify_bch_payment(
                anchor_request=anchor_request,
                user=request.user,
            )
        except PermissionError as exc:
            return _permission_error_response(
                exc, action='verify_anchor_bch', request_id=request_id, user_id=request.user.id,
            )
        except BchPaymentError as exc:
            return _bch_error_response(
                exc, action='verify_anchor_bch', request_id=request_id, user_id=request.user.id,
            )
        except Exception as exc:
            return _unexpected_payment_error_response(
                exc,
                action='verify_anchor_bch',
                public_message='No se pudo verificar el pago BCH. Inténtelo de nuevo.',
                request_id=request_id,
                user_id=request.user.id,
            )

        anchor_request.refresh_from_db()
        return Response({
            'payment': BchDirectPaymentSerializer(payment).data,
            'request': TranscriptAnchorRequestSerializer(anchor_request).data,
        })


@method_decorator(csrf_exempt, name='dispatch')
class NOWPaymentsIPNView(APIView):
    """Instant Payment Notification webhook from NOWPayments."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        try:
            raw = request.body.decode('utf-8') if request.body else ''
            body = json.loads(raw) if raw else {}
        except (json.JSONDecodeError, TypeError, UnicodeDecodeError) as exc:
            logger.warning('NOWPayments IPN rejected: invalid JSON (%s)', exc)
            return Response({'error': 'Invalid JSON'}, status=status.HTTP_400_BAD_REQUEST)

        signature = request.headers.get('x-nowpayments-sig', '')
        client = NOWPaymentsClient()

        if getattr(settings, 'ENVIRONMENT', '') == 'PRODUCTION' and not client.ipn_secret:
            logger.error('NOWPayments IPN rejected: IPN secret not configured in production')
            return Response({'error': 'IPN not configured'}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        if not client.ipn_secret:
            logger.warning('NOWPayments IPN accepted without signature verification (dev only)')
        elif not signature:
            logger.warning('NOWPayments IPN rejected: missing signature for order %s', body.get('order_id'))
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


def _latest_bch_for(**filters):
    payment = (
        BchDirectPayment.objects.filter(**filters)
        .order_by('-created_at')
        .first()
    )
    if payment:
        payment.mark_expired_if_needed()
    return payment


class AdminBchCatalogView(APIView):
    """Staff dashboard: knowledge paths and topics that can accept BCH."""

    permission_classes = [IsAuthenticated, IsAdminUser]

    def get(self, request):
        paths = KnowledgePath.objects.select_related('author').order_by('title')
        topics = Topic.objects.select_related('creator').order_by('title')
        configured = is_bch_direct_configured()
        return Response({
            'bch_direct_configured': configured,
            'bch_direct_enabled': configured,
            'bch_network': get_bch_network(),
            'knowledge_paths': [
                {
                    'id': path.id,
                    'title': path.title,
                    'author': path.author.username if path.author_id else None,
                    'is_visible': path.is_visible,
                    'reference_price': path.reference_price or 0,
                    'is_paid_path': path.is_paid_path,
                    'bch_direct_enabled': path.bch_direct_enabled,
                    'bch_direct_available': bool(
                        configured and path.bch_direct_enabled and path.is_paid_path
                    ),
                }
                for path in paths
            ],
            'topics': [
                {
                    'id': topic.id,
                    'title': topic.title,
                    'creator': topic.creator.username if topic.creator_id else None,
                    'is_public': topic.is_public,
                    'chat_enabled': topic.chat_enabled,
                    'reference_price': topic.reference_price or 0,
                    'is_paid_topic': topic.is_paid_topic,
                    'bch_direct_enabled': topic.bch_direct_enabled,
                    'bch_direct_available': bool(
                        configured and topic.bch_direct_enabled and topic.is_paid_topic
                    ),
                }
                for topic in topics
            ],
        })


class AdminKnowledgePathBchView(APIView):
    """Staff: activate/deactivate BCH checkout on a knowledge path."""

    permission_classes = [IsAuthenticated, IsAdminUser]

    def patch(self, request, pk):
        path = KnowledgePath.objects.select_related('author').filter(pk=pk).first()
        if path is None:
            return Response({'error': 'Camino no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        if 'bch_direct_enabled' not in request.data:
            return Response(
                {'error': 'Falta bch_direct_enabled.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        enabled = bool(request.data.get('bch_direct_enabled'))
        if enabled and not path.is_paid_path:
            return Response(
                {'error': 'Define un precio mayor a 0 en el camino antes de activar BCH.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        path.bch_direct_enabled = enabled
        path.save(update_fields=['bch_direct_enabled', 'updated_at'])
        return Response({
            'id': path.id,
            'title': path.title,
            'reference_price': path.reference_price or 0,
            'is_paid_path': path.is_paid_path,
            'bch_direct_enabled': path.bch_direct_enabled,
            'bch_direct_available': bool(
                is_bch_direct_configured() and path.bch_direct_enabled and path.is_paid_path
            ),
        })


class AdminTopicBchView(APIView):
    """Staff: set Consultas price and activate BCH on a topic."""

    permission_classes = [IsAuthenticated, IsAdminUser]

    def patch(self, request, pk):
        topic = Topic.objects.select_related('creator').filter(pk=pk).first()
        if topic is None:
            return Response({'error': 'Tema no encontrado.'}, status=status.HTTP_404_NOT_FOUND)

        update_fields = ['updated_at']
        if 'reference_price' in request.data:
            try:
                price = float(request.data.get('reference_price') or 0)
            except (TypeError, ValueError):
                return Response(
                    {'error': 'El precio debe ser un número.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if price < 0:
                return Response(
                    {'error': 'El precio no puede ser negativo.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            topic.reference_price = price
            update_fields.append('reference_price')
            if price <= 0:
                topic.bch_direct_enabled = False
                update_fields.append('bch_direct_enabled')

        if 'bch_direct_enabled' in request.data:
            enabled = bool(request.data.get('bch_direct_enabled'))
            if enabled and not topic.is_paid_topic:
                return Response(
                    {'error': 'Define un precio mayor a 0 antes de activar BCH.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            topic.bch_direct_enabled = enabled
            update_fields.append('bch_direct_enabled')

        topic.save(update_fields=list(dict.fromkeys(update_fields)))
        return Response({
            'id': topic.id,
            'title': topic.title,
            'reference_price': topic.reference_price or 0,
            'is_paid_topic': topic.is_paid_topic,
            'bch_direct_enabled': topic.bch_direct_enabled,
            'bch_direct_available': bool(
                is_bch_direct_configured() and topic.bch_direct_enabled and topic.is_paid_topic
            ),
        })


class PathPurchaseBchPaymentView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_purchase(self, request, purchase_id):
        try:
            return KnowledgePathPurchase.objects.select_related(
                'knowledge_path', 'user'
            ).get(pk=purchase_id)
        except KnowledgePathPurchase.DoesNotExist:
            return None

    def get(self, request, purchase_id):
        purchase = self._get_purchase(request, purchase_id)
        if purchase is None:
            return Response({'error': 'Compra no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        path = purchase.knowledge_path
        if (
            purchase.user_id != request.user.id
            and path.author_id != request.user.id
            and not request.user.is_staff
        ):
            return Response({'error': 'Permiso denegado.'}, status=status.HTTP_403_FORBIDDEN)
        payment = _latest_bch_for(path_purchase=purchase)
        return Response({
            'payment': BchDirectPaymentSerializer(payment).data if payment else None,
            'bch_direct_enabled': is_bch_direct_configured() and path.bch_direct_enabled,
            'bch_network': get_bch_network(),
        })

    def post(self, request, purchase_id):
        purchase = self._get_purchase(request, purchase_id)
        if purchase is None:
            return Response({'error': 'Compra no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            payment = create_or_reuse_bch_payment(user=request.user, path_purchase=purchase)
        except PermissionError as exc:
            return _permission_error_response(
                exc, action='create_path_bch', purchase_id=purchase_id, user_id=request.user.id,
            )
        except BchPaymentError as exc:
            return _bch_error_response(
                exc, action='create_path_bch', purchase_id=purchase_id, user_id=request.user.id,
            )
        except Exception as exc:
            return _unexpected_payment_error_response(
                exc,
                action='create_path_bch',
                public_message='No se pudo crear la orden BCH. Inténtelo de nuevo.',
                purchase_id=purchase_id,
                user_id=request.user.id,
            )
        return Response(BchDirectPaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class PathPurchaseBchVerifyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, purchase_id):
        try:
            purchase = KnowledgePathPurchase.objects.select_related(
                'knowledge_path', 'user'
            ).get(pk=purchase_id)
        except KnowledgePathPurchase.DoesNotExist:
            return Response({'error': 'Compra no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            payment = verify_bch_payment(user=request.user, path_purchase=purchase)
        except PermissionError as exc:
            return _permission_error_response(
                exc, action='verify_path_bch', purchase_id=purchase_id, user_id=request.user.id,
            )
        except BchPaymentError as exc:
            return _bch_error_response(
                exc, action='verify_path_bch', purchase_id=purchase_id, user_id=request.user.id,
            )
        except Exception as exc:
            return _unexpected_payment_error_response(
                exc,
                action='verify_path_bch',
                public_message='No se pudo verificar el pago BCH. Inténtelo de nuevo.',
                purchase_id=purchase_id,
                user_id=request.user.id,
            )
        purchase.refresh_from_db()
        return Response({
            'payment': BchDirectPaymentSerializer(payment).data,
            'purchase': {
                'id': purchase.id,
                'payment_status': purchase.payment_status,
                'is_paid': purchase.is_paid,
            },
        })


class TopicPurchaseBchPaymentView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_purchase(self, purchase_id):
        try:
            return TopicPurchase.objects.select_related('topic', 'user').get(pk=purchase_id)
        except TopicPurchase.DoesNotExist:
            return None

    def get(self, request, purchase_id):
        purchase = self._get_purchase(purchase_id)
        if purchase is None:
            return Response({'error': 'Compra no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        topic = purchase.topic
        if (
            purchase.user_id != request.user.id
            and not topic.is_moderator_or_creator(request.user)
            and not request.user.is_staff
        ):
            return Response({'error': 'Permiso denegado.'}, status=status.HTTP_403_FORBIDDEN)
        payment = _latest_bch_for(topic_purchase=purchase)
        return Response({
            'payment': BchDirectPaymentSerializer(payment).data if payment else None,
            'bch_direct_enabled': is_bch_direct_configured() and topic.bch_direct_enabled,
            'bch_network': get_bch_network(),
        })

    def post(self, request, purchase_id):
        purchase = self._get_purchase(purchase_id)
        if purchase is None:
            return Response({'error': 'Compra no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            payment = create_or_reuse_bch_payment(user=request.user, topic_purchase=purchase)
        except PermissionError as exc:
            return _permission_error_response(
                exc, action='create_topic_bch', purchase_id=purchase_id, user_id=request.user.id,
            )
        except BchPaymentError as exc:
            return _bch_error_response(
                exc, action='create_topic_bch', purchase_id=purchase_id, user_id=request.user.id,
            )
        except Exception as exc:
            return _unexpected_payment_error_response(
                exc,
                action='create_topic_bch',
                public_message='No se pudo crear la orden BCH. Inténtelo de nuevo.',
                purchase_id=purchase_id,
                user_id=request.user.id,
            )
        return Response(BchDirectPaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class TopicPurchaseBchVerifyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, purchase_id):
        try:
            purchase = TopicPurchase.objects.select_related('topic', 'user').get(pk=purchase_id)
        except TopicPurchase.DoesNotExist:
            return Response({'error': 'Compra no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        try:
            payment = verify_bch_payment(user=request.user, topic_purchase=purchase)
        except PermissionError as exc:
            return _permission_error_response(
                exc, action='verify_topic_bch', purchase_id=purchase_id, user_id=request.user.id,
            )
        except BchPaymentError as exc:
            return _bch_error_response(
                exc, action='verify_topic_bch', purchase_id=purchase_id, user_id=request.user.id,
            )
        except Exception as exc:
            return _unexpected_payment_error_response(
                exc,
                action='verify_topic_bch',
                public_message='No se pudo verificar el pago BCH. Inténtelo de nuevo.',
                purchase_id=purchase_id,
                user_id=request.user.id,
            )
        purchase.refresh_from_db()
        return Response({
            'payment': BchDirectPaymentSerializer(payment).data,
            'purchase': {
                'id': purchase.id,
                'payment_status': purchase.payment_status,
                'is_paid': purchase.is_paid,
            },
        })
