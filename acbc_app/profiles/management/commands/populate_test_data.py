from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.files.base import ContentFile
from datetime import timedelta
import random
import string
from faker import Faker
from django.db import models, IntegrityError
from django.db.models import Max

from profiles.models import Profile, CryptoCurrency, AcceptedCrypto, ContactMethod
from content.models import Topic, Content, ContentProfile, Library, Collection, Publication
from knowledge_paths.models import KnowledgePath, Node
from quizzes.models import Quiz, Question, Option, UserQuizAttempt, Answer
from votes.models import Vote, VoteCount
from comments.models import Comment
from django.contrib.contenttypes.models import ContentType

fake = Faker()

# Configuration
CONFIG = {
    'users': {
        'count': 2,
        'contact_methods_per_user': (1, 3),  # (min, max)
        'is_teacher_probability': 0.3,  # 30% chance of being a teacher
    },
    'topics': {
        'count': 8,
    },
    'knowledge_paths': {
        'paths_per_user': 1,
        'nodes_per_path': (3, 8),  # (min, max)
    },
    'content': {
        'items_per_topic': 20,
        'profiles_per_content': (1, 5),  # (min, max)
        'publication_probability': 0.3,  # 30% chance of creating a publication
    },
    'quizzes': {
        'creation_probability': 0.4,  # 40% chance to create a quiz for a node
        'questions_per_quiz': (3, 8),  # (min, max)
        'options_per_question': (3, 6),  # (min, max)
        'max_attempts_per_day': (2, 5),  # (min, max)
    },
    'comments': {
        'per_object': 8,
        'max_reply_depth': 4,
        'reply_probability': 0.7,  # 70% chance to have replies
        'nested_reply_probability': 0.5,  # 50% chance for nested replies
        'replies_per_comment': (1, 3),  # (min, max)
    },
    'voting': {
        'voters_percentage': (0.3, 0.8),  # (min, max) percentage of users who vote
    }
}

class Command(BaseCommand):
    help = 'Populates the database with realistic test data'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true', help='Clear existing data before populating')
        parser.add_argument('--skip-existing', action='store_true', dest='skip_existing', help='Skip creation of objects that already exist')

    def handle(self, *args, **options):
        if options['clear']:
            self.clear_database()
        
        self.stdout.write('Starting data population...')
        self.skip_existing = options.get('skip_existing', False)
        
        # Create users and profiles
        users = self.create_users(CONFIG['users']['count'])
        
        # Create topics
        topics = self.create_topics(CONFIG['topics']['count'], users)
        
        # Create knowledge paths
        knowledge_paths = self.create_knowledge_paths(CONFIG['knowledge_paths']['paths_per_user'], users, topics)
        
        # Create content and content profiles
        self.create_content_and_profiles(CONFIG['content']['items_per_topic'], topics, users)
        
        # Create quizzes and simulate attempts
        self.create_quizzes_and_attempts(knowledge_paths, users)
        
        # Create comments and replies
        self.create_comments_and_replies(CONFIG['comments']['per_object'], CONFIG['comments']['max_reply_depth'], users)
        
        # Create votes and interactions
        self.create_votes_and_interactions(users)
        
        self.stdout.write(self.style.SUCCESS('Successfully populated test data'))

    def clear_database(self):
        """Clear all data from the database"""
        self.stdout.write('Clearing existing data...')
        
        # Delete in reverse order of dependencies
        Vote.objects.all().delete()
        VoteCount.objects.all().delete()
        Answer.objects.all().delete()
        UserQuizAttempt.objects.all().delete()
        Option.objects.all().delete()
        Question.objects.all().delete()
        Quiz.objects.all().delete()
        Comment.objects.all().delete()
        Publication.objects.all().delete()
        ContentProfile.objects.all().delete()
        Content.objects.all().delete()
        Node.objects.all().delete()
        KnowledgePath.objects.all().delete()
        Topic.objects.all().delete()
        ContactMethod.objects.all().delete()
        Profile.objects.all().delete()
        User.objects.all().delete()
        
        self.stdout.write('Database cleared successfully')

    def create_users(self, num_users):
        users = []
        for i in range(num_users):
            try:
                username = fake.user_name()
                email = fake.email()
                password = ''.join(random.choices(string.ascii_letters + string.digits, k=12))
                
                # Check if user already exists
                if self.skip_existing and User.objects.filter(username=username).exists():
                    self.stdout.write(f'Skipping existing user: {username}')
                    continue
                
                user = User.objects.create_user(
                    username=username,
                    email=email,
                    password=password,
                    first_name=fake.first_name(),
                    last_name=fake.last_name()
                )
                
                # Create profile
                profile = Profile.objects.create(
                    user=user,
                    interests=fake.text(max_nb_chars=250),
                    profile_description=fake.text(max_nb_chars=500),
                    timezone=fake.timezone(),
                    is_teacher=random.random() < CONFIG['users']['is_teacher_probability']
                )
                
                # Create contact methods
                num_contact_methods = random.randint(*CONFIG['users']['contact_methods_per_user'])
                for _ in range(num_contact_methods):
                    ContactMethod.objects.create(
                        user=user,
                        name=fake.word(),
                        description=fake.text(max_nb_chars=100),
                        url_link=fake.url()
                    )
                
                users.append(user)
                self.stdout.write(f'Created user: {username}')
            except IntegrityError:
                self.stdout.write(self.style.WARNING(f'Failed to create user: {username} (already exists)'))
                continue
        
        return users

    def create_topics(self, num_topics, users):
        topics = []
        for _ in range(num_topics):
            try:
                title = fake.catch_phrase()
                
                # Check if topic already exists
                if self.skip_existing and Topic.objects.filter(title=title).exists():
                    self.stdout.write(f'Skipping existing topic: {title}')
                    continue
                
                topic = Topic.objects.create(
                    title=title,
                    description=fake.text(max_nb_chars=500),
                    creator=random.choice(users)
                )
                
                topics.append(topic)
                self.stdout.write(f'Created topic: {topic.title}')
            except IntegrityError:
                self.stdout.write(self.style.WARNING(f'Failed to create topic: {title} (already exists)'))
                continue
        
        return topics

    def create_knowledge_paths(self, num_paths, users, topics):
        knowledge_paths = []
        for user in users:
            for _ in range(num_paths):
                try:
                    title = fake.catch_phrase()
                    
                    # Check if path already exists
                    if self.skip_existing and KnowledgePath.objects.filter(title=title, author=user).exists():
                        self.stdout.write(f'Skipping existing knowledge path: {title}')
                        continue
                    
                    path = KnowledgePath.objects.create(
                        title=title,
                        description=fake.text(max_nb_chars=1000),
                        author=user
                    )
                    
                    # Create nodes for the path
                    num_nodes = random.randint(*CONFIG['knowledge_paths']['nodes_per_path'])
                    for i in range(num_nodes):
                        # Get the current max order for this path
                        max_order = Node.objects.filter(knowledge_path=path).aggregate(Max('order'))['order__max'] or 0
                        next_order = max_order + 1
                        
                        node = Node.objects.create(
                            knowledge_path=path,
                            title=fake.catch_phrase(),
                            description=fake.text(max_nb_chars=500),
                            order=next_order,
                            media_type=random.choice(['VIDEO', 'AUDIO', 'TEXT', 'IMAGE'])
                        )
                    
                    knowledge_paths.append(path)
                    self.stdout.write(f'Created knowledge path: {path.title}')
                except IntegrityError:
                    self.stdout.write(self.style.WARNING(f'Failed to create knowledge path: {title} (already exists)'))
                    continue
        
        return knowledge_paths

    def create_content_and_profiles(self, content_per_topic, topics, users):
        for topic in topics:
            for _ in range(content_per_topic):
                try:
                    # Create base content
                    original_title = fake.catch_phrase()
                    
                    # Check if content already exists
                    if self.skip_existing and Content.objects.filter(original_title=original_title).exists():
                        self.stdout.write(f'Skipping existing content: {original_title}')
                        continue
                    
                    content = Content.objects.create(
                        uploaded_by=random.choice(users),
                        media_type=random.choice(['VIDEO', 'AUDIO', 'TEXT', 'IMAGE']),
                        original_title=original_title,
                        original_author=fake.name()
                    )
                    content.topics.add(topic)
                    
                    # Create content profiles for random users
                    # Adjust num_profiles to not exceed available users
                    max_profiles = min(len(users), CONFIG['content']['profiles_per_content'][1])
                    min_profiles = min(len(users), CONFIG['content']['profiles_per_content'][0])
                    num_profiles = random.randint(min_profiles, max_profiles)
                    
                    # If we have fewer users than the minimum required profiles, use all users
                    if len(users) <= num_profiles:
                        selected_users = users
                    else:
                        selected_users = random.sample(users, num_profiles)
                    
                    for user in selected_users:
                        # Create library and collection for user if they don't exist
                        library, _ = Library.objects.get_or_create(
                            user=user,
                            defaults={'name': f"{user.username}'s Library"}
                        )
                        
                        collection, _ = Collection.objects.get_or_create(
                            library=library,
                            defaults={'name': fake.word()}
                        )
                        
                        # Check if profile already exists
                        if self.skip_existing and ContentProfile.objects.filter(content=content, user=user).exists():
                            self.stdout.write(f'Skipping existing content profile for user: {user.username}')
                            continue
                        
                        # Create content profile
                        profile = ContentProfile.objects.create(
                            content=content,
                            user=user,
                            collection=collection,
                            title=fake.catch_phrase(),
                            author=fake.name(),
                            personal_note=fake.text(max_nb_chars=200),
                            is_visible=random.choice([True, False]),
                            is_producer=random.choice([True, False])
                        )
                        
                        # Create publication
                        if random.random() < CONFIG['content']['publication_probability']:
                            Publication.objects.create(
                                user=user,
                                content_profile=profile,
                                text_content=fake.text(max_nb_chars=1000),
                                status=random.choice(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
                            )
                    
                    self.stdout.write(f'Created content: {content.original_title}')
                except IntegrityError:
                    self.stdout.write(self.style.WARNING(f'Failed to create content: {original_title} (already exists)'))
                    continue

    def create_quizzes_and_attempts(self, knowledge_paths, users):
        for path in knowledge_paths:
            for node in path.nodes.all():
                try:
                    # Create quiz for some nodes
                    if random.random() < CONFIG['quizzes']['creation_probability']:
                        title = f"Quiz: {fake.catch_phrase()}"
                        
                        # Check if quiz already exists
                        if self.skip_existing and Quiz.objects.filter(title=title, node=node).exists():
                            self.stdout.write(f'Skipping existing quiz: {title}')
                            continue
                        
                        quiz = Quiz.objects.create(
                            node=node,
                            title=title,
                            description=fake.text(max_nb_chars=200),
                            max_attempts_per_day=random.randint(*CONFIG['quizzes']['max_attempts_per_day'])
                        )
                        
                        # Create questions
                        num_questions = random.randint(*CONFIG['quizzes']['questions_per_quiz'])
                        for _ in range(num_questions):
                            question = Question.objects.create(
                                quiz=quiz,
                                text=fake.text(max_nb_chars=200),
                                question_type=random.choice(['SINGLE', 'MULTIPLE'])
                            )
                            
                            # Create options
                            num_options = random.randint(*CONFIG['quizzes']['options_per_question'])
                            correct_options = random.randint(1, 2) if question.question_type == 'MULTIPLE' else 1
                            
                            for i in range(num_options):
                                Option.objects.create(
                                    question=question,
                                    text=fake.text(max_nb_chars=100),
                                    is_correct=i < correct_options
                                )
                        
                        # Simulate quiz attempts
                        for user in random.sample(users, random.randint(1, len(users))):
                            attempt = UserQuizAttempt.objects.create(
                                user=user,
                                quiz=quiz,
                                score=random.randint(0, 100)
                            )
                            
                            # Create answers for each question
                            for question in quiz.questions.all():
                                selected_options = random.sample(
                                    list(question.options.all()),
                                    random.randint(1, min(2, question.options.count()))
                                )
                                answer = Answer.objects.create(
                                    user_quiz_attempt=attempt,
                                    question=question
                                )
                                answer.selected_options.add(*selected_options)
                        
                        self.stdout.write(f'Created quiz: {quiz.title}')
                except IntegrityError:
                    self.stdout.write(self.style.WARNING(f'Failed to create quiz for node: {node.title}'))
                    continue

    def create_comments_and_replies(self, comments_per_object, max_reply_depth, users):
        """Create comments and replies for various content types"""
        # Get all commentable objects
        content_objects = list(Content.objects.all())
        knowledge_paths = list(KnowledgePath.objects.all())
        publications = list(Publication.objects.all())
        
        all_objects = content_objects + knowledge_paths + publications
        
        for obj in all_objects:
            content_type = ContentType.objects.get_for_model(obj)
            
            # Create top-level comments
            for _ in range(comments_per_object):
                try:
                    comment = self.create_comment(obj, content_type, users, None)
                    
                    # Create replies with random depth
                    if random.random() < CONFIG['comments']['reply_probability']:
                        self.create_replies(comment, users, max_reply_depth, 1)
                except IntegrityError:
                    self.stdout.write(self.style.WARNING(f'Failed to create comment for {content_type.model}: {obj}'))
                    continue
            
            self.stdout.write(f'Created comments for {content_type.model}: {obj}')

    def create_comment(self, obj, content_type, users, parent=None):
        """Create a single comment"""
        try:
            author = random.choice(users)
            topic = None
            
            # If the object is a KnowledgePath, randomly assign a topic
            if isinstance(obj, KnowledgePath):
                topic = random.choice(Topic.objects.all())
            
            comment = Comment.objects.create(
                author=author,
                body=fake.paragraph(nb_sentences=random.randint(2, 5)),
                content_type=content_type,
                object_id=obj.id,
                topic=topic,
                parent=parent
            )
            
            # Create vote count for the comment
            VoteCount.objects.create(
                content_type=ContentType.objects.get_for_model(comment),
                object_id=comment.id,
                vote_count=0
            )
            
            # Add some random votes to the comment
            min_voters = int(len(users) * CONFIG['voting']['voters_percentage'][0])
            max_voters = int(len(users) * CONFIG['voting']['voters_percentage'][1])
            num_voters = random.randint(min_voters, max_voters)
            voters = random.sample(users, num_voters)
            
            for voter in voters:
                if voter != author:  # Don't let authors vote on their own comments
                    Vote.objects.create(
                        user=voter,
                        value=random.choice([-1, 1]),
                        content_type=ContentType.objects.get_for_model(comment),
                        object_id=comment.id
                    )
            
            # Update vote count
            vote_count = VoteCount.objects.get(
                content_type=ContentType.objects.get_for_model(comment),
                object_id=comment.id
            )
            vote_count.update_vote_count()
            
            return comment
        except IntegrityError:
            self.stdout.write(self.style.WARNING(f'Failed to create comment for {content_type.model}: {obj}'))
            raise

    def create_replies(self, parent_comment, users, max_depth, current_depth):
        """Recursively create replies to a comment"""
        if current_depth >= max_depth:
            return
        
        # Create 1-3 replies
        num_replies = random.randint(*CONFIG['comments']['replies_per_comment'])
        for _ in range(num_replies):
            try:
                reply = self.create_comment(
                    parent_comment.content_object,
                    parent_comment.content_type,
                    users,
                    parent_comment
                )
                
                # Recursively create replies to this reply
                if random.random() < CONFIG['comments']['nested_reply_probability']:
                    self.create_replies(reply, users, max_depth, current_depth + 1)
            except IntegrityError:
                self.stdout.write(self.style.WARNING(f'Failed to create reply to comment: {parent_comment.id}'))
                continue

    def create_votes_and_interactions(self, users):
        # Get all voteable objects
        content_objects = list(Content.objects.all())
        knowledge_paths = list(KnowledgePath.objects.all())
        publications = list(Publication.objects.all())
        
        all_objects = content_objects + knowledge_paths + publications
        
        for obj in all_objects:
            try:
                # Create vote count
                vote_count = VoteCount.objects.create(
                    content_type=ContentType.objects.get_for_model(obj),
                    object_id=obj.id,
                    vote_count=0
                )
                
                # Simulate votes
                min_voters = int(len(users) * CONFIG['voting']['voters_percentage'][0])
                max_voters = int(len(users) * CONFIG['voting']['voters_percentage'][1])
                num_voters = random.randint(min_voters, max_voters)
                voters = random.sample(users, num_voters)
                
                for voter in voters:
                    Vote.objects.create(
                        user=voter,
                        value=random.choice([-1, 1]),
                        content_type=ContentType.objects.get_for_model(obj),
                        object_id=obj.id
                    )
                
                # Update vote count
                vote_count.update_vote_count()
            except IntegrityError:
                self.stdout.write(self.style.WARNING(f'Failed to create votes for {obj}'))
                continue 