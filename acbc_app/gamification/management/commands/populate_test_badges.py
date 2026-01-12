"""
Management command to populate badges with dummy data for testing the frontend.

This command:
1. Ensures initial badges exist (creates them if needed)
2. Awards badges to existing users for testing purposes

Usage: 
    python manage.py populate_test_badges
    python manage.py populate_test_badges --user admin  # Award badges to specific user
    python manage.py populate_test_badges --all-users    # Award badges to all users
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from gamification.models import Badge, UserBadge, BadgeCategory
from gamification.rules import award_badge
from profiles.models import Profile


class Command(BaseCommand):
    help = 'Populate badges with dummy data for frontend testing'

    def add_arguments(self, parser):
        parser.add_argument(
            '--user',
            type=str,
            help='Username to award badges to (default: first 5 users)',
        )
        parser.add_argument(
            '--all-users',
            action='store_true',
            help='Award badges to all users',
        )
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Clear existing badges before populating',
        )

    def handle(self, *args, **options):
        # First, ensure badges exist
        self.stdout.write('Ensuring badges exist...')
        from gamification.management.commands.create_initial_badges import Command as CreateBadgesCommand
        create_badges_cmd = CreateBadgesCommand()
        create_badges_cmd.handle()
        
        # Get all available badges
        badges = Badge.objects.filter(is_active=True).order_by('category', 'points_value')
        
        if not badges.exists():
            self.stdout.write(self.style.ERROR('No badges found. Please run create_initial_badges first.'))
            return
        
        # Clear existing badges if requested
        if options['clear']:
            self.stdout.write('Clearing existing user badges...')
            UserBadge.objects.all().delete()
            # Reset total_points for all profiles
            Profile.objects.all().update(total_points=0)
            self.stdout.write(self.style.SUCCESS('Cleared all user badges'))
        
        # Determine which users to award badges to
        if options['user']:
            try:
                users = [User.objects.get(username=options['user'])]
            except User.DoesNotExist:
                self.stdout.write(self.style.ERROR(f'User "{options["user"]}" not found.'))
                return
        elif options['all_users']:
            users = list(User.objects.all())
        else:
            # Default: award all badges to user with id = 1
            try:
                users = [User.objects.get(id=1)]
            except User.DoesNotExist:
                self.stdout.write(self.style.ERROR('User with id=1 not found.'))
                return
        
        if not users:
            self.stdout.write(self.style.WARNING('No users found to award badges to.'))
            return
        
        self.stdout.write(f'\nAwarding badges to {len(users)} user(s)...\n')
        
        # Get all badge codes (all 11 badges)
        all_badge_codes = list(badges.values_list('code', flat=True))
        
        # If default behavior (user id=1) or specific user, award ALL badges
        # If --all-users, use the subset logic
        if options['all_users']:
            # Badge codes to award (mix of different categories) for multiple users
            badge_codes_to_award = [
                'first_comment',                    # CONTRIBUTION - Easy to get
                'knowledge_seeker',                  # LEARNING - Medium difficulty
                'first_highly_rated_comment',        # RECOGNITION - Medium difficulty
                'first_knowledge_path_completed',    # LEARNING - Higher value
                'quiz_master',                       # LEARNING - Medium difficulty
                'community_voice',                   # RECOGNITION - Higher value
                'content_creator',                   # CONTRIBUTION - Higher value
            ]
        else:
            # Award ALL badges to the specified user(s)
            badge_codes_to_award = all_badge_codes
        
        total_awarded = 0
        total_skipped = 0
        
        for user in users:
            self.stdout.write(f'\nProcessing user: {user.username} (ID: {user.id})')
            
            if options['all_users']:
                # Award a subset of badges to each user (varying amounts for testing)
                user_index = list(users).index(user)
                num_badges_to_award = min(3 + (user_index % 4), len(badge_codes_to_award))
                badges_for_user = badge_codes_to_award[:num_badges_to_award]
            else:
                # Award ALL badges to this user
                badges_for_user = badge_codes_to_award
            
            user_awarded = 0
            user_skipped = 0
            
            for badge_code in badges_for_user:
                try:
                    badge = Badge.objects.get(code=badge_code, is_active=True)
                    
                    # Check if user already has this badge
                    if UserBadge.objects.filter(user=user, badge=badge).exists():
                        user_skipped += 1
                        continue
                    
                    # Award the badge
                    user_badge = award_badge(
                        user=user,
                        badge_code=badge_code,
                        context_data={'test_data': True, 'awarded_by': 'populate_test_badges'}
                    )
                    
                    if user_badge:
                        user_awarded += 1
                        self.stdout.write(
                            self.style.SUCCESS(f'  ✓ Awarded: {badge.name} (+{badge.points_value} points)')
                        )
                    else:
                        user_skipped += 1
                        
                except Badge.DoesNotExist:
                    self.stdout.write(
                        self.style.WARNING(f'  ⚠ Badge "{badge_code}" not found, skipping')
                    )
                    user_skipped += 1
                except Exception as e:
                    self.stdout.write(
                        self.style.ERROR(f'  ✗ Error awarding {badge_code}: {str(e)}')
                    )
                    user_skipped += 1
            
            total_awarded += user_awarded
            total_skipped += user_skipped
            
            # Show user's total points
            try:
                profile = Profile.objects.get(user=user)
                self.stdout.write(
                    f'  Total points: {profile.total_points} | Badges: {user_awarded} awarded, {user_skipped} skipped'
                )
            except Profile.DoesNotExist:
                self.stdout.write(self.style.WARNING(f'  ⚠ No profile found for user {user.username}'))
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\n\nCompleted! Awarded {total_awarded} badges total, skipped {total_skipped} duplicates.'
            )
        )
        
        # Summary
        self.stdout.write('\nSummary:')
        self.stdout.write(f'  Users processed: {len(users)}')
        self.stdout.write(f'  Badges available: {badges.count()}')
        self.stdout.write(f'  Badges awarded: {total_awarded}')
        self.stdout.write(f'  Badges skipped (already had): {total_skipped}')
        
        # Show badge distribution
        self.stdout.write('\nBadge distribution by category:')
        for category in BadgeCategory.choices:
            category_badges = badges.filter(category=category[0])
            user_badges_count = UserBadge.objects.filter(badge__category=category[0]).count()
            self.stdout.write(f'  {category[1]}: {category_badges.count()} badges available, {user_badges_count} awarded to users')
