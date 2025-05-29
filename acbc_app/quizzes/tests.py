from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from django.contrib.auth.models import User
from knowledge_paths.models import KnowledgePath, Node
from quizzes.models import Quiz, Question, Option, UserQuizAttempt, Answer


class QuizModelTests(TestCase):
    """Test suite for Quiz and related models."""

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='testpass')
        self.path = KnowledgePath.objects.create(title='Path', author=self.user)
        self.node = Node.objects.create(knowledge_path=self.path, title='Node', media_type='TEXT')
        self.quiz = Quiz.objects.create(node=self.node, title='Quiz', max_attempts_per_day=3)
        self.question = Question.objects.create(quiz=self.quiz, text='Q1', question_type='SINGLE')
        self.option1 = Option.objects.create(question=self.question, text='A', is_correct=True)
        self.option2 = Option.objects.create(question=self.question, text='B', is_correct=False)

    def test_quiz_str(self):
        self.assertIn('Quiz', str(self.quiz))

    def test_question_str(self):
        self.assertEqual(str(self.question), 'Q1')

    def test_option_str(self):
        self.assertIn('A', str(self.option1))

    def test_user_quiz_attempt_creation(self):
        attempt = UserQuizAttempt.objects.create(user=self.user, quiz=self.quiz, score=80)
        self.assertEqual(attempt.quiz, self.quiz)
        self.assertEqual(attempt.user, self.user)
        self.assertEqual(attempt.score, 80)

    def test_answer_creation(self):
        attempt = UserQuizAttempt.objects.create(user=self.user, quiz=self.quiz)
        answer = Answer.objects.create(user_quiz_attempt=attempt, question=self.question)
        answer.selected_options.set([self.option1])
        self.assertEqual(answer.selected_options.count(), 1)

class QuizAPITests(APITestCase):
    """Test suite for Quiz API endpoints."""

    def setUp(self):
        self.user = User.objects.create_user(username='apiuser', password='apipass')
        self.client.force_authenticate(user=self.user)
        self.path = KnowledgePath.objects.create(title='API Path', author=self.user)
        self.node = Node.objects.create(knowledge_path=self.path, title='API Node', media_type='TEXT')
        self.quiz = Quiz.objects.create(node=self.node, title='API Quiz', max_attempts_per_day=2)
        self.question = Question.objects.create(quiz=self.quiz, text='API Q1', question_type='SINGLE')
        self.option1 = Option.objects.create(question=self.question, text='API A', is_correct=True)
        self.option2 = Option.objects.create(question=self.question, text='API B', is_correct=False)

    def test_create_quiz(self):
        url = reverse('quizzes:quiz-create')
        data = {
            'path_id': self.path.id,
            'node_id': self.node.id,
            'quiz': {
                'title': 'New Quiz',
                'description': 'Desc',
                'max_attempts_per_day': 2,
                'questions': [
                    {
                        'text': 'Q?',
                        'question_type': 'SINGLE',
                        'options': [
                            {'text': 'A', 'is_correct': True},
                            {'text': 'B', 'is_correct': False}
                        ]
                    }
                ]
            }
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Quiz.objects.filter(title='New Quiz').count(), 1)

    def test_get_quiz_detail(self):
        url = reverse('quizzes:quiz-detail', args=[self.quiz.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'API Quiz')

    def test_update_quiz(self):
        url = reverse('quizzes:quiz-detail', args=[self.quiz.id])
        data = {
            'title': 'Updated Quiz',
            'description': 'Updated Desc',
            'node': self.node.id,
            'max_attempts_per_day': 3,
            'questions': [
                {
                    'text': 'Updated Q',
                    'question_type': 'SINGLE',
                    'options': [
                        {'text': 'A', 'is_correct': True},
                        {'text': 'B', 'is_correct': False}
                    ]
                }
            ]
        }
        response = self.client.put(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.quiz.refresh_from_db()
        self.assertEqual(self.quiz.title, 'Updated Quiz')
        self.assertEqual(self.quiz.max_attempts_per_day, 3)

    def test_delete_quiz(self):
        url = reverse('quizzes:quiz-detail', args=[self.quiz.id])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Quiz.objects.filter(id=self.quiz.id).exists())

    def test_get_quizzes_by_knowledge_path(self):
        url = reverse('quizzes:quizzes-by-knowledge-path', args=[self.path.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(any(q['id'] == self.quiz.id for q in response.data))

    def test_submit_quiz_success(self):
        url = reverse('quizzes:quiz-submit', args=[self.quiz.id])
        data = {
            'answers': {
                str(self.question.id): [self.option1.id]
            }
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['attempt']['score'], 100)
        self.assertEqual(response.data['correct_answers'], 1)

    def test_submit_quiz_max_attempts(self):
        url = reverse('quizzes:quiz-submit', args=[self.quiz.id])
        data = {'answers': {str(self.question.id): [self.option1.id]}}
        for _ in range(self.quiz.max_attempts_per_day):
            self.client.post(url, data, format='json')
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('maximum number of attempts', response.data['message'])

    def test_submit_quiz_invalid_answers(self):
        url = reverse('quizzes:quiz-submit', args=[self.quiz.id])
        data = {'answers': {'9999': [self.option1.id]}}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        data = {'answers': {str(self.question.id): [9999]}}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_submit_quiz_single_choice_multiple_options(self):
        url = reverse('quizzes:quiz-submit', args=[self.quiz.id])
        data = {'answers': {str(self.question.id): [self.option1.id, self.option2.id]}}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_permissions(self):
        self.client.force_authenticate(user=None)
        url = reverse('quizzes:quiz-detail', args=[self.quiz.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

class QuizIntegrationTests(APITestCase):
    """Integration tests for quiz progress and knowledge path."""

    def setUp(self):
        self.user = User.objects.create_user(username='integration', password='pass')
        self.client.force_authenticate(user=self.user)
        self.path = KnowledgePath.objects.create(title='Integration Path', author=self.user)
        self.node1 = Node.objects.create(knowledge_path=self.path, title='Node 1', order=1, media_type='TEXT')
        self.node2 = Node.objects.create(knowledge_path=self.path, title='Node 2', order=2, media_type='TEXT')
        self.quiz1 = Quiz.objects.create(node=self.node1, title='Quiz 1', max_attempts_per_day=2)
        self.q1 = Question.objects.create(quiz=self.quiz1, text='Q1', question_type='SINGLE')
        self.o1 = Option.objects.create(question=self.q1, text='A', is_correct=True)
        self.o2 = Option.objects.create(question=self.q1, text='B', is_correct=False)

    def test_quiz_completion_and_next_node(self):
        url = reverse('quizzes:quiz-submit', args=[self.quiz1.id])
        data = {'answers': {str(self.q1.id): [self.o1.id]}}
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['attempt']['score'], 100)
        self.assertIsNotNone(response.data['next_node'])
        self.assertEqual(response.data['next_node']['id'], self.node2.id)
