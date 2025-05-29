from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from django.db import IntegrityError
from faker import Faker
import random

from content.models import Topic, Content, ContentProfile
from votes.models import Vote, VoteCount

fake = Faker()

class Command(BaseCommand):
    help = 'Ensures each topic has at least 20 content items with votes'

    def handle(self, *args, **options):
        self.stdout.write('Starting to ensure topic content...')
        
        # Get all existing topics
        topics = Topic.objects.all()
        if not topics.exists():
            self.stdout.write(self.style.ERROR('No topics found in the database'))
            return

        # Get all existing users for voting
        users = list(User.objects.all())
        if not users:
            self.stdout.write(self.style.ERROR('No users found in the database'))
            return

        # Get all existing content
        existing_content = list(Content.objects.all())
        
        for topic in topics:
            self.stdout.write(f'Processing topic: {topic.title}')
            
            # Count existing content for this topic
            current_content_count = topic.contents.count()
            self.stdout.write(f'Current content count: {current_content_count}')
            
            # Calculate how many more content items we need
            needed_content = max(0, 20 - current_content_count)
            
            if needed_content > 0:
                self.stdout.write(f'Adding {needed_content} more content items...')
                
                # If we have existing content, use it
                if existing_content:
                    # Randomly select content items to add to this topic
                    content_to_add = random.sample(existing_content, min(needed_content, len(existing_content)))
                    
                    for content in content_to_add:
                        try:
                            # Add content to topic if not already added
                            if content not in topic.contents.all():
                                topic.contents.add(content)
                                
                                # Add random votes (0-10)
                                num_votes = random.randint(0, 10)
                                voters = random.sample(users, min(num_votes, len(users)))
                                
                                for voter in voters:
                                    Vote.objects.create(
                                        user=voter,
                                        value=random.choice([-1, 1]),
                                        content_type=ContentType.objects.get_for_model(content),
                                        object_id=content.id,
                                        topic=topic
                                    )
                                
                                # Create or update vote count
                                vote_count, created = VoteCount.objects.get_or_create(
                                    content_type=ContentType.objects.get_for_model(content),
                                    object_id=content.id,
                                    topic=topic,
                                    defaults={'vote_count': 0}
                                )
                                vote_count.update_vote_count()
                                
                                self.stdout.write(f'Added content "{content.original_title}" to topic with {num_votes} votes')
                        except IntegrityError:
                            self.stdout.write(self.style.WARNING(f'Failed to add content to topic: {content.original_title}'))
                            continue
                else:
                    self.stdout.write(self.style.WARNING('No existing content found to add to topics'))
            else:
                self.stdout.write(f'Topic already has sufficient content ({current_content_count} items)')
            
            # Verify final content count
            final_count = topic.contents.count()
            self.stdout.write(f'Final content count for topic: {final_count}')

        self.stdout.write(self.style.SUCCESS('Successfully ensured topic content')) 