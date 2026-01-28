import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from content.models import Publication
from content.serializers import PublicationSerializer

logger = logging.getLogger(__name__)

class PublicationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, publication_id):
        logger.info(f"Publication detail requested - Publication ID: {publication_id}, User: {request.user.username}")
        
        try:
            publication = Publication.objects.get(id=publication_id)
            logger.debug(f"Found publication: {publication.title} (ID: {publication.id})")
            
            serializer = PublicationSerializer(publication, context={'request': request})
            logger.debug(f"Publication serialized successfully for user {request.user.username}")
            
            return Response(serializer.data)
        except Publication.DoesNotExist:
            logger.warning(f"Publication not found - Publication ID: {publication_id}, User: {request.user.username}")
            return Response(
                {'error': 'Publication not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(
                "Error retrieving publication %s for user %s: %s",
                publication_id,
                request.user.username,
                str(e),
                exc_info=True,
            )
            return Response(
                {'error': 'An unexpected error occurred.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            ) 