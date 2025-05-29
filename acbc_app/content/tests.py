from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from content.models import (
    Library, Collection, Content, ContentProfile, 
    FileDetails, Topic, Publication
)
from django.utils import timezone

class ContentModelTests(TestCase):
    """Test suite for Content model"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.content = Content.objects.create(
            uploaded_by=self.user,
            media_type='VIDEO',
            original_title='Test Content',
            original_author='Test Author'
        )

    def test_content_creation(self):
        """Test content creation and basic attributes"""
        self.assertEqual(self.content.original_title, 'Test Content')
        self.assertEqual(self.content.original_author, 'Test Author')
        self.assertEqual(self.content.media_type, 'VIDEO')
        self.assertEqual(self.content.uploaded_by, self.user)
        self.assertIsNotNone(self.content.created_at)

    def test_content_str(self):
        """Test string representation of content"""
        self.assertEqual(str(self.content), 'Content: Test Content')

class ContentProfileModelTests(TestCase):
    """Test suite for ContentProfile model"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.content = Content.objects.create(
            uploaded_by=self.user,
            media_type='VIDEO',
            original_title='Test Content'
        )
        self.content_profile = ContentProfile.objects.create(
            content=self.content,
            user=self.user,
            title='Custom Title',
            author='Custom Author',
            personal_note='Test Note',
            is_visible=True,
            is_producer=True
        )

    def test_content_profile_creation(self):
        """Test content profile creation and basic attributes"""
        self.assertEqual(self.content_profile.title, 'Custom Title')
        self.assertEqual(self.content_profile.author, 'Custom Author')
        self.assertEqual(self.content_profile.personal_note, 'Test Note')
        self.assertTrue(self.content_profile.is_visible)
        self.assertTrue(self.content_profile.is_producer)
        self.assertEqual(self.content_profile.user, self.user)
        self.assertEqual(self.content_profile.content, self.content)

    def test_content_profile_str(self):
        """Test string representation of content profile"""
        expected_str = f"{self.user.username}'s view of Custom Title"
        self.assertEqual(str(self.content_profile), expected_str)

class LibraryModelTests(TestCase):
    """Test suite for Library model"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.library = Library.objects.create(
            user=self.user,
            name='Test Library'
        )

    def test_library_creation(self):
        """Test library creation and basic attributes"""
        self.assertEqual(self.library.name, 'Test Library')
        self.assertEqual(self.library.user, self.user)

    def test_library_str(self):
        """Test string representation of library"""
        expected_str = f"Test Library (Owner: {self.user.username})"
        self.assertEqual(str(self.library), expected_str)

class CollectionModelTests(TestCase):
    """Test suite for Collection model"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.library = Library.objects.create(
            user=self.user,
            name='Test Library'
        )
        self.collection = Collection.objects.create(
            library=self.library,
            name='Test Collection'
        )

    def test_collection_creation(self):
        """Test collection creation and basic attributes"""
        self.assertEqual(self.collection.name, 'Test Collection')
        self.assertEqual(self.collection.library, self.library)

    def test_collection_str(self):
        """Test string representation of collection"""
        expected_str = f"Test Collection in {self.library.name}"
        self.assertEqual(str(self.collection), expected_str)

class ContentAPITests(APITestCase):
    """Test suite for Content API endpoints"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        self.content = Content.objects.create(
            uploaded_by=self.user,
            media_type='VIDEO',
            original_title='Test Content'
        )
        self.content_profile = ContentProfile.objects.create(
            content=self.content,
            user=self.user,
            title='Custom Title'
        )

    def test_upload_content(self):
        """Test uploading new content"""
        url = reverse('content:upload_content')
        test_file = SimpleUploadedFile(
            "test_video.mp4",
            b"file_content",
            content_type="video/mp4"
        )
        data = {
            'file': test_file,
            'media_type': 'VIDEO',
            'title': 'New Content',
            'author': 'Test Author',
            'is_visible': True,
            'is_producer': False
        }
        response = self.client.post(url, data, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Content.objects.count(), 2)
        self.assertEqual(ContentProfile.objects.count(), 2)

    def test_get_content_detail(self):
        """Test retrieving content detail"""
        url = reverse('content:content-detail', args=[self.content.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['original_title'], 'Test Content')

    def test_get_user_content(self):
        """Test retrieving user's content"""
        url = reverse('content:user-content')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

class LibraryAPITests(APITestCase):
    """Test suite for Library API endpoints"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        self.library = Library.objects.create(
            user=self.user,
            name='Test Library'
        )

    def test_create_collection(self):
        """Test creating a new collection"""
        url = reverse('content:user-collections')
        data = {
            'name': 'New Collection'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Collection.objects.count(), 1)
        self.assertEqual(response.data['name'], 'New Collection')

    def test_get_collections(self):
        """Test retrieving user's collections"""
        Collection.objects.create(
            library=self.library,
            name='Test Collection'
        )
        url = reverse('content:user-collections')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

class TopicAPITests(APITestCase):
    """Test suite for Topic API endpoints"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        self.topic = Topic.objects.create(
            title='Test Topic',
            description='Test Description',
            creator=self.user
        )

    def test_create_topic(self):
        """Test creating a new topic"""
        url = reverse('content:topics')
        data = {
            'title': 'New Topic',
            'description': 'New Description'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Topic.objects.count(), 2)
        self.assertEqual(response.data['title'], 'New Topic')

    def test_get_topic_detail(self):
        """Test retrieving topic detail"""
        url = reverse('content:topic-detail', args=[self.topic.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'Test Topic')

class PublicationAPITests(APITestCase):
    """Test suite for Publication API endpoints"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.client.force_authenticate(user=self.user)
        self.content = Content.objects.create(
            uploaded_by=self.user,
            media_type='TEXT',
            original_title='Test Content'
        )
        self.content_profile = ContentProfile.objects.create(
            content=self.content,
            user=self.user,
            title='Custom Title'
        )
        self.publication = Publication.objects.create(
            user=self.user,
            content_profile=self.content_profile,
            text_content='Test Publication',
            status='PUBLISHED'
        )

    def test_create_publication(self):
        """Test creating a new publication"""
        url = reverse('content:publication-list')
        data = {
            'content_profile_id': self.content_profile.id,
            'text_content': 'New Publication',
            'status': 'PUBLISHED'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Publication.objects.count(), 2)
        self.assertEqual(response.data['text_content'], 'New Publication')

    def test_get_publication_detail(self):
        """Test retrieving publication detail"""
        url = reverse('content:publication-detail', args=[self.publication.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['text_content'], 'Test Publication')

    def test_vote_publication(self):
        """Test voting on a publication"""
        url = reverse('content:publication-vote', args=[self.publication.id])
        
        # Test upvote
        data = {'value': 1}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('vote_count', response.data)
        
        # Test removing vote
        data = {'value': 0}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Test downvote
        data = {'value': -1}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        # Test invalid vote value
        data = {'value': 2}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
