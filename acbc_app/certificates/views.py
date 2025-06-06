from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.shortcuts import get_object_or_404
from .models import CertificateRequest, Certificate
from .serializers import CertificateRequestSerializer
from knowledge_paths.models import KnowledgePath
from django.db import models

# Create your views here.

class CertificateRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, path_id):
        try:
            # Check if knowledge path exists
            knowledge_path = get_object_or_404(KnowledgePath, id=path_id)
            
            # Check if user has already requested a certificate for this path
            existing_request = CertificateRequest.objects.filter(
                requester=request.user,
                knowledge_path=knowledge_path
            ).first()
            
            if existing_request:
                return Response(
                    {
                        'error': 'You have already requested a certificate for this knowledge path',
                        'request_id': existing_request.id,
                        'status': existing_request.status
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create new certificate request with notes
            serializer = CertificateRequestSerializer(
                data={
                    'knowledge_path': knowledge_path.id,
                    'notes': request.data.get('notes', {})
                },
                context={'request': request}
            )
            if serializer.is_valid():
                serializer.save()
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
        # Get requests where user is either the requester or the knowledge path author
        requests = CertificateRequest.objects.filter(
            models.Q(requester=request.user) |  # User's own requests
            models.Q(knowledge_path__author=request.user)  # Requests for user's knowledge paths
        ).select_related('knowledge_path', 'requester').order_by('-request_date')

        serializer = CertificateRequestSerializer(requests, many=True)
        return Response(serializer.data)

class CertificateRequestActionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, request_id, action):
        if action not in ['approve', 'reject']:
            return Response(
                {'error': 'Invalid action'},
                status=status.HTTP_400_BAD_REQUEST
            )

        certificate_request = get_object_or_404(
            CertificateRequest.objects.select_related('knowledge_path'),
            id=request_id
        )

        # Check if user is the author of the knowledge path
        if certificate_request.knowledge_path.author != request.user:
            return Response(
                {'error': 'You are not authorized to perform this action'},
                status=status.HTTP_403_FORBIDDEN
            )

        if action == 'approve':
            certificate_request.approve(request.user)
        else:
            reason = request.data.get('reason', '')
            certificate_request.reject(request.user, reason)

        serializer = CertificateRequestSerializer(certificate_request)
        return Response(serializer.data)

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
