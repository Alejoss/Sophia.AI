from rest_framework.viewsets import ModelViewSet
from ..models import Profile, AcceptedCrypto
from .serializers import ProfileSerializer, AcceptedCryptoSerializer


class ProfileList(ModelViewSet):
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer

class ProfileDetail(ModelViewSet):
    def get(self, request, pk, format=None):
        profile = get_object_or_404(Profile, pk=pk)
        serializer = ProfileSerializer(profile)
        return Response(serializer.data)

    def put(self, request, pk, format=None):
        profile = get_object_or_404(Profile, pk=pk)
        serializer = ProfileSerializer(profile, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk, format=None):
        profile = get_object_or_404(Profile, pk=pk)
        profile.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AcceptedCryptoList(ModelViewSet):
    def get(self, request, format=None):
        cryptos = AcceptedCrypto.objects.all()
        serializer = AcceptedCryptoSerializer(cryptos, many=True)
        return Response(serializer.data)

    def post(self, request, format=None):
        serializer = AcceptedCryptoSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

