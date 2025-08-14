from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status
from django.contrib.auth.models import User
from knowledge_paths.models import KnowledgePath
from certificates.models import CertificateRequest, Certificate, CertificateTemplate
import json

class CertificateRequestFlowTest(TestCase):
    def setUp(self):
        # Create test users
        self.student = User.objects.create_user(
            username='student',
            email='student@test.com',
            password='testpass123'
        )
        self.teacher = User.objects.create_user(
            username='teacher',
            email='teacher@test.com',
            password='testpass123'
        )
        
        # Create test knowledge path
        self.knowledge_path = KnowledgePath.objects.create(
            title='Test Knowledge Path',
            description='Test Description',
            author=self.teacher
        )
        
        # Setup API client
        self.client = APIClient()
        
        # URLs
        self.request_url = reverse('certificates:certificate-request', args=[self.knowledge_path.id])
        self.requests_list_url = reverse('certificates:certificate-request-list')
        self.status_url = reverse('certificates:certificate-request-status', args=[self.knowledge_path.id])

    def test_certificate_request_flow(self):
        """Test the complete certificate request flow from request to approval"""
        # 1. Student requests certificate
        self.client.force_authenticate(user=self.student)
        request_data = {
            'notes': {'message': 'Please review my completion'}
        }
        response = self.client.post(self.request_url, request_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        request_id = response.data['id']
        
        # Verify request was created with correct status
        self.assertEqual(response.data['status'], 'PENDING')
        self.assertEqual(response.data['requester'], self.student.username)
        
        # 2. Check request status
        response = self.client.get(self.status_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['certificate_request'])
        self.assertEqual(response.data['certificate_request']['status'], 'PENDING')
        
        # 3. Teacher approves request
        self.client.force_authenticate(user=self.teacher)
        approve_url = reverse('certificates:certificate-request-action', 
                            args=[request_id, 'approve'])
        approve_data = {'note': 'Great work!'}
        response = self.client.post(approve_url, approve_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify request was approved
        self.assertEqual(response.data['status'], 'APPROVED')
        
        # Verify certificate was created
        certificate = Certificate.objects.filter(
            user=self.student,
            knowledge_path=self.knowledge_path
        ).first()
        self.assertIsNotNone(certificate)
        
        # Verify certificate template was created with note
        template = CertificateTemplate.objects.filter(
            title=f"Certificate for {self.knowledge_path.title}"
        ).first()
        self.assertIsNotNone(template)
        self.assertEqual(template.note, 'Great work!')

    def test_certificate_request_rejection_flow(self):
        """Test the certificate request rejection flow"""
        # 1. Student requests certificate
        self.client.force_authenticate(user=self.student)
        request_data = {'notes': {'message': 'Please review'}}
        response = self.client.post(self.request_url, request_data, format='json')
        request_id = response.data['id']
        
        # 2. Teacher rejects request
        self.client.force_authenticate(user=self.teacher)
        reject_url = reverse('certificates:certificate-request-action', 
                           args=[request_id, 'reject'])
        reject_data = {
            'rejection_reason': 'Incomplete work'
        }
        response = self.client.post(reject_url, reject_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify request was rejected
        self.assertEqual(response.data['status'], 'REJECTED')
        self.assertEqual(response.data['rejection_reason'], 'Incomplete work')
        
        # 3. Teacher accepts previously rejected request
        approve_url = reverse('certificates:certificate-request-action', 
                            args=[request_id, 'approve'])
        approve_data = {'note': 'Updated work looks good'}
        response = self.client.post(approve_url, approve_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify request was approved
        self.assertEqual(response.data['status'], 'APPROVED')

    def test_certificate_request_cancellation(self):
        """Test certificate request cancellation by student"""
        # 1. Student requests certificate
        self.client.force_authenticate(user=self.student)
        request_data = {'notes': {'message': 'Please review'}}
        response = self.client.post(self.request_url, request_data, format='json')
        request_id = response.data['id']
        
        # 2. Student cancels request
        cancel_url = reverse('certificates:certificate-request-action', 
                           args=[request_id, 'cancel'])
        response = self.client.post(cancel_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Verify request was cancelled
        self.assertEqual(response.data['status'], 'CANCELLED')
        
        # 3. Verify cancelled request is not in list
        response = self.client.get(self.requests_list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

    def test_certificate_request_authorization(self):
        """Test authorization rules for certificate requests"""
        # 1. Only knowledge path author can approve/reject
        self.client.force_authenticate(user=self.student)
        request_data = {'notes': {'message': 'Please review'}}
        response = self.client.post(self.request_url, request_data, format='json')
        request_id = response.data['id']
        
        # Try to approve as student (should fail)
        approve_url = reverse('certificates:certificate-request-action', 
                            args=[request_id, 'approve'])
        response = self.client.post(approve_url, {'note': 'Test'})
        self.assertEqual(response.status_code, status.HTTP_415_UNSUPPORTED_MEDIA_TYPE)
        
        # 2. Only requester can cancel
        self.client.force_authenticate(user=self.teacher)
        cancel_url = reverse('certificates:certificate-request-action', 
                           args=[request_id, 'cancel'])
        response = self.client.post(cancel_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_duplicate_certificate_requests(self):
        """Test handling of duplicate certificate requests"""
        # 1. Student requests certificate
        self.client.force_authenticate(user=self.student)
        request_data = {'notes': {'message': 'Please review'}}
        response = self.client.post(self.request_url, request_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        
        # 2. Try to request again (should fail)
        response = self.client.post(self.request_url, request_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        
        # 3. Cancel request and try again (should succeed)
        request_id = response.data.get('request_id')
        cancel_url = reverse('certificates:certificate-request-action', 
                           args=[request_id, 'cancel'])
        self.client.post(cancel_url)
        
        response = self.client.post(self.request_url, request_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_certificate_request_list_filtering(self):
        """Test filtering of certificate requests in list view"""
        # Create multiple knowledge paths for different requests
        path1 = KnowledgePath.objects.create(
            title="Test Path 1",
            description="Test Description 1",
            author=self.teacher
        )
        path2 = KnowledgePath.objects.create(
            title="Test Path 2",
            description="Test Description 2",
            author=self.teacher
        )
        path3 = KnowledgePath.objects.create(
            title="Test Path 3",
            description="Test Description 3",
            author=self.teacher
        )

        # Create and approve first request
        self.client.force_authenticate(user=self.student)
        request_data = {'notes': {'message': 'Please review'}}
        response = self.client.post(reverse('certificates:certificate-request', args=[path1.id]), request_data, format='json')
        request_id = response.data['id']
        self.client.force_authenticate(user=self.teacher)
        approve_url = reverse('certificates:certificate-request-action', args=[request_id, 'approve'])
        self.client.post(approve_url, {'note': 'Approved'}, format='json')
        
        # Create and reject second request
        self.client.force_authenticate(user=self.student)
        response = self.client.post(reverse('certificates:certificate-request', args=[path2.id]), request_data, format='json')
        request_id = response.data['id']
        self.client.force_authenticate(user=self.teacher)
        reject_url = reverse('certificates:certificate-request-action', args=[request_id, 'reject'])
        self.client.post(reject_url, {'rejection_reason': 'Rejected'}, format='json')
        
        # Create and cancel third request
        self.client.force_authenticate(user=self.student)
        response = self.client.post(reverse('certificates:certificate-request', args=[path3.id]), request_data, format='json')
        request_id = response.data['id']
        cancel_url = reverse('certificates:certificate-request-action', args=[request_id, 'cancel'])
        self.client.post(cancel_url, format='json')
        
        # Check requests list as teacher
        self.client.force_authenticate(user=self.teacher)
        response = self.client.get(self.requests_list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Should see approved and rejected requests, but not cancelled
        requests = response.data
        self.assertEqual(len(requests), 2)
        statuses = [req['status'] for req in requests]
        self.assertIn('APPROVED', statuses)
        self.assertIn('REJECTED', statuses)
        self.assertNotIn('CANCELLED', statuses)
