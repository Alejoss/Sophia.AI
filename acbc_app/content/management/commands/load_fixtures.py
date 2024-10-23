from django.core.management.base import BaseCommand
from django.core.management import call_command


class Command(BaseCommand):
    help = 'Loads all fixtures in the correct order'

    def handle(self, *args, **options):
        # List of fixtures to load, in the correct order
        fixtures = [
            'users_fixture.json',
            'profiles_fixture.json',
            'content_fixture.json',
            'comments_fixture.json',
            'votes_fixture.json',
            'events_fixture.json'
        ]

        # Loop through the fixture files and load each one
        for fixture in fixtures:
            self.stdout.write(self.style.SUCCESS(f'Loading fixture: {fixture}'))
            call_command('loaddata', fixture)
            self.stdout.write(self.style.SUCCESS(f'Successfully loaded {fixture}'))

        self.stdout.write(self.style.SUCCESS('All fixtures loaded successfully!'))
