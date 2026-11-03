"""Export newsletter recipients and the personal baja link for each one."""

import csv

from django.core.management.base import BaseCommand

from profiles.models import NewsletterSubscription
from profiles.newsletter import (
    active_newsletter_subscriptions,
    newsletter_unsubscribe_url,
)


class Command(BaseCommand):
    help = (
        'Print newsletter recipients as CSV (email, unsubscribe_url, is_active, source). '
        'By default only active subscribers are included. '
        'Use each unsubscribe_url only for that recipient.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--include-inactive',
            action='store_true',
            help='Also list addresses that already unsubscribed',
        )

    def handle(self, *args, **options):
        if options['include_inactive']:
            subscriptions = NewsletterSubscription.objects.all().order_by('email')
        else:
            subscriptions = active_newsletter_subscriptions()

        writer = csv.writer(self.stdout)
        writer.writerow(['email', 'unsubscribe_url', 'is_active', 'source'])
        for subscription in subscriptions:
            writer.writerow([
                subscription.email,
                newsletter_unsubscribe_url(subscription),
                'yes' if subscription.is_active else 'no',
                subscription.source,
            ])
