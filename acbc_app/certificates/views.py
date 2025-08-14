import logging
from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from .models import CertificateRequest, Certificate, CertificateTemplate
from .serializers import CertificateRequestSerializer, CertificateSerializer
from knowledge_paths.models import KnowledgePath
from events.models import Event, EventRegistration
from django.db import models
from utils.notification_utils import notify_certificate_request, notify_certificate_approval, notify_certificate_rejection, notify_certificate_sent
from django.utils import timezone

logger = logging.getLogger(__name__)

# Create your views here.

class CertificateRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, path_id):
        logger.info(f"Certificate request submitted - Path ID: {path_id}, User: {request.user.username} (ID: {request.user.id})")
        logger.debug(f"Request data: {request.data}")
        
        try:
            # Check if knowledge path exists
            knowledge_path = get_object_or_404(KnowledgePath, id=path_id)
            logger.debug(f"Found knowledge path: {knowledge_path.title} (ID: {knowledge_path.id})")
            
            # Check if user has already requested a certificate for this path
            existing_request = CertificateRequest.objects.filter(
                requester=request.user,
                knowledge_path=knowledge_path
            ).first()
            
            logger.debug(f"Existing request found: {existing_request is not None}")
            if existing_request:
                logger.debug(f"Existing request status: {existing_request.status}")
            
            if existing_request and existing_request.status not in ['CANCELLED', 'REJECTED']:
                logger.warning(f"Duplicate certificate request - User: {request.user.username}, Path: {knowledge_path.title}, Existing status: {existing_request.status}")
                return Response(
                    {
                        'error': 'You have already requested a certificate for this knowledge path',
                        'request_id': existing_request.id,
                        'status': existing_request.status
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # If there's a cancelled or rejected request, delete it
            if existing_request and existing_request.status in ['CANCELLED', 'REJECTED']:
                logger.info(f"Deleting existing cancelled/rejected request - ID: {existing_request.id}, Status: {existing_request.status}")
                existing_request.delete()
            
            # Create new certificate request with notes
            request_data = {
                'knowledge_path': knowledge_path.id,
                'notes': request.data.get('notes', {})
            }
            logger.debug(f"Creating certificate request with data: {request_data}")
            
            serializer = CertificateRequestSerializer(
                data=request_data,
                context={'request': request}
            )
            
            logger.debug(f"Serializer validation result: {serializer.is_valid()}")
            if not serializer.is_valid():
                logger.warning(f"Invalid certificate request data from user {request.user.username}: {serializer.errors}")
                return Response(
                    {
                        'error': 'Invalid request data',
                        'details': serializer.errors
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            logger.info(f"Saving certificate request for user {request.user.username} and path {knowledge_path.title}")
            certificate_request = serializer.save()
            logger.info(f"Certificate request created successfully - ID: {certificate_request.id}")
            
            # Send notification to knowledge path author
            try:
                notify_certificate_request(certificate_request)
                logger.debug(f"Notification sent for certificate request {certificate_request.id}")
            except Exception as e:
                logger.error(f"Failed to send notification for certificate request {certificate_request.id}: {str(e)}", exc_info=True)
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error processing certificate request for user {request.user.username} and path {path_id}: {str(e)}", exc_info=True)
            return Response(
                {
                    'error': 'Failed to process certificate request',
                    'details': str(e)
                },
                status=status.HTTP_400_BAD_REQUEST
            )

class EventCertificateRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, event_id):
        logger.info(f"Event certificate request submitted - Event ID: {event_id}, User: {request.user.username}")
        logger.debug(f"Request data: {request.data}")
        
        try:
            # Check if event exists
            event = get_object_or_404(Event, id=event_id)
            logger.debug(f"Found event: {event.title} (ID: {event.id})")
            
            # Check if user has already requested a certificate for this event
            existing_request = CertificateRequest.objects.filter(
                requester=request.user,
                event=event
            ).first()
            
            logger.debug(f"Existing request found: {existing_request is not None}")
            if existing_request:
                logger.debug(f"Existing request status: {existing_request.status}")
            
            if existing_request and existing_request.status not in ['CANCELLED', 'REJECTED']:
                logger.warning(f"Duplicate event certificate request - User: {request.user.username}, Event: {event.title}, Existing status: {existing_request.status}")
                return Response(
                    {
                        'error': 'You have already requested a certificate for this event',
                        'request_id': existing_request.id,
                        'status': existing_request.status
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # If there's a cancelled or rejected request, delete it
            if existing_request and existing_request.status in ['CANCELLED', 'REJECTED']:
                logger.info(f"Deleting existing cancelled/rejected event request - ID: {existing_request.id}, Status: {existing_request.status}")
                existing_request.delete()
            
            # Create new certificate request with notes
            request_data = {
                'event': event.id,
                'notes': request.data.get('notes', {})
            }
            logger.debug(f"Creating event certificate request with data: {request_data}")
            
            serializer = CertificateRequestSerializer(
                data=request_data,
                context={'request': request}
            )
            if serializer.is_valid():
                certificate_request = serializer.save()
                logger.info(f"Event certificate request created successfully - ID: {certificate_request.id}")
                
                # Send notification to event owner
                try:
                    notify_certificate_request(certificate_request)
                    logger.debug(f"Notification sent for event certificate request {certificate_request.id}")
                except Exception as e:
                    logger.error(f"Failed to send notification for event certificate request {certificate_request.id}: {str(e)}", exc_info=True)
                
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            else:
                logger.warning(f"Invalid event certificate request data from user {request.user.username}: {serializer.errors}")
                return Response(
                    {
                        'error': 'Invalid request data',
                        'details': serializer.errors
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
        except Exception as e:
            logger.error(f"Error processing event certificate request for user {request.user.username} and event {event_id}: {str(e)}", exc_info=True)
            return Response(
                {
                    'error': 'Failed to process certificate request',
                    'details': str(e)
                },
                status=status.HTTP_400_BAD_REQUEST
            )

class CertificateRequestListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        logger.info(f"Certificate request list requested by user {request.user.username}")
        
        try:
            # Get requests where user is either the requester or the knowledge path/event author
            # Exclude cancelled requests
            requests = CertificateRequest.objects.filter(
                models.Q(requester=request.user) |  # User's own requests
                models.Q(knowledge_path__author=request.user) |  # Requests for user's knowledge paths
                models.Q(event__owner=request.user)  # Requests for user's events
            ).exclude(
                status='CANCELLED'  # Exclude cancelled requests
            ).select_related('knowledge_path', 'event', 'requester').order_by('-request_date')

            serializer = CertificateRequestSerializer(requests, many=True)
            logger.info(f"Retrieved {len(serializer.data)} certificate requests for user {request.user.username}")
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error retrieving certificate requests for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to retrieve certificate requests'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class CertificateRequestActionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, request_id, action):
        logger.info(f"Certificate request action requested - Request ID: {request_id}, Action: {action}, User: {request.user.username}")
        logger.debug(f"Action data: {request.data}")
        
        try:
            certificate_request = get_object_or_404(CertificateRequest, id=request_id)
            logger.debug(f"Found certificate request - ID: {certificate_request.id}, Status: {certificate_request.status}")
            
            if action == 'approve':
                logger.info(f"Approval requested for certificate request {request_id}")
                
                # Check if user is the knowledge path author or event owner
                if certificate_request.knowledge_path and request.user != certificate_request.knowledge_path.author:
                    logger.warning(f"Unauthorized approval attempt - User: {request.user.username}, Path author: {certificate_request.knowledge_path.author.username}")
                    return Response(
                        {"error": "Only the knowledge path author can approve certificate requests"},
                        status=status.HTTP_403_FORBIDDEN
                    )
                elif certificate_request.event and request.user != certificate_request.event.owner:
                    logger.warning(f"Unauthorized approval attempt - User: {request.user.username}, Event owner: {certificate_request.event.owner.username}")
                    return Response(
                        {"error": "Only the event owner can approve certificate requests"},
                        status=status.HTTP_403_FORBIDDEN
                    )
                
                if certificate_request.status not in ['PENDING', 'REJECTED']:
                    logger.warning(f"Invalid approval attempt - Request status: {certificate_request.status}")
                    return Response(
                        {"error": "Can only approve pending or rejected requests"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                # Create a new certificate template with the note
                note = request.data.get('note', '') if request.data else ''
                if certificate_request.knowledge_path:
                    template = CertificateTemplate.objects.create(
                        title=f"Certificate for {certificate_request.knowledge_path.title}",
                        description=f"Certificate issued for completing {certificate_request.knowledge_path.title}",
                        note=note,
                        is_active=True
                    )
                    
                    # Create the certificate
                    certificate = Certificate.objects.create(
                        user=certificate_request.requester,
                        knowledge_path=certificate_request.knowledge_path,
                        template=template,
                        issued_by=request.user
                    )
                    logger.info(f"Knowledge path certificate created - ID: {certificate.id}, User: {certificate.user.username}, Path: {certificate.knowledge_path.title}")
                elif certificate_request.event:
                    template = CertificateTemplate.objects.create(
                        title=f"Certificate for {certificate_request.event.title}",
                        description=f"Certificate issued for attending {certificate_request.event.title}",
                        note=note,
                        is_active=True
                    )
                    
                    # Create the certificate
                    certificate = Certificate.objects.create(
                        user=certificate_request.requester,
                        event=certificate_request.event,
                        template=template,
                        issued_by=request.user
                    )
                    logger.info(f"Event certificate created - ID: {certificate.id}, User: {certificate.user.username}, Event: {certificate.event.title}")
                
                # Approve the request
                certificate_request.status = 'APPROVED'
                certificate_request.response_date = timezone.now()
                certificate_request.save()
                logger.info(f"Certificate request {request_id} approved successfully")
                
                # Send notification
                try:
                    notify_certificate_approval(certificate_request)
                    logger.debug(f"Approval notification sent for certificate request {request_id}")
                except Exception as e:
                    logger.error(f"Failed to send approval notification for certificate request {request_id}: {str(e)}", exc_info=True)
                
                # Return updated certificate request data
                serializer = CertificateRequestSerializer(certificate_request)
                return Response(serializer.data)
                
            elif action == 'reject':
                logger.info(f"Rejection requested for certificate request {request_id}")
                
                # Check if user is the knowledge path author or event owner
                if certificate_request.knowledge_path and request.user != certificate_request.knowledge_path.author:
                    logger.warning(f"Unauthorized rejection attempt - User: {request.user.username}, Path author: {certificate_request.knowledge_path.author.username}")
                    return Response(
                        {"error": "Only the knowledge path author can reject certificate requests"},
                        status=status.HTTP_403_FORBIDDEN
                    )
                elif certificate_request.event and request.user != certificate_request.event.owner:
                    logger.warning(f"Unauthorized rejection attempt - User: {request.user.username}, Event owner: {certificate_request.event.owner.username}")
                    return Response(
                        {"error": "Only the event owner can reject certificate requests"},
                        status=status.HTTP_403_FORBIDDEN
                    )
                
                if certificate_request.status != 'PENDING':
                    logger.warning(f"Invalid rejection attempt - Request status: {certificate_request.status}")
                    return Response(
                        {"error": "Can only reject pending requests"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                rejection_reason = request.data.get('rejection_reason', '')
                logger.debug(f"Rejection reason: {rejection_reason}")
                
                certificate_request.status = 'REJECTED'
                certificate_request.response_date = timezone.now()
                certificate_request.rejection_reason = rejection_reason
                certificate_request.save()
                logger.info(f"Certificate request {request_id} rejected successfully")
                
                # Send notification
                try:
                    notify_certificate_rejection(certificate_request)
                    logger.debug(f"Rejection notification sent for certificate request {request_id}")
                except Exception as e:
                    logger.error(f"Failed to send rejection notification for certificate request {request_id}: {str(e)}", exc_info=True)
                
                # Return updated certificate request data
                serializer = CertificateRequestSerializer(certificate_request)
                return Response(serializer.data)
                
            elif action == 'cancel':
                logger.info(f"Cancellation requested for certificate request {request_id}")
                
                # Check if user is the requester
                if request.user != certificate_request.requester:
                    logger.warning(f"Unauthorized cancellation attempt - User: {request.user.username}, Requester: {certificate_request.requester.username}")
                    return Response(
                        {"error": "Only the requester can cancel certificate requests"},
                        status=status.HTTP_403_FORBIDDEN
                    )
                
                if certificate_request.status != 'PENDING':
                    logger.warning(f"Invalid cancellation attempt - Request status: {certificate_request.status}")
                    return Response(
                        {"error": "Can only cancel pending requests"},
                        status=status.HTTP_400_BAD_REQUEST
                    )
                
                certificate_request.status = 'CANCELLED'
                certificate_request.response_date = timezone.now()
                certificate_request.save()
                logger.info(f"Certificate request {request_id} cancelled successfully")
                
                # Return updated certificate request data
                serializer = CertificateRequestSerializer(certificate_request)
                return Response(serializer.data)
                
            else:
                logger.warning(f"Invalid action requested: {action}")
                return Response(
                    {"error": "Invalid action"},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Exception as e:
            logger.error(f"Error processing certificate request action {action} for request {request_id}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to process certificate request action'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class CertificateRequestStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, path_id):
        logger.info(f"Certificate request status check - Path ID: {path_id}, User: {request.user.username}")
        
        try:
            # Check if knowledge path exists
            knowledge_path = get_object_or_404(KnowledgePath, id=path_id)
            logger.debug(f"Found knowledge path: {knowledge_path.title}")
            
            # Check for existing certificate request
            certificate_request = CertificateRequest.objects.filter(
                requester=request.user,
                knowledge_path=knowledge_path
            ).first()
            
            # Check for existing certificate
            certificate = Certificate.objects.filter(
                user=request.user,
                knowledge_path=knowledge_path
            ).first()
            
            response_data = {
                'has_certificate': bool(certificate),
                'certificate_request': None
            }
            
            if certificate_request:
                response_data['certificate_request'] = {
                    'id': certificate_request.id,
                    'status': certificate_request.status,
                    'request_date': certificate_request.request_date,
                    'response_date': certificate_request.response_date,
                    'rejection_reason': certificate_request.rejection_reason,
                    'notes': certificate_request.notes
                }
                logger.debug(f"Found certificate request - ID: {certificate_request.id}, Status: {certificate_request.status}")
            
            if certificate:
                logger.debug(f"Found certificate - ID: {certificate.id}")
            
            logger.info(f"Status check completed - User: {request.user.username}, Path: {knowledge_path.title}, Has certificate: {bool(certificate)}")
            return Response(response_data)
            
        except Exception as e:
            logger.error(f"Error getting certificate request status for user {request.user.username} and path {path_id}: {str(e)}", exc_info=True)
            return Response(
                {
                    'error': 'Failed to get certificate request status',
                    'details': str(e)
                },
                status=status.HTTP_400_BAD_REQUEST
            )

class EventCertificateRequestStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, event_id):
        logger.info(f"Event certificate request status check - Event ID: {event_id}, User: {request.user.username}")
        
        try:
            # Check if event exists
            event = get_object_or_404(Event, id=event_id)
            logger.debug(f"Found event: {event.title}")
            
            # Check for existing certificate request
            certificate_request = CertificateRequest.objects.filter(
                requester=request.user,
                event=event
            ).first()
            
            # Check for existing certificate
            certificate = Certificate.objects.filter(
                user=request.user,
                event=event
            ).first()
            
            response_data = {
                'has_certificate': bool(certificate),
                'certificate_request': None
            }
            
            if certificate_request:
                response_data['certificate_request'] = {
                    'id': certificate_request.id,
                    'status': certificate_request.status,
                    'request_date': certificate_request.request_date,
                    'response_date': certificate_request.response_date,
                    'rejection_reason': certificate_request.rejection_reason,
                    'notes': certificate_request.notes
                }
                logger.debug(f"Found certificate request - ID: {certificate_request.id}, Status: {certificate_request.status}")
            
            if certificate:
                logger.debug(f"Found certificate - ID: {certificate.id}")
            
            logger.info(f"Event status check completed - User: {request.user.username}, Event: {event.title}, Has certificate: {bool(certificate)}")
            return Response(response_data)
            
        except Exception as e:
            logger.error(f"Error getting event certificate request status for user {request.user.username} and event {event_id}: {str(e)}", exc_info=True)
            return Response(
                {
                    'error': 'Failed to get certificate request status',
                    'details': str(e)
                },
                status=status.HTTP_400_BAD_REQUEST
            )

class KnowledgePathCertificateRequestsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, path_id):
        logger.info(f"Knowledge path certificate requests requested - Path ID: {path_id}, User: {request.user.username}")
        
        try:
            # Get the knowledge path
            knowledge_path = get_object_or_404(KnowledgePath, id=path_id)
            logger.debug(f"Found knowledge path: {knowledge_path.title}")
            
            # Check if user is the author
            if knowledge_path.author != request.user:
                logger.warning(f"Unauthorized access attempt - User: {request.user.username}, Path author: {knowledge_path.author.username}")
                return Response(
                    {'error': 'You are not authorized to view these requests'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get pending requests for this knowledge path
            requests = CertificateRequest.objects.filter(
                knowledge_path=knowledge_path,
                status='PENDING'
            ).select_related('requester').order_by('-request_date')
            
            serializer = CertificateRequestSerializer(requests, many=True)
            logger.info(f"Retrieved {len(serializer.data)} pending certificate requests for knowledge path {knowledge_path.title}")
            return Response({
                'count': requests.count(),
                'requests': serializer.data
            })
        except Exception as e:
            logger.error(f"Error retrieving certificate requests for knowledge path {path_id}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to retrieve certificate requests'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class EventCertificateRequestsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, event_id):
        logger.info(f"Event certificate requests requested - Event ID: {event_id}, User: {request.user.username}")
        
        try:
            # Get the event
            event = get_object_or_404(Event, id=event_id)
            logger.debug(f"Found event: {event.title}")
            
            # Check if user is the owner
            if event.owner != request.user:
                logger.warning(f"Unauthorized access attempt - User: {request.user.username}, Event owner: {event.owner.username}")
                return Response(
                    {'error': 'You are not authorized to view these requests'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get pending requests for this event
            requests = CertificateRequest.objects.filter(
                event=event,
                status='PENDING'
            ).select_related('requester').order_by('-request_date')
            
            serializer = CertificateRequestSerializer(requests, many=True)
            logger.info(f"Retrieved {len(serializer.data)} pending certificate requests for event {event.title}")
            return Response({
                'count': requests.count(),
                'requests': serializer.data
            })
        except Exception as e:
            logger.error(f"Error retrieving certificate requests for event {event_id}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to retrieve certificate requests'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class CertificateListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        logger.info(f"Certificate list requested by user {request.user.username}")
        
        try:
            # Filter by user if specified (for visitor view)
            user_id = request.query_params.get('user')
            if user_id:
                logger.debug(f"Filtering certificates for user ID: {user_id}")
                # For visitor view, only show certificates for the specified user
                certificates = Certificate.objects.filter(
                    user_id=user_id
                ).select_related('knowledge_path', 'event', 'template', 'issued_by').order_by('-issued_on')
            else:
                logger.debug(f"Showing certificates for requesting user: {request.user.username}")
                # For owner view, show user's own certificates
                certificates = Certificate.objects.filter(
                    user=request.user
                ).select_related('knowledge_path', 'event', 'template', 'issued_by').order_by('-issued_on')

            serializer = CertificateSerializer(certificates, many=True, context={'request': request})
            logger.info(f"Retrieved {len(serializer.data)} certificates")
            return Response(serializer.data)
        except Exception as e:
            logger.error(f"Error retrieving certificates for user {request.user.username}: {str(e)}", exc_info=True)
            return Response(
                {'error': 'Failed to retrieve certificates'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class EventCertificateGenerationView(APIView):
    """
    Generate and send certificates for event participants
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, event_id, registration_id):
        logger.info(f"Event certificate generation requested - Event ID: {event_id}, Registration ID: {registration_id}, User: {request.user.username}")
        logger.debug(f"Request data: {request.data}")
        
        try:
            # Get the event
            event = get_object_or_404(Event, id=event_id)
            logger.debug(f"Found event: {event.title}")
            
            # Check if user is the event owner
            if event.owner != request.user:
                logger.warning(f"Unauthorized certificate generation attempt - User: {request.user.username}, Event owner: {event.owner.username}")
                return Response(
                    {'error': 'Only the event owner can generate certificates'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get the registration
            registration = get_object_or_404(EventRegistration, id=registration_id, event=event)
            logger.debug(f"Found registration for user: {registration.user.username}")
            
            # Check if certificate already exists
            existing_certificate = Certificate.objects.filter(
                user=registration.user,
                event=event
            ).first()
            
            logger.debug(f"Checking for existing certificate - User: {registration.user.username}, Event: {event.title}")
            logger.debug(f"Existing certificate found: {existing_certificate is not None}")
            if existing_certificate:
                logger.debug(f"Certificate ID: {existing_certificate.id}, Issued on: {existing_certificate.issued_on}")
            
            if existing_certificate:
                logger.warning(f"Certificate already exists for user {registration.user.username} and event {event.title}")
                return Response(
                    {'error': 'Certificate already exists for this user and event'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate that the event has ended
            if event.date_end and event.date_end > timezone.now():
                logger.warning(f"Certificate generation attempted for ongoing event - Event end date: {event.date_end}")
                return Response(
                    {'error': 'Cannot generate certificates for events that have not ended'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate registration status
            if registration.registration_status != 'REGISTERED':
                logger.warning(f"Certificate generation attempted for invalid registration status - Status: {registration.registration_status}")
                return Response(
                    {'error': 'Cannot generate certificate for cancelled registration'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate payment status for paid events
            if event.reference_price > 0 and registration.payment_status != 'PAID':
                logger.warning(f"Certificate generation attempted for unpaid registration - Payment status: {registration.payment_status}")
                return Response(
                    {'error': 'Cannot generate certificate for unpaid registration'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            logger.info(f"All validations passed, creating certificate for user {registration.user.username}")
            
            # Create certificate template
            template = CertificateTemplate.objects.create(
                title=f"Certificate for {event.title}",
                description=f"Certificate issued for attending {event.title}",
                note=request.data.get('note', ''),
                is_active=True
            )
            logger.debug(f"Certificate template created - ID: {template.id}")
            
            # Create the certificate
            certificate = Certificate.objects.create(
                user=registration.user,
                event=event,
                event_registration=registration,
                template=template,
                issued_by=request.user
            )
            logger.info(f"Certificate created successfully - ID: {certificate.id}")
            
            # Update registration notes
            registration.notes = f"{registration.notes}\nCertificate generated on {timezone.now().strftime('%Y-%m-%d %H:%M')}" if registration.notes else f"Certificate generated on {timezone.now().strftime('%Y-%m-%d %H:%M')}"
            registration.save()
            logger.debug(f"Registration notes updated")
            
            # Send notification to the student
            try:
                notify_certificate_sent(registration)
                logger.debug(f"Certificate notification sent to user {registration.user.username}")
            except Exception as e:
                logger.error(f"Failed to send certificate notification to user {registration.user.username}: {str(e)}", exc_info=True)
            
            logger.info(f"Certificate generation completed successfully - Certificate ID: {certificate.id}")
            
            # Return the created certificate
            serializer = CertificateSerializer(certificate, context={'request': request})
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Event.DoesNotExist:
            logger.warning(f"Event not found with ID: {event_id}")
            return Response(
                {'error': 'Event not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except EventRegistration.DoesNotExist:
            logger.warning(f"Registration not found with ID: {registration_id}")
            return Response(
                {'error': 'Registration not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f"Error generating certificate for event {event_id}, registration {registration_id}: {str(e)}", exc_info=True)
            return Response(
                {
                    'error': 'Failed to generate certificate',
                    'details': str(e)
                },
                status=status.HTTP_400_BAD_REQUEST
            )
