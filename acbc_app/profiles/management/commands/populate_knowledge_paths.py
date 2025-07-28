from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
import random
from faker import Faker
from django.db import IntegrityError

from knowledge_paths.models import KnowledgePath, Node
from quizzes.models import Quiz, Question, Option

fake = Faker()

# Configuration
CONFIG = {
    'knowledge_paths': {
        'paths_per_user': 2,
        'nodes_per_path': 5,
        'is_visible_probability': 0.7,  # 70% chance of being visible
    },
    'quizzes': {
        'questions_per_quiz': (3, 6),  # (min, max)
        'options_per_question': (3, 5),  # (min, max)
    }
}

class Command(BaseCommand):
    help = 'Populates the database with knowledge paths, nodes, and quizzes'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true', help='Clear existing knowledge paths data before populating')
        parser.add_argument('--skip-existing', action='store_true', dest='skip_existing', help='Skip creation of objects that already exist')

    def handle(self, *args, **options):
        if options['clear']:
            self.clear_database()
        
        self.stdout.write('Starting knowledge paths population...')
        self.skip_existing = options.get('skip_existing', False)
        
        # Get existing users
        users = list(User.objects.all())
        if not users:
            self.stdout.write(self.style.ERROR('No users found. Please run populate_users first.'))
            return
        
        # Create knowledge paths for each user
        for user in users:
            self.create_knowledge_paths_for_user(user)
        
        self.stdout.write(self.style.SUCCESS('Successfully populated knowledge paths'))

    def clear_database(self):
        """Clear all knowledge paths related data"""
        self.stdout.write('Clearing existing knowledge paths data...')
        
        # Delete in reverse order of dependencies
        Option.objects.all().delete()
        Question.objects.all().delete()
        Quiz.objects.all().delete()
        Node.objects.all().delete()
        KnowledgePath.objects.all().delete()
        
        self.stdout.write('Knowledge paths data cleared successfully')

    def create_knowledge_paths_for_user(self, user):
        """Create knowledge paths for a specific user"""
        for path_num in range(CONFIG['knowledge_paths']['paths_per_user']):
            try:
                title = f"{fake.catch_phrase()} - {user.username}'s Path {path_num + 1}"
                
                # Check if path already exists
                if self.skip_existing and KnowledgePath.objects.filter(title=title, author=user).exists():
                    self.stdout.write(f'Skipping existing knowledge path: {title}')
                    continue
                
                path = KnowledgePath.objects.create(
                    title=title,
                    description=fake.text(max_nb_chars=1000),
                    author=user,
                    is_visible=True  # Always visible
                )
                
                # Create nodes for the path
                nodes = self.create_nodes_for_path(path)
                
                # Create quizzes (one at the end, one in the middle)
                self.create_quizzes_for_path(path, nodes)
                
                self.stdout.write(f'Created knowledge path: {path.title} with {len(nodes)} nodes')
            except IntegrityError:
                self.stdout.write(self.style.WARNING(f'Failed to create knowledge path: {title}'))
                continue

    def create_nodes_for_path(self, path):
        """Create nodes for a knowledge path"""
        nodes = []
        num_nodes = CONFIG['knowledge_paths']['nodes_per_path']
        
        for i in range(num_nodes):
            try:
                node = Node.objects.create(
                    knowledge_path=path,
                    title=f"Node {i + 1}: {fake.catch_phrase()}",
                    description=fake.text(max_nb_chars=500),
                    order=i + 1,
                    media_type=random.choice(['VIDEO', 'AUDIO', 'TEXT', 'IMAGE'])
                )
                nodes.append(node)
            except IntegrityError:
                self.stdout.write(self.style.WARNING(f'Failed to create node {i + 1} for path: {path.title}'))
                continue
        
        return nodes

    def create_quizzes_for_path(self, path, nodes):
        """Create quizzes for a knowledge path - one at the end, one in the middle"""
        if len(nodes) < 2:
            return
        
        # Quiz at the end (last node)
        end_node = nodes[-1]
        self.create_quiz_for_node(end_node, "Final Quiz")
        
        # Quiz in the middle (around the middle node)
        middle_index = len(nodes) // 2
        middle_node = nodes[middle_index]
        self.create_quiz_for_node(middle_node, "Mid-Path Quiz")

    def create_quiz_for_node(self, node, quiz_type):
        """Create a quiz for a specific node"""
        try:
            quiz = Quiz.objects.create(
                node=node,
                title=f"{quiz_type}: {fake.catch_phrase()}",
                description=fake.text(max_nb_chars=200),
                max_attempts_per_day=random.randint(2, 5)
            )
            
            # Create questions for the quiz
            num_questions = random.randint(*CONFIG['quizzes']['questions_per_quiz'])
            for q_num in range(num_questions):
                self.create_question_for_quiz(quiz, q_num + 1)
            
            self.stdout.write(f'Created quiz: {quiz.title} for node: {node.title}')
        except IntegrityError:
            self.stdout.write(self.style.WARNING(f'Failed to create quiz for node: {node.title}'))

    def create_question_for_quiz(self, quiz, question_num):
        """Create a question with options for a quiz"""
        try:
            question_type = random.choice(['SINGLE', 'MULTIPLE'])
            question = Question.objects.create(
                quiz=quiz,
                text=f"Question {question_num}: {fake.text(max_nb_chars=200)}",
                question_type=question_type
            )
            
            # Create options for the question
            num_options = random.randint(*CONFIG['quizzes']['options_per_question'])
            correct_options = 1 if question_type == 'SINGLE' else random.randint(1, 2)
            
            for opt_num in range(num_options):
                is_correct = opt_num < correct_options
                Option.objects.create(
                    question=question,
                    text=f"Option {opt_num + 1}: {fake.text(max_nb_chars=100)}",
                    is_correct=is_correct
                )
        except IntegrityError:
            self.stdout.write(self.style.WARNING(f'Failed to create question {question_num} for quiz: {quiz.title}')) 