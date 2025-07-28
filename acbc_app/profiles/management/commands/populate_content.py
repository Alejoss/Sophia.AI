from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
import random
from faker import Faker
from django.db import IntegrityError
from django.utils import timezone
from datetime import timedelta

from content.models import Topic, Content, ContentProfile, Library, Collection, Publication
from events.models import Event

fake = Faker()

# Configuration
CONFIG = {
    'topics': {
        'count': 8,
        'moderators_per_topic': (1, 3),  # (min, max)
    },
    'content': {
        'items_per_topic': 15,
        'profiles_per_content': (1, 4),  # (min, max)
        'publication_probability': 0.4,  # 40% chance of creating a publication
    },
    'libraries': {
        'collections_per_library': (2, 5),  # (min, max)
    },
    'events': {
        'events_per_user': (1, 3),  # (min, max)
        'future_event_probability': 0.6,  # 60% chance of future events
        'platforms': ['google_meet', 'jitsi', 'microsoft_teams', 'telegram', 'tox', 'twitch', 'zoom', 'other']
    }
}

class Command(BaseCommand):
    help = 'Populates the database with content, topics, libraries, publications, and events'

    def add_arguments(self, parser):
        parser.add_argument('--clear', action='store_true', help='Clear existing content data before populating')
        parser.add_argument('--skip-existing', action='store_true', dest='skip_existing', help='Skip creation of objects that already exist')

    def handle(self, *args, **options):
        if options['clear']:
            self.clear_database()
        
        self.stdout.write('Starting content population...')
        self.skip_existing = options.get('skip_existing', False)
        
        # Get existing users
        users = list(User.objects.all())
        if not users:
            self.stdout.write(self.style.ERROR('No users found. Please run populate_users first.'))
            return
        
        # Create topics
        topics = self.create_topics(users)
        
        # Create content and content profiles
        self.create_content_and_profiles(topics, users)
        
        # Create events
        self.create_events(users)
        
        self.stdout.write(self.style.SUCCESS('Successfully populated content'))

    def clear_database(self):
        """Clear all content related data"""
        self.stdout.write('Clearing existing content data...')
        
        # Delete in reverse order of dependencies
        Event.objects.all().delete()
        Publication.objects.all().delete()
        ContentProfile.objects.all().delete()
        Content.objects.all().delete()
        Topic.objects.all().delete()
        
        self.stdout.write('Content data cleared successfully')

    def create_topics(self, users):
        """Create topics with moderators"""
        topics = []
        topic_titles = [
            "Blockchain Fundamentals",
            "Smart Contracts",
            "DeFi Protocols",
            "Cryptocurrency Trading",
            "Web3 Development",
            "NFTs and Digital Art",
            "Consensus Mechanisms",
            "Cryptography Basics"
        ]
        
        for i, title in enumerate(topic_titles):
            try:
                # Check if topic already exists
                if self.skip_existing and Topic.objects.filter(title=title).exists():
                    self.stdout.write(f'Skipping existing topic: {title}')
                    continue
                
                topic = Topic.objects.create(
                    title=title,
                    description=fake.text(max_nb_chars=500),
                    creator=random.choice(users)
                )
                
                # Add moderators
                num_moderators = random.randint(*CONFIG['topics']['moderators_per_topic'])
                moderators = random.sample(users, min(num_moderators, len(users)))
                topic.moderators.add(*moderators)
                
                topics.append(topic)
                self.stdout.write(f'Created topic: {topic.title} with {len(moderators)} moderators')
            except IntegrityError:
                self.stdout.write(self.style.WARNING(f'Failed to create topic: {title}'))
                continue
        
        return topics

    def create_content_and_profiles(self, topics, users):
        """Create content and content profiles"""
        for topic in topics:
            for content_num in range(CONFIG['content']['items_per_topic']):
                try:
                    # Create base content
                    original_title = f"{fake.catch_phrase()} - {topic.title}"
                    
                    # Check if content already exists
                    if self.skip_existing and Content.objects.filter(original_title=original_title).exists():
                        self.stdout.write(f'Skipping existing content: {original_title}')
                        continue
                    
                    content = Content.objects.create(
                        uploaded_by=random.choice(users),
                        media_type=random.choice(['VIDEO', 'AUDIO', 'TEXT', 'IMAGE']),
                        original_title=original_title,
                        original_author=fake.name(),
                        url=fake.url() if random.choice([True, False]) else None
                    )
                    content.topics.add(topic)
                    
                    # Create content profiles for random users
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
                    
                    self.stdout.write(f'Created content: {content.original_title} with {len(selected_users)} profiles')
                except IntegrityError:
                    self.stdout.write(self.style.WARNING(f'Failed to create content: {original_title}'))
                    continue

    def create_events(self, users):
        """Create events for users"""
        self.stdout.write('Creating events...')
        
        event_types = ['LIVE_COURSE', 'LIVE_CERTIFICATION', 'LIVE_MASTER_CLASS']
        
        for user in users:
            num_events = random.randint(*CONFIG['events']['events_per_user'])
            
            for event_num in range(num_events):
                try:
                    # Determine if event is in the future or past
                    is_future = random.random() < CONFIG['events']['future_event_probability']
                    
                    if is_future:
                        # Future event (1-30 days from now)
                        days_ahead = random.randint(1, 30)
                        start_date = timezone.now() + timedelta(days=days_ahead)
                        end_date = start_date + timedelta(hours=random.randint(1, 4))
                    else:
                        # Past event (1-30 days ago)
                        days_ago = random.randint(1, 30)
                        start_date = timezone.now() - timedelta(days=days_ago)
                        end_date = start_date + timedelta(hours=random.randint(1, 4))
                    
                    # Choose platform
                    platform = random.choice(CONFIG['events']['platforms'])
                    other_platform = fake.word() if platform == 'other' else ''
                    
                    event = Event.objects.create(
                        event_type=random.choice(event_types),
                        owner=user,
                        title=f"{fake.catch_phrase()} - {user.username}'s Event {event_num + 1}",
                        description=fake.text(max_nb_chars=1000),
                        platform=platform,
                        other_platform=other_platform,
                        reference_price=random.uniform(0, 100),
                        date_start=start_date,
                        date_end=end_date,
                        schedule_description=fake.text(max_nb_chars=500)
                    )
                    
                    self.stdout.write(f'Created event: {event.title} for {user.username}')
                except IntegrityError:
                    self.stdout.write(self.style.WARNING(f'Failed to create event for user: {user.username}'))
                    continue 