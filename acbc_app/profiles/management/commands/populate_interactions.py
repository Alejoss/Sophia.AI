from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
import random
from faker import Faker
from django.db import IntegrityError

from comments.models import Comment
from votes.models import Vote, VoteCount
from bookmarks.models import Bookmark
from content.models import Content, Topic, Publication
from knowledge_paths.models import KnowledgePath

fake = Faker()

# Configuration
CONFIG = {
    'comments': {
        'per_object': 6,
        'max_reply_depth': 3,
        'reply_probability': 0.6,  # 60% chance to have replies
        'nested_reply_probability': 0.4,  # 40% chance for nested replies
        'replies_per_comment': (1, 3),  # (min, max)
    },
    'voting': {
        'voters_percentage': (0.4, 0.8),  # (min, max) percentage of users who vote
        'positive_vote_probability': 0.7,  # 70% chance of positive vote
    },
    'bookmarks': {
        'bookmarks_per_user': (3, 8),  # (min, max)
        'bookmark_probability': 0.5,  # 50% chance to bookmark content
    }
}

class Command(BaseCommand):
    help = 'Populates the database with user interactions: comments, votes, and bookmarks'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true', help='Clear existing interaction data before populating')
        parser.add_argument('--skip-existing', action='store_true', dest='skip_existing', help='Skip creation of objects that already exist')

    def handle(self, *args, **options):
        if options['clear']:
            self.clear_database()
        
        self.stdout.write('Starting interactions population...')
        self.skip_existing = options.get('skip_existing', False)
        
        # Get existing users
        users = list(User.objects.all())
        if not users:
            self.stdout.write(self.style.ERROR('No users found. Please run populate_users first.'))
            return
        
        # Get existing content objects
        content_objects = list(Content.objects.all())
        knowledge_paths = list(KnowledgePath.objects.all())
        publications = list(Publication.objects.all())
        
        if not content_objects and not knowledge_paths and not publications:
            self.stdout.write(self.style.ERROR('No content found. Please run populate_content and populate_knowledge_paths first.'))
            return
        
        # Create comments and replies
        self.create_comments_and_replies(users, content_objects, knowledge_paths, publications)
        
        # Create votes and vote counts
        self.create_votes_and_votecounts(users, content_objects, knowledge_paths, publications)
        
        # Create bookmarks
        self.create_bookmarks(users, content_objects, knowledge_paths, publications)
        
        self.stdout.write(self.style.SUCCESS('Successfully populated interactions'))

    def clear_database(self):
        """Clear all interaction related data"""
        self.stdout.write('Clearing existing interaction data...')
        
        # Delete in reverse order of dependencies
        Vote.objects.all().delete()
        VoteCount.objects.all().delete()
        Comment.objects.all().delete()
        Bookmark.objects.all().delete()
        
        self.stdout.write('Interaction data cleared successfully')

    def create_comments_and_replies(self, users, content_objects, knowledge_paths, publications):
        """Create comments and replies for various content types"""
        self.stdout.write('Creating comments and replies...')
        
        all_objects = content_objects + knowledge_paths + publications
        
        for obj in all_objects:
            content_type = ContentType.objects.get_for_model(obj)
            
            # Create top-level comments
            for _ in range(CONFIG['comments']['per_object']):
                try:
                    comment = self.create_comment(obj, content_type, users, None)
                    
                    # Create replies with random depth
                    if random.random() < CONFIG['comments']['reply_probability']:
                        self.create_replies(comment, users, CONFIG['comments']['max_reply_depth'], 1)
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
                topic = random.choice(Topic.objects.all()) if Topic.objects.exists() else None
            
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

    def create_votes_and_votecounts(self, users, content_objects, knowledge_paths, publications):
        """Create votes and vote counts for all voteable objects"""
        self.stdout.write('Creating votes and vote counts...')
        
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
                    # Determine vote value based on probability
                    vote_value = 1 if random.random() < CONFIG['voting']['positive_vote_probability'] else -1
                    
                    Vote.objects.create(
                        user=voter,
                        value=vote_value,
                        content_type=ContentType.objects.get_for_model(obj),
                        object_id=obj.id
                    )
                
                # Update vote count
                vote_count.update_vote_count()
                
                self.stdout.write(f'Created votes for {ContentType.objects.get_for_model(obj).model}: {obj}')
            except IntegrityError:
                self.stdout.write(self.style.WARNING(f'Failed to create votes for {obj}'))
                continue

    def create_bookmarks(self, users, content_objects, knowledge_paths, publications):
        """Create bookmarks for users"""
        self.stdout.write('Creating bookmarks...')
        
        all_objects = content_objects + knowledge_paths + publications
        
        for user in users:
            num_bookmarks = random.randint(*CONFIG['bookmarks']['bookmarks_per_user'])
            if num_bookmarks > 0:
                # Randomly select objects to bookmark
                objects_to_bookmark = random.sample(all_objects, min(num_bookmarks, len(all_objects)))
                
                for obj in objects_to_bookmark:
                    try:
                        # Check if bookmark already exists
                        if self.skip_existing and Bookmark.objects.filter(user=user, content_type=ContentType.objects.get_for_model(obj), object_id=obj.id).exists():
                            continue
                        
                        # For content objects, randomly assign a topic
                        topic = None
                        if isinstance(obj, Content):
                            topic = random.choice(Topic.objects.all()) if Topic.objects.exists() else None
                        
                        Bookmark.create_bookmark(user, obj, topic)
                        
                    except IntegrityError:
                        self.stdout.write(self.style.WARNING(f'Failed to create bookmark for user: {user.username}'))
                        continue
                
                self.stdout.write(f'Created {len(objects_to_bookmark)} bookmarks for user: {user.username}') 