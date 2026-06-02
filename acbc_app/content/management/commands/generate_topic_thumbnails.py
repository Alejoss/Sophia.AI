from django.core.management.base import BaseCommand

from content.models import Topic
from content.image_utils import generate_topic_thumbnail


class Command(BaseCommand):
    help = (
        "Generate downsized listing thumbnails (topic_image_thumbnail) for topics "
        "that already have a topic_image. Useful to backfill existing data."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--topic-id',
            type=int,
            default=None,
            help='Only process the topic with this id.',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Regenerate even if a thumbnail already exists.',
        )

    def handle(self, *args, **options):
        topic_id = options['topic_id']
        force = options['force']

        topics = Topic.objects.exclude(topic_image='').exclude(topic_image__isnull=True)
        if topic_id is not None:
            topics = topics.filter(id=topic_id)

        total = topics.count()
        if total == 0:
            self.stdout.write(self.style.WARNING('No topics with an image to process.'))
            return

        generated = 0
        skipped_existing = 0
        skipped_missing = 0

        for topic in topics.iterator():
            if topic.topic_image_thumbnail and not force:
                skipped_existing += 1
                continue
            if generate_topic_thumbnail(topic):
                generated += 1
                self.stdout.write(self.style.SUCCESS(f'Topic {topic.id}: thumbnail generated.'))
            else:
                skipped_missing += 1
                self.stdout.write(
                    self.style.WARNING(
                        f'Topic {topic.id}: skipped (cover missing or could not process; see logs).'
                    )
                )

        self.stdout.write(
            self.style.SUCCESS(
                f'Done. generated={generated} already_had_thumbnail={skipped_existing} '
                f'skipped_missing_or_error={skipped_missing} total={total}'
            )
        )
