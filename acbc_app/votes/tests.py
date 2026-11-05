from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType

from votes.models import Vote, VoteCount
from content.models import Content, ContentEmbedding, Topic, TopicChatPin, TopicChatQuery
from notifications.models import Notification
from knowledge_paths.models import KnowledgePath
from comments.models import Comment


class VoteModelTests(TestCase):
    """Test suite for Vote model"""
    
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
        self.vote = Vote.objects.create(
            user=self.user,
            value=1,
            content_type=self.content_type,
            object_id=self.content.id
        )

    def test_vote_creation(self):
        """Test vote creation and basic attributes"""
        self.assertEqual(self.vote.value, 1)
        self.assertEqual(self.vote.user, self.user)
        self.assertEqual(self.vote.content_type, self.content_type)
        self.assertEqual(self.vote.object_id, self.content.id)
        self.assertIsNotNone(self.vote.created_at)

    def test_vote_str(self):
        """Test string representation of vote"""
        self.assertEqual(str(self.vote), f"Vote by {self.user.username} for content")

    def test_upvote_method(self):
        """Test upvote method functionality"""
        # Test changing from no vote to upvote
        self.vote.value = 0
        self.vote.save()
        result = self.vote.upvote()
        self.assertEqual(self.vote.value, 1)
        self.assertEqual(result, 1)  # New upvote

        # Test removing upvote
        result = self.vote.upvote()
        self.assertEqual(self.vote.value, 0)
        self.assertEqual(result, -1)  # Vote removed

        # Test changing from downvote to upvote
        self.vote.value = -1
        self.vote.save()
        result = self.vote.upvote()
        self.assertEqual(self.vote.value, 1)
        self.assertEqual(result, 2)  # Changed from downvote to upvote

    def test_downvote_method(self):
        """Test downvote method functionality"""
        # Test changing from no vote to downvote
        self.vote.value = 0
        self.vote.save()
        result = self.vote.downvote()
        self.assertEqual(self.vote.value, -1)
        self.assertEqual(result, -1)  # New downvote

        # Test removing downvote
        result = self.vote.downvote()
        self.assertEqual(self.vote.value, 0)
        self.assertEqual(result, 1)  # Vote removed

        # Test changing from upvote to downvote
        self.vote.value = 1
        self.vote.save()
        result = self.vote.downvote()
        self.assertEqual(self.vote.value, -1)
        self.assertEqual(result, -2)  # Changed from upvote to downvote


class VoteCountModelTests(TestCase):
    """Test suite for VoteCount model"""
    
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
        self.vote_count = VoteCount.objects.create(
            content_type=self.content_type,
            object_id=self.content.id,
            vote_count=0
        )

    def test_vote_count_creation(self):
        """Test vote count creation and basic attributes"""
        self.assertEqual(self.vote_count.vote_count, 0)
        self.assertEqual(self.vote_count.content_type, self.content_type)
        self.assertEqual(self.vote_count.object_id, self.content.id)

    def test_vote_count_str(self):
        """Test string representation of vote count"""
        expected_str = f"0 votes for {self.content} in all topics"
        self.assertEqual(str(self.vote_count), expected_str)

    def test_update_vote_count(self):
        """Test vote count update functionality"""
        # Create some votes
        Vote.objects.create(
            user=self.user,
            value=1,
            content_type=self.content_type,
            object_id=self.content.id
        )
        
        # Update vote count
        self.vote_count.update_vote_count()
        self.assertEqual(self.vote_count.vote_count, 1)


class KnowledgePathVoteAPITests(APITestCase):
    """Test suite for KnowledgePath voting API endpoints"""
    
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

    def test_get_vote_status(self):
        """Test retrieving vote status"""
        url = reverse('votes:knowledge-path-vote', args=[self.knowledge_path.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('vote_count', response.data)
        self.assertIn('user_vote', response.data)

    def test_upvote(self):
        """Test upvoting a knowledge path"""
        url = reverse('votes:knowledge-path-vote', args=[self.knowledge_path.id])
        data = {'action': 'upvote'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user_vote'], 1)
        self.assertEqual(response.data['vote_count'], 1)

    def test_downvote(self):
        """Test downvoting a knowledge path"""
        url = reverse('votes:knowledge-path-vote', args=[self.knowledge_path.id])
        data = {'action': 'downvote'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user_vote'], -1)
        self.assertEqual(response.data['vote_count'], -1)

    def test_invalid_action(self):
        """Test invalid voting action"""
        url = reverse('votes:knowledge-path-vote', args=[self.knowledge_path.id])
        data = {'action': 'invalid'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class ContentVoteAPITests(APITestCase):
    """Test suite for Content voting API endpoints"""
    
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

    def test_get_vote_status(self):
        """Test retrieving vote status"""
        url = reverse('votes:content-vote', args=[self.topic.id, self.content.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('vote_count', response.data)
        self.assertIn('user_vote', response.data)

    def test_upvote(self):
        """Test upvoting content"""
        url = reverse('votes:content-vote', args=[self.topic.id, self.content.id])
        data = {'action': 'upvote'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user_vote'], 1)
        self.assertEqual(response.data['vote_count'], 1)

    def test_downvote(self):
        """Test downvoting content"""
        url = reverse('votes:content-vote', args=[self.topic.id, self.content.id])
        data = {'action': 'downvote'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user_vote'], -1)
        self.assertEqual(response.data['vote_count'], -1)


class CommentVoteAPITests(APITestCase):
    """Test suite for Comment voting API endpoints"""
    
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
        self.comment = Comment.objects.create(
            author=self.user,
            body='Test Comment',
            content_type=ContentType.objects.get_for_model(Content),
            object_id=self.content.id
        )

    def test_get_vote_status(self):
        """Test retrieving vote status"""
        url = reverse('votes:comment-vote', args=[self.comment.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('vote_count', response.data)
        self.assertIn('user_vote', response.data)

    def test_upvote(self):
        """Test upvoting a comment"""
        url = reverse('votes:comment-vote', args=[self.comment.id])
        data = {'action': 'upvote'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user_vote'], 1)
        self.assertEqual(response.data['vote_count'], 1)

    def test_downvote(self):
        """Test downvoting a comment"""
        url = reverse('votes:comment-vote', args=[self.comment.id])
        data = {'action': 'downvote'}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['user_vote'], -1)
        self.assertEqual(response.data['vote_count'], -1)


class TopicConsultationVoteAPITests(APITestCase):
    def setUp(self):
        self.author = User.objects.create_user(
            username='voteauthor',
            email='voteauthor@example.com',
            password='testpass123',
        )
        self.voter = User.objects.create_user(
            username='voter',
            email='voter@example.com',
            password='testpass123',
        )
        self.topic = Topic.objects.create(
            title='Tema votable',
            creator=self.author,
            is_public=True,
            chat_enabled=True,
        )
        self.content = Content.objects.create(
            uploaded_by=self.author,
            media_type='TEXT',
            original_title='Texto',
        )
        self.topic.contents.add(self.content)
        ContentEmbedding.objects.create(
            content=self.content,
            status=ContentEmbedding.STATUS_INDEXED,
            model='text-embedding-3-large',
            dims=8,
            chunk_count=1,
        )
        self.query = TopicChatQuery.objects.create(
            topic=self.topic,
            user=self.author,
            question='¿Cuál es la idea?',
            answer='La idea principal.',
            selected_content_ids=[self.content.id],
        )
        self.url = reverse(
            'votes:topic-consultation-vote',
            args=[self.topic.id, self.query.id],
        )

    def test_vote_rejected_until_pinned(self):
        self.client.force_authenticate(user=self.voter)
        response = self.client.post(self.url, {'action': 'upvote'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertFalse(Vote.objects.filter(object_id=self.query.id).exists())

    def test_toggle_and_score_survives_unpin(self):
        TopicChatPin.objects.create(
            query=self.query,
            content=self.content,
            pinned_by=self.author,
        )
        self.client.force_authenticate(user=self.voter)
        up = self.client.post(self.url, {'action': 'upvote'}, format='json')
        self.assertEqual(up.status_code, status.HTTP_200_OK)
        self.assertEqual(up.data['vote_count'], 1)
        self.assertEqual(up.data['user_vote'], 1)

        again = self.client.post(self.url, {'action': 'upvote'}, format='json')
        self.assertEqual(again.data['vote_count'], 0)
        self.assertEqual(again.data['user_vote'], 0)

        down = self.client.post(self.url, {'action': 'downvote'}, format='json')
        self.assertEqual(down.data['vote_count'], -1)
        self.assertEqual(down.data['user_vote'], -1)

        flipped = self.client.post(self.url, {'action': 'upvote'}, format='json')
        self.assertEqual(flipped.data['vote_count'], 1)
        self.assertEqual(flipped.data['user_vote'], 1)

        self.query.pins.all().delete()
        hidden = self.client.post(self.url, {'action': 'upvote'}, format='json')
        self.assertEqual(hidden.status_code, status.HTTP_404_NOT_FOUND)

        TopicChatPin.objects.create(
            query=self.query,
            content=self.content,
            pinned_by=self.author,
        )
        restored = self.client.get(self.url)
        self.assertEqual(restored.status_code, status.HTTP_200_OK)
        self.assertEqual(restored.data['vote_count'], 1)
        self.assertEqual(restored.data['user_vote'], 1)

    def test_upvote_notifies_author_and_skips_self_vote(self):
        TopicChatPin.objects.create(
            query=self.query,
            content=self.content,
            pinned_by=self.author,
        )
        self.client.force_authenticate(user=self.author)
        self.client.post(self.url, {'action': 'upvote'}, format='json')
        self.assertFalse(
            Notification.objects.filter(recipient=self.author, verb__icontains='consulta').exists()
        )

        self.client.force_authenticate(user=self.voter)
        response = self.client.post(self.url, {'action': 'upvote'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        note = Notification.objects.get(recipient=self.author)
        self.assertIn('consulta', note.verb)
        self.assertEqual(int(note.target_object_id), self.query.id)
