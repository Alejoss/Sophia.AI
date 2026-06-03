from django.core.management.base import BaseCommand

from content.models import ContentProfile
from content.image_utils import generate_content_profile_thumbnail_preview


class Command(BaseCommand):
    help = (
        'Generate thumbnail_preview (480px WebP) for ContentProfiles that have a '
        'custom thumbnail upload. Backfill for existing data.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--profile-id',
            type=int,
            default=None,
            help='Only process this content profile id.',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Regenerate even if thumbnail_preview already exists.',
        )

    def handle(self, *args, **options):
        profile_id = options['profile_id']
        force = options['force']

        profiles = ContentProfile.objects.exclude(thumbnail='').exclude(thumbnail__isnull=True)
        if profile_id is not None:
            profiles = profiles.filter(id=profile_id)

        total = profiles.count()
        if total == 0:
            self.stdout.write(self.style.WARNING('No content profiles with a custom thumbnail to process.'))
            return

        generated = 0
        skipped_existing = 0
        skipped_missing = 0

        for profile in profiles.iterator():
            if profile.thumbnail_preview and not force:
                skipped_existing += 1
                continue
            if generate_content_profile_thumbnail_preview(profile):
                generated += 1
                self.stdout.write(self.style.SUCCESS(f'Profile {profile.id}: thumbnail_preview generated.'))
            else:
                skipped_missing += 1
                self.stdout.write(
                    self.style.WARNING(
                        f'Profile {profile.id}: skipped (source missing or could not process; see logs).'
                    )
                )

        self.stdout.write(
            self.style.SUCCESS(
                f'Done. generated={generated} already_had_preview={skipped_existing} '
                f'skipped_missing_or_error={skipped_missing} total={total}'
            )
        )
