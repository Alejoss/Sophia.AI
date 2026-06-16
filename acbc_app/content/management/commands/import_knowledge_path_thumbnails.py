"""
Bulk-assign ContentProfile thumbnails for nodes in a knowledge path.

Place image files in a folder at the project root (default: ucronia_thumbnails/).
Files are matched to nodes by chapter number, extracted from the filename or node order.

Naming examples (all map to chapter 01):
  01.jpg
  01 - Datos.png
  Ucronia_01_Datos.webp
  Ucronía 01 - Datos (subtítulos español).jpg

Run from acbc_app/:
  python manage.py import_knowledge_path_thumbnails --dry-run
  python manage.py import_knowledge_path_thumbnails --knowledge-path-id 1
"""
import re
from pathlib import Path

from django.core.files import File
from django.core.management.base import BaseCommand, CommandError

from content.image_utils import (
    delete_content_profile_thumbnail_preview,
    generate_content_profile_thumbnail_preview,
    validate_content_profile_thumbnail_size,
)
from knowledge_paths.models import KnowledgePath, Node

IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.gif'}

# Leading "01", "1", "Ucronía 01", "Ucronia_01", etc.
CHAPTER_NUMBER_RE = re.compile(
    r'(?:^|ucron[ií]a[\s_-]*)0*(\d{1,2})\b',
    re.IGNORECASE,
)


def repo_root() -> Path:
    # acbc_app/content/management/commands/ -> repo root
    return Path(__file__).resolve().parents[4]


def default_thumbnails_dir() -> Path:
    return repo_root() / 'ucronia_thumbnails'


def chapter_number_from_stem(stem: str) -> int | None:
    """Extract chapter number from a filename stem."""
    stem = stem.strip()
    if not stem:
        return None

    match = CHAPTER_NUMBER_RE.search(stem.replace('_', ' '))
    if match:
        return int(match.group(1))

    leading = re.match(r'^0*(\d{1,2})(?:\s|$|[-_.])', stem)
    if leading:
        return int(leading.group(1))

    return None


def index_images(folder: Path) -> dict[int, Path]:
    """Map chapter number -> image path. Warn on duplicates via return side channel."""
    by_chapter: dict[int, Path] = {}
    for path in sorted(folder.iterdir()):
        if not path.is_file():
            continue
        if path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        chapter = chapter_number_from_stem(path.stem)
        if chapter is None:
            continue
        by_chapter[chapter] = path
    return by_chapter


def resolve_knowledge_path(knowledge_path_id, path_title):
    if knowledge_path_id is not None:
        path = KnowledgePath.objects.filter(pk=knowledge_path_id).first()
        if not path:
            raise CommandError(f'Knowledge path id={knowledge_path_id} not found.')
        return path

    if path_title:
        path = KnowledgePath.objects.filter(title__icontains=path_title).order_by('id').first()
        if not path:
            raise CommandError(f'No knowledge path matching title "{path_title}".')
        return path

    raise CommandError('Provide --knowledge-path-id or --path-title.')


class Command(BaseCommand):
    help = (
        'Assign local thumbnail images to ContentProfiles linked from knowledge path nodes. '
        'Uploads via Django storage (S3 in production).'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--folder',
            type=str,
            default=None,
            help='Folder with thumbnail images (default: <repo>/ucronia_thumbnails/).',
        )
        parser.add_argument(
            '--knowledge-path-id',
            type=int,
            default=None,
            help='Knowledge path id (e.g. 1 for Ucronía).',
        )
        parser.add_argument(
            '--path-title',
            type=str,
            default='Ucronía',
            help='Match knowledge path by title substring when id is omitted (default: Ucronía).',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show matches only; do not upload or update the database.',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Replace thumbnails even when a custom thumbnail already exists.',
        )

    def handle(self, *args, **options):
        folder = Path(options['folder']) if options['folder'] else default_thumbnails_dir()
        if not folder.is_dir():
            raise CommandError(
                f'Thumbnails folder not found: {folder}\n'
                f'Create it at the project root and add files named like 01.jpg, 02.png, ...'
            )

        knowledge_path = resolve_knowledge_path(
            options['knowledge_path_id'],
            options['path_title'] if options['knowledge_path_id'] is None else None,
        )
        images_by_chapter = index_images(folder)
        if not images_by_chapter:
            raise CommandError(
                f'No image files found in {folder}. '
                f'Supported: {", ".join(sorted(IMAGE_EXTENSIONS))}'
            )

        nodes = (
            Node.objects.filter(knowledge_path=knowledge_path)
            .select_related('content_profile')
            .order_by('order')
        )
        if not nodes.exists():
            raise CommandError(f'Knowledge path "{knowledge_path.title}" has no nodes.')

        self.stdout.write(
            f'Path: "{knowledge_path.title}" (id={knowledge_path.id}), '
            f'{nodes.count()} nodes, {len(images_by_chapter)} images in {folder}'
        )

        updated = 0
        skipped_existing = 0
        skipped_no_profile = 0
        skipped_no_image = 0
        errors = 0

        for node in nodes:
            chapter = node.order
            image_path = images_by_chapter.get(chapter)
            profile = node.content_profile

            if not profile:
                skipped_no_profile += 1
                self.stdout.write(
                    self.style.WARNING(f'  Node order={chapter} "{node.title}": no content_profile')
                )
                continue

            if not image_path:
                skipped_no_image += 1
                self.stdout.write(
                    self.style.WARNING(
                        f'  Node order={chapter} profile={profile.id}: no image for chapter {chapter}'
                    )
                )
                continue

            if profile.thumbnail and not options['force']:
                skipped_existing += 1
                self.stdout.write(
                    f'  Node order={chapter} profile={profile.id}: already has thumbnail (use --force)'
                )
                continue

            label = (
                f'  Node order={chapter} profile={profile.id} '
                f'"{profile.display_title}" <- {image_path.name}'
            )

            if options['dry_run']:
                self.stdout.write(self.style.SUCCESS(f'[DRY RUN] Would update{label[1:]}'))
                updated += 1
                continue

            try:
                with image_path.open('rb') as handle:
                    uploaded = File(handle, name=image_path.name)
                    validate_content_profile_thumbnail_size(uploaded)
                    if profile.thumbnail:
                        profile.thumbnail.delete(save=False)
                    delete_content_profile_thumbnail_preview(profile, save=False)
                    profile.thumbnail.save(image_path.name, uploaded, save=True)
                    generate_content_profile_thumbnail_preview(profile)
            except Exception as exc:
                errors += 1
                self.stdout.write(self.style.ERROR(f'{label} FAILED: {exc}'))
                continue

            updated += 1
            self.stdout.write(self.style.SUCCESS(f'Updated{label[1:]}'))

        self.stdout.write(
            self.style.SUCCESS(
                f'Done. updated={updated} skipped_existing={skipped_existing} '
                f'skipped_no_profile={skipped_no_profile} skipped_no_image={skipped_no_image} '
                f'errors={errors}'
            )
        )
