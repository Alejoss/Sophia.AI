from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth.models import User
from knowledge_paths.models import KnowledgePath, Node
from content.models import Content, ContentProfile
from profiles.models import UserNodeCompletion
from django.utils import timezone

class KnowledgePathModelTests(TestCase):
    """Test suite for KnowledgePath model"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.knowledge_path = KnowledgePath.objects.create(
            title='Test Path',
            description='Test Description',
            author=self.user
        )

    def test_knowledge_path_creation(self):
        """Test knowledge path creation and basic attributes"""
        self.assertEqual(self.knowledge_path.title, 'Test Path')
        self.assertEqual(self.knowledge_path.description, 'Test Description')
        self.assertEqual(self.knowledge_path.author, self.user)
        self.assertIsNotNone(self.knowledge_path.created_at)
        self.assertIsNotNone(self.knowledge_path.updated_at)

    def test_knowledge_path_str(self):
        """Test string representation of knowledge path"""
        self.assertEqual(str(self.knowledge_path), 'Test Path')

class NodeModelTests(TestCase):
    """Test suite for Node model"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.knowledge_path = KnowledgePath.objects.create(
            title='Test Path',
            description='Test Description',
            author=self.user
        )
        self.content = Content.objects.create(
            original_title='Test Content',
            media_type='video',
            uploaded_by=self.user
        )
        self.content_profile = ContentProfile.objects.create(
            content=self.content,
            title='Test Content Profile',
            user=self.user
        )
        self.node = Node.objects.create(
            knowledge_path=self.knowledge_path,
            content_profile=self.content_profile,
            title='Test Node',
            description='Test Node Description',
            order=1,
            media_type='video'
        )

    def test_node_creation(self):
        """Test node creation and basic attributes"""
        self.assertEqual(self.node.title, 'Test Node')
        self.assertEqual(self.node.description, 'Test Node Description')
        self.assertEqual(self.node.order, 1)
        self.assertEqual(self.node.media_type, 'video')
        self.assertEqual(self.node.knowledge_path, self.knowledge_path)
        self.assertEqual(self.node.content_profile, self.content_profile)

    def test_node_str(self):
        """Test string representation of node"""
        self.assertEqual(str(self.node), 'Test Node (video)')

class KnowledgePathAPITests(APITestCase):
    """Test suite for KnowledgePath API endpoints"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        self.knowledge_path = KnowledgePath.objects.create(
            title='Test Path',
            description='Test Description',
            author=self.user
        )

    def test_create_knowledge_path(self):
        """Test creating a new knowledge path via API"""
        url = reverse('knowledge_paths:knowledge-path-create')
        data = {
            'title': 'New Path',
            'description': 'New Description'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(KnowledgePath.objects.count(), 2)
        self.assertEqual(response.data['title'], 'New Path')

    def test_list_knowledge_paths(self):
        """Test listing all knowledge paths via API"""
        url = reverse('knowledge_paths:knowledge-path-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Check that our test knowledge path is in the results
        self.assertTrue(any(path['id'] == self.knowledge_path.id for path in response.data['results']))
        # Verify pagination structure
        self.assertIn('count', response.data)
        self.assertIn('next', response.data)
        self.assertIn('previous', response.data)
        self.assertIn('results', response.data)

    def test_get_knowledge_path_detail(self):
        """Test retrieving a specific knowledge path via API"""
        url = reverse('knowledge_paths:knowledge-path-detail', args=[self.knowledge_path.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'Test Path')

    def test_update_knowledge_path(self):
        """Test updating a knowledge path via API"""
        url = reverse('knowledge_paths:knowledge-path-detail', args=[self.knowledge_path.id])
        data = {
            'title': 'Updated Path',
            'description': 'Updated Description'
        }
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.knowledge_path.refresh_from_db()
        self.assertEqual(self.knowledge_path.title, 'Updated Path')

class NodeAPITests(APITestCase):
    """Test suite for Node API endpoints"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        self.knowledge_path = KnowledgePath.objects.create(
            title='Test Path',
            description='Test Description',
            author=self.user
        )
        self.content = Content.objects.create(
            original_title='Test Content',
            media_type='video',
            uploaded_by=self.user
        )
        self.content_profile = ContentProfile.objects.create(
            content=self.content,
            title='Test Content Profile',
            user=self.user
        )

    def test_create_node(self):
        """Test creating a new node via API"""
        url = reverse('knowledge_paths:node-create', args=[self.knowledge_path.id])
        data = {
            'content_profile_id': self.content_profile.id,
            'title': 'New Node',
            'description': 'New Node Description'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Node.objects.count(), 1)
        self.assertEqual(response.data['title'], 'New Node')

    def test_node_completion(self):
        """Test marking a node as completed"""
        node = Node.objects.create(
            knowledge_path=self.knowledge_path,
            content_profile=self.content_profile,
            title='Test Node',
            order=1
        )
        url = reverse('knowledge_paths:node-detail', args=[self.knowledge_path.id, node.id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        completion = UserNodeCompletion.objects.filter(
            user=self.user,
            node=node
        ).first()
        self.assertIsNotNone(completion)
        self.assertIsNotNone(completion.completed_at)
