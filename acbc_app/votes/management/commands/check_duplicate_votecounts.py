from django.core.management.base import BaseCommand
from django.contrib.contenttypes.models import ContentType
from votes.models import VoteCount, Vote
from django.db.models import Count, Sum
from knowledge_paths.models import KnowledgePath
from content.models import Content
from comments.models import Comment

class Command(BaseCommand):
    help = 'Check for duplicate VoteCount objects and clean them up'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        if dry_run:
            self.stdout.write("DRY RUN - No changes will be made\n")
        
        self.stdout.write("Checking for duplicate VoteCount objects...\n")

        # Get all content types we care about
        content_types = [
            ContentType.objects.get_for_model(KnowledgePath),
            ContentType.objects.get_for_model(Content),
            ContentType.objects.get_for_model(Comment)
        ]

        total_duplicates = 0
        total_cleaned = 0

        for content_type in content_types:
            self.stdout.write(f"\nChecking {content_type.model}...")
            
            # Find objects with multiple VoteCounts
            duplicates = VoteCount.objects.filter(
                content_type=content_type
            ).values(
                'content_type', 'object_id', 'topic'
            ).annotate(
                count=Count('id')
            ).filter(
                count__gt=1
            )

            if duplicates.exists():
                self.stdout.write(self.style.WARNING(
                    f"Found {duplicates.count()} {content_type.model} objects with multiple VoteCounts:"
                ))
                total_duplicates += duplicates.count()
                
                for dup in duplicates:
                    self.stdout.write(f"\nObject ID: {dup['object_id']}")
                    self.stdout.write(f"Topic: {dup['topic']}")
                    self.stdout.write(f"Number of VoteCounts: {dup['count']}")
                    
                    # Get all VoteCount objects for this content
                    vote_counts = VoteCount.objects.filter(
                        content_type=content_type,
                        object_id=dup['object_id'],
                        topic=dup['topic']
                    )
                    
                    # Get actual vote sum from Vote model
                    actual_votes = Vote.objects.filter(
                        content_type=content_type,
                        object_id=dup['object_id'],
                        topic=dup['topic']
                    ).aggregate(
                        total=Sum('value')
                    )['total'] or 0
                    
                    self.stdout.write(f"Actual vote sum from Vote model: {actual_votes}")
                    
                    # Find the VoteCount that matches the actual sum
                    correct_votecount = None
                    for vc in vote_counts:
                        if vc.vote_count == actual_votes:
                            correct_votecount = vc
                            break
                    
                    if correct_votecount:
                        self.stdout.write(f"Found correct VoteCount (ID: {correct_votecount.id})")
                        if not dry_run:
                            # Delete all other VoteCounts
                            deleted = vote_counts.exclude(id=correct_votecount.id).delete()
                            self.stdout.write(self.style.SUCCESS(
                                f"Deleted {deleted[0]} duplicate VoteCounts"
                            ))
                            total_cleaned += deleted[0]
                    else:
                        # If no VoteCount matches, update the first one and delete others
                        first_vc = vote_counts.first()
                        if not dry_run:
                            first_vc.vote_count = actual_votes
                            first_vc.save()
                            deleted = vote_counts.exclude(id=first_vc.id).delete()
                            self.stdout.write(self.style.SUCCESS(
                                f"Updated first VoteCount to {actual_votes} and deleted {deleted[0]} duplicates"
                            ))
                            total_cleaned += deleted[0]
            else:
                self.stdout.write(self.style.SUCCESS(
                    f"No duplicate VoteCounts found for {content_type.model}"
                ))

        self.stdout.write("\nSummary:")
        self.stdout.write(f"Total objects with duplicates: {total_duplicates}")
        if not dry_run:
            self.stdout.write(f"Total duplicate VoteCounts cleaned: {total_cleaned}")
        else:
            self.stdout.write("DRY RUN - No changes were made") 