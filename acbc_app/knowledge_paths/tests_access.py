from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from knowledge_paths.models import KnowledgePath, KnowledgePathPurchase, Node
from knowledge_paths.services.access_service import user_has_path_access
from knowledge_paths.services.node_user_activity_service import is_node_available_for_user
from tests.factories.users import UserFactory


class KnowledgePathAccessServiceTests(TestCase):
    def setUp(self):
        self.author = UserFactory()
        self.buyer = UserFactory()
        self.other = UserFactory()
        self.free_path = KnowledgePath.objects.create(
            title='Free',
            author=self.author,
            reference_price=0,
            is_visible=True,
        )
        self.paid_path = KnowledgePath.objects.create(
            title='Paid',
            author=self.author,
            reference_price=10,
            is_visible=True,
        )
        self.free_node = Node.objects.create(
            knowledge_path=self.free_path,
            title='Free node',
            media_type='TEXT',
            order=1,
        )
        self.paid_node = Node.objects.create(
            knowledge_path=self.paid_path,
            title='Paid node',
            media_type='TEXT',
            order=1,
        )

    def test_free_path_open_to_anyone(self):
        self.assertTrue(user_has_path_access(self.other, self.free_path))
        self.assertTrue(is_node_available_for_user(self.free_node, self.other))

    def test_paid_path_locked_without_purchase(self):
        self.assertFalse(user_has_path_access(self.buyer, self.paid_path))
        self.assertFalse(is_node_available_for_user(self.paid_node, self.buyer))

    def test_author_always_has_access(self):
        self.assertTrue(user_has_path_access(self.author, self.paid_path))
        self.assertTrue(is_node_available_for_user(self.paid_node, self.author))

    def test_paid_purchase_unlocks(self):
        KnowledgePathPurchase.objects.create(
            user=self.buyer,
            knowledge_path=self.paid_path,
            payment_status='PAID',
            price_amount=10,
        )
        self.assertTrue(user_has_path_access(self.buyer, self.paid_path))
        self.assertTrue(is_node_available_for_user(self.paid_node, self.buyer))

    def test_pending_purchase_does_not_unlock(self):
        KnowledgePathPurchase.objects.create(
            user=self.buyer,
            knowledge_path=self.paid_path,
            payment_status='PENDING',
            price_amount=10,
        )
        self.assertFalse(user_has_path_access(self.buyer, self.paid_path))


class KnowledgePathSerializerAccessTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.author = UserFactory()
        self.buyer = UserFactory()
        self.path = KnowledgePath.objects.create(
            title='Paid Detail',
            author=self.author,
            reference_price=12.5,
            is_visible=True,
        )
        Node.objects.create(
            knowledge_path=self.path,
            title='N1',
            media_type='TEXT',
            order=1,
        )

    def test_detail_exposes_price_and_access_flags(self):
        self.client.force_authenticate(user=self.buyer)
        response = self.client.get(f'/api/knowledge_paths/{self.path.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['reference_price'], 12.5)
        self.assertTrue(response.data['is_paid_path'])
        self.assertFalse(response.data['user_has_access'])
        self.assertIsNone(response.data['user_purchase_status'])

    def test_detail_redacts_quizzes_without_access(self):
        from quizzes.models import Quiz, Question, Option

        node = self.path.nodes.first()
        quiz = Quiz.objects.create(node=node, title='Secret quiz', max_attempts_per_day=3)
        question = Question.objects.create(
            quiz=quiz,
            text='Answer?',
            question_type='SINGLE',
        )
        Option.objects.create(question=question, text='Yes', is_correct=True)

        self.client.force_authenticate(user=self.buyer)
        response = self.client.get(f'/api/knowledge_paths/{self.path.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['nodes'][0]['quizzes'], [])
        self.assertIsNone(response.data['nodes'][0]['content_profile_id'])

        quiz_response = self.client.get(f'/api/quizzes/quiz-detail/{quiz.id}/')
        self.assertEqual(quiz_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(quiz_response.data.get('code'), 'path_payment_required')

        list_response = self.client.get(
            f'/api/quizzes/knowledge-paths/{self.path.id}/quizzes/'
        )
        self.assertEqual(list_response.status_code, status.HTTP_403_FORBIDDEN)
