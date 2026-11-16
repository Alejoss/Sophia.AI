"""Refresh knowledge-path campaigns from the Bitcoin Cash chain.

Example:
  python manage.py sync_path_proposals
"""

from django.core.management.base import BaseCommand

from knowledge_paths.services.funding_sync import sync_open_proposals


class Command(BaseCommand):
    help = 'Index campaign coins and pledge NFTs for open funding proposals.'

    def handle(self, *args, **options):
        count = sync_open_proposals()
        self.stdout.write(self.style.SUCCESS(f'Synced {count} funding proposals.'))
