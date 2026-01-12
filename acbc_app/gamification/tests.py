"""
Comprehensive test suite for the gamification badges system.

Tests cover:
- Badge and UserBadge models
- Badge rules engine (all check_* functions)
- Signal triggers for automatic badge awarding
- API endpoints
- Serializers
"""

from django.test import TestCase, TransactionTestCase
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from rest_framework.test import APIClient, APITestCase
from rest_framework import status

from .models import Badge, UserBadge, BadgeCategory
from . import rules
from profiles.models import Profile, UserNodeCompletion
from comments.models import Comment
from content.models import Content, Topic
from knowledge_paths.models import KnowledgePath, Node
from votes.models import VoteCount, Vote
from quizzes.models import Quiz, UserQuizAttempt


class BadgeModelTests(TestCase):
    """Test suite for Badge model"""

    def setUp(self):
        """Set up test data"""
        self.badge = Badge.objects.create(
            code='test_badge',
            name='Test Badge',
            description='A test badge',
            category=BadgeCategory.LEARNING,
            points_value=10,
            is_active=True
        )

    def test_badge_creation(self):
        """Test badge creation and basic attributes"""
        self.assertEqual(self.badge.code, 'test_badge')
        self.assertEqual(self.badge.name, 'Test Badge')
        self.assertEqual(self.badge.description, 'A test badge')
        self.assertEqual(self.badge.category, BadgeCategory.LEARNING)
        self.assertEqual(self.badge.points_value, 10)
        self.assertTrue(self.badge.is_active)
        self.assertIsNotNone(self.badge.created_at)

    def test_badge_str(self):
        """Test string representation of badge"""
        expected_str = f"{self.badge.name} ({self.badge.code})"
        self.assertEqual(str(self.badge), expected_str)

    def test_badge_unique_code(self):
        """Test that badge codes must be unique"""
        with self.assertRaises(Exception):
            Badge.objects.create(
                code='test_badge',  # Duplicate code
                name='Another Badge',
                description='Another test badge'
            )

    def test_badge_inactive(self):
        """Test creating an inactive badge"""
        inactive_badge = Badge.objects.create(
            code='inactive_badge',
            name='Inactive Badge',
            description='An inactive badge',
            is_active=False
        )
        self.assertFalse(inactive_badge.is_active)


class UserBadgeModelTests(TestCase):
    """Test suite for UserBadge model"""

    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        Profile.objects.create(user=self.user)
        self.badge = Badge.objects.create(
            code='test_badge',
            name='Test Badge',
            description='A test badge',
            points_value=10
        )

    def test_user_badge_creation(self):
        """Test UserBadge creation"""
        user_badge = UserBadge.objects.create(
            user=self.user,
            badge=self.badge,
            points_earned=10
        )
        self.assertEqual(user_badge.user, self.user)
        self.assertEqual(user_badge.badge, self.badge)
        self.assertEqual(user_badge.points_earned, 10)
        self.assertIsNotNone(user_badge.earned_at)

    def test_user_badge_unique_together(self):
        """Test that a user can only have one instance of each badge"""
        UserBadge.objects.create(
            user=self.user,
            badge=self.badge,
            points_earned=10
        )
        # Try to create duplicate
        with self.assertRaises(Exception):
            UserBadge.objects.create(
                user=self.user,
                badge=self.badge,
                points_earned=10
            )

    def test_user_badge_str(self):
        """Test string representation of UserBadge"""
        user_badge = UserBadge.objects.create(
            user=self.user,
            badge=self.badge,
            points_earned=10
        )
        expected_str = f"{self.user.username} - {self.badge.name}"
        self.assertEqual(str(user_badge), expected_str)


class BadgeRulesTests(TestCase):
    """Test suite for badge rules engine"""

    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        Profile.objects.create(user=self.user)
        
        # Create badges
        self.first_comment_badge = Badge.objects.create(
            code='first_comment',
            name='First Voice',
            description='Made your first comment',
            points_value=10
        )
        self.knowledge_seeker_badge = Badge.objects.create(
            code='knowledge_seeker',
            name='Knowledge Seeker',
            description='Completed 20 nodes',
            points_value=35
        )
        self.first_knowledge_path_badge = Badge.objects.create(
            code='first_knowledge_path_completed',
            name='First Explorer',
            description='Completed your first KnowledgePath',
            points_value=50
        )
        self.first_highly_rated_comment_badge = Badge.objects.create(
            code='first_highly_rated_comment',
            name='Valued Contributor',
            description='Got 5+ votes on a comment',
            points_value=30
        )
        self.first_highly_rated_content_badge = Badge.objects.create(
            code='first_highly_rated_content',
            name='Content Curator',
            description='Got 10+ votes on content',
            points_value=40
        )
        self.first_knowledge_path_created_badge = Badge.objects.create(
            code='first_knowledge_path_created',
            name='Path Creator',
            description='Created first KnowledgePath with 2+ nodes',
            points_value=60
        )
        self.quiz_master_badge = Badge.objects.create(
            code='quiz_master',
            name='Quiz Master',
            description='Completed 5 quizzes with perfect score',
            points_value=25
        )
        self.community_voice_badge = Badge.objects.create(
            code='community_voice',
            name='Community Voice',
            description='Received 20+ votes on comments',
            points_value=45
        )
        self.content_creator_badge = Badge.objects.create(
            code='content_creator',
            name='Creator',
            description='Created 3 contents with 5+ votes each',
            points_value=50
        )
        self.topic_curator_badge = Badge.objects.create(
            code='topic_curator',
            name='Topic Curator',
            description='Created a topic with 5+ contents, 2+ with votes',
            points_value=55
        )
        self.topic_architect_badge = Badge.objects.create(
            code='topic_architect',
            name='Topic Architect',
            description='Created a topic with broad community recognition',
            points_value=70
        )

    def test_award_badge_success(self):
        """Test successfully awarding a badge"""
        user_badge = rules.award_badge(self.user, 'first_comment')
        self.assertIsNotNone(user_badge)
        self.assertEqual(user_badge.user, self.user)
        self.assertEqual(user_badge.badge, self.first_comment_badge)
        self.assertEqual(user_badge.points_earned, 10)
        
        # Check profile points updated
        profile = Profile.objects.get(user=self.user)
        self.assertEqual(profile.total_points, 10)

    def test_award_badge_duplicate(self):
        """Test that duplicate badges are not awarded"""
        rules.award_badge(self.user, 'first_comment')
        user_badge = rules.award_badge(self.user, 'first_comment')
        self.assertIsNone(user_badge)
        
        # Check only one badge exists
        self.assertEqual(UserBadge.objects.filter(user=self.user, badge=self.first_comment_badge).count(), 1)

    def test_award_badge_invalid_code(self):
        """Test awarding non-existent badge"""
        user_badge = rules.award_badge(self.user, 'nonexistent_badge')
        self.assertIsNone(user_badge)

    def test_has_badge(self):
        """Test has_badge helper function"""
        self.assertFalse(rules.has_badge(self.user, 'first_comment'))
        rules.award_badge(self.user, 'first_comment')
        self.assertTrue(rules.has_badge(self.user, 'first_comment'))

    def test_check_first_comment(self):
        """Test first comment badge rule"""
        content = Content.objects.create(
            uploaded_by=self.user,
            media_type='TEXT',
            original_title='Test Content'
        )
        content_type = ContentType.objects.get_for_model(Content)
        
        # Create first comment - this will trigger signal, but we test the rule directly
        comment = Comment.objects.create(
            author=self.user,
            body='First comment',
            content_type=content_type,
            object_id=content.id
        )
        
        # Delete badge if signal awarded it
        UserBadge.objects.filter(user=self.user, badge__code='first_comment').delete()
        Profile.objects.filter(user=self.user).update(total_points=0)
        
        # Now test the rule directly
        user_badge = rules.check_first_comment(self.user)
        self.assertIsNotNone(user_badge)
        self.assertEqual(user_badge.badge.code, 'first_comment')

    def test_check_first_comment_already_has_badge(self):
        """Test first comment badge not awarded if user already has it"""
        rules.award_badge(self.user, 'first_comment')
        user_badge = rules.check_first_comment(self.user)
        self.assertIsNone(user_badge)

    def test_check_knowledge_seeker(self):
        """Test knowledge seeker badge rule"""
        knowledge_path = KnowledgePath.objects.create(
            title='Test Path',
            description='Test Description',
            author=self.user
        )
        
        # Create 20 nodes and mark them as completed
        # Use different knowledge paths to avoid order conflicts
        for i in range(20):
            # Create a new knowledge path for each node to avoid order conflicts
            path = KnowledgePath.objects.create(
                title=f'Test Path {i}',
                description='Test Description',
                author=self.user
            )
            node = Node.objects.create(
                knowledge_path=path,
                title=f'Node {i}'  # order will be auto-assigned
            )
            UserNodeCompletion.objects.create(
                user=self.user,
                knowledge_path=path,
                node=node,
                is_completed=True
            )
        
        # Delete badge if signal awarded it
        UserBadge.objects.filter(user=self.user, badge__code='knowledge_seeker').delete()
        Profile.objects.filter(user=self.user).update(total_points=0)
        
        user_badge = rules.check_knowledge_seeker(self.user)
        self.assertIsNotNone(user_badge)
        self.assertEqual(user_badge.badge.code, 'knowledge_seeker')

    def test_check_knowledge_seeker_not_enough_nodes(self):
        """Test knowledge seeker badge not awarded with less than 20 nodes"""
        # Create only 19 nodes using different knowledge paths
        for i in range(19):
            path = KnowledgePath.objects.create(
                title=f'Test Path {i}',
                description='Test Description',
                author=self.user
            )
            node = Node.objects.create(
                knowledge_path=path,
                title=f'Node {i}'  # order will be auto-assigned
            )
            UserNodeCompletion.objects.create(
                user=self.user,
                knowledge_path=path,
                node=node,
                is_completed=True
            )
        
        user_badge = rules.check_knowledge_seeker(self.user)
        self.assertIsNone(user_badge)

    def test_check_first_highly_rated_comment(self):
        """Test first highly rated comment badge rule"""
        content = Content.objects.create(
            uploaded_by=self.user,
            media_type='TEXT',
            original_title='Test Content'
        )
        content_type = ContentType.objects.get_for_model(Content)
        
        comment = Comment.objects.create(
            author=self.user,
            body='Great comment',
            content_type=content_type,
            object_id=content.id
        )
        
        # Create VoteCount with 5+ votes
        comment_content_type = ContentType.objects.get_for_model(Comment)
        vote_count_obj = VoteCount.objects.create(
            content_type=comment_content_type,
            object_id=comment.id,
            vote_count=5
        )
        
        # Delete badge if signal awarded it
        UserBadge.objects.filter(user=self.user, badge__code='first_highly_rated_comment').delete()
        Profile.objects.filter(user=self.user).update(total_points=0)
        
        user_badge = rules.check_first_highly_rated_comment(self.user, comment)
        self.assertIsNotNone(user_badge)
        self.assertEqual(user_badge.badge.code, 'first_highly_rated_comment')

    def test_check_first_highly_rated_content(self):
        """Test first highly rated content badge rule"""
        content = Content.objects.create(
            uploaded_by=self.user,
            media_type='TEXT',
            original_title='Test Content'
        )
        
        # Create VoteCount with 10+ votes
        content_content_type = ContentType.objects.get_for_model(Content)
        vote_count_obj = VoteCount.objects.create(
            content_type=content_content_type,
            object_id=content.id,
            vote_count=10
        )
        
        # Delete badge if signal awarded it
        UserBadge.objects.filter(user=self.user, badge__code='first_highly_rated_content').delete()
        Profile.objects.filter(user=self.user).update(total_points=0)
        
        user_badge = rules.check_first_highly_rated_content(self.user, content)
        self.assertIsNotNone(user_badge)
        self.assertEqual(user_badge.badge.code, 'first_highly_rated_content')

    def test_check_quiz_master(self):
        """Test quiz master badge rule"""
        # Create a knowledge path and node first (required for Quiz)
        knowledge_path = KnowledgePath.objects.create(
            title='Test Path',
            description='Test Description',
            author=self.user
        )
        node = Node.objects.create(
            knowledge_path=knowledge_path,
            title='Test Node',
            order=1
        )
        
        quiz = Quiz.objects.create(
            title='Test Quiz',
            description='Test Description',
            node=node
        )
        
        # Create 5 perfect quiz attempts
        for i in range(5):
            UserQuizAttempt.objects.create(
                user=self.user,
                quiz=quiz,
                score=100
            )
        
        # Delete badge if signal awarded it
        UserBadge.objects.filter(user=self.user, badge__code='quiz_master').delete()
        Profile.objects.filter(user=self.user).update(total_points=0)
        
        user_badge = rules.check_quiz_master(self.user)
        self.assertIsNotNone(user_badge)
        self.assertEqual(user_badge.badge.code, 'quiz_master')

    def test_check_quiz_master_not_enough_perfect(self):
        """Test quiz master badge not awarded with less than 5 perfect scores"""
        # Create a knowledge path and node first (required for Quiz)
        knowledge_path = KnowledgePath.objects.create(
            title='Test Path',
            description='Test Description',
            author=self.user
        )
        node = Node.objects.create(
            knowledge_path=knowledge_path,
            title='Test Node',
            order=1
        )
        
        quiz = Quiz.objects.create(
            title='Test Quiz',
            description='Test Description',
            node=node
        )
        
        # Create only 4 perfect quiz attempts
        for i in range(4):
            UserQuizAttempt.objects.create(
                user=self.user,
                quiz=quiz,
                score=100
            )
        
        user_badge = rules.check_quiz_master(self.user)
        self.assertIsNone(user_badge)

    def test_check_community_voice(self):
        """Test community voice badge rule"""
        content = Content.objects.create(
            uploaded_by=self.user,
            media_type='TEXT',
            original_title='Test Content'
        )
        content_type = ContentType.objects.get_for_model(Content)
        comment_content_type = ContentType.objects.get_for_model(Comment)
        
        # Create comments and accumulate 20+ votes
        for i in range(5):
            comment = Comment.objects.create(
                author=self.user,
                body=f'Comment {i}',
                content_type=content_type,
                object_id=content.id
            )
            votes = 5  # 5 votes each = 25 total
            VoteCount.objects.create(
                content_type=comment_content_type,
                object_id=comment.id,
                vote_count=votes
            )
        
        # Delete badge if signal awarded it
        UserBadge.objects.filter(user=self.user, badge__code='community_voice').delete()
        Profile.objects.filter(user=self.user).update(total_points=0)
        
        user_badge = rules.check_community_voice(self.user)
        self.assertIsNotNone(user_badge)
        self.assertEqual(user_badge.badge.code, 'community_voice')

    def test_check_content_creator(self):
        """Test content creator badge rule"""
        content_content_type = ContentType.objects.get_for_model(Content)
        
        # Create 3 contents with 5+ votes each
        for i in range(3):
            content = Content.objects.create(
                uploaded_by=self.user,
                media_type='TEXT',
                original_title=f'Content {i}'
            )
            VoteCount.objects.create(
                content_type=content_content_type,
                object_id=content.id,
                vote_count=5
            )
        
        # Delete badge if signal awarded it
        UserBadge.objects.filter(user=self.user, badge__code='content_creator').delete()
        Profile.objects.filter(user=self.user).update(total_points=0)
        
        user_badge = rules.check_content_creator(self.user)
        self.assertIsNotNone(user_badge)
        self.assertEqual(user_badge.badge.code, 'content_creator')

    def test_check_first_knowledge_path_completed(self):
        """Test first knowledge path completed badge rule"""
        knowledge_path = KnowledgePath.objects.create(
            title='Test Path',
            description='Test Description',
            author=self.user
        )
        
        # Create and complete all nodes in the path
        for i in range(5):
            node = Node.objects.create(
                knowledge_path=knowledge_path,
                title=f'Node {i}'  # order will be auto-assigned
            )
            UserNodeCompletion.objects.create(
                user=self.user,
                knowledge_path=knowledge_path,
                node=node,
                is_completed=True
            )
        
        # Delete badge if signal awarded it
        UserBadge.objects.filter(user=self.user, badge__code='first_knowledge_path_completed').delete()
        Profile.objects.filter(user=self.user).update(total_points=0)
        
        # Check badge was awarded
        user_badge = rules.check_first_knowledge_path_completed(self.user, knowledge_path)
        self.assertIsNotNone(user_badge)
        self.assertEqual(user_badge.badge.code, 'first_knowledge_path_completed')

    def test_check_first_knowledge_path_created(self):
        """Test first knowledge path created badge rule"""
        knowledge_path = KnowledgePath.objects.create(
            title='Test Path',
            description='Test Description',
            author=self.user
        )
        
        # Create first node - should not trigger yet
        Node.objects.create(
            knowledge_path=knowledge_path,
            title='Node 1'  # order will be auto-assigned automatically
        )
        
        # Delete badge if signal awarded it
        UserBadge.objects.filter(user=self.user, badge__code='first_knowledge_path_created').delete()
        Profile.objects.filter(user=self.user).update(total_points=0)
        
        # Create second node - should trigger badge via signal, but we test rule directly
        Node.objects.create(
            knowledge_path=knowledge_path,
            title='Node 2'  # order will be auto-assigned
        )
        
        # Delete badge if signal awarded it
        UserBadge.objects.filter(user=self.user, badge__code='first_knowledge_path_created').delete()
        Profile.objects.filter(user=self.user).update(total_points=0)
        
        # Test the rule directly
        user_badge = rules.check_first_knowledge_path_created(self.user, knowledge_path)
        self.assertIsNotNone(user_badge)
        self.assertEqual(user_badge.badge.code, 'first_knowledge_path_created')

    def test_award_badge_updates_profile_points(self):
        """Test that awarding badge updates profile total_points"""
        initial_points = Profile.objects.get(user=self.user).total_points
        
        rules.award_badge(self.user, 'first_comment')
        
        profile = Profile.objects.get(user=self.user)
        self.assertEqual(profile.total_points, initial_points + 10)

    def test_award_badge_with_context_data(self):
        """Test awarding badge with context data"""
        context_data = {'comment_id': 123, 'vote_count': 5}
        user_badge = rules.award_badge(self.user, 'first_comment', context_data=context_data)
        
        self.assertIsNotNone(user_badge)
        self.assertEqual(user_badge.context_data, context_data)

    def test_check_first_highly_rated_comment_insufficient_votes(self):
        """Test highly rated comment badge not awarded with less than 5 votes"""
        content = Content.objects.create(
            uploaded_by=self.user,
            media_type='TEXT',
            original_title='Test Content'
        )
        content_type = ContentType.objects.get_for_model(Content)
        
        comment = Comment.objects.create(
            author=self.user,
            body='Comment',
            content_type=content_type,
            object_id=content.id
        )
        
        # Create VoteCount with less than 5 votes
        comment_content_type = ContentType.objects.get_for_model(Comment)
        VoteCount.objects.create(
            content_type=comment_content_type,
            object_id=comment.id,
            vote_count=4  # Less than 5
        )
        
        user_badge = rules.check_first_highly_rated_comment(self.user, comment)
        self.assertIsNone(user_badge)

    def test_check_first_highly_rated_content_insufficient_votes(self):
        """Test highly rated content badge not awarded with less than 10 votes"""
        content = Content.objects.create(
            uploaded_by=self.user,
            media_type='TEXT',
            original_title='Test Content'
        )
        
        # Create VoteCount with less than 10 votes
        content_content_type = ContentType.objects.get_for_model(Content)
        VoteCount.objects.create(
            content_type=content_content_type,
            object_id=content.id,
            vote_count=9  # Less than 10
        )
        
        user_badge = rules.check_first_highly_rated_content(self.user, content)
        self.assertIsNone(user_badge)

    def test_check_content_creator_insufficient_contents(self):
        """Test content creator badge not awarded with less than 3 highly rated contents"""
        content_content_type = ContentType.objects.get_for_model(Content)
        
        # Create only 2 contents with 5+ votes
        for i in range(2):
            content = Content.objects.create(
                uploaded_by=self.user,
                media_type='TEXT',
                original_title=f'Content {i}'
            )
            VoteCount.objects.create(
                content_type=content_content_type,
                object_id=content.id,
                vote_count=5
            )
        
        user_badge = rules.check_content_creator(self.user)
        self.assertIsNone(user_badge)

    def test_check_first_knowledge_path_created_insufficient_nodes(self):
        """Test path creator badge not awarded with less than 2 nodes"""
        knowledge_path = KnowledgePath.objects.create(
            title='Test Path',
            description='Test Description',
            author=self.user
        )
        
        # Create only 1 node
        Node.objects.create(
            knowledge_path=knowledge_path,
            title='Node 1',
            order=1
        )
        
        user_badge = rules.check_first_knowledge_path_created(self.user, knowledge_path)
        self.assertIsNone(user_badge)

    def test_check_topic_curator(self):
        """Test topic curator badge rule"""
        # Create topic
        topic = Topic.objects.create(
            title='Test Topic',
            description='Test Description',
            creator=self.user
        )
        
        # Create 5+ contents in the topic
        content_content_type = ContentType.objects.get_for_model(Content)
        for i in range(5):
            content = Content.objects.create(
                uploaded_by=self.user,
                media_type='TEXT',
                original_title=f'Content {i}'
            )
            topic.contents.add(content)
            
            # Add votes to at least 2 contents
            if i < 2:
                VoteCount.objects.create(
                    content_type=content_content_type,
                    object_id=content.id,
                    topic=topic,
                    vote_count=1
                )
        
        # Delete badge if signal awarded it
        UserBadge.objects.filter(user=self.user, badge__code='topic_curator').delete()
        Profile.objects.filter(user=self.user).update(total_points=0)
        
        user_badge = rules.check_topic_curator(self.user, topic)
        self.assertIsNotNone(user_badge)
        self.assertEqual(user_badge.badge.code, 'topic_curator')

    def test_check_topic_curator_insufficient_contents(self):
        """Test topic curator badge not awarded with less than 5 contents"""
        topic = Topic.objects.create(
            title='Test Topic',
            description='Test Description',
            creator=self.user
        )
        
        # Create only 4 contents
        content_content_type = ContentType.objects.get_for_model(Content)
        for i in range(4):
            content = Content.objects.create(
                uploaded_by=self.user,
                media_type='TEXT',
                original_title=f'Content {i}'
            )
            topic.contents.add(content)
            if i < 2:
                VoteCount.objects.create(
                    content_type=content_content_type,
                    object_id=content.id,
                    topic=topic,
                    vote_count=1
                )
        
        user_badge = rules.check_topic_curator(self.user, topic)
        self.assertIsNone(user_badge)

    def test_check_topic_curator_insufficient_votes(self):
        """Test topic curator badge not awarded with less than 2 contents with votes"""
        topic = Topic.objects.create(
            title='Test Topic',
            description='Test Description',
            creator=self.user
        )
        
        # Create 5+ contents but only 1 with votes
        content_content_type = ContentType.objects.get_for_model(Content)
        for i in range(5):
            content = Content.objects.create(
                uploaded_by=self.user,
                media_type='TEXT',
                original_title=f'Content {i}'
            )
            topic.contents.add(content)
            if i == 0:  # Only first content has votes
                VoteCount.objects.create(
                    content_type=content_content_type,
                    object_id=content.id,
                    topic=topic,
                    vote_count=1
                )
        
        user_badge = rules.check_topic_curator(self.user, topic)
        self.assertIsNone(user_badge)

    def test_check_topic_curator_not_creator(self):
        """Test topic curator badge not awarded if user is not the creator"""
        other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123'
        )
        Profile.objects.create(user=other_user)
        
        topic = Topic.objects.create(
            title='Test Topic',
            description='Test Description',
            creator=other_user  # Different creator
        )
        
        # Create 5+ contents with votes
        content_content_type = ContentType.objects.get_for_model(Content)
        for i in range(5):
            content = Content.objects.create(
                uploaded_by=self.user,
                media_type='TEXT',
                original_title=f'Content {i}'
            )
            topic.contents.add(content)
            if i < 2:
                VoteCount.objects.create(
                    content_type=content_content_type,
                    object_id=content.id,
                    topic=topic,
                    vote_count=1
                )
        
        user_badge = rules.check_topic_curator(self.user, topic)
        self.assertIsNone(user_badge)

    def test_check_topic_architect(self):
        """Test topic architect badge rule"""
        # Create topic
        topic = Topic.objects.create(
            title='Test Topic',
            description='Test Description',
            creator=self.user
        )
        
        # Create 10+ contents with votes
        content_content_type = ContentType.objects.get_for_model(Content)
        content_ids = []
        for i in range(10):
            content = Content.objects.create(
                uploaded_by=self.user,
                media_type='TEXT',
                original_title=f'Content {i}'
            )
            topic.contents.add(content)
            content_ids.append(content.id)
            
            # Add votes (at least 5 votes per content to reach 50+ total)
            VoteCount.objects.create(
                content_type=content_content_type,
                object_id=content.id,
                topic=topic,
                vote_count=5
            )
        
        # Create votes from 5+ distinct users
        for i in range(5):
            voter = User.objects.create_user(
                username=f'voter{i}',
                email=f'voter{i}@example.com',
                password='testpass123'
            )
            # Vote on different contents
            Vote.objects.create(
                user=voter,
                content_type=content_content_type,
                object_id=content_ids[i],
                topic=topic,
                value=1
            )
        
        # Delete badge if signal awarded it
        UserBadge.objects.filter(user=self.user, badge__code='topic_architect').delete()
        Profile.objects.filter(user=self.user).update(total_points=0)
        
        user_badge = rules.check_topic_architect(self.user, topic)
        self.assertIsNotNone(user_badge)
        self.assertEqual(user_badge.badge.code, 'topic_architect')

    def test_check_topic_architect_insufficient_contents_with_votes(self):
        """Test topic architect badge not awarded with less than 10 contents with votes"""
        topic = Topic.objects.create(
            title='Test Topic',
            description='Test Description',
            creator=self.user
        )
        
        # Create only 9 contents with votes
        content_content_type = ContentType.objects.get_for_model(Content)
        for i in range(9):
            content = Content.objects.create(
                uploaded_by=self.user,
                media_type='TEXT',
                original_title=f'Content {i}'
            )
            topic.contents.add(content)
            VoteCount.objects.create(
                content_type=content_content_type,
                object_id=content.id,
                topic=topic,
                vote_count=10  # High vote count but not enough contents
            )
        
        user_badge = rules.check_topic_architect(self.user, topic)
        self.assertIsNone(user_badge)

    def test_check_topic_architect_insufficient_total_votes(self):
        """Test topic architect badge not awarded with less than 50 total votes"""
        topic = Topic.objects.create(
            title='Test Topic',
            description='Test Description',
            creator=self.user
        )
        
        # Create 10+ contents but with low vote counts
        content_content_type = ContentType.objects.get_for_model(Content)
        for i in range(10):
            content = Content.objects.create(
                uploaded_by=self.user,
                media_type='TEXT',
                original_title=f'Content {i}'
            )
            topic.contents.add(content)
            VoteCount.objects.create(
                content_type=content_content_type,
                object_id=content.id,
                topic=topic,
                vote_count=4  # 4 * 10 = 40, less than 50
            )
        
        user_badge = rules.check_topic_architect(self.user, topic)
        self.assertIsNone(user_badge)

    def test_check_topic_architect_insufficient_distinct_voters(self):
        """Test topic architect badge not awarded with less than 5 distinct voters"""
        topic = Topic.objects.create(
            title='Test Topic',
            description='Test Description',
            creator=self.user
        )
        
        # Create 10+ contents with votes
        content_content_type = ContentType.objects.get_for_model(Content)
        content_ids = []
        for i in range(10):
            content = Content.objects.create(
                uploaded_by=self.user,
                media_type='TEXT',
                original_title=f'Content {i}'
            )
            topic.contents.add(content)
            content_ids.append(content.id)
            VoteCount.objects.create(
                content_type=content_content_type,
                object_id=content.id,
                topic=topic,
                vote_count=5
            )
        
        # Create votes from only 4 distinct users
        for i in range(4):
            voter = User.objects.create_user(
                username=f'voter{i}',
                email=f'voter{i}@example.com',
                password='testpass123'
            )
            Vote.objects.create(
                user=voter,
                content_type=content_content_type,
                object_id=content_ids[i],
                topic=topic,
                value=1
            )
        
        user_badge = rules.check_topic_architect(self.user, topic)
        self.assertIsNone(user_badge)

    def test_check_topic_architect_not_creator(self):
        """Test topic architect badge not awarded if user is not the creator"""
        other_user = User.objects.create_user(
            username='otheruser',
            email='other@example.com',
            password='testpass123'
        )
        Profile.objects.create(user=other_user)
        
        topic = Topic.objects.create(
            title='Test Topic',
            description='Test Description',
            creator=other_user  # Different creator
        )
        
        # Create all conditions met but user is not creator
        content_content_type = ContentType.objects.get_for_model(Content)
        content_ids = []
        for i in range(10):
            content = Content.objects.create(
                uploaded_by=self.user,
                media_type='TEXT',
                original_title=f'Content {i}'
            )
            topic.contents.add(content)
            content_ids.append(content.id)
            VoteCount.objects.create(
                content_type=content_content_type,
                object_id=content.id,
                topic=topic,
                vote_count=5
            )
        
        for i in range(5):
            voter = User.objects.create_user(
                username=f'voter{i}',
                email=f'voter{i}@example.com',
                password='testpass123'
            )
            Vote.objects.create(
                user=voter,
                content_type=content_content_type,
                object_id=content_ids[i],
                topic=topic,
                value=1
            )
        
        user_badge = rules.check_topic_architect(self.user, topic)
        self.assertIsNone(user_badge)


class BadgeSignalsTests(TransactionTestCase):
    """Test suite for badge signal triggers"""
    
    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        Profile.objects.create(user=self.user)
        
        # Create badges
        Badge.objects.create(
            code='first_comment',
            name='First Voice',
            description='Made your first comment',
            points_value=10
        )
        Badge.objects.create(
            code='knowledge_seeker',
            name='Knowledge Seeker',
            description='Completed 20 nodes',
            points_value=35
        )
        Badge.objects.create(
            code='first_knowledge_path_completed',
            name='First Explorer',
            description='Completed your first KnowledgePath',
            points_value=50
        )
        Badge.objects.create(
            code='first_highly_rated_comment',
            name='Valued Contributor',
            description='Got 5+ votes on a comment',
            points_value=30
        )
        Badge.objects.create(
            code='first_highly_rated_content',
            name='Content Curator',
            description='Got 10+ votes on content',
            points_value=40
        )
        Badge.objects.create(
            code='first_knowledge_path_created',
            name='Path Creator',
            description='Created first KnowledgePath with 2+ nodes',
            points_value=60
        )
        Badge.objects.create(
            code='quiz_master',
            name='Quiz Master',
            description='Completed 5 quizzes with perfect score',
            points_value=25
        )
        Badge.objects.create(
            code='community_voice',
            name='Community Voice',
            description='Received 20+ votes on comments',
            points_value=45
        )
        Badge.objects.create(
            code='content_creator',
            name='Creator',
            description='Created 3 contents with 5+ votes each',
            points_value=50
        )

    def test_comment_creation_triggers_first_comment_badge(self):
        """Test that creating a comment triggers first comment badge"""
        content = Content.objects.create(
            uploaded_by=self.user,
            media_type='TEXT',
            original_title='Test Content'
        )
        content_type = ContentType.objects.get_for_model(Content)
        
        # Create comment - should trigger signal
        Comment.objects.create(
            author=self.user,
            body='First comment',
            content_type=content_type,
            object_id=content.id
        )
        
        # Check badge was awarded
        self.assertTrue(rules.has_badge(self.user, 'first_comment'))
        user_badge = UserBadge.objects.get(user=self.user, badge__code='first_comment')
        self.assertIsNotNone(user_badge)

    def test_node_completion_triggers_knowledge_seeker_badge(self):
        """Test that completing nodes triggers knowledge seeker badge"""
        # Create and complete 20 nodes using different knowledge paths to avoid order conflicts
        for i in range(20):
            path = KnowledgePath.objects.create(
                title=f'Test Path {i}',
                description='Test Description',
                author=self.user
            )
            node = Node.objects.create(
                knowledge_path=path,
                title=f'Node {i}'  # order will be auto-assigned
            )
            UserNodeCompletion.objects.create(
                user=self.user,
                knowledge_path=path,
                node=node,
                is_completed=True
            )
        
        # Check badge was awarded
        self.assertTrue(rules.has_badge(self.user, 'knowledge_seeker'))

    def test_vote_count_update_triggers_highly_rated_comment_badge(self):
        """Test that updating vote count triggers highly rated comment badge"""
        content = Content.objects.create(
            uploaded_by=self.user,
            media_type='TEXT',
            original_title='Test Content'
        )
        content_type = ContentType.objects.get_for_model(Content)
        
        comment = Comment.objects.create(
            author=self.user,
            body='Great comment',
            content_type=content_type,
            object_id=content.id
        )
        
        # Create VoteCount with 5+ votes - should trigger badge
        comment_content_type = ContentType.objects.get_for_model(Comment)
        VoteCount.objects.create(
            content_type=comment_content_type,
            object_id=comment.id,
            vote_count=5
        )
        
        # Check badge was awarded
        self.assertTrue(rules.has_badge(self.user, 'first_highly_rated_comment'))

    def test_vote_count_update_triggers_highly_rated_content_badge(self):
        """Test that updating vote count triggers highly rated content badge"""
        content = Content.objects.create(
            uploaded_by=self.user,
            media_type='TEXT',
            original_title='Test Content'
        )
        
        # Create VoteCount with 10+ votes - should trigger badge
        content_content_type = ContentType.objects.get_for_model(Content)
        VoteCount.objects.create(
            content_type=content_content_type,
            object_id=content.id,
            vote_count=10
        )
        
        # Check badge was awarded
        self.assertTrue(rules.has_badge(self.user, 'first_highly_rated_content'))

    def test_quiz_attempt_triggers_quiz_master_badge(self):
        """Test that perfect quiz attempts trigger quiz master badge"""
        # Create a knowledge path and node first (required for Quiz)
        knowledge_path = KnowledgePath.objects.create(
            title='Test Path',
            description='Test Description',
            author=self.user
        )
        node = Node.objects.create(
            knowledge_path=knowledge_path,
            title='Test Node',
            order=1
        )
        
        quiz = Quiz.objects.create(
            title='Test Quiz',
            description='Test Description',
            node=node
        )
        
        # Create 5 perfect quiz attempts - should trigger badge
        for i in range(5):
            UserQuizAttempt.objects.create(
                user=self.user,
                quiz=quiz,
                score=100
            )
        
        # Check badge was awarded
        self.assertTrue(rules.has_badge(self.user, 'quiz_master'))

    def test_node_creation_triggers_path_creator_badge(self):
        """Test that creating nodes triggers path creator badge"""
        knowledge_path = KnowledgePath.objects.create(
            title='Test Path',
            description='Test Description',
            author=self.user
        )
        
        # Create 2 nodes - should trigger badge
        Node.objects.create(
            knowledge_path=knowledge_path,
            title='Node 1',
            order=1
        )
        Node.objects.create(
            knowledge_path=knowledge_path,
            title='Node 2',
            order=2
        )
        
        # Check badge was awarded
        self.assertTrue(rules.has_badge(self.user, 'first_knowledge_path_created'))

    def test_comment_signal_not_triggered_on_update(self):
        """Test that comment signal is not triggered on update (only create)"""
        content = Content.objects.create(
            uploaded_by=self.user,
            media_type='TEXT',
            original_title='Test Content'
        )
        content_type = ContentType.objects.get_for_model(Content)
        
        comment = Comment.objects.create(
            author=self.user,
            body='First comment',
            content_type=content_type,
            object_id=content.id
        )
        
        # Badge should be awarded on creation
        self.assertTrue(rules.has_badge(self.user, 'first_comment'))
        
        # Clear badge for testing
        UserBadge.objects.filter(user=self.user, badge__code='first_comment').delete()
        Profile.objects.filter(user=self.user).update(total_points=0)
        
        # Update comment - should NOT trigger badge
        comment.body = 'Updated comment'
        comment.save()
        
        # Badge should not be awarded on update
        self.assertFalse(rules.has_badge(self.user, 'first_comment'))

    def test_node_completion_signal_not_triggered_if_not_completed(self):
        """Test that node completion signal is not triggered if is_completed=False"""
        knowledge_path = KnowledgePath.objects.create(
            title='Test Path',
            description='Test Description',
            author=self.user
        )
        
        node = Node.objects.create(
            knowledge_path=knowledge_path,
            title='Node 1',
            order=1
        )
        
        # Create completion with is_completed=False
        UserNodeCompletion.objects.create(
            user=self.user,
            knowledge_path=knowledge_path,
            node=node,
            is_completed=False
        )
        
        # Badge should not be awarded
        self.assertFalse(rules.has_badge(self.user, 'knowledge_seeker'))

    def test_quiz_signal_not_triggered_on_non_perfect_score(self):
        """Test that quiz signal is not triggered on non-perfect scores"""
        # Create a knowledge path and node first (required for Quiz)
        knowledge_path = KnowledgePath.objects.create(
            title='Test Path',
            description='Test Description',
            author=self.user
        )
        node = Node.objects.create(
            knowledge_path=knowledge_path,
            title='Test Node',
            order=1
        )
        
        quiz = Quiz.objects.create(
            title='Test Quiz',
            description='Test Description',
            node=node
        )
        
        # Create quiz attempt with score < 100
        UserQuizAttempt.objects.create(
            user=self.user,
            quiz=quiz,
            score=90
        )
        
        # Badge should not be awarded
        self.assertFalse(rules.has_badge(self.user, 'quiz_master'))


class BadgeAPITests(APITestCase):
    """Test suite for badge API endpoints"""

    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        Profile.objects.create(user=self.user)
        self.admin_user = User.objects.create_user(
            username='admin',
            email='admin@example.com',
            password='adminpass123',
            is_staff=True,
            is_superuser=True
        )
        
        self.badge = Badge.objects.create(
            code='test_badge',
            name='Test Badge',
            description='A test badge',
            points_value=10
        )

    def test_list_badges(self):
        """Test listing all badges"""
        response = self.client.get('/api/gamification/badges/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(len(response.data), 0)

    def test_retrieve_badge(self):
        """Test retrieving a specific badge"""
        response = self.client.get(f'/api/gamification/badges/{self.badge.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['code'], 'test_badge')

    def test_list_user_badges_authenticated(self):
        """Test listing user badges when authenticated"""
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/gamification/user-badges/my_badges/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('badges', response.data)
        self.assertIn('total_points', response.data)

    def test_list_user_badges_unauthenticated(self):
        """Test that listing badges requires authentication"""
        response = self.client.get('/api/gamification/user-badges/my_badges/')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_grant_badge_admin(self):
        """Test granting badge as admin"""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post(
            f'/api/gamification/badges/{self.badge.id}/grant/',
            {'user_id': self.user.id},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(rules.has_badge(self.user, 'test_badge'))

    def test_grant_badge_non_admin(self):
        """Test that non-admin cannot grant badges"""
        self.client.force_authenticate(user=self.user)
        response = self.client.post(
            f'/api/gamification/badges/{self.badge.id}/grant/',
            {'user_id': self.user.id},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_grant_badge_duplicate(self):
        """Test granting duplicate badge returns error"""
        self.client.force_authenticate(user=self.admin_user)
        # Grant badge first time
        self.client.post(
            f'/api/gamification/badges/{self.badge.id}/grant/',
            {'user_id': self.user.id},
            format='json'
        )
        # Try to grant again
        response = self.client.post(
            f'/api/gamification/badges/{self.badge.id}/grant/',
            {'user_id': self.user.id},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_get_user_points(self):
        """Test getting user points"""
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/gamification/points/my_points/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('total_points', response.data)
        self.assertEqual(response.data['user_id'], self.user.id)


class BadgeSerializerTests(TestCase):
    """Test suite for badge serializers"""

    def setUp(self):
        """Set up test data"""
        self.user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )
        Profile.objects.create(user=self.user)
        self.badge = Badge.objects.create(
            code='test_badge',
            name='Test Badge',
            description='A test badge',
            category=BadgeCategory.LEARNING,
            points_value=10
        )

    def test_badge_serializer(self):
        """Test BadgeSerializer"""
        from .serializers import BadgeSerializer
        serializer = BadgeSerializer(self.badge)
        data = serializer.data
        self.assertEqual(data['code'], 'test_badge')
        self.assertEqual(data['name'], 'Test Badge')
        self.assertEqual(data['description'], 'A test badge')
        self.assertEqual(data['category'], BadgeCategory.LEARNING)

    def test_user_badge_summary_serializer(self):
        """Test UserBadgeSummarySerializer"""
        from .serializers import UserBadgeSummarySerializer
        user_badge = UserBadge.objects.create(
            user=self.user,
            badge=self.badge,
            points_earned=10
        )
        serializer = UserBadgeSummarySerializer(user_badge)
        data = serializer.data
        self.assertEqual(data['badge_code'], 'test_badge')
        self.assertEqual(data['badge_name'], 'Test Badge')
        self.assertEqual(data['points_earned'], 10)
