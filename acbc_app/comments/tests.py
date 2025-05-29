from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType

from comments.models import Comment
from content.models import Content, Topic
from knowledge_paths.models import KnowledgePath
from certificates.models import Certificate


class CommentModelTests(TestCase):
    """Test suite for Comment model"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        self.content = Content.objects.create(
            uploaded_by=self.user,
            media_type='TEXT',
            original_title='Test Content'
        )
        self.content_type = ContentType.objects.get_for_model(Content)
        self.comment = Comment.objects.create(
            author=self.user,
            body='Test Comment',
            content_type=self.content_type,
            object_id=self.content.id
        )

    def test_comment_creation(self):
        """Test comment creation and basic attributes"""
        self.assertEqual(self.comment.body, 'Test Comment')
        self.assertEqual(self.comment.author, self.user)
        self.assertEqual(self.comment.content_type, self.content_type)
        self.assertEqual(self.comment.object_id, self.content.id)
        self.assertIsNotNone(self.comment.created_at)
        self.assertFalse(self.comment.is_edited)
        self.assertTrue(self.comment.is_active)

    def test_comment_str(self):
        """Test string representation of comment"""
        expected_str = f"Comment by {self.user.username} on {self.comment.created_at}"
        self.assertEqual(str(self.comment), expected_str)

    def test_thread_relationships(self):
        """Test comment thread relationships"""
        # Create a reply
        reply = Comment.objects.create(
            author=self.user,
            body='Reply Comment',
            content_type=self.content_type,
            object_id=self.content.id,
            parent=self.comment
        )

        # Test parent-child relationship
        self.assertEqual(reply.parent, self.comment)
        self.assertIn(reply, self.comment.replies.all())

        # Test thread path
        self.assertEqual(reply.thread_path, [self.comment.id])
        self.assertEqual(reply.thread_depth, 1)

    def test_thread_siblings(self):
        """Test getting thread siblings"""
        # Create multiple replies to the same parent
        reply1 = Comment.objects.create(
            author=self.user,
            body='Reply 1',
            content_type=self.content_type,
            object_id=self.content.id,
            parent=self.comment
        )
        reply2 = Comment.objects.create(
            author=self.user,
            body='Reply 2',
            content_type=self.content_type,
            object_id=self.content.id,
            parent=self.comment
        )

        # Test getting siblings
        siblings = reply1.get_thread_siblings()
        self.assertEqual(siblings.count(), 1)
        self.assertEqual(siblings.first(), reply2)


class CommentAPITests(APITestCase):
    """Test suite for Comment API endpoints"""
    
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
        self.topic = Topic.objects.create(
            title='Test Topic',
            description='Test Description',
            creator=self.user
        )
        self.topic.contents.add(self.content)
        self.comment = Comment.objects.create(
            author=self.user,
            body='Test Comment',
            content_type=ContentType.objects.get_for_model(Content),
            object_id=self.content.id,
            topic=self.topic
        )

    def test_create_comment(self):
        """Test creating a new comment on content in a topic"""
        url = reverse('comments:content_topic_comments', args=[self.topic.id, self.content.id])
        data = {'body': 'New Comment'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Comment.objects.count(), 2)
        self.assertEqual(response.data['body'], 'New Comment')

    def test_create_reply(self):
        """Test creating a reply to a comment"""
        url = reverse('comments:comment_replies', args=[self.comment.id])
        data = {'body': 'Reply Comment'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Comment.objects.count(), 2)
        self.assertEqual(response.data['body'], 'Reply Comment')
        self.assertEqual(response.data['parent'], self.comment.id)

    def test_get_comment_detail(self):
        """Test retrieving comment detail"""
        url = reverse('comments:comment-detail', args=[self.comment.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['body'], 'Test Comment')

    def test_update_comment(self):
        """Test updating a comment"""
        url = reverse('comments:comment-detail', args=[self.comment.id])
        data = {'body': 'Updated Comment'}
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.comment.refresh_from_db()
        self.assertEqual(self.comment.body, 'Updated Comment')
        self.assertTrue(self.comment.is_edited)

    def test_delete_comment(self):
        """Test soft deleting a comment"""
        url = reverse('comments:comment-detail', args=[self.comment.id])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.comment.refresh_from_db()
        self.assertFalse(self.comment.is_active)


class KnowledgePathCommentsAPITests(APITestCase):
    """Test suite for KnowledgePath comments API endpoints"""
    
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
        self.comment = Comment.objects.create(
            author=self.user,
            body='Test Comment',
            content_type=ContentType.objects.get_for_model(KnowledgePath),
            object_id=self.knowledge_path.id
        )

    def test_list_knowledge_path_comments(self):
        """Test listing comments for a knowledge path"""
        url = reverse('comments:knowledge_path_comments', args=[self.knowledge_path.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['body'], 'Test Comment')

    def test_create_knowledge_path_comment(self):
        """Test creating a comment on a knowledge path"""
        url = reverse('comments:knowledge_path_comments', args=[self.knowledge_path.id])
        data = {'body': 'New Comment'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Comment.objects.count(), 2)
        self.assertEqual(response.data['body'], 'New Comment')


class TopicCommentsAPITests(APITestCase):
    """Test suite for Topic comments API endpoints"""
    
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
        self.comment = Comment.objects.create(
            author=self.user,
            body='Test Comment',
            content_type=ContentType.objects.get_for_model(Topic),
            object_id=self.topic.id,
            topic=None  # Topic comments should not have a topic association
        )

    def test_list_topic_comments(self):
        """Test listing comments for a topic"""
        url = reverse('comments:topic_comments', args=[self.topic.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['body'], 'Test Comment')

    def test_create_topic_comment(self):
        """Test creating a comment on a topic"""
        url = reverse('comments:topic_comments', args=[self.topic.id])
        data = {'body': 'New Comment'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Comment.objects.count(), 2)
        self.assertEqual(response.data['body'], 'New Comment')


class ContentTopicCommentsAPITests(APITestCase):
    """Test suite for Content-Topic comments API endpoints"""
    
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
        self.content = Content.objects.create(
            uploaded_by=self.user,
            media_type='TEXT',
            original_title='Test Content'
        )
        self.topic.contents.add(self.content)
        self.comment = Comment.objects.create(
            author=self.user,
            body='Test Comment',
            content_type=ContentType.objects.get_for_model(Content),
            object_id=self.content.id,
            topic=self.topic
        )

    def test_list_content_topic_comments(self):
        """Test listing comments for content in a topic"""
        url = reverse('comments:content_topic_comments', args=[self.topic.id, self.content.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['body'], 'Test Comment')

    def test_create_content_topic_comment(self):
        """Test creating a comment on content in a topic"""
        url = reverse('comments:content_topic_comments', args=[self.topic.id, self.content.id])
        data = {'body': 'New Comment'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Comment.objects.count(), 2)
        self.assertEqual(response.data['body'], 'New Comment')
