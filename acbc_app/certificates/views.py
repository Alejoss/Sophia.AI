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

# Create your views here.

class CertificateRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, path_id):
        print(f"DEBUG: CertificateRequestView.post called with path_id={path_id}")
        print(f"DEBUG: Request data: {request.data}")
        print(f"DEBUG: Request user: {request.user.username}")
        
        try:
            # Check if knowledge path exists
            knowledge_path = get_object_or_404(KnowledgePath, id=path_id)
            print(f"DEBUG: Found knowledge path: {knowledge_path.title}")
            
            # Check if user has already requested a certificate for this path
            existing_request = CertificateRequest.objects.filter(
                requester=request.user,
                knowledge_path=knowledge_path
            ).first()
            
            print(f"DEBUG: Existing request found: {existing_request is not None}")
            if existing_request:
                print(f"DEBUG: Existing request status: {existing_request.status}")
            
            if existing_request and existing_request.status not in ['CANCELLED', 'REJECTED']:
                print(f"DEBUG: Returning error - already requested")
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
                print(f"DEBUG: Deleting existing cancelled/rejected request")
                existing_request.delete()
            
            # Create new certificate request with notes
            request_data = {
                'knowledge_path': knowledge_path.id,
                'notes': request.data.get('notes', {})
            }
            print(f"DEBUG: Creating serializer with data: {request_data}")
            
            serializer = CertificateRequestSerializer(
                data=request_data,
                context={'request': request}
            )
            
            print(f"DEBUG: Serializer is_valid() result: {serializer.is_valid()}")
            if not serializer.is_valid():
                print(f"DEBUG: Serializer errors: {serializer.errors}")
                return Response(
                    {
                        'error': 'Invalid request data',
                        'details': serializer.errors
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            print(f"DEBUG: Saving certificate request...")
            certificate_request = serializer.save()
            print(f"DEBUG: Certificate request saved with ID: {certificate_request.id}")
            
            # Send notification to knowledge path author
            notify_certificate_request(certificate_request)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            print(f"DEBUG: Exception occurred: {str(e)}")
            print(f"DEBUG: Exception type: {type(e)}")
            import traceback
            print(f"DEBUG: Traceback: {traceback.format_exc()}")
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
        try:
            # Check if event exists
            event = get_object_or_404(Event, id=event_id)
            
            # Check if user has already requested a certificate for this event
            existing_request = CertificateRequest.objects.filter(
                requester=request.user,
                event=event
            ).first()
            
            if existing_request and existing_request.status not in ['CANCELLED', 'REJECTED']:
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
                existing_request.delete()
            
            # Create new certificate request with notes
            serializer = CertificateRequestSerializer(
                data={
                    'event': event.id,
                    'notes': request.data.get('notes', {})
                },
                context={'request': request}
            )
            if serializer.is_valid():
                certificate_request = serializer.save()
                # Send notification to event owner
                notify_certificate_request(certificate_request)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            
            return Response(
                {
                    'error': 'Invalid request data',
                    'details': serializer.errors
                },
                status=status.HTTP_400_BAD_REQUEST
            )
            
        except Exception as e:
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
        return Response(serializer.data)

class CertificateRequestActionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, request_id, action):
        certificate_request = get_object_or_404(CertificateRequest, id=request_id)
        
        if action == 'approve':
            # Check if user is the knowledge path author or event owner
            if certificate_request.knowledge_path and request.user != certificate_request.knowledge_path.author:
                return Response(
                    {"error": "Only the knowledge path author can approve certificate requests"},
                    status=status.HTTP_403_FORBIDDEN
                )
            elif certificate_request.event and request.user != certificate_request.event.owner:
                return Response(
                    {"error": "Only the event owner can approve certificate requests"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            if certificate_request.status not in ['PENDING', 'REJECTED']:
                return Response(
                    {"error": "Can only approve pending or rejected requests"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create a new certificate template with the note
            note = request.data.get('note', '')
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
            
            # Approve the request
            certificate_request.status = 'APPROVED'
            certificate_request.response_date = timezone.now()
            certificate_request.save()
            
            # Send notification
            notify_certificate_approval(certificate_request)
            
            # Return updated certificate request data
            serializer = CertificateRequestSerializer(certificate_request)
            return Response(serializer.data)
            
        elif action == 'reject':
            # Check if user is the knowledge path author or event owner
            if certificate_request.knowledge_path and request.user != certificate_request.knowledge_path.author:
                return Response(
                    {"error": "Only the knowledge path author can reject certificate requests"},
                    status=status.HTTP_403_FORBIDDEN
                )
            elif certificate_request.event and request.user != certificate_request.event.owner:
                return Response(
                    {"error": "Only the event owner can reject certificate requests"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            if certificate_request.status != 'PENDING':
                return Response(
                    {"error": "Can only reject pending requests"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            rejection_reason = request.data.get('rejection_reason', '')
            
            certificate_request.status = 'REJECTED'
            certificate_request.response_date = timezone.now()
            certificate_request.rejection_reason = rejection_reason
            certificate_request.save()
            
            # Send notification
            notify_certificate_rejection(certificate_request)
            
            # Return updated certificate request data
            serializer = CertificateRequestSerializer(certificate_request)
            return Response(serializer.data)
            
        elif action == 'cancel':
            # Check if user is the requester
            if request.user != certificate_request.requester:
                return Response(
                    {"error": "Only the requester can cancel certificate requests"},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            if certificate_request.status != 'PENDING':
                return Response(
                    {"error": "Can only cancel pending requests"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            certificate_request.status = 'CANCELLED'
            certificate_request.response_date = timezone.now()
            certificate_request.save()
            
            # Return updated certificate request data
            serializer = CertificateRequestSerializer(certificate_request)
            return Response(serializer.data)
            
        else:
            return Response(
                {"error": "Invalid action"},
                status=status.HTTP_400_BAD_REQUEST
            )

class CertificateRequestStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, path_id):
        try:
            # Check if knowledge path exists
            knowledge_path = get_object_or_404(KnowledgePath, id=path_id)
            
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
            
            return Response(response_data)
            
        except Exception as e:
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
        try:
            # Check if event exists
            event = get_object_or_404(Event, id=event_id)
            
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
            
            return Response(response_data)
            
        except Exception as e:
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
        # Get the knowledge path
        knowledge_path = get_object_or_404(KnowledgePath, id=path_id)
        
        # Check if user is the author
        if knowledge_path.author != request.user:
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
        return Response({
            'count': requests.count(),
            'requests': serializer.data
        })

class EventCertificateRequestsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, event_id):
        # Get the event
        event = get_object_or_404(Event, id=event_id)
        
        # Check if user is the owner
        if event.owner != request.user:
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
        return Response({
            'count': requests.count(),
            'requests': serializer.data
        })

class CertificateListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Filter by user if specified (for visitor view)
        user_id = request.query_params.get('user')
        if user_id:
            # For visitor view, only show certificates for the specified user
            certificates = Certificate.objects.filter(
                user_id=user_id
            ).select_related('knowledge_path', 'event', 'template', 'issued_by').order_by('-issued_on')
        else:
            # For owner view, show user's own certificates
            certificates = Certificate.objects.filter(
                user=request.user
            ).select_related('knowledge_path', 'event', 'template', 'issued_by').order_by('-issued_on')

        serializer = CertificateSerializer(certificates, many=True, context={'request': request})
        return Response(serializer.data)

class EventCertificateGenerationView(APIView):
    """
    Generate and send certificates for event participants
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, event_id, registration_id):
        print(f"DEBUG: EventCertificateGenerationView.post called with event_id={event_id}, registration_id={registration_id}")
        print(f"DEBUG: Request data: {request.data}")
        print(f"DEBUG: Request user: {request.user.username}")
        
        try:
            # Get the event
            event = get_object_or_404(Event, id=event_id)
            print(f"DEBUG: Found event: {event.title}")
            
            # Check if user is the event owner
            if event.owner != request.user:
                print(f"DEBUG: Permission denied - user {request.user.username} is not owner {event.owner.username}")
                return Response(
                    {'error': 'Only the event owner can generate certificates'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Get the registration
            registration = get_object_or_404(EventRegistration, id=registration_id, event=event)
            print(f"DEBUG: Found registration for user: {registration.user.username}")
            
            # Check if certificate already exists
            existing_certificate = Certificate.objects.filter(
                user=registration.user,
                event=event
            ).first()
            
            print(f"DEBUG: Checking for existing certificate")
            print(f"DEBUG: User: {registration.user.username} (ID: {registration.user.id})")
            print(f"DEBUG: Event: {event.title} (ID: {event.id})")
            print(f"DEBUG: Existing certificate found: {existing_certificate is not None}")
            if existing_certificate:
                print(f"DEBUG: Certificate ID: {existing_certificate.id}")
                print(f"DEBUG: Certificate issued on: {existing_certificate.issued_on}")
            
            if existing_certificate:
                print(f"DEBUG: Certificate already exists")
                return Response(
                    {'error': 'Certificate already exists for this user and event'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate that the event has ended
            if event.date_end and event.date_end > timezone.now():
                print(f"DEBUG: Event has not ended yet")
                return Response(
                    {'error': 'Cannot generate certificates for events that have not ended'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate registration status
            if registration.registration_status != 'REGISTERED':
                print(f"DEBUG: Registration status is {registration.registration_status}")
                return Response(
                    {'error': 'Cannot generate certificate for cancelled registration'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate payment status for paid events
            if event.reference_price > 0 and registration.payment_status != 'PAID':
                print(f"DEBUG: Payment status is {registration.payment_status}")
                return Response(
                    {'error': 'Cannot generate certificate for unpaid registration'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            print(f"DEBUG: All validations passed, creating certificate...")
            
            # Create certificate template
            template = CertificateTemplate.objects.create(
                title=f"Certificate for {event.title}",
                description=f"Certificate issued for attending {event.title}",
                note=request.data.get('note', ''),
                is_active=True
            )
            
            # Create the certificate
            certificate = Certificate.objects.create(
                user=registration.user,
                event=event,
                event_registration=registration,
                template=template,
                issued_by=request.user
            )
            
            # Update registration notes
            registration.notes = f"{registration.notes}\nCertificate generated on {timezone.now().strftime('%Y-%m-%d %H:%M')}" if registration.notes else f"Certificate generated on {timezone.now().strftime('%Y-%m-%d %H:%M')}"
            registration.save()
            
            # Send notification to the student
            notify_certificate_sent(registration)
            
            print(f"DEBUG: Certificate created successfully with ID: {certificate.id}")
            
            # Return the created certificate
            serializer = CertificateSerializer(certificate, context={'request': request})
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Event.DoesNotExist:
            print(f"DEBUG: Event not found with ID: {event_id}")
            return Response(
                {'error': 'Event not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except EventRegistration.DoesNotExist:
            print(f"DEBUG: Registration not found with ID: {registration_id}")
            return Response(
                {'error': 'Registration not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            print(f"DEBUG: Exception occurred: {str(e)}")
            return Response(
                {
                    'error': 'Failed to generate certificate',
                    'details': str(e)
                },
                status=status.HTTP_400_BAD_REQUEST
            )
