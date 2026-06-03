from django.core.management.base import BaseCommand

from knowledge_paths.models import KnowledgePath
from content.image_utils import generate_knowledge_path_image_preview


class Command(BaseCommand):
    help = (
        'Generate image_preview (480px WebP) for knowledge paths that have a cover image. '
        'Backfill for existing data.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--path-id',
            type=int,
            default=None,
            help='Only process this knowledge path id.',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Regenerate even if image_preview already exists.',
        )

    def handle(self, *args, **options):
        path_id = options['path_id']
        force = options['force']

        paths = KnowledgePath.objects.exclude(image='').exclude(image__isnull=True)
        if path_id is not None:
            paths = paths.filter(id=path_id)

        total = paths.count()
        if total == 0:
            self.stdout.write(self.style.WARNING('No knowledge paths with a cover image to process.'))
            return

        generated = 0
        skipped_existing = 0
        skipped_missing = 0

        for path in paths.iterator():
            if path.image_preview and not force:
                skipped_existing += 1
                continue
            if generate_knowledge_path_image_preview(path):
                generated += 1
                self.stdout.write(self.style.SUCCESS(f'Path {path.id}: image_preview generated.'))
            else:
                skipped_missing += 1
                self.stdout.write(
                    self.style.WARNING(
                        f'Path {path.id}: skipped (source missing or could not process; see logs).'
                    )
                )

        self.stdout.write(
            self.style.SUCCESS(
                f'Done. generated={generated} already_had_preview={skipped_existing} '
                f'skipped_missing_or_error={skipped_missing} total={total}'
            )
        )
