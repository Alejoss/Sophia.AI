from rest_framework.views import APIView

from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import get_object_or_404
from courses.models import ConnectionPlatform, Event, Bookmark, Comment, CertificateRequest, Certificate

from .serializers import (ConnectionPlatformSerializer, EventSerializer,
                          BookmarkSerializer, CommentSerializer, CertificateRequestSerializer,
                          CertificateSerializer)


class ConnectionPlatformList(APIView):
    def get(self, request, format=None):
        platforms = ConnectionPlatform.objects.all()
        serializer = ConnectionPlatformSerializer(platforms, many=True)
        return Response(serializer.data)

    def post(self, request, format=None):
        serializer = ConnectionPlatformSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ConnectionPlatformDetail(APIView):
    def get_object(self, pk):
        return get_object_or_404(ConnectionPlatform, pk=pk)

    def get(self, request, pk, format=None):
        platform = self.get_object(pk)
        serializer = ConnectionPlatformSerializer(platform)
        return Response(serializer.data)

    def put(self, request, pk, format=None):
        platform = self.get_object(pk)
        serializer = ConnectionPlatformSerializer(platform, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk, format=None):
        platform = self.get_object(pk)
        platform.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class EventList(APIView):
    def get(self, request, format=None):
        events = Event.objects.all()
        serializer = EventSerializer(events, many=True)
        return Response(serializer.data)

    def post(self, request, format=None):
        serializer = EventSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class EventDetail(APIView):
    def get_object(self, pk):
        return get_object_or_404(Event, pk=pk)

    def get(self, request, pk, format=None):
        event = self.get_object(pk)
        serializer = EventSerializer(event)
        return Response(serializer.data)

    def put(self, request, pk, format=None):
        event = self.get_object(pk)
        serializer = EventSerializer(event, data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk, format=None):
        event = self.get_object(pk)
        event.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CommentList(APIView):
    def get(self, request, format=None):
        comments = Comment.objects.all()
        serializer = CommentSerializer(comments, many=True)
        return Response(serializer.data)

    def post(self, request, format=None):
        serializer = CommentSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CommentDetail(APIView):
    def get_object(self, pk):
        return get_object_or_404(Comment, pk=pk)

    def get(self, request, pk, format=None):
        comment = self.get_object(pk)
        serializer = CommentSerializer(comment)
        return Response(serializer.data)

    def put(self, request, pk, format=None):
        comment = self.get_object(pk)
        serializer = CommentSerializer(comment, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk, format=None):
        comment = self.get_object(pk)
        comment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CertificateList(APIView):
    def get(self, request, format=None):
        certificates = Certificate.objects.filter(user=request.user)
        serializer = CertificateSerializer(certificates, many=True)
        return Response(serializer.data)

    def post(self, request, format=None):
        serializer = CertificateSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CertificateDetail(APIView):
    def get_object(self, pk):
        return get_object_or_404(Certificate, pk=pk)

    def get(self, request, pk, format=None):
        certificate = self.get_object(pk)
        serializer = CertificateSerializer(certificate)
        return Response(serializer.data)

    def put(self, request, pk, format=None):
        certificate = self.get_object(pk)
        serializer = CertificateSerializer(certificate, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk, format=None):
        certificate = self.get_object(pk)
        certificate.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class BookmarkList(APIView):
    def get(self, request, format=None):
        bookmarks = Bookmark.objects.filter(user=request.user)
        serializer = BookmarkSerializer(bookmarks, many=True)
        return Response(serializer.data)

    def post(self, request, format=None):
        serializer = BookmarkSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class BookmarkDetail(APIView):
    def get_object(self, pk):
        return get_object_or_404(Bookmark, pk=pk)

    def get(self, request, pk, format=None):
        bookmark = self.get_object(pk)
        serializer = BookmarkSerializer(bookmark)
        return Response(serializer.data)

    def put(self, request, pk, format=None):
        bookmark = self.get_object(pk)
        serializer = BookmarkSerializer(bookmark, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk, format=None):
        bookmark = self.get_object(pk)
        bookmark.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CertificateRequestList(APIView):
    def get(self, request, format=None):
        requests = CertificateRequest.objects.all()
        serializer = CertificateRequestSerializer(requests, many=True)
        return Response(serializer.data)

    def post(self, request, format=None):
        serializer = CertificateRequestSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CertificateRequestDetail(APIView):
    def get_object(self, pk):
        return get_object_or_404(CertificateRequest, pk=pk)

    def get(self, request, pk, format=None):
        request = self.get_object(pk)
        serializer = CertificateRequestSerializer(request)
        return Response(serializer.data)

    def put(self, request, pk, format=None):
        request = self.get_object(pk)
        serializer = CertificateRequestSerializer(request, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk, format=None):
        request = self.get_object(pk)
        request.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)