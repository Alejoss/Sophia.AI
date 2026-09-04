from rest_framework import status
from rest_framework.generics import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
import logging

from content.models import Topic
from content.serializers import TopicPurchaseSerializer
from content.topic_access import get_or_create_topic_purchase, get_user_topic_purchase

logger = logging.getLogger(__name__)


class TopicPurchaseView(APIView):
    """Create or fetch the current user's purchase for paid topic Consultas."""

    permission_classes = [IsAuthenticated]

    def _topic(self, request, pk):
        topic = get_object_or_404(Topic, pk=pk)
        if not topic.can_be_viewed_by(request.user):
            return None, Response({'error': 'Tema no encontrado'}, status=status.HTTP_404_NOT_FOUND)
        return topic, None

    def get(self, request, pk):
        topic, error_response = self._topic(request, pk)
        if error_response is not None:
            return error_response
        purchase = get_user_topic_purchase(request.user, topic)
        if purchase is None:
            return Response({'error': 'No hay compra para este tema.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(TopicPurchaseSerializer(purchase).data)

    def post(self, request, pk):
        topic, error_response = self._topic(request, pk)
        if error_response is not None:
            return error_response
        try:
            purchase = get_or_create_topic_purchase(topic=topic, user=request.user)
        except ValueError as exc:
            logger.info(
                'Topic purchase rejected topic_id=%s user_id=%s: %s',
                pk,
                request.user.id,
                exc,
            )
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as exc:
            logger.error(
                'Unexpected topic purchase error topic_id=%s user_id=%s: %s',
                pk,
                request.user.id,
                exc,
                exc_info=True,
            )
            return Response(
                {'error': 'No se pudo crear la compra. Inténtelo de nuevo.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        return Response(
            TopicPurchaseSerializer(purchase).data,
            status=status.HTTP_200_OK if purchase.payment_status == 'PAID' else status.HTTP_201_CREATED,
        )
