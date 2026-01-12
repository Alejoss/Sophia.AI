"""
Management command to remove founder_member badges from all users.

This command:
1. Finds all UserBadge records with founder_member badge
2. Subtracts 100 points from each user's total_points
3. Deletes UserBadge records
4. Handles users who have founder_member as featured_badge (sets to NULL)
5. Logs all changes

Usage: python manage.py remove_founder_badges [--dry-run]
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import F
from gamification.models import Badge, UserBadge
from profiles.models import Profile
from utils.logging_utils import gamification_logger


class Command(BaseCommand):
    help = 'Remove founder_member badges from all users and adjust points'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        
        if dry_run:
            self.stdout.write(self.style.WARNING('DRY RUN MODE - No changes will be made\n'))
        
        # Get founder badge
        try:
            founder_badge = Badge.objects.get(code='founder_member')
        except Badge.DoesNotExist:
            self.stdout.write(
                self.style.SUCCESS('Founder badge not found. Nothing to remove.')
            )
            return
        
        # Find all UserBadge records with founder_member
        founder_user_badges = UserBadge.objects.filter(badge=founder_badge)
        count = founder_user_badges.count()
        
        if count == 0:
            self.stdout.write(
                self.style.SUCCESS('No founder badges found. Nothing to remove.')
            )
            return
        
        self.stdout.write(f'Found {count} founder badge(s) to remove.\n')
        
        if dry_run:
            self.stdout.write('Would remove badges from the following users:')
            for user_badge in founder_user_badges.select_related('user'):
                profile = Profile.objects.filter(user=user_badge.user).first()
                points = profile.total_points if profile else 0
                self.stdout.write(
                    f'  - {user_badge.user.username} (current points: {points})'
                )
            return
        
        # Process removals in a transaction
        removed_count = 0
        points_adjusted_count = 0
        featured_cleared_count = 0
        
        with transaction.atomic():
            for user_badge in founder_user_badges.select_related('user'):
                user = user_badge.user
                
                # Subtract points
                profile, _ = Profile.objects.get_or_create(user=user)
                old_points = profile.total_points
                
                # Ensure points don't go negative
                new_points = max(0, old_points - 100)
                profile.total_points = new_points
                profile.save()
                
                # Clear featured_badge if it's the founder badge
                if profile.featured_badge and profile.featured_badge.badge.code == 'founder_member':
                    profile.featured_badge = None
                    profile.save()
                    featured_cleared_count += 1
                    self.stdout.write(
                        f'  Cleared featured badge for {user.username}'
                    )
                
                # Delete UserBadge
                user_badge.delete()
                removed_count += 1
                points_adjusted_count += 1
                
                # Log the change
                gamification_logger.info(
                    f'Removed founder badge from user {user.id}',
                    extra={
                        'user_id': user.id,
                        'username': user.username,
                        'old_points': old_points,
                        'new_points': new_points,
                        'points_subtracted': min(100, old_points)
                    }
                )
                
                self.stdout.write(
                    self.style.SUCCESS(
                        f'  Removed founder badge from {user.username} '
                        f'(points: {old_points} → {new_points})'
                    )
                )
        
        # Mark founder badge as inactive
        founder_badge.is_active = False
        founder_badge.save()
        
        self.stdout.write(
            self.style.SUCCESS(
                f'\nRemoval completed:\n'
                f'  Badges removed: {removed_count}\n'
                f'  Points adjusted: {points_adjusted_count}\n'
                f'  Featured badges cleared: {featured_cleared_count}\n'
                f'  Founder badge marked as inactive'
            )
        )
