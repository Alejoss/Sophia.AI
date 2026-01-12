"""
Management command to grant founder badges to early users.

Usage: python manage.py grant_founder_badges [--limit=N]
"""

from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from gamification.models import Badge
from gamification import rules


class Command(BaseCommand):
    help = 'Grant founder badges to the first N users (default: 100)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--limit',
            type=int,
            default=100,
            help='Number of earliest users to grant founder badges (default: 100)'
        )

    def handle(self, *args, **options):
        limit = options['limit']
        
        # Get founder badge
        try:
            founder_badge = Badge.objects.get(code='founder_member', is_active=True)
        except Badge.DoesNotExist:
            self.stdout.write(
                self.style.ERROR('Founder badge not found. Please run create_initial_badges first.')
            )
            return

        # Get earliest users ordered by date_joined
        early_users = User.objects.order_by('date_joined')[:limit]
        
        granted_count = 0
        skipped_count = 0

        for user in early_users:
            # Check if user already has the badge
            if rules.has_badge(user, 'founder_member'):
                skipped_count += 1
                self.stdout.write(
                    self.style.WARNING(f'User {user.username} already has founder badge')
                )
                continue

            # Award badge
            user_badge = rules.award_badge(
                user,
                'founder_member',
                {'granted_at': timezone.now().isoformat(), 'user_registration_date': user.date_joined.isoformat()}
            )

            if user_badge:
                granted_count += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Granted founder badge to {user.username} (joined: {user.date_joined})'
                    )
                )
            else:
                skipped_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'\nFounder badge granting completed. Granted: {granted_count}, Skipped: {skipped_count}'
            )
        )