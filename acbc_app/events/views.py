import logging

from rest_framework.views import APIView
from rest_framework.viewsets import ModelViewSet
from rest_framework.response import Response
from rest_framework import status
from rest_framework.generics import get_object_or_404
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from events.models import Event, EventRegistration
from comments.models import Comment
from certificates.models import Certificate, CertificateRequest
from django.utils import timezone
from events.serializers import (EventSerializer,
                                # BookmarkSerializer,
                                CommentSerializer,
                                CertificateRequestSerializer,
                                CertificateSerializer,
                                EventRegistrationSerializer,
                                EventRegistrationListSerializer)
from utils.notification_utils import notify_event_registration, notify_payment_accepted, notify_certificate_sent


logger = logging.getLogger('app_logger')


class EventList(APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    
    def get(self, request, format=None):
        events = Event.objects.all()
        
        # Filter by owner if specified
        owner_id = request.query_params.get('owner')
        if owner_id:
            events = events.filter(owner_id=owner_id)
        
        serializer = EventSerializer(events, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request, format=None):
        serializer = EventSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class EventDetail(APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    
    def get_object(self, pk):
        return get_object_or_404(Event, pk=pk)

    def get(self, request, pk, format=None):
        event = self.get_object(pk)
        serializer = EventSerializer(event, context={'request': request})
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

#
# class BookmarkList(APIView):
#     def get(self, request, format=None):
#         bookmarks = Bookmark.objects.filter(user=request.user)
#         serializer = BookmarkSerializer(bookmarks, many=True)
#         return Response(serializer.data)
#
#     def post(self, request, format=None):
#         serializer = BookmarkSerializer(data=request.data)
#         if serializer.is_valid():
#             serializer.save()
#             return Response(serializer.data, status=status.HTTP_201_CREATED)
#         return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

#
# class BookmarkDetail(APIView):
#     def get_object(self, pk):
#         return get_object_or_404(Bookmark, pk=pk)
#
#     def get(self, request, pk, format=None):
#         bookmark = self.get_object(pk)
#         serializer = BookmarkSerializer(bookmark)
#         return Response(serializer.data)
#
#     def put(self, request, pk, format=None):
#         bookmark = self.get_object(pk)
#         serializer = BookmarkSerializer(bookmark, data=request.data)
#         if serializer.is_valid():
#             serializer.save()
#             return Response(serializer.data)
#         return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
#
#     def delete(self, request, pk, format=None):
#         bookmark = self.get_object(pk)
#         bookmark.delete()
#         return Response(status=status.HTTP_204_NO_CONTENT)
#

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


class EventRegistrationView(APIView):
    """
    Handle event registration and cancellation
    """
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    
    def post(self, request, event_id, format=None):
        """Register for an event"""
        print(f"Event registration attempt for event_id: {event_id}, user: {request.user.username}")
        
        serializer = EventRegistrationSerializer(
            data={'event': event_id}, 
            context={'request': request}
        )
        
        print(f"Serializer data: {serializer.initial_data}")
        
        if serializer.is_valid():
            registration = serializer.save()
            print(f"Successfully registered user {request.user.username} for event {event_id}")
            notify_event_registration(registration)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        else:
            print(f"Serializer validation failed: {serializer.errors}")
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def delete(self, request, event_id, format=None):
        """Cancel event registration"""
        try:
            registration = EventRegistration.objects.get(
                event_id=event_id, 
                user=request.user
            )
            registration.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except EventRegistration.DoesNotExist:
            return Response({'error': 'Registration not found'}, status=status.HTTP_404_NOT_FOUND)


class EventParticipantsView(APIView):
    """
    List participants for an event (event creator only)
    """
    def get(self, request, event_id, format=None):
        try:
            event = Event.objects.get(pk=event_id)
        except Event.DoesNotExist:
            return Response({'error': 'Event not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Only event creator can see participants
        if event.owner != request.user:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        registrations = EventRegistration.objects.filter(event=event)
        serializer = EventRegistrationListSerializer(registrations, many=True)
        return Response(serializer.data)


class UserEventRegistrationsView(APIView):
    """
    Get user's event registrations
    """
    def get(self, request, format=None):
        registrations = EventRegistration.objects.filter(user=request.user)
        serializer = EventRegistrationListSerializer(registrations, many=True)
        return Response(serializer.data)


class UserCreatedEventsView(APIView):
    """
    Get events created by the user
    """
    def get(self, request, format=None):
        events = Event.objects.filter(owner=request.user)
        serializer = EventSerializer(events, many=True, context={'request': request})
        return Response(serializer.data)


class EventParticipantStatusView(APIView):
    """
    Update participant status (event creator only)
    """
    def patch(self, request, event_id, registration_id, format=None):
        try:
            event = Event.objects.get(pk=event_id)
        except Event.DoesNotExist:
            return Response({'error': 'Event not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Only event creator can update participant status
        if event.owner != request.user:
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
        
        try:
            registration = EventRegistration.objects.get(
                pk=registration_id,
                event=event
            )
        except EventRegistration.DoesNotExist:
            return Response({'error': 'Registration not found'}, status=status.HTTP_404_NOT_FOUND)
        
        # Update status based on action
        action = request.data.get('action')
        
        if action == 'accept_payment':
            registration.payment_status = 'PAID'
            registration.save()
            # Notify the student that their payment was accepted
            notify_payment_accepted(registration)
        elif action == 'cancel_registration':
            registration.registration_status = 'CANCELLED'
            registration.payment_status = 'PENDING'  # Reset payment status to pending
            registration.save()
        elif action == 'send_certificate':
            # Directly call the certificate generation API
            try:
                from certificates.views import EventCertificateGenerationView
                
                # Create the certificate generation view and call it directly
                certificate_view = EventCertificateGenerationView()
                certificate_response = certificate_view.post(request, event_id, registration_id)
                
                if certificate_response.status_code == 201:
                    # Certificate was successfully generated
                    return Response({
                        'message': 'Certificate generated and sent successfully',
                        'certificate': certificate_response.data
                    })
                else:
                    # Return the error from certificate generation
                    return certificate_response
                    
            except Exception as e:
                return Response({
                    'error': 'Failed to generate certificate',
                    'details': str(e)
                }, status=status.HTTP_400_BAD_REQUEST)
        else:
            return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)
        
        serializer = EventRegistrationListSerializer(registration)
        return Response(serializer.data)
