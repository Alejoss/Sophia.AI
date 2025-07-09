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

logger = logging.getLogger(__name__)


class EventList(APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    
    def get(self, request, format=None):
        logger.info(f"Event list requested by user {request.user.username if request.user.is_authenticated else 'anonymous'}")
        
        try:
            events = Event.objects.all()
            
            # Filter by owner if specified
            owner_id = request.query_params.get('owner')
            if owner_id:
                events = events.filter(owner_id=owner_id)
                logger.debug(f"Events filtered by owner ID: {owner_id}")
            
            serializer = EventSerializer(events, many=True, context={'request': request})
            
            logger.info(f"Successfully retrieved {len(serializer.data)} events")
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error retrieving event list: {str(e)}", exc_info=True)
            return Response(
                {'error': 'An error occurred while retrieving events'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def post(self, request, format=None):
        logger.info(f"Event creation requested by user {request.user.username}")
        logger.debug(f"Event creation data: {request.data}")
        
        try:
            serializer = EventSerializer(data=request.data, context={'request': request})
            if serializer.is_valid():
                event = serializer.save()
                
                logger.info(f"Event created successfully - ID: {event.id}, Title: {event.title}, Owner: {request.user.username}")
                
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            else:
                logger.warning(f"Event creation failed - validation errors from user {request.user.username}: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error creating event for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'An error occurred while creating the event'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class EventDetail(APIView):
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    
    def get_object(self, pk):
        return get_object_or_404(Event, pk=pk)

    def get(self, request, pk, format=None):
        logger.info(f"Event detail requested - Event ID: {pk}, User: {request.user.username if request.user.is_authenticated else 'anonymous'}")
        
        try:
            event = self.get_object(pk)
            serializer = EventSerializer(event, context={'request': request})
            
            logger.debug(f"Event detail retrieved successfully - Event: {event.title}, Owner: {event.owner.username}")
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error retrieving event detail for event {pk}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'An error occurred while retrieving the event'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def put(self, request, pk, format=None):
        logger.info(f"Event update requested - Event ID: {pk}, User: {request.user.username}")
        logger.debug(f"Update data: {request.data}")
        
        try:
            event = self.get_object(pk)
            
            serializer = EventSerializer(event, data=request.data, context={'request': request})
            if serializer.is_valid():
                updated_event = serializer.save()
                
                logger.info(f"Event updated successfully - ID: {pk}, Title: {updated_event.title}, Updated by: {request.user.username}")
                
                return Response(serializer.data)
            else:
                logger.warning(f"Event update failed - validation errors for event {pk} from user {request.user.username}: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error updating event {pk} for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'An error occurred while updating the event'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def delete(self, request, pk, format=None):
        logger.info(f"Event deletion requested - Event ID: {pk}, User: {request.user.username}")
        
        try:
            event = self.get_object(pk)
            event_title = event.title
            event.delete()
            
            logger.info(f"Event deleted successfully - ID: {pk}, Title: {event_title}, Deleted by: {request.user.username}")
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            logger.error(f"Error deleting event {pk} for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'An error occurred while deleting the event'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CommentList(APIView):
    def get(self, request, format=None):
        logger.debug("Comment list requested by user {request.user.username if request.user.is_authenticated else 'anonymous'}")
        
        try:
            comments = Comment.objects.all()
            serializer = CommentSerializer(comments, many=True)
            
            logger.debug(f"Successfully retrieved {len(serializer.data)} comments")
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error retrieving comment list: {str(e)}", exc_info=True)
            return Response(
                {'error': 'An error occurred while retrieving comments'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def post(self, request, format=None):
        logger.info(f"Comment creation requested by user {request.user.username}")
        logger.debug(f"Comment creation data: {request.data}")
        
        try:
            serializer = CommentSerializer(data=request.data)
            if serializer.is_valid():
                comment = serializer.save()
                
                logger.info(f"Comment created successfully - ID: {comment.id}, User: {request.user.username}")
                
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            else:
                logger.warning(f"Comment creation failed - validation errors from user {request.user.username}: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error creating comment for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'An error occurred while creating the comment'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CommentDetail(APIView):
    def get_object(self, pk):
        return get_object_or_404(Comment, pk=pk)

    def get(self, request, pk, format=None):
        logger.info(f"Comment detail requested - Comment ID: {pk}, User: {request.user.username if request.user.is_authenticated else 'anonymous'}")
        
        try:
            comment = self.get_object(pk)
            serializer = CommentSerializer(comment)
            
            logger.debug(f"Comment detail retrieved successfully - Comment: {comment.text}, User: {comment.user.username}")
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error retrieving comment detail for comment {pk}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'An error occurred while retrieving the comment'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def put(self, request, pk, format=None):
        logger.info(f"Comment update requested - Comment ID: {pk}, User: {request.user.username}")
        logger.debug(f"Update data: {request.data}")
        
        try:
            comment = self.get_object(pk)
            
            serializer = CommentSerializer(comment, data=request.data)
            if serializer.is_valid():
                updated_comment = serializer.save()
                
                logger.info(f"Comment updated successfully - ID: {pk}, Updated by: {request.user.username}")
                
                return Response(serializer.data)
            else:
                logger.warning(f"Comment update failed - validation errors for comment {pk} from user {request.user.username}: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error updating comment {pk} for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'An error occurred while updating the comment'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def delete(self, request, pk, format=None):
        logger.info(f"Comment deletion requested - Comment ID: {pk}, User: {request.user.username}")
        
        try:
            comment = self.get_object(pk)
            comment.delete()
            
            logger.info(f"Comment deleted successfully - ID: {pk}, Deleted by: {request.user.username}")
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            logger.error(f"Error deleting comment {pk} for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'An error occurred while deleting the comment'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CertificateList(APIView):
    def get(self, request, format=None):
        logger.debug("Certificate list requested by user {request.user.username if request.user.is_authenticated else 'anonymous'}")
        
        try:
            certificates = Certificate.objects.filter(user=request.user)
            serializer = CertificateSerializer(certificates, many=True)
            
            logger.debug(f"Successfully retrieved {len(serializer.data)} certificates")
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error retrieving certificate list: {str(e)}", exc_info=True)
            return Response(
                {'error': 'An error occurred while retrieving certificates'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def post(self, request, format=None):
        logger.info(f"Certificate creation requested by user {request.user.username}")
        logger.debug(f"Certificate creation data: {request.data}")
        
        try:
            serializer = CertificateSerializer(data=request.data)
            if serializer.is_valid():
                certificate = serializer.save()
                
                logger.info(f"Certificate created successfully - ID: {certificate.id}, User: {request.user.username}")
                
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            else:
                logger.warning(f"Certificate creation failed - validation errors from user {request.user.username}: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error creating certificate for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'An error occurred while creating the certificate'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CertificateDetail(APIView):
    def get_object(self, pk):
        return get_object_or_404(Certificate, pk=pk)

    def get(self, request, pk, format=None):
        logger.info(f"Certificate detail requested - Certificate ID: {pk}, User: {request.user.username if request.user.is_authenticated else 'anonymous'}")
        
        try:
            certificate = self.get_object(pk)
            serializer = CertificateSerializer(certificate)
            
            logger.debug(f"Certificate detail retrieved successfully - Certificate: {certificate.name}, User: {certificate.user.username}")
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error retrieving certificate detail for certificate {pk}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'An error occurred while retrieving the certificate'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def put(self, request, pk, format=None):
        logger.info(f"Certificate update requested - Certificate ID: {pk}, User: {request.user.username}")
        logger.debug(f"Update data: {request.data}")
        
        try:
            certificate = self.get_object(pk)
            
            serializer = CertificateSerializer(certificate, data=request.data)
            if serializer.is_valid():
                updated_certificate = serializer.save()
                
                logger.info(f"Certificate updated successfully - ID: {pk}, Updated by: {request.user.username}")
                
                return Response(serializer.data)
            else:
                logger.warning(f"Certificate update failed - validation errors for certificate {pk} from user {request.user.username}: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error updating certificate {pk} for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'An error occurred while updating the certificate'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def delete(self, request, pk, format=None):
        logger.info(f"Certificate deletion requested - Certificate ID: {pk}, User: {request.user.username}")
        
        try:
            certificate = self.get_object(pk)
            certificate.delete()
            
            logger.info(f"Certificate deleted successfully - ID: {pk}, Deleted by: {request.user.username}")
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            logger.error(f"Error deleting certificate {pk} for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'An error occurred while deleting the certificate'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

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
        logger.debug("Certificate request list requested by user {request.user.username if request.user.is_authenticated else 'anonymous'}")
        
        try:
            requests = CertificateRequest.objects.all()
            serializer = CertificateRequestSerializer(requests, many=True)
            
            logger.debug(f"Successfully retrieved {len(serializer.data)} certificate requests")
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error retrieving certificate request list: {str(e)}", exc_info=True)
            return Response(
                {'error': 'An error occurred while retrieving certificate requests'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def post(self, request, format=None):
        logger.info(f"Certificate request creation requested by user {request.user.username}")
        logger.debug(f"Certificate request creation data: {request.data}")
        
        try:
            serializer = CertificateRequestSerializer(data=request.data)
            if serializer.is_valid():
                cert_request = serializer.save()
                
                logger.info(f"Certificate request created successfully - ID: {cert_request.id}, User: {request.user.username}")
                
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            else:
                logger.warning(f"Certificate request creation failed - validation errors from user {request.user.username}: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error creating certificate request for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'An error occurred while creating the certificate request'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class CertificateRequestDetail(APIView):
    def get_object(self, pk):
        return get_object_or_404(CertificateRequest, pk=pk)

    def get(self, request, pk, format=None):
        logger.info(f"Certificate request detail requested - Certificate Request ID: {pk}, User: {request.user.username if request.user.is_authenticated else 'anonymous'}")
        
        try:
            cert_request = self.get_object(pk)
            serializer = CertificateRequestSerializer(cert_request)
            
            logger.debug(f"Certificate request detail retrieved successfully - Certificate Request: {cert_request.name}, User: {cert_request.user.username}")
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error retrieving certificate request detail for certificate request {pk}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'An error occurred while retrieving the certificate request'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def put(self, request, pk, format=None):
        logger.info(f"Certificate request update requested - Certificate Request ID: {pk}, User: {request.user.username}")
        logger.debug(f"Update data: {request.data}")
        
        try:
            cert_request = self.get_object(pk)
            
            serializer = CertificateRequestSerializer(cert_request, data=request.data)
            if serializer.is_valid():
                updated_request = serializer.save()
                
                logger.info(f"Certificate request updated successfully - ID: {pk}, Updated by: {request.user.username}")
                
                return Response(serializer.data)
            else:
                logger.warning(f"Certificate request update failed - validation errors for certificate request {pk} from user {request.user.username}: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error updating certificate request {pk} for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'An error occurred while updating the certificate request'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def delete(self, request, pk, format=None):
        logger.info(f"Certificate request deletion requested - Certificate Request ID: {pk}, User: {request.user.username}")
        
        try:
            cert_request = self.get_object(pk)
            cert_request.delete()
            
            logger.info(f"Certificate request deleted successfully - ID: {pk}, Deleted by: {request.user.username}")
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            logger.error(f"Error deleting certificate request {pk} for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'An error occurred while deleting the certificate request'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class EventRegistrationView(APIView):
    """
    Handle event registration and cancellation
    """
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    
    def post(self, request, event_id, format=None):
        """Register for an event"""
        logger.info(f"Event registration attempt - Event ID: {event_id}, User: {request.user.username}")
        logger.debug(f"Event registration data: {request.data}")
        
        try:
            serializer = EventRegistrationSerializer(
                data={'event': event_id}, 
                context={'request': request}
            )
            
            logger.debug(f"Event registration serializer data: {serializer.initial_data}")
            
            if serializer.is_valid():
                registration = serializer.save()
                
                logger.info(f"Event registration successful - Event ID: {event_id}, User: {request.user.username}, Registration ID: {registration.id}")
                
                # Send notification
                try:
                    notify_event_registration(registration)
                    logger.debug(f"Event registration notification sent - Event ID: {event_id}, Registration ID: {registration.id}")
                except Exception as e:
                    logger.error(f"Failed to send event registration notification - Event ID: {event_id}, Registration ID: {registration.id}, Error: {str(e)}", exc_info=True)
                
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            else:
                logger.warning(f"Event registration failed - validation errors - Event ID: {event_id}, User: {request.user.username}: {serializer.errors}")
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error registering for event {event_id} for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'An error occurred while registering for the event'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def delete(self, request, event_id, format=None):
        """Cancel event registration"""
        logger.info(f"Event registration cancellation attempt - Event ID: {event_id}, User: {request.user.username}")
        
        try:
            registration = EventRegistration.objects.get(
                event_id=event_id, 
                user=request.user
            )
            registration.delete()
            
            logger.info(f"Event registration cancelled successfully - Event ID: {event_id}, User: {request.user.username}, Registration ID: {registration.id}")
            return Response(status=status.HTTP_204_NO_CONTENT)
        except EventRegistration.DoesNotExist:
            logger.warning(f"Event registration cancellation failed - registration not found - Event ID: {event_id}, User: {request.user.username}")
            return Response({'error': 'Registration not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error cancelling event registration {event_id} for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'An error occurred while cancelling the registration'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class EventParticipantsView(APIView):
    """
    List participants for an event (event creator only)
    """
    def get(self, request, event_id, format=None):
        logger.debug(f"Event participants request - Event ID: {event_id}, User: {request.user.username if request.user.is_authenticated else 'anonymous'}")
        
        try:
            try:
                event = Event.objects.get(pk=event_id)
            except Event.DoesNotExist:
                logger.warning(f"Event participants request failed - event not found - Event ID: {event_id}, User: {request.user.username}")
                return Response({'error': 'Event not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Only event creator can see participants
            if event.owner != request.user:
                logger.warning(f"Event participants request denied - permission denied - Event ID: {event_id}, User: {request.user.username}, Event Owner ID: {event.owner.id}")
                return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
            
            registrations = EventRegistration.objects.filter(event=event)
            serializer = EventRegistrationListSerializer(registrations, many=True)
            
            logger.debug(f"Successfully retrieved {len(serializer.data)} event participants")
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error retrieving event participants for event {event_id} for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'An error occurred while retrieving event participants'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserEventRegistrationsView(APIView):
    """
    Get user's event registrations
    """
    def get(self, request, format=None):
        logger.debug(f"User event registrations request - User: {request.user.username}")
        
        try:
            registrations = EventRegistration.objects.filter(user=request.user)
            serializer = EventRegistrationListSerializer(registrations, many=True)
            
            logger.debug(f"Successfully retrieved {len(serializer.data)} user event registrations")
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error retrieving user event registrations for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'An error occurred while retrieving your event registrations'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UserCreatedEventsView(APIView):
    """
    Get events created by the user
    """
    def get(self, request, format=None):
        logger.debug(f"User created events request - User: {request.user.username}")
        
        try:
            events = Event.objects.filter(owner=request.user)
            serializer = EventSerializer(events, many=True, context={'request': request})
            
            logger.debug(f"Successfully retrieved {len(serializer.data)} user created events")
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error retrieving user created events for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'An error occurred while retrieving your created events'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class EventParticipantStatusView(APIView):
    """
    Update participant status (event creator only)
    """
    def patch(self, request, event_id, registration_id, format=None):
        logger.info(f"Event participant status update request - Event ID: {event_id}, Registration ID: {registration_id}, User: {request.user.username}, Action: {request.data.get('action')}")
        
        try:
            try:
                event = Event.objects.get(pk=event_id)
            except Event.DoesNotExist:
                logger.warning(f"Event participant status update failed - event not found - Event ID: {event_id}, Registration ID: {registration_id}, User: {request.user.username}")
                return Response({'error': 'Event not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Only event creator can update participant status
            if event.owner != request.user:
                logger.warning(f"Event participant status update denied - permission denied - Event ID: {event_id}, Registration ID: {registration_id}, User: {request.user.username}, Event Owner ID: {event.owner.id}")
                return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)
            
            try:
                registration = EventRegistration.objects.get(
                    pk=registration_id,
                    event=event
                )
            except EventRegistration.DoesNotExist:
                logger.warning(f"Event participant status update failed - registration not found - Event ID: {event_id}, Registration ID: {registration_id}, User: {request.user.username}")
                return Response({'error': 'Registration not found'}, status=status.HTTP_404_NOT_FOUND)
            
            # Update status based on action
            action = request.data.get('action')
            
            logger.info(f"Processing participant status update - Event ID: {event_id}, Registration ID: {registration_id}, Action: {action}, Participant User ID: {registration.user.id}")
            
            if action == 'accept_payment':
                registration.payment_status = 'PAID'
                registration.save()
                
                logger.info(f"Payment accepted for event registration - Event ID: {event_id}, Registration ID: {registration_id}, Participant User ID: {registration.user.id}")
                
                # Notify the student that their payment was accepted
                try:
                    notify_payment_accepted(registration)
                    logger.debug(f"Payment acceptance notification sent - Event ID: {event_id}, Registration ID: {registration_id}, Participant User ID: {registration.user.id}")
                except Exception as e:
                    logger.error(f"Failed to send payment acceptance notification - Event ID: {event_id}, Registration ID: {registration_id}, Participant User ID: {registration.user.id}, Error: {str(e)}", exc_info=True)
                
                # Log business event
                logger.info(f"Event payment accepted - Event ID: {event_id}, Registration ID: {registration_id}, Participant User ID: {registration.user.id}")
                
            elif action == 'cancel_registration':
                registration.registration_status = 'CANCELLED'
                registration.payment_status = 'PENDING'  # Reset payment status to pending
                registration.save()
                
                logger.info(f"Event registration cancelled - Event ID: {event_id}, Registration ID: {registration_id}, Participant User ID: {registration.user.id}")
                
                # Log business event
                logger.info(f"Event registration cancelled by organizer - Event ID: {event_id}, Registration ID: {registration_id}, Participant User ID: {registration.user.id}")
                
            elif action == 'send_certificate':
                logger.info(f"Certificate generation request - Event ID: {event_id}, Registration ID: {registration_id}, Participant User ID: {registration.user.id}")
                
                # Directly call the certificate generation API
                try:
                    from certificates.views import EventCertificateGenerationView
                    
                    # Create the certificate generation view and call it directly
                    certificate_view = EventCertificateGenerationView()
                    certificate_response = certificate_view.post(request, event_id, registration_id)
                    
                    if certificate_response.status_code == 201:
                        # Certificate was successfully generated
                        logger.info(f"Certificate generated and sent successfully - Event ID: {event_id}, Registration ID: {registration_id}, Participant User ID: {registration.user.id}")
                        
                        # Log business event
                        logger.info(f"Event certificate sent - Event ID: {event_id}, Registration ID: {registration_id}, Participant User ID: {registration.user.id}")
                        
                        return Response({
                            'message': 'Certificate generated and sent successfully',
                            'certificate': certificate_response.data
                        })
                    else:
                        # Return the error from certificate generation
                        logger.warning(f"Certificate generation failed - Event ID: {event_id}, Registration ID: {registration_id}, Participant User ID: {registration.user.id}, Certificate Response Status: {certificate_response.status_code}, Certificate Response Data: {certificate_response.data}")
                        return certificate_response
                        
                except Exception as e:
                    logger.error(f"Certificate generation failed with exception - Event ID: {event_id}, Registration ID: {registration_id}, Participant User ID: {registration.user.id}, Error: {str(e)}", exc_info=True)
                    return Response({
                        'error': 'Failed to generate certificate',
                        'details': str(e)
                    }, status=status.HTTP_400_BAD_REQUEST)
            else:
                logger.warning(f"Invalid action for participant status update - Event ID: {event_id}, Registration ID: {registration_id}, Action: {action}")
                return Response({'error': 'Invalid action'}, status=status.HTTP_400_BAD_REQUEST)
            
            serializer = EventRegistrationListSerializer(registration)
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error updating event participant status for event {event_id}, registration {registration_id} for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'An error occurred while updating the participant status'}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
