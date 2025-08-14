import os
from django.core.management.base import BaseCommand
from django.contrib.sites.models import Site
from allauth.socialaccount.models import SocialApp
from allauth.socialaccount.providers.google.provider import GoogleProvider
from django.conf import settings

class Command(BaseCommand):
    help = 'Sets up Google OAuth application'

    def handle(self, *args, **options):
        # Get or create the default site
        site, created = Site.objects.get_or_create(
            id=settings.SITE_ID,
            defaults={
                'domain': 'localhost:8000',
                'name': 'Academia Blockchain'
            }
        )
        
        # Check if Google OAuth environment variables are set
        client_id = os.environ.get('GOOGLE_OAUTH_CLIENT_ID')
        secret_key = os.environ.get('GOOGLE_OAUTH_SECRET_KEY')
        
        if not client_id or not secret_key:
            self.stdout.write(
                self.style.WARNING(
                    'Google OAuth environment variables are not set. '
                    'Skipping Google OAuth setup.\n'
                    'To enable Google OAuth, set the following environment variables:\n'
                    '- GOOGLE_OAUTH_CLIENT_ID\n'
                    '- GOOGLE_OAUTH_SECRET_KEY\n'
                    'Or create a .env file in the acbc_app directory with these variables.'
                )
            )
            return
        
        # Get or create the Google social app
        app, created = SocialApp.objects.get_or_create(
            provider=GoogleProvider.id,
            defaults={
                'name': 'Google OAuth2',
                'client_id': client_id,
                'secret': secret_key,
                'key': ''
            }
        )
        
        # Update existing app if credentials changed
        if not created:
            app.client_id = client_id
            app.secret = secret_key
            app.save()
            self.stdout.write(self.style.SUCCESS('Updated existing Google OAuth application'))
        else:
            self.stdout.write(self.style.SUCCESS('Successfully created Google OAuth application'))
        
        # Add the site to the app's sites
        app.sites.add(site) 