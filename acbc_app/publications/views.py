from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

class PublicationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, publication_id):
        print(f"\n=== PublicationDetailView.get ===")
        print(f"Requested publication ID: {publication_id}")
        print(f"User: {request.user}")
        
        try:
            publication = Publication.objects.get(id=publication_id)
            print(f"Found publication: {publication}")
            
            serializer = PublicationSerializer(publication)
            print(f"Serialized data: {serializer.data}")
            
            return Response(serializer.data)
        except Publication.DoesNotExist:
            print(f"❌ Publication not found with ID: {publication_id}")
            return Response(
                {'error': 'Publication not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            print(f"❌ Unexpected error: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ) 