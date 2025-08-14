from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from bookmarks.models import Bookmark
from content.models import Content, Topic, Publication

class BookmarkModelTests(TestCase):
    """Test suite for Bookmark model"""
    
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
        self.topic = Topic.objects.create(
            title='Test Topic',
            description='Test Description',
            creator=self.user
        )
        self.bookmark = Bookmark.objects.create(
            user=self.user,
            content_type=ContentType.objects.get_for_model(self.content),
            object_id=self.content.id,
            topic=self.topic
        )

    def test_bookmark_creation(self):
        """Test bookmark creation and basic attributes"""
        self.assertEqual(self.bookmark.user, self.user)
        self.assertEqual(self.bookmark.content_type, ContentType.objects.get_for_model(self.content))
        self.assertEqual(self.bookmark.object_id, self.content.id)
        self.assertEqual(self.bookmark.topic, self.topic)
        self.assertFalse(self.bookmark.deleted)
        self.assertIsNotNone(self.bookmark.created_at)
        self.assertIsNotNone(self.bookmark.updated_at)

    def test_bookmark_str(self):
        """Test string representation of bookmark"""
        expected_str = f"{self.user.username}'s bookmark of {self.content} in topic {self.topic}"
        self.assertEqual(str(self.bookmark), expected_str)

    def test_create_bookmark_classmethod(self):
        """Test the create_bookmark class method"""
        publication = Publication.objects.create(
            user=self.user,
            text_content='Test Publication',
            status='PUBLISHED'
        )
        bookmark = Bookmark.create_bookmark(
            user=self.user,
            obj=publication,
            topic=self.topic
        )
        self.assertEqual(bookmark.user, self.user)
        self.assertEqual(bookmark.content_type, ContentType.objects.get_for_model(publication))
        self.assertEqual(bookmark.object_id, publication.id)
        self.assertEqual(bookmark.topic, self.topic)

    def test_remove_bookmark_classmethod(self):
        """Test the remove_bookmark class method"""
        result = Bookmark.remove_bookmark(
            user=self.user,
            obj=self.content,
            topic=self.topic
        )
        self.assertTrue(result)
        self.bookmark.refresh_from_db()
        self.assertTrue(self.bookmark.deleted)

    def test_get_user_bookmarks_classmethod(self):
        """Test the get_user_bookmarks class method"""
        # Create another bookmark
        publication = Publication.objects.create(
            user=self.user,
            text_content='Test Publication',
            status='PUBLISHED'
        )
        Bookmark.objects.create(
            user=self.user,
            content_type=ContentType.objects.get_for_model(publication),
            object_id=publication.id
        )

        # Test getting all bookmarks
        bookmarks = Bookmark.get_user_bookmarks(self.user)
        self.assertEqual(bookmarks.count(), 2)

        # Test filtering by model
        content_bookmarks = Bookmark.get_user_bookmarks(self.user, model_class=Content)
        self.assertEqual(content_bookmarks.count(), 1)

        # Test filtering by topic
        topic_bookmarks = Bookmark.get_user_bookmarks(self.user, topic=self.topic)
        self.assertEqual(topic_bookmarks.count(), 1)

class BookmarkAPITests(APITestCase):
    """Test suite for Bookmark API endpoints"""
    
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
        self.topic = Topic.objects.create(
            title='Test Topic',
            description='Test Description',
            creator=self.user
        )
        self.bookmark = Bookmark.objects.create(
            user=self.user,
            content_type=ContentType.objects.get_for_model(self.content),
            object_id=self.content.id,
            topic=self.topic
        )

    def test_list_bookmarks(self):
        """Test retrieving list of bookmarks"""
        url = reverse('bookmark-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    def test_create_bookmark(self):
        """Test creating a new bookmark"""
        url = reverse('bookmark-list')
        data = {
            'content_type': 'content',
            'object_id': self.content.id,
            'topic_id': self.topic.id
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # Should not create duplicate bookmark due to unique constraint
        self.assertEqual(Bookmark.objects.count(), 1)

    def test_get_bookmark_detail(self):
        """Test retrieving bookmark detail"""
        url = reverse('bookmark-detail', args=[self.bookmark.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['content_type_name'], 'content')
        self.assertEqual(response.data['object_id'], self.content.id)

    def test_update_bookmark(self):
        """Test updating a bookmark"""
        url = reverse('bookmark-detail', args=[self.bookmark.id])
        data = {'deleted': True}
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.bookmark.refresh_from_db()
        self.assertTrue(self.bookmark.deleted)

    def test_delete_bookmark(self):
        """Test deleting a bookmark"""
        url = reverse('bookmark-detail', args=[self.bookmark.id])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(Bookmark.objects.count(), 0)

    def test_check_bookmark_status(self):
        """Test checking bookmark status"""
        url = reverse('bookmark-check-status')
        params = {
            'content_type': 'content',
            'object_id': self.content.id,
            'topic_id': self.topic.id
        }
        response = self.client.get(url, params)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_bookmarked'])

    def test_toggle_bookmark(self):
        """Test toggling bookmark status"""
        url = reverse('bookmark-toggle')
        
        # Test removing existing bookmark
        data = {
            'content_type': 'content',
            'object_id': self.content.id,
            'topic_id': self.topic.id
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'removed')
        self.assertFalse(response.data['is_bookmarked'])

        # Test creating new bookmark
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'created')
        self.assertTrue(response.data['is_bookmarked'])


