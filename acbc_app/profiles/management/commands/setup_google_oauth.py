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
        
        # Get or create the Google social app
        app, created = SocialApp.objects.get_or_create(
            provider=GoogleProvider.id,
            defaults={
                'name': 'Google OAuth2',
                'client_id': settings.SOCIALACCOUNT_PROVIDERS['google']['APP']['client_id'],
                'secret': settings.SOCIALACCOUNT_PROVIDERS['google']['APP']['secret'],
                'key': settings.SOCIALACCOUNT_PROVIDERS['google']['APP']['key']
            }
        )
        
        # Add the site to the app's sites
        app.sites.add(site)
        
        if created:
            self.stdout.write(self.style.SUCCESS('Successfully created Google OAuth application'))
        else:
            self.stdout.write(self.style.SUCCESS('Google OAuth application already exists')) 