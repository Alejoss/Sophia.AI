"""Checkout endpoints for a paid transcript-generation request."""
import logging

from django.conf import settings
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from content.models import TranscriptGenerationRequest
from payments.bch_client import get_bch_network, is_bch_direct_configured
from payments.bch_services import BchPaymentError, create_or_reuse_bch_payment, verify_bch_payment
from payments.models import BchDirectPayment
from payments.nowpayments_client import NOWPaymentsClient, NOWPaymentsError
from payments.serializers import BchDirectPaymentSerializer, CryptoPaymentSerializer
from payments.services import (
    OPEN_PAYMENT_STATUSES,
    create_transcript_generation_payment,
    pay_transcript_generation_with_tokens,
    refresh_crypto_payment_from_nowpayments,
)
from payments.token_ledger import InsufficientTokenBalance
from payments.token_pricing import tokens_required_for_usd
from payments.views import (
    _bch_error_response,
    _nowpayments_error_response,
    _permission_error_response,
    _request_bch_txid,
    _unexpected_payment_error_response,
    _validation_error_response,
)
from profiles.models import Profile

logger = logging.getLogger(__name__)


def _get_request(request_id):
    return TranscriptGenerationRequest.objects.select_related('content', 'requester').get(pk=request_id)


def _offer(generation_request, user):
    from content.views_transcript_generation import generation_offer_payload
    return generation_offer_payload(generation_request.content, user)


class TranscriptGenerationPaymentView(APIView):
    """Create or refresh a NOWPayments invoice for transcript generation."""

    permission_classes = [IsAuthenticated]

    def post(self, request, request_id):
        pay_currency = (request.data.get('pay_currency') or '').lower().strip() or None
        try:
            generation_request = _get_request(request_id)
        except TranscriptGenerationRequest.DoesNotExist:
            return Response({'error': 'Solicitud no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            payment = create_transcript_generation_payment(
                transcript_generation=generation_request,
                pay_currency=pay_currency,
                user=request.user,
            )
        except PermissionError as exc:
            return _permission_error_response(
                exc, action='create_transcript_generation_payment',
                request_id=request_id, user_id=request.user.id,
            )
        except ValueError as exc:
            return _validation_error_response(
                exc, action='create_transcript_generation_payment',
                request_id=request_id, user_id=request.user.id,
            )
        except NOWPaymentsError as exc:
            return _nowpayments_error_response(
                exc, action='create_transcript_generation_payment',
                request_id=request_id, user_id=request.user.id,
            )
        except Exception as exc:
            return _unexpected_payment_error_response(
                exc,
                action='create_transcript_generation_payment',
                public_message='No se pudo iniciar el pago. Inténtalo de nuevo.',
                request_id=request_id,
                user_id=request.user.id,
            )

        return Response(CryptoPaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class TranscriptGenerationPaymentsListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, request_id):
        try:
            generation_request = TranscriptGenerationRequest.objects.get(pk=request_id)
        except TranscriptGenerationRequest.DoesNotExist:
            return Response({'error': 'Solicitud no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        if generation_request.requester_id != request.user.id and not request.user.is_staff:
            return Response({'error': 'Permiso denegado.'}, status=status.HTTP_403_FORBIDDEN)

        payments = generation_request.crypto_payments.order_by('-created_at')[:10]
        client = NOWPaymentsClient()
        if client.configured:
            refreshed = []
            for payment in payments:
                if payment.payment_status in OPEN_PAYMENT_STATUSES:
                    try:
                        payment = refresh_crypto_payment_from_nowpayments(payment)
                    except NOWPaymentsError as exc:
                        logger.warning(
                            'Could not refresh payment %s for transcript_generation %s: %s',
                            payment.id,
                            request_id,
                            exc,
                        )
                refreshed.append(payment)
            payments = refreshed
        return Response(CryptoPaymentSerializer(payments, many=True).data)


class TranscriptGenerationBchPaymentView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, request_id):
        try:
            generation_request = TranscriptGenerationRequest.objects.get(pk=request_id)
        except TranscriptGenerationRequest.DoesNotExist:
            return Response({'error': 'Solicitud no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        if generation_request.requester_id != request.user.id and not request.user.is_staff:
            return Response({'error': 'Permiso denegado.'}, status=status.HTTP_403_FORBIDDEN)

        payment = (
            BchDirectPayment.objects.filter(transcript_generation=generation_request)
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
            'request': _offer(generation_request, request.user).get('request'),
        })

    def post(self, request, request_id):
        try:
            generation_request = _get_request(request_id)
        except TranscriptGenerationRequest.DoesNotExist:
            return Response({'error': 'Solicitud no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            payment = create_or_reuse_bch_payment(
                transcript_generation=generation_request,
                user=request.user,
            )
        except PermissionError as exc:
            return _permission_error_response(
                exc, action='create_transcript_generation_bch',
                request_id=request_id, user_id=request.user.id,
            )
        except BchPaymentError as exc:
            return _bch_error_response(
                exc, action='create_transcript_generation_bch',
                request_id=request_id, user_id=request.user.id,
            )
        except Exception as exc:
            return _unexpected_payment_error_response(
                exc,
                action='create_transcript_generation_bch',
                public_message='No se pudo crear la orden BCH. Inténtalo de nuevo.',
                request_id=request_id,
                user_id=request.user.id,
            )

        return Response(BchDirectPaymentSerializer(payment).data, status=status.HTTP_201_CREATED)


class TranscriptGenerationBchVerifyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, request_id):
        try:
            generation_request = _get_request(request_id)
        except TranscriptGenerationRequest.DoesNotExist:
            return Response({'error': 'Solicitud no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            payment = verify_bch_payment(
                transcript_generation=generation_request,
                user=request.user,
                payment_txid=_request_bch_txid(request),
            )
        except PermissionError as exc:
            return _permission_error_response(
                exc, action='verify_transcript_generation_bch',
                request_id=request_id, user_id=request.user.id,
            )
        except BchPaymentError as exc:
            return _bch_error_response(
                exc, action='verify_transcript_generation_bch',
                request_id=request_id, user_id=request.user.id,
            )
        except Exception as exc:
            return _unexpected_payment_error_response(
                exc,
                action='verify_transcript_generation_bch',
                public_message='No se pudo verificar el pago BCH. Inténtalo de nuevo.',
                request_id=request_id,
                user_id=request.user.id,
            )

        generation_request.refresh_from_db()
        return Response({
            'payment': BchDirectPaymentSerializer(payment).data,
            'request': _offer(generation_request, request.user).get('request'),
        })


class TranscriptGenerationTokenPaymentView(APIView):
    """Pay transcript generation with platform tokens ($1 → face-value tokens)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, request_id):
        try:
            generation_request = _get_request(request_id)
        except TranscriptGenerationRequest.DoesNotExist:
            return Response({'error': 'Solicitud no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        try:
            paid = pay_transcript_generation_with_tokens(
                transcript_generation=generation_request,
                user=request.user,
            )
        except PermissionError as exc:
            return _permission_error_response(
                exc, action='pay_transcript_generation_tokens',
                request_id=request_id, user_id=request.user.id,
            )
        except InsufficientTokenBalance as exc:
            return Response(
                {
                    'error': str(exc),
                    'code': 'insufficient_tokens',
                    'required': exc.required,
                    'available': exc.available,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except ValueError as exc:
            return _validation_error_response(
                exc, action='pay_transcript_generation_tokens',
                request_id=request_id, user_id=request.user.id,
            )

        balance = (
            Profile.objects.filter(user_id=request.user.id)
            .values_list('token_balance', flat=True)
            .first()
        )
        price_usd = float(
            paid.price_amount or getattr(settings, 'TRANSCRIPT_GENERATION_PRICE_USD', 1)
        )
        return Response({
            'request': _offer(paid, request.user).get('request'),
            'token_balance': balance if balance is not None else 0,
            'tokens_spent': tokens_required_for_usd(price_usd),
        })
